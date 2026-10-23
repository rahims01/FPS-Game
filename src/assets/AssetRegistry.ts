import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STICKMAN_SCALE } from './scale';
import { normalizeSkinWeights } from './skinWeights';

// Trimmed from TribeSim's AssetRegistry: the Mixamo stickman rig, the M16
// prop and the locomotion / shooting / hit clips this game uses.

const BASE = import.meta.env.BASE_URL;
const url = (p: string) => `${BASE}${p.replace(/^\/+/, '')}`;

export const ASSET_PATHS = {
  stickman: 'models/stickman_base.fbx',
  rifle: 'models/m16_assault_rifle.glb'
} as const;

export const CLIP_PATHS = {
  idle: 'anims/idle.json',
  fightIdle: 'anims/fighting-idle.json',
  walk: 'anims/walk.json',
  run: 'anims/run.json',
  shoot: 'anims/shoot.json',
  hitBody: 'anims/hit-to-body.json',
  hitHead: 'anims/big-hit-to-head.json'
} as const;
export type ClipKey = keyof typeof CLIP_PATHS;

/**
 * A normalised prop: the grip point sits at the wrapper's origin, the barrel
 * points along +Y and the sights face +Z. Size is in metres.
 */
export interface PropTemplate {
  object: THREE.Group;
  length: number;
}

export interface LoadedAssets {
  stickman: THREE.Group;
  clips: Record<ClipKey, THREE.AnimationClip>;
  /** Ground speed (m/s) each clip's root motion implies at timeScale 1, measured before stripping. */
  clipSpeed: Record<ClipKey, number>;
  rifle: PropTemplate;
}

let loading: Promise<LoadedAssets> | null = null;

/** Freeze hip X/Z so locomotion clips play in place; the simulation moves the soldier. */
const stripRootMotion = (clip: THREE.AnimationClip): void => {
  const track = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
  if (!track) return;
  const v = track.values;
  const bx = v[0];
  const bz = v[2];
  for (let i = 0; i < v.length; i += 3) {
    v[i] = bx;
    v[i + 2] = bz;
  }
};

const loadClip = async (path: string): Promise<{ clip: THREE.AnimationClip; speed: number }> => {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`clip ${path}: HTTP ${res.status}`);
  const clip = THREE.AnimationClip.parse(await res.json());
  const hips = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
  let speed = 0;
  if (hips && clip.duration > 0) {
    const v = hips.values;
    speed = (Math.hypot(v[v.length - 3] - v[0], v[v.length - 1] - v[2]) * STICKMAN_SCALE) / clip.duration;
  }
  stripRootMotion(clip);
  return { clip, speed };
};

/**
 * Props must be static. A rigged (skinned) prop copied with clone() keeps
 * following the ORIGINAL skeleton, so skinned meshes are replaced by plain
 * meshes in their bind pose.
 */
const unskin = (root: THREE.Object3D): void => {
  const skinned: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });
  for (const sm of skinned) {
    const geo = sm.geometry.clone();
    geo.deleteAttribute('skinIndex');
    geo.deleteAttribute('skinWeight');
    geo.applyMatrix4(sm.bindMatrix);
    const mesh = new THREE.Mesh(geo, sm.material);
    mesh.name = sm.name;
    mesh.position.copy(sm.position);
    mesh.quaternion.copy(sm.quaternion);
    mesh.scale.copy(sm.scale);
    sm.parent?.add(mesh);
    sm.removeFromParent();
  }
};

const makeProp = (scene: THREE.Object3D, grip: THREE.Vector3, tip: THREE.Vector3, secondary: THREE.Vector3, targetLength: number): PropTemplate => {
  unskin(scene);
  const axis = tip.clone().sub(grip);
  const modelLength = axis.length();
  axis.normalize();
  const z = secondary.clone().addScaledVector(axis, -secondary.dot(axis)).normalize();
  const x = new THREE.Vector3().crossVectors(axis, z).normalize();
  const inv = new THREE.Matrix4().makeBasis(x, axis, z).invert();
  const inner = new THREE.Group();
  inner.add(scene);
  scene.position.sub(grip);
  const holder = new THREE.Group();
  holder.add(inner);
  inner.quaternion.setFromRotationMatrix(inv);
  holder.scale.setScalar(targetLength / modelLength);
  const wrapper = new THREE.Group();
  wrapper.add(holder);
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  return { object: wrapper, length: targetLength };
};

export const loadAssets = (onProgress?: (msg: string) => void): Promise<LoadedAssets> => {
  if (loading) return loading;
  loading = (async () => {
    onProgress?.('Loading soldier rig…');
    const [stickman, rifleGltf] = await Promise.all([new FBXLoader().loadAsync(url(ASSET_PATHS.stickman)), new GLTFLoader().loadAsync(url(ASSET_PATHS.rifle))]);
    onProgress?.('Loading animations…');
    const entries = await Promise.all(Object.entries(CLIP_PATHS).map(async ([k, p]) => [k, await loadClip(p)] as const));
    const clips = Object.fromEntries(entries.map(([k, v]) => [k, v.clip])) as Record<ClipKey, THREE.AnimationClip>;
    const clipSpeed = Object.fromEntries(entries.map(([k, v]) => [k, v.speed])) as Record<ClipKey, number>;

    normalizeSkinWeights(stickman);
    stickman.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });
    // M16 axes measured by TribeSim: muzzle toward -Z, pistol grip behind the magazine well.
    const rifle = makeProp(rifleGltf.scene, new THREE.Vector3(0, -60, 20), new THREE.Vector3(0, -20, -490), new THREE.Vector3(0, 1, 0), 0.62);
    return { stickman, clips, clipSpeed, rifle };
  })();
  return loading;
};
