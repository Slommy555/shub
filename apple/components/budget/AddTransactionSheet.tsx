import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../lib/theme';
import { DragSheet } from '../ui/DragSheet';

type Kind = 'expense' | 'income';

/** Placeholder Add Transaction sheet — amount, description, type. Not yet persisted. */
export function AddTransactionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [kind, setKind] = useState<Kind>('expense');

  useEffect(() => {
    if (!visible) return;
    setAmount('');
    setDesc('');
    setKind('expense');
  }, [visible]);

  const valid = !!amount.trim() && !Number.isNaN(Number(amount));

  return (
    <DragSheet visible={visible} onClose={onClose} title="New transaction">
      <Text style={label(colors)}>Type</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['expense', 'income'] as Kind[]).map((k) => {
          const active = k === kind;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: active ? colors.accent : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text
                style={{
                  color: active ? colors.accentText : colors.text,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {k}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={label(colors)}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        autoFocus
        style={input(colors)}
      />

      <Text style={label(colors)}>Description</Text>
      <TextInput
        value={desc}
        onChangeText={setDesc}
        placeholder="What was it for?"
        placeholderTextColor={colors.muted}
        style={input(colors)}
      />

      <Pressable onPress={onClose} disabled={!valid} style={saveBtn(colors, valid)}>
        <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>Add transaction</Text>
      </Pressable>
    </DragSheet>
  );
}

const label = (c: { muted: string }) => ({
  color: c.muted,
  fontSize: 13,
  fontWeight: '600' as const,
  marginTop: 18,
  marginBottom: 8,
});
const input = (c: { surface: string; border: string; text: string }) => ({
  backgroundColor: c.surface,
  borderColor: c.border,
  borderWidth: 1,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 17,
  color: c.text,
});
const saveBtn = (c: { accent: string }, on: boolean) => ({
  backgroundColor: c.accent,
  borderRadius: 14,
  paddingVertical: 16,
  alignItems: 'center' as const,
  marginTop: 24,
  opacity: on ? 1 : 0.5,
});
