// "Describe your meal" — free text in, a per-item macro breakdown out.
//
// Three stages, in order:
//   1. Claude splits the description into food items with quantities in grams.
//   2. Each item is resolved against a real nutrition database — USDA for
//      generic whole foods, Open Food Facts for branded/restaurant items — with
//      a Claude estimate only as a last resort. All items resolve in parallel.
//   3. Per-100g values are scaled to the grams from stage 1, in code.
//
// Claude never does the arithmetic: it identifies and converts to grams, the
// databases supply the macros, and the multiplication happens here. That keeps
// the numbers reproducible and lets every row say where it came from.

import { supabase } from './supabase';
import type { MacroSource, Macros, MealItem, ParsedFoodItem } from '../types/nutrition';

const MODEL = 'claude-sonnet-4-6';

/** Which stage of the pipeline is running — drives the loading card's status text. */
export type AnalyzeStage = 'identifying' | 'looking-up' | 'calculating';

/** Thrown when the description yields no usable items; the UI shows its message. */
export class MealParseError extends Error {}
/** Thrown when nothing at all could be resolved — network/proxy trouble. */
export class MealLookupError extends Error {}

const PARSE_SYSTEM = `You are a food identification assistant. Parse the user's meal description into individual food items with quantities. Return ONLY a JSON array with no other text:
[
  {
    item: string (clean food name for database lookup, e.g. 'grilled chicken breast' not 'some chicken'),
    quantity: number (numeric amount),
    unit: string (g, oz, cup, piece, slice, tbsp etc),
    quantity_grams: number (your best conversion to grams — e.g. 1 cup rice = 186g, 1 Big Mac = 214g),
    is_branded: boolean (true if this is a specific branded/restaurant item like Big Mac, Chobani, Doritos — false for generic items like chicken, rice),
    search_query: string (optimized search term for database lookup — keep it simple, 2-4 words)
  }
]
If the description contains no identifiable food, return [].`;

/** Per-100g macros, whatever the source. */
interface Per100g extends Macros {
  /** The source's own name for the match, when it has one. */
  matched_name: string | null;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/**
 * Pull the first balanced JSON value of the given kind out of a reply,
 * tolerating code fences and preamble. Mirrors the extractor in nutritionScan,
 * generalised so it can find an array as well as an object.
 */
function extractJson(raw: string, kind: 'array' | 'object'): unknown {
  const [open, close] = kind === 'array' ? ['[', ']'] : ['{', '}'];
  const start = raw.indexOf(open);
  if (start === -1) throw new Error('No JSON in response.');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(raw.slice(start, i + 1));
  }
  throw new Error('Truncated JSON in response.');
}

/** One Claude round-trip through the proxy, returning the reply's text block. */
async function ask(
  messages: { role: string; content: string }[],
  opts: { system?: string; maxTokens?: number } = {}
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('anthropic-proxy', {
    body: {
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1000,
      system: opts.system,
      messages,
    },
  });
  if (error) throw new Error(error.message);
  return (data as { content?: { text?: string }[] })?.content?.[0]?.text ?? '';
}

/** Units that read better closed up: "200g", not "200 g". */
const TIGHT_UNITS = new Set(['g', 'kg', 'mg', 'oz', 'ml', 'l', 'lb']);

function quantityDisplay(item: ParsedFoodItem): string {
  const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : null;
  const unit = item.unit.trim();
  if (qty === null) return unit || `${Math.round(item.quantity_grams)}g`;
  // Trim a trailing .0 without touching genuine fractions like 1.5.
  const n = Number(qty.toFixed(2)).toString();
  if (!unit) return n;
  if (TIGHT_UNITS.has(unit.toLowerCase())) return `${n}${unit}`;
  // "1 slices" reads wrong; "2 slice" too. Pluralise on the count.
  const plural = qty !== 1 && !unit.endsWith('s') ? `${unit}s` : unit;
  return `${n} ${plural}`;
}

/**
 * STEP 1 — Claude splits the description into items and converts each to grams.
 * Throws MealParseError when nothing food-like came back, which the UI turns
 * into the "be more specific" message.
 */
export async function parseMeal(description: string): Promise<ParsedFoodItem[]> {
  let text: string;
  try {
    text = await ask([{ role: 'user', content: description }], {
      system: PARSE_SYSTEM,
      maxTokens: 1500,
    });
  } catch (err) {
    throw new MealLookupError(err instanceof Error ? err.message : 'Parse request failed.');
  }

  let raw: unknown;
  try {
    raw = extractJson(text, 'array');
  } catch {
    throw new MealParseError('Model did not return a food list.');
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new MealParseError('No foods identified.');
  }

  const items = (raw as Record<string, unknown>[])
    .map((it): ParsedFoodItem => {
      const item = str(it.item, '');
      const unit = str(it.unit, '');
      const quantity = num(it.quantity);
      // A missing gram conversion is recoverable: a gram unit is already the
      // answer, and anything else falls back to a single 100g portion rather
      // than logging a zero.
      const grams = num(it.quantity_grams) || (unit.toLowerCase() === 'g' ? quantity : 0) || 100;
      return {
        item,
        quantity,
        unit,
        quantity_grams: grams,
        is_branded: it.is_branded === true,
        search_query: str(it.search_query, item),
      };
    })
    .filter((it) => it.item !== '');

  if (items.length === 0) throw new MealParseError('No foods identified.');
  return items;
}

/** USDA: generic whole foods. Returns null when it has nothing (or is down). */
async function lookupUsda(query: string): Promise<Per100g | null> {
  const { data, error } = await supabase.functions.invoke('usda-proxy', {
    body: { type: 'describe', query },
  });
  if (error) return null;
  const top = (data as { results?: Record<string, unknown>[] })?.results?.[0];
  if (!top) return null;
  return {
    calories: num(top.calories),
    protein_g: num(top.protein_100g),
    carbs_g: num(top.carbs_100g),
    fat_g: num(top.fat_100g),
    matched_name: str(top.description, '') || null,
  };
}

/** Open Food Facts: packaged and branded items. Null when it has nothing. */
async function lookupOpenFoodFacts(query: string): Promise<Per100g | null> {
  const { data, error } = await supabase.functions.invoke('open-food-facts-proxy', {
    body: { query },
  });
  if (error) return null;
  const top = (data as { results?: Record<string, unknown>[] })?.results?.[0];
  if (!top) return null;
  return {
    calories: num(top.calories_100g),
    protein_g: num(top.protein_100g),
    carbs_g: num(top.carbs_100g),
    fat_g: num(top.fat_100g),
    matched_name: str(top.name, '') || null,
  };
}

/** Last resort: Claude's own per-100g guess, badged so the user knows. */
async function estimate(name: string): Promise<Per100g | null> {
  try {
    const text = await ask(
      [
        {
          role: 'user',
          content:
            `Estimate the macros per 100g for ${name}. ` +
            "Return only JSON: { calories: N, protein_g: N, carbs_g: N, fat_g: N, confidence: 'estimate' }",
        },
      ],
      { maxTokens: 300 }
    );
    const obj = extractJson(text, 'object') as Record<string, unknown>;
    const per: Per100g = {
      calories: num(obj.calories),
      protein_g: num(obj.protein_g),
      carbs_g: num(obj.carbs_g),
      fat_g: num(obj.fat_g),
      matched_name: null,
    };
    return per.calories > 0 ? per : null;
  } catch {
    return null;
  }
}

/**
 * STEP 2 — resolve one item. Generic foods try USDA first and fall through to
 * Open Food Facts; branded items go straight to Open Food Facts. Either way a
 * Claude estimate is the floor, so a row is only lost if that fails too.
 */
async function resolve(item: ParsedFoodItem): Promise<{ per: Per100g; source: MacroSource } | null> {
  const q = item.search_query;

  if (!item.is_branded) {
    const usda = await lookupUsda(q);
    if (usda) return { per: usda, source: 'usda' };
  }

  const off = await lookupOpenFoodFacts(q);
  if (off) return { per: off, source: 'open_food_facts' };

  // A generic food that USDA missed is worth one more USDA-free attempt only if
  // we skipped it above; branded items have already tried both real sources.
  if (item.is_branded) {
    const usda = await lookupUsda(q);
    if (usda) return { per: usda, source: 'usda' };
  }

  const guess = await estimate(item.item);
  return guess ? { per: guess, source: 'estimate' } : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** STEP 3 — scale per-100g values to the grams Claude worked out. */
function scale(item: ParsedFoodItem, per: Per100g, source: MacroSource): MealItem {
  const f = item.quantity_grams / 100;
  return {
    id: crypto.randomUUID(),
    name: item.item,
    quantity_display: quantityDisplay(item),
    quantity_grams: item.quantity_grams,
    calories: Math.round(per.calories * f),
    protein_g: round1(per.protein_g * f),
    carbs_g: round1(per.carbs_g * f),
    fat_g: round1(per.fat_g * f),
    source,
    matched_name:
      per.matched_name && per.matched_name.toLowerCase() !== item.item.toLowerCase()
        ? per.matched_name
        : null,
  };
}

/**
 * The whole pipeline. `onStage` fires as each phase begins so the loading card
 * can narrate. Every item resolves concurrently — one slow lookup costs the
 * meal one lookup's worth of time, not N.
 */
export async function analyzeMeal(
  description: string,
  onStage?: (stage: AnalyzeStage) => void
): Promise<MealItem[]> {
  onStage?.('identifying');
  const parsed = await parseMeal(description);

  onStage?.('looking-up');
  const resolved = await Promise.all(parsed.map((item) => resolve(item)));

  onStage?.('calculating');
  const items = parsed
    .map((item, i) => {
      const hit = resolved[i];
      return hit ? scale(item, hit.per, hit.source) : null;
    })
    .filter((it): it is MealItem => it !== null);

  if (items.length === 0) {
    throw new MealLookupError('No item could be resolved against any source.');
  }
  return items;
}

/** Sum a breakdown — used for the TOTAL row and after every inline edit. */
export function totalOf(items: MealItem[]): Macros {
  return items.reduce<Macros>(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      protein_g: acc.protein_g + it.protein_g,
      carbs_g: acc.carbs_g + it.carbs_g,
      fat_g: acc.fat_g + it.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}
