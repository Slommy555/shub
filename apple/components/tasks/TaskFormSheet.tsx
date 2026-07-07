import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, COLOR_DOT_HEX } from '../../lib/theme';
import { PRIORITIES, PRIORITY_LABEL, type CategoryRecord, type Priority } from '../../lib/types';
import { formatDue, parseISO, toISODate, todayISO } from '../../lib/dates';

export interface TaskFormValues {
  text: string;
  category: string;
  priority: Priority;
  due_date: string | null;
  start_time: string | null; // "HH:MM"
  end_time: string | null; // "HH:MM"
}

const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "HH:MM" → a Date today at that time (for the picker's value). */
const timeToDate = (t: string | null): Date => {
  const d = new Date();
  if (t) {
    const [h, m] = t.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
};

/** 12-hour display for a "HH:MM" value. */
const showTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export function TaskFormSheet({
  visible,
  title,
  submitLabel,
  initial,
  categories,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  submitLabel: string;
  initial?: Partial<TaskFormValues>;
  categories: CategoryRecord[];
  onSubmit: (values: TaskFormValues) => void;
  onClose: () => void;
}) {
  const { colors, tint } = useTheme();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('med');
  const [due, setDue] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [timePicker, setTimePicker] = useState<null | 'start' | 'end'>(null);

  // Reset fields each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setText(initial?.text ?? '');
    setCategory(initial?.category ?? categories[0]?.name ?? '');
    setPriority(initial?.priority ?? 'med');
    setDue(initial?.due_date ?? null);
    setStart(initial?.start_time ?? null);
    setEnd(initial?.end_time ?? null);
    setShowPicker(false);
    setTimePicker(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit({
      text: trimmed,
      category: category || categories[0]?.name || 'other',
      priority,
      due_date: due,
      start_time: start,
      end_time: end,
    });
  };

  const tomorrow = toISODate(new Date(Date.now() + 86400000));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 32,
            maxHeight: '85%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 14,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="What needs doing?"
              placeholderTextColor={colors.muted}
              autoFocus
              multiline
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 14,
                fontSize: 17,
                color: colors.text,
                minHeight: 52,
              }}
            />

            <Label>Category</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {categories.map((c) => {
                const active = c.name === category;
                const t = tint(c.color);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategory(c.name)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? t.bg : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? t.bg : colors.border,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_DOT_HEX[c.color] }} />
                    <Text style={{ color: active ? t.text : colors.text, fontWeight: active ? '700' : '500' }}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Label>Time to complete</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PRIORITIES.map((p) => {
                const active = p === priority;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
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
                    <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '600' }}>
                      {PRIORITY_LABEL[p]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Label>Due date</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <DueChip label="None" active={due === null} onPress={() => setDue(null)} />
              <DueChip label="Today" active={due === todayISO()} onPress={() => setDue(todayISO())} />
              <DueChip label="Tomorrow" active={due === tomorrow} onPress={() => setDue(tomorrow)} />
              <DueChip
                label={due && due !== todayISO() && due !== tomorrow ? formatDue(due) : 'Pick…'}
                active={!!due && due !== todayISO() && due !== tomorrow}
                onPress={() => setShowPicker(true)}
              />
            </View>

            {showPicker && (
              <DateTimePicker
                value={due ? parseISO(due) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_e, d) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (d) setDue(toISODate(d));
                }}
              />
            )}

            <Label>Time block (optional — shows on Schedule)</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <DueChip
                label={start ? showTime(start) : 'Start…'}
                active={!!start}
                onPress={() => setTimePicker('start')}
              />
              <Text style={{ color: colors.muted }}>→</Text>
              <DueChip
                label={end ? showTime(end) : 'End…'}
                active={!!end}
                onPress={() => setTimePicker('end')}
              />
              {(start || end) && (
                <DueChip
                  label="Clear"
                  active={false}
                  onPress={() => {
                    setStart(null);
                    setEnd(null);
                  }}
                />
              )}
            </View>
            {(start || end) && !due ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                Tip: set a due date too, so this appears on that day&apos;s schedule.
              </Text>
            ) : null}

            {timePicker && (
              <DateTimePicker
                value={timeToDate(timePicker === 'start' ? start : end)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_e, d) => {
                  setTimePicker(Platform.OS === 'ios' ? timePicker : null);
                  if (d) {
                    if (timePicker === 'start') setStart(fmtTime(d));
                    else setEnd(fmtTime(d));
                  }
                }}
              />
            )}

            <Pressable
              onPress={submit}
              disabled={!text.trim()}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 24,
                opacity: text.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>
                {submitLabel}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

function DueChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
