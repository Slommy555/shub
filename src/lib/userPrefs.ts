import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** A row (or realtime payload) from `user_preferences`. */
export interface UserPrefsRow {
  theme?: unknown;
  custom_colors?: unknown;
  show_rpe?: unknown;
}

/**
 * Watch the signed-in user's `user_preferences` row in realtime, calling `apply`
 * with the latest values on every change — and, crucially, **re-establishing the
 * subscription when the tab regains focus/visibility**. Mobile browsers and
 * installed PWAs silently drop the realtime websocket when backgrounded, so
 * without this a change made on another device while this one was asleep would
 * never arrive. On every (re)focus we also re-fetch the row to reconcile any
 * change that was missed while the socket was down.
 *
 * Returns a cleanup function. `tag` keeps each caller's channel name distinct
 * (theme vs. appearance both watch the same row).
 */
export function watchUserPrefs(
  userId: string,
  tag: string,
  apply: (row: UserPrefsRow) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  const resync = async () => {
    const { data } = await supabase
      .from('user_preferences')
      .select('theme, custom_colors, show_rpe')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) apply(data as UserPrefsRow);
  };

  const open = () => {
    channel = supabase
      .channel(`user_prefs-${tag}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` },
        (payload) => apply((payload.new ?? {}) as UserPrefsRow)
      )
      .subscribe();
  };

  const onFocus = () => {
    if (document.visibilityState === 'hidden') return;
    // Recreate the channel if the socket dropped while backgrounded.
    if (!channel || channel.state !== 'joined') {
      if (channel) supabase.removeChannel(channel);
      open();
    }
    // Reconcile anything missed while we were away.
    void resync();
  };

  open();
  document.addEventListener('visibilitychange', onFocus);
  window.addEventListener('focus', onFocus);

  return () => {
    document.removeEventListener('visibilitychange', onFocus);
    window.removeEventListener('focus', onFocus);
    if (channel) supabase.removeChannel(channel);
  };
}
