import { formatDayLong, todayISO } from '../../lib/dates';
import type { Task } from '../../types';
import type { Tab } from '../nav/tabs';
import ProgramCard from './ProgramCard';
import HabitsCard from './HabitsCard';
import TasksCard from './TasksCard';
import EventsCard, { todaysEvents } from './EventsCard';
import WeightCard from './WeightCard';
import BudgetCard from './BudgetCard';

/** The name the greeting uses. */
const USER_NAME = 'Brandon';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The Home tab: one scrollable page of cards, each fetching its own data so
 * they load in parallel behind their own skeletons. It carries no state of its
 * own — App keys every tab by id, so returning here remounts and refetches.
 *
 * Habits and tasks are checkable in place and write to the same tables (and, for
 * tasks, the very same `useTasks` instance) as their dedicated tabs.
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
  const events = todaysEvents(tasks);
  const openTasks = () => onNavigate('todo');

  // Budget closes out the grid, so its span is whatever squares off the last
  // row — which depends on whether the Schedule card is showing.
  //   with events (6 tiles): P H / T W / E B    and   P H T / W E B
  //   without      (5 tiles): P H / T W / B B    and   P H T / W B B
  const budgetSpan = events.length > 0 ? '' : 'sm:col-span-2';

  return (
    <div
      className="ui-scope flex min-h-screen flex-col"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div className="pb-fab mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        <h1
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
        >
          {greeting()}, {USER_NAME}
        </h1>
        <p className="mb-5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          {formatDayLong(todayISO())}
        </p>

        {/*
          One tile per cell, 1 → 2 → 3 columns. `minmax(min-content, 1fr)` rows
          never squash a tile below its content but do share out any leftover
          height, so the grid fills the screen on a short page and simply scrolls
          on a long one — on phones as well as desktop.
        */}
        <div
          className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          style={{ gridAutoRows: 'minmax(min-content, 1fr)' }}
        >
          <ProgramCard userId={userId} onOpenWorkout={() => onNavigate('workout')} />
          <HabitsCard userId={userId} />
          <TasksCard tasks={tasks} onToggle={onToggleTask} onOpenTasks={openTasks} />
          <WeightCard userId={userId} />
          {events.length > 0 && <EventsCard events={events} onOpenTasks={openTasks} />}
          <BudgetCard
            userId={userId}
            onOpenBudget={() => onNavigate('budget')}
            className={budgetSpan}
          />
        </div>
      </div>
    </div>
  );
}
