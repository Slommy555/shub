import { TaskFormSheet, type TaskFormValues } from './TaskFormSheet';
import type { CategoryRecord, Task } from '../../lib/types';

export function EditTaskModal({
  visible,
  task,
  categories,
  onSave,
  onClose,
}: {
  visible: boolean;
  task: Task | null;
  categories: CategoryRecord[];
  onSave: (id: string, values: TaskFormValues) => void;
  onClose: () => void;
}) {
  if (!task) return null;
  return (
    <TaskFormSheet
      visible={visible}
      title="Edit task"
      submitLabel="Save"
      categories={categories}
      initial={{
        text: task.text,
        category: task.category,
        priority: task.priority,
        due_date: task.due_date,
        start_time: task.start_time,
        end_time: task.end_time,
      }}
      onSubmit={(v) => {
        onSave(task.id, v);
        onClose();
      }}
      onClose={onClose}
    />
  );
}
