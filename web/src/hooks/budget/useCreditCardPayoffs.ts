import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CreditCardPayment, CreditCardPayoff } from '../../types/budget';

const byCreated = <T extends { created_at: string }>(a: T, b: T) =>
  a.created_at < b.created_at ? -1 : 1;
const byDue = (a: CreditCardPayment, b: CreditCardPayment) =>
  a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : byCreated(a, b);

export interface NewPayoff {
  name: string;
  total_amount: number;
  color?: string | null;
}

export interface NewPayment {
  payoff_id: string;
  due_date: string;
  amount: number;
}

/**
 * Loads the user's credit-card payoffs and their scheduled payments, keeps both
 * synced via realtime, and exposes CRUD. Remaining balance is derived by the
 * caller (total_amount − sum of that card's PAID payments).
 */
export function useCreditCardPayoffs(userId: string | null) {
  const [payoffs, setPayoffs] = useState<CreditCardPayoff[]>([]);
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPayoffs([]);
      setPayments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: po, error: e1 }, { data: pm, error: e2 }] = await Promise.all([
        supabase.from('credit_card_payoffs').select('*').order('created_at', { ascending: true }),
        supabase.from('credit_card_payments').select('*').order('due_date', { ascending: true }),
      ]);
      if (cancelled) return;
      if (e1) console.error('Failed to load credit cards:', e1.message);
      if (e2) console.error('Failed to load card payments:', e2.message);
      setPayoffs(((po ?? []) as CreditCardPayoff[]).sort(byCreated));
      setPayments(((pm ?? []) as CreditCardPayment[]).sort(byDue));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`credit-cards-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_card_payoffs', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setPayoffs((prev) => prev.filter((p) => p.id !== id));
          } else {
            const row = payload.new as CreditCardPayoff;
            setPayoffs((prev) => {
              const exists = prev.some((p) => p.id === row.id);
              return (exists ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row]).sort(byCreated);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_card_payments', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setPayments((prev) => prev.filter((p) => p.id !== id));
          } else {
            const row = payload.new as CreditCardPayment;
            setPayments((prev) => {
              const exists = prev.some((p) => p.id === row.id);
              return (exists ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row]).sort(byDue);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addPayoff = useCallback(
    async (input: NewPayoff) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const row: CreditCardPayoff = {
        id,
        user_id: userId,
        name: input.name.trim() || 'Credit card',
        total_amount: input.total_amount,
        color: input.color ?? null,
        created_at: new Date().toISOString(),
      };
      setPayoffs((prev) => [...prev, row].sort(byCreated));
      const { error } = await supabase.from('credit_card_payoffs').insert({
        id,
        user_id: userId,
        name: row.name,
        total_amount: row.total_amount,
        color: row.color,
      });
      if (error) console.error('addPayoff failed:', error.message);
    },
    [userId]
  );

  const updatePayoff = useCallback(
    async (id: string, patch: Partial<Pick<CreditCardPayoff, 'name' | 'total_amount' | 'color'>>) => {
      setPayoffs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      const { error } = await supabase.from('credit_card_payoffs').update(patch).eq('id', id);
      if (error) console.error('updatePayoff failed:', error.message);
    },
    []
  );

  const deletePayoff = useCallback(async (id: string) => {
    setPayoffs((prev) => prev.filter((p) => p.id !== id));
    setPayments((prev) => prev.filter((p) => p.payoff_id !== id)); // cascade locally
    const { error } = await supabase.from('credit_card_payoffs').delete().eq('id', id);
    if (error) console.error('deletePayoff failed:', error.message);
  }, []);

  const addPayment = useCallback(
    async (input: NewPayment) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const row: CreditCardPayment = {
        id,
        payoff_id: input.payoff_id,
        user_id: userId,
        due_date: input.due_date,
        amount: input.amount,
        paid: false,
        created_at: new Date().toISOString(),
      };
      setPayments((prev) => [...prev, row].sort(byDue));
      const { error } = await supabase.from('credit_card_payments').insert({
        id,
        payoff_id: input.payoff_id,
        user_id: userId,
        due_date: input.due_date,
        amount: input.amount,
      });
      if (error) console.error('addPayment failed:', error.message);
    },
    [userId]
  );

  const updatePayment = useCallback(
    async (id: string, patch: Partial<Pick<CreditCardPayment, 'due_date' | 'amount' | 'paid'>>) => {
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)).sort(byDue));
      const { error } = await supabase.from('credit_card_payments').update(patch).eq('id', id);
      if (error) console.error('updatePayment failed:', error.message);
    },
    []
  );

  const deletePayment = useCallback(async (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from('credit_card_payments').delete().eq('id', id);
    if (error) console.error('deletePayment failed:', error.message);
  }, []);

  return {
    payoffs,
    payments,
    loading,
    addPayoff,
    updatePayoff,
    deletePayoff,
    addPayment,
    updatePayment,
    deletePayment,
  };
}

export type UseCreditCardPayoffs = ReturnType<typeof useCreditCardPayoffs>;
