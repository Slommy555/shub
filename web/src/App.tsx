import { useEffect, useState } from 'react';

import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useAppearance } from './hooks/useAppearance';
import { useAccent } from './hooks/useAccent';
import { useWorkoutPrefs } from './hooks/workout/useWorkoutPrefs';
import { useWorkScheduleSync } from './hooks/useWorkScheduleSync';
import { useTasks } from './hooks/useTasks';
import { useCategories } from './hooks/useCategories';
import { useReminders } from './hooks/useReminders';
import { useTaskClipboard } from './hooks/useTaskClipboard';
import { useIsMobile } from './hooks/useIsMobile';
import { useSwipeNav } from './hooks/useSwipeNav';
import { listDate } from './lib/taskOrder';
import { AppProvider } from './context/AppContext';
import type { Task } from './types';

import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import MobileDock from './components/MobileDock';
import { TAB_IDS, type Tab } from './components/nav/tabs';
import TodoView from './components/todo/TodoView';
import VoiceTab from './components/VoiceTab';
import VoiceController from './components/voice/VoiceController';
import WorkoutTab from './components/workout/WorkoutTab';
import BudgetTab from './components/budget/BudgetTab';
import ProductivityView from './components/ProductivityView';
import NotesTab from './components/notes/NotesTab';
import SettingsView from './components/SettingsView';
import DueDateReminder from './components/DueDateReminder';
import EditTaskDialog from './components/EditTaskDialog';

function Shell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('todo');
  const [editing, setEditing] = useState<Task | null>(null);
  const { resolvedTheme, toggleTheme } = useTheme(userId);
  const appearance = useAppearance(userId);
  const accent = useAccent(userId);
  const workoutPrefs = useWorkoutPrefs(userId);
  // Keep the recurring work schedule (localStorage) synced to Supabase so work
  // shifts configured on one device show up in the timeline on every device.
  useWorkScheduleSync(userId);
  const api = useTasks(userId);
  const categories = useCategories(userId);
  const clipboard = useTaskClipboard();
  const isMobile = useIsMobile();

  // Phones navigate by swiping the page left/right through the dock's tab order.
  const swipe = useSwipeNav({
    enabled: isMobile,
    index: TAB_IDS.indexOf(tab),
    count: TAB_IDS.length,
    onChange: (i) => setTab(TAB_IDS[i]),
  });
  const { dueTasks, upcomingEvents } = useReminders(api.tasks);

  // Clipboard actions. The hook owns the payload; creating/deleting rows stays
  // here where the task API lives.
  function pasteTask(day: string | null) {
    const res = clipboard.paste(day);
    if (!res) return;
    api.addTask(res.input);
    if (res.removeId) api.deleteTask(res.removeId);
  }

  function duplicateTask(task: Task, day?: string | null) {
    api.addTask({
      text: task.text,
      category: task.category,
      priority: task.priority,
      due_date: task.due_date,
      scheduled_date: day === undefined ? listDate(task) : day,
      start_time: task.start_time,
      end_time: task.end_time,
      recurrence: task.recurrence,
      subtasks: task.subtasks.map((s) => s.text),
    });
  }

  // Land at the top of whichever tab you just moved to (tap or swipe) instead of
  // inheriting the previous tab's scroll offset.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // Keep the open editor in sync with the latest task data (realtime edits).
  const editingTask = editing ? api.tasks.find((t) => t.id === editing.id) ?? editing : null;

  return (
    <AppProvider
      value={{
        categories,
        tasks: api.tasks,
        openEditTask: setEditing,
        addTask: api.addTask,
        addTasks: api.addTasks,
        updateTask: api.updateTask,
        deleteTask: api.deleteTask,
        reorderTasks: api.reorderTasks,
        hasClipboard: clipboard.hasCopy,
        copyTask: clipboard.copy,
        cutTask: clipboard.cut,
        duplicateTask,
        pasteTask,
        addSubtask: api.addSubtask,
        updateSubtask: api.updateSubtask,
        deleteSubtask: api.deleteSubtask,
      }}
    >
      <VoiceController userId={userId} onNavigate={setTab}>
        <div className="flex min-h-screen">
          <Sidebar active={tab} onSelect={setTab} />

          <main
            className="min-w-0 flex-1"
            ref={swipe.ref}
            {...swipe.handlers}
          >
            <div key={tab} className="animate-fade-in">
              {tab === 'todo' && <TodoView api={api} />}
              {tab === 'voice' && <VoiceTab />}
              {tab === 'workout' && <WorkoutTab userId={userId} showRpe={workoutPrefs.showRpe} />}
              {tab === 'budget' && <BudgetTab userId={userId} />}
              {tab === 'productivity' && <ProductivityView userId={userId} />}
              {tab === 'notes' && <NotesTab userId={userId} />}
              {tab === 'settings' && (
                <SettingsView
                  theme={resolvedTheme}
                  onToggleTheme={toggleTheme}
                  appearance={appearance}
                  accent={accent}
                  workoutPrefs={workoutPrefs}
                />
              )}
            </div>
          </main>

          <MobileDock active={tab} onSelect={setTab} />

          <DueDateReminder dueTasks={dueTasks} upcomingEvents={upcomingEvents} />

          {editingTask && <EditTaskDialog task={editingTask} onClose={() => setEditing(null)} />}
        </div>
      </VoiceController>
    </AppProvider>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <Shell userId={session.user.id} />;
}
