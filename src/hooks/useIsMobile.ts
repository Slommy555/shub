import { useEffect, useState } from 'react';

// Below Tailwind's `sm` breakpoint (640px). Kept in sync with the `max-sm:`
// classes used for mobile-only layout tweaks.
const QUERY = '(max-width: 639px)';

/**
 * True on small (phone-sized) viewports. Drives JS-level mobile behavior — the
 * voice tap-to-record mode and hiding keyword settings — where CSS alone can't
 * (e.g. skipping the always-on SpeechRecognition listener). Purely visual mobile
 * tweaks use Tailwind `max-sm:` classes instead.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
