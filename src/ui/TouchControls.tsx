import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Game } from '../game/Game';

const STICK_R = 56;

/**
 * On-screen controls for phones and tablets: a floating stick on the left
 * half, drag anywhere on the right half to look, and action buttons. The
 * fire button also turns the view while held, like most mobile shooters.
 */
export const TouchControls = ({ game, onPause, onScores }: { game: Game; onPause: () => void; onScores: (show: boolean) => void }) => {
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const looks = useRef(new Map<number, { x: number; y: number }>());
  const [knob, setKnob] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);

  const stickDown = (e: RPointerEvent) => {
    if (stick.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setKnob({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  };
  const stickMove = (e: RPointerEvent) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    let dx = e.clientX - s.x;
    let dy = e.clientY - s.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      dx = (dx / d) * STICK_R;
      dy = (dy / d) * STICK_R;
    }
    game.touch.moveX = dx / STICK_R;
    game.touch.moveY = dy / STICK_R;
    setKnob({ x: s.x, y: s.y, dx, dy });
  };
  const stickUp = (e: RPointerEvent) => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = null;
    game.touch.moveX = game.touch.moveY = 0;
    setKnob(null);
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
  const hold = (key: 'fire' | 'aim' | 'crouch', label: string, cls: string, toggle = false) => (
    <button
      className={`tc-btn ${cls}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        lookDown(e);
        if (toggle) game.touch[key] = !game.touch[key];
        else game.touch[key] = true;
        if (key === 'fire') game.touchPress('fire');
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
        <div className="tc-stick" style={{ left: knob.x, top: knob.y }}>
          <i style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
        </div>
      )}
      <div className="tc-top">
        <button className="tc-small" onPointerDown={onPause}>
          ❚❚
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
        {tap('reload', 'R', 'reload')}
        {tap('grenade', 'G', 'grenade')}
        {tap('melee', 'KNIFE', 'melee')}
        {tap('swap', 'SWAP', 'swap')}
      </div>
    </div>
  );
};
