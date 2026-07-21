import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CreditCard } from '../../types/budget';

const byPosition = (a: CreditCard, b: CreditCard) => a.position - b.position;

/**
 * Simple credit-card weekly line items for a budget (Round 2 model): a name and
 * a flat weekly payment. Independent of periods — the same weekly payment counts
 * every month. Realtime-synced, optimistic writes.
 */
export function useCreditCards(userId: string | null, budgetId: string | null) {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const ref = useRef<CreditCard[]>([]);
  ref.current = cards;

  useEffect(() => {
    if (!userId || !budgetId) {
      setCards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_credit_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('load credit cards failed:', error.message);
        return;
      }
      setCards((data as CreditCard[]).sort(byPosition));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, budgetId]);

  useEffect(() => {
    if (!userId || !budgetId) return;
    const channel = supabase
      .channel(`budget_credit_cards-rt-${userId}-${budgetId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_credit_cards', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setCards((prev) => prev.filter((c) => c.id !== id));
            return;
          }
          const row = payload.new as CreditCard;
          if (row.budget_id !== budgetId) return;
          setCards((prev) => {
            const exists = prev.some((c) => c.id === row.id);
            return (exists ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row]).sort(byPosition);
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId]);

  const addCard = useCallback(
    async (name: string, weekly: number) => {
      if (!userId || !budgetId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = crypto.randomUUID();
      const position = ref.current.length;
      const value = Math.max(0, weekly);
      const row: CreditCard = { id, user_id: userId, budget_id: budgetId, name: trimmed, weekly_payment: value, position };
      setCards((prev) => [...prev, row].sort(byPosition));
      const { error } = await supabase
        .from('budget_credit_cards')
        .insert({ id, user_id: userId, budget_id: budgetId, name: trimmed, weekly_payment: value, position });
      if (error) console.error('addCard failed:', error.message);
    },
    [userId, budgetId]
  );

  const updateCard = useCallback(
    async (id: string, patch: { name?: string; weekly_payment?: number }) => {
      const name = patch.name?.trim();
      const dbPatch: { name?: string; weekly_payment?: number } = {};
      if (name) dbPatch.name = name;
      if (patch.weekly_payment !== undefined) dbPatch.weekly_payment = Math.max(0, patch.weekly_payment);
      if (Object.keys(dbPatch).length === 0) return;
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...dbPatch } : c)));
      const { error } = await supabase.from('budget_credit_cards').update(dbPatch).eq('id', id);
      if (error) console.error('updateCard failed:', error.message);
    },
    []
  );

  const deleteCard = useCallback(async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('budget_credit_cards').delete().eq('id', id);
    if (error) console.error('deleteCard failed:', error.message);
  }, []);

  return { cards, addCard, updateCard, deleteCard };
}

export type UseCreditCards = ReturnType<typeof useCreditCards>;
