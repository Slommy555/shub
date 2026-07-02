import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { APPEARANCE_FIELDS, type useAppearance } from '../hooks/useAppearance';
import ThemeToggle from './ThemeToggle';
import SetPasswordDialog from './SetPasswordDialog';
import CategoryManager from './CategoryManager';
import NotificationSettings from './NotificationSettings';

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  appearance: ReturnType<typeof useAppearance>;
}

export default function SettingsView({ theme, onToggleTheme, appearance }: Props) {
  const { user, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 text-xl font-bold tracking-tight">Settings</h1>

      <div className="space-y-4">
        {/* Appearance */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Theme</p>
              <p className="text-xs text-gray-400">
                Currently {theme === 'dark' ? 'dark' : 'light'} mode.
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>

          {/* Custom colors */}
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Custom colors</p>
                <p className="text-xs text-gray-400">
                  Override the palette for text, background, accents and more.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={appearance.enabled}
                  onChange={(e) => appearance.setEnabled(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {appearance.enabled ? 'On' : 'Off'}
                </span>
              </label>
            </div>

            {appearance.enabled && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {APPEARANCE_FIELDS.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 p-2 dark:border-gray-800"
                    >
                      <input
                        type="color"
                        value={appearance.colors[f.key]}
                        onChange={(e) => appearance.setColor(f.key, e.target.value)}
                        className="h-8 w-10 shrink-0 cursor-pointer rounded border border-gray-200 bg-transparent dark:border-gray-700"
                        aria-label={f.label}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">{f.label}</span>
                        <span className="block truncate text-[11px] text-gray-400">{f.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={appearance.reset}
                  className="mt-3 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Reset to default
                </button>
              </>
            )}
          </div>
        </section>

        {/* Account */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Account</h2>

          {user?.email && (
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm">Signed in as</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <div>
              <p className="text-sm">Password</p>
              <p className="text-xs text-gray-400">Set or change your sign-in password.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(true)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Set password
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <div>
              <p className="text-sm">Sign out</p>
              <p className="text-xs text-gray-400">End this session on this device.</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </section>

        <NotificationSettings />

        <CategoryManager />
      </div>

      {showPassword && <SetPasswordDialog onClose={() => setShowPassword(false)} />}
    </div>
  );
}
