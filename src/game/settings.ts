import type { WeaponId } from '../sim/weapons';
import type { SkinChoice } from '../assets/skins';
import { DEFAULT_STREAKS, normalizeStreaks, type StreakId } from '../sim/killstreaks';

/** Rebindable actions (mouse buttons stay fire / aim). */
export const KEY_ACTIONS = [
  ['forward', 'Move forward'],
  ['back', 'Move back'],
  ['left', 'Strafe left'],
  ['right', 'Strafe right'],
  ['jump', 'Jump'],
  ['sprint', 'Sprint'],
  ['crouch', 'Crouch / slide'],
  ['reload', 'Reload'],
  ['melee', 'Knife'],
  ['grenade', 'Grenade'],
  ['weapon1', 'Primary weapon'],
  ['weapon2', 'Secondary weapon'],
  ['swap', 'Swap weapon'],
  ['scores', 'Scoreboard'],
  ['chat', 'Chat (online)']
] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number][0];
export type KeyBinds = Record<KeyAction, string>;

export const DEFAULT_KEYS: KeyBinds = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  reload: 'KeyR',
  melee: 'KeyV',
  grenade: 'KeyG',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  swap: 'KeyQ',
  scores: 'Tab',
  chat: 'KeyT'
};

export type Quality = 'low' | 'medium' | 'high' | 'ultra' | 'custom';

export interface Graphics {
  /** Multiplies the device pixel ratio. Below 1 renders fewer pixels (big speed-up on weak GPUs). */
  renderScale: number;
  shadows: 'off' | 'low' | 'high';
  /** Applies from the next match (the renderer has to be recreated). */
  antialias: boolean;
  /** Particles, smoke and debris. */
  effects: 'low' | 'high';
  /** Draw distance multiplier (fog and camera range). */
  viewDistance: number;
  /** Bodies kept simulated as ragdolls at once. */
  maxRagdolls: number;
}

export const QUALITY_PRESETS: Record<Exclude<Quality, 'custom'>, Graphics> = {
  low: { renderScale: 0.6, shadows: 'off', antialias: false, effects: 'low', viewDistance: 0.6, maxRagdolls: 5 },
  medium: { renderScale: 0.8, shadows: 'low', antialias: false, effects: 'low', viewDistance: 0.85, maxRagdolls: 9 },
  high: { renderScale: 1, shadows: 'high', antialias: true, effects: 'high', viewDistance: 1, maxRagdolls: 14 },
  ultra: { renderScale: 1.25, shadows: 'high', antialias: true, effects: 'high', viewDistance: 1.4, maxRagdolls: 20 }
};

export interface Crosshair {
  color: string;
  size: number;
  gap: number;
  thickness: number;
  dot: boolean;
  /** Gap follows weapon spread. */
  dynamic: boolean;
}

export interface GameSettings {
  sensitivity: number;
  /** Multiplier on sensitivity while aiming down sights. */
  adsSensitivity: number;
  invertY: boolean;
  /** Right mouse toggles aiming instead of holding. */
  toggleAim: boolean;
  /** Crouch key toggles instead of holding. */
  toggleCrouch: boolean;
  fov: number;
  volume: number;
  playerName: string;
  /** Your colour in free-for-all modes (team modes use team colours). */
  playerColor: number;
  /** Your primary weapon. */
  primary: WeaponId;
  secondary: WeaponId;
  /** Chosen skin for each weapon. */
  skins: SkinChoice;
  /** Chosen killstreaks (three). */
  streaks: StreakId[];
  /** Floating damage numbers on hits. */
  damageNumbers: boolean;
  /** The hit marker "tick" sound. */
  hitSounds: boolean;
  /** On-screen touch controls: automatic on touch screens, or forced on / off. */
  touchControls: 'auto' | 'on' | 'off';
  keys: KeyBinds;
  quality: Quality;
  graphics: Graphics;
  crosshair: Crosshair;
  showFps: boolean;
  showPing: boolean;
}

const KEY = 'fps-settings-v3';

export const defaultSettings = (name: string, color: number): GameSettings => ({
  sensitivity: 1,
  adsSensitivity: 0.65,
  invertY: false,
  toggleAim: false,
  toggleCrouch: false,
  fov: 80,
  volume: 0.6,
  playerName: name,
  playerColor: color,
  primary: 'rifle',
  secondary: 'pistol',
  skins: {},
  streaks: DEFAULT_STREAKS.slice(),
  damageNumbers: true,
  hitSounds: true,
  touchControls: 'auto',
  keys: { ...DEFAULT_KEYS },
  quality: 'high',
  graphics: { ...QUALITY_PRESETS.high },
  crosshair: { color: '#ffffff', size: 9, gap: 6, thickness: 2, dot: false, dynamic: true },
  showFps: false,
  showPing: true
});

/** Loads saved settings, filling anything new or missing from the defaults (also reads the older v2 save). */
export const loadSettings = (name: string, color: number): GameSettings => {
  const base = defaultSettings(name, color);
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem('fps-settings-v2') ?? '{}');
    return {
      ...base,
      ...raw,
      keys: { ...base.keys, ...(raw.keys ?? {}) },
      graphics: { ...base.graphics, ...(raw.graphics ?? {}) },
      crosshair: { ...base.crosshair, ...(raw.crosshair ?? {}) },
      skins: { ...(raw.skins ?? {}) },
      streaks: normalizeStreaks(raw.streaks)
    };
  } catch {
    return base;
  }
};

export const saveSettings = (s: GameSettings): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
};

/** A readable name for a key code ("KeyW" -> "W", "ShiftLeft" -> "L-Shift"). */
export const keyLabel = (code: string): string => {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const named: Record<string, string> = {
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    AltRight: 'R-Alt',
    Space: 'Space',
    Tab: 'Tab',
    CapsLock: 'Caps',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backquote: '`'
  };
  return named[code] ?? code;
};

/** A guess at a sensible preset for this device (weak/mobile GPUs and high-DPI laptops start lower). */
export const suggestQuality = (): Exclude<Quality, 'custom'> => {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile || cores <= 2) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
};

/** True on phones and tablets (a coarse pointer and no hover). */
export const isTouchDevice = (): boolean => {
  try {
    return matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches;
  } catch {
    return false;
  }
};

export const touchEnabled = (s: GameSettings): boolean => (s.touchControls === 'auto' ? isTouchDevice() : s.touchControls === 'on');
