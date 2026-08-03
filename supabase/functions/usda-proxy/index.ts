// Supabase Edge Function: usda-proxy
//
// Proxies a FoodData Central search so USDA_API_KEY stays server-side. Same
// gate as anthropic-proxy: valid Supabase JWT (401) AND the ALLOWED_EMAIL
// whitelist (403), CORS locked to the app's origin(s).
//
// Deploy:
//   supabase functions deploy usda-proxy
//   supabase secrets set USDA_API_KEY=...
//
// Body: { type: "describe", query: string }
// Returns: { results: UsdaFood[] }  — top 3, generic foods only, per 100g.

import { corsHeaders, json, requireAllowedUser } from '../_shared/auth.ts';

const USDA_API_KEY = Deno.env.get('USDA_API_KEY');
const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** How many the API gives us before filtering, and how many we hand back. */
const PAGE_SIZE = 5;
const MAX_RESULTS = 3;

/** Foundation is the better-curated set, so it outranks SR Legacy. */
const DATA_TYPES = ['Foundation', 'SR Legacy'] as const;
const RANK: Record<string, number> = { Foundation: 0, 'SR Legacy': 1 };

/**
 * FDC nutrient numbers. Search results carry `nutrientNumber` as a string;
 * some responses only populate `nutrientId`, so both are checked.
 */
const NUTRIENTS = {
  calories: { number: '208', id: 1008 },
  protein_100g: { number: '203', id: 1003 },
  carbs_100g: { number: '205', id: 1005 },
  fat_100g: { number: '204', id: 1004 },
} as const;

interface FdcNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface FdcFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  brandOwner?: string | null;
  brandName?: string | null;
  foodNutrients?: FdcNutrient[];
  foodPortions?: unknown[];
  foodMeasures?: unknown[];
}

/** One portion the label knows about, normalised to grams. */
interface Portion {
  label: string;
  gram_weight: number;
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  /** Every macro is per 100g — Foundation and SR Legacy are both reported that way. */
  calories: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  foodPortions: Portion[];
}

function nutrient(food: FdcFood, spec: { number: string; id: number }): number {
  const hit = (food.foodNutrients ?? []).find(
    (n) => n.nutrientNumber === spec.number || n.nutrientId === spec.id
  );
  const v = Number(hit?.value);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Search results carry `foodMeasures` (household measures) rather than the
 * detail endpoint's `foodPortions`. Both share the same shape for the two
 * fields we care about, so either is accepted and normalised to one list.
 */
function portions(food: FdcFood): Portion[] {
  const raw = [...(food.foodPortions ?? []), ...(food.foodMeasures ?? [])] as Record<
    string,
    unknown
  >[];
  return raw
    .map((p) => {
      const grams = Number(p.gramWeight);
      const amount = Number(p.amount);
      const unit =
        typeof p.disseminationText === 'string'
          ? p.disseminationText
          : typeof p.modifier === 'string'
            ? p.modifier
            : typeof (p.measureUnit as { name?: string } | undefined)?.name === 'string'
              ? (p.measureUnit as { name: string }).name
              : '';
      const label = [Number.isFinite(amount) && amount > 0 ? amount : null, unit]
        .filter(Boolean)
        .join(' ')
        .trim();
      return { label: label || `${grams}g`, gram_weight: Number.isFinite(grams) ? grams : 0 };
    })
    .filter((p) => p.gram_weight > 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const auth = await requireAllowedUser(req);
  if (!auth.ok) return auth.response;

  if (!USDA_API_KEY) {
    return json(req, { error: 'USDA_API_KEY secret is not set.' }, 500);
  }

  let body: { type?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Body must be JSON.' }, 400);
  }

  const query = (body.query ?? '').trim();
  if (!query) return json(req, { error: 'query is required.' }, 400);
  // "describe" is the only supported mode today; anything else is a caller bug.
  if (body.type && body.type !== 'describe') {
    return json(req, { error: `Unsupported type "${body.type}".` }, 400);
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('api_key', USDA_API_KEY);
  url.searchParams.set('dataType', DATA_TYPES.join(','));
  url.searchParams.set('pageSize', String(PAGE_SIZE));

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json(req, { error: `USDA search failed (${res.status}).`, detail }, res.status);
    }

    const data = (await res.json()) as { foods?: FdcFood[] };
    const results: UsdaFood[] = (data.foods ?? [])
      // Branded entries have no place here — USDA stays the generic/whole-food
      // source and Open Food Facts covers anything with a brand on the box.
      .filter((f) => !f.brandOwner && !f.brandName)
      .filter((f) => typeof f.fdcId === 'number' && !!f.description)
      .map((f) => ({
        fdcId: f.fdcId as number,
        description: f.description as string,
        dataType: f.dataType ?? 'Unknown',
        calories: nutrient(f, NUTRIENTS.calories),
        protein_100g: nutrient(f, NUTRIENTS.protein_100g),
        carbs_100g: nutrient(f, NUTRIENTS.carbs_100g),
        fat_100g: nutrient(f, NUTRIENTS.fat_100g),
        foodPortions: portions(f),
      }))
      // Drop nutrient-less rows BEFORE ranking. Some Foundation entries carry no
      // values at all ("Lunchmeat, chicken breast, sliced"); filtering after the
      // sort would let one take a top-3 slot and push out a usable SR Legacy row.
      .filter((f) => f.calories > 0)
      // Foundation outranks SR Legacy; within a tier the API's relevance order
      // is preserved, so this must be a stable sort (it is, per spec).
      .sort((a, b) => (RANK[a.dataType] ?? 9) - (RANK[b.dataType] ?? 9))
      .slice(0, MAX_RESULTS);

    return json(req, { results }, 200);
  } catch (err) {
    // Unreachable USDA is a soft failure: the caller falls through to the next
    // source rather than showing an error.
    return json(
      req,
      { results: [], unavailable: true, error: err instanceof Error ? err.message : 'USDA error' },
      200
    );
  }
});
