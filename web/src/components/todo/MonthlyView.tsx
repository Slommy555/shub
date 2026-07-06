import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Task } from '../../types';
import {
  dayOfMonth,
  isSameMonth,
  isToday,
  monthMatrix,
  WEEKDAY_LABELS,
} from '../../lib/dates';
import { groupByDay } from '../../lib/taskOrder';
import { Droppable, ScheduleCard } from './ScheduleParts';

interface Props {
  tasks: Task[];
  anchor: string;
  onMove: (id: string, due: string | null) => void;
  onToggle: (id: string, done: boolean) => void;
}

export default function MonthlyView({ tasks, anchor, onMove, onToggle }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const weeks = monthMatrix(anchor);
  const byDay = groupByDay(tasks);
  const active = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function handleEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('day:')) return;
    const due = overId.slice(4);
    const task = tasks.find((t) => t.id === String(active.id));
    if (task && (task.due_date ?? null) !== due) onMove(String(active.id), due);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-gray-50 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:bg-gray-950"
          >
            {label}
          </div>
        ))}

        {weeks.flat().map((iso) => {
          const inMonth = isSameMonth(iso, anchor);
          const today = isToday(iso);
          const dayTasks = byDay.get(iso) ?? [];
          return (
            <Droppable
              key={iso}
              id={`day:${iso}`}
              className={[
                'flex min-h-[6.5rem] flex-col gap-1 p-1 transition-colors',
                inMonth ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/60 dark:bg-gray-950/60',
              ].join(' ')}
              overClassName="!bg-gray-100 dark:!bg-gray-500/10"
            >
              <span
                className={[
                  'ml-auto grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-[11px] font-semibold',
                  today
                    ? 'bg-gray-800 text-white'
                    : inMonth
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-300 dark:text-gray-600',
                ].join(' ')}
              >
                {dayOfMonth(iso)}
              </span>
              <div className="flex flex-col gap-1">
                {dayTasks.map((t) => (
                  <ScheduleCard key={t.id} task={t} onToggle={onToggle} />
                ))}
              </div>
            </Droppable>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? <ScheduleCard task={active} onToggle={onToggle} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
