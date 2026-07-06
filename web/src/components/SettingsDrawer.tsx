import { useVoiceSettings } from '../hooks/useVoiceSettings';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

/** Slide-in drawer for configuring the voice start/stop keywords. */
export default function SettingsDrawer({ open, onClose }: Props) {
  const { settings, setStartKeyword, setStopKeyword } = useVoiceSettings();
  const isMobile = useIsMobile();

  return (
    <div className={['fixed inset-0 z-50', open ? '' : 'pointer-events-none'].join(' ')} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={[
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      {/* Panel */}
      <div
        className={[
          'absolute right-0 top-0 h-full w-full max-w-sm border-l border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-gray-800 dark:bg-gray-900',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold tracking-tight">Voice settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {isMobile ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              Keyword activation is available on desktop only. On mobile, tap the mic button in the
              corner of the screen to start and stop recording.
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Start keyword</label>
                <input
                  value={settings.startKeyword}
                  onChange={(e) => setStartKeyword(e.target.value)}
                  placeholder="start recording"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-gray-400">Spoken phrase that begins capturing.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Stop keyword</label>
                <input
                  value={settings.stopKeyword}
                  onChange={(e) => setStopKeyword(e.target.value)}
                  placeholder="done"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-gray-400">Spoken phrase that stops and sends to Claude.</p>
              </div>

              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                Keywords are case-insensitive and can be any word or short phrase.
              </p>
            </>
          )}

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            Your work days and sleep are now set from the <span className="font-medium">Work days</span> and{' '}
            <span className="font-medium">Sleep</span> buttons on the To-Do List page.
          </p>
        </div>
      </div>
    </div>
  );
}
