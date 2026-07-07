import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { RADIUS } from './kit';

const SIZE = 48; // main bubble
const ITEM = 44; // action bubbles
const GAP = 60; // spacing between action bubbles
const MARGIN = 16;
const TAB_BAR = 56;
const TAP_SLOP = 6;

export interface FabAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

/**
 * A small circular bubble that floats in a corner, can be dragged anywhere on
 * screen (Android chat-head style, snapping to the nearest edge on release), and
 * on tap expands into a little speed-dial menu of `actions`. Built on the
 * built-in Animated/PanResponder — no gesture-handler provider needed.
 */
export function DraggableFab({ actions }: { actions: FabAction[] }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const bounds = useMemo(() => {
    const minX = MARGIN;
    const maxX = width - SIZE - MARGIN;
    const minY = insets.top + MARGIN;
    const maxY = height - insets.bottom - TAB_BAR - SIZE - MARGIN;
    return { minX, maxX, minY, maxY };
  }, [width, height, insets.top, insets.bottom]);

  const pos = useRef(new Animated.ValueXY({ x: bounds.maxX, y: bounds.maxY })).current;
  const posRef = useRef({ x: bounds.maxX, y: bounds.maxY });

  const [open, setOpen] = useState(false);
  // Snapshot of the bubble's position when the menu opens, so the items stay
  // put even though `pos` keeps tracking the (now-hidden) draggable bubble.
  const [anchor, setAnchor] = useState({ x: bounds.maxX, y: bounds.maxY });
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = pos.addListener((v) => {
      posRef.current = v;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: open ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [open, menuAnim]);

  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  const openMenu = () => {
    setAnchor({ x: posRef.current.x, y: posRef.current.y });
    setOpen(true);
  };

  const pan = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        pos.setOffset({ x: posRef.current.x, y: posRef.current.y });
        pos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, g) => {
        pos.flattenOffset();
        const moved = Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP;
        if (!moved) {
          openMenu();
          return;
        }
        const cur = posRef.current;
        const snapX = cur.x + SIZE / 2 < width / 2 ? bounds.minX : bounds.maxX;
        const snapY = clamp(cur.y, bounds.minY, bounds.maxY);
        Animated.spring(pos, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          friction: 6,
          tension: 60,
        }).start();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, width, bounds]);

  // --- expanded menu ---------------------------------------------------------
  if (open) {
    const expandUp = anchor.y + SIZE / 2 > height / 2;
    const dir = expandUp ? -1 : 1;
    const labelsLeft = anchor.x + SIZE / 2 > width / 2;
    const itemLeft = anchor.x + SIZE / 2 - ITEM / 2;

    const close = () => setOpen(false);
    const run = (fn: () => void) => {
      setOpen(false);
      fn();
    };

    return (
      <View style={{ ...StyleSheetAbsolute, zIndex: 200 }} pointerEvents="box-none">
        {/* backdrop */}
        <Pressable
          onPress={close}
          style={{ ...StyleSheetAbsolute, backgroundColor: 'rgba(0,0,0,0.35)' }}
        />

        {actions.map((a, i) => {
          const centerY = anchor.y + SIZE / 2 + dir * (i + 1) * GAP;
          const translateY = menuAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [dir * 12, 0],
          });
          return (
            <Animated.View
              key={a.label}
              style={{ opacity: menuAnim, transform: [{ translateY }] }}
              pointerEvents="box-none"
            >
              {/* label pill */}
              <View
                style={{
                  position: 'absolute',
                  top: centerY - 14,
                  ...(labelsLeft
                    ? { right: width - (itemLeft - 10) }
                    : { left: itemLeft + ITEM + 10 }),
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: RADIUS.full,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{a.label}</Text>
              </View>
              {/* action bubble */}
              <Pressable
                onPress={() => run(a.onPress)}
                style={{
                  position: 'absolute',
                  top: centerY - ITEM / 2,
                  left: itemLeft,
                  width: ITEM,
                  height: ITEM,
                  borderRadius: RADIUS.full,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={a.icon} size={20} color={colors.accent} />
              </Pressable>
            </Animated.View>
          );
        })}

        {/* main bubble (now a close button) */}
        <Pressable
          onPress={close}
          style={{
            position: 'absolute',
            left: anchor.x,
            top: anchor.y,
            width: SIZE,
            height: SIZE,
            borderRadius: RADIUS.full,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.accent,
            shadowOpacity: 0.3,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Ionicons name="close" size={22} color={colors.accentText} />
        </Pressable>
      </View>
    );
  }

  // --- collapsed draggable bubble --------------------------------------------
  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Actions"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: SIZE,
        height: SIZE,
        borderRadius: RADIUS.full,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.accent,
        shadowOpacity: 0.3,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        zIndex: 100,
      }}
    >
      <Ionicons name="add" size={22} color={colors.accentText} />
    </Animated.View>
  );
}

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
