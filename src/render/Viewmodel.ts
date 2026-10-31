import * as THREE from 'three';
import type { WeaponModel } from '../assets/weaponModels';
import { setReactive, skinned, type SkinChoice } from '../assets/skins';
import { charmDef } from '../game/cosmetics';
import { camoKey, meleeModel, type MeleeId } from '../assets/melees';
import { addAttachments, attachKey } from './attachMeshes';
import type { AttachSet } from '../sim/attachments';
import type { WeaponId } from '../sim/weapons';

interface Pose {
  hip: THREE.Vector3;
  ads: THREE.Vector3;
  /** Pitch and yaw that make the sight line point straight ahead. */
  tilt: number;
  yaw?: number;
}

/**
 * M16: solved from the prop's own sight geometry. The peep hole in the rear
 * flip aperture sits at (-0.0016, -0.035, 0.156) and the front post's tip at
 * (-0.0047, 0.449, 0.096) (prop frame: +Y forward, +Z up). The gun is pitched
 * and turned so the line through them points straight down the view, then
 * moved so it passes through the eye: hole and post both land on the exact
 * centre of the screen. The procedural guns have level sights, so their ADS
 * pose comes straight from the model's sight height.
 */
const poseFor = (id: WeaponId, m: WeaponModel): Pose => {
  if (id === 'rifle') return { hip: new THREE.Vector3(0.2, -0.24, -0.5), ads: new THREE.Vector3(0.0018, -0.1504, -0.161), tilt: 0.1225, yaw: -0.0064 };
  if (id === 'knife') return { hip: new THREE.Vector3(0.24, -0.25, -0.38), ads: new THREE.Vector3(0.24, -0.25, -0.38), tilt: 0 };
  const handgun = id === 'pistol' || id === 'revolver' || id === 'deagle' || id === 'mpistol';
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
  /** Golden Guns event: every gun is gold. */
  static goldGuns = false;
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
  /** Quick knife: the weapon to bring back once the slash is over. */
  private swingFrom: WeaponId | null = null;
  private current: WeaponId | null = null;
  private pose: Pose = { hip: new THREE.Vector3(), ads: new THREE.Vector3(), tilt: 0 };
  private copies = new Map<string, THREE.Object3D>();
  /** Skins for the weapons shown (the player's own, or the killer's in a killcam). */
  skins: SkinChoice = {};
  /** Charm hanging off the gun. */
  charm = 'none';
  /** Accessibility: no weapon bob or sway. */
  reduceMotion = false;
  /** Muzzle flash cosmetic: colour and size. */
  flashColor = 0xffffff;
  flashScale = 1;
  /** Melee weapon drawn in the knife slot. */
  melee: MeleeId = 'knife';
  /** Kills this match, for reactive camos. */
  kills = 0;
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

  setWeapon(id: WeaponId, skins: SkinChoice = this.skins, charm = this.charm, melee: string = this.melee, attach?: AttachSet): void {
    // A real weapon change ends any quick-knife slash.
    this.swingFrom = null;
    this.melee = melee as MeleeId;
    this.attach = attach;
    this.show(id, skins, charm);
  }

  /** Attachments on the gun in hand. */
  private attach: AttachSet | undefined;

  private show(id: WeaponId, skins: SkinChoice = this.skins, charm = this.charm): void {
    const skin = Viewmodel.goldGuns && id !== 'knife' ? 'gold' : (skins[camoKey(id, this.melee)] ?? 'none');
    const att = id === 'knife' ? undefined : this.attach;
    const key = `${id}:${skin}:${charm}:${id === 'knife' ? this.melee : ''}:${attachKey(att)}`;
    if (key === this.currentKey) return;
    this.currentKey = key;
    this.current = id;
    const m = id === 'knife' ? meleeModel(this.melee) : this.models[id];
    for (const c of this.copies.values()) c.visible = false;
    let copy = this.copies.get(key);
    if (!copy) {
      const c = charmDef(charm);
      copy = skinned(m.object, skin, id === 'knife' ? undefined : { shape: c.shape, color: c.color, at: m.length * 0.45 });
      copy.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      // Long melees (bat, katana) are shrunk in first person so they don't fill the screen.
      if (id === 'knife') copy.scale.setScalar(Math.min(1, 0.3 / m.length));
      addAttachments(copy, id, m, att);
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
    const c = this.current;
    const big = c === 'shotgun' || c === 'sniper' || c === 'revolver' || c === 'barrett' || c === 'autoshotgun' || c === 'deagle' ? 1.6 : c === 'dmr' || c === 'ak' || c === 'scar' ? 1.25 : 1;
    this.flash.scale.setScalar((0.16 + Math.random() * 0.08) * big * this.flashScale);
    this.flash.material.color.setHex(this.flashColor);
  }

  /** Quick melee: the knife comes out for the slash, then the gun comes back (see update). */
  swing(): void {
    if (this.current && this.current !== 'knife' && !this.swingFrom) {
      this.swingFrom = this.current;
      this.show('knife');
    }
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
    if (this.swingT === 0 && this.swingFrom) {
      const back = this.swingFrom;
      this.swingFrom = null;
      this.show(back);
    }
    this.swayX += (THREE.MathUtils.clamp(-s.lookDX * 0.0006, -0.04, 0.04) - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (THREE.MathUtils.clamp(s.lookDY * 0.0006, -0.04, 0.04) - this.swayY) * Math.min(1, dt * 10);
    if (s.onGround) this.bobT += dt * (s.sprinting ? 13 : 9) * Math.min(1, s.speed / 3);
    const bobAmp = Math.min(1, s.speed / 4) * (1 - this.adsT * 0.85) * (s.onGround ? 1 : 0) * (this.reduceMotion ? 0.15 : 1);
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
    const kc = this.current;
    const kickScale = kc === 'shotgun' || kc === 'sniper' || kc === 'revolver' || kc === 'barrett' || kc === 'deagle' ? 2.2 : kc === 'dmr' || kc === 'scar' || kc === 'autoshotgun' ? 1.6 : 1;
    this.gun.rotation.set(
      this.adsT * this.pose.tilt + this.kickRot * 0.06 * kickScale * (1 - this.adsT * 0.7) + reloadDip * -0.3 - this.sprintT * 0.25 - switchDip * 0.8 + swing * 0.4,
      this.adsT * (this.pose.yaw ?? 0) + this.sprintT * 0.75 + this.swayX * 2 + swing * 1.1,
      reloadDip * 0.7 + this.sprintT * 0.2 - swing * 0.6
    );

    setReactive(this.holder, this.kills / 10);
    this.flashLife -= dt;
    this.flash.visible = this.flashLife > 0 && s.visible && !this.scoped;
  }
}
