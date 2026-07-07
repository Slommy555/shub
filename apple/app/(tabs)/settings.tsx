import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from '../../hooks/useAuth';
import { useTheme } from '../../lib/theme';
import { ThemeEditor } from '../../components/settings/ThemeEditor';
import { CategoryManager } from '../../components/settings/CategoryManager';
import { Button, ScreenTitle, SectionHeader, Card, SPACE } from '../../components/ui/kit';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuthContext();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 120, gap: SPACE.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle title="Settings" />

        <ThemeEditor />

        <CategoryManager />

        <View>
          <SectionHeader label="Account" />
          <Card>
            <Button
              label={user?.email ? `Sign out (${user.email})` : 'Sign out'}
              variant="destructive"
              icon="log-out-outline"
              onPress={signOut}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
