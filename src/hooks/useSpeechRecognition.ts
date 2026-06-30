import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API isn't in TS's DOM lib, so we treat it loosely.
/* eslint-disable @typescript-eslint/no-explicit-any */

function getRecognitionCtor(): any | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const norm = (s: string) => s.trim().toLowerCase();

function hasKeyword(text: string, keyword: string): boolean {
  const k = norm(keyword);
  return k.length > 0 && text.toLowerCase().includes(k);
}

function afterKeyword(text: string, keyword: string): string {
  const idx = text.toLowerCase().indexOf(norm(keyword));
  return idx === -1 ? text : text.slice(idx + norm(keyword).length).trim();
}

function beforeKeyword(text: string, keyword: string): string {
  const idx = text.toLowerCase().indexOf(norm(keyword));
  return idx === -1 ? text : text.slice(0, idx).trim();
}

export type StopReason = 'stopKeyword' | 'manual' | 'inactivity';

interface Options {
  startKeyword: string;
  stopKeyword: string;
  /** Called with the cleaned transcript (keywords stripped) when capture ends. */
  onCaptureComplete: (finalText: string, reason: StopReason) => void;
  inactivityMs?: number;
  /**
   * Whether the always-on start/stop keyword detection runs. Defaults to true
   * (desktop). On mobile this is false: there is no background listener — the
   * recognizer only runs during an explicit tap-to-record session and is fully
   * stopped + released the moment that session ends (tap, inactivity, the tab
   * being hidden, or unmount), so the OS mic indicator can't get stuck on.
   */
  keywordsEnabled?: boolean;
}

/**
 * Wraps SpeechRecognition. Stays on listening for the start keyword; once it
 * fires (or the user starts manually) it captures everything until the stop
 * keyword, a manual stop, or 30s of inactivity. Keywords are stripped.
 */
export function useSpeechRecognition(opts: Options) {
  const supported = !!getRecognitionCtor();

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<any>(null);
  const activeRef = useRef(false); // do we want the recognizer running at all
  const recordingRef = useRef(false);
  const finalRef = useRef(''); // accumulated final captured text
  const timerRef = useRef<number | null>(null);
  // A directly-acquired mic stream, if we ever take one (we currently rely on
  // SpeechRecognition's own stream). Released explicitly on every stop path so
  // the mic indicator never lingers.
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseMediaStream = () => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop();
      mediaStreamRef.current = null;
    }
  };

  const finishCapture = useCallback((reason: StopReason) => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    clearTimer();
    const text = finalRef.current.trim();
    finalRef.current = '';
    setTranscript('');
    // Mobile (no keyword listener): fully tear down so the mic is released. Use
    // the graceful stop() — never abort() — and stop any directly-held stream.
    if (optsRef.current.keywordsEnabled === false) {
      activeRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* not running */
      }
      releaseMediaStream();
    }
    optsRef.current.onCaptureComplete(text, reason);
  }, []);

  const armInactivity = useCallback(() => {
    clearTimer();
    const ms = optsRef.current.inactivityMs ?? 30000;
    timerRef.current = window.setTimeout(() => {
      if (recordingRef.current) finishCapture('inactivity');
    }, ms);
  }, [finishCapture]);

  const beginCapture = useCallback(
    (seed: string) => {
      if (recordingRef.current) return;
      finalRef.current = seed;
      recordingRef.current = true;
      setError(null);
      setRecording(true);
      setTranscript(seed);
      armInactivity();
    },
    [armInactivity]
  );

  const handleResult = useCallback(
    (event: any) => {
      const { startKeyword, stopKeyword } = optsRef.current;
      // Mobile: the recognizer only runs during a manual session, so start/stop
      // keyword detection is disabled — we just accumulate the transcript.
      const keywordsOn = optsRef.current.keywordsEnabled !== false;
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0].transcript as string;

        if (result.isFinal) {
          if (!recordingRef.current) {
            if (keywordsOn && hasKeyword(chunk, startKeyword)) {
              beginCapture(afterKeyword(chunk, startKeyword));
            }
          } else if (keywordsOn && hasKeyword(chunk, stopKeyword)) {
            const tail = beforeKeyword(chunk, stopKeyword);
            finalRef.current = `${finalRef.current} ${tail}`.trim();
            setTranscript(finalRef.current);
            finishCapture('stopKeyword');
            return;
          } else {
            finalRef.current = `${finalRef.current} ${chunk}`.trim();
            setTranscript(finalRef.current);
            armInactivity();
          }
        } else {
          interim += chunk;
        }
      }

      if (recordingRef.current) {
        // Detect the stop keyword in interim text too — the recognizer is often
        // slow to finalize (or ends the session) right as it's spoken, so relying
        // on final-only results can miss it entirely.
        if (keywordsOn && hasKeyword(interim, stopKeyword)) {
          const tail = beforeKeyword(interim, stopKeyword);
          finalRef.current = `${finalRef.current} ${tail}`.trim();
          setTranscript(finalRef.current);
          finishCapture('stopKeyword');
          return;
        }
        setTranscript(`${finalRef.current} ${interim}`.trim());
        if (interim) armInactivity();
      } else if (keywordsOn && interim && hasKeyword(interim, startKeyword)) {
        beginCapture(afterKeyword(interim, startKeyword));
      }
    },
    [beginCapture, finishCapture, armInactivity]
  );

  const ensureRecognizer = useCallback(() => {
    if (recRef.current) return recRef.current;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = handleResult;
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission was denied. Enable it in your browser to use voice input.');
        activeRef.current = false;
      }
      // 'no-speech' / 'aborted' are transient; onend will restart if still active.
    };
    rec.onend = () => {
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    recRef.current = rec;
    return rec;
  }, [handleResult]);

  /** Begin the always-on keyword listener. */
  const startListening = useCallback(() => {
    if (!supported) return;
    activeRef.current = true;
    const rec = ensureRecognizer();
    try {
      rec?.start();
    } catch {
      /* already running */
    }
  }, [supported, ensureRecognizer]);

  /** Stop the recognizer entirely (e.g. leaving the tab). */
  const stopListening = useCallback(() => {
    activeRef.current = false;
    recordingRef.current = false;
    clearTimer();
    try {
      recRef.current?.stop();
    } catch {
      /* not running */
    }
    releaseMediaStream();
  }, []);

  /** Start capturing immediately, without waiting for the keyword. */
  const startRecordingManual = useCallback(() => {
    if (!supported) return;
    if (!activeRef.current) startListening();
    beginCapture('');
  }, [supported, startListening, beginCapture]);

  /** Stop capturing now and emit whatever was captured. */
  const stopRecordingManual = useCallback(() => {
    finishCapture('manual');
  }, [finishCapture]);

  // Clean up on unmount.
  useEffect(() => () => stopListening(), [stopListening]);

  // Mobile safeguard: if the tab is hidden mid-recording (app backgrounded,
  // screen lock, tab switch), explicitly stop so the mic indicator can't stick.
  // Desktop keeps its always-on listener, so this only applies when keywords
  // are disabled.
  useEffect(() => {
    if (opts.keywordsEnabled !== false) return;
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && recordingRef.current) {
        finishCapture('inactivity');
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [opts.keywordsEnabled, finishCapture]);

  return {
    supported,
    recording,
    transcript,
    error,
    startListening,
    stopListening,
    startRecordingManual,
    stopRecordingManual,
  };
}
