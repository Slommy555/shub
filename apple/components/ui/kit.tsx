/**
 * Shared UI primitives — the app's design system in code.
 * Every screen should build from these, not raw Views. Specs follow ../../../UI_SKILL.md.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 } as const;
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Elevated card. UI_SKILL: bg-elevated, 1px border, radius-lg, 16 padding. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: RADIUS.lg,
          padding: padded ? SPACE.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'destructive';

/** Pill button. UI_SKILL: 52px mobile height, radius-full, press opacity + scale. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const off = disabled || loading;

  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.surfaceAlt
        : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.accentText
      : variant === 'destructive'
        ? colors.danger
        : colors.text;
  const borderColor =
    variant === 'secondary'
      ? colors.borderStrong
      : variant === 'destructive'
        ? colors.danger
        : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: RADIUS.full,
          backgroundColor: bg,
          borderWidth: variant === 'primary' ? 0 : 1,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE.sm,
          paddingHorizontal: SPACE.xl,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !off ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: '600', fontSize: 16 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Text field. UI_SKILL: bg-surface, radius-md, 48px, focus border accent-muted. */
export function Input({
  style,
  ...props
}: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const multiline = props.multiline;
  return (
    <TextInput
      placeholderTextColor={colors.textTertiary}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        {
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: focused ? colors.accentMuted : colors.border,
          borderRadius: RADIUS.md,
          color: colors.text,
          fontSize: 15,
          paddingHorizontal: SPACE.lg,
          paddingVertical: SPACE.md,
          minHeight: multiline ? 96 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

/** Pill badge. UI_SKILL: 22px, radius-full, 11px/500. Pass explicit bg+fg tints. */
export function Badge({
  label,
  bg,
  fg,
  style,
}: {
  label: string;
  bg: string;
  fg: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          height: 22,
          paddingHorizontal: 10,
          borderRadius: RADIUS.full,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '500', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}

/** Circular completion toggle. UI_SKILL: 22px visual, 44px tap, accent fill + check. */
export function Checkbox({
  checked,
  onToggle,
  size = 22,
}: {
  checked: boolean;
  onToggle: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS.full,
        borderWidth: checked ? 0 : 2,
        borderColor: colors.borderStrong,
        backgroundColor: checked ? colors.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Ionicons name="checkmark" size={size * 0.7} color={colors.accentText} /> : null}
    </Pressable>
  );
}

/** Floating action button. UI_SKILL: 56px, accent, dark icon, accent glow. */
export function Fab({
  onPress,
  icon = 'add',
  bottom = 24,
}: {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  bottom?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: SPACE.lg,
        bottom,
        width: 56,
        height: 56,
        borderRadius: RADIUS.full,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.96 : 1 }],
        shadowColor: colors.accent,
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      })}
    >
      <Ionicons name={icon} size={24} color={colors.accentText} />
    </Pressable>
  );
}

/** ALL-CAPS list section header. UI_SKILL: text-secondary, 13px/500, +0.08em. */
export function SectionHeader({ label, style }: { label: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: colors.muted,
          fontSize: 13,
          fontWeight: '500',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: SPACE.sm,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

/** Horizontal scroll of filter pills. Active = accent fill, dark text. */
export function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingHorizontal: SPACE.md,
              paddingVertical: 7,
              borderRadius: RADIUS.full,
              backgroundColor: active ? colors.accent : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
            }}
          >
            <Text
              style={{
                color: active ? colors.accentText : colors.muted,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Screen title row. UI_SKILL: text-xl weight 600 (never 800). */
export function ScreenTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 }}>
        {title}
      </Text>
      {right}
    </View>
  );
}
