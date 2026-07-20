import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface SavingsAccount {
  budget_id: string;
  user_id: string;
  starting_balance: number;
  start_month: string; // YYYY-MM-DD (first of month)
}

/**
 * The per-budget savings account anchor: a starting balance as of a start month.
 * The running balance itself is derived (see BudgetView) from this starting
 * point plus the monthly "Savings" category contributions and the allocation
 * history. Row is created lazily on first write.
 */
export function useSavingsAccount(userId: string | null, budgetId: string | null) {
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const ref = useRef<SavingsAccount | null>(null);
  ref.current = account;

  useEffect(() => {
    if (!userId || !budgetId) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_savings_account')
        .select('*')
        .eq('budget_id', budgetId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('load savings account failed:', error.message);
        return;
      }
      setAccount((data as SavingsAccount) ?? null);
    })();

    const channel = supabase
      .channel(`savings-account-rt-${userId}-${budgetId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_savings_account', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as SavingsAccount;
          if (row.budget_id === budgetId) setAccount(row);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId]);

  const patch = useCallback(
    async (fields: Partial<Pick<SavingsAccount, 'starting_balance' | 'start_month'>>) => {
      if (!userId || !budgetId) return;
      const base: SavingsAccount =
        ref.current ??
        ({
          budget_id: budgetId,
          user_id: userId,
          starting_balance: 0,
          start_month: firstOfThisMonth(),
        } as SavingsAccount);
      const next = { ...base, ...fields };
      setAccount(next);
      const { error } = await supabase
        .from('budget_savings_account')
        .upsert(
          {
            budget_id: budgetId,
            user_id: userId,
            starting_balance: next.starting_balance,
            start_month: next.start_month,
          },
          { onConflict: 'budget_id' }
        );
      if (error) console.error('save savings account failed:', error.message);
    },
    [userId, budgetId]
  );

  const startingBalance = Number(account?.starting_balance) || 0;
  const startMonth = account?.start_month ?? firstOfThisMonth();

  return {
    startingBalance,
    startMonth,
    setStartingBalance: (n: number) => patch({ starting_balance: n }),
    setStartMonth: (m: string) => patch({ start_month: m }),
  };
}

function firstOfThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
