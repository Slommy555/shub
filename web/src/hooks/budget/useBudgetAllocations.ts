import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetAllocation } from '../../types/budget';

type AllocMap = Record<string, BudgetAllocation>; // keyed by group_id

/**
 * Loads the allocations (budgeted + spent per group) for one period, keyed by
 * group_id, and keeps them synced via realtime. Writes are optimistic and go
 * through an upsert on (period_id, group_id) so re-editing the same group just
 * updates its row. Rows are auto-created (0/0) on demand.
 */
export function useBudgetAllocations(userId: string | null, periodId: string | null) {
  const [allocations, setAllocations] = useState<AllocMap>({});
  const [loading, setLoading] = useState(true);
  const ref = useRef<AllocMap>({});
  ref.current = allocations;

  useEffect(() => {
    if (!userId || !periodId) {
      setAllocations({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('budget_allocations')
        .select('*')
        .eq('period_id', periodId);
      if (cancelled) return;
      if (error) {
        console.error('load allocations failed:', error.message);
        setLoading(false);
        return;
      }
      const map: AllocMap = {};
      for (const row of (data as BudgetAllocation[]) ?? []) map[row.group_id] = row;
      setAllocations(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, periodId]);

  // Realtime — only apply changes belonging to the period currently shown.
  useEffect(() => {
    if (!userId || !periodId) return;
    const channel = supabase
      .channel(`budget_allocations-rt-${userId}-${periodId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_allocations', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as BudgetAllocation;
            setAllocations((prev) => {
              const next = { ...prev };
              if (next[old.group_id]?.id === old.id) delete next[old.group_id];
              return next;
            });
            return;
          }
          const row = payload.new as BudgetAllocation;
          if (row.period_id !== periodId) return;
          setAllocations((prev) => ({ ...prev, [row.group_id]: row }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, periodId]);

  /** Ensure a 0/0 allocation exists for a group (called when a card is opened). */
  const ensureAllocation = useCallback(
    async (groupId: string) => {
      if (!userId || !periodId || ref.current[groupId]) return;
      const optimistic: BudgetAllocation = {
        id: crypto.randomUUID(),
        user_id: userId,
        period_id: periodId,
        group_id: groupId,
        budgeted: 0,
        spent: 0,
      };
      setAllocations((prev) => (prev[groupId] ? prev : { ...prev, [groupId]: optimistic }));
      const { data, error } = await supabase
        .from('budget_allocations')
        .upsert(
          { user_id: userId, period_id: periodId, group_id: groupId, budgeted: 0, spent: 0 },
          { onConflict: 'period_id,group_id' }
        )
        .select()
        .single();
      if (error) {
        console.error('ensureAllocation failed:', error.message);
        return;
      }
      if (data) setAllocations((prev) => ({ ...prev, [groupId]: data as BudgetAllocation }));
    },
    [userId, periodId]
  );

  const setField = useCallback(
    async (groupId: string, field: 'budgeted' | 'spent', value: number) => {
      if (!userId || !periodId) return;
      const existing = ref.current[groupId];
      const budgeted = field === 'budgeted' ? value : existing?.budgeted ?? 0;
      const spent = field === 'spent' ? value : existing?.spent ?? 0;

      setAllocations((prev) => {
        const base =
          prev[groupId] ??
          ({ id: crypto.randomUUID(), user_id: userId, period_id: periodId, group_id: groupId, budgeted: 0, spent: 0 } as BudgetAllocation);
        return { ...prev, [groupId]: { ...base, budgeted, spent } };
      });

      const { data, error } = await supabase
        .from('budget_allocations')
        .upsert({ user_id: userId, period_id: periodId, group_id: groupId, budgeted, spent }, { onConflict: 'period_id,group_id' })
        .select()
        .single();
      if (error) {
        console.error('setField failed:', error.message);
        return;
      }
      if (data) setAllocations((prev) => ({ ...prev, [groupId]: data as BudgetAllocation }));
    },
    [userId, periodId]
  );

  return { allocations, loading, ensureAllocation, setField };
}

export type UseBudgetAllocations = ReturnType<typeof useBudgetAllocations>;
