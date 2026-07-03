import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetSettings } from '../../types/budget';

function defaults(userId: string): BudgetSettings {
  return {
    id: '',
    user_id: userId,
    monthly_income_target: null,
    currency_symbol: '$',
    week_start: 'monday',
    alert_threshold: 0.8,
  };
}

/** The user's single budget_settings row, upserted on change and kept in sync. */
export function useBudgetSettings(userId: string | null) {
  const [settings, setSettings] = useState<BudgetSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('budget_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error('Failed to load budget settings:', error.message);
      setSettings((data as BudgetSettings) ?? defaults(userId));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget-settings-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_settings', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType !== 'DELETE') setSettings(payload.new as BudgetSettings);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const save = useCallback(
    async (patch: Partial<Omit<BudgetSettings, 'id' | 'user_id'>>) => {
      if (!userId) return;
      setSettings((prev) => ({ ...(prev ?? defaults(userId)), ...patch }) as BudgetSettings);
      const current = settings ?? defaults(userId);
      const { error } = await supabase.from('budget_settings').upsert(
        {
          user_id: userId,
          monthly_income_target: patch.monthly_income_target ?? current.monthly_income_target,
          currency_symbol: patch.currency_symbol ?? current.currency_symbol,
          week_start: patch.week_start ?? current.week_start,
          alert_threshold: patch.alert_threshold ?? current.alert_threshold,
        },
        { onConflict: 'user_id' }
      );
      if (error) console.error('save budget settings failed:', error.message);
    },
    [userId, settings]
  );

  return { settings: settings ?? (userId ? defaults(userId) : null), loading, save };
}

export type UseBudgetSettings = ReturnType<typeof useBudgetSettings>;
