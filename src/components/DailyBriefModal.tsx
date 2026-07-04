/** Full daily-brief reader. Opened from the nav bell or when a brief push is
 *  tapped. Renders the plain-text brief (bullets preserved) in a clean sheet. */
export default function DailyBriefModal({
  brief,
  onClose,
}: {
  brief: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl animate-slide-up dark:bg-gray-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span>☀️</span> Daily Brief
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        {brief ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {brief}
          </p>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">
            No brief yet. Enable push notifications in Settings and you’ll get one each morning.
          </p>
        )}
      </div>
    </div>
  );
}
