'use client';

import { useEffect, useRef } from 'react';

/** Call `onEscape` when the Esc key is pressed while `active` is true. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const ref = useRef(onEscape);
  ref.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current();
    };
    window.addEventListener('keydown', fn);
    return () => {
      window.removeEventListener('keydown', fn);
    };
  }, [active]);
}
