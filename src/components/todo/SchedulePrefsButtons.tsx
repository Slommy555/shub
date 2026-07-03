import { useEffect, useRef, useState } from 'react';
import { useVoiceSettings } from '../../hooks/useVoiceSettings';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// On mobile the label text is hidden, leaving a compact ~32px icon button
// (Fix 4); desktop keeps the icon + label.
const triggerCls =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 sm:px-2.5 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';
const panelCls =
  'absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900';

/** A button that toggles a popover, closing on outside click or Escape. */
function PopoverButton({
  label,
  icon,
  tooltip,
  children,
}: {
  label: React.ReactNode;
  icon: React.ReactNode;
  /** Native tooltip / long-press label, so the icon-only mobile button is still
   *  discoverable. */
  tooltip: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={tooltip}
        title={tooltip}
        className={triggerCls}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && <div className={panelCls}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

/** "Days I work" button + popover: pick work days and their shift times. */
export function WorkDaysButton() {
  const { settings, toggleWorkDay, setShift } = useVoiceSettings();
  const count = settings.workDays.length;

  return (
    <PopoverButton
      tooltip="Work days"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      }
      label={<>Work days{count > 0 && <span className="text-gray-400"> · {count}</span>}</>}
    >
      {() => (
        <div>
          <p className="mb-2 text-sm font-medium">Days I work</p>
          <div className="flex gap-1">
            {WEEKDAYS.map((label, day) => {
              const active = settings.workDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWorkDay(day)}
                  aria-pressed={active}
                  className={[
                    'grid h-8 w-8 place-items-center rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                      : 'border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {settings.workDays.length > 0 ? (
            <div className="mt-3 space-y-2">
              {settings.workDays.map((day) => {
                const shift = settings.shifts[day] ?? { start: '09:00', end: '17:00' };
                const overnight = shift.end <= shift.start;
                return (
                  <div key={day} className="flex flex-wrap items-center gap-2">
                    <span className="w-9 text-xs font-medium text-gray-500">{WEEKDAY_LONG[day]}</span>
                    <input
                      type="time"
                      value={shift.start}
                      onChange={(e) => setShift(day, { start: e.target.value })}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                      type="time"
                      value={shift.end}
                      onChange={(e) => setShift(day, { end: e.target.value })}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                    />
                    {overnight && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-500/20 dark:text-gray-300">
                        overnight
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-400">
              Tap the days you work. Scheduling avoids these days when it can.
            </p>
          )}
        </div>
      )}
    </PopoverButton>
  );
}

/** "Sleep" button + popover: hours of sleep needed per day. */
export function SleepButton() {
  const { settings, setSleepHours } = useVoiceSettings();

  return (
    <PopoverButton
      tooltip="Sleep"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      }
      label={<>Sleep<span className="text-gray-400"> · {settings.sleepHours}h</span></>}
    >
      {() => (
        <div>
          <p className="mb-2 text-sm font-medium">Sleep needed</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={settings.sleepHours}
              onChange={(e) => setSleepHours(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <span className="text-sm text-gray-500">hours / day</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Subtracted from each day’s free time so days don’t get overscheduled — especially around overnight shifts.
          </p>
        </div>
      )}
    </PopoverButton>
  );
}
