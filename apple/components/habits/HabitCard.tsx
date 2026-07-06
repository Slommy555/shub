import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, COLOR_DOT_HEX } from '../../lib/theme';
import type { Habit } from '../../lib/types';
import { Checkbox } from '../ui/kit';

export function HabitCard({
  habit,
  done,
  onToggle,
  onDelete,
  onRename,
}: {
  habit: Habit;
  done: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const { colors } = useTheme();

  const toggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle(habit.id);
  };

  const confirmDelete = () => {
    Alert.alert('Delete habit', `Delete "${habit.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(habit.id) },
    ]);
  };

  const rename = () => {
    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Rename habit',
        undefined,
        (text) => {
          const trimmed = text?.trim();
          if (trimmed) onRename(habit.id, trimmed);
        },
        'plain-text',
        habit.name
      );
    }
  };

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
        onPress={rename}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <Checkbox checked={done} onToggle={toggle} size={28} />

        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_DOT_HEX[habit.color] }} />

        <Text
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: '500',
            color: done ? colors.muted : colors.text,
          }}
        >
          {habit.name}
        </Text>

        {habit.kind === 'goal' ? (
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>goal</Text>
          </View>
        ) : null}
      </Pressable>
    </Swipeable>
  );
}
