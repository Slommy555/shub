import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { Button, Input, SPACE } from './ui/kit';

// Optional convenience: prefill the email field. The password is always typed,
// so changing your password never requires touching env or the app again.
const PREFILL_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL ?? '';

export function LoginScreen() {
  const { colors, scheme } = useTheme();
  const [email, setEmail] = useState(PREFILL_EMAIL);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) return;
    setBusy(true);
    setError(null);
    // Same call the PWA uses — Supabase email + password auth.
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setBusy(false);
    if (error) setError(error.message);
    // On success the auth listener swaps this screen out.
  };

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
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', marginTop: 8, letterSpacing: -0.5 }}>
              Welcome back
            </Text>
            <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>
              Sign in with your email and password.
            </Text>
          </View>

          <View style={{ gap: SPACE.md }}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={signIn}
            />

            {error ? (
              <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
            ) : null}

            <Button
              label="Sign in"
              onPress={signIn}
              loading={busy}
              disabled={!email.trim() || !password}
              style={{ marginTop: SPACE.xs }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
