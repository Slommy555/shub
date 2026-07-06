import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTelegramPrefs, type TelegramSections } from '../../hooks/useTelegramPrefs';
import { supabase } from '../../lib/supabase';

const COMMON_TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

const SECTION_LABELS: { key: keyof TelegramSections; label: string }[] = [
  { key: 'schedule', label: "Today's schedule and events" },
  { key: 'tasks', label: 'Tasks due today or overdue' },
  { key: 'habits', label: 'Habits for today' },
  { key: 'workout', label: 'Workout — day in my weekly schedule' },
  { key: 'budget', label: 'Budget — daily spend & weekly pacing' },
  { key: 'notes', label: 'Notes flagged for daily update' },
  { key: 'recommendations', label: 'Time management recommendations' },
];

const rowCls = 'flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
      />
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{checked ? 'On' : 'Off'}</span>
    </label>
  );
}

/**
 * "Telegram Brief" settings: a morning brief delivered to Telegram by a
 * server-side cron job (the app need not be open). Enable, pick a local delivery
 * time + timezone, choose which sections to include, then use "Send test
 * message" to fire the Edge Function immediately. Requires the bot token / chat
 * id to be configured as Supabase secrets (see the telegram-brief function).
 */
export default function TelegramBriefSettings() {
  const { user } = useAuth();
  const { prefs, save } = useTelegramPrefs(user?.id ?? null);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  // Ensure the timezone list always includes the user's current value.
  const zones = COMMON_TIMEZONES.includes(prefs.telegram_timezone)
    ? COMMON_TIMEZONES
    : [prefs.telegram_timezone, ...COMMON_TIMEZONES];

  async function sendTest() {
    if (!user?.id) return;
    setTestState('sending');
    setTestError(null);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-brief', {
        body: { force: true, user_id: user.id },
      });
      if (error || (data && data.ok === false)) {
        setTestState('error');
        setTestError((data && data.error) || error?.message || 'Send failed');
      } else {
        setTestState('sent');
      }
    } catch (e) {
      setTestState('error');
      setTestError(e instanceof Error ? e.message : 'Send failed');
    }
    setTimeout(() => setTestState('idle'), 6000);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">Telegram Brief</h2>
      <p className="mb-3 text-xs text-gray-400">
        A personalized morning brief sent to your Telegram, even when the app is closed.
      </p>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">Enable Telegram brief</p>
          <p className="text-xs text-gray-400">Delivered daily at your chosen time.</p>
        </div>
        <Toggle
          checked={prefs.telegram_enabled}
          onChange={(v) => save({ telegram_enabled: v })}
        />
      </div>

      {prefs.telegram_enabled && (
        <>
          {/* Delivery time */}
          <div className={rowCls}>
            <div>
              <p className="text-sm">Delivery time</p>
              <p className="text-xs text-gray-400">Your local time.</p>
            </div>
            <input
              type="time"
              value={prefs.telegram_time}
              onChange={(e) => save({ telegram_time: e.target.value })}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
              aria-label="Delivery time"
            />
          </div>

          {/* Timezone */}
          <div className={rowCls}>
            <div>
              <p className="text-sm">Timezone</p>
              <p className="text-xs text-gray-400">Used to send at your local time.</p>
            </div>
            <select
              value={prefs.telegram_timezone}
              onChange={(e) => save({ telegram_timezone: e.target.value })}
              className="max-w-[55%] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
              aria-label="Timezone"
            >
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          {/* Section checkboxes */}
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <p className="mb-2 text-sm">Include in brief</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECTION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={prefs.telegram_sections[key]}
                    onChange={(e) =>
                      save({
                        telegram_sections: { ...prefs.telegram_sections, [key]: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-gray-600 dark:border-gray-600 dark:bg-gray-800"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Test */}
          <div className={rowCls}>
            <div className="min-w-0">
              <p className="text-sm">Send test message</p>
              <p className="truncate text-xs text-gray-400">
                {testState === 'error' && testError ? testError : 'Deliver a brief to Telegram right now.'}
              </p>
            </div>
            <button
              type="button"
              onClick={sendTest}
              disabled={testState === 'sending'}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {testState === 'sending' ? 'Sending…' : testState === 'sent' ? 'Sent ✓' : testState === 'error' ? 'Failed' : 'Send test'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
