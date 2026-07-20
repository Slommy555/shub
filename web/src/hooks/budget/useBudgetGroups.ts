import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetGroup, GroupKind } from '../../types/budget';

interface GroupPatch {
  name?: string;
  color?: string;
  persistent?: boolean;
  amount?: number;
  kind?: GroupKind;
  cc_total?: number;
  cc_weeks?: number;
  cc_due_date?: string | null;
}

const byPosition = (a: BudgetGroup, b: BudgetGroup) => a.position - b.position;

/**
 * Loads the user's expense groups (shared across the weekly + monthly views),
 * keeps them synced via realtime, and exposes CRUD + drag-to-reorder. Deleting a
 * group cascades to its allocations via the foreign key.
 */
export function useBudgetGroups(userId: string | null, budgetId: string | null) {
  const [groups, setGroups] = useState<BudgetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const groupsRef = useRef<BudgetGroup[]>([]);
  groupsRef.current = groups;

  useEffect(() => {
    if (!userId || !budgetId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('budget_groups')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('load groups failed:', error.message);
        setLoading(false);
        return;
      }
      setGroups((data as BudgetGroup[]).sort(byPosition));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, budgetId]);

  // Realtime
  useEffect(() => {
    if (!userId || !budgetId) return;
    const channel = supabase
      .channel(`budget_groups-rt-${userId}-${budgetId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_groups', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setGroups((prev) => prev.filter((g) => g.id !== id));
          } else {
            const row = payload.new as BudgetGroup;
            if (row.budget_id !== budgetId) return; // ignore other budgets' groups
            setGroups((prev) => {
              const exists = prev.some((g) => g.id === row.id);
              const next = exists ? prev.map((g) => (g.id === row.id ? row : g)) : [...prev, row];
              return next.sort(byPosition);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId]);

  const addGroup = useCallback(
    async (name: string, color: string, kind: GroupKind = 'standard') => {
      if (!userId || !budgetId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = crypto.randomUUID();
      const position = groupsRef.current.length;
      // New items default to per-week (non-persistent) so nothing auto-persists
      // across months; the user opts specific items (e.g. Rent) into persistent.
      const row: BudgetGroup = {
        id,
        user_id: userId,
        budget_id: budgetId,
        name: trimmed,
        color,
        position,
        persistent: false,
        amount: 0,
        kind,
        cc_total: 0,
        cc_weeks: 0,
        cc_due_date: null,
        created_at: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, row].sort(byPosition));
      const { error } = await supabase
        .from('budget_groups')
        .insert({ id, user_id: userId, budget_id: budgetId, name: trimmed, color, position, persistent: false, amount: 0, kind });
      if (error) console.error('addGroup failed:', error.message);
    },
    [userId, budgetId]
  );

  const updateGroup = useCallback(
    async (id: string, patch: GroupPatch) => {
      const name = patch.name?.trim();
      setGroups((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                ...(name ? { name } : {}),
                ...(patch.color ? { color: patch.color } : {}),
                ...(patch.persistent !== undefined ? { persistent: patch.persistent } : {}),
                ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
                ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
                ...(patch.cc_total !== undefined ? { cc_total: patch.cc_total } : {}),
                ...(patch.cc_weeks !== undefined ? { cc_weeks: patch.cc_weeks } : {}),
                ...(patch.cc_due_date !== undefined ? { cc_due_date: patch.cc_due_date } : {}),
              }
            : g
        )
      );
      const dbPatch: GroupPatch = {};
      if (name) dbPatch.name = name;
      if (patch.color) dbPatch.color = patch.color;
      if (patch.persistent !== undefined) dbPatch.persistent = patch.persistent;
      if (patch.amount !== undefined) dbPatch.amount = patch.amount;
      if (patch.kind !== undefined) dbPatch.kind = patch.kind;
      if (patch.cc_total !== undefined) dbPatch.cc_total = patch.cc_total;
      if (patch.cc_weeks !== undefined) dbPatch.cc_weeks = patch.cc_weeks;
      if (patch.cc_due_date !== undefined) dbPatch.cc_due_date = patch.cc_due_date;
      if (Object.keys(dbPatch).length === 0) return;
      const { error } = await supabase.from('budget_groups').update(dbPatch).eq('id', id);
      if (error) console.error('updateGroup failed:', error.message);
    },
    []
  );

  const deleteGroup = useCallback(async (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    // Cascades to budget_allocations via the foreign key.
    const { error } = await supabase.from('budget_groups').delete().eq('id', id);
    if (error) console.error('deleteGroup failed:', error.message);
  }, []);

  /** Persist a new ordering (array of group ids, top to bottom). */
  const reorder = useCallback(async (orderedIds: string[]) => {
    setGroups((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      const next: BudgetGroup[] = [];
      orderedIds.forEach((id, i) => {
        const g = map.get(id);
        if (g) next.push({ ...g, position: i });
      });
      return next;
    });
    const results = await Promise.all(
      orderedIds.map((id, i) => supabase.from('budget_groups').update({ position: i }).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) console.error('reorder failed:', failed.error.message);
  }, []);

  return { groups, loading, addGroup, updateGroup, deleteGroup, reorder };
}

export type UseBudgetGroups = ReturnType<typeof useBudgetGroups>;
