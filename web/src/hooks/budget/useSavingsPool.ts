import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { SavingsEarmark, SavingsPool } from '../../types/budget';

type EarmarkMap = Record<string, SavingsEarmark>; // keyed by group_id

/**
 * The savings pool for one (budget, period): a `total_saved` amount plus a set
 * of earmarks (how much of the pool is set aside toward each expense group). The
 * pool row is created lazily on first write. Writes are optimistic; both the
 * pool and its earmarks stay synced via realtime.
 */
export function useSavingsPool(
  userId: string | null,
  budgetId: string | null,
  periodId: string | null
) {
  const [pool, setPool] = useState<SavingsPool | null>(null);
  const [earmarks, setEarmarks] = useState<EarmarkMap>({});
  const poolRef = useRef<SavingsPool | null>(null);
  poolRef.current = pool;
  const earmarksRef = useRef<EarmarkMap>({});
  earmarksRef.current = earmarks;

  // Load pool + earmarks for the current (budget, period).
  useEffect(() => {
    if (!userId || !budgetId || !periodId) {
      setPool(null);
      setEarmarks({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: poolRow, error } = await supabase
        .from('budget_savings_pools')
        .select('*')
        .eq('budget_id', budgetId)
        .eq('period_id', periodId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('load savings pool failed:', error.message);
        return;
      }
      if (!poolRow) {
        setPool(null);
        setEarmarks({});
        return;
      }
      setPool(poolRow as SavingsPool);
      const { data: marks, error: mErr } = await supabase
        .from('budget_savings_earmarks')
        .select('*')
        .eq('pool_id', (poolRow as SavingsPool).id);
      if (cancelled) return;
      if (mErr) {
        console.error('load earmarks failed:', mErr.message);
        return;
      }
      const map: EarmarkMap = {};
      for (const row of (marks as SavingsEarmark[]) ?? []) map[row.group_id] = row;
      setEarmarks(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, budgetId, periodId]);

  // Realtime — keep pool total + earmarks in sync across devices.
  useEffect(() => {
    if (!userId || !budgetId || !periodId) return;
    const channel = supabase
      .channel(`savings-rt-${userId}-${periodId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_savings_pools', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as SavingsPool;
          if (row.budget_id === budgetId && row.period_id === periodId) setPool(row);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_savings_earmarks', filter: `user_id=eq.${userId}` },
        (payload) => {
          const current = poolRef.current;
          if (payload.eventType === 'DELETE') {
            const old = payload.old as SavingsEarmark;
            setEarmarks((prev) => {
              const next = { ...prev };
              if (next[old.group_id]?.id === old.id) delete next[old.group_id];
              return next;
            });
            return;
          }
          const row = payload.new as SavingsEarmark;
          if (!current || row.pool_id !== current.id) return;
          setEarmarks((prev) => ({ ...prev, [row.group_id]: row }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId, periodId]);

  /** Ensure a pool row exists for this (budget, period); returns its id. */
  const ensurePool = useCallback(async (): Promise<SavingsPool | null> => {
    if (!userId || !budgetId || !periodId) return null;
    if (poolRef.current) return poolRef.current;
    const { data, error } = await supabase
      .from('budget_savings_pools')
      .upsert(
        { user_id: userId, budget_id: budgetId, period_id: periodId, total_saved: 0 },
        { onConflict: 'budget_id,period_id' }
      )
      .select()
      .single();
    if (error) {
      console.error('ensurePool failed:', error.message);
      return null;
    }
    setPool(data as SavingsPool);
    return data as SavingsPool;
  }, [userId, budgetId, periodId]);

  const setTotal = useCallback(
    async (total: number) => {
      if (!userId || !budgetId || !periodId) return;
      const value = Math.max(0, total);
      setPool((prev) => (prev ? { ...prev, total_saved: value } : prev));
      const { data, error } = await supabase
        .from('budget_savings_pools')
        .upsert(
          { user_id: userId, budget_id: budgetId, period_id: periodId, total_saved: value },
          { onConflict: 'budget_id,period_id' }
        )
        .select()
        .single();
      if (error) {
        console.error('setTotal failed:', error.message);
        return;
      }
      if (data) setPool(data as SavingsPool);
    },
    [userId, budgetId, periodId]
  );

  const setEarmark = useCallback(
    async (groupId: string, amount: number) => {
      if (!userId) return;
      const p = poolRef.current ?? (await ensurePool());
      if (!p) return;
      const value = Math.max(0, amount);
      setEarmarks((prev) => {
        const base =
          prev[groupId] ??
          ({ id: crypto.randomUUID(), user_id: userId, pool_id: p.id, group_id: groupId, amount: 0 } as SavingsEarmark);
        return { ...prev, [groupId]: { ...base, amount: value } };
      });
      const { data, error } = await supabase
        .from('budget_savings_earmarks')
        .upsert({ user_id: userId, pool_id: p.id, group_id: groupId, amount: value }, { onConflict: 'pool_id,group_id' })
        .select()
        .single();
      if (error) {
        console.error('setEarmark failed:', error.message);
        return;
      }
      if (data) setEarmarks((prev) => ({ ...prev, [groupId]: data as SavingsEarmark }));
    },
    [userId, ensurePool]
  );

  const totalSaved = pool?.total_saved ?? 0;
  const earmarkAmounts: Record<string, number> = {};
  for (const [groupId, row] of Object.entries(earmarks)) earmarkAmounts[groupId] = Number(row.amount) || 0;
  const allocated = Object.values(earmarkAmounts).reduce((a, n) => a + n, 0);

  return {
    totalSaved,
    earmarkAmounts,
    allocated,
    remaining: totalSaved - allocated,
    setTotal,
    setEarmark,
  };
}

export type UseSavingsPool = ReturnType<typeof useSavingsPool>;
