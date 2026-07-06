import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface BriefEntry {
  sent_at: string;
  content: string;
}

/** Loads the last 7 daily-brief entries from notification_log (realtime). */
export function useDailyBriefs(userId: string | null) {
  const [briefs, setBriefs] = useState<BriefEntry[]>([]);

  useEffect(() => {
    if (!userId) {
      setBriefs([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('notification_log')
        .select('sent_at, content')
        .eq('user_id', userId)
        .eq('type', 'daily_brief')
        .not('content', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(7);
      if (!cancelled) setBriefs((data ?? []) as BriefEntry[]);
    };
    load();

    const channel = supabase
      .channel(`briefs-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_log', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { briefs, latest: briefs[0]?.content ?? null };
}
