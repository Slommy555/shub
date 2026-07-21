import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CardCharge } from '../../types/budget';

const byNewest = (a: CardCharge, b: CardCharge) => (b.created_at ?? '').localeCompare(a.created_at ?? '');

/**
 * The transaction log of amounts charged to a user's cards, newest first.
 * Scoped to the user by RLS; callers filter by card via `chargesFor`. Optimistic
 * writes, realtime-synced.
 */
export function useCardCharges(userId: string | null) {
  const [charges, setCharges] = useState<CardCharge[]>([]);
  const ref = useRef<CardCharge[]>([]);
  ref.current = charges;

  useEffect(() => {
    if (!userId) {
      setCharges([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_card_charges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('load card charges failed:', error.message);
        return;
      }
      setCharges((data as CardCharge[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget_card_charges-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_card_charges', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setCharges((prev) => prev.filter((c) => c.id !== id));
            return;
          }
          const row = payload.new as CardCharge;
          setCharges((prev) => {
            const exists = prev.some((c) => c.id === row.id);
            return (exists ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row]).sort(byNewest);
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addCharge = useCallback(
    async (cardId: string, name: string, amount: number) => {
      if (!userId) return;
      const trimmed = name.trim() || 'Charge';
      const value = Math.max(0, amount);
      const id = crypto.randomUUID();
      const row: CardCharge = {
        id,
        user_id: userId,
        card_id: cardId,
        name: trimmed,
        amount: value,
        created_at: new Date().toISOString(),
      };
      setCharges((prev) => [row, ...prev]);
      const { error } = await supabase
        .from('budget_card_charges')
        .insert({ id, user_id: userId, card_id: cardId, name: trimmed, amount: value });
      if (error) console.error('addCharge failed:', error.message);
    },
    [userId]
  );

  const deleteCharge = useCallback(async (id: string) => {
    setCharges((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('budget_card_charges').delete().eq('id', id);
    if (error) console.error('deleteCharge failed:', error.message);
  }, []);

  const chargesFor = useCallback((cardId: string) => ref.current.filter((c) => c.card_id === cardId), []);

  return { charges, addCharge, deleteCharge, chargesFor };
}

export type UseCardCharges = ReturnType<typeof useCardCharges>;
