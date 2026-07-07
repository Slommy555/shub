import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { RADIUS } from './kit';

const SIZE = 48;
const MARGIN = 16;
const TAB_BAR = 56; // approximate tab-bar height to stay clear of
const TAP_SLOP = 6; // movement under this on release counts as a tap, not a drag

/**
 * A small circular FAB that floats in a corner and can be dragged anywhere on
 * screen like an Android chat-head bubble. A quick tap fires `onPress`; a drag
 * moves it and, on release, snaps to the nearest left/right edge (kept within
 * the safe area, above the tab bar). Uses the built-in Animated/PanResponder so
 * it needs no gesture-handler provider.
 */
export function DraggableFab({
  onPress,
  icon = 'add',
}: {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
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

  // Mirror the animated value into a plain ref so the responder can read it.
  useEffect(() => {
    const id = pos.addListener((v) => {
      posRef.current = v;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Only hijack the gesture once it's clearly a drag, so a tap still reads.
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
            onPress();
            return;
          }
          // Snap to the nearer vertical edge; keep y within bounds.
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
      }),
    [pos, onPress, width, bounds]
  );

  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Add task"
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
      <Ionicons name={icon} size={22} color={colors.accentText} />
    </Animated.View>
  );
}
