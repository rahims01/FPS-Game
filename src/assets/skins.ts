import * as THREE from 'three';

/**
 * Weapon skins (camos). Each one is unlocked per weapon by getting kills with
 * that weapon, so a gold M16 says something about the player holding it.
 * The patterns are painted on small canvases; nothing is downloaded.
 */
export type SkinId = 'none' | 'woodland' | 'desert' | 'arctic' | 'digital' | 'tiger' | 'carbon' | 'crimson' | 'neon' | 'gold' | 'diamond';

export interface SkinDef {
  id: SkinId;
  name: string;
  /** Kills with the weapon needed to unlock it. */
  kills: number;
  /** CSS swatch for the menu. */
  swatch: string;
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
  { id: 'diamond', name: 'Diamond', kills: 250, swatch: 'linear-gradient(135deg,#ffffff,#a8e9ff 40%,#5fb8e6 70%,#e6f9ff)' }
];

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
    default:
      m = new THREE.MeshStandardMaterial();
  }
  materials.set(id, m);
  return m;
};

/** A copy of a weapon object wearing `skin` (sights, blades and lenses keep their look). */
export const skinned = (object: THREE.Object3D, skin: SkinId): THREE.Object3D => {
  const copy = object.clone(true);
  if (skin === 'none') return copy;
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
  if (r < 0.97) return SKINS[1 + Math.floor(rand() * 7)].id;
  return rand() < 0.75 ? 'gold' : 'diamond';
};
