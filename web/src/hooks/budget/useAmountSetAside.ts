import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * The manually-logged "I've set aside" running total for a month, stored on
 * budget_periods.amount_set_aside.
 *
 * Deliberately hand-entered rather than derived: it's what the user has
 * ACTUALLY moved to savings or paid toward bills, which is the only number the
 * app can't infer. The Snapshot measures it against what the month needs.
 */
export function useAmountSetAside(periodId: string | null) {
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!periodId) {
      setAmount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_periods')
        .select('amount_set_aside')
        .eq('id', periodId)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error('load amount_set_aside failed:', error.message);
      else setAmount(Number((data as { amount_set_aside?: number } | null)?.amount_set_aside) || 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  const save = useCallback(
    async (n: number) => {
      if (!periodId) return;
      const next = Math.max(0, Number(n) || 0);
      setAmount(next); // optimistic: the field shouldn't lag the keystroke
      const { error } = await supabase
        .from('budget_periods')
        .update({ amount_set_aside: next })
        .eq('id', periodId);
      if (error) console.error('save amount_set_aside failed:', error.message);
    },
    [periodId]
  );

  return { amount, save };
}
