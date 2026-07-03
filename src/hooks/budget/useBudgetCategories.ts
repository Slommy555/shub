import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BUDGET_COLORS,
  DEFAULT_BUDGET_CATEGORIES,
  type BudgetCategory,
  type TxType,
} from '../../types/budget';

const byPos = (a: BudgetCategory, b: BudgetCategory) =>
  a.position - b.position || (a.created_at < b.created_at ? -1 : 1);

/**
 * Loads the user's budget categories, keeps them synced via realtime, exposes
 * CRUD, and seeds the default set on first load for a brand-new user (seeds need
 * a user_id so they can't live in the SQL migration).
 */
export function useBudgetCategories(userId: string | null) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('budget_categories')
        .select('*')
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load budget categories:', error.message);
        setLoading(false);
        return;
      }
      if ((data ?? []).length === 0 && !seededRef.current) {
        seededRef.current = true;
        const rows = DEFAULT_BUDGET_CATEGORIES.map((c, i) => ({
          id: crypto.randomUUID(),
          user_id: userId,
          name: c.name,
          type: c.type,
          color: BUDGET_COLORS[i % BUDGET_COLORS.length],
          monthly_limit: null,
          position: i,
        }));
        const { error: seedErr } = await supabase.from('budget_categories').insert(rows);
        if (seedErr) console.error('Failed to seed budget categories:', seedErr.message);
        if (!cancelled) {
          setCategories(rows.map((r) => ({ ...r, created_at: new Date().toISOString() })));
        }
      } else {
        setCategories((data as BudgetCategory[]).sort(byPos));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget-cats-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_categories', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setCategories((prev) => prev.filter((c) => c.id !== id));
          } else {
            const row = payload.new as BudgetCategory;
            setCategories((prev) => {
              const exists = prev.some((c) => c.id === row.id);
              const next = exists ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row];
              return next.sort(byPos);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addCategory = useCallback(
    async (input: { name: string; type: TxType; color?: string; monthly_limit?: number | null }) => {
      if (!userId) return;
      const name = input.name.trim();
      if (!name) return;
      const id = crypto.randomUUID();
      const position = categories.filter((c) => c.type === input.type).length;
      const row: BudgetCategory = {
        id,
        user_id: userId,
        name,
        type: input.type,
        color: input.color ?? BUDGET_COLORS[categories.length % BUDGET_COLORS.length],
        monthly_limit: input.monthly_limit ?? null,
        position,
        created_at: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, row].sort(byPos));
      const { error } = await supabase.from('budget_categories').insert({
        id,
        user_id: userId,
        name,
        type: row.type,
        color: row.color,
        monthly_limit: row.monthly_limit,
        position,
      });
      if (error) console.error('addCategory failed:', error.message);
    },
    [userId, categories]
  );

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Pick<BudgetCategory, 'name' | 'color' | 'monthly_limit' | 'position' | 'type'>>) => {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort(byPos));
      const { error } = await supabase.from('budget_categories').update(patch).eq('id', id);
      if (error) console.error('updateCategory failed:', error.message);
    },
    []
  );

  const deleteCategory = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('budget_categories').delete().eq('id', id);
    if (error) console.error('deleteCategory failed:', error.message);
  }, []);

  const reorderCategories = useCallback(async (ordered: BudgetCategory[]) => {
    setCategories(ordered.map((c, i) => ({ ...c, position: i })));
    await Promise.all(
      ordered.map((c, i) =>
        supabase.from('budget_categories').update({ position: i }).eq('id', c.id)
      )
    );
  }, []);

  return { categories, loading, addCategory, updateCategory, deleteCategory, reorderCategories };
}

export type UseBudgetCategories = ReturnType<typeof useBudgetCategories>;
