// Nutrition label scanning.
//
// The photo never leaves the browser except as one base64 block inside a single
// Claude Messages call, routed through the `anthropic-proxy` Edge Function (the
// API key stays server-side). Nothing is uploaded to Storage — once the macros
// come back the image is dropped.

import { supabase } from './supabase';
import type { Macros, ScanItem, ScanResult } from '../types/nutrition';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;

/** Ceiling on labels per scan — keeps the request payload and cost sane. */
export const MAX_IMAGES = 6;

/** Above this we re-encode; below it the original bytes go straight through. */
const MAX_BYTES = 1_000_000;
/** Longest side after resizing. */
const MAX_EDGE = 1200;
const JPEG_QUALITY = 0.85;

/** Media types the Anthropic API accepts for image blocks. */
const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export interface PreparedImage {
  /** Raw base64 (no data: prefix) — what the API's image block wants. */
  data: string;
  mediaType: string;
  /** An object URL for the preview; the caller revokes it. */
  previewUrl: string;
}

function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be decoded as an image.'));
    img.src = src;
  });
}

/**
 * Resize to `MAX_EDGE` on the longest side and re-encode as JPEG. Used when the
 * file is over 1MB (keeps the API call fast) or in a format Anthropic doesn't
 * take (HEIC, BMP, …) — canvas re-encoding normalises both cases at once.
 */
async function compress(file: File): Promise<{ data: string; mediaType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      data: stripDataUrl(canvas.toDataURL('image/jpeg', JPEG_QUALITY)),
      mediaType: 'image/jpeg',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Turn the picked file into an API-ready image block plus a preview URL.
 * `onSlow` fires if the work is still going after 500ms, so the UI can show a
 * "Preparing image…" toast only when it would actually be noticed.
 */
export async function prepareImage(file: File, onSlow?: () => void): Promise<PreparedImage> {
  const timer = onSlow ? window.setTimeout(onSlow, 500) : undefined;
  try {
    const needsReencode =
      file.size > MAX_BYTES || !SUPPORTED.includes(file.type as (typeof SUPPORTED)[number]);
    const { data, mediaType } = needsReencode
      ? await compress(file)
      : { data: stripDataUrl(await fileToDataUrl(file)), mediaType: file.type };
    return { data, mediaType, previewUrl: URL.createObjectURL(file) };
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

function buildPrompt(count: number, mealPrep: boolean): string {
  return [
    ...(mealPrep
      ? [
          `The ${count} photos above are the nutrition labels of the ingredients in ONE`,
          'batch of a meal-prepped recipe. Above each label is the amount of that',
          'ingredient that went into the WHOLE batch.',
          '',
          'For EACH ingredient, work out the macros for the amount that went into the batch:',
        ]
      : [
          count === 1
            ? 'The photo above is a nutrition label, with the amount that person ate stated above it.'
            : `The ${count} photos above are nutrition labels. Above each one is the amount that person ate of THAT item.`,
          '',
          'For EACH label, work out the macros for the amount stated for that label:',
        ]),
    '',
    '1. Read the serving size, the per-serving macros, and the servings per',
    '   container if the label shows one.',
    '2. If the amount is a plain quantity ("100g", "2 slices", "1 cup"), scale from',
    '   the label\'s serving size. Example: the label says 200 calories per 100g and',
    '   they ate 150g, so the answer is 300 calories.',
    '3. If the amount is a FRACTION OF THE WHOLE product, package, container or bag',
    '   ("1/5th of this", "half the bag", "a third of the box", "the whole thing"),',
    '   first work out the macros for the ENTIRE container — per-serving macros',
    '   multiplied by the servings per container — and then apply the fraction to',
    '   that. Example: 200 calories per serving, 5 servings per container, and they',
    '   ate "1/5th of this", so the whole container is 1000 calories and their share',
    '   is 200 calories. Do NOT apply the fraction to a single serving.',
    '   If the label gives no servings per container, say so in "note" and fall back',
    '   to treating the fraction as a fraction of one serving.',
    `4. If no amount was stated for ${mealPrep ? 'an ingredient' : 'a label'}, assume exactly one serving as listed.`,
    '',
    ...(mealPrep
      ? [
          'Do NOT divide anything by the number of portions the batch makes — the batch',
          'is split up separately. Every number you return is for the WHOLE batch.',
          '',
        ]
      : []),
    'Return ONLY a JSON object with no other text:',
    '{',
    '  "items": [',
    '    {',
    '      "food_name": string (your best guess at what this food is, or "Unknown Food"),',
    '      "calories": number,',
    '      "protein_g": number,',
    '      "carbs_g": number,',
    '      "fat_g": number',
    '    }',
    `    // exactly ${count} object${count === 1 ? '' : 's'}, in the same order as the photos`,
    '  ],',
    mealPrep
      ? '  "food_name": string (a short name for the finished dish, e.g. "Chicken & rice bowl"),'
      : count === 1
        ? '  "food_name": string (a short name for the food),'
        : '  "food_name": string (a short name for the combined meal, e.g. "Chicken & rice bowl"),',
    '  "confidence": "high" | "medium" | "low",',
    '  "note": string or null (any caveat, e.g. "Label was partially obscured", or null)',
    '}',
    '',
    mealPrep
      ? 'Every number in "items" is that ingredient\'s contribution to the WHOLE batch —'
      : 'Every number in "items" is what the person ACTUALLY ate for that label — already',
    mealPrep
      ? 'already scaled. Do not return a combined total; the totals are added up separately.'
      : 'scaled. Do not return a combined total; the totals are added up separately.',
  ].join('\n');
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Pull the first balanced {...} out of the reply, tolerating fences/preamble. */
function extractJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
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
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      return JSON.parse(raw.slice(start, i + 1)) as Record<string, unknown>;
    }
  }
  throw new Error('Truncated JSON in response.');
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/** One label the user picked, paired with what they said they ate of it. */
export interface ScanInput {
  image: PreparedImage;
  amount: string;
}

/**
 * Send every label photo to Claude in one call and get back the macros for what
 * was eaten. Claude scales each label to its own stated amount; the per-label
 * numbers are then summed here rather than by the model, so the total is exact
 * arithmetic over whatever it read.
 *
 * In `mealPrep` mode the amounts describe what went into a whole batch, so the
 * returned total is the batch total — the caller divides it by the portions.
 *
 * Throws when the reply isn't usable — the caller shows the error state.
 */
export async function scanLabels(
  inputs: ScanInput[],
  opts: { mealPrep?: boolean } = {}
): Promise<ScanResult> {
  if (inputs.length === 0) throw new Error('No images to scan.');
  const mealPrep = opts.mealPrep === true;

  // Each image is introduced by its own amount, so the model can never mis-pair
  // an amount with the wrong label.
  const content = inputs.flatMap((input, i) => [
    {
      type: 'text',
      text: mealPrep
        ? `Ingredient ${i + 1} of ${inputs.length}. The batch uses: ` +
          `${input.amount.trim() || 'one serving as listed on the label'}.`
        : `Label ${i + 1} of ${inputs.length}. The person ate: ` +
          `${input.amount.trim() || 'one serving as listed on the label'}.`,
    },
    {
      type: 'image',
      source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data },
    },
  ]);
  content.push({ type: 'text', text: buildPrompt(inputs.length, mealPrep) });

  const { data, error } = await supabase.functions.invoke('anthropic-proxy', {
    body: { model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content }] },
  });
  if (error) throw new Error(`Scan request failed: ${error.message}`);

  const text = (data as { content?: { text?: string }[] })?.content?.[0]?.text ?? '';
  const obj = extractJsonObject(text);

  // Prefer the per-label breakdown. A model that ignored the schema and returned
  // flat macros still gives us a usable single item.
  const raw = Array.isArray(obj.items) && obj.items.length ? (obj.items as Record<string, unknown>[]) : [obj];
  const items: ScanItem[] = raw.map((it, i) => ({
    food_name: str(it.food_name, 'Unknown Food'),
    amount: inputs[i]?.amount.trim() ?? '',
    calories: num(it.calories),
    protein_g: num(it.protein_g),
    carbs_g: num(it.carbs_g),
    fat_g: num(it.fat_g),
  }));

  const total = items.reduce<Macros>(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      protein_g: acc.protein_g + it.protein_g,
      carbs_g: acc.carbs_g + it.carbs_g,
      fat_g: acc.fat_g + it.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const confidence = obj.confidence;
  return {
    ...total,
    items,
    food_name: str(obj.food_name, items.length === 1 ? items[0].food_name : 'Meal'),
    confidence:
      confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'medium',
    note: str(obj.note, '') || null,
  };
}
