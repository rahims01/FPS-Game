/**
 * Controller support through the browser Gamepad API (Xbox / PlayStation
 * layouts use the same "standard" mapping):
 *
 *   left stick move (click: sprint)    right stick look (click: knife)
 *   RT fire   LT aim   RB lethal   LB tactical
 *   A jump    B crouch / slide    X reload    Y swap weapon
 *   Start pause   Back scoreboard   D-pad up: chat (online)
 */
export interface PadFrame {
  connected: boolean;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  aim: boolean;
  sprint: boolean;
  crouch: boolean;
  scores: boolean;
  /** Buttons pressed this frame (edges). */
  pressed: Set<PadButton>;
}

export type PadButton = 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'back' | 'start' | 'ls' | 'rs' | 'up' | 'down' | 'left' | 'right';

const ORDER: PadButton[] = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];

const dead = (v: number, dz: number): number => {
  const a = Math.abs(v);
  if (a < dz) return 0;
  // Rescale so the stick still reaches 1 past the deadzone.
  return Math.sign(v) * ((a - dz) / (1 - dz));
};

export class Gamepads {
  private prev = new Set<PadButton>();
  deadzone = 0.15;

  /** The first connected controller this frame. */
  poll(): PadFrame {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected) ?? null;
    const frame: PadFrame = { connected: !!pad, moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, aim: false, sprint: false, crouch: false, scores: false, pressed: new Set() };
    if (!pad) {
      this.prev.clear();
      return frame;
    }
    const ax = (i: number) => dead(pad.axes[i] ?? 0, this.deadzone);
    frame.moveX = ax(0);
    frame.moveY = ax(1);
    // A response curve: fine aim near the centre, fast turns at full tilt.
    const curve = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.8);
    frame.lookX = curve(ax(2));
    frame.lookY = curve(ax(3));
    const held = new Set<PadButton>();
    ORDER.forEach((name, i) => {
      const b = pad.buttons[i];
      if (b && (b.pressed || b.value > 0.4)) held.add(name);
    });
    frame.fire = held.has('rt');
    frame.aim = held.has('lt');
    frame.sprint = held.has('ls');
    frame.crouch = held.has('b');
    frame.scores = held.has('back');
    for (const b of held) if (!this.prev.has(b)) frame.pressed.add(b);
    this.prev = held;
    return frame;
  }
}

/**
 * Menu navigation with a controller: the D-pad or left stick moves focus to
 * the nearest button in that direction, A clicks it, B goes back (Escape).
 */
export class PadMenus {
  private pads = new Gamepads();
  private raf = 0;
  private lastMove = 0;
  onBack: (() => void) | null = null;

  start(): void {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const f = this.pads.poll();
      if (!f.connected) return;
      const now = performance.now();
      const dir = f.pressed.has('up') || (f.moveY < -0.6 && now - this.lastMove > 220) ? 'up' : f.pressed.has('down') || (f.moveY > 0.6 && now - this.lastMove > 220) ? 'down' : f.pressed.has('left') || (f.moveX < -0.6 && now - this.lastMove > 220) ? 'left' : f.pressed.has('right') || (f.moveX > 0.6 && now - this.lastMove > 220) ? 'right' : null;
      if (dir) {
        this.lastMove = now;
        this.move(dir);
      }
      if (f.pressed.has('a')) (document.activeElement as HTMLElement | null)?.click();
      if (f.pressed.has('b')) this.onBack?.();
    };
    tick();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private move(dir: 'up' | 'down' | 'left' | 'right'): void {
    const items = [...document.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, [tabindex="0"]')].filter((e) => e.offsetParent !== null);
    if (!items.length) return;
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !items.includes(cur)) {
      items[0].focus();
      return;
    }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const e of items) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect();
      const dx = b.left + b.width / 2 - cx;
      const dy = b.top + b.height / 2 - cy;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along <= 4) continue;
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest' });
    }
  }
}
