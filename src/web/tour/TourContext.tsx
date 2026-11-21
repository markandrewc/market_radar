import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FULL_TOUR, QUICK_TOUR } from './steps';
import type { TourMode, TourStep } from './types';

/** Bump this when the tour changes materially; the first-visit prompt shows once per version. */
export const TOUR_VERSION = 'v2';
export const TOUR_SEEN_KEY = 'mr-tour-seen';

interface TourValue {
  mode: TourMode | null;
  steps: TourStep[];
  index: number;
  start: (mode: TourMode) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const TourContext = createContext<TourValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TourMode | null>(null);
  const [index, setIndex] = useState(0);
  const opener = useRef<HTMLElement | null>(null);

  const steps = mode === 'quick' ? QUICK_TOUR : mode === 'full' ? FULL_TOUR : [];

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, TOUR_VERSION);
    } catch {
      /* storage blocked: the prompt may show again next visit, nothing else breaks */
    }
  }, []);

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => opener.current?.focus?.());
  }, []);

  const start = useCallback((nextMode: TourMode) => {
    const active = document.activeElement as HTMLElement | null;
    // Starting from the help dialog: that button disappears with the dialog, so
    // return focus to the stable "Tour" trigger in the header instead.
    const inDialog = Boolean(active?.closest('dialog'));
    opener.current = (inDialog ? document.querySelector<HTMLElement>('[data-tour="tour-button"]') : null) ?? active;
    setMode(nextMode);
    setIndex(0);
  }, []);

  const finish = useCallback(() => {
    setMode(null);
    markSeen();
    restoreFocus();
  }, [markSeen, restoreFocus]);

  const next = useCallback(() => {
    const total = mode === 'quick' ? QUICK_TOUR.length : FULL_TOUR.length;
    if (index + 1 >= total) {
      finish();
      return;
    }
    setIndex(index + 1);
  }, [finish, index, mode]);

  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  const value = useMemo<TourValue>(
    () => ({ mode, steps, index, start, next, back, skip: finish }),
    [mode, steps, index, start, next, back, finish],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourValue {
  const value = useContext(TourContext);
  if (!value) throw new Error('useTour must be used inside TourProvider');
  return value;
}

/** True when the first-visit prompt should be offered for this version. */
export function shouldOfferTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) !== TOUR_VERSION;
  } catch {
    return true;
  }
}

export function markTourOffered(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, TOUR_VERSION);
  } catch {
    /* storage blocked: one extra prompt, never a failure */
  }
}
