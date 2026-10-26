import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowIcon } from './icons';

export interface TourStep {
  /** CSS selector of the real control this step points at. */
  target: string;
  title: string;
  body: string;
}

const KEY = 'fps-tour-v1';

export const tourDone = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return true;
  }
};

export const setTourDone = (done: boolean): void => {
  try {
    if (done) localStorage.setItem(KEY, 'done');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
};

type Box = { x: number; y: number; w: number; h: number };
const PAD = 6;
const CARD_W = 360;

/**
 * First-visit tour of the main menu: a spotlight on the real control and a
 * lower-third caption beside it. Steps follow the controls if the page
 * scrolls or resizes. Skippable at any point (Esc), Enter / right arrow for next.
 */
export const Tour = ({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) => {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  const finish = () => {
    setTourDone(true);
    onClose();
  };

  // Bring the control into view, then keep the spotlight on it.
  useLayoutEffect(() => {
    const el = document.querySelector(step.target);
    el?.scrollIntoView({ block: 'center', behavior: 'auto' });
    let raf = 0;
    const track = () => {
      const r = document.querySelector(step.target)?.getBoundingClientRect();
      setBox((b) => {
        if (!r) return null;
        if (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && b.w === r.width && b.h === r.height) return b;
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  useEffect(() => {
    next.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (last) finish();
        else setI((n) => n + 1);
      } else if (e.key === 'ArrowLeft' && i > 0) {
        e.preventDefault();
        setI((n) => n - 1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, last]);

  // The caption goes below the control when there's room, otherwise above; kept on screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  let left = 12;
  let top = vh / 2 - 90;
  if (box) {
    left = Math.max(12, Math.min(vw - w - 12, box.x));
    const below = box.y + box.h + PAD + 14;
    top = below + 190 < vh ? below : Math.max(12, box.y - PAD - 14 - 190);
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box ? (
        <div className="tour-spot" style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }} />
      ) : (
        <div className="tour-scrim" />
      )}
      <div className="tour-card" key={i} style={{ left, top, width: w }}>
        <div className="tour-head">
          <span className="tour-step">
            {i + 1} / {steps.length}
          </span>
          <h2 id="tour-title">{step.title}</h2>
        </div>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="chip" onClick={finish}>
            Skip tour
          </button>
          {i > 0 && (
            <button className="chip" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button ref={next} className="play tour-next" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? 'Got it' : 'Next'} {!last && <ArrowIcon size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
