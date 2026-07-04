// Central bridge to Capacitor native features. Every function is a no-op on the
// web build — plugin modules are imported dynamically *inside* an isNative()
// guard so the web bundle never pulls in (or executes) native-only code.

import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor native shell (Android/iOS). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** True when running inside Electron's renderer. */
export function isElectron(): boolean {
  return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
}

/** Light haptic tap — task/habit/workout completion. Safe to call anywhere. */
export async function haptic(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* ignore — haptics are best-effort */
  }
}

/** Match the Android status bar to the current theme. */
export async function syncStatusBar(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    // Android only: tint the bar background to match the app chrome.
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: dark ? '#030712' : '#f9fafb' });
    }
  } catch {
    /* status bar plugin unavailable */
  }
}

/**
 * One-time native setup: hide the splash once React has mounted and wire the
 * app-resume listener so data refetches when Android brings the app back to the
 * foreground (mirrors the web `visibilitychange` behavior). Returns a cleanup fn.
 */
export async function initNative(onResume?: () => void): Promise<() => void> {
  if (!isNative()) return () => {};
  let remove: (() => void) | undefined;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('resume', () => onResume?.());
    remove = () => handle.remove();
  } catch {
    /* ignore */
  }
  return () => remove?.();
}
