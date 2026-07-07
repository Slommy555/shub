import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { useCategories } from '../../hooks/useCategories';
import { useTheme } from '../../lib/theme';
import type { Task } from '../../lib/types';
import { buildDaySections } from '../../lib/taskOrder';
import { TaskCard } from '../../components/tasks/TaskCard';
import { AddTaskModal } from '../../components/tasks/AddTaskModal';
import { EditTaskModal } from '../../components/tasks/EditTaskModal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PillRow, SectionHeader, SPACE } from '../../components/ui/kit';
import { DraggableFab } from '../../components/ui/DraggableFab';

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

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (filter === 'active' && t.done) return false;
      if (filter === 'done' && !t.done) return false;
      if (filter === 'high' && t.priority !== 'high') return false;
      if (q && !t.text.toLowerCase().includes(q)) return false;
      return true;
    });
    return buildDaySections(filtered);
  }, [tasks, filter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isFiltered = !!search || filter !== 'all';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.xs }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
          Tasks
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACE.sm,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: SPACE.md,
            marginTop: SPACE.md,
          }}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks"
            placeholderTextColor={colors.textTertiary}
            style={{ flex: 1, color: colors.text, paddingVertical: 10 }}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginTop: SPACE.md }}>
          <PillRow options={FILTERS} value={filter} onChange={setFilter} />
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}>
          <SkeletonList />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.md,
            paddingBottom: 120,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ marginTop: SPACE.lg, marginBottom: SPACE.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <SectionHeader
                  label={section.title}
                  style={{
                    marginBottom: 0,
                    color: section.key === 'overdue' ? colors.danger : colors.muted,
                  }}
                />
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{section.data.length}</Text>
              </View>
            </View>
          )}
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
                isFiltered ? 'No tasks match your filters.' : 'No tasks yet — add your first one'
              }
              actionLabel={isFiltered ? undefined : 'Add a task'}
              onAction={() => setAdding(true)}
            />
          }
        />
      )}

      <DraggableFab onPress={() => setAdding(true)} />

      <AddTaskModal
        visible={adding}
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
        onClose={() => setAdding(false)}
      />
      <EditTaskModal
        visible={!!editing}
        task={editing}
        categories={categories}
        onSave={(id, v) =>
          updateTask(id, {
            text: v.text,
            category: v.category,
            priority: v.priority,
            due_date: v.due_date,
            start_time: v.start_time,
            end_time: v.end_time,
          })
        }
        onClose={() => setEditing(null)}
      />
    </SafeAreaView>
  );
}
