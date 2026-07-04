import { useState } from 'react';
import {
  isStandalone,
  notifPermission,
  requestNotifPermission,
  triggersSupported,
  type NotifPermission,
} from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';
import { useNotificationPrefs, type NotificationSections } from '../hooks/useNotificationPrefs';
import { supabase } from '../lib/supabase';

const COMMON_TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

const SECTION_LABELS: { key: keyof NotificationSections; label: string }[] = [
  { key: 'schedule', label: "Today's schedule & events" },
  { key: 'tasks', label: 'Tasks due today or overdue' },
  { key: 'habits', label: 'Habits for today' },
  { key: 'workout', label: 'Workout day' },
  { key: 'budget', label: 'Budget summary' },
  { key: 'notes', label: 'Notes flagged for the brief' },
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

export default function NotificationSettings() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotifPermission>(notifPermission());
  const { prefs, save } = useNotificationPrefs(user?.id ?? null);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function enable() {
    setPerm(await requestNotifPermission());
  }

  // Ensure the timezone list always includes the user's current value.
  const zones = COMMON_TIMEZONES.includes(prefs.notification_timezone)
    ? COMMON_TIMEZONES
    : [prefs.notification_timezone, ...COMMON_TIMEZONES];

  async function sendTest() {
    if (!user?.id) return;
    setTestState('sending');
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          user_id: user.id,
          title: 'Test notification',
          body: 'Push notifications are working 🎉',
          type: 'test',
        },
      });
      setTestState(error || (data && data.ok === false) ? 'error' : 'sent');
    } catch {
      setTestState('error');
    }
    setTimeout(() => setTestState('idle'), 4000);
  }

  const installed = isStandalone();

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</h2>

      {/* Web permission status */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm">Device notifications</p>
          <p className="text-xs text-gray-400">
            {perm === 'unsupported'
              ? 'This browser doesn’t support notifications.'
              : perm === 'granted'
                ? 'Enabled on this device.'
                : perm === 'denied'
                  ? 'Blocked. Re-enable in your browser/OS settings.'
                  : 'Allow notifications so reminders can reach you.'}
          </p>
        </div>
        {perm !== 'granted' && perm !== 'unsupported' && perm !== 'denied' && (
          <button
            type="button"
            onClick={enable}
            className="shrink-0 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900"
          >
            Enable
          </button>
        )}
        {perm === 'granted' && (
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
            On
          </span>
        )}
      </div>

      {/* Master push toggle */}
      <div className={rowCls}>
        <div>
          <p className="text-sm">Push notifications</p>
          <p className="text-xs text-gray-400">Daily brief and reminders, even when the app is closed.</p>
        </div>
        <Toggle
          checked={prefs.notification_enabled}
          onChange={(v) => save({ notification_enabled: v })}
        />
      </div>

      {prefs.notification_enabled && (
        <>
          {/* Daily brief time + timezone */}
          <div className={rowCls}>
            <div>
              <p className="text-sm">Daily brief time</p>
              <p className="text-xs text-gray-400">When to receive your morning brief.</p>
            </div>
            <input
              type="time"
              value={prefs.notification_time}
              onChange={(e) => save({ notification_time: e.target.value })}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
              aria-label="Daily brief time"
            />
          </div>
          <div className={rowCls}>
            <div>
              <p className="text-sm">Timezone</p>
              <p className="text-xs text-gray-400">Used to send at your local time.</p>
            </div>
            <select
              value={prefs.notification_timezone}
              onChange={(e) => save({ notification_timezone: e.target.value })}
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
            <p className="mb-2 text-sm">Include in daily brief</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECTION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={prefs.notification_sections[key]}
                    onChange={(e) =>
                      save({
                        notification_sections: { ...prefs.notification_sections, [key]: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-gray-600 dark:border-gray-600 dark:bg-gray-800"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Task reminders */}
          <div className={rowCls}>
            <div>
              <p className="text-sm">Task reminders</p>
              <p className="text-xs text-gray-400">Morning digest + a ping an hour before timed tasks.</p>
            </div>
            <Toggle
              checked={prefs.task_reminders_enabled}
              onChange={(v) => save({ task_reminders_enabled: v })}
            />
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
            Habit reminders are set per habit in the Focus tab.
          </div>

          {/* Test */}
          <div className={rowCls}>
            <div>
              <p className="text-sm">Test notification</p>
              <p className="text-xs text-gray-400">Send a push to this device now.</p>
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

      {/* Install guidance */}
      {!installed && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-xs text-gray-400">
            Install the app (Add to Home Screen on iOS, or the Android APK) for reliable delivery.
          </p>
        </div>
      )}

      {perm === 'granted' && !triggersSupported() && (
        <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
          On this device, web reminders fire while the app is open or backgrounded. The native
          Android app delivers pushes even when fully closed.
        </div>
      )}
    </section>
  );
}
