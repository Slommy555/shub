// Shared Tiptap extension set, so the full editor and the read-only voice
// review preview render identical content. Headings limited to H1–H3;
// task lists add clickable checkboxes; Placeholder shows the empty hint.

import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import type { AnyExtension } from '@tiptap/react';

export function noteExtensions(placeholder = 'Start writing…'): AnyExtension[] {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
  ];
}
