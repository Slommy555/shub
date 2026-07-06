import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uuid } from '../lib/id';
import type { Category, Priority, Recurrence, Subtask, Task } from '../lib/types';

export interface NewTaskInput {
  text: string;
  category: Category;
  priority: Priority;
  due_date: string | null;
  scheduled_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  recurrence?: Recurrence | null;
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

const normTime = (t: string | null | undefined): string | null =>
  typeof t === 'string' && t ? t.slice(0, 5) : null;

function normalizeRow(row: Omit<Task, 'subtasks'>): Omit<Task, 'subtasks'> {
  return { ...row, start_time: normTime(row.start_time), end_time: normTime(row.end_time) };
}

/**
 * Loads the signed-in user's tasks + subtasks, keeps them in sync via a
 * Supabase realtime subscription, and exposes optimistic CRUD. Mirrors the web
 * app's useTasks so both clients behave identically.
 */
export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;

  // Unique per hook instance so mounting this hook on multiple screens (e.g.
  // Tasks + Schedule tabs at once) doesn't collide on a shared channel name —
  // Supabase reuses a channel by name and rejects new bindings after subscribe.
  const channelIdRef = useRef(Math.random().toString(36).slice(2));

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

  // --- load ---------------------------------------------------------------
  const load = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const { data: taskRows, error } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true });
    if (error) {
      console.error('Failed to load tasks:', error.message);
      setLoading(false);
      return;
    }
    const ids = (taskRows ?? []).map((t) => t.id);
    let subRows: Subtask[] = [];
    if (ids.length) {
      const { data: subs } = await supabase
        .from('subtasks')
        .select('*')
        .in('task_id', ids)
        .order('position', { ascending: true });
      subRows = subs ?? [];
    }
    const merged: Task[] = (taskRows ?? []).map((t) => ({
      ...normalizeRow(t as Omit<Task, 'subtasks'>),
      subtasks: subRows.filter((s) => s.task_id === t.id).sort(byPosition),
    }));
    setTasks(merged.sort(byPosition));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks-rt-${userId}-${channelIdRef.current}`)
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
  const addTask = useCallback(
    async (input: NewTaskInput) => {
      if (!userId) return;
      const id = uuid();
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
        subtasks: [],
      };
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
      await Promise.all(
        shifted.map((t) => supabase.from('tasks').update({ position: t.position }).eq('id', t.id))
      );
    },
    [userId]
  );

  const updateTask = useCallback(
    async (
      id: string,
      patch: Partial<Omit<Task, 'id' | 'user_id' | 'subtasks' | 'created_at'>>
    ) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error) console.error('updateTask failed:', error.message);
    },
    []
  );

  const toggleTask = useCallback(
    async (id: string) => {
      const current = tasksRef.current.find((t) => t.id === id);
      if (!current) return;
      await updateTask(id, { done: !current.done });
    },
    [updateTask]
  );

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) console.error('deleteTask failed:', error.message);
  }, []);

  const addSubtask = useCallback(
    async (taskId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const id = uuid();
      const parent = tasksRef.current.find((t) => t.id === taskId);
      const position = parent ? parent.subtasks.length : 0;
      upsertSubtaskRow({ id, task_id: taskId, text: trimmed, done: false, position });
      const { error } = await supabase
        .from('subtasks')
        .insert({ id, task_id: taskId, text: trimmed, position });
      if (error) console.error('addSubtask failed:', error.message);
    },
    [upsertSubtaskRow]
  );

  const toggleSubtask = useCallback(async (subtaskId: string) => {
    let nextDone = false;
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => {
          if (s.id !== subtaskId) return s;
          nextDone = !s.done;
          return { ...s, done: nextDone };
        }),
      }))
    );
    const { error } = await supabase.from('subtasks').update({ done: nextDone }).eq('id', subtaskId);
    if (error) console.error('toggleSubtask failed:', error.message);
  }, []);

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
    refetch: load,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  };
}

export type UseTasks = ReturnType<typeof useTasks>;
