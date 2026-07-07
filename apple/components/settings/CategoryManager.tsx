import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { useTheme, COLOR_DOT_HEX } from '../../lib/theme';
import { COLOR_KEYS, type CategoryRecord, type ColorKey } from '../../lib/types';
import { Card, Input, SectionHeader, SPACE, RADIUS } from '../ui/kit';

/** Horizontal wrap of color swatches; the selected one gets a ring. */
function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {COLOR_KEYS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          hitSlop={4}
          style={{
            width: 26,
            height: 26,
            borderRadius: RADIUS.full,
            backgroundColor: COLOR_DOT_HEX[c],
            borderWidth: value === c ? 2 : 0,
            borderColor: colors.text,
          }}
        />
      ))}
    </View>
  );
}

function CategoryRow({
  cat,
  canDelete,
  onRename,
  onRecolor,
  onDelete,
}: {
  cat: CategoryRecord;
  canDelete: boolean;
  onRename: (name: string) => void;
  onRecolor: (color: ColorKey) => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(cat.name);

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== cat.name) onRename(trimmed);
    else setName(cat.name);
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete "${cat.name}"?`,
      'Tasks in this category will move to another category.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <View
      style={{
        gap: SPACE.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: RADIUS.md,
        padding: SPACE.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: RADIUS.full,
            backgroundColor: COLOR_DOT_HEX[cat.color],
          }}
        />
        <Input
          value={name}
          onChangeText={setName}
          onBlur={commit}
          returnKeyType="done"
          onSubmitEditing={commit}
          style={{ flex: 1, height: 40 }}
        />
        <Pressable
          onPress={confirmDelete}
          disabled={!canDelete}
          hitSlop={6}
          style={{
            width: 36,
            height: 36,
            borderRadius: RADIUS.md,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canDelete ? 1 : 0.35,
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
      <ColorPicker value={cat.color} onChange={onRecolor} />
    </View>
  );
}

/**
 * Manage task categories — add, rename, recolor, delete. Mirrors the web
 * CategoryManager: renaming rewrites every task using the old name, and deleting
 * reassigns its tasks to another category (at least one is always kept).
 */
export function CategoryManager() {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories(user?.id ?? null);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<ColorKey>('indigo');

  const add = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addCategory(trimmed, newColor);
    setNewName('');
    setNewColor('indigo');
  };

  return (
    <View>
      <SectionHeader label="Categories" />
      <Card style={{ gap: SPACE.md }}>
        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
          Rename, recolor, add, or delete. Renaming updates every task using it.
        </Text>

        <View style={{ gap: SPACE.sm }}>
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              canDelete={categories.length > 1}
              onRename={(name) => updateCategory(cat.id, { name })}
              onRecolor={(color) => updateCategory(cat.id, { color })}
              onDelete={() => deleteCategory(cat.id)}
            />
          ))}
        </View>

        <View style={{ gap: SPACE.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: SPACE.md }}>
          <Input
            value={newName}
            onChangeText={setNewName}
            placeholder="New category…"
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Pressable
            onPress={add}
            disabled={!newName.trim()}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACE.xs,
              backgroundColor: colors.accent,
              borderRadius: RADIUS.full,
              paddingHorizontal: SPACE.lg,
              paddingVertical: SPACE.sm,
              opacity: newName.trim() ? 1 : 0.5,
            }}
          >
            <Ionicons name="add" size={18} color={colors.accentText} />
            <Text style={{ color: colors.accentText, fontWeight: '600' }}>Add category</Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}
