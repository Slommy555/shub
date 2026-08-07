import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { formatDayLong, todayISO } from '../../lib/dates';
import { useHomeLayout, type HomeCardId } from '../../hooks/useHomeLayout';
import type { Task } from '../../types';
import type { Tab } from '../nav/tabs';
import ProgramCard from './ProgramCard';
import HabitsCard from './HabitsCard';
import TasksCard from './TasksCard';
import EventsCard, { todaysEvents } from './EventsCard';
import WeightCard from './WeightCard';
import BudgetCard from './BudgetCard';
import SortableCard from './SortableCard';

/** The name the greeting uses. */
const USER_NAME = 'Brandon';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The span that squares off the grid's last row, so there's never a hole at the
 * bottom whatever order the widgets are in or how many are showing. Written as
 * whole class strings because Tailwind scans for literals.
 */
function trailingSpan(count: number): string {
  const two = count % 2 === 1 ? 'sm:col-span-2' : '';
  const three = count % 3 === 1 ? 'xl:col-span-3' : count % 3 === 2 ? 'xl:col-span-2' : '';
  return `${two} ${three}`.trim();
}

/**
 * The Home tab: one scrollable page of widgets, each fetching its own data so
 * they load in parallel behind their own skeletons. It carries no state of its
 * own beyond the rearrange toggle — App keys every tab by id, so returning here
 * remounts and refetches.
 *
 * Habits, tasks and weight are all editable in place and write to the same
 * tables (and, for tasks, the very same `useTasks` instance) as their own tabs.
 */
export default function HomeTab({
  userId,
  tasks,
  onToggleTask,
  onNavigate,
}: {
  userId: string;
  tasks: Task[];
  onToggleTask: (id: string, done: boolean) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const { order, save, reset } = useHomeLayout(userId);
  const [arranging, setArranging] = useState(false);

  const events = todaysEvents(tasks);
  const openTasks = () => onNavigate('todo');

  // A hold-then-drag threshold rather than an immediate one: on a phone a quick
  // swipe still scrolls the page, only a deliberate press picks a tile up.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    // Space to pick a tile up, arrows to move it — the tiles are focusable in
    // arrange mode, so this shouldn't be mouse-only.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const card: Record<HomeCardId, React.ReactNode> = {
    program: <ProgramCard userId={userId} onOpenWorkout={() => onNavigate('workout')} />,
    habits: <HabitsCard userId={userId} />,
    tasks: <TasksCard tasks={tasks} onToggle={onToggleTask} onOpenTasks={openTasks} />,
    weight: <WeightCard userId={userId} />,
    events: events.length > 0 ? <EventsCard events={events} onOpenTasks={openTasks} /> : null,
    budget: <BudgetCard userId={userId} onOpenBudget={() => onNavigate('budget')} />,
  };

  // The Schedule widget disappears on a day with no events; it keeps its slot in
  // the saved order, it just isn't laid out today.
  const visible = order.filter((id) => card[id] !== null);
  const lastId = visible[visible.length - 1];
  const spanOf = (id: HomeCardId) => (id === lastId ? trailingSpan(visible.length) : '');

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as HomeCardId);
    const to = order.indexOf(over.id as HomeCardId);
    if (from < 0 || to < 0) return;
    save(arrayMove(order, from, to));
  }

  const grid = (
    <div
      className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      style={{ gridAutoRows: 'minmax(min-content, 1fr)' }}
    >
      {visible.map((id) =>
        arranging ? (
          <SortableCard key={id} id={id} className={spanOf(id)}>
            {card[id]}
          </SortableCard>
        ) : (
          <div key={id} className={spanOf(id)}>
            {card[id]}
          </div>
        )
      )}
    </div>
  );

  return (
    <div
      className="ui-scope flex min-h-screen flex-col"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div className="pb-fab mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-xl font-bold"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
            >
              {greeting()}, {USER_NAME}
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              {arranging ? 'Drag the widgets into the order you want' : formatDayLong(todayISO())}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {arranging && (
              <button
                type="button"
                onClick={reset}
                className="rounded-full border px-3 text-[13px] font-medium active:opacity-70"
                style={{
                  height: 36,
                  borderColor: 'var(--color-border-strong)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setArranging((v) => !v)}
              aria-pressed={arranging}
              className="rounded-full px-4 text-[13px] font-semibold active:opacity-85"
              style={
                arranging
                  ? { height: 36, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }
                  : {
                      height: 36,
                      background: 'var(--color-bg-surface)',
                      color: 'var(--color-text-secondary)',
                    }
              }
            >
              {arranging ? 'Done' : 'Arrange'}
            </button>
          </div>
        </div>

        {/*
          One tile per cell, 1 → 2 → 3 columns. `minmax(min-content, 1fr)` rows
          never squash a tile below its content but do share out any leftover
          height, so the grid fills the screen on a short page and simply scrolls
          on a long one — on phones as well as desktop.
        */}
        {arranging ? (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={visible} strategy={rectSortingStrategy}>
              {grid}
            </SortableContext>
          </DndContext>
        ) : (
          grid
        )}
      </div>
    </div>
  );
}
