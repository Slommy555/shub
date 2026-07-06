// Connector / minor words that stay lowercase in title case (unless first/last).
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'nor', 'of', 'on', 'onto', 'or', 'over', 'per', 'the', 'to', 'via', 'vs',
  'with', 'yet',
]);

function capitalizeFirst(word: string): string {
  // Uppercase the first letter only; leave the rest as typed so acronyms
  // like "API" or "PR" aren't mangled.
  return word.replace(/[a-zA-Z]/, (c) => c.toUpperCase());
}

/**
 * Title-case a task string: capitalize each word except connectors, but always
 * capitalize the first and last word. Whitespace is preserved.
 */
export function titleCase(text: string): string {
  const tokens = text.split(/(\s+)/);
  const wordIdx = tokens
    .map((t, i) => (/\S/.test(t) ? i : -1))
    .filter((i) => i !== -1);
  if (wordIdx.length === 0) return text;
  const first = wordIdx[0];
  const last = wordIdx[wordIdx.length - 1];

  return tokens
    .map((tok, i) => {
      if (!/\S/.test(tok)) return tok;
      const key = tok.toLowerCase().replace(/[^a-z]/g, '');
      if (i !== first && i !== last && MINOR_WORDS.has(key)) {
        return tok.toLowerCase();
      }
      return capitalizeFirst(tok);
    })
    .join('');
}
