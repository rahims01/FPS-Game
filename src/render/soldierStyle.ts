import * as THREE from 'three';
import { finishOf, styleDef } from '../game/cosmetics';
import type { Agent } from '../sim/Agent';

/**
 * Soldier styles: how a soldier wears its colour. Finishes and patterns are
 * set once; animated and interactive ones are updated every frame from the
 * clock and from the soldier's own state (health, streak, speed, hits).
 */

const patternCache = new Map<string, THREE.CanvasTexture>();

const shade = (c: THREE.Color, k: number) => `#${c.clone().multiplyScalar(k).getHexString()}`;

/** A 64x64 tileable pattern in the soldier's colour (a darker and a lighter shade). */
const patternTexture = (id: string, base: number): THREE.CanvasTexture => {
  const key = `${id}:${base}`;
  const hit = patternCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const col = new THREE.Color(base);
  const main = `#${col.getHexString()}`;
  const dark = shade(col, 0.45);
  const light = `#${col.clone().lerp(new THREE.Color(0xffffff), 0.45).getHexString()}`;
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = main;
  g.fillRect(0, 0, 64, 64);
  switch (id) {
    case 'stripes':
      g.fillStyle = dark;
      for (let i = -64; i < 128; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 8, 0);
        g.lineTo(i + 72, 64);
        g.lineTo(i + 64, 64);
        g.fill();
      }
      break;
    case 'checker':
      g.fillStyle = dark;
      for (let x = 0; x < 64; x += 16) for (let y = 0; y < 64; y += 16) if ((x + y) % 32 === 0) g.fillRect(x, y, 16, 16);
      break;
    case 'polka':
      g.fillStyle = light;
      for (let x = 0; x < 64; x += 16) for (let y = 0; y < 64; y += 16) {
        g.beginPath();
        g.arc(x + 8 + ((y / 16) % 2) * 4, y + 8, 3.5, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'camo':
      for (let i = 0; i < 24; i++) {
        g.fillStyle = [dark, light, shade(col, 0.7)][i % 3];
        g.beginPath();
        g.ellipse(rand() * 64, rand() * 64, 4 + rand() * 8, 3 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'zebra':
      g.fillStyle = '#111';
      for (let i = 0; i < 9; i++) {
        const x = i * 8;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 8, 20, x - 6, 42, x + 3, 64);
        g.lineTo(x + 6, 64);
        g.bezierCurveTo(x - 2, 42, x + 12, 20, x + 4, 0);
        g.fill();
      }
      break;
    case 'tiger':
      g.fillStyle = '#141414';
      for (let i = 0; i < 8; i++) {
        const y = i * 8 + rand() * 3;
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(32, y + 6 + rand() * 6, 64, y + rand() * 3);
        g.lineTo(64, y + 3);
        g.quadraticCurveTo(32, y + 9, 0, y + 3);
        g.fill();
      }
      break;
    case 'digital':
      for (let x = 0; x < 64; x += 4) for (let y = 0; y < 64; y += 4) {
        const r = rand();
        if (r < 0.3) {
          g.fillStyle = r < 0.15 ? dark : light;
          g.fillRect(x, y, 4, 4);
        }
      }
      break;
    case 'hex':
      g.strokeStyle = dark;
      g.lineWidth = 2;
      for (let row = 0; row < 7; row++) for (let colI = 0; colI < 6; colI++) {
        const cx = colI * 12 + (row % 2) * 6;
        const cy = row * 10;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          g.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
        }
        g.closePath();
        g.stroke();
      }
      break;
    case 'circuit':
      g.fillStyle = dark;
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = light;
      g.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        let x = Math.floor(rand() * 8) * 8;
        let y = Math.floor(rand() * 8) * 8;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          if (rand() < 0.5) x += (rand() < 0.5 ? -1 : 1) * 8;
          else y += (rand() < 0.5 ? -1 : 1) * 8;
          g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = light;
        g.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      break;
    case 'stars':
      g.fillStyle = shade(col, 0.25);
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = rand() < 0.2 ? light : '#ffffff';
        g.fillRect(rand() * 64, rand() * 64, rand() < 0.1 ? 2 : 1, rand() < 0.1 ? 2 : 1);
      }
      break;
    case 'lava':
      g.fillStyle = '#140400';
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#ff6a00';
      g.lineWidth = 2.5;
      for (let i = 0; i < 14; i++) {
        let x = rand() * 64;
        let y = rand() * 64;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rand() - 0.5) * 18;
          y += (rand() - 0.5) * 18;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  patternCache.set(key, tex);
  return tex;
};

type Mat = THREE.MeshPhongMaterial;

/** Sets a soldier's style once (finish, pattern, transparency); animation happens in `animateStyle`. */
export const applyStyle = (mats: THREE.Material[], styleId: string, base: number): void => {
  const def = styleDef(styleId);
  const col = new THREE.Color(base);
  const finish = styleId === 'none' ? finishOf(base) : null;
  for (const m of mats as Mat[]) {
    if (!m.color) continue;
    m.color.copy(col);
    if (m.emissive) m.emissive.setHex(0);
    m.map = null;
    m.transparent = false;
    m.opacity = 1;
    if ('shininess' in m) {
      m.shininess = 30;
      m.specular?.setHex(0x111111);
    }
    if (styleId === 'matte' && 'shininess' in m) {
      m.shininess = 2;
      m.specular?.setHex(0);
    }
    if ((styleId === 'metal' || finish === 'metal' || styleId === 'trophy') && 'shininess' in m) {
      m.shininess = 140;
      m.specular?.setHex(0xcccccc);
      m.color.multiplyScalar(0.8);
    }
    if ((styleId === 'glow' || finish === 'glow') && m.emissive) m.emissive.copy(col).multiplyScalar(0.55);
    if (def.kind === 'pattern' || styleId === 'lava') {
      m.map = patternTexture(styleId === 'lava' ? 'lava' : styleId, base);
      m.color.setHex(0xffffff);
    }
    if (styleId === 'ghost') {
      m.transparent = true;
      m.opacity = 0.42;
    }
    m.needsUpdate = true;
  }
};

const tmp = new THREE.Color();
const ground = new THREE.Color(0x5a5f4a);

/**
 * Per-frame styles: animated ones from the clock, interactive ones from the
 * soldier (health, streak, speed, kills, when it was last hit).
 */
export const animateStyle = (mats: THREE.Material[], styleId: string, base: number, a: Agent, time: number, seed: number): void => {
  const def = styleDef(styleId);
  if (def.kind !== 'animated' && def.kind !== 'interactive') return;
  const col = tmp.setHex(base);
  const set = (fn: (m: Mat) => void) => {
    for (const m of mats as Mat[]) if (m.color) fn(m);
  };
  const t = time + seed * 1.7;
  switch (styleId) {
    case 'sovereign': {
      // Gold, with a light sweeping head to toe.
      const sweep = Math.max(0, Math.sin(t * 1.6));
      set((m) => {
        m.color.setRGB(0.95, 0.72, 0.16);
        m.emissive?.setRGB(0.35 + 0.65 * sweep ** 6, 0.24 + 0.5 * sweep ** 6, 0.04 + 0.3 * sweep ** 6);
      });
      break;
    }
    case 'pulse': {
      const k = 0.1 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2));
      set((m) => m.emissive?.copy(col).multiplyScalar(k));
      break;
    }
    case 'rainbow':
      set((m) => {
        m.color.setHSL((t * 0.15) % 1, 0.85, 0.55);
        m.emissive?.copy(m.color).multiplyScalar(0.25);
      });
      break;
    case 'mono': {
      const l = 0.08 + 0.84 * (0.5 + 0.5 * Math.sin(t * 1.4));
      set((m) => {
        m.color.setRGB(l, l, l);
        m.emissive?.setRGB(l * 0.15, l * 0.15, l * 0.15);
      });
      break;
    }
    case 'holo': {
      const hsl = { h: 0, s: 0, l: 0 };
      col.getHSL(hsl);
      set((m) => {
        m.color.setHSL((hsl.h + 0.18 * Math.sin(t * 1.3 + a.yaw * 2) + 1) % 1, 0.7, 0.66);
        m.emissive?.copy(m.color).multiplyScalar(0.3);
        if ('shininess' in m) m.shininess = 120;
      });
      break;
    }
    case 'glitch': {
      // Mostly your colour, with sudden jumps and flickers.
      const slot = Math.floor(t * 9);
      const r = Math.abs(Math.sin(slot * 12.9898 + seed) * 43758.5453) % 1;
      set((m) => {
        if (r < 0.18) m.color.setHSL(r * 5.5, 1, 0.55);
        else m.color.copy(col);
        m.emissive?.setScalar(r > 0.9 ? 0.8 : 0);
      });
      break;
    }
    case 'lava': {
      set((m) => {
        if (m.map) m.map.offset.set(t * 0.02, t * 0.035);
        m.emissive?.setRGB(0.6 + 0.3 * Math.sin(t * 2), 0.18, 0.02);
      });
      break;
    }
    case 'electric': {
      const flick = Math.random() < 0.12 ? 1 : 0.15 + 0.1 * Math.sin(t * 30);
      set((m) => m.emissive?.copy(col).lerp(new THREE.Color(0xffffff), 0.5).multiplyScalar(flick));
      break;
    }
    case 'aurora':
      set((m) => {
        m.color.setHSL(0.36 + 0.42 * (0.5 + 0.5 * Math.sin(t * 0.7)), 0.8, 0.55);
        m.emissive?.copy(m.color).multiplyScalar(0.35);
      });
      break;
    case 'ghost': {
      const o = 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3));
      set((m) => {
        m.opacity = o;
        m.emissive?.copy(col).multiplyScalar(0.4);
      });
      break;
    }
    case 'voidwalker':
      set((m) => {
        m.color.setRGB(0.04, 0.02, 0.08);
        m.emissive?.setHSL((0.78 + 0.08 * Math.sin(t * 1.1)) % 1, 1, 0.12 + 0.1 * Math.sin(t * 2.4));
      });
      break;
    case 'heartbeat': {
      // Faster and stronger the lower your health.
      const hurt = 1 - Math.max(0, Math.min(1, a.hp / 100));
      const rate = 1 + hurt * 3;
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * rate)), 8);
      set((m) => m.emissive?.setRGB(0.3 + 0.7 * beat * (0.4 + hurt), 0.02, 0.04).multiplyScalar(0.3 + beat));
      break;
    }
    case 'streakheat': {
      const k = Math.min(1, a.streak / 8);
      set((m) => m.emissive?.setRGB(1 * k, 0.55 * k * k, 0.15 * k * k * k).multiplyScalar(0.2 + 0.8 * k));
      break;
    }
    case 'chameleon': {
      const still = Math.hypot(a.vx, a.vz) < 0.5 || a.crouching;
      set((m) => {
        const want = still ? ground : col;
        m.color.lerp(want, 0.05);
      });
      break;
    }
    case 'thermal': {
      const speed = Math.min(1, Math.hypot(a.vx, a.vz) / 6.5);
      set((m) => {
        m.color.setHSL(0.66 * (1 - speed), 0.95, 0.5);
        m.emissive?.copy(m.color).multiplyScalar(0.35);
      });
      break;
    }
    case 'hitflash': {
      const since = time - a.lastHitT;
      const k = since < 0.35 ? 1 - since / 0.35 : 0;
      set((m) => m.emissive?.setScalar(k * 0.9));
      break;
    }
    case 'trophy': {
      const k = Math.min(1, a.kills / 15);
      set((m) => {
        m.color.copy(col).lerp(new THREE.Color(0xe8b63a), k);
        m.emissive?.setRGB(0.3 * k, 0.2 * k, 0);
      });
      break;
    }
  }
};

// ---------------------------------------------------------------- name tags

/** Draws a name tag (and title) in one of the name-tag styles. */
export const drawNametag = (g: CanvasRenderingContext2D, w: number, name: string, color: string, style: string, title: string | null): void => {
  const cx = w / 2;
  const y = 46;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 54px "Segoe UI", system-ui, sans-serif';
  const tw = Math.min(w - 20, g.measureText(name).width + 50);
  const plate = (fill: string | CanvasGradient, border: string) => {
    g.fillStyle = fill;
    g.strokeStyle = border;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(cx - tw / 2, y - 34, tw, 68, 18);
    g.fill();
    g.stroke();
  };
  const n = parseInt(color.slice(1), 16);
  const dark = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 70;
  switch (style) {
    case 'outline':
      g.lineWidth = 16;
      g.strokeStyle = dark ? '#fff' : '#000';
      g.strokeText(name, cx, y);
      g.fillStyle = color;
      g.fillText(name, cx, y);
      break;
    case 'admin': {
      // A gold plate with a crown above the name.
      const grad = g.createLinearGradient(0, y - 34, 0, y + 34);
      grad.addColorStop(0, '#fff6c8');
      grad.addColorStop(0.45, '#ffc400');
      grad.addColorStop(1, '#7a5800');
      plate(grad, '#fff3c2');
      g.fillStyle = '#1b1200';
      g.fillText(name, cx, y + 2);
      g.fillStyle = '#ffd23d';
      g.fillText('♛', cx, y - 62);
      break;
    }
    case 'gold': {
      const grad = g.createLinearGradient(0, y - 34, 0, y + 34);
      grad.addColorStop(0, '#fff1a8');
      grad.addColorStop(0.5, '#d4a933');
      grad.addColorStop(1, '#8a6510');
      plate(grad, '#5a3f08');
      g.fillStyle = '#1b1200';
      g.fillText(name, cx, y + 2);
      break;
    }
    case 'neon':
      g.shadowColor = color;
      g.shadowBlur = 26;
      g.fillStyle = '#ffffff';
      g.fillText(name, cx, y);
      g.fillText(name, cx, y);
      g.shadowBlur = 0;
      break;
    case 'ice': {
      const grad = g.createLinearGradient(0, y - 34, 0, y + 34);
      grad.addColorStop(0, 'rgba(230,250,255,0.95)');
      grad.addColorStop(1, 'rgba(120,200,240,0.9)');
      plate(grad, '#e6faff');
      g.fillStyle = '#0b2a3a';
      g.fillText(name, cx, y + 2);
      break;
    }
    case 'flame': {
      g.shadowColor = '#ff6a00';
      g.shadowBlur = 22;
      const grad = g.createLinearGradient(0, y - 28, 0, y + 28);
      grad.addColorStop(0, '#fff3a0');
      grad.addColorStop(0.5, '#ff9a1a');
      grad.addColorStop(1, '#d22a00');
      g.fillStyle = grad;
      g.fillText(name, cx, y);
      g.shadowBlur = 0;
      break;
    }
    case 'royal': {
      plate('rgba(58,28,113,0.95)', '#ffd34d');
      g.fillStyle = '#ffe58a';
      g.fillText(name, cx, y + 2);
      break;
    }
    case 'rainbow': {
      const grad = g.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
      ['#ff3b3b', '#ffb03b', '#fff23b', '#3bff6b', '#3bb9ff', '#a03bff'].forEach((c, i, all) => grad.addColorStop(i / (all.length - 1), c));
      g.lineWidth = 10;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(name, cx, y);
      g.fillStyle = grad;
      g.fillText(name, cx, y);
      break;
    }
    case 'toxic':
      g.shadowColor = '#7dff2a';
      g.shadowBlur = 28;
      g.fillStyle = '#c8ff8a';
      g.fillText(name, cx, y);
      g.shadowBlur = 0;
      break;
    default:
      g.lineWidth = 10;
      g.strokeStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
      g.strokeText(name, cx, y);
      g.fillStyle = color;
      g.fillText(name, cx, y);
  }
  if (title) {
    g.font = 'italic 600 26px "Segoe UI", system-ui, sans-serif';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(title, cx, y + 50);
    g.fillStyle = '#e8e2c8';
    g.fillText(title, cx, y + 50);
  }
};
