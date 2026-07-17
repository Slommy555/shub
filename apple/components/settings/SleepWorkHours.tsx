import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthContext } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { Button, Card, SectionHeader, SPACE, RADIUS } from '../ui/kit';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

const DEFAULTS = {
  bedtime: '22:00',
  waketime: '07:00',
  workStart: '09:00',
  workEnd: '17:00',
  workDays: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
};

const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
const timeToDate = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** Whole-ish hours from bedtime to waketime, wrapping past midnight. */
const sleepDuration = (bed: string, wake: string) => {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hours` : `${h}h ${m}m`;
};

type PickerKind = null | 'bedtime' | 'waketime' | 'workStart' | 'workEnd';

/**
 * Sleep & Work Hours settings. Persists four times + a work-days set into
 * user_preferences (migration 029). UI-only for now — the values are stored so
 * Claude can use them later for schedule optimization + the Telegram brief.
 */
export function SleepWorkHours() {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const [bedtime, setBedtime] = useState(DEFAULTS.bedtime);
  const [waketime, setWaketime] = useState(DEFAULTS.waketime);
  const [workStart, setWorkStart] = useState(DEFAULTS.workStart);
  const [workEnd, setWorkEnd] = useState(DEFAULTS.workEnd);
  const [workDays, setWorkDays] = useState<string[]>(DEFAULTS.workDays);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('sleep_bedtime, sleep_waketime, work_start, work_end, work_days')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const trim = (t: string | null, d: string) => (t ? t.slice(0, 5) : d);
      setBedtime(trim(data.sleep_bedtime, DEFAULTS.bedtime));
      setWaketime(trim(data.sleep_waketime, DEFAULTS.waketime));
      setWorkStart(trim(data.work_start, DEFAULTS.workStart));
      setWorkEnd(trim(data.work_end, DEFAULTS.workEnd));
      if (Array.isArray(data.work_days)) setWorkDays(data.work_days);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setTime = (kind: Exclude<PickerKind, null>, t: string) => {
    if (kind === 'bedtime') setBedtime(t);
    else if (kind === 'waketime') setWaketime(t);
    else if (kind === 'workStart') setWorkStart(t);
    else setWorkEnd(t);
  };
  const currentValue = (kind: Exclude<PickerKind, null>) =>
    kind === 'bedtime' ? bedtime : kind === 'waketime' ? waketime : kind === 'workStart' ? workStart : workEnd;

  const toggleDay = (key: string) =>
    setWorkDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        sleep_bedtime: bedtime,
        sleep_waketime: waketime,
        work_start: workStart,
        work_end: workEnd,
        work_days: workDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    setSaving(false);
    if (error) console.error('Failed to save sleep/work hours:', error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <View>
      <SectionHeader label="Sleep & Work Hours" />
      <Card style={{ gap: SPACE.lg }}>
        {/* Sleep */}
        <View style={{ gap: SPACE.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Sleep</Text>
          <TimeRow label="Bedtime" value={bedtime} onPress={() => setPicker('bedtime')} />
          <TimeRow label="Wake time" value={waketime} onPress={() => setPicker('waketime')} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {sleepDuration(bedtime, waketime)} of sleep
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: colors.border }} />

        {/* Work */}
        <View style={{ gap: SPACE.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Work</Text>
          <TimeRow label="Work start" value={workStart} onPress={() => setPicker('workStart')} />
          <TimeRow label="Work end" value={workEnd} onPress={() => setPicker('workEnd')} />

          <Text style={{ color: colors.muted, fontSize: 13, marginTop: SPACE.xs }}>Work days</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
            {DAYS.map((d) => {
              const active = workDays.includes(d.key);
              return (
                <Pressable
                  key={d.key}
                  onPress={() => toggleDay(d.key)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: RADIUS.full,
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.accentText : colors.textTertiary,
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button
          label={saved ? 'Saved' : 'Save sleep & work hours'}
          icon={saved ? 'checkmark' : 'save-outline'}
          loading={saving}
          onPress={save}
        />
      </Card>

      {picker ? (
        <DateTimePicker
          value={timeToDate(currentValue(picker))}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_e, d) => {
            const kind = picker;
            setPicker(Platform.OS === 'ios' ? picker : null);
            if (d && kind) setTime(kind, fmtTime(d));
          }}
        />
      ) : null}
    </View>
  );
}

function TimeRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: RADIUS.md,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{to12h(value)}</Text>
    </Pressable>
  );
}
