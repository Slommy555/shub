import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../lib/theme';
import { DragSheet } from '../ui/DragSheet';

// Placeholder pages until the Notes data layer lands (Phase 5).
const PAGES = ['Personal', 'Work', 'Ideas'];

/** Placeholder Add Note sheet — page selector + title. Not yet persisted. */
export function AddNoteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [page, setPage] = useState<string>(PAGES[0]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPage(PAGES[0]);
    setTitle('');
  }, [visible]);

  const options = [...PAGES, 'New page'];

  return (
    <DragSheet visible={visible} onClose={onClose} title="New note">
      <Text style={label(colors)}>Page</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((p) => {
          const active = p === page;
          return (
            <Pressable
              key={p}
              onPress={() => setPage(p)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: active ? colors.accent : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '600' }}>
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={label(colors)}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Note title"
        placeholderTextColor={colors.muted}
        autoFocus
        style={input(colors)}
      />

      <Pressable onPress={onClose} style={saveBtn(colors, !!title.trim())} disabled={!title.trim()}>
        <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>Create note</Text>
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
