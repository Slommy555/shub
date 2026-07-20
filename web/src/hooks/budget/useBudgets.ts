import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Budget } from '../../types/budget';

const byPosition = (a: Budget, b: Budget) => a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? '');

/**
 * Loads the user's budgets (each fully independent) and keeps them synced via
 * realtime. If a user has none, a default "My Budget" is auto-created so the tab
 * always has an active budget. Exposes create / rename / delete / reorder.
 */
export function useBudgets(userId: string | null) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<Budget[]>([]);
  ref.current = budgets;
  const creatingDefault = useRef(false);

  useEffect(() => {
    if (!userId) {
      setBudgets([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('load budgets failed:', error.message);
        setLoading(false);
        return;
      }
      const rows = (data as Budget[]).sort(byPosition);
      // First-time user with no budget: seed a default so there's always one.
      if (rows.length === 0 && !creatingDefault.current) {
        creatingDefault.current = true;
        const { data: created, error: cErr } = await supabase
          .from('budgets')
          .insert({ user_id: userId, name: 'My Budget', position: 0 })
          .select()
          .single();
        creatingDefault.current = false;
        if (cancelled) return;
        if (cErr) {
          console.error('create default budget failed:', cErr.message);
          setBudgets([]);
        } else if (created) {
          setBudgets([created as Budget]);
        }
        setLoading(false);
        return;
      }
      setBudgets(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budgets-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setBudgets((prev) => prev.filter((b) => b.id !== id));
          } else {
            const row = payload.new as Budget;
            setBudgets((prev) => {
              const exists = prev.some((b) => b.id === row.id);
              const next = exists ? prev.map((b) => (b.id === row.id ? row : b)) : [...prev, row];
              return next.sort(byPosition);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /** Create a new budget and return it (so the caller can switch to it). */
  const createBudget = useCallback(
    async (name: string): Promise<Budget | null> => {
      if (!userId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const position = ref.current.length;
      const { data, error } = await supabase
        .from('budgets')
        .insert({ user_id: userId, name: trimmed, position })
        .select()
        .single();
      if (error) {
        console.error('createBudget failed:', error.message);
        return null;
      }
      const row = data as Budget;
      setBudgets((prev) => [...prev, row].sort(byPosition));
      return row;
    },
    [userId]
  );

  const renameBudget = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, name: trimmed } : b)));
    const { error } = await supabase.from('budgets').update({ name: trimmed }).eq('id', id);
    if (error) console.error('renameBudget failed:', error.message);
  }, []);

  /** Delete a budget (cascades to its periods, groups, allocations, savings).
   *  Refuses to delete the last remaining budget. */
  const deleteBudget = useCallback(async (id: string): Promise<boolean> => {
    if (ref.current.length <= 1) return false;
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) {
      console.error('deleteBudget failed:', error.message);
      return false;
    }
    return true;
  }, []);

  return { budgets, loading, createBudget, renameBudget, deleteBudget };
}

export type UseBudgets = ReturnType<typeof useBudgets>;
