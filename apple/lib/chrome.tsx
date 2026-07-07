import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface ChromeState {
  /** Whether the bottom tab bar is collapsed (hidden). */
  tabBarHidden: boolean;
  toggleTabBar: () => void;
  setTabBarHidden: (v: boolean) => void;
}

const ChromeContext = createContext<ChromeState | null>(null);

/**
 * App-chrome UI state shared across the tab group — currently just whether the
 * bottom tab bar is collapsed. Lives above the Tabs navigator so both the
 * layout (which hides the bar) and any screen (the add-task FAB menu, which
 * toggles it) can read/write it.
 */
export function ChromeProvider({ children }: { children: ReactNode }) {
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const value = useMemo<ChromeState>(
    () => ({
      tabBarHidden,
      setTabBarHidden,
      toggleTabBar: () => setTabBarHidden((v) => !v),
    }),
    [tabBarHidden]
  );
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeState {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error('useChrome must be used within a ChromeProvider');
  return ctx;
}
