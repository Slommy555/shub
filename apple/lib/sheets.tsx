import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAuthContext } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { useHabits } from '../hooks/useHabits';
import { useCategories } from '../hooks/useCategories';
import { AddTaskModal } from '../components/tasks/AddTaskModal';
import { AddHabitModal } from '../components/habits/AddHabitModal';
import { AddEventSheet } from '../components/schedule/AddEventSheet';
import { AddNoteSheet } from '../components/notes/AddNoteSheet';
import { StartWorkoutSheet } from '../components/workout/StartWorkoutSheet';
import { AddTransactionSheet } from '../components/budget/AddTransactionSheet';

export type SheetKind = 'task' | 'event' | 'habit' | 'note' | 'workout' | 'transaction';

interface SheetsState {
  openSheet: (kind: SheetKind) => void;
  closeSheet: () => void;
}

const SheetsContext = createContext<SheetsState | null>(null);

export function useSheets(): SheetsState {
  const ctx = useContext(SheetsContext);
  if (!ctx) throw new Error('useSheets must be used within a SheetsProvider');
  return ctx;
}

/**
 * Hosts every "add" sheet at the tab-group root so the single global FAB can
 * open the right one for the active tab. Adds go through root instances of the
 * data hooks, which realtime-sync into each tab screen's own instance. Since
 * the FAB is context-aware (only offers the current tab's action), you're always
 * already on the destination tab after a save.
 */
export function SheetsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const { addTask } = useTasks(userId);
  const { addHabit } = useHabits(userId);
  const { categories } = useCategories(userId);

  const [kind, setKind] = useState<SheetKind | null>(null);
  const close = () => setKind(null);

  const value = useMemo<SheetsState>(
    () => ({ openSheet: setKind, closeSheet: close }),
    []
  );

  return (
    <SheetsContext.Provider value={value}>
      {children}

      <AddTaskModal
        visible={kind === 'task'}
        categories={categories}
        onAdd={(v) =>
          addTask({
            text: v.text,
            category: v.category,
            priority: v.priority,
            due_date: v.due_date,
            start_time: v.start_time,
            end_time: v.end_time,
          })
        }
        onClose={close}
      />

      <AddEventSheet
        visible={kind === 'event'}
        onSubmit={(v) =>
          addTask({
            text: v.text,
            category: categories[0]?.name ?? 'other',
            priority: 'med',
            due_date: v.date,
            scheduled_date: v.date,
            start_time: v.start_time,
            end_time: v.end_time,
            notes: v.notes,
          })
        }
        onClose={close}
      />

      <AddHabitModal visible={kind === 'habit'} onAdd={addHabit} onClose={close} />
      <AddNoteSheet visible={kind === 'note'} onClose={close} />
      <StartWorkoutSheet visible={kind === 'workout'} onClose={close} />
      <AddTransactionSheet visible={kind === 'transaction'} onClose={close} />
    </SheetsContext.Provider>
  );
}
