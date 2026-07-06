interface Props {
  recording: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Mobile-only voice side tab (rendered by VoiceController only below the `sm`
 * breakpoint). A small pill anchored to the RIGHT edge at 55% from the top, just
 * below the menu tab (45%). Tap to start recording, tap again to stop. Respects
 * the phone's right safe-area inset. The actual recording/transcript/Claude flow
 * is the shared pipeline — this is purely the trigger (Fix 3).
 */
export default function MicFab({ recording, onStart, onStop }: Props) {
  return (
    <button
      type="button"
      onClick={recording ? onStop : onStart}
      aria-label={recording ? 'Stop recording' : 'Start recording'}
      aria-pressed={recording}
      className={[
        'fixed right-0 top-[55%] z-40 flex h-14 w-8 items-center justify-center overflow-hidden rounded-l-xl border border-r-0 shadow-lg shadow-gray-900/25 backdrop-blur transition-colors sm:hidden',
        recording
          ? 'border-red-500 bg-red-500 text-white'
          : 'border-gray-200 bg-white/90 text-gray-700 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-200',
      ].join(' ')}
      style={{ right: 'env(safe-area-inset-right)' }}
    >
      {/* Pulsing wash while recording */}
      {recording && (
        <span className="absolute inset-0 animate-pulse rounded-l-xl bg-red-400/40" />
      )}
      <span className="relative">
        {recording ? (
          // Stop (filled square)
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Mic
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
          </svg>
        )}
      </span>
    </button>
  );
}
