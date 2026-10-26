import * as THREE from 'three';

/**
 * Weapon skins (camos). Each one is unlocked per weapon by getting kills with
 * that weapon, so a gold M16 says something about the player holding it.
 * The patterns are painted on small canvases; nothing is downloaded.
 */
export type SkinId =
  | 'none' | 'woodland' | 'desert' | 'arctic' | 'digital' | 'tiger' | 'carbon' | 'crimson' | 'neon' | 'gold' | 'diamond'
  | 'cherry' | 'zebra' | 'hex' | 'ocean' | 'ice' | 'rainbow' | 'toxic' | 'lava' | 'dragon' | 'galaxy' | 'bloodstone' | 'spectral'
  | 'urban' | 'jungle' | 'leopard' | 'marble' | 'woodgrain' | 'cyber' | 'emerald' | 'obsidian'
  | 'damascus' | 'darkmatter'
  | 'plasma' | 'matrix' | 'shift' | 'magma' | 'neonpulse'
  | 'bloodline' | 'ember' | 'frost';

export interface SkinDef {
  id: SkinId;
  name: string;
  /** Kills with the weapon needed to unlock it. */
  kills: number;
  /** CSS swatch for the menu. */
  swatch: string;
  /** Moves on its own, or changes with your kills this match. */
  kind?: 'animated' | 'reactive' | 'mastery';
}

export const SKINS: SkinDef[] = [
  { id: 'none', name: 'Factory', kills: 0, swatch: '#2b2d30' },
  { id: 'woodland', name: 'Woodland', kills: 5, swatch: 'linear-gradient(135deg,#4d5a2c 0 35%,#6b4f2c 35% 60%,#1f241a 60%)' },
  { id: 'desert', name: 'Desert', kills: 10, swatch: 'linear-gradient(135deg,#c8ad7f 0 40%,#8f7350 40% 70%,#e0cfa8 70%)' },
  { id: 'arctic', name: 'Arctic', kills: 20, swatch: 'linear-gradient(135deg,#eef2f5 0 45%,#9aa6b0 45% 70%,#5b6670 70%)' },
  { id: 'digital', name: 'Digital', kills: 30, swatch: 'repeating-linear-gradient(90deg,#3b4b63 0 6px,#5f7590 6px 12px,#25303f 12px 18px)' },
  { id: 'tiger', name: 'Tiger', kills: 45, swatch: 'repeating-linear-gradient(120deg,#e07a1f 0 7px,#151515 7px 11px)' },
  { id: 'carbon', name: 'Carbon', kills: 60, swatch: 'repeating-linear-gradient(45deg,#1a1a1a 0 3px,#3a3a3a 3px 6px)' },
  { id: 'crimson', name: 'Crimson', kills: 80, swatch: 'linear-gradient(135deg,#b3122e,#5a0716)' },
  { id: 'neon', name: 'Neon', kills: 110, swatch: 'repeating-linear-gradient(135deg,#0b0f1a 0 6px,#19e6ff 6px 8px,#ff2bd6 8px 10px)' },
  { id: 'gold', name: 'Gold', kills: 150, swatch: 'linear-gradient(135deg,#fff1a8,#d4a933 45%,#8a6510)' },
  { id: 'diamond', name: 'Diamond', kills: 250, swatch: 'linear-gradient(135deg,#ffffff,#a8e9ff 40%,#5fb8e6 70%,#e6f9ff)' },
  { id: 'cherry', name: 'Cherry Blossom', kills: 15, swatch: 'radial-gradient(circle at 30% 30%,#ffd1e0 0 18%,transparent 19%),radial-gradient(circle at 70% 65%,#ff9ec0 0 16%,transparent 17%),#3a2a2e' },
  { id: 'zebra', name: 'Zebra', kills: 25, swatch: 'repeating-linear-gradient(110deg,#f2f2f2 0 6px,#111 6px 11px)' },
  { id: 'hex', name: 'Hex', kills: 40, swatch: 'repeating-linear-gradient(60deg,#1f2a33 0 6px,#37505f 6px 8px),#1f2a33' },
  { id: 'ocean', name: 'Ocean', kills: 55, swatch: 'repeating-radial-gradient(circle at 0 100%,#0b4f6c 0 6px,#18a0c4 6px 10px)' },
  { id: 'ice', name: 'Glacier', kills: 70, swatch: 'linear-gradient(135deg,#e8fbff,#9ad7ee 50%,#4aa3c7)' },
  { id: 'rainbow', name: 'Rainbow', kills: 90, swatch: 'linear-gradient(90deg,#ff3b3b,#ffb03b,#fff23b,#3bff6b,#3bb9ff,#a03bff)' },
  { id: 'toxic', name: 'Toxic', kills: 120, swatch: 'radial-gradient(circle at 40% 40%,#b6ff3b 0 22%,transparent 23%),#14240a' },
  { id: 'lava', name: 'Lava', kills: 140, swatch: 'linear-gradient(135deg,#1a0500,#ff4e00 40%,#1a0500 55%,#ffb000)' },
  { id: 'dragon', name: 'Dragon Scale', kills: 180, swatch: 'repeating-radial-gradient(circle at 50% 0,#0d3b2a 0 5px,#1f7a52 5px 7px)' },
  { id: 'galaxy', name: 'Galaxy', kills: 220, swatch: 'radial-gradient(circle at 30% 40%,#8f5cff 0,transparent 40%),radial-gradient(circle at 70% 60%,#2bd2ff 0,transparent 35%),#0a0618' },
  { id: 'bloodstone', name: 'Bloodstone', kills: 300, swatch: 'linear-gradient(135deg,#120006,#7a0019 45%,#2a0008 60%,#c4002e)' },
  { id: 'spectral', name: 'Spectral', kills: 400, swatch: 'linear-gradient(135deg,#d9fff9,#7affe4 40%,#c9b6ff 70%,#ffffff)' },
  { id: 'urban', name: 'Urban', kills: 8, swatch: 'linear-gradient(135deg,#6b6f73 0 30%,#3a3d40 30% 60%,#9aa0a6 60%)' },
  { id: 'jungle', name: 'Jungle', kills: 18, swatch: 'linear-gradient(135deg,#1f3a12 0 35%,#3d6b1f 35% 60%,#0d1a08 60%)' },
  { id: 'leopard', name: 'Leopard', kills: 35, swatch: 'radial-gradient(circle at 30% 30%,#2a1a0a 0 12%,transparent 13%),radial-gradient(circle at 70% 70%,#2a1a0a 0 12%,transparent 13%),#d9a54a' },
  { id: 'marble', name: 'Marble', kills: 65, swatch: 'linear-gradient(120deg,#f2f2f2,#cfcfcf 40%,#ffffff 60%,#bdbdbd)' },
  { id: 'woodgrain', name: 'Walnut', kills: 80, swatch: 'repeating-linear-gradient(90deg,#5a3418 0 4px,#7a4a22 4px 7px)' },
  { id: 'cyber', name: 'Cyber', kills: 100, swatch: 'linear-gradient(135deg,#0a0a12,#ff2bd6 50%,#19e6ff)' },
  { id: 'emerald', name: 'Emerald', kills: 160, swatch: 'linear-gradient(135deg,#a8ffcf,#1fae5a 50%,#0b3d1f)' },
  { id: 'obsidian', name: 'Obsidian', kills: 260, swatch: 'linear-gradient(135deg,#000,#2b2340 50%,#000)' },
  { id: 'damascus', name: 'Damascus', kills: 200, kind: 'mastery', swatch: 'repeating-radial-gradient(circle at 0 50%,#8a8f96 0 3px,#3a3d40 3px 6px)' },
  { id: 'darkmatter', name: 'Dark Matter', kills: 500, kind: 'mastery', swatch: 'radial-gradient(circle at 40% 40%,#7a2bff 0,transparent 40%),radial-gradient(circle at 70% 70%,#ff2bd6 0,transparent 30%),#05000c' },
  { id: 'plasma', name: 'Plasma', kills: 130, kind: 'animated', swatch: 'linear-gradient(90deg,#0a1aff,#19e6ff,#0a1aff)' },
  { id: 'matrix', name: 'Digital Rain', kills: 170, kind: 'animated', swatch: 'repeating-linear-gradient(90deg,#001a00 0 5px,#2aff5a 5px 6px)' },
  { id: 'shift', name: 'Aurora Shift', kills: 230, kind: 'animated', swatch: 'linear-gradient(90deg,#2aff9a,#2a8aff,#b42aff)' },
  { id: 'magma', name: 'Magma', kills: 320, kind: 'animated', swatch: 'radial-gradient(circle,#ffb000 0,#ff4e00 30%,#2a0500 70%)' },
  { id: 'neonpulse', name: 'Neon Pulse', kills: 450, kind: 'animated', swatch: 'linear-gradient(135deg,#ff2bd6,#0b0f1a 50%,#19e6ff)' },
  { id: 'bloodline', name: 'Bloodline', kills: 60, kind: 'reactive', swatch: 'linear-gradient(90deg,#3a3d40,#8a0a1a)' },
  { id: 'ember', name: 'Ember', kills: 110, kind: 'reactive', swatch: 'linear-gradient(90deg,#2a2a2a,#ff7a1a)' },
  { id: 'frost', name: 'Frostbite', kills: 190, kind: 'reactive', swatch: 'linear-gradient(90deg,#3a3d40,#bff3ff)' }
].sort((a, b) => a.kills - b.kills) as SkinDef[];

export const skinDef = (id: SkinId): SkinDef => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Paints a 64x64 tileable pattern. */
const paint = (draw: (g: CanvasRenderingContext2D, rand: () => number) => void): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  draw(g, rand);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
};

const blobs = (colors: string[]) =>
  paint((g, rand) => {
    g.fillStyle = colors[0];
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = colors[1 + (i % (colors.length - 1))];
      g.beginPath();
      g.ellipse(rand() * 64, rand() * 64, 4 + rand() * 9, 3 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  });

const materials = new Map<SkinId, THREE.MeshStandardMaterial>();

/** Animated camos: one shared material each, moved every frame by tickSkins(). */
const animated: ((t: number) => void)[] = [];

const animatedMaterial = (id: SkinId): THREE.MeshStandardMaterial => {
  let m: THREE.MeshStandardMaterial;
  switch (id) {
    case 'plasma': {
      const tex = paint((g) => {
        const grad = g.createLinearGradient(0, 0, 64, 0);
        grad.addColorStop(0, '#0a1aff');
        grad.addColorStop(0.5, '#19e6ff');
        grad.addColorStop(1, '#0a1aff');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      });
      m = new THREE.MeshStandardMaterial({ color: 0x1a2a6a, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, roughness: 0.3 });
      animated.push((t) => {
        tex.offset.x = t * 0.35;
        m.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 3);
      });
      break;
    }
    case 'matrix': {
      const tex = paint((g, rand) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 64, 64);
        for (let x = 0; x < 64; x += 4) {
          const len = 6 + rand() * 20;
          const y0 = rand() * 64;
          for (let k = 0; k < len; k++) {
            g.fillStyle = `rgba(42,255,90,${1 - k / len})`;
            g.fillRect(x, (y0 - k * 2 + 64) % 64, 3, 2);
          }
        }
      });
      m = new THREE.MeshStandardMaterial({ color: 0x001a00, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.4 });
      animated.push((t) => {
        tex.offset.y = -t * 0.6;
      });
      break;
    }
    case 'shift': {
      m = new THREE.MeshStandardMaterial({ color: 0x2aff9a, metalness: 0.4, roughness: 0.25, emissive: 0x0a2a2a });
      const c = new THREE.Color();
      animated.push((t) => {
        c.setHSL((0.33 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.6))) % 1, 0.85, 0.55);
        m.color.copy(c);
        m.emissive.copy(c).multiplyScalar(0.2);
      });
      break;
    }
    case 'magma': {
      const tex = paint((g, rand) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 64, 64);
        g.strokeStyle = '#ff6a00';
        g.lineWidth = 2.5;
        for (let i = 0; i < 16; i++) {
          let x = rand() * 64;
          let y = rand() * 64;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (rand() - 0.5) * 16;
            y += (rand() - 0.5) * 16;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      });
      m = new THREE.MeshStandardMaterial({ color: 0x1a0500, emissive: 0xffffff, emissiveMap: tex, roughness: 0.7 });
      animated.push((t) => {
        tex.offset.set(t * 0.03, t * 0.05);
        m.emissiveIntensity = 1.1 + 0.6 * Math.sin(t * 2.2) * Math.sin(t * 0.7);
      });
      break;
    }
    case 'neonpulse': {
      const tex = paint((g) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 64, 64);
        g.lineWidth = 3;
        for (let i = -64; i < 128; i += 16) {
          g.strokeStyle = i % 32 === 0 ? '#19e6ff' : '#ff2bd6';
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + 64, 64);
          g.stroke();
        }
      });
      m = new THREE.MeshStandardMaterial({ color: 0x0b0f1a, emissive: 0xffffff, emissiveMap: tex, roughness: 0.4 });
      animated.push((t) => {
        m.emissiveIntensity = 0.4 + 1.2 * Math.pow(0.5 + 0.5 * Math.sin(t * 4), 2);
        tex.offset.x = t * 0.1;
      });
      break;
    }
    default: {
      // Dark Matter: a slowly swirling void with purple and pink highlights.
      const tex = paint((g, rand) => {
        g.fillStyle = '#05000c';
        g.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 40; i++) {
          const x = rand() * 64;
          const y = rand() * 64;
          const r = 2 + rand() * 7;
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, rand() < 0.5 ? 'rgba(122,43,255,0.9)' : 'rgba(255,43,214,0.8)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
      });
      m = new THREE.MeshStandardMaterial({ color: 0x0a0414, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, metalness: 0.6, roughness: 0.2 });
      animated.push((t) => {
        tex.rotation = t * 0.08;
        tex.offset.set(Math.sin(t * 0.2) * 0.3, t * 0.04);
        m.emissiveIntensity = 0.8 + 0.3 * Math.sin(t * 1.3);
      });
    }
  }
  return m;
};

/** Moves the animated camos (call once per frame). */
export const tickSkins = (time: number): void => {
  for (const f of animated) f(time);
};

/** Reactive camos start plain and change with your kills this match (0..1 = 0..10 kills). */
const reactiveMaterial = (id: SkinId): THREE.MeshStandardMaterial => {
  const m = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.5, roughness: 0.45 });
  m.userData.reactive = id;
  return m;
};

/** Gives one gun its own copy of any reactive camo material (so each player's gun reacts to their own kills). */
export const ownReactive = (obj: THREE.Object3D): void => {
  const copies = new Map<THREE.Material, THREE.Material>();
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.Material;
    if (!m.userData?.reactive) return;
    let c = copies.get(m);
    if (!c) {
      c = m.clone();
      c.userData = { reactive: m.userData.reactive };
      copies.set(m, c);
    }
    mesh.material = c;
  });
};

/** Sets a reactive camo's progress on one gun (0..1 = 0..10 kills this match). */
export const setReactive = (obj: THREE.Object3D, level: number): void => {
  const mats = new Set<THREE.MeshStandardMaterial>();
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && (mesh.material as THREE.Material).userData?.reactive) mats.add(mesh.material as THREE.MeshStandardMaterial);
  });
  if (!mats.size) return;
  const k = Math.max(0, Math.min(1, level));
  for (const m of mats) {
    const id = m.userData.reactive as SkinId;
    if (id === 'bloodline') {
      m.color.setRGB(0.23 + 0.4 * k, 0.24 * (1 - k), 0.25 * (1 - k));
      m.emissive.setRGB(0.25 * k, 0, 0.02 * k);
    } else if (id === 'ember') {
      m.color.setRGB(0.16 + 0.3 * k, 0.16 + 0.1 * k, 0.16);
      m.emissive.setRGB(1 * k, 0.35 * k, 0.05 * k);
      m.emissiveIntensity = k * (0.8 + 0.2 * Math.sin(performance.now() / 120));
    } else if (id === 'frost') {
      m.color.setRGB(0.23 + 0.5 * k, 0.24 + 0.68 * k, 0.25 + 0.75 * k);
      m.roughness = 0.45 - 0.4 * k;
      m.emissive.setRGB(0.05 * k, 0.2 * k, 0.3 * k);
    }
  }
};

const skinMaterial = (id: SkinId): THREE.MeshStandardMaterial => {
  let m = materials.get(id);
  if (m) return m;
  switch (id) {
    case 'woodland':
      m = new THREE.MeshStandardMaterial({ map: blobs(['#4d5a2c', '#6b4f2c', '#1f241a', '#7d8a4a']), roughness: 0.8 });
      break;
    case 'desert':
      m = new THREE.MeshStandardMaterial({ map: blobs(['#c8ad7f', '#8f7350', '#e0cfa8']), roughness: 0.85 });
      break;
    case 'arctic':
      m = new THREE.MeshStandardMaterial({ map: blobs(['#eef2f5', '#9aa6b0', '#5b6670', '#d0d8de']), roughness: 0.7 });
      break;
    case 'digital':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          const cols = ['#3b4b63', '#5f7590', '#25303f', '#8193a8'];
          for (let x = 0; x < 64; x += 4) for (let y = 0; y < 64; y += 4) {
            g.fillStyle = cols[Math.floor(rand() * cols.length)];
            g.fillRect(x, y, 4, 4);
          }
        }),
        roughness: 0.7
      });
      break;
    case 'tiger':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          g.fillStyle = '#e07a1f';
          g.fillRect(0, 0, 64, 64);
          g.fillStyle = '#151515';
          for (let i = 0; i < 9; i++) {
            const x = i * 7 + rand() * 3;
            g.beginPath();
            g.moveTo(x, 0);
            g.quadraticCurveTo(x + 6 + rand() * 6, 32, x + rand() * 4, 64);
            g.lineTo(x + 2.5, 64);
            g.quadraticCurveTo(x + 8, 32, x + 2.5, 0);
            g.fill();
          }
        }),
        roughness: 0.6
      });
      break;
    case 'carbon':
      m = new THREE.MeshStandardMaterial({
        map: paint((g) => {
          for (let x = 0; x < 64; x += 4) for (let y = 0; y < 64; y += 4) {
            g.fillStyle = (x + y) % 8 === 0 ? '#1a1a1a' : '#3a3a3a';
            g.fillRect(x, y, 4, 4);
          }
        }),
        metalness: 0.4,
        roughness: 0.35
      });
      break;
    case 'crimson':
      m = new THREE.MeshStandardMaterial({ color: 0xb3122e, metalness: 0.65, roughness: 0.3 });
      break;
    case 'neon':
      m = new THREE.MeshStandardMaterial({
        color: 0x0b0f1a,
        roughness: 0.4,
        emissive: 0xffffff,
        emissiveMap: paint((g) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, 64, 64);
          g.lineWidth = 3;
          for (let i = -64; i < 128; i += 16) {
            g.strokeStyle = i % 32 === 0 ? '#19e6ff' : '#ff2bd6';
            g.beginPath();
            g.moveTo(i, 0);
            g.lineTo(i + 64, 64);
            g.stroke();
          }
        }),
        emissiveIntensity: 1.2
      });
      break;
    case 'gold':
      m = new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.55, roughness: 0.3, emissive: 0x4a3300 });
      break;
    case 'diamond':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          for (let i = 0; i < 90; i++) {
            const l = 70 + rand() * 30;
            g.fillStyle = `hsl(${190 + rand() * 20},90%,${l}%)`;
            const x = rand() * 64;
            const y = rand() * 64;
            const s = 4 + rand() * 8;
            g.beginPath();
            g.moveTo(x, y - s);
            g.lineTo(x + s, y);
            g.lineTo(x, y + s);
            g.lineTo(x - s, y);
            g.fill();
          }
        }),
        metalness: 0.6,
        roughness: 0.08,
        emissive: 0x15324a
      });
      break;
    case 'cherry':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          g.fillStyle = '#3a2a2e';
          g.fillRect(0, 0, 64, 64);
          for (let i = 0; i < 14; i++) {
            const x = rand() * 64;
            const y = rand() * 64;
            g.fillStyle = rand() < 0.5 ? '#ffd1e0' : '#ff9ec0';
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2;
              g.beginPath();
              g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.2, 0, Math.PI * 2);
              g.fill();
            }
          }
        }),
        roughness: 0.6
      });
      break;
    case 'zebra':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          g.fillStyle = '#f2f2f2';
          g.fillRect(0, 0, 64, 64);
          g.fillStyle = '#111';
          for (let i = 0; i < 10; i++) {
            const x = i * 7 + rand() * 2;
            g.beginPath();
            g.moveTo(x, 0);
            g.bezierCurveTo(x + 8, 20, x - 6, 40, x + 4, 64);
            g.lineTo(x + 7, 64);
            g.bezierCurveTo(x - 2, 40, x + 12, 20, x + 4, 0);
            g.fill();
          }
        }),
        roughness: 0.6
      });
      break;
    case 'hex':
      m = new THREE.MeshStandardMaterial({
        map: paint((g) => {
          g.fillStyle = '#1f2a33';
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = '#4c6a7d';
          g.lineWidth = 1.5;
          for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
              const cx = col * 12 + (row % 2) * 6;
              const cy = row * 11;
              g.beginPath();
              for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
                g.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
              }
              g.closePath();
              g.stroke();
            }
          }
        }),
        metalness: 0.5,
        roughness: 0.4
      });
      break;
    case 'ocean':
      m = new THREE.MeshStandardMaterial({
        map: paint((g) => {
          g.fillStyle = '#0b4f6c';
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = '#18a0c4';
          g.lineWidth = 3;
          for (let y = 4; y < 64; y += 9) {
            g.beginPath();
            for (let x = 0; x <= 64; x += 4) g.lineTo(x, y + Math.sin(x / 5) * 2.5);
            g.stroke();
          }
        }),
        roughness: 0.35,
        metalness: 0.3
      });
      break;
    case 'ice':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          const grad = g.createLinearGradient(0, 0, 64, 64);
          grad.addColorStop(0, '#e8fbff');
          grad.addColorStop(1, '#4aa3c7');
          g.fillStyle = grad;
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = 'rgba(255,255,255,0.8)';
          for (let i = 0; i < 12; i++) {
            g.beginPath();
            g.moveTo(rand() * 64, rand() * 64);
            g.lineTo(rand() * 64, rand() * 64);
            g.stroke();
          }
        }),
        metalness: 0.2,
        roughness: 0.1
      });
      break;
    case 'rainbow':
      m = new THREE.MeshStandardMaterial({
        map: paint((g) => {
          const cols = ['#ff3b3b', '#ffb03b', '#fff23b', '#3bff6b', '#3bb9ff', '#a03bff'];
          cols.forEach((c, i) => {
            g.fillStyle = c;
            g.fillRect(0, (i * 64) / cols.length, 64, 64 / cols.length + 1);
          });
        }),
        roughness: 0.3,
        emissive: 0x111111
      });
      break;
    case 'toxic':
      m = new THREE.MeshStandardMaterial({
        color: 0x14240a,
        roughness: 0.5,
        emissive: 0xffffff,
        emissiveMap: paint((g, rand) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, 64, 64);
          g.fillStyle = '#9bff2a';
          for (let i = 0; i < 18; i++) {
            const x = rand() * 64;
            g.beginPath();
            g.ellipse(x, rand() * 64, 2 + rand() * 4, 3 + rand() * 7, 0, 0, Math.PI * 2);
            g.fill();
          }
        }),
        emissiveIntensity: 0.9
      });
      break;
    case 'lava':
      m = new THREE.MeshStandardMaterial({
        color: 0x1a0500,
        roughness: 0.7,
        emissive: 0xffffff,
        emissiveMap: paint((g, rand) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = '#ff5a00';
          g.lineWidth = 2;
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
        }),
        emissiveIntensity: 1.4
      });
      break;
    case 'dragon':
      m = new THREE.MeshStandardMaterial({
        map: paint((g) => {
          g.fillStyle = '#0d3b2a';
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = '#2fae74';
          g.lineWidth = 1.5;
          for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
              g.beginPath();
              g.arc(col * 8 + (row % 2) * 4, row * 8, 5, 0, Math.PI);
              g.stroke();
            }
          }
        }),
        metalness: 0.6,
        roughness: 0.3
      });
      break;
    case 'galaxy':
      m = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: paint((g, rand) => {
          const grad = g.createRadialGradient(20, 26, 2, 32, 32, 46);
          grad.addColorStop(0, '#8f5cff');
          grad.addColorStop(0.5, '#1c0f4a');
          grad.addColorStop(1, '#05030f');
          g.fillStyle = grad;
          g.fillRect(0, 0, 64, 64);
          for (let i = 0; i < 70; i++) {
            g.fillStyle = `rgba(255,255,255,${0.4 + rand() * 0.6})`;
            g.fillRect(rand() * 64, rand() * 64, 1, 1);
          }
        }),
        emissive: 0x1a0a40,
        roughness: 0.25
      });
      break;
    case 'bloodstone':
      m = new THREE.MeshStandardMaterial({ map: blobs(['#2a0008', '#7a0019', '#120006', '#c4002e']), metalness: 0.6, roughness: 0.2 });
      break;
    case 'spectral':
      m = new THREE.MeshStandardMaterial({ color: 0xbaffef, metalness: 0.3, roughness: 0.1, emissive: 0x3a8a7a, transparent: true, opacity: 0.75 });
      break;
    case 'urban':
      m = new THREE.MeshStandardMaterial({ map: blobs(['#6b6f73', '#3a3d40', '#9aa0a6', '#25282b']), roughness: 0.8 });
      break;
    case 'jungle':
      m = new THREE.MeshStandardMaterial({ map: blobs(['#1f3a12', '#3d6b1f', '#0d1a08', '#5a7d2a']), roughness: 0.8 });
      break;
    case 'leopard':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          g.fillStyle = '#d9a54a';
          g.fillRect(0, 0, 64, 64);
          for (let i = 0; i < 22; i++) {
            const x = rand() * 64;
            const y = rand() * 64;
            g.strokeStyle = '#2a1a0a';
            g.lineWidth = 2;
            g.beginPath();
            g.arc(x, y, 2.5 + rand() * 2, 0, Math.PI * 1.6);
            g.stroke();
          }
        }),
        roughness: 0.7
      });
      break;
    case 'marble':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          g.fillStyle = '#efefef';
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = 'rgba(90,90,90,0.55)';
          for (let i = 0; i < 8; i++) {
            g.lineWidth = 0.5 + rand() * 1.2;
            g.beginPath();
            let x = rand() * 64;
            let y = 0;
            g.moveTo(x, y);
            while (y < 64) {
              x += (rand() - 0.5) * 10;
              y += 4 + rand() * 6;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        }),
        roughness: 0.15,
        metalness: 0.05
      });
      break;
    case 'woodgrain':
      m = new THREE.MeshStandardMaterial({
        map: paint((g, rand) => {
          for (let x = 0; x < 64; x++) {
            const v = 0.5 + 0.5 * Math.sin(x * 0.7 + Math.sin(x * 0.13) * 3);
            g.fillStyle = `rgb(${90 + v * 40},${52 + v * 22},${24 + v * 10})`;
            g.fillRect(x, 0, 1, 64);
          }
          void rand;
        }),
        roughness: 0.6
      });
      break;
    case 'cyber':
      m = new THREE.MeshStandardMaterial({
        color: 0x0a0a12,
        emissive: 0xffffff,
        emissiveMap: paint((g) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, 64, 64);
          g.strokeStyle = '#ff2bd6';
          g.lineWidth = 1;
          for (let i = 0; i < 64; i += 8) {
            g.beginPath();
            g.moveTo(i, 0);
            g.lineTo(i, 64);
            g.stroke();
          }
          g.strokeStyle = '#19e6ff';
          for (let i = 4; i < 64; i += 8) {
            g.beginPath();
            g.moveTo(0, i);
            g.lineTo(64, i);
            g.stroke();
          }
        }),
        emissiveIntensity: 0.9,
        roughness: 0.3
      });
      break;
    case 'emerald':
      m = new THREE.MeshStandardMaterial({ color: 0x1fae5a, metalness: 0.5, roughness: 0.08, emissive: 0x06301a });
      break;
    case 'obsidian':
      m = new THREE.MeshStandardMaterial({ color: 0x0b0814, metalness: 0.9, roughness: 0.12, emissive: 0x120a24 });
      break;
    case 'damascus':
      m = new THREE.MeshStandardMaterial({
        map: paint((g) => {
          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
              const v = 0.5 + 0.5 * Math.sin(x * 0.35 + Math.sin(y * 0.2) * 4 + Math.sin(x * 0.07) * 2);
              const c = Math.round(60 + v * 110);
              g.fillStyle = `rgb(${c},${c + 4},${c + 10})`;
              g.fillRect(x, y, 1, 1);
            }
          }
        }),
        metalness: 0.85,
        roughness: 0.25
      });
      break;
    // ---- animated: each frame tickSkins() moves them
    case 'darkmatter':
    case 'plasma':
    case 'matrix':
    case 'shift':
    case 'magma':
    case 'neonpulse':
      m = animatedMaterial(id);
      break;
    default:
      m = new THREE.MeshStandardMaterial();
  }
  materials.set(id, m);
  return m;
};

/** A copy of a weapon object wearing `skin` (sights, blades and lenses keep their look). */
/** A small trinket hanging from the gun on a short cord (prop space: +Y barrel, +Z up). */
const charmMesh = (shape: string, color: number): THREE.Object3D => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: shape === 'ring' || shape === 'gem' ? 0.6 : 0.1 });
  mat.userData.keep = true;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cord.material.userData.keep = true;
  cord.rotation.x = Math.PI / 2;
  cord.position.z = -0.02;
  g.add(cord);
  let body: THREE.Mesh;
  const s = 0.014;
  switch (shape) {
    case 'dice':
      body = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s * 1.6, s * 1.6), mat);
      break;
    case 'gem':
      body = new THREE.Mesh(new THREE.OctahedronGeometry(s * 1.1), mat);
      break;
    case 'ring':
      body = new THREE.Mesh(new THREE.TorusGeometry(s, s * 0.3, 6, 14), mat);
      break;
    case 'cone':
      body = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.2, 10), mat);
      body.rotation.x = -Math.PI / 2;
      break;
    case 'star':
      body = new THREE.Mesh(new THREE.OctahedronGeometry(s * 1.2, 0), mat);
      body.scale.set(1, 0.4, 1);
      break;
    case 'heart':
      body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
      body.scale.set(1.2, 0.7, 1);
      break;
    case 'skull':
      body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
      body.scale.set(1, 1, 1.15);
      break;
    case 'duck':
      body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
      {
        const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.6, 8, 6), mat);
        head.position.set(0, s * 0.6, s * 0.9);
        body.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(s * 0.25, s * 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xff7a00 }));
        beak.material.userData.keep = true;
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, s * 1.2, s * 0.9);
        body.add(beak);
      }
      break;
    default:
      body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
  }
  body.position.z = -0.045;
  g.add(body);
  g.name = 'charm';
  return g;
};

/** A copy of a weapon object wearing `skin`, with an optional charm (sights, blades and lenses keep their look). */
export const skinned = (object: THREE.Object3D, skin: SkinId, charm?: { shape: string; color: number; at: number }): THREE.Object3D => {
  const copy = object.clone(true);
  if (charm && charm.shape !== 'none') {
    const c = charmMesh(charm.shape, charm.color);
    // Hangs off the left side of the gun, just ahead of the middle (models differ in where their origin is).
    copy.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(copy);
    const inv = new THREE.Matrix4().copy(copy.matrixWorld).invert();
    const at = new THREE.Vector3(box.min.x, box.min.y + (box.max.y - box.min.y) * 0.62, (box.min.z + box.max.z) / 2).applyMatrix4(inv);
    c.position.copy(at);
    c.scale.setScalar(1 / Math.max(1e-6, copy.scale.x));
    copy.add(c);
  }
  if (skin === 'none') return copy;
  if (skin === 'bloodline' || skin === 'ember' || skin === 'frost') {
    const mat = reactiveMaterial(skin);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if ((mesh.material as THREE.Material).userData?.keep) return;
      mesh.material = mat;
    });
    return copy;
  }
  const mat = skinMaterial(skin);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as THREE.Material;
    if (old.userData?.keep) return;
    mesh.material = mat;
  });
  return copy;
};

/** Skins for each weapon, as chosen in the loadout menu. */
export type SkinChoice = Partial<Record<string, SkinId>>;

/**
 * A plausible skin for a computer player: most use the factory finish, some
 * show off the camos that take a while to earn, and gold or diamond are rare.
 */
export const randomSkin = (rand: () => number = Math.random): SkinId => {
  const r = rand();
  if (r < 0.7) return 'none';
  // Mostly the early camos; the late ones (gold, galaxy, spectral...) are rare.
  if (r < 0.95) return SKINS[1 + Math.floor(rand() * 11)].id;
  return SKINS[12 + Math.floor(rand() * (SKINS.length - 12))].id;
};
