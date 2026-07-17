import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { ScreenTitle, SPACE } from '../../components/ui/kit';
import { EmptyState } from '../../components/ui/EmptyState';

export default function NotesScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm }}>
        <ScreenTitle title="Notes" />
      </View>
      <EmptyState
        icon="document-text-outline"
        title="Notes are coming soon. Tap the plus to draft one."
      />
    </SafeAreaView>
  );
}
