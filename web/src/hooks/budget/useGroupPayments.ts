import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface GroupPaymentRow {
  id: string;
  user_id: string;
  group_id: string;
  pay_date: string; // YYYY-MM-DD
  amount: number;
}

const key = (groupId: string, payDate: string) => `${groupId}|${payDate}`;

/**
 * The per-pay-day ledger of what's been set aside toward each DATED fixed-cost
 * group (groups with a `due_day`). Keyed by `${group_id}|${pay_date}`. Mirrors
 * useCardPayments, but the remaining for a month is scoped to that month's pay
 * days (a fixed cost re-bills every month), so it exposes `paidInRange` rather
 * than a global `paidBefore`. Optimistic writes, realtime-synced; RLS scopes to
 * the user.
 */
export function useGroupPayments(userId: string | null) {
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
        .from('budget_group_payments')
        .select('group_id, pay_date, amount')
        .eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        console.error('load group payments failed:', error.message);
        return;
      }
      const map: Record<string, number> = {};
      for (const row of (data as Pick<GroupPaymentRow, 'group_id' | 'pay_date' | 'amount'>[]) ?? [])
        map[key(row.group_id, row.pay_date)] = Number(row.amount) || 0;
      setAmounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget_group_payments-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_group_payments', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as GroupPaymentRow;
            setAmounts((prev) => {
              const next = { ...prev };
              delete next[key(old.group_id, old.pay_date)];
              return next;
            });
            return;
          }
          const row = payload.new as GroupPaymentRow;
          setAmounts((prev) => ({ ...prev, [key(row.group_id, row.pay_date)]: Number(row.amount) || 0 }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /** Record (upsert) what was set aside toward a group on a specific pay day. */
  const setPayment = useCallback(
    async (groupId: string, payDate: string, amount: number) => {
      if (!userId) return;
      const value = Math.max(0, amount);
      setAmounts((prev) => ({ ...prev, [key(groupId, payDate)]: value }));
      const { error } = await supabase
        .from('budget_group_payments')
        .upsert({ user_id: userId, group_id: groupId, pay_date: payDate, amount: value }, { onConflict: 'group_id,pay_date' });
      if (error) console.error('group setPayment failed:', error.message);
    },
    [userId]
  );

  /** Amount set aside for this group on this exact pay day (undefined if none). */
  const paymentOn = useCallback(
    (groupId: string, payDate: string): number | undefined => amounts[key(groupId, payDate)],
    [amounts]
  );

  /** Total set aside for a group on pay days in [fromInclusive, toExclusive). */
  const paidInRange = useCallback(
    (groupId: string, fromInclusive: string, toExclusive: string): number => {
      let sum = 0;
      const prefix = `${groupId}|`;
      for (const [k, v] of Object.entries(amounts)) {
        if (!k.startsWith(prefix)) continue;
        const d = k.slice(prefix.length);
        if (d >= fromInclusive && d < toExclusive) sum += v;
      }
      return sum;
    },
    [amounts]
  );

  return { amounts, setPayment, paymentOn, paidInRange };
}

export type UseGroupPayments = ReturnType<typeof useGroupPayments>;
