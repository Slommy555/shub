import { createContext, useContext } from 'react';

/** Controls for the always-on voice listener, consumed by the Voice tab. */
export interface VoiceContextValue {
  /** A key is configured in this build. */
  enabled: boolean;
  /** The browser supports SpeechRecognition. */
  supported: boolean;
  recording: boolean;
  reviewing: boolean;
  error: string | null;
  startKeyword: string;
  /** Begin capturing immediately, without the keyword. */
  startManual: () => void;
  /** Stop capturing now and send what was captured. */
  stopManual: () => void;
  /** Open the voice settings drawer. */
  openSettings: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export const VoiceProvider = VoiceContext.Provider;

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
  return ctx;
}
