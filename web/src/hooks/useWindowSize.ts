import { useEffect, useState } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

function read(): WindowSize {
  if (typeof window === 'undefined') return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Current window dimensions, updated on resize. Used where layout must branch
 * in JS (e.g. the weekly view rendering 1 / 3 / 7 day columns) rather than via
 * CSS breakpoints alone.
 */
export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(read);

  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}
