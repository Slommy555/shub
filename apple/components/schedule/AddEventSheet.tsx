import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../lib/theme';
import { formatDue, parseISO, toISODate, todayISO } from '../../lib/dates';
import { DragSheet } from '../ui/DragSheet';

export interface EventValues {
  text: string;
  date: string; // ISO date
  start_time: string | null; // "HH:MM"
  end_time: string | null;
  notes: string | null;
}

const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const timeToDate = (t: string | null): Date => {
  const d = new Date();
  if (t) {
    const [h, m] = t.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
};
const showTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

/** Add an event to the Schedule — persisted as a timed task on the chosen day. */
export function AddEventSheet({
  visible,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  onSubmit: (v: EventValues) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState<string | null>('09:00');
  const [end, setEnd] = useState<string | null>('10:00');
  const [notes, setNotes] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [timePicker, setTimePicker] = useState<null | 'start' | 'end'>(null);

  useEffect(() => {
    if (!visible) return;
    setText('');
    setDate(todayISO());
    setStart('09:00');
    setEnd('10:00');
    setNotes('');
    setShowDate(false);
    setTimePicker(null);
  }, [visible]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit({ text: trimmed, date, start_time: start, end_time: end, notes: notes.trim() || null });
  };

  const tomorrow = toISODate(new Date(Date.now() + 86400000));

  return (
    <DragSheet visible={visible} onClose={onClose} title="New event">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Event name"
        placeholderTextColor={colors.muted}
        autoFocus
        style={inputStyle(colors)}
      />

      <Label>Date</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Today" active={date === todayISO()} onPress={() => setDate(todayISO())} />
        <Chip label="Tomorrow" active={date === tomorrow} onPress={() => setDate(tomorrow)} />
        <Chip
          label={date !== todayISO() && date !== tomorrow ? formatDue(date) : 'Pick…'}
          active={date !== todayISO() && date !== tomorrow}
          onPress={() => setShowDate(true)}
        />
      </View>
      {showDate && (
        <DateTimePicker
          value={parseISO(date)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_e, d) => {
            setShowDate(Platform.OS === 'ios');
            if (d) setDate(toISODate(d));
          }}
        />
      )}

      <Label>Time</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip label={start ? showTime(start) : 'Start…'} active={!!start} onPress={() => setTimePicker('start')} />
        <Text style={{ color: colors.muted }}>→</Text>
        <Chip label={end ? showTime(end) : 'End…'} active={!!end} onPress={() => setTimePicker('end')} />
      </View>
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

      <Label>Notes (optional)</Label>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Add details…"
        placeholderTextColor={colors.muted}
        multiline
        style={[inputStyle(colors), { minHeight: 72, textAlignVertical: 'top' }]}
      />

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
        <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>Add event</Text>
      </Pressable>
    </DragSheet>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
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

const inputStyle = (colors: { surface: string; border: string; text: string }) => ({
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 17,
  color: colors.text,
});
