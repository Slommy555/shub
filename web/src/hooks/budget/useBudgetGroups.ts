import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetGroup } from '../../types/budget';

const byPosition = (a: BudgetGroup, b: BudgetGroup) => a.position - b.position;

/**
 * Loads the user's expense groups (shared across the weekly + monthly views),
 * keeps them synced via realtime, and exposes CRUD + drag-to-reorder. Deleting a
 * group cascades to its allocations via the foreign key.
 */
export function useBudgetGroups(userId: string | null) {
  const [groups, setGroups] = useState<BudgetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const groupsRef = useRef<BudgetGroup[]>([]);
  groupsRef.current = groups;

  useEffect(() => {
    if (!userId) {
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
  }, [userId]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget_groups-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_groups', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setGroups((prev) => prev.filter((g) => g.id !== id));
          } else {
            const row = payload.new as BudgetGroup;
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
  }, [userId]);

  const addGroup = useCallback(
    async (name: string, color: string) => {
      if (!userId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = crypto.randomUUID();
      const position = groupsRef.current.length;
      const row: BudgetGroup = {
        id,
        user_id: userId,
        name: trimmed,
        color,
        position,
        created_at: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, row].sort(byPosition));
      const { error } = await supabase
        .from('budget_groups')
        .insert({ id, user_id: userId, name: trimmed, color, position });
      if (error) console.error('addGroup failed:', error.message);
    },
    [userId]
  );

  const updateGroup = useCallback(async (id: string, patch: { name?: string; color?: string }) => {
    const name = patch.name?.trim();
    setGroups((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, ...(name ? { name } : {}), ...(patch.color ? { color: patch.color } : {}) } : g
      )
    );
    const dbPatch: { name?: string; color?: string } = {};
    if (name) dbPatch.name = name;
    if (patch.color) dbPatch.color = patch.color;
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from('budget_groups').update(dbPatch).eq('id', id);
    if (error) console.error('updateGroup failed:', error.message);
  }, []);

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
