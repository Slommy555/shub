import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import type { Subtask } from '../../lib/types';

export function SubtaskList({
  subtasks,
  onToggle,
  onAdd,
  onDelete,
}: {
  subtasks: Subtask[];
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
  };

  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {subtasks.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => onToggle(s.id)} hitSlop={8}>
            <Ionicons
              name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={s.done ? colors.muted : colors.border}
            />
          </Pressable>
          <Text
            style={{
              flex: 1,
              color: s.done ? colors.muted : colors.text,
              textDecorationLine: s.done ? 'line-through' : 'none',
            }}
          >
            {s.text}
          </Text>
          <Pressable onPress={() => onDelete(s.id)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ))}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <Ionicons name="add" size={20} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="Add subtask"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={{ flex: 1, color: colors.text, paddingVertical: 4 }}
        />
      </View>
    </View>
  );
}
