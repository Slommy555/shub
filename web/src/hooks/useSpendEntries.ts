import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, todayISO } from '../lib/dates';
import { groupByDay, totalForDate, type SpendDay } from '../lib/spend';
import type { SpendEntry } from '../types/spend';

/** How much history the list shows up front, and how wide each "Load more" is. */
export const WINDOW_DAYS = 30;

const byNewest = (a: SpendEntry, b: SpendEntry) =>
  a.spent_at < b.spent_at
    ? 1
    : a.spent_at > b.spent_at
      ? -1
      : a.created_at < b.created_at
        ? 1
        : a.created_at > b.created_at
          ? -1
          : 0;

/**
 * The spend entries inside a rolling window of days, newest first.
 *
 * Every row carries the calendar day it counts toward, so "today's total" is a
 * filter rather than a reset — a new day simply starts back at $0 while the
 * history stays intact. Adds, edits and deletes are optimistic, so the totals
 * move the instant you tap; realtime keeps a second device in step.
 *
 * "Load more" walks the window back far enough to reach the next entry that
 * actually exists, so a gap of empty months never needs several taps.
 */
export function useSpendEntries(userId: string | null) {
  const today = todayISO();
  const [since, setSince] = useState(() => addDays(todayISO(), -(WINDOW_DAYS - 1)));
  const [entries, setEntries] = useState<SpendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // --- load (re-runs whenever the window is widened) ----------------------
  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data, error }, { data: older }] = await Promise.all([
        supabase
          .from('spend_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('spent_at', since)
          .order('spent_at', { ascending: false })
          .order('created_at', { ascending: false }),
        // Anything at all before the window? That's what "Load more" offers.
        supabase
          .from('spend_entries')
          .select('id')
          .eq('user_id', userId)
          .lt('spent_at', since)
          .limit(1),
      ]);
      if (cancelled) return;
      if (error) console.error('Failed to load spend entries:', error.message);
      setEntries((data ?? []) as SpendEntry[]);
      setHasMore((older ?? []).length > 0);
      setLoading(false);
      setLoadingMore(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, since]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`spend-rt-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spend_entries',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setEntries((prev) => prev.filter((e) => e.id !== id));
            return;
          }
          const row = payload.new as SpendEntry;
          if (row.spent_at < since) return; // outside the loaded window
          setEntries((prev) =>
            (prev.some((e) => e.id === row.id)
              ? prev.map((e) => (e.id === row.id ? row : e))
              : [...prev, row]
            ).sort(byNewest)
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, since]);

  // --- derived ------------------------------------------------------------
  const days: SpendDay[] = useMemo(() => groupByDay(entries), [entries]);
  const todayTotal = useMemo(() => totalForDate(entries, today), [entries, today]);

  /** Today's most recent entry — the line the Home card shows under the total. */
  const lastToday = useMemo(
    () => entries.filter((e) => e.spent_at === today).sort(byNewest)[0] ?? null,
    [entries, today]
  );

  // --- mutations ----------------------------------------------------------
  const addEntry = useCallback(
    async (amount: number, label: string | null) => {
      if (!userId) return;
      if (!Number.isFinite(amount) || amount <= 0) return;
      const row: SpendEntry = {
        id: crypto.randomUUID(),
        user_id: userId,
        amount,
        label: label?.trim() || null,
        spent_at: todayISO(),
        created_at: new Date().toISOString(),
      };
      setEntries((prev) => [row, ...prev].sort(byNewest)); // optimistic
      const { error } = await supabase.from('spend_entries').insert({
        id: row.id,
        user_id: row.user_id,
        amount: row.amount,
        label: row.label,
        spent_at: row.spent_at,
      });
      if (error) {
        console.error('addEntry failed:', error.message);
        setEntries((prev) => prev.filter((e) => e.id !== row.id));
      }
    },
    [userId]
  );

  const deleteEntry = useCallback(async (id: string) => {
    let removed: SpendEntry | undefined;
    setEntries((prev) => {
      removed = prev.find((e) => e.id === id);
      return prev.filter((e) => e.id !== id);
    });
    const { error } = await supabase.from('spend_entries').delete().eq('id', id);
    if (error) {
      console.error('deleteEntry failed:', error.message);
      if (removed) setEntries((prev) => [...prev, removed as SpendEntry].sort(byNewest));
    }
  }, []);

  const updateEntry = useCallback(
    async (id: string, patch: { amount?: number; label?: string | null }) => {
      const next: { amount?: number; label?: string | null } = {};
      if (patch.amount !== undefined && Number.isFinite(patch.amount) && patch.amount > 0) {
        next.amount = patch.amount;
      }
      if (patch.label !== undefined) next.label = patch.label?.trim() || null;
      if (Object.keys(next).length === 0) return;

      let before: SpendEntry | undefined;
      setEntries((prev) => {
        before = prev.find((e) => e.id === id);
        return prev.map((e) => (e.id === id ? { ...e, ...next } : e));
      });
      const { error } = await supabase.from('spend_entries').update(next).eq('id', id);
      if (error) {
        console.error('updateEntry failed:', error.message);
        if (before) {
          setEntries((prev) => prev.map((e) => (e.id === id ? (before as SpendEntry) : e)));
        }
      }
    },
    []
  );

  /** Widen the window back far enough to reach the next entry that exists. */
  const loadMore = useCallback(async () => {
    if (!userId || loadingMore) return;
    setLoadingMore(true);
    const { data, error } = await supabase
      .from('spend_entries')
      .select('spent_at')
      .eq('user_id', userId)
      .lt('spent_at', since)
      .order('spent_at', { ascending: false })
      .limit(1);
    if (error) console.error('loadMore failed:', error.message);
    const next = data?.[0]?.spent_at as string | undefined;
    if (!next) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }
    setSince(addDays(next, -(WINDOW_DAYS - 1)));
  }, [userId, since, loadingMore]);

  return {
    entries,
    days,
    todayTotal,
    lastToday,
    loading,
    hasMore,
    loadingMore,
    addEntry,
    updateEntry,
    deleteEntry,
    loadMore,
  };
}

export type UseSpendEntries = ReturnType<typeof useSpendEntries>;
