// Converts Claude's plain-text / lightly-marked-up note body into Tiptap JSON.
// Intentionally simple: it handles headings (`# `, `## `, `### `), bullet lists
// (`- ` or `* `) and plain paragraphs. Anything else is treated as a paragraph.
// This is a best-effort structural pass, not a full Markdown parser.

import type { TiptapDoc, TiptapNode } from '../../types/notes';
import { EMPTY_DOC } from '../../types/notes';

function textNode(text: string): TiptapNode {
  return { type: 'text', text };
}

function paragraph(text: string): TiptapNode {
  return text ? { type: 'paragraph', content: [textNode(text)] } : { type: 'paragraph' };
}

function heading(level: number, text: string): TiptapNode {
  return { type: 'heading', attrs: { level }, content: [textNode(text)] };
}

function bulletItem(text: string): TiptapNode {
  return { type: 'listItem', content: [paragraph(text)] };
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

/**
 * Parse `text` into a Tiptap document. Consecutive bullet lines are merged into
 * a single bullet list; blank lines separate blocks. Returns an empty doc for
 * empty input.
 */
export function textToTiptap(text: string): TiptapDoc {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const content: TiptapNode[] = [];
  let bullets: TiptapNode[] | null = null;

  const flushBullets = () => {
    if (bullets && bullets.length) content.push({ type: 'bulletList', content: bullets });
    bullets = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      (bullets ??= []).push(bulletItem(bullet[1].trim()));
      continue;
    }
    flushBullets();
    if (!line) continue; // blank line — block separator
    const h = line.match(HEADING_RE);
    if (h) {
      content.push(heading(h[1].length, h[2].trim()));
    } else {
      content.push(paragraph(line));
    }
  }
  flushBullets();

  return content.length ? { type: 'doc', content } : EMPTY_DOC;
}

/** Flatten a Tiptap doc back to plain text (for the review-card preview fallback). */
export function tiptapToPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc?.content) return '';
  const walk = (node: TiptapNode): string => {
    if (node.type === 'text') return node.text ?? '';
    return (node.content ?? []).map(walk).join('');
  };
  return doc.content.map((n) => walk(n)).join('\n').trim();
}
