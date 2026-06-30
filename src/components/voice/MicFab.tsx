interface Props {
  recording: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Mobile-only floating mic button (rendered by VoiceController only below the
 * `sm` breakpoint). Tap to start recording, tap again to stop. Sits in the
 * bottom-left corner so it never overlaps the bottom-right VoicePopup that shows
 * the live transcript while recording. The actual recording/transcript/Claude
 * flow is the shared pipeline — this is purely the trigger.
 */
export default function MicFab({ recording, onStart, onStop }: Props) {
  return (
    <button
      type="button"
      onClick={recording ? onStop : onStart}
      aria-label={recording ? 'Stop recording' : 'Start recording'}
      aria-pressed={recording}
      className="fixed bottom-5 left-4 z-50 grid h-14 w-14 place-items-center rounded-full shadow-lg shadow-gray-900/25 transition-colors"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Pulsing ring while recording */}
      {recording && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
      )}
      <span
        className={[
          'relative grid h-14 w-14 place-items-center rounded-full border',
          recording
            ? 'border-red-500 bg-red-500 text-white'
            : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
        ].join(' ')}
      >
        {recording ? (
          // Stop (filled square)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Mic
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
          </svg>
        )}
      </span>
    </button>
  );
}
