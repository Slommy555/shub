// Nutrition label scanning.
//
// The photo never leaves the browser except as one base64 block inside a single
// Claude Messages call, routed through the `anthropic-proxy` Edge Function (the
// API key stays server-side). Nothing is uploaded to Storage — once the macros
// come back the image is dropped.

import { supabase } from './supabase';
import type { ScanResult } from '../types/nutrition';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1000;

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

function buildPrompt(amountEaten: string): string {
  const amount = amountEaten.trim() || 'one serving as listed on the label';
  return [
    'This is a photo of a nutrition label.',
    `The person ate: ${amount}.`,
    '',
    'Read the nutrition label and calculate the macros for the amount they ate.',
    'Account for the serving size on the label vs how much they actually ate.',
    '',
    'For example: if the label says 200 calories per 100g and they ate 150g, the',
    'answer is 300 calories.',
    '',
    'Return ONLY a JSON object with no other text:',
    '{',
    '  "food_name": string (your best guess at what this food is from the label,',
    "    or 'Unknown Food'),",
    '  "calories": number,',
    '  "protein_g": number,',
    '  "carbs_g": number,',
    '  "fat_g": number,',
    '  "confidence": "high" | "medium" | "low",',
    '  "note": string or null (any caveat, e.g. "Label was partially obscured", or null)',
    '}',
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

/**
 * Send the label photo to Claude and get back macros for what was eaten.
 * Throws when the reply isn't usable — the caller shows the error state.
 */
export async function scanLabel(image: PreparedImage, amountEaten: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('anthropic-proxy', {
    body: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.data },
            },
            { type: 'text', text: buildPrompt(amountEaten) },
          ],
        },
      ],
    },
  });
  if (error) throw new Error(`Scan request failed: ${error.message}`);

  const text = (data as { content?: { text?: string }[] })?.content?.[0]?.text ?? '';
  const obj = extractJsonObject(text);
  const confidence = obj.confidence;
  const note = obj.note;
  return {
    food_name: typeof obj.food_name === 'string' && obj.food_name.trim() ? obj.food_name.trim() : 'Unknown Food',
    calories: num(obj.calories),
    protein_g: num(obj.protein_g),
    carbs_g: num(obj.carbs_g),
    fat_g: num(obj.fat_g),
    confidence: confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'medium',
    note: typeof note === 'string' && note.trim() ? note.trim() : null,
  };
}
