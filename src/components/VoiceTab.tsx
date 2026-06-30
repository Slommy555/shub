import { useVoice } from '../context/VoiceContext';

/**
 * The Voice tab is now just a control surface — the keyword listener and the
 * proposed-task review popup live globally in VoiceController, so voice works
 * on every tab. This page offers a manual start, settings, and a status note.
 */
export default function VoiceTab() {
  const voice = useVoice();

  if (!voice.enabled) {
    return (
      <Centered title="Voice input">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Voice input is only available in the local app. No Anthropic API key is configured in this build.
        </p>
      </Centered>
    );
  }

  if (!voice.supported) {
    return (
      <Centered title="Voice input">
        <p className="text-sm text-gray-500 dark:text-gray-400">Voice input requires Chrome or Safari.</p>
      </Centered>
    );
  }

  const busy = voice.recording || voice.reviewing;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Voice input</h1>
        <button
          type="button"
          onClick={voice.openSettings}
          aria-label="Voice settings"
          className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center py-12 text-center">
        <button
          type="button"
          onClick={voice.startManual}
          disabled={busy}
          aria-label="Start recording"
          className="grid h-24 w-24 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <MicIcon size={40} />
        </button>
        <p className="mt-5 text-base font-medium text-gray-700 dark:text-gray-200">
          {busy ? 'Listening — see the popup' : `Say “${voice.startKeyword}” to begin recording`}
        </p>
        <p className="mt-1 text-sm text-gray-400">or tap the mic to start manually</p>
        {voice.error && <p className="mt-3 text-sm text-red-500">{voice.error}</p>}

        <div className="mt-8 max-w-sm rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
          <p className="font-semibold text-gray-600 dark:text-gray-300">Works on every tab</p>
          <p className="mt-1">
            The keyword is always listening — say “{voice.startKeyword}” from any page and a popup
            appears with your proposed tasks. Mention work shifts or events (like a hike) and they’ll
            show up as time blocks in the Schedule view.
          </p>
        </div>
      </div>
    </div>
  );
}

function MicIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-xl font-bold tracking-tight">{title}</h1>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center dark:border-gray-800">
        {children}
      </div>
    </div>
  );
}
