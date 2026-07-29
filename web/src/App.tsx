import { useEffect, useState } from 'react';

import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useAppearance } from './hooks/useAppearance';
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
import DailyBriefModal from './components/DailyBriefModal';
import { useDailyBriefs } from './hooks/useDailyBriefs';

function Shell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('todo');
  const [editing, setEditing] = useState<Task | null>(null);
  const [briefText, setBriefText] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const { latest: latestBrief } = useDailyBriefs(userId);
  const { resolvedTheme, toggleTheme } = useTheme(userId);
  const appearance = useAppearance(userId);
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
  const { dueTasks, upcomingEvents, permission, requestPermission } = useReminders(api.tasks);

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

  // When the user taps a push notification, the service worker posts a message
  // to the page (see public/sw.js notificationclick handler). A daily-brief tap
  // opens the brief modal; a message carrying a `tab` navigates there.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.type !== 'notification-click') return;
      const data = (msg.data ?? {}) as { tab?: string; type?: string; fullBrief?: string };
      if (data.type === 'daily_brief') {
        setBriefText(data.fullBrief ?? latestBrief);
        setBriefOpen(true);
      }
      if (data.tab) setTab(data.tab as Tab);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [latestBrief]);

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

          {/* Daily-brief bell (top-right). Opens the most recent brief. */}
          <button
            type="button"
            onClick={() => {
              setBriefText(latestBrief);
              setBriefOpen(true);
            }}
            aria-label="Daily brief"
            className="glass fixed right-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-full border text-gray-600 shadow-card transition-transform active:scale-95 dark:text-gray-300"
            style={{ marginRight: 'env(safe-area-inset-right)', marginTop: 'env(safe-area-inset-top)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {latestBrief && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white/70 dark:ring-gray-900/70" />
            )}
          </button>

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
                  workoutPrefs={workoutPrefs}
                />
              )}
            </div>
          </main>

          <MobileDock active={tab} onSelect={setTab} />

          <DueDateReminder
            dueTasks={dueTasks}
            upcomingEvents={upcomingEvents}
            permission={permission}
            onRequestPermission={requestPermission}
          />

          {editingTask && <EditTaskDialog task={editingTask} onClose={() => setEditing(null)} />}

          {briefOpen && (
            <DailyBriefModal brief={briefText} onClose={() => setBriefOpen(false)} />
          )}
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
