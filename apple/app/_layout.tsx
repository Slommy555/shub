import 'react-native-gesture-handler';
import '../global.css';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuthContext } from '../hooks/useAuth';
import { ThemeProvider, useTheme } from '../lib/theme';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { LoginScreen } from '../components/LoginScreen';

function Gate() {
  const { session, user, loading } = useAuthContext();
  const { colors, scheme } = useTheme();

  // Ask for notification permission + save a push token once signed in.
  usePushRegistration(user?.id ?? null);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <Gate />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
