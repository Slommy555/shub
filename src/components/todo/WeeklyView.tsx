import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { COLOR_STYLES, type Task } from '../../types';
import {
  dayOfMonth,
  formatTime,
  isToday,
  mondayWeekDates,
  parseISO,
  weekdayShort,
} from '../../lib/dates';
import { groupByDay, listDate } from '../../lib/taskOrder';
import { titleCase } from '../../lib/text';
import { useApp } from '../../context/AppContext';
import { useVoiceSettings } from '../../hooks/useVoiceSettings';
import WorkShiftDialog from '../WorkShiftDialog';
import { Droppable, ScheduleCard } from './ScheduleParts';

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 24;
const HOUR_PX = 56;

interface Props {
  tasks: Task[];
  anchor: string;
  onMove: (id: string, due: string | null) => void;
  onToggle: (id: string, done: boolean) => void;
}

/** "HH:MM" → minutes since midnight. */
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface Ev {
  task: Task;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

/** Pack overlapping events into side-by-side columns within one day. */
function pack(tasks: Task[]): Ev[] {
  const sorted = tasks
    .map((task) => {
      const s = toMin(task.start_time!);
      let e = toMin(task.end_time!);
      if (e <= s) e = 24 * 60;
      return { task, startMin: s, endMin: e };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const colEnds: number[] = [];
  const colOf = new Map<string, number>();
  for (const ev of sorted) {
    let col = colEnds.findIndex((end) => end <= ev.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(ev.endMin);
    } else {
      colEnds[col] = ev.endMin;
    }
    colOf.set(ev.task.id, col);
  }
  const cols = Math.max(1, colEnds.length);
  return sorted.map((ev) => ({ ...ev, col: colOf.get(ev.task.id)!, cols }));
}

/** A timed task rendered as a positioned, draggable block in the timeline. */
function TimedBlock({
  ev,
  top,
  height,
  className,
  onClick,
}: {
  ev: Ev;
  top: number;
  height: number;
  className: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ev.task.id });
  const widthPct = 100 / ev.cols;
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...listeners}
      {...attributes}
      className={`absolute z-10 overflow-hidden rounded-md border px-1 py-0.5 text-left shadow-sm transition-shadow hover:shadow ${className} ${
        isDragging ? 'opacity-30' : ''
      } ${ev.task.done ? 'opacity-50' : ''}`}
      style={{
        top,
        height,
        left: `calc(${ev.col * widthPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
      }}
      title={`${titleCase(ev.task.text)} · ${formatTime(ev.task.start_time!)} – ${formatTime(ev.task.end_time!)}`}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">{titleCase(ev.task.text)}</p>
      {height > 28 && (
        <p className="truncate text-[9px] opacity-80">
          {formatTime(ev.task.start_time!)} – {formatTime(ev.task.end_time!)}
        </p>
      )}
    </button>
  );
}

export default function WeeklyView({ tasks, anchor, onMove, onToggle }: Props) {
  const { categories, openEditTask } = useApp();
  const { settings } = useVoiceSettings();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editWorkDow, setEditWorkDow] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Re-render the "now" line every minute when the current week is showing.
  const [, setTick] = useState(0);
  const days = mondayWeekDates(anchor);
  const showsToday = days.some(isToday);
  useEffect(() => {
    if (!showsToday) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [showsToday]);

  const byDay = groupByDay(tasks);
  const unscheduled = byDay.get('none') ?? [];
  const active = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  // Per-day split into timed (positioned) and untimed (chips below the grid).
  const perDay = days.map((iso) => {
    const all = byDay.get(iso) ?? [];
    const timed = all.filter((t) => t.start_time && t.end_time);
    const untimed = all.filter((t) => !(t.start_time && t.end_time));
    const dow = parseISO(iso).getDay();
    const shift = settings.workDays.includes(dow) ? settings.shifts[dow] : undefined;
    return { iso, events: pack(timed), untimed, shift };
  });

  // Visible hour window — expand to fit any event or shift outside the default.
  const allMins: number[] = [];
  for (const d of perDay) {
    for (const ev of d.events) allMins.push(ev.startMin, ev.endMin);
    if (d.shift) {
      const s = toMin(d.shift.start);
      let e = toMin(d.shift.end);
      if (e <= s) e = 24 * 60;
      allMins.push(s, e);
    }
  }
  const startHour = allMins.length
    ? Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...allMins) / 60))
    : DEFAULT_START_HOUR;
  const endHour = allMins.length
    ? Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...allMins) / 60))
    : DEFAULT_END_HOUR;
  const winStart = startHour * 60;
  const totalH = (endHour - startHour) * HOUR_PX;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const topFor = (min: number) => ((min - winStart) / 60) * HOUR_PX;

  const nowMin = showsToday ? (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })() : null;
  const nowVisible = nowMin != null && nowMin >= winStart && nowMin <= endHour * 60;

  function handleEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active: a, over } = e;
    if (!over) return;
    const overId = String(over.id);
    let target: string | null;
    if (overId.startsWith('track:')) target = overId.slice(6);
    else if (overId.startsWith('any:')) target = overId.slice(4);
    else if (overId === 'day:none') target = null;
    else return;
    const task = tasks.find((t) => t.id === String(a.id));
    if (task && listDate(task) !== target) onMove(String(a.id), target);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Weekday header, aligned with the columns below. */}
      <div className="flex">
        <div className="w-12 shrink-0" />
        <div className="grid flex-1 grid-cols-7">
          {days.map((iso) => {
            const today = isToday(iso);
            return (
              <div key={iso} className="flex items-baseline justify-center gap-1 pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {weekdayShort(iso)}
                </span>
                <span
                  className={[
                    'grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-xs font-semibold',
                    today ? 'bg-gray-800 text-white' : 'text-gray-500 dark:text-gray-400',
                  ].join(' ')}
                >
                  {dayOfMonth(iso)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline grid: hour gutter + 7 day tracks. */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Anytime band: untimed tasks per day (drag between days). On top. */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <div className="grid w-12 shrink-0 place-items-center px-0.5 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-gray-400">
            Any time
          </div>
          <div className="grid flex-1 grid-cols-7">
            {perDay.map((d) => (
              <Droppable
                key={d.iso}
                id={`any:${d.iso}`}
                className="min-h-[3rem] border-l border-gray-200 p-1 transition-colors first:border-l-0 dark:border-gray-800"
                overClassName="bg-gray-100/70 dark:bg-gray-500/10"
              >
                <div className="flex flex-col gap-1">
                  {d.untimed.map((t) => (
                    <ScheduleCard key={t.id} task={t} onToggle={onToggle} />
                  ))}
                </div>
              </Droppable>
            ))}
          </div>
        </div>

        <div className="flex">
          {/* hour gutter */}
          <div className="relative w-12 shrink-0" style={{ height: totalH }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium text-gray-400"
                style={{ top: topFor(h * 60) }}
              >
                {formatTime(`${String(h % 24).padStart(2, '0')}:00`).replace(':00', '')}
              </div>
            ))}
          </div>

          {/* day tracks */}
          <div className="relative grid flex-1 grid-cols-7" style={{ height: totalH }}>
            {/* hour gridlines spanning all columns */}
            {hours.map((h) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 border-t border-gray-100 dark:border-gray-800/80"
                style={{ top: topFor(h * 60) }}
              />
            ))}

            {perDay.map((d) => (
              <Droppable
                key={d.iso}
                id={`track:${d.iso}`}
                className="relative border-l border-gray-200 transition-colors first:border-l-0 dark:border-gray-800"
                overClassName="bg-gray-100/70 dark:bg-gray-500/10"
              >
                {/* work shift (behind events) */}
                {d.shift && (() => {
                  const s = toMin(d.shift.start);
                  let e = toMin(d.shift.end);
                  if (e <= s) e = 24 * 60;
                  const h = Math.max(16, topFor(e) - topFor(s) - 2);
                  return (
                    <button
                      type="button"
                      onClick={() => setEditWorkDow(parseISO(d.iso).getDay())}
                      title={`Work · ${formatTime(d.shift.start)} – ${formatTime(d.shift.end)}`}
                      className={`absolute inset-x-0.5 z-0 overflow-hidden rounded-md border px-1 py-0.5 text-left transition-shadow hover:shadow ${COLOR_STYLES[d.shift.color ?? 'gray']}`}
                      style={{ top: topFor(s) + 1, height: h }}
                    >
                      <p className="truncate text-[10px] font-semibold leading-tight">Work</p>
                      {h > 28 && (
                        <p className="truncate text-[9px] leading-tight opacity-80">
                          {formatTime(d.shift.start)} – {formatTime(d.shift.end)}
                        </p>
                      )}
                      {d.shift.notes && h > 42 && (
                        <p className="truncate text-[9px] leading-tight opacity-70">
                          {d.shift.notes}
                        </p>
                      )}
                    </button>
                  );
                })()}

                {/* timed task blocks */}
                {d.events.map((ev) => (
                  <TimedBlock
                    key={ev.task.id}
                    ev={ev}
                    top={topFor(ev.startMin) + 1}
                    height={Math.max(16, topFor(ev.endMin) - topFor(ev.startMin) - 2)}
                    className={categories.colorFor(ev.task.category)}
                    onClick={() => openEditTask(ev.task)}
                  />
                ))}
              </Droppable>
            ))}

            {/* now line across the whole week */}
            {nowVisible && (
              <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: topFor(nowMin!) }}>
                <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                <div className="border-t border-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unscheduled — drag onto a day */}
      <Droppable
        id="day:none"
        className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-2 transition-colors dark:border-gray-700 dark:bg-gray-900/40"
        overClassName="border-gray-400 bg-gray-100/70 dark:bg-gray-500/10"
      >
        <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Unscheduled — drag onto a day
        </p>
        <div className="flex flex-wrap gap-1.5">
          {unscheduled.length === 0 ? (
            <span className="px-0.5 py-1 text-xs text-gray-400">Nothing here.</span>
          ) : (
            unscheduled.map((t) => (
              <div key={t.id} className="w-56 max-w-full">
                <ScheduleCard task={t} onToggle={onToggle} showSubtasks />
              </div>
            ))
          )}
        </div>
      </Droppable>

      <DragOverlay dropAnimation={null}>
        {active ? <ScheduleCard task={active} onToggle={onToggle} overlay /> : null}
      </DragOverlay>

      {editWorkDow != null && (
        <WorkShiftDialog dow={editWorkDow} onClose={() => setEditWorkDow(null)} />
      )}
    </DndContext>
  );
}
