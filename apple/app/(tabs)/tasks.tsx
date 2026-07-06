import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { useCategories } from '../../hooks/useCategories';
import { useTheme } from '../../lib/theme';
import type { Task } from '../../lib/types';
import { TaskCard } from '../../components/tasks/TaskCard';
import { AddTaskModal } from '../../components/tasks/AddTaskModal';
import { EditTaskModal } from '../../components/tasks/EditTaskModal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Fab } from '../../components/ui/kit';

type Filter = 'all' | 'active' | 'done' | 'high';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
  { key: 'high', label: 'High Priority' },
];

export default function TasksScreen() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const { colors } = useTheme();
  const {
    tasks,
    loading,
    refetch,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useTasks(userId);
  const { categories, colorForCategory } = useCategories(userId);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === 'active' && t.done) return false;
      if (filter === 'done' && !t.done) return false;
      if (filter === 'high' && t.priority !== 'high') return false;
      if (q && !t.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, filter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
          Tasks
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            marginTop: 12,
          }}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.text, paddingVertical: 10 }}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                }}
              >
                <Text style={{ color: active ? colors.accentText : colors.muted, fontSize: 13, fontWeight: '600' }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonList />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              categoryColor={colorForCategory(item.category)}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onEdit={setEditing}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="🗒️"
              title={
                search || filter !== 'all'
                  ? 'No tasks match your filters.'
                  : 'No tasks yet — add your first one'
              }
              actionLabel={search || filter !== 'all' ? undefined : 'Add a task'}
              onAction={() => setAdding(true)}
            />
          }
        />
      )}

      <Fab onPress={() => setAdding(true)} />

      <AddTaskModal
        visible={adding}
        categories={categories}
        onAdd={(v) => addTask({ text: v.text, category: v.category, priority: v.priority, due_date: v.due_date })}
        onClose={() => setAdding(false)}
      />
      <EditTaskModal
        visible={!!editing}
        task={editing}
        categories={categories}
        onSave={(id, v) =>
          updateTask(id, { text: v.text, category: v.category, priority: v.priority, due_date: v.due_date })
        }
        onClose={() => setEditing(null)}
      />
    </SafeAreaView>
  );
}
