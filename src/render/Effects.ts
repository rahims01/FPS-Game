import * as THREE from 'three';

const MAX_PARTICLES = 1500;
const MAX_TRACERS = 48;
const MAX_DECALS = 160;
const FLASH_LIGHTS = 3;

export const flashTexture = (): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.25, 'rgba(255,210,120,0.9)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};

const dotTexture = (): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
};

/**
 * World-space combat effects: tracers, muzzle flashes, sparks, dust, blood and
 * bullet holes. Everything is pooled; nothing allocates per shot.
 */
export class Effects {
  readonly group = new THREE.Group();
  // Particles.
  private pPos = new Float32Array(MAX_PARTICLES * 3);
  private pVel = new Float32Array(MAX_PARTICLES * 3);
  private pCol = new Float32Array(MAX_PARTICLES * 3);
  private pLife = new Float32Array(MAX_PARTICLES);
  private pGrav = new Float32Array(MAX_PARTICLES);
  private pNext = 0;
  private points: THREE.Points;
  // Tracers.
  private tracers: { mesh: THREE.Mesh; life: number }[] = [];
  private tracerNext = 0;
  // Flashes.
  private flashes: { sprite: THREE.Sprite; life: number }[] = [];
  private flashNext = 0;
  private lights: { light: THREE.PointLight; life: number }[] = [];
  private lightNext = 0;
  // Decals.
  private decals: THREE.Mesh[] = [];
  private decalNext = 0;
  private holeMat = new THREE.MeshBasicMaterial({ color: 0x151310, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x0c0b0a, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  private smoke: { sprite: THREE.Sprite; life: number; max: number; vy: number; grow: number }[] = [];
  private smokeNext = 0;
  private fireballs: { sprite: THREE.Sprite; life: number; size: number }[] = [];
  private fireNext = 0;
  private bloodMat = new THREE.MeshBasicMaterial({ color: 0x5a0505, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.07, vertexColors: true, map: dotTexture(), transparent: true, depthWrite: false, sizeAttenuation: true })
    );
    this.points.frustumCulled = false;
    this.group.add(this.points);
    for (let i = 0; i < MAX_PARTICLES; i++) this.pPos[i * 3 + 1] = -1000;

    const tracerGeo = new THREE.BoxGeometry(0.012, 0.012, 1);
    tracerGeo.translate(0, 0, 0.5);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < MAX_TRACERS; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    const flashMat = new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < 16; i++) {
      const sprite = new THREE.Sprite(flashMat);
      sprite.visible = false;
      this.group.add(sprite);
      this.flashes.push({ sprite, life: 0 });
    }
    // A fixed number of lights: changing the light count would recompile every shader.
    for (let i = 0; i < FLASH_LIGHTS; i++) {
      const light = new THREE.PointLight(0xffc070, 0, 7, 2);
      this.group.add(light);
      this.lights.push({ light, life: 0 });
    }
    const smokeTex = dotTexture();
    for (let i = 0; i < 60; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x6a665e, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      this.group.add(sprite);
      this.smoke.push({ sprite, life: 0, max: 1, vy: 0, grow: 0 });
    }
    const fireMat = new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < 6; i++) {
      const sprite = new THREE.Sprite(fireMat.clone());
      sprite.visible = false;
      this.group.add(sprite);
      this.fireballs.push({ sprite, life: 0, size: 1 });
    }
    const decalGeo = new THREE.CircleGeometry(0.05, 8);
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(decalGeo, this.holeMat);
      m.visible = false;
      this.group.add(m);
      this.decals.push(m);
    }
  }

  /** Fraction of particles actually spawned (graphics setting). */
  density = 1;

  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, g: number, b: number, life: number, grav: number): void {
    if (this.density < 1 && Math.random() > this.density) return;
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % MAX_PARTICLES;
    this.pPos.set([x, y, z], i * 3);
    this.pVel.set([vx, vy, vz], i * 3);
    this.pCol.set([r, g, b], i * 3);
    this.pLife[i] = life;
    this.pGrav[i] = grav;
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const len = from.distanceTo(to);
    if (len < 1.5) return;
    const t = this.tracers[this.tracerNext];
    this.tracerNext = (this.tracerNext + 1) % MAX_TRACERS;
    // A streak covering part of the path reads better than a full laser line.
    const start = from.clone().lerp(to, Math.random() * 0.3);
    t.mesh.position.copy(start);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, Math.min(len * 0.6, start.distanceTo(to)));
    t.mesh.visible = true;
    t.life = 0.05;
  }

  muzzleFlash(at: THREE.Vector3, withLight: boolean, scale = 1): void {
    const f = this.flashes[this.flashNext];
    this.flashNext = (this.flashNext + 1) % this.flashes.length;
    f.sprite.position.copy(at);
    f.sprite.scale.setScalar((0.35 + Math.random() * 0.2) * scale);
    f.sprite.material.rotation = Math.random() * Math.PI;
    f.sprite.visible = true;
    f.life = 0.04;
    if (withLight) {
      const l = this.lights[this.lightNext];
      this.lightNext = (this.lightNext + 1) % this.lights.length;
      l.light.position.copy(at);
      l.light.intensity = 6;
      l.life = 0.05;
    }
  }

  /** Bullet hits a wall or the floor. */
  impact(p: THREE.Vector3, n: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      this.emit(p.x, p.y, p.z, n.x * 3 + (Math.random() - 0.5) * 4, n.y * 3 + Math.random() * 3, n.z * 3 + (Math.random() - 0.5) * 4, 1, 0.8, 0.4, 0.15 + Math.random() * 0.1, 12);
    }
    for (let i = 0; i < 5; i++) {
      this.emit(p.x, p.y, p.z, n.x * 1 + (Math.random() - 0.5), n.y * 1 + Math.random() * 0.6, n.z * 1 + (Math.random() - 0.5), 0.55, 0.52, 0.46, 0.5 + Math.random() * 0.4, 1);
    }
    this.decal(p, n, this.holeMat, 0.6 + Math.random() * 0.5);
  }

  blood(p: THREE.Vector3, dir: THREE.Vector3, heavy: boolean): void {
    const n = heavy ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const s = 1 + Math.random() * 2.5;
      this.emit(p.x, p.y, p.z, dir.x * s + (Math.random() - 0.5) * 1.5, dir.y * s + Math.random() * 1.5, dir.z * s + (Math.random() - 0.5) * 1.5, 0.55, 0.02, 0.02, 0.35 + Math.random() * 0.4, 9);
    }
  }

  /** Grenade or airstrike: fireball, flash light, sparks, debris, smoke and a scorch mark. */
  explosion(p: THREE.Vector3, big: boolean): void {
    const k = big ? 1.5 : 1;
    const f = this.fireballs[this.fireNext];
    this.fireNext = (this.fireNext + 1) % this.fireballs.length;
    f.sprite.position.copy(p).setY(p.y + 0.6 * k);
    f.size = 3.2 * k;
    f.life = 0.35;
    f.sprite.visible = true;
    const l = this.lights[this.lightNext];
    this.lightNext = (this.lightNext + 1) % this.lights.length;
    l.light.position.copy(p).setY(p.y + 1);
    l.light.intensity = 60 * k;
    l.light.distance = 18 * k;
    l.life = 0.18;
    for (let i = 0; i < 40 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 9;
      this.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * s, 2 + Math.random() * 8, Math.sin(a) * s, 1, 0.65 + Math.random() * 0.3, 0.2, 0.3 + Math.random() * 0.5, 14);
    }
    for (let i = 0; i < 25 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      this.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s, 0.25, 0.22, 0.2, 0.8 + Math.random() * 0.8, 12);
    }
    for (let i = 0; i < 8 * k; i++) {
      const sm = this.smoke[this.smokeNext];
      this.smokeNext = (this.smokeNext + 1) % this.smoke.length;
      sm.sprite.position.set(p.x + (Math.random() - 0.5) * 2 * k, p.y + 0.5 + Math.random() * k, p.z + (Math.random() - 0.5) * 2 * k);
      sm.max = sm.life = 2.5 + Math.random() * 2;
      sm.vy = 0.6 + Math.random() * 0.8;
      sm.grow = 1.2 + Math.random();
      sm.sprite.scale.setScalar(1.2 * k);
      sm.sprite.visible = true;
    }
    this.decal(new THREE.Vector3(p.x, 0.012, p.z), new THREE.Vector3(0, 1, 0), this.scorchMat, 30 * k);
  }

  bloodPool(x: number, z: number): void {
    const p = new THREE.Vector3(x, 0.01, z);
    this.decal(p, new THREE.Vector3(0, 1, 0), this.bloodMat, 6 + Math.random() * 4);
  }

  private decal(p: THREE.Vector3, n: THREE.Vector3, mat: THREE.Material, scale: number): void {
    const d = this.decals[this.decalNext];
    this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    d.material = mat;
    d.position.copy(p).addScaledVector(n, 0.01);
    d.lookAt(p.clone().add(n));
    d.scale.setScalar(scale);
    d.visible = true;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      const k = i * 3;
      if (this.pLife[i] <= 0) {
        this.pPos[k + 1] = -1000;
        continue;
      }
      this.pVel[k + 1] -= this.pGrav[i] * dt;
      this.pPos[k] += this.pVel[k] * dt;
      this.pPos[k + 1] += this.pVel[k + 1] * dt;
      this.pPos[k + 2] += this.pVel[k + 2] * dt;
      if (this.pPos[k + 1] < 0.01) {
        this.pPos[k + 1] = 0.01;
        this.pVel[k] *= 0.5;
        this.pVel[k + 1] = 0;
        this.pVel[k + 2] *= 0.5;
      }
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) f.sprite.visible = false;
    }
    for (const l of this.lights) {
      if (l.life <= 0) continue;
      l.life -= dt;
      if (l.life <= 0) {
        l.light.intensity = 0;
        l.light.distance = 7;
      }
    }
    for (const f of this.fireballs) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const t = 1 - f.life / 0.35;
      f.sprite.scale.setScalar(f.size * (0.4 + t));
      f.sprite.material.opacity = Math.max(0, 1 - t);
      if (f.life <= 0) f.sprite.visible = false;
    }
    for (const sm of this.smoke) {
      if (sm.life <= 0) continue;
      sm.life -= dt;
      const t = 1 - sm.life / sm.max;
      sm.sprite.position.y += sm.vy * dt;
      sm.sprite.scale.multiplyScalar(1 + sm.grow * dt * 0.5);
      sm.sprite.material.opacity = Math.max(0, 0.55 * Math.min(1, t * 6) * (1 - t));
      if (sm.life <= 0) sm.sprite.visible = false;
    }
  }
}
