import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

export function EmptyState({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  /** Ionicons glyph name (no emojis). Omit for a text-only empty state. */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
      {icon ? (
        <Ionicons name={icon} size={48} color={colors.textTertiary} style={{ marginBottom: 14 }} />
      ) : null}
      <Text
        style={{
          color: colors.muted,
          fontSize: 16,
          textAlign: 'center',
          marginBottom: actionLabel ? 20 : 0,
        }}
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: colors.accentText, fontWeight: '600' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
