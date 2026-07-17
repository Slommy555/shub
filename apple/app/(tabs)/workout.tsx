import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { ScreenTitle, SPACE } from '../../components/ui/kit';
import { EmptyState } from '../../components/ui/EmptyState';

export default function WorkoutScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm }}>
        <ScreenTitle title="Workout" />
      </View>
      <EmptyState icon="barbell-outline" title="Workouts are coming soon. Tap the plus to start one." />
    </SafeAreaView>
  );
}
