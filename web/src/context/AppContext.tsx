import { createContext, useContext } from 'react';
import type { Category, Priority, Recurrence, Task } from '../types';
import type { UseCategories } from '../hooks/useCategories';

export interface AppContextValue {
  categories: UseCategories;
  /** The live task list (used e.g. by voice input to balance workload). */
  tasks: Task[];
  /** Open the edit dialog for a task. */
  openEditTask: (task: Task) => void;
  addTask: (input: {
    text: string;
    category: Category;
    priority: Priority;
    due_date: string | null;
    notes?: string | null;
    scheduled_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    recurrence?: Recurrence | null;
    subtasks?: string[];
  }) => void;
  addTasks: (
    inputs: {
      text: string;
      category: Category;
      priority: Priority;
      due_date: string | null;
      scheduled_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      recurrence?: Recurrence | null;
      subtasks?: string[];
    }[]
  ) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  /** Persist a new order for the whole task list (drag-to-reorder). */
  reorderTasks: (ordered: Task[]) => void;
  /** True when a task is sitting on the app clipboard, ready to paste. */
  hasClipboard: boolean;
  copyTask: (task: Task) => void;
  cutTask: (task: Task) => void;
  /** Copy a task and immediately paste it onto `day` (defaults to its own day). */
  duplicateTask: (task: Task, day?: string | null) => void;
  /** Paste the clipboard task onto `day` (null = unscheduled). */
  pasteTask: (day: string | null) => void;
  addSubtask: (taskId: string, text: string) => void;
  updateSubtask: (id: string, patch: { text?: string; done?: boolean }) => void;
  deleteSubtask: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = AppContext.Provider;

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
