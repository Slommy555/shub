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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { RADIUS } from './kit';

const SIZE = 48; // main bubble
const ITEM = 44; // action bubbles
const GAP = 60; // spacing between action bubbles
const MARGIN = 16;
const TAB_BAR = 56;
const TAP_SLOP = 6; // release movement under this = a tap (open menu), not a drag

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

export interface FabAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

/**
 * A small circular bubble that floats on a screen edge and can be dragged
 * around (Android chat-head style). On release it always snaps to the nearest
 * left/right edge, clamped inside the safe area — so it can never rest in the
 * middle or off-screen. A tap expands a speed-dial menu of `actions` over a
 * blurred backdrop. Built on Animated/PanResponder — no gesture provider.
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
  const dragStart = useRef({ x: bounds.maxX, y: bounds.maxY });

  const [rendered, setRendered] = useState(false); // overlay mounted (incl. fade-out)
  const [anchor, setAnchor] = useState({ x: bounds.maxX, y: bounds.maxY });
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = pos.addListener((v) => {
      posRef.current = v;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  // Nearest left/right edge, vertically clamped into the safe area. This is the
  // single guarantee that the bubble is always at a valid on-screen position.
  const snapTarget = (cur: { x: number; y: number }) => ({
    x: cur.x + SIZE / 2 < width / 2 ? bounds.minX : bounds.maxX,
    y: clamp(cur.y, bounds.minY, bounds.maxY),
  });

  const snapTo = (target: { x: number; y: number }) => {
    posRef.current = target;
    Animated.spring(pos, {
      toValue: target,
      useNativeDriver: false,
      friction: 7,
      tension: 80,
    }).start();
  };

  // Tap behaviour, kept in a ref so the (memoized) pan responder always runs
  // the latest actions after a tab switch: one action → run it directly;
  // several → open the speed-dial menu.
  const onTapRef = useRef<(at: { x: number; y: number }) => void>(() => {});

  const openMenu = (at: { x: number; y: number }) => {
    setAnchor(at);
    setRendered(true);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
        onPanResponderGrant: () => {
          dragStart.current = { x: posRef.current.x, y: posRef.current.y };
        },
        onPanResponderMove: (_e, g) => {
          pos.setValue({ x: dragStart.current.x + g.dx, y: dragStart.current.y + g.dy });
        },
        onPanResponderRelease: (_e, g) => {
          const moved = Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP;
          const target = snapTarget(posRef.current);
          snapTo(target);
          if (!moved) onTapRef.current(target);
        },
        onPanResponderTerminate: () => snapTo(snapTarget(posRef.current)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, width, bounds]
  );

  onTapRef.current = (at) => {
    if (actions.length <= 1) actions[0]?.onPress();
    else openMenu(at);
  };

  // --- menu geometry (relative to the snapped anchor) ------------------------
  const expandUp = anchor.y + SIZE / 2 > height / 2;
  const dir = expandUp ? -1 : 1;
  const labelsLeft = anchor.x + SIZE / 2 > width / 2;
  const itemLeft = anchor.x + SIZE / 2 - ITEM / 2;

  const runAction = (fn: () => void) => {
    closeMenu();
    fn();
  };

  const bubbleShadow = {
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  } as const;

  return (
    <>
      {/* draggable bubble (sits under the overlay while the menu is open) */}
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
          zIndex: 100,
          ...bubbleShadow,
        }}
      >
        <Ionicons name="add" size={22} color={colors.accentText} />
      </Animated.View>

      {rendered ? (
        <View style={{ ...FILL, zIndex: 200 }} pointerEvents="box-none">
          {/* blurred dark backdrop — fades in/out with the menu */}
          <Animated.View style={{ ...FILL, opacity: menuAnim }}>
            <BlurView intensity={24} tint="dark" style={FILL} />
            <View style={{ ...FILL, backgroundColor: 'rgba(22,22,31,0.7)' }} />
            <Pressable style={FILL} onPress={closeMenu} accessibilityLabel="Close menu" />
          </Animated.View>

          {/* action items */}
          {actions.map((a, i) => {
            const centerY = anchor.y + SIZE / 2 + dir * (i + 1) * GAP;
            const translateY = menuAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [dir * 12, 0],
            });
            return (
              <Animated.View
                key={a.label}
                pointerEvents="box-none"
                style={{ opacity: menuAnim, transform: [{ translateY }] }}
              >
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
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                    {a.label}
                  </Text>
                </View>
                <Pressable
                  onPress={() => runAction(a.onPress)}
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

          {/* main bubble (now a close button), at the snapped anchor */}
          <Animated.View
            style={{
              position: 'absolute',
              left: anchor.x,
              top: anchor.y,
              width: SIZE,
              height: SIZE,
              borderRadius: RADIUS.full,
              backgroundColor: colors.accent,
              opacity: menuAnim,
              ...bubbleShadow,
            }}
          >
            <Pressable
              onPress={closeMenu}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={22} color={colors.accentText} />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}
