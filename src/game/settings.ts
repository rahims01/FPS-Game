import type { WeaponId } from '../sim/weapons';
import type { SkinChoice } from '../assets/skins';
import { DEFAULT_STREAKS, normalizeStreaks, type StreakId } from '../sim/killstreaks';
import { DEFAULT_PERKS, normalizePerks, type PerkId, type ThrowableId } from '../sim/gear';
import { DEFAULT_COSMETICS, type Cosmetics } from './cosmetics';
import { localSaved } from './saveHook';
import type { AttachChoice } from '../sim/attachments';

/** Rebindable actions. Any of them can take a key or a mouse button ("Mouse0" = left, "Mouse2" = right). */
export const KEY_ACTIONS = [
  ['fire', 'Fire'],
  ['aim', 'Aim down sights'],
  ['forward', 'Move forward'],
  ['back', 'Move back'],
  ['left', 'Strafe left'],
  ['right', 'Strafe right'],
  ['jump', 'Jump'],
  ['sprint', 'Sprint'],
  ['crouch', 'Crouch / slide'],
  ['reload', 'Reload'],
  ['melee', 'Knife'],
  ['grenade', 'Lethal (grenade, knife…)'],
  ['tactical', 'Tactical (flash, smoke)'],
  ['weapon1', 'Primary weapon'],
  ['weapon2', 'Secondary weapon'],
  ['swap', 'Swap weapon'],
  ['scores', 'Scoreboard'],
  ['chat', 'Chat (online)'],
  ['cycle', 'Next gun (practice)']
] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number][0];
export type KeyBinds = Record<KeyAction, string>;

export const DEFAULT_KEYS: KeyBinds = {
  fire: 'Mouse0',
  aim: 'Mouse2',
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
  tactical: 'KeyH',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  swap: 'KeyQ',
  scores: 'Tab',
  chat: 'KeyT',
  cycle: 'KeyB'
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
  /**
   * Weak devices: low-detail soldier models, and soldiers out of view skip
   * their animation. Biggest saving in matches with many players.
   */
  simpleSoldiers: boolean;
}

export const QUALITY_PRESETS: Record<Exclude<Quality, 'custom'>, Graphics> = {
  low: { renderScale: 0.6, shadows: 'off', antialias: false, effects: 'low', viewDistance: 0.6, maxRagdolls: 4, simpleSoldiers: true },
  medium: { renderScale: 0.8, shadows: 'low', antialias: false, effects: 'low', viewDistance: 0.85, maxRagdolls: 9, simpleSoldiers: false },
  high: { renderScale: 1, shadows: 'high', antialias: true, effects: 'high', viewDistance: 1, maxRagdolls: 14, simpleSoldiers: false },
  ultra: { renderScale: 1.25, shadows: 'high', antialias: true, effects: 'high', viewDistance: 1.4, maxRagdolls: 20, simpleSoldiers: false }
};

export type Colorblind = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface Accessibility {
  colorblind: Colorblind;
  /** HUD and menu text size, 0.85 .. 1.4. */
  uiScale: number;
  /** No screen shake, weapon bob or camera tilt. */
  reduceMotion: boolean;
  /** Arrows on screen for nearby gunfire and footsteps. */
  visualSound: boolean;
  /** Dimmer flashbangs and explosions. */
  reduceFlash: boolean;
  /** Solid backgrounds behind HUD text. */
  highContrast: boolean;
}

export interface PadSettings {
  sensitivity: number;
  /** Slows your aim over enemies and nudges it along with them. */
  aimAssist: boolean;
  invertY: boolean;
  deadzone: number;
}

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
  /** First-match control hints in the HUD. */
  hints: boolean;
  /** Blood sprays and pools (off: hits kick up dust). */
  blood: boolean;
  /** Classroom mode: no blood, sparks on hits, takedowns instead of kills. */
  classroom: boolean;
  /** Weapon attachments by gun. */
  attachments: AttachChoice;
  /** On-screen touch controls: automatic on touch screens, or forced on / off. */
  touchControls: 'auto' | 'on' | 'off';
  lethal: ThrowableId;
  tactical: ThrowableId;
  perks: PerkId[];
  cosmetics: Cosmetics;
  access: Accessibility;
  pad: PadSettings;
  /** Frame cap (0 = match the display). */
  fpsLimit: number;
  /** Off: draw frames as fast as possible (lower input lag, more power). */
  vsync: boolean;
  keys: KeyBinds;
  quality: Quality;
  /** Step the quality down by itself when matches run slowly (turned off by picking a quality yourself). */
  autoQuality: boolean;
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
  hints: true,
  blood: true,
  classroom: false,
  attachments: {},
  touchControls: 'auto',
  lethal: 'frag',
  tactical: 'flash',
  perks: DEFAULT_PERKS.slice(),
  cosmetics: { ...DEFAULT_COSMETICS },
  access: { colorblind: 'off', uiScale: 1, reduceMotion: false, visualSound: false, reduceFlash: false, highContrast: false },
  pad: { sensitivity: 1, aimAssist: true, invertY: false, deadzone: 0.15 },
  fpsLimit: 0,
  vsync: true,
  keys: { ...DEFAULT_KEYS },
  quality: 'high',
  autoQuality: true,
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
    // Saves from before simplified soldiers existed: Low turns them on.
    if (raw.graphics && raw.graphics.simpleSoldiers === undefined) raw.graphics.simpleSoldiers = raw.quality === 'low';
    return {
      ...base,
      ...raw,
      keys: { ...base.keys, ...(raw.keys ?? {}) },
      graphics: { ...base.graphics, ...(raw.graphics ?? {}) },
      crosshair: { ...base.crosshair, ...(raw.crosshair ?? {}) },
      skins: { ...(raw.skins ?? {}) },
      streaks: normalizeStreaks(raw.streaks),
      perks: normalizePerks(raw.perks),
      cosmetics: { ...base.cosmetics, ...(raw.cosmetics ?? {}) },
      access: { ...base.access, ...(raw.access ?? {}) },
      pad: { ...base.pad, ...(raw.pad ?? {}) }
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
  localSaved();
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
  const mouse = ['Left click', 'Middle click', 'Right click', 'Mouse 4', 'Mouse 5'];
  if (code.startsWith('Mouse')) return mouse[+code.slice(5)] ?? `Mouse ${+code.slice(5) + 1}`;
  return named[code] ?? code;
};

/** A guess at a sensible preset for this device (weak/mobile GPUs and high-DPI laptops start lower). */
export const suggestQuality = (): Exclude<Quality, 'custom'> => {
  const cores = navigator.hardwareConcurrency ?? 4;
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad/i.test(ua);
  // Chromebooks (CrOS) and low-memory devices are mostly school-grade hardware.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile || cores <= 2 || /CrOS/.test(ua) || memory <= 4 || weakGpu()) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
};

/** Integrated or software graphics that struggle with a full lobby. */
const weakGpu = (): boolean => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|Software|Mali|PowerVR|Adreno \(TM\) [1-5]\d\d|Intel.*(\bHD Graphics|UHD Graphics 60[05])/i.test(name);
  } catch {
    return false;
  }
};

/** The next preset down, for stepping quality down when a match runs slowly. */
export const lowerQuality = (q: Quality): Exclude<Quality, 'custom'> | null =>
  q === 'ultra' ? 'high' : q === 'high' ? 'medium' : q === 'medium' || q === 'custom' ? 'low' : null;

/** True on phones and tablets (a coarse pointer and no hover). */
export const isTouchDevice = (): boolean => {
  try {
    return matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches;
  } catch {
    return false;
  }
};

export const touchEnabled = (s: GameSettings): boolean => (s.touchControls === 'auto' ? isTouchDevice() : s.touchControls === 'on');
