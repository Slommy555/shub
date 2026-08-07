import { formatDayLong, todayISO } from '../../lib/dates';
import type { Task } from '../../types';
import type { Tab } from '../nav/tabs';
import ProgramCard from './ProgramCard';
import HabitsCard from './HabitsCard';
import TasksCard from './TasksCard';
import EventsCard from './EventsCard';
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
  return (
    <div className="ui-scope min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
        <h1
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
        >
          {greeting()}, {USER_NAME}
        </h1>
        <p className="mb-5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          {formatDayLong(todayISO())}
        </p>

        {/* Mobile stacks; desktop pairs the columns and lets Budget span both. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <ProgramCard userId={userId} onOpenWorkout={() => onNavigate('workout')} />
            <EventsCard tasks={tasks} onOpenTasks={() => onNavigate('todo')} />
          </div>

          <div className="flex flex-col gap-4">
            <HabitsCard userId={userId} />
            <TasksCard
              tasks={tasks}
              onToggle={onToggleTask}
              onOpenTasks={() => onNavigate('todo')}
            />
          </div>

          <div className="lg:col-span-2">
            <BudgetCard userId={userId} onOpenBudget={() => onNavigate('budget')} />
          </div>
        </div>
      </div>
    </div>
  );
}
