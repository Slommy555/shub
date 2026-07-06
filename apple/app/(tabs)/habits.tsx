import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../hooks/useAuth';
import { useHabits } from '../../hooks/useHabits';
import { useTheme } from '../../lib/theme';
import { todayISO, formatToday } from '../../lib/dates';
import { HabitCard } from '../../components/habits/HabitCard';
import { AddHabitModal } from '../../components/habits/AddHabitModal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export default function HabitsScreen() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const { colors } = useTheme();
  const { habits, loading, refetch, isDone, addHabit, deleteHabit, updateHabit, toggleCompletion } =
    useHabits(userId);

  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const today = todayISO();

  const doneCount = useMemo(
    () => habits.filter((h) => isDone(h.id, today)).length,
    [habits, isDone, today]
  );
  const pct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800' }}>Habits</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>{formatToday()}</Text>
          </View>
          <Pressable
            onPress={() => setAdding(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.accent,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
            }}
          >
            <Ionicons name="add" size={18} color={colors.accentText} />
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Add</Text>
          </Pressable>
        </View>

        {habits.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>
                {doneCount} of {habits.length} complete
              </Text>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>{pct}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
            </View>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonList />
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
          }
          renderItem={({ item }) => (
            <HabitCard
              habit={item}
              done={isDone(item.id, today)}
              onToggle={(id) => toggleCompletion(id, today)}
              onDelete={deleteHabit}
              onRename={(id, name) => updateHabit(id, { name })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="🔁"
              title="No habits yet — start building your routine"
              actionLabel="Add a habit"
              onAction={() => setAdding(true)}
            />
          }
        />
      )}

      <AddHabitModal visible={adding} onAdd={addHabit} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}
