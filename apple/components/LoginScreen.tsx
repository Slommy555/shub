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

export function LoginScreen() {
  const { colors, scheme } = useTheme();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
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
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 8 }}>
              Slom HQ
            </Text>
            <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>
              Tasks & habits, everywhere.
            </Text>
          </View>

          {sent ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📬</Text>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                Check your email
              </Text>
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                We sent a login link to {email.trim()}. Open it on this device to sign in.
              </Text>
              <Pressable onPress={() => setSent(false)} style={{ marginTop: 16 }}>
                <Text style={{ color: colors.muted, textDecorationLine: 'underline' }}>
                  Use a different email
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
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
                onPress={send}
                disabled={sending || !email.trim()}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginTop: 16,
                  opacity: sending || !email.trim() ? 0.5 : 1,
                }}
              >
                {sending ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 16 }}>
                    Send magic link
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
