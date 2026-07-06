import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { PRIORITY_HEX, type ColorKey, type Task } from '../../lib/types';
import { formatDue, isOverdue, isToday } from '../../lib/dates';
import { SubtaskList } from './SubtaskList';
import { Checkbox } from '../ui/kit';

export function TaskCard({
  task,
  categoryColor,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: {
  task: Task;
  categoryColor: ColorKey;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}) {
  const { colors, tint } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const badge = tint(categoryColor);

  const confirmDelete = () => {
    Alert.alert('Delete task', 'Delete this task? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(task.id) },
    ]);
  };

  const toggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(task.id);
  };

  const dueColor = isOverdue(task.due_date)
    ? colors.danger
    : isToday(task.due_date)
    ? colors.warning
    : colors.muted;

  const renderRightActions = () => (
    <Pressable
      onPress={confirmDelete}
      style={{
        backgroundColor: colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        width: 88,
        marginBottom: 10,
        borderRadius: 16,
      }}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '600', marginTop: 4 }}>Delete</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        onLongPress={() => onEdit(task)}
        delayLongPress={300}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          marginBottom: 10,
          overflow: 'hidden',
          flexDirection: 'row',
          opacity: task.done ? 0.45 : 1,
        }}
      >
        {/* Priority strip — subtler than a full badge (UI_SKILL Task Card). */}
        <View
          style={{
            width: 3,
            backgroundColor: task.done ? colors.surfaceAlt : PRIORITY_HEX[task.priority],
          }}
        />
        <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ marginTop: 1 }}>
            <Checkbox checked={task.done} onToggle={toggle} size={24} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '500',
                color: task.done ? colors.muted : colors.text,
                textDecorationLine: task.done ? 'line-through' : 'none',
              }}
            >
              {task.text}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_HEX[task.priority] }} />
              <View style={{ backgroundColor: badge.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: badge.text, fontSize: 12, fontWeight: '600' }}>{task.category}</Text>
              </View>
              {task.due_date ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="calendar-outline" size={13} color={dueColor} />
                  <Text style={{ color: dueColor, fontSize: 12, fontWeight: '600' }}>
                    {formatDue(task.due_date)}
                  </Text>
                </View>
              ) : null}
              {task.subtasks.length > 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </Text>
              ) : null}
            </View>
          </View>

          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </View>

        {expanded ? (
          <View style={{ marginTop: 10, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 10 }}>
            {task.notes ? (
              <Text style={{ color: colors.muted, marginBottom: 6 }}>{task.notes}</Text>
            ) : null}
            <SubtaskList
              subtasks={task.subtasks}
              onToggle={onToggleSubtask}
              onAdd={(text) => onAddSubtask(task.id, text)}
              onDelete={onDeleteSubtask}
            />
          </View>
        ) : null}
        </View>
      </Pressable>
    </Swipeable>
  );
}
