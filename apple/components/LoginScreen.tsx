import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

const ALLOWED_USERNAME = process.env.EXPO_PUBLIC_DEV_USERNAME ?? 'Slommy Dev';
const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL;
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD;

export function LoginScreen() {
  const { colors, scheme } = useTheme();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setError(null);

    if (trimmed.toLowerCase() !== ALLOWED_USERNAME.toLowerCase()) {
      setError('Unrecognized username.');
      return;
    }

    if (!DEV_EMAIL || !DEV_PASSWORD) {
      setError(
        'App not configured: set EXPO_PUBLIC_DEV_EMAIL and EXPO_PUBLIC_DEV_PASSWORD in .env.local.'
      );
      return;
    }

    setBusy(true);
    // The username maps to a real Supabase account so the database has an
    // authenticated session (RLS). The password lives in env, never typed.
    const { error } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });
    setBusy(false);
    if (error) setError(error.message);
  };

  const disabled = busy || !username.trim();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Text style={{ fontSize: 44 }}>✳</Text>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 8 }}>
              Slom HQ
            </Text>
            <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>
              Tasks & habits, everywhere.
            </Text>
          </View>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoCorrect={false}
            onSubmitEditing={enter}
            returnKeyType="go"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 16,
              fontSize: 17,
              color: colors.text,
            }}
          />

          {error ? (
            <Text style={{ color: colors.danger, marginTop: 10 }}>{error}</Text>
          ) : null}

          <Pressable
            onPress={enter}
            disabled={disabled}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 16,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>
                Enter
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
