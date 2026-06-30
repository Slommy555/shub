import { useState } from 'react';
import {
  isStandalone,
  notifPermission,
  requestNotifPermission,
  triggersSupported,
  type NotifPermission,
} from '../../lib/notifications';

/**
 * Self-contained notifications panel for the global Settings tab: permission
 * control plus the install / delivery guidance that used to clutter the
 * Reminders page.
 */
export default function NotificationSettings() {
  const [perm, setPerm] = useState<NotifPermission>(notifPermission());

  async function enable() {
    setPerm(await requestNotifPermission());
  }

  const installed = isStandalone();

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</h2>

      {/* Permission status + action */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm">Reminder notifications</p>
          <p className="text-xs text-gray-400">
            {perm === 'unsupported'
              ? 'This browser doesn’t support notifications.'
              : perm === 'granted'
                ? 'Enabled — reminders can reach you on this device.'
                : perm === 'denied'
                  ? 'Blocked. Re-enable notifications in your browser’s site settings.'
                  : 'Allow notifications so reminders can reach you.'}
          </p>
        </div>
        {perm !== 'granted' && perm !== 'unsupported' && perm !== 'denied' && (
          <button
            type="button"
            onClick={enable}
            className="shrink-0 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
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

      {/* Install guidance */}
      {!installed && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-sm">Install the app</p>
          <p className="mt-0.5 text-xs text-gray-400">
            On iPhone/iPad, open the Share menu and tap “Add to Home Screen,” then launch it from
            there — that’s required for notifications on iOS. On Windows, install it from your
            browser’s address-bar install icon.
          </p>
        </div>
      )}

      {/* Delivery note */}
      {perm === 'granted' && !triggersSupported() && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-xs text-gray-400">
            On this device, reminders fire while the app is open or running in the background. Keep
            it installed for reliable delivery.
          </p>
        </div>
      )}
    </section>
  );
}
