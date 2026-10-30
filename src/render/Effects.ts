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

/** Blood pools: a few puddle shapes drawn once, each spreading out under a body over a couple of seconds. */
const POOL_SHAPES = 4;
const MAX_POOLS = 24;
const POOL_SPREAD_S = 2.4;

/**
 * One puddle shape: overlapping lobes with a few runs reaching out and some
 * spatter past the edge. Near-black where it's deepest, redder and thinner
 * toward the rim, with a soft wet highlight.
 */
const poolTexture = (seed: number): THREE.CanvasTexture => {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let s = seed * 7919 + 13;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const blob = (x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  const m = S / 2;
  g.fillStyle = '#fff';
  blob(m, m, 54);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 18 + rnd() * 40;
    blob(m + Math.cos(a) * d, m + Math.sin(a) * d, 20 + rnd() * 30);
  }
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const d = 62 + k * 9;
      blob(m + Math.cos(a) * d + (rnd() - 0.5) * 6, m + Math.sin(a) * d + (rnd() - 0.5) * 6, Math.max(3, 13 - k * 1.8));
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 96 + rnd() * 26;
    blob(m + Math.cos(a) * d, m + Math.sin(a) * d, 1.5 + rnd() * 3.5);
  }
  g.globalCompositeOperation = 'source-in';
  const body = g.createRadialGradient(m, m, 6, m, m, 124);
  body.addColorStop(0, 'rgba(38,0,2,0.96)');
  body.addColorStop(0.55, 'rgba(76,4,6,0.93)');
  body.addColorStop(1, 'rgba(118,10,10,0.78)');
  g.fillStyle = body;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-atop';
  const hx = m - 26 + rnd() * 20;
  const hy = m - 30 + rnd() * 20;
  const sheen = g.createRadialGradient(hx, hy, 2, hx, hy, 44);
  sheen.addColorStop(0, 'rgba(255,200,200,0.3)');
  sheen.addColorStop(1, 'rgba(255,200,200,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  // Blood pools (shapes drawn on first use).
  private poolMats: THREE.MeshLambertMaterial[] = [];
  private pools: { mesh: THREE.Mesh; t: number; size: number }[] = [];
  private poolNext = 0;
  /** Settings: blood on or off. Off, hits kick up dust instead and nobody leaves a pool. */
  bloodOn = true;
  /** Classroom mode: hits throw bright coloured sparks instead (blood is off too). */
  sparkHits = false;

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
      const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    const flashMat = new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < 16; i++) {
      const sprite = new THREE.Sprite(flashMat.clone());
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
  /** Accessibility: dimmer explosions and flashes. */
  reduceFlash = false;

  private paintMats = new Map<number, THREE.MeshBasicMaterial>();

  /** Paintball hit: a splash of the shooter's colour and a splat on the surface. */
  paint(p: THREE.Vector3, n: THREE.Vector3, color: number): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < 14; i++) {
      this.emit(p.x, p.y, p.z, n.x * 2 + (Math.random() - 0.5) * 4, n.y * 2 + Math.random() * 3, n.z * 2 + (Math.random() - 0.5) * 4, c.r, c.g, c.b, 0.35 + Math.random() * 0.3, 10);
    }
    let mat = this.paintMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
      this.paintMats.set(color, mat);
    }
    this.decal(p, n, mat, 2.2 + Math.random() * 1.6);
  }

  /** A flashbang going off: a blinding white burst and a sharp light. */
  flashBurst(p: THREE.Vector3): void {
    const f = this.fireballs[this.fireNext];
    this.fireNext = (this.fireNext + 1) % this.fireballs.length;
    f.sprite.position.copy(p);
    f.size = this.reduceFlash ? 1.5 : 4;
    f.life = 0.25;
    f.sprite.visible = true;
    const l = this.lights[this.lightNext];
    this.lightNext = (this.lightNext + 1) % this.lights.length;
    l.light.position.copy(p);
    l.light.intensity = this.reduceFlash ? 20 : 90;
    l.light.distance = 20;
    l.life = 0.12;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(p.x, p.y, p.z, Math.cos(a) * 6, Math.random() * 5, Math.sin(a) * 6, 1, 1, 0.9, 0.3, 6);
    }
  }

  /** Glass and a puff when a molotov or smoke can goes off. */
  shatter(p: THREE.Vector3, molotov: boolean): void {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      if (molotov) this.emit(p.x, p.y + 0.1, p.z, Math.cos(a) * s, 1 + Math.random() * 4, Math.sin(a) * s, 1, 0.55, 0.15, 0.4 + Math.random() * 0.4, 6);
      else this.emit(p.x, p.y + 0.1, p.z, Math.cos(a) * s * 0.5, 1 + Math.random() * 2, Math.sin(a) * s * 0.5, 0.8, 0.8, 0.8, 0.6, 2);
    }
  }

  // Persistent ground effects (smoke clouds, fire), driven by the simulation's fields.
  private fieldSprites: { sprite: THREE.Sprite; kind: 'fire' | 'smoke' }[] = [];
  private smokeMat = new THREE.SpriteMaterial({ map: dotTexture(), color: 0xb9bcbf, transparent: true, depthWrite: false, opacity: 0.85 });
  private fireMat = new THREE.SpriteMaterial({ map: flashTexture(), color: 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

  /** Draws smoke clouds and fires where the simulation says they are. */
  syncFields(fields: { kind: 'fire' | 'smoke'; x: number; z: number; r: number; until: number }[], time: number): void {
    // Smoke: a dense ball of overlapping puffs; fire: flickering flames over the ground.
    const wanted: { kind: 'fire' | 'smoke'; x: number; y: number; z: number; s: number; o: number }[] = [];
    let seed = 1;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const f of fields) {
      const left = f.until - time;
      const fade = Math.min(1, left / 2);
      if (f.kind === 'smoke') {
        for (let i = 0; i < 22; i++) {
          const a = rnd() * Math.PI * 2;
          const r = Math.sqrt(rnd()) * f.r * 0.8;
          wanted.push({ kind: 'smoke', x: f.x + Math.cos(a) * r + Math.sin(time * 0.3 + i) * 0.3, y: 0.6 + rnd() * 3.2, z: f.z + Math.sin(a) * r, s: 3.5 + rnd() * 2.5, o: 0.9 * fade });
        }
      } else {
        for (let i = 0; i < 12; i++) {
          const a = rnd() * Math.PI * 2;
          const r = Math.sqrt(rnd()) * f.r;
          const flick = 0.7 + 0.3 * Math.sin(time * 14 + i * 3);
          wanted.push({ kind: 'fire', x: f.x + Math.cos(a) * r, y: 0.35 + rnd() * 0.3, z: f.z + Math.sin(a) * r, s: (0.9 + rnd() * 0.8) * flick, o: fade });
        }
      }
    }
    while (this.fieldSprites.length < wanted.length) {
      const kind = wanted[this.fieldSprites.length].kind;
      const sprite = new THREE.Sprite((kind === 'smoke' ? this.smokeMat : this.fireMat).clone());
      this.group.add(sprite);
      this.fieldSprites.push({ sprite, kind });
    }
    this.fieldSprites.forEach((fs, i) => {
      const w = wanted[i];
      fs.sprite.visible = !!w;
      if (!w) return;
      if (fs.kind !== w.kind) {
        fs.sprite.material = (w.kind === 'smoke' ? this.smokeMat : this.fireMat).clone();
        fs.kind = w.kind;
      }
      fs.sprite.position.set(w.x, w.y, w.z);
      fs.sprite.scale.setScalar(w.s);
      fs.sprite.material.opacity = w.o;
    });
    // Embers rising off the fires.
    for (const f of fields) if (f.kind === 'fire' && Math.random() < 0.5) this.emit(f.x + (Math.random() - 0.5) * f.r, 0.3, f.z + (Math.random() - 0.5) * f.r, 0, 1.5 + Math.random() * 2, 0, 1, 0.5, 0.1, 0.6, -1);
  }

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

  /** `color` -1 cycles the rainbow (the rainbow tracer cosmetic). */
  tracer(from: THREE.Vector3, to: THREE.Vector3, color = 0xffe9a8): void {
    const len = from.distanceTo(to);
    if (len < 1.5) return;
    const t = this.tracers[this.tracerNext];
    const mat = t.mesh.material as THREE.MeshBasicMaterial;
    if (color < 0) mat.color.setHSL((performance.now() / 900) % 1, 1, 0.6);
    else mat.color.setHex(color);
    this.tracerNext = (this.tracerNext + 1) % MAX_TRACERS;
    // A streak covering part of the path reads better than a full laser line.
    const start = from.clone().lerp(to, Math.random() * 0.3);
    t.mesh.position.copy(start);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, Math.min(len * 0.6, start.distanceTo(to)));
    t.mesh.visible = true;
    t.life = 0.05;
  }

  muzzleFlash(at: THREE.Vector3, withLight: boolean, scale = 1, color = 0xffffff): void {
    const f = this.flashes[this.flashNext];
    f.sprite.material.color.setHex(color);
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
    if (this.sparkHits) {
      const colors = [[1, 0.77, 0], [0.35, 0.63, 1], [0.27, 0.83, 0.51], [1, 0.36, 0.6]];
      for (let i = 0; i < (heavy ? 14 : 8); i++) {
        const c = colors[i % colors.length];
        const sp = 1.5 + Math.random() * 2.5;
        this.emit(p.x, p.y, p.z, dir.x * sp + (Math.random() - 0.5) * 2.5, Math.random() * 2.5, dir.z * sp + (Math.random() - 0.5) * 2.5, c[0], c[1], c[2], 0.3 + Math.random() * 0.25, 7);
      }
      return;
    }
    if (!this.bloodOn) {
      for (let i = 0; i < 5; i++) this.emit(p.x, p.y, p.z, dir.x + (Math.random() - 0.5), dir.y + Math.random(), dir.z + (Math.random() - 0.5), 0.6, 0.58, 0.54, 0.25 + Math.random() * 0.2, 6);
      return;
    }
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
    l.light.intensity = 60 * k * (this.reduceFlash ? 0.3 : 1);
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

  /** A burst of confetti: gold for the admin's kills, every colour in a confetti event. */
  confetti(p: THREE.Vector3, gold: boolean): void {
    const palette = gold ? [[1, 0.82, 0.24], [1, 0.95, 0.75], [0.95, 0.65, 0.1]] : [[1, 0.77, 0], [0.35, 0.63, 1], [0.27, 0.83, 0.51], [1, 0.36, 0.6], [0.7, 0.45, 1]];
    for (let i = 0; i < 46; i++) {
      const c = palette[i % palette.length];
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 3.5;
      this.emit(p.x, p.y + 1, p.z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, c[0], c[1], c[2], 0.9 + Math.random() * 0.8, 5);
    }
  }

  /** The admin arriving: a column of golden light and a ring of sparks. */
  adminArrive(p: THREE.Vector3): void {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.emit(p.x + Math.cos(a) * 0.6, p.y + 0.1, p.z + Math.sin(a) * 0.6, Math.cos(a) * 1.5, 0.5 + Math.random(), Math.sin(a) * 1.5, 1, 0.82, 0.24, 0.8 + Math.random() * 0.4, 1);
    }
    for (let i = 0; i < 30; i++) this.emit(p.x + (Math.random() - 0.5) * 0.4, p.y + Math.random() * 0.5, p.z + (Math.random() - 0.5) * 0.4, 0, 5 + Math.random() * 6, 0, 1, 0.95, 0.7, 0.6 + Math.random() * 0.5, -2);
    const l = this.lights[this.lightNext];
    this.lightNext = (this.lightNext + 1) % this.lights.length;
    l.light.position.set(p.x, p.y + 2, p.z);
    l.light.color.setHex(0xffc400);
    l.light.intensity = 30;
    l.light.distance = 10;
    l.life = 0.9;
  }

  /** A soft dust puff (a dodgeball landing). */
  puff(p: THREE.Vector3): void {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(p.x, p.y, p.z, Math.cos(a) * 1.2, 0.5 + Math.random(), Math.sin(a) * 1.2, 0.75, 0.72, 0.66, 0.3 + Math.random() * 0.2, 4);
    }
  }

  /** A pool of blood spreading out under a body (y = the ground it lies on). */
  bloodPool(x: number, y: number, z: number): void {
    if (!this.bloodOn) return;
    if (!this.poolMats.length) {
      for (let i = 0; i < POOL_SHAPES; i++) {
        this.poolMats.push(new THREE.MeshLambertMaterial({ map: poolTexture(i + 1), transparent: true, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
      }
      const geo = new THREE.PlaneGeometry(1, 1);
      for (let i = 0; i < MAX_POOLS; i++) {
        const mesh = new THREE.Mesh(geo, this.poolMats[0]);
        mesh.visible = false;
        mesh.renderOrder = 1;
        this.group.add(mesh);
        this.pools.push({ mesh, t: 0, size: 1 });
      }
    }
    const pool = this.pools[this.poolNext];
    this.poolNext = (this.poolNext + 1) % MAX_POOLS;
    pool.mesh.material = this.poolMats[Math.floor(Math.random() * POOL_SHAPES)];
    pool.mesh.position.set(x, y + 0.015, z);
    pool.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    pool.size = 1 + Math.random() * 0.5;
    pool.t = 0;
    pool.mesh.scale.setScalar(pool.size * 0.2);
    pool.mesh.visible = true;
  }

  /** New round: wipe blood, bullet holes, scorch marks and paint off the map. */
  clearMarks(): void {
    for (const d of this.decals) d.visible = false;
    for (const p of this.pools) p.mesh.visible = false;
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
    for (const pool of this.pools) {
      if (!pool.mesh.visible || pool.t >= POOL_SPREAD_S) continue;
      pool.t = Math.min(POOL_SPREAD_S, pool.t + dt);
      const k = 1 - (1 - pool.t / POOL_SPREAD_S) ** 3;
      pool.mesh.scale.setScalar(pool.size * (0.2 + 0.8 * k));
    }
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
        l.light.color.setHex(0xffc070);
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
