import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { useCategories } from '../../hooks/useCategories';
import { useTheme } from '../../lib/theme';
import type { Task } from '../../lib/types';
import { listDate } from '../../lib/taskOrder';
import { todayISO, toISODate, parseISO } from '../../lib/dates';
import { TaskCard } from '../../components/tasks/TaskCard';
import { EditTaskModal } from '../../components/tasks/EditTaskModal';
import { Card, SectionHeader, SPACE, RADIUS } from '../../components/ui/kit';

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_PX = 52;
const PAD_Y = 14;

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

interface Block {
  id: string;
  startMin: number;
  endMin: number;
  label: string;
  sub: string;
  task: Task;
}

export default function ScheduleScreen() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const { colors, tint } = useTheme();
  const { tasks, updateTask, toggleTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask } =
    useTasks(userId);
  const { categories, colorForCategory } = useCategories(userId);

  const [anchor, setAnchor] = useState(todayISO());
  const [editing, setEditing] = useState<Task | null>(null);
  const [trackW, setTrackW] = useState(0);

  // Re-render the "now" line each minute when viewing today.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (anchor !== todayISO()) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [anchor]);

  const dayTasks = useMemo(() => tasks.filter((t) => listDate(t) === anchor), [tasks, anchor]);
  const timed = dayTasks.filter((t) => t.start_time && t.end_time);
  const untimed = dayTasks.filter((t) => !(t.start_time && t.end_time));

  const blocks: Block[] = timed.map((t) => {
    const s = toMin(t.start_time!);
    let e = toMin(t.end_time!);
    if (e <= s) e = 24 * 60;
    return {
      id: t.id,
      startMin: s,
      endMin: e,
      label: t.text,
      sub: `${fmt(toMin(t.start_time!))} – ${fmt(toMin(t.end_time!))}`,
      task: t,
    };
  });

  // Expand the visible window to fit anything outside 6am–midnight.
  const startHour = blocks.length
    ? Math.min(START_HOUR, Math.floor(Math.min(...blocks.map((b) => b.startMin)) / 60))
    : START_HOUR;
  const endHour = blocks.length
    ? Math.max(END_HOUR, Math.ceil(Math.max(...blocks.map((b) => b.endMin)) / 60))
    : END_HOUR;
  const winStart = startHour * 60;
  const trackH = (endHour - startHour) * HOUR_PX + PAD_Y * 2;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const topFor = (min: number) => ((min - winStart) / 60) * HOUR_PX + PAD_Y;

  // Column layout for overlapping blocks.
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
  const colOf = new Map<string, number>();
  const colEnds: number[] = [];
  for (const ev of sorted) {
    let col = colEnds.findIndex((end) => end <= ev.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(ev.endMin);
    } else {
      colEnds[col] = ev.endMin;
    }
    colOf.set(ev.id, col);
  }
  const colCount = Math.max(1, colEnds.length);

  const nowMin =
    anchor === todayISO() ? new Date().getHours() * 60 + new Date().getMinutes() : null;
  const nowVisible = nowMin != null && nowMin >= winStart && nowMin <= endHour * 60;

  const shiftDay = (delta: number) => {
    const d = parseISO(anchor);
    d.setDate(d.getDate() + delta);
    setAnchor(toISODate(d));
  };

  const dayLabel = parseISO(anchor).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const isToday = anchor === todayISO();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header + date nav */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.md }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
          Schedule
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => shiftDay(-1)} hitSlop={8} style={navBtn(colors)}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setAnchor(todayISO())}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{dayLabel}</Text>
            {!isToday ? (
              <Text style={{ color: colors.accent, fontSize: 12, textAlign: 'center', marginTop: 2 }}>
                Jump to today
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={() => shiftDay(1)} hitSlop={8} style={navBtn(colors)}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 120 }}>
        {/* Timeline */}
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', height: trackH }}>
            {/* hour gutter */}
            <View style={{ width: 56 }}>
              {hours.map((h) => (
                <Text
                  key={h}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: topFor(h * 60) - 7,
                    fontSize: 11,
                    fontWeight: '500',
                    color: colors.textTertiary,
                  }}
                >
                  {fmt((h % 24) * 60).replace(':00', '')}
                </Text>
              ))}
            </View>

            {/* track */}
            <View
              style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border }}
              onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            >
              {hours.map((h) => (
                <View
                  key={h}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: topFor(h * 60),
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                />
              ))}

              {trackW > 0 &&
                sorted.map((b) => {
                const col = colOf.get(b.id) ?? 0;
                const colW = trackW / colCount;
                const badge = tint(colorForCategory(b.task.category));
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setEditing(b.task)}
                    style={{
                      position: 'absolute',
                      top: topFor(b.startMin) + 1,
                      height: Math.max(24, topFor(b.endMin) - topFor(b.startMin) - 2),
                      left: col * colW,
                      width: colW,
                      paddingHorizontal: 4,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: badge.bg,
                        borderRadius: RADIUS.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <Text numberOfLines={1} style={{ color: badge.text, fontSize: 12, fontWeight: '600' }}>
                        {b.label}
                      </Text>
                      <Text numberOfLines={1} style={{ color: badge.text, fontSize: 10, opacity: 0.8 }}>
                        {b.sub}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* now line */}
              {nowVisible ? (
                <View style={{ position: 'absolute', left: 0, right: 0, top: topFor(nowMin!) }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: -3,
                      top: -3,
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: colors.danger,
                    }}
                  />
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.danger }} />
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {blocks.length === 0 ? (
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 12,
              textAlign: 'center',
              marginTop: SPACE.md,
            }}
          >
            No timed tasks this day. Add start & end times to a task to see it here.
          </Text>
        ) : null}

        {/* Untimed */}
        <View style={{ marginTop: SPACE.xxl }}>
          <SectionHeader label="Untimed tasks" />
          {untimed.length === 0 ? (
            <Text style={{ color: colors.textTertiary, fontSize: 13, paddingVertical: SPACE.md }}>
              Nothing untimed for this day.
            </Text>
          ) : (
            untimed.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                categoryColor={colorForCategory(t.category)}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onEdit={setEditing}
                onAddSubtask={addSubtask}
                onToggleSubtask={toggleSubtask}
                onDeleteSubtask={deleteSubtask}
              />
            ))
          )}
        </View>
      </ScrollView>

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

const navBtn = (colors: { surfaceAlt: string; border: string }) => ({
  width: 40,
  height: 40,
  borderRadius: RADIUS.full,
  backgroundColor: colors.surfaceAlt,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});
