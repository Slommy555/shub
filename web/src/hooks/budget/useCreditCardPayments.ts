import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface CardPaymentRow {
  id: string;
  user_id: string;
  card_id: string;
  period_id: string;
  weekly_payment: number;
}

type PaymentMap = Record<string, number>; // keyed by card_id → weekly payment for this period

/**
 * Per-period credit-card payment overrides for one (budget, period). A card
 * (a budget_group with kind='credit_card') normally derives its payment from its
 * balance + payoff dates; when an entry exists here, that value replaces the
 * derived amount for THIS month only — isolated per period, like an allocation.
 *
 * `amounts` is keyed by card_id. A key being PRESENT means the override is set
 * for this month (even a value of 0); absent means "fall back to derived". Writes
 * are optimistic and kept in sync via realtime. No row is created until the user
 * types a value.
 */
export function useCreditCardPayments(
  userId: string | null,
  budgetId: string | null,
  periodId: string | null
) {
  const [amounts, setAmounts] = useState<PaymentMap>({});
  const periodRef = useRef<string | null>(null);
  periodRef.current = periodId;

  // Load the overrides for the current period.
  useEffect(() => {
    if (!userId || !budgetId || !periodId) {
      setAmounts({});
      return;
    }
    let cancelled = false;
    setAmounts({});
    (async () => {
      const { data, error } = await supabase
        .from('budget_credit_card_payments')
        .select('card_id, weekly_payment')
        .eq('user_id', userId)
        .eq('period_id', periodId);
      if (cancelled) return;
      if (error) {
        console.error('load cc payments failed:', error.message);
        return;
      }
      const map: PaymentMap = {};
      for (const row of (data as Pick<CardPaymentRow, 'card_id' | 'weekly_payment'>[]) ?? [])
        map[row.card_id] = Number(row.weekly_payment) || 0;
      setAmounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, budgetId, periodId]);

  // Realtime — keep overrides in sync across devices for the current period.
  useEffect(() => {
    if (!userId || !budgetId || !periodId) return;
    const channel = supabase
      .channel(`cc-payments-rt-${userId}-${periodId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_credit_card_payments', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as CardPaymentRow;
            if (old.period_id !== periodRef.current) return;
            setAmounts((prev) => {
              const next = { ...prev };
              delete next[old.card_id];
              return next;
            });
            return;
          }
          const row = payload.new as CardPaymentRow;
          if (row.period_id !== periodRef.current) return;
          setAmounts((prev) => ({ ...prev, [row.card_id]: Number(row.weekly_payment) || 0 }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId, periodId]);

  /** Set (upsert) the weekly payment override for a card in the current period. */
  const setPayment = useCallback(
    async (cardId: string, weekly: number) => {
      if (!userId || !periodId) return;
      const value = Math.max(0, weekly);
      setAmounts((prev) => ({ ...prev, [cardId]: value }));
      const { error } = await supabase
        .from('budget_credit_card_payments')
        .upsert(
          { user_id: userId, card_id: cardId, period_id: periodId, weekly_payment: value },
          { onConflict: 'card_id,period_id' }
        );
      if (error) console.error('setPayment failed:', error.message);
    },
    [userId, periodId]
  );

  /** Override for a card this month, or null when none is set (use derived). */
  const overrideOf = useCallback(
    (cardId: string): number | null => (cardId in amounts ? amounts[cardId] : null),
    [amounts]
  );

  return { amounts, setPayment, overrideOf };
}

export type UseCreditCardPayments = ReturnType<typeof useCreditCardPayments>;
