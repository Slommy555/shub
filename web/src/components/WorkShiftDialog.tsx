import { useState } from 'react';
import { WEEKDAY_LABELS } from '../lib/dates';
import { useVoiceSettings } from '../hooks/useVoiceSettings';
import { COLOR_DOT, COLOR_KEYS, type ColorKey } from '../types';

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

/** Edit a recurring work shift (times + notes) for a given weekday. */
export default function WorkShiftDialog({ dow, onClose }: { dow: number; onClose: () => void }) {
  const { settings, setWorkShift, setShift, toggleWorkDay } = useVoiceSettings();
  const shift = settings.shifts[dow] ?? { start: '09:00', end: '17:00' };

  const [start, setStart] = useState(shift.start);
  const [end, setEnd] = useState(shift.end);
  const [notes, setNotes] = useState(shift.notes ?? '');
  const [color, setColor] = useState<ColorKey>(shift.color ?? 'gray');

  function save() {
    setWorkShift(dow, start, end);
    setShift(dow, { notes: notes.trim() ? notes : undefined, color });
    onClose();
  }

  function remove() {
    if (settings.workDays.includes(dow)) toggleWorkDay(dow);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-bold tracking-tight">Edit work shift</h2>
        <p className="mb-4 text-xs text-gray-400">
          {WEEKDAY_LABELS[dow]} — repeats every week. Manage all work days in Settings.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Start time</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">End time</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={key}
                  aria-pressed={color === key}
                  className={[
                    'h-7 w-7 rounded-full transition-transform',
                    COLOR_DOT[key],
                    color === key
                      ? 'ring-2 ring-gray-800 ring-offset-2 dark:ring-gray-200 dark:ring-offset-gray-900'
                      : 'hover:scale-110',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes…"
              className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Remove shift
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
