interface Props {
  text: string;
  placeholder?: string;
  live?: boolean;
}

/** Read-only, scrollable transcript display. */
export default function VoiceTranscript({ text, placeholder, live = false }: Props) {
  return (
    <div
      className={[
        'max-h-56 min-h-[7rem] w-full overflow-y-auto rounded-xl border bg-gray-50 p-3 text-sm leading-relaxed dark:bg-gray-900/60',
        live
          ? 'border-red-300 dark:border-red-500/40'
          : 'border-gray-200 dark:border-gray-800',
      ].join(' ')}
      aria-live="polite"
      aria-readonly
    >
      {text ? (
        <span className="whitespace-pre-wrap text-gray-800 dark:text-gray-100">{text}</span>
      ) : (
        <span className="text-gray-400">{placeholder}</span>
      )}
    </div>
  );
}
