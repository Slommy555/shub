import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface CardPaymentRow {
  id: string;
  user_id: string;
  card_id: string;
  pay_date: string; // YYYY-MM-DD
  amount: number;
}

const key = (cardId: string, payDate: string) => `${cardId}|${payDate}`;

/**
 * The per-pay-day payment ledger across all of a user's cards. Keyed by
 * `${card_id}|${pay_date}`. A card's remaining balance = card.balance − total
 * paid; the suggested payment on a pay day uses what was paid on EARLIER pay
 * days. Optimistic writes, realtime-synced. (Filtered to the active budget by
 * the caller via the card list; RLS scopes to the user.)
 */
export function useCardPayments(userId: string | null) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const ref = useRef<Record<string, number>>({});
  ref.current = amounts;

  useEffect(() => {
    if (!userId) {
      setAmounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_card_payments')
        .select('card_id, pay_date, amount')
        .eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        console.error('load card payments failed:', error.message);
        return;
      }
      const map: Record<string, number> = {};
      for (const row of (data as Pick<CardPaymentRow, 'card_id' | 'pay_date' | 'amount'>[]) ?? [])
        map[key(row.card_id, row.pay_date)] = Number(row.amount) || 0;
      setAmounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget_card_payments-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_card_payments', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as CardPaymentRow;
            setAmounts((prev) => {
              const next = { ...prev };
              delete next[key(old.card_id, old.pay_date)];
              return next;
            });
            return;
          }
          const row = payload.new as CardPaymentRow;
          setAmounts((prev) => ({ ...prev, [key(row.card_id, row.pay_date)]: Number(row.amount) || 0 }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /** Record (upsert) the payment made on a card for a specific pay day. */
  const setPayment = useCallback(
    async (cardId: string, payDate: string, amount: number) => {
      if (!userId) return;
      const value = Math.max(0, amount);
      setAmounts((prev) => ({ ...prev, [key(cardId, payDate)]: value }));
      const { error } = await supabase
        .from('budget_card_payments')
        .upsert({ user_id: userId, card_id: cardId, pay_date: payDate, amount: value }, { onConflict: 'card_id,pay_date' });
      if (error) console.error('setPayment failed:', error.message);
    },
    [userId]
  );

  /** Payment recorded for this card on this exact pay day (undefined if none). */
  const paymentOn = useCallback(
    (cardId: string, payDate: string): number | undefined => amounts[key(cardId, payDate)],
    [amounts]
  );

  /** Total paid on this card across all pay days STRICTLY BEFORE `payDate`. */
  const paidBefore = useCallback(
    (cardId: string, payDate: string): number => {
      let sum = 0;
      const prefix = `${cardId}|`;
      for (const [k, v] of Object.entries(amounts)) {
        if (k.startsWith(prefix) && k.slice(prefix.length) < payDate) sum += v;
      }
      return sum;
    },
    [amounts]
  );

  /** Total paid on this card across all pay days. */
  const paidTotal = useCallback(
    (cardId: string): number => {
      let sum = 0;
      const prefix = `${cardId}|`;
      for (const [k, v] of Object.entries(amounts)) if (k.startsWith(prefix)) sum += v;
      return sum;
    },
    [amounts]
  );

  return { amounts, setPayment, paymentOn, paidBefore, paidTotal };
}

export type UseCardPayments = ReturnType<typeof useCardPayments>;
