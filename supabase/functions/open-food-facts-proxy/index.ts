// Supabase Edge Function: open-food-facts-proxy
//
// Searches Open Food Facts for packaged/branded foods. OFF needs no API key —
// the proxy exists to keep CORS under our control, to normalise the very loose
// `nutriments` shape into the four macros the app uses, and to apply the same
// auth gate as the other proxies (valid Supabase JWT → 401, ALLOWED_EMAIL → 403).
//
// TWO UPSTREAMS. The documented `cgi/search.pl` endpoint is tried first, but as
// of 2026-08 world.openfoodfacts.org answers anonymous text search with a 503
// "Page temporarily unavailable" interstitial (their anti-bot gate — `api/v2/search`
// is gated the same way). So when it fails we fall back to Search-a-licious at
// search.openfoodfacts.org, which is unauthenticated and healthy. Both are
// normalised to one OffFood shape, so the caller can't tell which answered.
//
// Deploy:
//   supabase functions deploy open-food-facts-proxy
//
// Body: { query: string }
// Returns: { results: OffFood[] } — or { results: [], unavailable: true } when
// both upstreams are down, so the caller can fall through to a Claude estimate.

import { corsHeaders, json, requireAllowedUser } from '../_shared/auth.ts';

const LEGACY_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const PAGE_SIZE = 5;

/** OFF asks every client to identify itself; anonymous traffic gets throttled. */
const USER_AGENT = 'ToDoProductivity-PWA/1.0 (nutrition macro lookup)';

/** cgi/search.pl is slow on a cold cache — bail out rather than hang the UI. */
const TIMEOUT_MS = 12_000;

const FIELDS = [
  'product_name',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'brands',
  'image_front_small_url',
].join(',');

interface OffProduct {
  product_name?: string;
  /** A comma-joined string on cgi/search.pl, an array on Search-a-licious. */
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  image_front_small_url?: string;
  nutriments?: Record<string, unknown>;
}

export interface OffFood {
  name: string;
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  serving_size: string | null;
  serving_quantity_g: number | null;
  image_url: string | null;
}

/** OFF stores numbers as either numbers or strings depending on the importer. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Energy is the one field OFF is inconsistent about: most products carry
 * `energy-kcal_100g`, plenty of others only have kJ. Convert when that's all
 * there is, so a usable product isn't dropped for a missing alias.
 */
function calories(nutriments: Record<string, unknown>): number | null {
  const kcal = num(nutriments['energy-kcal_100g']);
  if (kcal !== null) return kcal;
  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments['energy_100g']);
  return kj === null ? null : kj / 4.184;
}

/** First brand only — "Chobani,  Chobani  Inc." reads badly in a one-line row. */
function firstBrand(brands: string | string[] | undefined): string {
  const raw = Array.isArray(brands) ? brands[0] : (brands ?? '').split(',')[0];
  return (raw ?? '').trim();
}

function toFood(p: OffProduct): OffFood | null {
  const nutriments = p.nutriments ?? {};
  const kcal = calories(nutriments);
  // No energy means the entry is a stub — useless for logging a meal.
  if (kcal === null || kcal === 0) return null;

  const productName = (p.product_name ?? '').trim();
  if (!productName) return null;
  const brand = firstBrand(p.brands);
  // Don't repeat the brand when the product name already leads with it
  // ("Chobani Flip Yogurt" shouldn't become "Chobani Flip Yogurt (Chobani)").
  const showBrand = brand && !productName.toLowerCase().includes(brand.toLowerCase());

  return {
    name: showBrand ? `${productName} (${brand})` : productName,
    calories_100g: kcal,
    protein_100g: num(nutriments['proteins_100g']) ?? 0,
    carbs_100g: num(nutriments['carbohydrates_100g']) ?? 0,
    fat_100g: num(nutriments['fat_100g']) ?? 0,
    serving_size: (p.serving_size ?? '').trim() || null,
    // Search-a-licious doesn't index serving fields; they stay null there. The
    // caller works off grams from the parse step, so this is display-only.
    serving_quantity_g: num(p.serving_quantity),
    image_url: (p.image_front_small_url ?? '').trim() || null,
  };
}

/**
 * OFF's text search is recall-first and will happily answer "Big Mac" with
 * "Original macaroni & cheese dinner" — a substring hit on "mac". Logging that
 * under a blue "Open Food Facts" badge is worse than admitting we don't know,
 * so a product must share at least one whole word with the query to survive,
 * and the best-overlapping product wins. Matching is word-for-word rather than
 * by substring, which is exactly what lets the macaroni case through.
 */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

function overlap(query: string[], food: OffFood): number {
  const words = new Set(tokenize(food.name));
  return query.filter((q) => words.has(q)).length;
}

/** A search that returns null (rather than []) means "upstream failed, try the next one". */
async function fetchProducts(url: URL, key: 'products' | 'hits'): Promise<OffProduct[] | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    // The 503 interstitial is served as HTML, so a JSON parse failure here is
    // the normal "gated" path, not an exceptional one.
    const data = (await res.json()) as Record<string, unknown>;
    const list = data[key];
    return Array.isArray(list) ? (list as OffProduct[]) : null;
  } catch {
    return null;
  }
}

function legacyUrl(query: string): URL {
  const url = new URL(LEGACY_URL);
  url.searchParams.set('search_terms', query);
  url.searchParams.set('json', 'true');
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('fields', FIELDS);
  return url;
}

function searchUrl(query: string): URL {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('fields', FIELDS);
  return url;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const auth = await requireAllowedUser(req);
  if (!auth.ok) return auth.response;

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Body must be JSON.' }, 400);
  }

  const query = (body.query ?? '').trim();
  if (!query) return json(req, { error: 'query is required.' }, 400);

  const products =
    (await fetchProducts(legacyUrl(query), 'products')) ??
    (await fetchProducts(searchUrl(query), 'hits'));

  // Both upstreams unreachable — the caller falls through to a Claude estimate.
  if (products === null) return json(req, { results: [], unavailable: true }, 200);

  const foods = products.map(toFood).filter((f): f is OffFood => f !== null);

  // A query of only short words ("egg", "ham") tokenizes to something usable;
  // one that tokenizes to nothing at all can't be scored, so trust OFF's order.
  const qTokens = tokenize(query);
  const results = qTokens.length
    ? foods
        .map((f) => ({ f, score: overlap(qTokens, f) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.f)
    : foods;

  return json(req, { results }, 200);
});
