import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

const getSnapshot = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);

/** The operating system's "reduce motion" setting, kept current if it changes while the page is open. */
export const usePrefersReducedMotion = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => false);
