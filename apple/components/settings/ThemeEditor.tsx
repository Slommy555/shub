import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import {
  APPEARANCE_FIELDS,
  useTheme,
  type Appearance,
  type ThemePref,
} from '../../lib/theme';
import { Card, Divider, Input, SectionHeader, RADIUS, SPACE } from '../ui/kit';

const MODES: { key: ThemePref; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

// Quick-pick swatches spanning the app's dark-lavender palette + neutrals.
const PRESETS = [
  '#16161f', '#1e1e2e', '#252538', '#2e2e45',
  '#b8a9f5', '#7c6fb0', '#2a2545', '#f0eeff',
  '#8b8aa8', '#4caf82', '#f0a04b', '#e05c5c',
  '#5c9eff', '#ffffff', '#f9fafb', '#111827',
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function normalizeHex(v: string): string | null {
  const s = v.trim();
  const withHash = s.startsWith('#') ? s : `#${s}`;
  return HEX_RE.test(withHash) ? withHash.toLowerCase() : null;
}

/** Segmented Light / Dark / System control. */
function ModeSelector() {
  const { colors, pref, setTheme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: RADIUS.md,
        padding: 4,
        gap: 4,
      }}
    >
      {MODES.map((m) => {
        const active = pref === m.key;
        return (
          <Pressable
            key={m.key}
            onPress={() => setTheme(m.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: RADIUS.sm,
              backgroundColor: active ? colors.accent : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: active ? colors.accentText : colors.muted,
                fontWeight: '600',
                fontSize: 14,
              }}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One editable color: swatch + hex, expands to a hex input + preset grid. */
function ColorRow({
  field,
  value,
  onChange,
}: {
  field: (typeof APPEARANCE_FIELDS)[number];
  value: string;
  onChange: (key: keyof Appearance, value: string) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) onChange(field.key, hex);
  };

  return (
    <View>
      <Pressable
        onPress={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, gap: SPACE.md }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.sm,
            backgroundColor: value,
            borderWidth: 1,
            borderColor: colors.borderStrong,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{field.label}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>{field.hint}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </Pressable>

      {open ? (
        <View style={{ paddingBottom: SPACE.md, gap: SPACE.md }}>
          <Input
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              commit(t);
            }}
            placeholder="#b8a9f5"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  setDraft(p);
                  onChange(field.key, p);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: RADIUS.full,
                  backgroundColor: p,
                  borderWidth: value.toLowerCase() === p ? 2 : 1,
                  borderColor: value.toLowerCase() === p ? colors.accent : colors.border,
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ThemeEditor() {
  const {
    colors,
    appearanceEnabled,
    appearanceColors,
    setAppearanceEnabled,
    setAppearanceColor,
    resetAppearance,
  } = useTheme();

  return (
    <View style={{ gap: SPACE.xxl }}>
      <View>
        <SectionHeader label="Theme" />
        <Card>
          <ModeSelector />
        </Card>
      </View>

      <View>
        <SectionHeader label="Custom colors" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                Use a custom palette
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                Overrides light/dark. Syncs with the web app.
              </Text>
            </View>
            <Switch
              value={appearanceEnabled}
              onValueChange={setAppearanceEnabled}
              trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
              thumbColor="#ffffff"
            />
          </View>

          {appearanceEnabled ? (
            <>
              <Divider style={{ marginTop: SPACE.md }} />
              {APPEARANCE_FIELDS.map((f, i) => (
                <View key={f.key}>
                  {i > 0 ? <Divider /> : null}
                  <ColorRow field={f} value={appearanceColors[f.key]} onChange={setAppearanceColor} />
                </View>
              ))}
              <Divider />
              <Pressable
                onPress={resetAppearance}
                style={{ paddingTop: SPACE.md, alignItems: 'flex-start' }}
              >
                <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '600' }}>
                  Reset to default
                </Text>
              </Pressable>
            </>
          ) : null}
        </Card>
      </View>
    </View>
  );
}
