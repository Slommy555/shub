import { useState } from 'react';

import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useAppearance } from './hooks/useAppearance';
import { useTasks } from './hooks/useTasks';
import { useCategories } from './hooks/useCategories';
import { useReminders } from './hooks/useReminders';
import { useScheduledReminders } from './hooks/useScheduledReminders';
import { AppProvider } from './context/AppContext';
import type { Task } from './types';

import LoginScreen from './components/LoginScreen';
import Sidebar, { type Tab } from './components/Sidebar';
import TodoView from './components/todo/TodoView';
import VoiceTab from './components/VoiceTab';
import VoiceController from './components/voice/VoiceController';
import WorkoutTab from './components/workout/WorkoutTab';
import ProductivityView from './components/ProductivityView';
import RemindersView from './components/reminders/RemindersView';
import SettingsView from './components/SettingsView';
import DueDateReminder from './components/DueDateReminder';
import EditTaskDialog from './components/EditTaskDialog';

function Shell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('todo');
  const [editing, setEditing] = useState<Task | null>(null);
  const { resolvedTheme, toggleTheme } = useTheme(userId);
  const appearance = useAppearance(userId);
  const api = useTasks(userId);
  const categories = useCategories(userId);
  const { dueTasks, upcomingEvents, permission, requestPermission } = useReminders(api.tasks);
  // Instantiated here (not in the page) so reminders fire on any tab.
  const reminders = useScheduledReminders(userId);

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
        addSubtask: api.addSubtask,
        updateSubtask: api.updateSubtask,
        deleteSubtask: api.deleteSubtask,
      }}
    >
      <VoiceController userId={userId} onNavigate={setTab}>
        <div className="flex min-h-screen">
          <Sidebar active={tab} onSelect={setTab} />

          <main className="min-w-0 flex-1">
            {tab === 'todo' && <TodoView api={api} />}
            {tab === 'voice' && <VoiceTab />}
            {tab === 'workout' && <WorkoutTab userId={userId} />}
            {tab === 'productivity' && <ProductivityView userId={userId} />}
            {tab === 'reminders' && <RemindersView api={reminders} />}
            {tab === 'settings' && (
              <SettingsView theme={resolvedTheme} onToggleTheme={toggleTheme} appearance={appearance} />
            )}
          </main>

          <DueDateReminder
            dueTasks={dueTasks}
            upcomingEvents={upcomingEvents}
            permission={permission}
            onRequestPermission={requestPermission}
          />

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
