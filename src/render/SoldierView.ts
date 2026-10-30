import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { STICKMAN_SCALE } from '../assets/scale';
import { createRagdoll, type RagdollHandle } from '../physics/RagdollSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Agent } from '../sim/Agent';
import { SOLDIER } from '../sim/config';
import { wrapAngle } from '../sim/math';
import { WEAPONS, type WeaponId } from '../sim/weapons';
import { weaponModels } from '../assets/weaponModels';
import { ownReactive, setReactive, skinned, type SkinChoice, type SkinId } from '../assets/skins';
import { animateStyle, applyStyle, drawNametag } from './soldierStyle';
import { charmDef } from '../game/cosmetics';
import { thrownModel } from './thrown';
import { decimate } from './decimate';
import { camoKey, meleeModel, type MeleeId } from '../assets/melees';
import { realMetalMaterial } from './realMetal';

const DEG = Math.PI / 180;

/** Body speed (m/s) a death adds along the shot direction, by cause. */
const DEATH_PUSH: Record<string, number> = {
  pistol: 2.2,
  mpistol: 2.2,
  uzi: 2.3,
  smg: 2.4,
  rifle: 3,
  ak: 3.3,
  scar: 3.6,
  lmg: 3.8,
  revolver: 4,
  burst: 4.2,
  dmr: 4.2,
  deagle: 4.5,
  autoshotgun: 5.2,
  sniper: 5.5,
  shotgun: 6,
  barrett: 6.5,
  knife: 2,
  molotov: 1.5,
  tknife: 2.8,
  spear: 4.5,
  ball: 3,
  grenade: 5.5,
  airstrike: 6.5,
  zone: 0
};

/** Knife kills push by what was swung: a sledgehammer sends you further than a karambit. */
const MELEE_PUSH: Record<string, number> = { knife: 2, karambit: 2, kunai: 2, machete: 3, katana: 3.5, shovel: 4, bat: 4.5, axe: 4.5, hammer: 5.5 };

/** Shotguns hit hardest point blank, fading to about a third of that by 18 m. */
const SHOTGUN_FULL = 4;
const SHOTGUN_FADE = 18;

export interface DeathPush {
  /** Distance from the killer (shotguns fade with it). */
  distance?: number;
  /** The killer's melee, for knife kills. */
  melee?: string;
}

const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
/** Orients a prop (barrel +Y, sights +Z) in world space. */
const orientProp = (obj: THREE.Object3D, pos: THREE.Vector3, yDir: THREE.Vector3, zDir: THREE.Vector3): void => {
  _y.copy(yDir).normalize();
  _z.copy(zDir).addScaledVector(_y, -zDir.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m);
  obj.position.copy(pos);
};

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _pqi = new THREE.Quaternion();
/**
 * Applies a WORLD-space rotation to a bone, after the mixer has posed it.
 * No matrix refresh here: every read below goes through getWorldPosition /
 * getWorldQuaternion, which rebuild the ancestor chain on demand, and the
 * renderer refreshes the whole skeleton once before drawing. (Refreshing the
 * subtree after each rotation was the single biggest per-soldier cost.)
 */
const rotateBoneWorldQ = (bone: THREE.Object3D, q: THREE.Quaternion): void => {
  if (!bone.parent) return;
  bone.parent.getWorldQuaternion(_pq);
  _pqi.copy(_pq).invert();
  // local' = parent^-1 * R * parent * local
  bone.quaternion.premultiply(_pqi.multiply(q).multiply(_pq));
};
const rotateBoneWorld = (bone: THREE.Object3D, axis: THREE.Vector3, angle: number): void => {
  if (angle === 0) return;
  rotateBoneWorldQ(bone, _q.setFromAxisAngle(axis, angle));
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _id = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _rw = new THREE.Quaternion();
/** Turns `bone` so that `child` moves toward `target` (world space), by `weight`. */
const aimBoneAt = (bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3, weight: number): void => {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _b.sub(_a).normalize();
  _c.copy(target).sub(_a).normalize();
  _r.setFromUnitVectors(_b, _c);
  rotateBoneWorldQ(bone, weight < 1 ? _rw.copy(_id).slerp(_r, weight) : _r);
};

interface ArmChain {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  a: number;
  b: number;
}

/**
 * Two-bone IK: places the hand at `target`, bending the elbow toward `pole`.
 * This project has no Mixamo rifle-aim clip (the "rifle anims" folder was
 * empty and shoot.json keeps both hands at the hips), so the rifle stance is
 * built procedurally on top of the locomotion clips.
 */
const solveArm = (arm: ArmChain, target: THREE.Vector3, pole: THREE.Vector3, weight: number): void => {
  const S = arm.upper.getWorldPosition(new THREE.Vector3());
  const toT = target.clone().sub(S);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(arm.a - arm.b) + 1e-3, (arm.a + arm.b) * 0.999);
  const n = toT.normalize();
  const cosA = (arm.a * arm.a + d * d - arm.b * arm.b) / (2 * arm.a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole.clone().addScaledVector(n, -pole.dot(n)).normalize();
  const elbow = S.clone().addScaledVector(n, arm.a * cosA).addScaledVector(p, arm.a * sinA);
  aimBoneAt(arm.upper, arm.lower, elbow, weight);
  aimBoneAt(arm.lower, arm.hand, S.addScaledVector(n, d), weight);
};

const weaponCache = new Map<string, THREE.Object3D>();
const THIRD_PERSON_SCALE = 1.35;

/** Low-detail geometry (Simplified soldiers), built once per source geometry. */
const lowGeo = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const lowDetailOf = (geo: THREE.BufferGeometry, maxTris: number, groupOf?: (vertex: number) => number): THREE.BufferGeometry => {
  let g = lowGeo.get(geo);
  if (!g) {
    g = decimate(geo, maxTris, groupOf);
    lowGeo.set(geo, g);
  }
  return g;
};

/**
 * Which limb a body vertex belongs to (by its most-weighted bone), so the
 * low-detail body never merges one leg into the other, or an arm into the side.
 */
const limbGroups = (mesh: THREE.SkinnedMesh): ((vertex: number) => number) => {
  const idx = mesh.geometry.attributes.skinIndex;
  const wt = mesh.geometry.attributes.skinWeight;
  const groupOfBone = mesh.skeleton.bones.map((b) => {
    const n = b.name;
    const side = n.includes('Left') ? 1 : n.includes('Right') ? 2 : 0;
    if (!side) return 0;
    return /Leg|Foot|Toe/.test(n) ? side : side + 2;
  });
  return (v) => {
    if (!idx || !wt) return 0;
    let best = 0;
    let bone = 0;
    for (let k = 0; k < 4; k++) {
      const w = wt.getComponent(v, k);
      if (w > best) {
        best = w;
        bone = idx.getComponent(v, k);
      }
    }
    return groupOfBone[bone] ?? 0;
  };
};
/** The body is ~50k triangles and a third-person gun ~22k: far more than a weak GPU can skin and draw for a full lobby. */
const LOW_BODY_TRIS = 6000;
const LOW_GUN_SHARE = 0.15;
/**
 * Other players carry slightly oversized, lifted-brightness copies of their
 * weapons: real-scale dark guns all but vanish against the walls at range.
 */
const modelOf = (assets: LoadedAssets, id: WeaponId, melee: MeleeId) => (id === 'knife' ? meleeModel(melee) : weaponModels(assets.rifle)[id]);

const thirdPersonWeapon = (assets: LoadedAssets, id: WeaponId, skin: SkinId = 'none', charm = 'none', low = false, melee: MeleeId = 'knife'): THREE.Object3D => {
  const lo = low ? ':lo' : '';
  const m = id === 'knife' ? `:${melee}` : '';
  if (skin !== 'none' || charm !== 'none') {
    const key = `${id}:${skin}:${charm}${lo}${m}`;
    let s = weaponCache.get(key);
    if (!s) {
      const c = charmDef(charm);
      s = skinned(thirdPersonWeapon(assets, id, 'none', 'none', low, melee), skin, id === 'knife' ? undefined : { shape: c.shape, color: c.color, at: modelOf(assets, id, melee).length * 0.45 });
      weaponCache.set(key, s);
    }
    return s;
  }
  let r = weaponCache.get(id + lo + m);
  if (!r) {
    r = modelOf(assets, id, melee).object.clone(true);
    r.scale.setScalar(THIRD_PERSON_SCALE);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.emissive) mat.emissive.setHex(0x303030);
      m.material = mat;
      if (low) {
        const g = m.geometry;
        const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
        m.geometry = lowDetailOf(g, Math.max(120, Math.round(tris * LOW_GUN_SHARE)));
      }
    });
    weaponCache.set(id + lo + m, r);
  }
  return r;
};

interface Clips {
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  run: THREE.AnimationAction;
}

/**
 * One soldier on screen. Mixamo locomotion clips drive the body; the legs turn
 * toward the direction of travel while the spine twists back to the aim; arm
 * IK holds the rifle on the line of sight. On death the same skeleton is
 * handed to TribeSim's cannon-es ragdoll.
 */
export class SoldierView {
  readonly root = new THREE.Group();
  readonly model: THREE.Group;
  /** Holds the weapon in hand (barrel +Y from the grip). */
  readonly rifle: THREE.Group;
  private assets: LoadedAssets;
  private weaponId: WeaponId | null = null;
  private muzzleLength = 0.62;
  readonly life: number;
  private mixer: THREE.AnimationMixer;
  private a: Clips;
  private bones: Record<string, THREE.Object3D | undefined> = {};
  private rightArm: ArmChain | null = null;
  private leftArm: ArmChain | null = null;
  private legs: ArmChain[] = [];
  private crouchT = 0;
  private speeds: { walk: number; run: number };
  private upperWeight = 1;
  private flinch = 0;
  private flinchSide = 1;
  ragdoll: RagdollHandle | null = null;
  diedAt = 0;
  /** Big Heads party mode. */
  static headScale = 1;
  /** Simplified soldiers (weak devices): low-detail body and gun. Read when a soldier is created. */
  static lowDetail = false;
  private low = SoldierView.lowDetail;
  private tag: THREE.Sprite | null = null;
  private materials: THREE.Material[] = [];
  /** The body's own (Phong) materials per mesh, kept so Real Metal can be swapped in and out. */
  private bodyMeshes: { mesh: THREE.Mesh; own: THREE.Material | THREE.Material[] }[] = [];
  private metalMats: THREE.Material[] = [];

  constructor(
    assets: LoadedAssets,
    agent: Agent,
    color: THREE.ColorRepresentation,
    private skins: SkinChoice = {},
    private charm = 'none',
    private melee: MeleeId = 'knife'
  ) {
    this.life = agent.life;
    this.model = SkeletonUtils.clone(assets.stickman) as THREE.Group;
    this.model.scale.setScalar(STICKMAN_SCALE);
    this.root.add(this.model);
    if (this.low) {
      this.model.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isSkinnedMesh) m.geometry = lowDetailOf(m.geometry, LOW_BODY_TRIS, limbGroups(m));
      });
    }
    const tint = new THREE.Color(color);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const c = mat.clone() as THREE.MeshPhongMaterial;
        if (c.color) c.color.copy(tint);
        this.materials.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? cloned : cloned[0];
      this.bodyMeshes.push({ mesh: m, own: m.material });
    });
    for (const name of [
      'Hips',
      'Spine',
      'Spine1',
      'Spine2',
      'Neck',
      'Head',
      'RightShoulder',
      'RightArm',
      'RightForeArm',
      'RightHand',
      'RightHandMiddle1',
      'RightHandThumb1',
      'LeftArm',
      'LeftForeArm',
      'LeftHand',
      'LeftUpLeg',
      'LeftLeg',
      'LeftFoot',
      'RightUpLeg',
      'RightLeg',
      'RightFoot'
    ]) {
      this.bones[name] = this.model.getObjectByName(`mixamorig${name}`) ?? undefined;
    }
    this.model.updateMatrixWorld(true);
    const chain = (side: 'Right' | 'Left'): ArmChain | null => {
      const upper = this.bones[`${side}Arm`];
      const lower = this.bones[`${side}ForeArm`];
      const hand = this.bones[`${side}Hand`];
      if (!upper || !lower || !hand) return null;
      const p = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
      return { upper, lower, hand, a: p(upper).distanceTo(p(lower)), b: p(lower).distanceTo(p(hand)) };
    };
    this.rightArm = chain('Right');
    this.leftArm = chain('Left');
    const legChain = (side: 'Right' | 'Left'): ArmChain | null => {
      const upper = this.bones[`${side}UpLeg`];
      const lower = this.bones[`${side}Leg`];
      const foot = this.bones[`${side}Foot`];
      if (!upper || !lower || !foot) return null;
      const p = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
      return { upper, lower, hand: foot, a: p(upper).distanceTo(p(lower)), b: p(lower).distanceTo(p(foot)) };
    };
    this.legs = [legChain('Left'), legChain('Right')].filter((c): c is ArmChain => !!c);

    this.mixer = new THREE.AnimationMixer(this.model);
    const act = (clip: THREE.AnimationClip) => {
      const a = this.mixer.clipAction(clip);
      a.setEffectiveWeight(0);
      a.play();
      return a;
    };
    const c = assets.clips;
    this.a = { idle: act(c.idle), walk: act(c.walk), run: act(c.run) };
    this.speeds = { walk: assets.clipSpeed.walk || 1.4, run: assets.clipSpeed.run || 3.5 };

    this.assets = assets;
    this.rifle = new THREE.Group();
    this.root.add(this.rifle);
    this.setWeapon(agent.weapons[agent.slot] ?? 'rifle');
  }

  /** Swaps the weapon in hand (gun game upgrades, weapon switches, infection). */
  setWeapon(id: WeaponId): void {
    if (id === this.weaponId) return;
    this.weaponId = id;
    this.rifle.clear();
    this.rifle.add(thirdPersonWeapon(this.assets, id, this.skins[camoKey(id, this.melee)] ?? 'none', this.charm, this.low, this.melee).clone(true));
    // Reactive camos change with this soldier's own kills.
    ownReactive(this.rifle);
    this.muzzleLength = modelOf(this.assets, id, this.melee).length * THIRD_PERSON_SCALE;
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  private frozen = false;
  /** Freeze tag: an icy tint while frozen. */
  // Soldier style (finish, pattern, animation or reaction to play).
  private style = 'none';
  private styleBase = 0xffffff;
  private styleSeed = Math.random() * 10;

  setStyle(style: string, base: number): void {
    this.style = style;
    this.styleBase = base;
    if (style === 'realmetal') {
      // A different kind of material: Phong can only fake metal as glossy plastic.
      for (const m of this.metalMats) m.dispose();
      this.metalMats = [];
      for (const b of this.bodyMeshes) {
        const n = Array.isArray(b.own) ? b.own.length : 1;
        const mats = Array.from({ length: n }, () => realMetalMaterial(base));
        this.metalMats.push(...mats);
        b.mesh.material = Array.isArray(b.own) ? mats : mats[0];
      }
      return;
    }
    if (this.metalMats.length) {
      for (const b of this.bodyMeshes) b.mesh.material = b.own;
      for (const m of this.metalMats) m.dispose();
      this.metalMats = [];
    }
    applyStyle(this.materials, style, base);
  }

  setFrozen(on: boolean): void {
    if (on === this.frozen) return;
    this.frozen = on;
    if (!on) this.setStyle(this.style, this.styleBase);
    for (const m of this.metalMats.length ? this.metalMats : this.materials) {
      const mat = m as THREE.MeshPhongMaterial;
      if (!mat.emissive) continue;
      mat.emissive.setHex(on ? 0x3a7fc4 : 0x000000);
    }
  }

  /**
   * Floating name above the head, in the player's colour. Ally tags draw
   * through walls; enemy tags are depth-tested (and only shown when seen).
   */
  setNameTag(name: string, color: string, throughWalls: boolean, style = 'plain', title: string | null = null): void {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d')!;
    drawNametag(g, 512, name, color, style, title);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: !throughWalls, depthWrite: false });
    this.tag = new THREE.Sprite(mat);
    this.tag.scale.set(1.6, 0.4, 1);
    this.tag.position.y = 2.25;
    this.tag.renderOrder = 10;
    this.root.add(this.tag);
  }

  /** `distance` keeps the tag a readable size: small up close, larger far away. */
  showTag(v: boolean, distance: number): void {
    if (!this.tag) return;
    this.tag.visible = v && !this.ragdoll;
    const k = THREE.MathUtils.clamp(distance * 0.08, 0.35, 2.4);
    this.tag.scale.set(1.6 * k, 0.4 * k, 1);
  }

  /**
   * A hit: the body twists away from the side it was hit on; a head shot
   * snaps the head back, a leg shot buckles the knees. Bigger hits flinch more.
   */
  hit(fromSide: number, region: 'head' | 'torso' | 'legs' = 'torso', strength = 1, dirX = 0, dirZ = 0): void {
    this.flinch = Math.min(1.5, Math.max(this.flinch, strength));
    this.flinchSide = fromSide;
    this.flinchRegion = region;
    // Which way the shot travelled: the body is shoved along it.
    const len = Math.hypot(dirX, dirZ);
    if (len > 1e-4) this.pushDir.set(dirX / len, 0, dirZ / len);
  }

  private pushDir = new THREE.Vector3();

  private flinchRegion: 'head' | 'torso' | 'legs' = 'torso';

  /** A throwing knife or spear stuck in the body at a world point, pointing along `dir`. Stays through the ragdoll. */
  stick(kind: 'tknife' | 'spear', at: THREE.Vector3, dir: THREE.Vector3): void {
    const names = ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine', 'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
    let best: THREE.Object3D | null = null;
    let bestD = Infinity;
    const tmp = new THREE.Vector3();
    for (const n of names) {
      const b = this.bones[n];
      if (!b) continue;
      const d = b.getWorldPosition(tmp).distanceTo(at);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) return;
    const mesh = thrownModel(kind);
    // Buried a little way in: the handle (or shaft) sticks out behind the hit point.
    const sink = kind === 'spear' ? 0.25 : 0.06;
    mesh.position.copy(at).addScaledVector(dir, sink);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.root.parent?.add(mesh);
    mesh.updateMatrixWorld(true);
    best.attach(mesh);
    this.stuck.push(mesh);
  }

  private stuck: THREE.Object3D[] = [];

  /** Animation time skipped by `follow`, caught up on the next full update. */
  private skipped = 0;

  /**
   * Simplified soldiers: moves and turns the body without re-posing it (for
   * soldiers out of view, or far-away ones between their less frequent poses).
   */
  follow(agent: Agent, x: number, y: number, z: number, dt: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = agent.yaw;
    this.skipped = Math.min(0.25, this.skipped + dt);
  }

  /** Poses the soldier for this frame. (x, y, z) is the interpolated position. */
  update(agent: Agent, x: number, y: number, z: number, dt: number, time: number): void {
    if (this.ragdoll) {
      this.ragdoll.update();
      this.placeRifle(agent, false);
      return;
    }
    if (dt > 0) dt += this.skipped;
    this.skipped = 0;
    this.root.position.set(x, y, z);
    if (this.root.scale.x !== agent.scale) this.root.scale.setScalar(agent.scale);
    if (!this.frozen && this.style !== 'none' && this.style !== 'realmetal') animateStyle(this.materials, this.style, this.styleBase, agent, time, this.styleSeed);
    setReactive(this.rifle, agent.kills / 10);
    // Leg hits buckle the knees for a moment; every hit shoves the body a little along the shot.
    if (this.flinch > 0 && this.flinchRegion === 'legs') this.root.position.y -= this.flinch * 0.12;
    if (this.flinch > 0) this.root.position.addScaledVector(this.pushDir, this.flinch * this.flinch * 0.05);

    const speed = Math.hypot(agent.vx, agent.vz);
    // The whole body faces the aim; walking backwards plays the cycle in reverse.
    const phi = speed > 0.3 ? wrapAngle(Math.atan2(agent.vx, agent.vz) - agent.yaw) : 0;
    const dir = Math.abs(phi) > 110 * DEG ? -1 : 1;
    this.root.rotation.y = agent.yaw;

    // Locomotion weights: idle -> walk -> run.
    const walkW = THREE.MathUtils.clamp((speed - 0.2) / 1.6, 0, 1);
    const runW = THREE.MathUtils.clamp((speed - SOLDIER.walkSpeed) / (SOLDIER.sprintSpeed - SOLDIER.walkSpeed), 0, 1);
    const a = this.a;
    a.idle.setEffectiveWeight(1 - walkW);
    a.walk.setEffectiveWeight(walkW * (1 - runW));
    a.run.setEffectiveWeight(walkW * runW);
    // Drive the cycles from ground speed so feet don't skate.
    a.walk.timeScale = THREE.MathUtils.clamp((dir * Math.max(speed, 0.5)) / this.speeds.walk, -2.5, 2.5);
    a.run.timeScale = THREE.MathUtils.clamp((dir * Math.max(speed, 1)) / this.speeds.run, -2, 2);
    this.mixer.update(dt);
    this.model.position.y = 0;
    // Crouch: drop the hips and bend the knees so the feet stay planted.
    const wantCrouch = agent.crouching || agent.slideT > 0 ? 1 : 0;
    this.crouchT += (wantCrouch - this.crouchT) * Math.min(1, dt * 12);
    if (this.crouchT > 0.02 && this.legs.length === 2) {
      const feet = this.legs.map((l) => l.hand.getWorldPosition(new THREE.Vector3()));
      this.model.position.y = -0.42 * this.crouchT;
      const knee = new THREE.Vector3(Math.sin(agent.yaw), 0, Math.cos(agent.yaw));
      this.legs.forEach((l, i) => solveArm(l, feet[i], knee, 1));
    }

    // Rifle stance weight: off while sprinting (the run clip swings the arms).
    // A quick melee shows the knife for the slash, then the gun again.
    const quickKnife = agent.meleeCd > WEAPONS.knife.interval - 0.35 && agent.weapons[agent.slot] !== 'knife';
    const held = quickKnife ? 'knife' : (agent.weapons[agent.slot] ?? 'rifle');
    this.setWeapon(held);
    const wantUpper = agent.sprinting || held === 'knife' ? 0 : 1;
    this.upperWeight += (wantUpper - this.upperWeight) * Math.min(1, dt * 8);
    const u = this.upperWeight;

    // Bend the spine for pitch.
    const up = new THREE.Vector3(0, 1, 0);
    const aimRight = new THREE.Vector3(-Math.cos(agent.yaw), 0, Math.sin(agent.yaw));
    const pitchAxis = new THREE.Vector3(Math.sin(agent.yaw), 0, Math.cos(agent.yaw)).cross(up).normalize();
    // A hit also jolts the gun in their hands.
    const kick = (time - agent.lastShotT < 0.07 ? 0.05 : 0) + this.flinch * 0.05;
    // Fast snap, slower recovery.
    this.flinch = Math.max(0, this.flinch - dt * (this.flinch > 0.6 ? 5 : 3));
    // Shot from the front: rock back. From behind: pitch forward.
    const facing = new THREE.Vector3(Math.sin(agent.yaw), 0, Math.cos(agent.yaw));
    const rock = this.pushDir.dot(facing) > 0.3 ? -1 : 1;
    for (const name of ['Spine', 'Spine1', 'Spine2']) {
      const b = this.bones[name];
      if (!b) continue;
      rotateBoneWorld(b, pitchAxis, ((agent.pitch * u) / 3) * 0.6);
      if (this.flinch > 0) rotateBoneWorld(b, aimRight, (this.flinch * 0.4 * this.flinchSide) / 3);
      if (this.flinch > 0 && this.flinchRegion !== 'legs') rotateBoneWorld(b, pitchAxis, (-this.flinch * (this.flinchRegion === 'torso' ? 0.28 : 0.12) * rock) / 3);
    }
    if (this.flinch > 0 && this.flinchRegion === 'head') {
      if (this.bones.Neck) rotateBoneWorld(this.bones.Neck, pitchAxis, -this.flinch * 0.7 * rock);
      if (this.bones.Head) rotateBoneWorld(this.bones.Head, aimRight, this.flinch * 0.35 * this.flinchSide);
    }
    if (agent.reloadT > 0 && this.bones.Spine1) rotateBoneWorld(this.bones.Spine1, pitchAxis, -0.12);
    this.aimArms(agent, u, kick, time);
    if (this.bones.Head) this.bones.Head.scale.setScalar(SoldierView.headScale);
    this.placeRifle(agent, u > 0.5);
  }

  /** Shouldered-rifle stance: right hand on the grip, left hand on the handguard (or the magazine while reloading). */
  private aimArms(agent: Agent, u: number, kick: number, time: number): void {
    const sh = this.bones.RightShoulder;
    if (!sh || !this.rightArm || !this.leftArm || u < 0.02) return;
    const cp = Math.cos(agent.pitch);
    const F = new THREE.Vector3(Math.sin(agent.yaw) * cp, Math.sin(agent.pitch), Math.cos(agent.yaw) * cp);
    const R = new THREE.Vector3(-Math.cos(agent.yaw), 0, Math.sin(agent.yaw));
    const U = new THREE.Vector3().crossVectors(R, F).normalize();
    const grip = sh
      .getWorldPosition(new THREE.Vector3())
      .addScaledVector(F, 0.22 - kick)
      .addScaledVector(U, -0.15)
      .addScaledVector(R, 0.02);
    const left =
      agent.reloadT > 0
        ? grip
            .clone()
            .addScaledVector(F, 0.12)
            .addScaledVector(U, -0.18 + Math.sin(time * 9) * 0.03)
            .addScaledVector(R, -0.1)
        : grip.clone().addScaledVector(F, 0.32).addScaledVector(U, 0.03).addScaledVector(R, -0.07);
    const down = new THREE.Vector3(0, -1, 0);
    solveArm(this.rightArm, grip, down.clone().addScaledVector(R, 0.9), u);
    solveArm(this.leftArm, left, down.clone().addScaledVector(R, -0.9), u);
  }

  /** The rifle follows the right hand: aimed down the line of sight, or carried while sprinting. */
  private placeRifle(agent: Agent, aiming: boolean): void {
    const b = this.bones;
    if (!b.RightHand || !b.RightHandMiddle1 || !b.RightHandThumb1) return;
    const hand = b.RightHand.getWorldPosition(new THREE.Vector3());
    const mid = b.RightHandMiddle1.getWorldPosition(new THREE.Vector3());
    const thumb = b.RightHandThumb1.getWorldPosition(new THREE.Vector3());
    const finger = mid.clone().sub(hand).normalize();
    const palm = hand.clone().addScaledVector(finger, 0.05);
    this.root.updateWorldMatrix(true, false);
    const toLocal = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const U = new THREE.Vector3(0, 1, 0);
    if (aiming && !this.ragdoll) {
      const cp = Math.cos(agent.pitch);
      const F = new THREE.Vector3(Math.sin(agent.yaw) * cp, Math.sin(agent.pitch), Math.cos(agent.yaw) * cp);
      // The grip sits a little below the bore, so shift the prop back so the stock meets the shoulder.
      orientProp(this.rifle, palm.addScaledVector(F, -0.08), F, U);
    } else {
      const blade = thumb.sub(hand);
      blade.addScaledVector(finger, -blade.dot(finger)).normalize();
      const F = new THREE.Vector3(Math.sin(agent.yaw), 0, Math.cos(agent.yaw));
      orientProp(this.rifle, palm, blade.addScaledVector(U, 0.6), F);
    }
    // orientProp works in world space; the rifle is parented to root.
    this.rifle.applyMatrix4(toLocal);
  }

  /** World position of the muzzle (for tracers and flashes). */
  muzzle(target: THREE.Vector3): THREE.Vector3 {
    return target.set(0, this.muzzleLength, 0).applyMatrix4(this.rifle.matrixWorld);
  }

  die(agent: Agent, physics: PhysicsWorld, time: number, push: DeathPush = {}): void {
    if (this.ragdoll) return;
    this.model.updateMatrixWorld(true);
    this.ragdoll = createRagdoll(this.model, physics.world);
    // The whole body is carried along the shot (or away from the blast), plus a
    // smaller kick at the region that was hit so it twists. Moderate on purpose:
    // the ragdoll's own speed cap (6 m/s) is the hard limit.
    const cause = agent.deathCause;
    const blast = cause === 'grenade' || cause === 'airstrike';
    let speed = cause === 'knife' ? (MELEE_PUSH[push.melee ?? 'knife'] ?? 2) : (DEATH_PUSH[cause] ?? 2);
    if ((cause === 'shotgun' || cause === 'autoshotgun') && push.distance !== undefined) {
      speed *= Math.max(0.35, Math.min(1, 1 - (push.distance - SHOTGUN_FULL) / (SHOTGUN_FADE - SHOTGUN_FULL)));
    }
    const dir = new THREE.Vector3(agent.deathDirX, 0, agent.deathDirZ);
    if (dir.lengthSq() < 1e-6) dir.set(-Math.sin(agent.yaw), 0, -Math.cos(agent.yaw));
    dir.normalize();
    const velocity = new THREE.Vector3(agent.vx * 0.6, blast ? 3 : 0.6, agent.vz * 0.6).addScaledVector(dir, speed);
    this.ragdoll.activate({
      // The kick at the hit region scales with the weapon too, so heavy hits also twist the body more.
      impulse: dir.clone().setY(0.25).normalize().multiplyScalar(blast ? 0 : (agent.deathRegion === 'head' ? 5 : 7) * Math.max(0.8, speed / 3)),
      region: agent.deathRegion,
      velocity
    });
    this.diedAt = time;
  }

  /** World position of the hips (the death camera looks at it). */
  hips(target: THREE.Vector3): THREE.Vector3 {
    if (this.ragdoll) this.ragdoll.getHipsWorldPosition(target);
    else target.copy(this.root.position).setY(this.root.position.y + 1);
    return target;
  }

  dispose(): void {
    this.ragdoll?.dispose();
    this.ragdoll = null;
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const m of this.materials) m.dispose();
    for (const m of this.metalMats) m.dispose();
    if (this.tag) {
      this.tag.material.map?.dispose();
      this.tag.material.dispose();
    }
  }
}
