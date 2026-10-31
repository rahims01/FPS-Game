import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Game } from '../game/Game';
import { PauseIcon } from './icons';

const STICK_R = 56;
/** Push this far past the centre (in stick radii), roughly forward, and you sprint. */
const SPRINT_AT = 1.05;
/** Drag this far forward and let go: sprint locks on until you touch the stick again. */
const LOCK_AT = 2.1;

/** Roughly forward: within about 55 degrees of straight up. */
const forward = (dx: number, dy: number) => dy < 0 && Math.abs(dx) < -dy * 1.45;

/**
 * On-screen controls for phones and tablets: a floating stick on the left
 * half, drag anywhere on the right half to look, and action buttons. The
 * fire button also turns the view while held, like most mobile shooters.
 *
 * Sprinting: push the stick forward past its ring (or tap SPRINT). Drag
 * further up and let go to lock sprint on and keep running hands-free;
 * touching the stick again takes over.
 */
export const TouchControls = ({ game, onPause, onScores }: { game: Game; onPause: () => void; onScores: (show: boolean) => void }) => {
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const looks = useRef(new Map<number, { x: number; y: number }>());
  const [knob, setKnob] = useState<{ x: number; y: number; dx: number; dy: number; run: 'none' | 'sprint' | 'lock' } | null>(null);
  const [locked, setLocked] = useState(false);
  const lockReady = useRef(false);
  // Toggle buttons light up while on (the game can also switch them off, on death).
  const [on, setOn] = useState({ aim: false, crouch: false, sprint: false });
  useEffect(() => {
    const t = window.setInterval(() => {
      const g = game.touch;
      setOn((o) => (o.aim === g.aim && o.crouch === g.crouch && o.sprint === g.sprint ? o : { aim: g.aim, crouch: g.crouch, sprint: g.sprint }));
      if (!g.runLock) setLocked(false);
    }, 200);
    return () => window.clearInterval(t);
  }, [game]);

  const unlock = () => {
    game.touch.runLock = false;
    game.touch.stickSprint = false;
    game.touch.moveX = game.touch.moveY = 0;
    setLocked(false);
  };

  const stickDown = (e: RPointerEvent) => {
    if (stick.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (game.touch.runLock) unlock();
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    lockReady.current = false;
    setKnob({ x: e.clientX, y: e.clientY, dx: 0, dy: 0, run: 'none' });
  };
  const stickMove = (e: RPointerEvent) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    const rx = e.clientX - s.x;
    const ry = e.clientY - s.y;
    const d = Math.hypot(rx, ry);
    let dx = rx;
    let dy = ry;
    if (d > STICK_R) {
      dx = (dx / d) * STICK_R;
      dy = (dy / d) * STICK_R;
    }
    const fwd = forward(rx, ry);
    const sprint = fwd && d > STICK_R * SPRINT_AT;
    lockReady.current = fwd && d > STICK_R * LOCK_AT;
    game.touch.moveX = dx / STICK_R;
    game.touch.moveY = dy / STICK_R;
    game.touch.stickSprint = sprint;
    setKnob({ x: s.x, y: s.y, dx, dy, run: lockReady.current ? 'lock' : sprint ? 'sprint' : 'none' });
  };
  const stickUp = (e: RPointerEvent) => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = null;
    setKnob(null);
    if (lockReady.current) {
      // Let go while dragged far forward: keep running straight ahead.
      game.touch.runLock = true;
      game.touch.moveX = 0;
      game.touch.moveY = -1;
      game.touch.stickSprint = true;
      setLocked(true);
      return;
    }
    game.touch.moveX = game.touch.moveY = 0;
    game.touch.stickSprint = false;
    // Stopping ends a toggled sprint too.
    game.touch.sprint = false;
  };

  const lookDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    looks.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const lookMove = (e: RPointerEvent) => {
    const p = looks.current.get(e.pointerId);
    if (!p) return;
    game.touchLook(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const lookUp = (e: RPointerEvent) => {
    looks.current.delete(e.pointerId);
  };

  /** A held button (fire, aim, sprint, crouch) that also steers the view while held. */
  const hold = (key: 'fire' | 'aim' | 'crouch' | 'sprint', label: string, cls: string, toggle = false) => (
    <button
      className={`tc-btn ${cls} ${key !== 'fire' && on[key] ? 'on' : ''}`}
      aria-pressed={toggle ? (key !== 'fire' && on[key]) : undefined}
      onPointerDown={(e) => {
        e.stopPropagation();
        lookDown(e);
        if (toggle) game.touch[key] = !game.touch[key];
        else game.touch[key] = true;
        if (key === 'fire') game.touchPress('fire');
        if (key !== 'fire') setOn((o) => ({ ...o, [key]: game.touch[key] }));
      }}
      onPointerMove={lookMove}
      onPointerUp={(e) => {
        lookUp(e);
        if (!toggle) game.touch[key] = false;
      }}
      onPointerCancel={(e) => {
        lookUp(e);
        if (!toggle) game.touch[key] = false;
      }}
    >
      {label}
    </button>
  );

  const tap = (action: Parameters<Game['touchPress']>[0], label: string, cls: string) => (
    <button
      className={`tc-btn ${cls}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        game.touchPress(action);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="touch-controls">
      <div className="tc-stick-zone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} />
      <div className="tc-look-zone" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />
      {knob && (
        <div className={`tc-stick ${knob.run !== 'none' ? 'run' : ''}`} style={{ left: knob.x, top: knob.y }}>
          <span className={`tc-run-guide ${knob.run}`}>{knob.run === 'lock' ? 'Let go: sprint lock' : knob.run === 'sprint' ? 'Sprint · drag up to lock' : 'Push up to sprint'}</span>
          <i style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
        </div>
      )}
      {locked && !knob && <div className="tc-lock">Sprint locked · touch the stick to stop</div>}
      <div className="tc-top">
        <button className="tc-small" onPointerDown={onPause} aria-label="Pause">
          <PauseIcon size={18} />
        </button>
        <button className="tc-small" onPointerDown={() => onScores(true)} onPointerUp={() => onScores(false)} onPointerLeave={() => onScores(false)}>
          Scores
        </button>
      </div>
      <div className="tc-buttons">
        {hold('fire', 'FIRE', 'fire')}
        {hold('aim', 'AIM', 'aim', true)}
        {tap('jump', 'JUMP', 'jump')}
        {hold('crouch', 'CROUCH', 'crouch', true)}
        {hold('sprint', 'SPRINT', 'sprint', true)}
        {tap('reload', 'R', 'reload')}
        {tap('grenade', 'G', 'grenade')}
        {tap('tactical', 'H', 'tactical')}
        {tap('melee', 'KNIFE', 'melee')}
        {tap('swap', 'SWAP', 'swap')}
      </div>
    </div>
  );
};
