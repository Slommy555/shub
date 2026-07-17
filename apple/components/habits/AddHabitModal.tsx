import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, COLOR_DOT_HEX } from '../../lib/theme';
import { DragSheet } from '../ui/DragSheet';
import { COLOR_KEYS, type ColorKey, type HabitKind } from '../../lib/types';
import type { NewHabitInput } from '../../hooks/useHabits';

export function AddHabitModal({
  visible,
  onAdd,
  onClose,
}: {
  visible: boolean;
  onAdd: (input: NewHabitInput) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HabitKind>('habit');
  const [color, setColor] = useState<ColorKey>('green');
  const [reminder, setReminder] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setKind('habit');
    setColor('green');
    setReminder(null);
    setShowPicker(false);
  }, [visible]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, kind, color, reminder_time: reminder });
    onClose();
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <DragSheet visible={visible} onClose={onClose} title="New habit">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Drink water"
              placeholderTextColor={colors.muted}
              autoFocus
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 14,
                fontSize: 17,
                color: colors.text,
              }}
            />

            <Label>Type</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['habit', 'goal'] as HabitKind[]).map((k) => {
                const active = k === kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '600', textTransform: 'capitalize' }}>
                      {k}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Label>Color</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {COLOR_KEYS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: COLOR_DOT_HEX[c],
                    borderWidth: color === c ? 3 : 0,
                    borderColor: colors.text,
                  }}
                />
              ))}
            </View>

            <Label>Daily reminder (optional)</Label>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Pressable
                onPress={() => setShowPicker(true)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {reminder ?? 'Set time'}
                </Text>
              </Pressable>
              {reminder ? (
                <Pressable onPress={() => setReminder(null)}>
                  <Text style={{ color: colors.muted }}>Clear</Text>
                </Pressable>
              ) : null}
            </View>

            {showPicker && (
              <DateTimePicker
                value={
                  reminder
                    ? new Date(2000, 0, 1, Number(reminder.slice(0, 2)), Number(reminder.slice(3, 5)))
                    : new Date(2000, 0, 1, 9, 0)
                }
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_e, d) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (d) setReminder(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
                }}
              />
            )}

            <Pressable
              onPress={submit}
              disabled={!name.trim()}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 24,
                opacity: name.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>Add habit</Text>
            </Pressable>
    </DragSheet>
  );
}

function Label({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 8 }}>
      {children}
    </Text>
  );
}
