import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { ScreenTitle, SPACE, RADIUS } from '../../components/ui/kit';

export default function VoiceScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm }}>
        <ScreenTitle title="Voice" />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.lg }}>
        <Pressable
          onPress={() => Alert.alert('Voice', 'Voice capture is coming soon on the phone.')}
          style={{
            width: 96,
            height: 96,
            borderRadius: RADIUS.full,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.accent,
            shadowOpacity: 0.3,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <Ionicons name="mic" size={44} color={colors.accentText} />
        </Pressable>
        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Tap to talk (coming soon)</Text>
      </View>
    </SafeAreaView>
  );
}
