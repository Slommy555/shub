import { useCallback, useEffect, useState } from 'react';
import type { Category, Priority, Recurrence, Task } from '../types';

const STORAGE_KEY = 'taskClipboard';
/** Fired in this tab when the clipboard changes (the `storage` event is only
 *  delivered to *other* tabs, so we need our own signal too). */
const EVENT = 'taskclipboardchange';

/** A task snapshot on the app clipboard — everything needed to re-create it. */
export interface ClipboardTask {
  text: string;
  notes: string | null;
  category: Category;
  priority: Priority;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: Recurrence | null;
  subtasks: string[];
  /** 'cut' removes the source task on the first paste; 'copy' keeps it. */
  mode: 'copy' | 'cut';
  /** Source task id — only used to delete it after a cut. */
  sourceId: string;
}

function snapshot(task: Task, mode: 'copy' | 'cut'): ClipboardTask {
  return {
    text: task.text,
    notes: task.notes,
    category: task.category,
    priority: task.priority,
    due_date: task.due_date,
    start_time: task.start_time,
    end_time: task.end_time,
    recurrence: task.recurrence,
    subtasks: task.subtasks.map((s) => s.text),
    mode,
    sourceId: task.id,
  };
}

function read(): ClipboardTask | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ClipboardTask) : null;
  } catch {
    return null;
  }
}

function write(value: ClipboardTask | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** What `paste` hands back to the caller so it can create the task. */
export interface PasteResult {
  text: string;
  notes: string | null;
  category: Category;
  priority: Priority;
  due_date: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: Recurrence | null;
  subtasks: string[];
}

/**
 * A tiny in-app clipboard for tasks, backed by localStorage so a copy survives
 * tab switches, reloads and works across the app's own browser tabs. The hook
 * only owns the payload — creating/deleting rows is left to the caller (which
 * already owns the task API).
 */
export function useTaskClipboard() {
  const [entry, setEntry] = useState<ClipboardTask | null>(() => read());

  useEffect(() => {
    const sync = () => setEntry(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const copy = useCallback((task: Task) => write(snapshot(task, 'copy')), []);
  const cut = useCallback((task: Task) => write(snapshot(task, 'cut')), []);
  const clear = useCallback(() => write(null), []);

  /**
   * Produce the input for a new task pasted onto `day` (null = unscheduled).
   * Returns the source id to delete when the entry was cut, so the caller can
   * finish the move. After a cut+paste the clipboard falls back to copy mode,
   * so pasting again duplicates instead of deleting a task that's already gone.
   */
  const paste = useCallback(
    (day: string | null): { input: PasteResult; removeId: string | null } | null => {
      const e = read();
      if (!e) return null;
      const input: PasteResult = {
        text: e.text,
        notes: e.notes,
        category: e.category,
        priority: e.priority,
        // A pasted copy keeps its deadline only when it still makes sense — an
        // explicit target day wins over the original hard due date.
        due_date: day ? null : e.due_date,
        scheduled_date: day,
        start_time: e.start_time,
        end_time: e.end_time,
        recurrence: e.recurrence,
        subtasks: e.subtasks,
      };
      const removeId = e.mode === 'cut' ? e.sourceId : null;
      if (removeId) write({ ...e, mode: 'copy' });
      return { input, removeId };
    },
    []
  );

  return { entry, hasCopy: entry !== null, copy, cut, paste, clear };
}

export type UseTaskClipboard = ReturnType<typeof useTaskClipboard>;
