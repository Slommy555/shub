import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function SetPasswordDialog({ onClose }: { onClose: () => void }) {
  const { setPassword } = useAuth();
  const [password, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setStatus('error');
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setError('Passwords don’t match.');
      return;
    }
    setStatus('saving');
    setError('');
    const { error } = await setPassword(password);
    if (error) {
      setStatus('error');
      setError(error.message);
    } else {
      setStatus('done');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold tracking-tight">Set a password</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          After this you can sign in with your email and this password.
        </p>

        {status === 'done' ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              Password set. Use it next time you sign in.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-gray-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-gray-500 focus:ring-2 focus:ring-gray-400/40 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-gray-500 focus:ring-2 focus:ring-gray-400/40 dark:border-gray-700 dark:bg-gray-950"
            />
            {status === 'error' && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'saving'}
                className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
              >
                {status === 'saving' ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
