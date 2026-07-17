import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const DISMISS_THRESHOLD = 80;

/**
 * A full-height bottom sheet: spans from the safe-area top down to the top of
 * the keyboard (via KeyboardAvoidingView). Drag down on the handle/header to
 * dismiss — past 80px it slides off and closes, otherwise it snaps back open.
 * Tapping the backdrop above the sheet also closes it. Shared by every add
 * sheet so drag-to-dismiss behaves identically everywhere.
 */
export function DragSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(height)).current;

  const springOpen = () =>
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 65,
    }).start();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(springOpen);
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: height,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DISMISS_THRESHOLD) onClose();
        else springOpen();
      },
      onPanResponderTerminate: () => springOpen(),
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* backdrop */}
        <Pressable style={FILL} onPress={onClose} accessibilityLabel="Close" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Animated.View
            style={{
              flex: 1,
              marginTop: insets.top,
              transform: [{ translateY }],
              backgroundColor: colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }}
          >
            {/* draggable header: handle + optional title + close */}
            <View {...pan.panHandlers} style={{ paddingTop: 10, paddingHorizontal: 20 }}>
              <View
                style={{
                  alignSelf: 'center',
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.overlay,
                  marginBottom: title ? 12 : 6,
                }}
              />
              {title ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
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
              ) : null}
            </View>

            <Animated.ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            >
              {children}
            </Animated.ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
