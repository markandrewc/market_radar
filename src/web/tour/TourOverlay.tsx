import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from './TourContext';
import type { TourMode, TourStep } from './types';

const CARD_WIDTH = 360;
const CARD_HEIGHT_ESTIMATE = 260;
const GAP = 14;
const FIND_TIMEOUT_MS = 1500;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

interface CardPosition {
  top?: number;
  left?: number;
  width?: number;
}

function cardPosition(rect: DOMRect | null, height = CARD_HEIGHT_ESTIMATE): CardPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 640) return {};
  if (!rect) {
    return {
      top: Math.max(12, (vh - height) / 2),
      left: Math.max(12, (vw - CARD_WIDTH) / 2),
      width: CARD_WIDTH,
    };
  }
  const below = rect.bottom + GAP;
  const above = rect.top - GAP - height;
  const top =
    below + height < vh
      ? below
      : above > 12
        ? above
        : Math.max(12, vh - height - 12);
  const centered = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  const left = Math.min(Math.max(12, centered), Math.max(12, vw - CARD_WIDTH - 12));
  return { top, left, width: CARD_WIDTH };
}

/** Dims the page except the current target, then explains it in a small card. */
export function TourOverlay() {
  const { mode, steps, index, next, back, skip } = useTour();
  if (!mode) return null;
  const step = steps[index];
  if (!step) return null;
  return (
    <StepOverlay
      key={`${mode}-${index}`}
      mode={mode}
      step={step}
      index={index}
      total={steps.length}
      isLast={index === steps.length - 1}
      onNext={next}
      onBack={back}
      onSkip={skip}
    />
  );
}

function StepOverlay({
  mode,
  step,
  index,
  total,
  isLast,
  onNext,
  onBack,
  onSkip,
}: {
  mode: TourMode;
  step: TourStep;
  index: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_ESTIMATE);
  const [targetMissing, setTargetMissing] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = `tour-title-${step.id}`;

  // 1. Move to the page this step talks about (if any).
  useEffect(() => {
    if (step.route && pathname !== step.route) navigate(step.route);
  }, [navigate, pathname, step.route]);

  // 2. Find the element, bring it into view and remember it.
  useEffect(() => {
    if (!step.target) {
      setTargetMissing(false);
      setRect(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + FIND_TIMEOUT_MS;
    const find = () => {
      if (cancelled) return;
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (element) {
        targetRef.current = element;
        element.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        requestAnimationFrame(() => {
          if (cancelled) return;
          setRect(element.getBoundingClientRect());
          setTargetMissing(false);
        });
        return;
      }
      if (Date.now() < deadline) {
        timer = setTimeout(find, 60);
      } else {
        targetRef.current = null;
        setRect(null);
        setTargetMissing(true);
      }
    };
    find();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [step.target]);

  // 3. Keep the highlight in place while the page scrolls or resizes.
  useEffect(() => {
    const measure = () => {
      const element = targetRef.current;
      if (element && element.isConnected) setRect(element.getBoundingClientRect());
    };
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [step.target]);

  // 4. Practice steps advance on a real click inside the highlighted element.
  useEffect(() => {
    if (!step.waitForClick) return;
    const onClick = (event: MouseEvent) => {
      const element = targetRef.current;
      if (element && event.target instanceof Node && element.contains(event.target)) onNext();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [onNext, step.waitForClick]);

  // 5. Keyboard: Esc ends, arrows move, normal buttons keep working.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      } else if (event.key === 'ArrowRight' && !isTypingTarget(event.target)) {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft' && !isTypingTarget(event.target)) {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, onNext, onSkip]);

  // 6. Focus the card on every step so screen readers announce it.
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () => setCardHeight(el.offsetHeight || CARD_HEIGHT_ESTIMATE);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step.id]);

  const position = useMemo(() => (typeof window === 'undefined' ? {} : cardPosition(rect, cardHeight)), [rect, cardHeight]);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <aside aria-label="Guided tour" className="pointer-events-none fixed inset-0 z-[60]">
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-2xl border-2 border-brand-accent"
          style={{
            top: Math.max(4, rect.top - 6),
            left: Math.max(4, rect.left - 6),
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgb(27 27 29 / 0.55)',
          }}
        />
      )}
      {!rect && <div aria-hidden className="fixed inset-0 z-[60] bg-ink/55" />}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'pointer-events-auto fixed z-[61] max-h-[70vh] overflow-y-auto rounded-card border border-line bg-surface p-5 text-ink shadow-float outline-none',
          isMobile ? 'inset-x-3 bottom-3' : '',
        ].join(' ')}
        style={isMobile ? undefined : position}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="kicker flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Guided tour · {mode === 'quick' ? 'Quick' : 'Full'}
          </p>
          <p aria-live="polite" className="meta">
            {index + 1} of {total}
          </p>
        </div>

        <h2 id={titleId} className="mt-2 text-lg font-semibold tracking-tight text-ink">
          {step.title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
        {step.hint && <p className="mt-3 rounded-control bg-brand-soft px-3 py-2 text-sm font-medium text-ink">{step.hint}</p>}
        {targetMissing && (
          <p className="mt-3 text-sm text-ink-soft">
            This part is not on the screen right now — the tour continues without highlighting it.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="h-4 w-4" aria-hidden />
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack} disabled={index === 0}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
            <Button size="sm" onClick={onNext}>
              {isLast ? 'Finish' : step.waitForClick ? 'Skip this step' : 'Next'}
              {!isLast && <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
