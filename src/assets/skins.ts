import * as THREE from 'three';

/**
 * Weapon skins (camos). Each one is unlocked per weapon by getting kills with
 * that weapon, so a gold M16 says something about the player holding it.
 * The patterns are painted on small canvases; nothing is downloaded.
 */
export type SkinId =
  | 'none' | 'woodland' | 'desert' | 'arctic' | 'digital' | 'tiger' | 'carbon' | 'crimson' | 'neon' | 'gold' | 'diamond'
  | 'cherry' | 'zebra' | 'hex' | 'ocean' | 'ice' | 'rainbow' | 'toxic' | 'lava' | 'dragon' | 'galaxy' | 'bloodstone' | 'spectral';

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
  { id: 'spectral', name: 'Spectral', kills: 400, swatch: 'linear-gradient(135deg,#d9fff9,#7affe4 40%,#c9b6ff 70%,#ffffff)' }
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
