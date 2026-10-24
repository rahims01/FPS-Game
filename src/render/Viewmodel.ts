import * as THREE from 'three';
import type { WeaponModel } from '../assets/weaponModels';
import { skinned, type SkinChoice } from '../assets/skins';
import type { WeaponId } from '../sim/weapons';

interface Pose {
  hip: THREE.Vector3;
  ads: THREE.Vector3;
  /** Pitch that makes the sight line point straight ahead. */
  tilt: number;
}

/**
 * M16: measured from the prop. Rear aperture ~0.135 m and front post ~0.10 m above
 * the grip, 0.45 m apart; the eye sits 0.15 m behind the rear sight and the gun is
 * tilted so that line points straight ahead. The procedural guns have level sights,
 * so their ADS pose comes straight from the model's sight height.
 */
const poseFor = (id: WeaponId, m: WeaponModel): Pose => {
  if (id === 'rifle') return { hip: new THREE.Vector3(0.2, -0.24, -0.5), ads: new THREE.Vector3(0, -0.151, -0.161), tilt: 0.078 };
  if (id === 'knife') return { hip: new THREE.Vector3(0.24, -0.25, -0.38), ads: new THREE.Vector3(0.24, -0.25, -0.38), tilt: 0 };
  const handgun = id === 'pistol' || id === 'revolver';
  const hip = handgun ? new THREE.Vector3(0.16, -0.19, -0.46) : new THREE.Vector3(0.2, -0.23, -0.42);
  const eyeBehind = handgun ? 0.3 : 0.16;
  return { hip, ads: new THREE.Vector3(0, -(m.sightZ + 0.008), m.sightY - eyeBehind), tilt: 0 };
};

/**
 * The player's weapon, drawn in its own scene and camera after the world so it
 * never clips into walls. Procedural bob, sway, recoil, reload, sprint, weapon
 * switching and knife swings.
 */
export class Viewmodel {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private gun = new THREE.Group();
  private holder = new THREE.Group();
  private flash: THREE.Sprite;
  private flashLife = 0;
  private kick = 0;
  private kickRot = 0;
  private swayX = 0;
  private swayY = 0;
  private bobT = 0;
  private adsT = 0;
  private sprintT = 0;
  private swingT = 0;
  private current: WeaponId | null = null;
  private pose: Pose = { hip: new THREE.Vector3(), ads: new THREE.Vector3(), tilt: 0 };
  private copies = new Map<string, THREE.Object3D>();
  /** Skins for the weapons shown (the player's own, or the killer's in a killcam). */
  skins: SkinChoice = {};
  /** Scoped weapons hide the gun once fully aimed (the HUD draws the scope). */
  scoped = false;

  constructor(
    private models: Record<WeaponId, WeaponModel>,
    flashTex: THREE.Texture
  ) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x403a30, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1, 2, 1.5);
    this.scene.add(key);
    // Prop space: +Y barrel, +Z sights up. Camera space: barrel along -Z, up is +Y.
    this.holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)));
    this.gun.add(this.holder);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false;
    this.gun.add(this.flash);
    this.camera.add(this.gun);
    this.setWeapon('rifle');
  }

  private currentKey = '';

  setWeapon(id: WeaponId, skins: SkinChoice = this.skins): void {
    const skin = skins[id] ?? 'none';
    const key = `${id}:${skin}`;
    if (key === this.currentKey) return;
    this.currentKey = key;
    this.current = id;
    const m = this.models[id];
    for (const c of this.copies.values()) c.visible = false;
    let copy = this.copies.get(key);
    if (!copy) {
      copy = skinned(m.object, skin);
      copy.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      this.holder.add(copy);
      this.copies.set(key, copy);
    }
    copy.visible = true;
    this.pose = poseFor(id, m);
    this.flash.position.set(0, m.bore, -m.length - 0.03);
  }

  setAspect(aspect: number, fov: number): void {
    this.camera.aspect = aspect;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  fire(): void {
    this.kick = 1;
    this.kickRot = 1;
    this.flashLife = 0.04;
    this.flash.material.rotation = Math.random() * Math.PI;
    const big = this.current === 'shotgun' || this.current === 'sniper' || this.current === 'revolver' ? 1.6 : this.current === 'dmr' || this.current === 'ak' ? 1.25 : 1;
    this.flash.scale.setScalar((0.16 + Math.random() * 0.08) * big);
  }

  swing(): void {
    this.swingT = 1;
  }

  /** Muzzle position in camera space (same as the world camera's local space). */
  muzzleLocal(target: THREE.Vector3): THREE.Vector3 {
    this.gun.updateMatrix();
    return target.copy(this.flash.position).applyMatrix4(this.gun.matrix);
  }

  get adsAmount(): number {
    return this.adsT;
  }

  update(
    dt: number,
    s: {
      speed: number;
      aiming: boolean;
      sprinting: boolean;
      reload: number;
      switching: number;
      onGround: boolean;
      lookDX: number;
      lookDY: number;
      visible: boolean;
      scope: boolean;
    }
  ): void {
    this.adsT += ((s.aiming ? 1 : 0) - this.adsT) * Math.min(1, dt * (s.scope ? 10 : 14));
    this.scoped = s.scope && this.adsT > 0.85;
    this.gun.visible = s.visible && !this.scoped;
    this.sprintT += ((s.sprinting ? 1 : 0) - this.sprintT) * Math.min(1, dt * 9);
    this.kick = Math.max(0, this.kick - dt * 14);
    this.kickRot = Math.max(0, this.kickRot - dt * 9);
    this.swingT = Math.max(0, this.swingT - dt * 3.5);
    this.swayX += (THREE.MathUtils.clamp(-s.lookDX * 0.0006, -0.04, 0.04) - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (THREE.MathUtils.clamp(s.lookDY * 0.0006, -0.04, 0.04) - this.swayY) * Math.min(1, dt * 10);
    if (s.onGround) this.bobT += dt * (s.sprinting ? 13 : 9) * Math.min(1, s.speed / 3);
    const bobAmp = Math.min(1, s.speed / 4) * (1 - this.adsT * 0.85) * (s.onGround ? 1 : 0);
    const reloadDip = Math.sin(Math.PI * s.reload);
    const switchDip = s.switching;
    // Knife swing: a fast slash across the view.
    const swing = Math.sin(Math.PI * (1 - this.swingT)) * (this.swingT > 0 ? 1 : 0);

    const p = this.pose.hip.clone().lerp(this.pose.ads, this.adsT);
    p.x += Math.sin(this.bobT) * 0.012 * bobAmp + this.swayX * (1 - this.adsT * 0.7) - swing * 0.2;
    p.y += -Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmp + this.swayY * (1 - this.adsT * 0.7) - reloadDip * 0.12 - this.sprintT * 0.05 - switchDip * 0.3;
    p.z += this.kick * (0.045 - this.adsT * 0.02) - swing * 0.15;
    p.x += this.sprintT * 0.04;
    this.gun.position.copy(p);
    const kickScale = this.current === 'shotgun' || this.current === 'sniper' || this.current === 'revolver' ? 2.2 : this.current === 'dmr' ? 1.6 : 1;
    this.gun.rotation.set(
      this.adsT * this.pose.tilt + this.kickRot * 0.06 * kickScale * (1 - this.adsT * 0.7) + reloadDip * -0.3 - this.sprintT * 0.25 - switchDip * 0.8 + swing * 0.4,
      this.sprintT * 0.75 + this.swayX * 2 + swing * 1.1,
      reloadDip * 0.7 + this.sprintT * 0.2 - swing * 0.6
    );

    this.flashLife -= dt;
    this.flash.visible = this.flashLife > 0 && s.visible && !this.scoped;
  }
}
