import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by the device keychain (Expo SecureStore).
 * Keys must be alphanumeric/._- so we sanitize Supabase's default key names.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(sanitize(key)),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(sanitize(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(sanitize(key)),
};

function sanitize(key: string) {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.local and set EXPO_PUBLIC_SUPABASE_URL ' +
      'and EXPO_PUBLIC_SUPABASE_ANON_KEY (same values as the web app).'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // Native apps don't parse the session out of a URL like the browser does.
    detectSessionInUrl: false,
  },
});
