import { useEffect, useState } from 'react';
import { COLOR_STYLES, type Task } from '../../types';
import { isToday, parseISO } from '../../lib/dates';
import { listDate } from '../../lib/taskOrder';
import { titleCase } from '../../lib/text';
import { useApp } from '../../context/AppContext';
import { useVoiceSettings } from '../../hooks/useVoiceSettings';
import WorkShiftDialog from '../WorkShiftDialog';
import { ScheduleCard } from './ScheduleParts';

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 24;
const HOUR_PX = 52;

interface Props {
  tasks: Task[];
  anchor: string;
  onUpdate: (id: string, patch: Partial<Task>) => void;
}

/** "HH:MM" → minutes since midnight. */
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight → "9:00 AM". */
function fmt(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface Block {
  id: string;
  startMin: number;
  endMin: number; // clamped to <= 24:00 for layout
  label: string;
  sub: string;
  kind: 'work' | 'event';
  className: string;
  onClick?: () => void;
}

export default function ScheduleView({ tasks, anchor, onUpdate }: Props) {
  const { categories, openEditTask } = useApp();
  const { settings } = useVoiceSettings();
  const [editWorkDow, setEditWorkDow] = useState<number | null>(null);

  // Re-render the "now" line every minute when viewing today.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isToday(anchor)) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [anchor]);

  const dayTasks = tasks.filter((t) => listDate(t) === anchor);
  const timed = dayTasks.filter((t) => t.start_time && t.end_time);
  const untimed = dayTasks.filter((t) => !(t.start_time && t.end_time));

  const dow = parseISO(anchor).getDay();
  const workCfg = settings.workDays.includes(dow) ? settings.shifts[dow] : undefined;

  // --- assemble blocks ------------------------------------------------------
  const blocks: Block[] = [];

  if (workCfg) {
    const s = toMin(workCfg.start);
    let e = toMin(workCfg.end);
    const overnight = e <= s;
    if (overnight) e = 24 * 60; // clamp the visible portion to end of day
    blocks.push({
      id: 'work',
      startMin: s,
      endMin: e,
      label: 'Work',
      sub: `${fmt(toMin(workCfg.start))} – ${fmt(toMin(workCfg.end))}${overnight ? ' (overnight)' : ''}`,
      kind: 'work',
      className: COLOR_STYLES[workCfg.color ?? 'gray'],
    });
  }

  for (const t of timed) {
    const s = toMin(t.start_time!);
    let e = toMin(t.end_time!);
    if (e <= s) e = 24 * 60;
    blocks.push({
      id: t.id,
      startMin: s,
      endMin: e,
      label: titleCase(t.text),
      sub: `${fmt(toMin(t.start_time!))} – ${fmt(toMin(t.end_time!))}`,
      kind: 'event',
      className: categories.colorFor(t.category),
      onClick: () => openEditTask(t),
    });
  }

  // --- visible window (expand to fit anything outside the default) ----------
  const startHour = blocks.length
    ? Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...blocks.map((b) => b.startMin)) / 60))
    : DEFAULT_START_HOUR;
  const endHour = blocks.length
    ? Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...blocks.map((b) => b.endMin)) / 60))
    : DEFAULT_END_HOUR;
  const winStart = startHour * 60;
  const totalH = (endHour - startHour) * HOUR_PX;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const topFor = (min: number) => ((min - winStart) / 60) * HOUR_PX;

  // --- column layout for overlapping EVENT blocks ---------------------------
  const events = blocks.filter((b) => b.kind === 'event').sort((a, b) => a.startMin - b.startMin);
  const colOf = new Map<string, number>();
  const colEnds: number[] = []; // last endMin per column
  for (const ev of events) {
    let col = colEnds.findIndex((end) => end <= ev.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(ev.endMin);
    } else {
      colEnds[col] = ev.endMin;
    }
    colOf.set(ev.id, col);
  }
  const colCount = Math.max(1, colEnds.length);

  const nowMin = isToday(anchor) ? (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })() : null;
  const nowVisible = nowMin != null && nowMin >= winStart && nowMin <= endHour * 60;

  return (
    <div>
      {blocks.length === 0 && (
        <p className="mb-3 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-center text-xs text-gray-400 dark:border-gray-800">
          No timed events or work shift today. Say or add a time on a task to see it here.
        </p>
      )}

      {/* Timeline grid */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex">
          {/* hour gutter */}
          <div className="relative w-16 shrink-0" style={{ height: totalH }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-gray-400"
                style={{ top: topFor(h * 60) }}
              >
                {fmt((h % 24) * 60).replace(':00', '')}
              </div>
            ))}
          </div>

          {/* track */}
          <div className="relative flex-1 border-l border-gray-200 dark:border-gray-800" style={{ height: totalH }}>
            {/* hour gridlines */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-gray-100 dark:border-gray-800/80"
                style={{ top: topFor(h * 60) }}
              />
            ))}

            {/* work block (full width, behind events) */}
            {blocks
              .filter((b) => b.kind === 'work')
              .map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setEditWorkDow(parseISO(anchor).getDay())}
                  className={`absolute inset-x-1.5 z-0 overflow-hidden rounded-lg border px-2 py-1 text-left transition-shadow hover:shadow ${b.className}`}
                  style={{ top: topFor(b.startMin) + 1, height: Math.max(22, topFor(b.endMin) - topFor(b.startMin) - 2) }}
                  title="Edit work shift"
                >
                  <p className="text-xs font-semibold leading-tight">{b.label}</p>
                  <p className="text-[10px] opacity-80">{b.sub}</p>
                  {workCfg?.notes && (
                    <p className="truncate text-[10px] opacity-70">{workCfg.notes}</p>
                  )}
                </button>
              ))}

            {/* event blocks (columns, on top) */}
            {events.map((b) => {
              const col = colOf.get(b.id) ?? 0;
              const widthPct = 100 / colCount;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={b.onClick}
                  className={`absolute z-10 overflow-hidden rounded-lg border px-2 py-1 text-left shadow-sm transition-shadow hover:shadow ${b.className}`}
                  style={{
                    top: topFor(b.startMin) + 1,
                    height: Math.max(22, topFor(b.endMin) - topFor(b.startMin) - 2),
                    left: `calc(${col * widthPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                  }}
                  title={`${b.label} · ${b.sub}`}
                >
                  <p className="truncate text-xs font-semibold leading-tight">{b.label}</p>
                  <p className="truncate text-[10px] opacity-80">{b.sub}</p>
                </button>
              );
            })}

            {/* now line */}
            {nowVisible && (
              <div className="absolute inset-x-0 z-20" style={{ top: topFor(nowMin!) }}>
                <div className="relative">
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  <div className="border-t border-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Untimed tasks for the day */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Untimed tasks
        </p>
        {untimed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-800">
            Nothing untimed for this day.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {untimed.map((t) => (
              <ScheduleCard key={t.id} task={t} onToggle={(id, done) => onUpdate(id, { done })} showSubtasks />
            ))}
          </div>
        )}
      </div>

      {editWorkDow != null && (
        <WorkShiftDialog dow={editWorkDow} onClose={() => setEditWorkDow(null)} />
      )}
    </div>
  );
}
