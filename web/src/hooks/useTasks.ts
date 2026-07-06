import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Category, Priority, Recurrence, Subtask, Task } from '../types';

interface NewTaskInput {
  text: string;
  category: Category;
  priority: Priority;
  due_date: string | null;
  scheduled_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  recurrence?: Recurrence | null;
  /** Optional subtask texts to create alongside the task (used by voice input). */
  subtasks?: string[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** Postgres `time` comes back as "HH:MM:SS"; the app works in "HH:MM". */
const normTime = (t: string | null | undefined): string | null =>
  typeof t === 'string' && t ? t.slice(0, 5) : null;

/** Coerce a raw task row from Supabase into our Task shape (time normalized). */
function normalizeRow(row: Omit<Task, 'subtasks'>): Omit<Task, 'subtasks'> {
  return { ...row, start_time: normTime(row.start_time), end_time: normTime(row.end_time) };
}

/**
 * Loads the signed-in user's tasks + subtasks, keeps them in sync via a
 * Supabase realtime subscription, and exposes optimistic CRUD + reorder
 * actions. Client-generated UUIDs keep optimistic rows and realtime events
 * reconciled by id (no duplicates, no temp-id swap).
 */
export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // A live mirror of `tasks` so background-sync helpers don't close over stale
  // state without forcing re-renders.
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;

  // --- helpers ------------------------------------------------------------

  const upsertTaskRow = useCallback((raw: Omit<Task, 'subtasks'>) => {
    const row = normalizeRow(raw);
    setTasks((prev) => {
      const existing = prev.find((t) => t.id === row.id);
      const merged: Task = { ...row, subtasks: existing?.subtasks ?? [] };
      const next = existing
        ? prev.map((t) => (t.id === row.id ? merged : t))
        : [...prev, merged];
      return next.sort(byPosition);
    });
  }, []);

  const removeTaskRow = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const upsertSubtaskRow = useCallback((row: Subtask) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== row.task_id) return t;
        const exists = t.subtasks.some((s) => s.id === row.id);
        const subtasks = exists
          ? t.subtasks.map((s) => (s.id === row.id ? row : s))
          : [...t.subtasks, row];
        return { ...t, subtasks: subtasks.sort(byPosition) };
      })
    );
  }, []);

  const removeSubtaskRow = useCallback((subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }))
    );
  }, []);

  // --- initial load -------------------------------------------------------

  useEffect(() => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: taskRows, error } = await supabase
        .from('tasks')
        .select('*')
        .order('position', { ascending: true });

      if (error) {
        console.error('Failed to load tasks:', error.message);
        if (!cancelled) setLoading(false);
        return;
      }

      const ids = (taskRows ?? []).map((t) => t.id);
      let subRows: Subtask[] = [];
      if (ids.length) {
        const { data: subs, error: subErr } = await supabase
          .from('subtasks')
          .select('*')
          .in('task_id', ids)
          .order('position', { ascending: true });
        if (subErr) console.error('Failed to load subtasks:', subErr.message);
        subRows = subs ?? [];
      }

      if (cancelled) return;

      const merged: Task[] = (taskRows ?? []).map((t) => ({
        ...normalizeRow(t as Omit<Task, 'subtasks'>),
        subtasks: subRows.filter((s) => s.task_id === t.id).sort(byPosition),
      }));

      setTasks(merged.sort(byPosition));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- realtime subscription ---------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`tasks-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            removeTaskRow((payload.old as { id: string }).id);
          } else {
            upsertTaskRow(payload.new as Omit<Task, 'subtasks'>);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subtasks' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            removeSubtaskRow((payload.old as { id: string }).id);
          } else {
            upsertSubtaskRow(payload.new as Subtask);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, upsertTaskRow, removeTaskRow, upsertSubtaskRow, removeSubtaskRow]);

  // --- mutations ----------------------------------------------------------

  /** Insert a new task at the top (position 0); shift existing tasks down. */
  const addTask = useCallback(
    async (input: NewTaskInput) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const subtaskTexts = (input.subtasks ?? []).map((s) => s.trim()).filter(Boolean);
      const subtasks: Subtask[] = subtaskTexts.map((text, i) => ({
        id: crypto.randomUUID(),
        task_id: id,
        text,
        done: false,
        position: i,
      }));
      const newTask: Task = {
        id,
        user_id: userId,
        text: input.text,
        notes: null,
        category: input.category,
        priority: input.priority,
        done: false,
        due_date: input.due_date,
        scheduled_date: input.scheduled_date ?? null,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        recurrence: input.recurrence ?? null,
        position: 0,
        created_at: new Date().toISOString(),
        subtasks,
      };

      // Optimistic: new task on top, everyone else shifts down by one.
      const shifted = tasksRef.current.map((t) => ({ ...t, position: t.position + 1 }));
      setTasks([newTask, ...shifted].sort(byPosition));

      const { error } = await supabase.from('tasks').insert({
        id,
        user_id: userId,
        text: newTask.text,
        category: newTask.category,
        priority: newTask.priority,
        due_date: newTask.due_date,
        scheduled_date: newTask.scheduled_date,
        start_time: newTask.start_time,
        end_time: newTask.end_time,
        recurrence: newTask.recurrence,
        position: 0,
      });
      if (error) {
        console.error('addTask failed:', error.message);
        return;
      }
      // Persist the shifted positions for the rows that moved.
      await Promise.all(
        shifted.map((t) =>
          supabase.from('tasks').update({ position: t.position }).eq('id', t.id)
        )
      );
      // Create any subtasks.
      if (subtasks.length) {
        const { error: subErr } = await supabase
          .from('subtasks')
          .insert(subtasks.map((s) => ({ id: s.id, task_id: id, text: s.text, position: s.position })));
        if (subErr) console.error('addTask subtasks failed:', subErr.message);
      }
    },
    [userId]
  );

  /** Insert several tasks at once (top of the list). Used by voice input. */
  const addTasks = useCallback(
    async (inputs: NewTaskInput[]) => {
      if (!userId || inputs.length === 0) return;

      const newTasks: Task[] = inputs.map((input, idx) => {
        const id = crypto.randomUUID();
        const subTexts = (input.subtasks ?? []).map((s) => s.trim()).filter(Boolean);
        const subtasks: Subtask[] = subTexts.map((text, i) => ({
          id: crypto.randomUUID(),
          task_id: id,
          text,
          done: false,
          position: i,
        }));
        return {
          id,
          user_id: userId,
          text: input.text,
          notes: null,
          category: input.category,
          priority: input.priority,
          done: false,
          due_date: input.due_date,
          scheduled_date: input.scheduled_date ?? null,
          start_time: input.start_time ?? null,
          end_time: input.end_time ?? null,
          recurrence: input.recurrence ?? null,
          position: idx,
          created_at: new Date().toISOString(),
          subtasks,
        };
      });
      const n = newTasks.length;
      const existing = tasksRef.current;

      // Optimistic: new tasks on top, everyone else shifts down by n.
      setTasks((prev) => {
        const shifted = prev.map((t) => ({ ...t, position: t.position + n }));
        return [...newTasks, ...shifted].sort(byPosition);
      });

      const { error } = await supabase.from('tasks').insert(
        newTasks.map((t) => ({
          id: t.id,
          user_id: userId,
          text: t.text,
          category: t.category,
          priority: t.priority,
          due_date: t.due_date,
          scheduled_date: t.scheduled_date,
          start_time: t.start_time,
          end_time: t.end_time,
          recurrence: t.recurrence,
          position: t.position,
        }))
      );
      if (error) {
        console.error('addTasks failed:', error.message);
        return;
      }
      await Promise.all(
        existing.map((t) =>
          supabase.from('tasks').update({ position: t.position + n }).eq('id', t.id)
        )
      );
      const allSubs = newTasks.flatMap((t) =>
        t.subtasks.map((s) => ({ id: s.id, task_id: t.id, text: s.text, position: s.position }))
      );
      if (allSubs.length) {
        const { error: subErr } = await supabase.from('subtasks').insert(allSubs);
        if (subErr) console.error('addTasks subtasks failed:', subErr.message);
      }
    },
    [userId]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Omit<Task, 'id' | 'user_id' | 'subtasks' | 'created_at'>>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error) console.error('updateTask failed:', error.message);
    },
    []
  );

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error('deleteTask failed:', error.message);
  }, []);

  /** Reorder the full task list (called on drag end). Renumbers 0..n-1. */
  const reorderTasks = useCallback(async (ordered: Task[]) => {
    const renumbered = ordered.map((t, i) => ({ ...t, position: i }));
    setTasks(renumbered);

    // Only write rows whose position actually changed.
    const prevById = new Map(tasksRef.current.map((t) => [t.id, t.position]));
    const changed = renumbered.filter((t) => prevById.get(t.id) !== t.position);
    await Promise.all(
      changed.map((t) =>
        supabase.from('tasks').update({ position: t.position }).eq('id', t.id)
      )
    );
  }, []);

  // --- subtask mutations --------------------------------------------------

  const addSubtask = useCallback(async (taskId: string, text: string) => {
    const id = crypto.randomUUID();
    const parent = tasksRef.current.find((t) => t.id === taskId);
    const position = parent ? parent.subtasks.length : 0;
    const sub: Subtask = { id, task_id: taskId, text, done: false, position };

    upsertSubtaskRow(sub);

    const { error } = await supabase
      .from('subtasks')
      .insert({ id, task_id: taskId, text, position });
    if (error) console.error('addSubtask failed:', error.message);
  }, [upsertSubtaskRow]);

  const updateSubtask = useCallback(
    async (subtaskId: string, patch: Partial<Pick<Subtask, 'text' | 'done'>>) => {
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s)),
        }))
      );
      const { error } = await supabase.from('subtasks').update(patch).eq('id', subtaskId);
      if (error) console.error('updateSubtask failed:', error.message);
    },
    []
  );

  const deleteSubtask = useCallback(
    async (subtaskId: string) => {
      removeSubtaskRow(subtaskId);
      const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId);
      if (error) console.error('deleteSubtask failed:', error.message);
    },
    [removeSubtaskRow]
  );

  return {
    tasks,
    loading,
    addTask,
    addTasks,
    updateTask,
    deleteTask,
    reorderTasks,
    addSubtask,
    updateSubtask,
    deleteSubtask,
  };
}

export type UseTasks = ReturnType<typeof useTasks>;
