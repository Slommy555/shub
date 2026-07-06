import { TaskFormSheet, type TaskFormValues } from './TaskFormSheet';
import type { CategoryRecord } from '../../lib/types';

export function AddTaskModal({
  visible,
  categories,
  onAdd,
  onClose,
}: {
  visible: boolean;
  categories: CategoryRecord[];
  onAdd: (values: TaskFormValues) => void;
  onClose: () => void;
}) {
  return (
    <TaskFormSheet
      visible={visible}
      title="New task"
      submitLabel="Add task"
      categories={categories}
      onSubmit={(v) => {
        onAdd(v);
        onClose();
      }}
      onClose={onClose}
    />
  );
}
