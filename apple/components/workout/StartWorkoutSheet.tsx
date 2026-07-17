import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { DragSheet } from '../ui/DragSheet';

// Placeholder templates until the Workout data layer lands (Phase 4).
const TEMPLATES = ['Freestyle', 'Push day', 'Pull day', 'Leg day'];

/** Placeholder Start Workout sheet — template picker. Not yet wired to a session. */
export function StartWorkoutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();

  return (
    <DragSheet visible={visible} onClose={onClose} title="Start workout">
      <Text
        style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 10 }}
      >
        Choose a template or go freestyle
      </Text>
      <View style={{ gap: 10 }}>
        {TEMPLATES.map((t) => (
          <Pressable
            key={t}
            onPress={onClose}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </DragSheet>
  );
}
