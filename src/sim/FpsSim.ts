import { A, ACTIONS, createAgent, eyeHeight, isHuman, setLoadout, weaponOf, type Agent, type Control, type DeathCause } from './Agent';
import { Arena, type ArenaLayout, type Point } from './Arena';
import { BOT_AIM, HITBOX, RIFLE, SIM, SOLDIER, type HitRegion } from './config';
import { classicLayout } from './layouts';
import { clamp, forwardX, forwardZ, rightX, rightZ, Rng, wrapAngle, yawTo } from './math';
import { falloff, WEAPONS, type WeaponId } from './weapons';

export interface PlayerInput {
  /** -1..1 */
  forward: number;
  right: number;
  yaw: number;
  pitch: number;
  fire: boolean;
  aim: boolean;
  reload: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  melee: boolean;
  grenade: boolean;
  /** Weapon slot to switch to, or -1. */
  switchSlot: number;
}

export type SimEvent =
  | {
      type: 'shot';
      shooter: number;
      weapon: WeaponId;
      ox: number;
      oy: number;
      oz: number;
      ex: number;
      ey: number;
      ez: number;
      /** Agent hit, or -1. */
      hit: number;
      region: HitRegion | null;
      /** Surface normal when a wall or the floor was hit. */
      nx: number;
      ny: number;
      nz: number;
      world: boolean;
      /** First pellet of a shot (one sound and flash per trigger pull). */
      first: boolean;
    }
  | { type: 'damage'; target: number; attacker: number; amount: number; region: HitRegion; killed: boolean }
  | { type: 'death'; target: number; attacker: number; region: HitRegion; cause: DeathCause; distance: number; victimStreak: number; attackerHp: number }
  | { type: 'reload'; agent: number }
  | { type: 'switch'; agent: number }
  | { type: 'melee'; agent: number; hit: number }
  | { type: 'grenade'; agent: number }
  | { type: 'explosion'; x: number; y: number; z: number; owner: number; kind: 'grenade' | 'airstrike' }
  | { type: 'airstrike'; owner: number }
  | { type: 'pickup'; agent: number; pickup: number; kind: PickupKind };

export type PickupKind = 'medkit' | 'tag';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  z: number;
  active: boolean;
  /** Dog tags: the team of the player who dropped it. */
  team: number;
  /** Dog tags: when they vanish. */
  expires: number;
}

export interface Grenade {
  owner: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

/** Battle-royale safe zone. Outside it, soldiers take damage every second. */
export interface Zone {
  x: number;
  z: number;
  r: number;
  dps: number;
}

export const MEDKIT_HEAL = 50;
const GRENADE_FUSE = 2.4;
const GRENADE_RADIUS = 7;
const GRENADE_DAMAGE = 140;
const AIRSTRIKE_RADIUS = 9;
const AIRSTRIKE_DAMAGE = 220;
const SPAWN_PROTECTION = 1.5;
const SLIDE_TIME = 0.7;
const SLIDE_SPEED = 9.5;

/** normal: per-region damage. headshot: only head hits count. instagib: any hit kills. none: weapons do no damage (hot potato). */
export type DamageRule = 'normal' | 'headshot' | 'instagib' | 'none';

/** Chooses an action index for a bot. Called at 10 Hz. */
export type Brain = (agent: Agent, sim: FpsSim) => number;

export interface Rally {
  x: number;
  z: number;
  r: number;
  /** Followed even while fighting (a flag carrier running home). */
  urgent?: boolean;
  /** Once there, stand still (planting or defusing a bomb). */
  hold?: boolean;
}

export interface SimOptions {
  seed?: number;
  layout?: ArenaLayout;
  /** Multiplies damage dealt TO human players (difficulty). */
  damageToPlayerScale?: number;
  recordEvents?: boolean;
  /** Regenerate health after a few seconds without damage. */
  regen?: boolean;
  /** Bots that lose their target are given its rough position (small arenas). Off = they roam (battle royale). */
  hunt?: boolean;
  /** How far bots can see and hear. Big maps use shorter ranges so fights don't chain across the map. */
  viewRange?: number;
  damageRule?: DamageRule;
  hearingRange?: number;
}

const NO_INPUT: PlayerInput = {
  forward: 0,
  right: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  aim: false,
  reload: false,
  jump: false,
  sprint: false,
  crouch: false,
  melee: false,
  grenade: false,
  switchSlot: -1
};

export class FpsSim {
  readonly arena: Arena;
  readonly agents: Agent[] = [];
  readonly rng: Rng;
  readonly brains: Partial<Record<Control, Brain>> = {};
  events: SimEvent[] = [];
  pickups: Pickup[] = [];
  grenades: Grenade[] = [];
  strikes: { x: number; z: number; t: number; owner: number; target: number; jx: number; jz: number }[] = [];
  zone: Zone | null = null;
  /** Objective point bots move to when they are not fighting (king of the hill). */
  rally: Rally | null = null;
  /** Capture points shown in the world (domination). */
  objectives: { label: string; x: number; z: number; r: number; owner: number; progress: number; carried?: boolean }[] = [];
  /** Per-agent objective (domination), takes precedence over `rally`. */
  rallyFor: ((a: Agent) => Rally | null) | null = null;
  /** Mode hooks. */
  onKill: ((victim: Agent, killer: Agent | null, cause: DeathCause) => void) | null = null;
  onPickup: ((a: Agent, p: Pickup) => void) | null = null;
  /** Whether bots go for dog tags. */
  botsWantTags = false;
  /** Party-mode physics and rules. */
  gravity: number = SIM.gravity;
  jumpMul = 1;
  /** Head hitbox scale (Big Heads). */
  headScale = 1;
  /** One in the Chamber: no reloading; ammo only comes from kills. */
  noReload = false;
  /** Multiplies all weapon damage (hardcore). */
  damageMul = 1;
  /** Called on what would be a killing blow; return true to cancel the death (freeze tag freezes instead). */
  onLethal: ((victim: Agent, attacker: Agent | null, cause: DeathCause) => boolean) | null = null;
  /** Called when a knife connects; return true to cancel the damage (hot potato passes the bomb instead). */
  onMeleeHit: ((attacker: Agent, target: Agent) => boolean) | null = null;
  /** Online host: latest inputs of remote (human) players, by agent id. */
  readonly remoteInputs = new Map<number, PlayerInput>();
  /**
   * Online client: this simulation only mirrors the host. Damage, grenades and
   * pickups are the host's call, so they are switched off here.
   */
  puppet = false;
  time = 0;
  tick = 0;
  damageToPlayerScale: number;
  recordEvents: boolean;
  regen: boolean;
  hunt: boolean;
  viewRange: number;
  damageRule: DamageRule;
  hearingRange: number;

  constructor(opts: SimOptions = {}) {
    this.rng = new Rng(opts.seed ?? 1);
    this.arena = new Arena(opts.layout ?? classicLayout());
    this.damageToPlayerScale = opts.damageToPlayerScale ?? 1;
    this.recordEvents = opts.recordEvents ?? true;
    this.regen = opts.regen ?? true;
    this.hunt = opts.hunt ?? true;
    this.viewRange = opts.viewRange ?? 70;
    this.damageRule = opts.damageRule ?? 'normal';
    this.hearingRange = opts.hearingRange ?? SOLDIER.hearingRange;
  }

  spawn(team: number, control: Control, x: number, z: number, yaw = 0): Agent {
    const a = createAgent(this.agents.length, team, control, x, z, yaw);
    a.brain.aggression = this.rng.next();
    a.lastSeenX = x;
    a.lastSeenZ = z;
    this.agents.push(a);
    return a;
  }

  /** Brings a dead agent back at a new position with full health, ammo and its loadout. */
  respawn(a: Agent, x: number, z: number, yaw: number): void {
    const fresh = createAgent(a.id, a.team, a.control, x, z, yaw);
    fresh.life = a.life + 1;
    fresh.kills = a.kills;
    fresh.deaths = a.deaths;
    fresh.skill = a.skill;
    fresh.style = a.style;
    fresh.tier = a.tier;
    fresh.tierKills = a.tierKills;
    fresh.brain.aggression = this.rng.next();
    fresh.lastSeenX = x;
    fresh.lastSeenZ = z;
    fresh.protectedUntil = this.time + SPAWN_PROTECTION;
    const loadout = a.weapons;
    Object.assign(a, fresh);
    setLoadout(a, loadout);
  }

  get(id: number): Agent | undefined {
    return this.agents[id];
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: SimEvent): void {
    if (this.recordEvents) this.events.push(e);
  }

  // ---------------------------------------------------------------- stepping

  /** One fixed tick. `input` drives agents whose control is 'player'. */
  step(input: PlayerInput = NO_INPUT): void {
    const dt = SIM.dt;
    this.tick++;
    this.time += dt;
    for (const a of this.agents) {
      if (!a.alive) continue;
      if (a.control === 'player') {
        this.drivePlayer(a, input, dt);
      } else if (a.control === 'remote') {
        this.drivePlayer(a, this.remoteInputs.get(a.id) ?? NO_INPUT, dt);
      } else {
        if ((this.tick + a.phase) % SIM.decisionTicks === 0) {
          if (a.control !== 'external') {
            this.perceive(a);
            const brain = this.brains[a.control] ?? this.brains.heuristic;
            const next = brain ? brain(a, this) : A.hold;
            this.setAction(a, next);
          }
        }
        this.driveBot(a, dt);
      }
      this.integrate(a, dt);
      this.weaponTick(a, dt);
      if (this.regen && this.time - a.lastHitT > SOLDIER.regenDelay) a.hp = Math.min(SOLDIER.hp, a.hp + SOLDIER.regenRate * dt);
      this.collectPickups(a);
      if (this.zone && this.tick % 30 === 0 && this.outsideZone(a, 0)) this.damage(a, null, this.zone.dps * 0.5, 'torso', 0, 0, 0, 'zone');
    }
    this.separate();
    this.stepGrenades(dt);
    this.stepStrikes();
    if (this.tick % 30 === 0) for (const p of this.pickups) if (p.active && p.kind === 'tag' && this.time > p.expires) p.active = false;
  }

  // ---------------------------------------------------------------- pickups

  /**
   * Online client: advances only the local player's own soldier (movement,
   * weapon handling, recoil) so it responds instantly; the host decides hits.
   */
  stepLocal(a: Agent, input: PlayerInput): void {
    const dt = SIM.dt;
    this.tick++;
    this.time += dt;
    if (!a.alive) return;
    this.drivePlayer(a, input, dt);
    this.integrate(a, dt);
    this.weaponTick(a, dt);
  }

  spawnPickup(kind: PickupKind, x: number, z: number, team = -1, life = Infinity): Pickup {
    const p: Pickup = { id: this.pickups.length, kind, x, z, active: true, team, expires: this.time + life };
    this.pickups.push(p);
    return p;
  }

  private collectPickups(a: Agent): void {
    for (const p of this.pickups) {
      if (!p.active || Math.abs(p.x - a.x) > 1.1 || Math.abs(p.z - a.z) > 1.1 || a.y > 0.6) continue;
      if (p.kind === 'medkit') {
        if (a.hp >= SOLDIER.hp) continue;
        a.hp = Math.min(SOLDIER.hp, a.hp + MEDKIT_HEAL);
      }
      p.active = false;
      this.emit({ type: 'pickup', agent: a.id, pickup: p.id, kind: p.kind });
      this.onPickup?.(a, p);
      return;
    }
  }

  outsideZone(a: { x: number; z: number }, margin: number): boolean {
    const z = this.zone;
    return !!z && Math.hypot(a.x - z.x, a.z - z.z) > z.r - margin;
  }

  nearestPickup(a: Agent, kind: PickupKind, maxDist: number): Pickup | null {
    let best: Pickup | null = null;
    let bestD = maxDist;
    for (const p of this.pickups) {
      if (!p.active || p.kind !== kind || this.outsideZone(p, 1)) continue;
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  setAction(a: Agent, action: number): void {
    const next = action >= 0 && action < ACTIONS.length ? action : A.hold;
    if (next !== a.action) {
      a.prevAction = a.action;
      a.action = next;
      a.actionSince = this.time;
    }
  }

  // ---------------------------------------------------------------- player

  private drivePlayer(a: Agent, input: PlayerInput, dt: number): void {
    if (this.time < a.frozenUntil) {
      // Frozen (a blindfolded seeker): look around, but no moving or shooting.
      input = { ...NO_INPUT, yaw: input.yaw, pitch: input.pitch };
    }
    a.yaw = input.yaw;
    a.pitch = clamp(input.pitch, -1.45, 1.45);
    const w = weaponOf(a);
    a.aiming = input.aim && a.reloadT <= 0 && a.switchT <= 0 && w.slot !== 'melee';
    const len = Math.hypot(input.forward, input.right);
    const f = len > 1 ? input.forward / len : input.forward;
    const r = len > 1 ? input.right / len : input.right;
    const wantSprint = input.sprint && f > 0.5 && !a.aiming && !(input.fire && w.slot !== 'melee');
    // Sprint + crouch starts a slide.
    if (input.crouch && !a.crouching && a.sprinting && a.onGround && a.slideT <= 0) {
      a.slideT = SLIDE_TIME;
      const sp = Math.hypot(a.vx, a.vz) || 1;
      a.vx = (a.vx / sp) * SLIDE_SPEED;
      a.vz = (a.vz / sp) * SLIDE_SPEED;
    }
    a.crouching = input.crouch && a.slideT <= 0;
    a.sprinting = wantSprint && !a.crouching && a.slideT <= 0;
    if (a.slideT > 0) {
      a.slideT -= dt;
      // Slides keep their momentum and bleed speed.
      const sp = Math.hypot(a.vx, a.vz);
      const k = Math.max(0, sp - 9 * dt) / Math.max(sp, 1e-6);
      a.vx *= k;
      a.vz *= k;
      if (a.slideT <= 0 && input.crouch) a.crouching = true;
    } else {
      let speed = a.sprinting ? SOLDIER.sprintSpeed : f < -0.1 ? SOLDIER.backSpeed + 0.6 : SOLDIER.walkSpeed + 0.6;
      if (a.aiming) speed *= 0.6;
      if (a.crouching) speed *= 0.5;
      speed *= w.move;
      const mx = forwardX(a.yaw) * f + rightX(a.yaw) * r;
      const mz = forwardZ(a.yaw) * f + rightZ(a.yaw) * r;
      this.accelerate(a, mx * speed, mz * speed, dt);
    }
    if (input.jump && a.onGround && a.slideT <= 0) {
      a.vy = SOLDIER.jumpSpeed * this.jumpMul;
      a.onGround = false;
      a.crouching = false;
    }
    if (input.switchSlot >= 0) this.switchWeapon(a, input.switchSlot);
    if (input.reload) this.startReload(a);
    if (input.melee) this.melee(a);
    if (input.grenade) this.throwGrenade(a, a.yaw, a.pitch + 0.12, 17);
    const pressed = input.fire && !a.triggerHeld;
    a.triggerHeld = input.fire;
    if (w.slot === 'melee') {
      if (input.fire) this.melee(a);
    } else if (input.fire && (w.auto || pressed) && !a.sprinting) {
      const moving = Math.hypot(a.vx, a.vz) > 0.6;
      let spread = !a.onGround ? w.spreadAir : moving ? w.spreadMoving : w.spreadStill;
      if (a.aiming) spread *= w.adsSpread;
      if (a.crouching) spread *= 0.75;
      this.tryFire(a, a.yaw + a.recoilYaw, a.pitch + a.recoil, spread);
    }
  }

  private accelerate(a: Agent, wantVx: number, wantVz: number, dt: number): void {
    const acc = (a.onGround ? SOLDIER.accel : SOLDIER.airAccel) * dt;
    const dx = wantVx - a.vx;
    const dz = wantVz - a.vz;
    const d = Math.hypot(dx, dz);
    if (d <= acc) {
      a.vx = wantVx;
      a.vz = wantVz;
    } else {
      a.vx += (dx / d) * acc;
      a.vz += (dz / d) * acc;
    }
  }

  private integrate(a: Agent, dt: number): void {
    const p = { x: a.x + a.vx * dt, z: a.z + a.vz * dt };
    this.arena.resolveCircle(p, SOLDIER.radius, a.y);
    // Velocity the obstacles allowed, so sliding along a wall keeps its tangent speed.
    a.vx = (p.x - a.x) / dt;
    a.vz = (p.z - a.z) / dt;
    a.x = p.x;
    a.z = p.z;
    const ground = this.arena.groundHeight(a.x, a.z, SOLDIER.radius, a.y);
    if (!a.onGround || a.y > ground + 0.01) {
      a.vy -= this.gravity * dt;
      a.y += a.vy * dt;
      if (a.y <= ground) {
        a.y = ground;
        a.vy = 0;
        a.onGround = true;
      } else {
        a.onGround = false;
      }
    } else {
      // Step up onto low ledges.
      a.y = ground;
    }
  }

  /** Living soldiers push each other apart. */
  private separate(): void {
    const r2 = SOLDIER.radius * 2;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.agents.length; j++) {
        const b = this.agents[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= r2 || d < 1e-6) continue;
        const push = (r2 - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  }

  // ---------------------------------------------------------------- weapons

  private weaponTick(a: Agent, dt: number): void {
    a.fireCd = Math.max(0, a.fireCd - dt);
    a.meleeCd = Math.max(0, a.meleeCd - dt);
    a.grenadeCd = Math.max(0, a.grenadeCd - dt);
    a.switchT = Math.max(0, a.switchT - dt);
    // Recoil only recovers once the trigger rests, so sustained fire climbs.
    if (this.time - a.lastShotT > 0.12) {
      a.recoil -= a.recoil * Math.min(1, RIFLE.recoilRecover * dt);
      a.recoilYaw -= a.recoilYaw * Math.min(1, RIFLE.recoilRecover * dt);
    }
    if (this.time - a.lastShotT > 0.3) a.recoilIdx = 0;
    const w = weaponOf(a);
    if (a.reloadT > 0) {
      a.reloadT -= dt;
      if (a.reloadT <= 0) {
        a.reloadT = 0;
        a.ammo = w.magazine;
      }
    }
    if (a.ammo === 0 && a.reloadT <= 0 && w.magazine > 0 && !this.noReload) this.startReload(a);
  }

  startReload(a: Agent): void {
    const w = weaponOf(a);
    if (this.noReload || a.reloadT > 0 || a.ammo >= w.magazine || a.switchT > 0) return;
    a.reloadT = w.reload;
    a.aiming = false;
    this.emit({ type: 'reload', agent: a.id });
  }

  switchWeapon(a: Agent, slot: number): void {
    if (slot === a.slot || slot < 0 || slot >= a.weapons.length) return;
    a.stash[a.slot] = a.ammo;
    a.slot = slot;
    a.ammo = a.stash[slot];
    a.reloadT = 0;
    a.switchT = 0.45;
    a.aiming = false;
    this.emit({ type: 'switch', agent: a.id });
  }

  /** Fires one trigger pull if the weapon is ready. Returns true if it fired. */
  tryFire(a: Agent, yaw: number, pitch: number, spread: number): boolean {
    const w = weaponOf(a);
    if (w.slot === 'melee' || a.fireCd > 0 || a.reloadT > 0 || a.switchT > 0 || a.ammo <= 0) return false;
    a.fireCd = w.interval;
    a.ammo--;
    a.shots++;
    a.lastShotT = this.time;
    a.protectedUntil = 0;
    if (isHuman(a)) {
      const [up, side] = w.pattern[Math.min(a.recoilIdx, w.pattern.length - 1)];
      const k = w.recoil * (a.aiming ? 0.65 : 1) * (a.crouching ? 0.8 : 1);
      a.recoil = Math.min(0.4, a.recoil + up * k);
      // Positive yaw turns left; patterns are written with + = right.
      a.recoilYaw = clamp(a.recoilYaw - side * k + (this.rng.next() - 0.5) * k * 0.15, -0.25, 0.25);
      a.recoilIdx++;
    }
    const ox = a.x;
    const oy = a.y + eyeHeight(a);
    const oz = a.z;
    let hitAny = false;
    for (let p = 0; p < w.pellets; p++) {
      // Uniform-ish disc inside the cone.
      const ang = this.rng.next() * Math.PI * 2;
      const rad = Math.sqrt(this.rng.next()) * spread;
      const yw = yaw + Math.cos(ang) * rad;
      const pt = pitch + Math.sin(ang) * rad;
      const dx = Math.sin(yw) * Math.cos(pt);
      const dy = Math.sin(pt);
      const dz = Math.cos(yw) * Math.cos(pt);
      const n = { x: 0, y: 0, z: 0 };
      const wallT = this.arena.raycast(ox, oy, oz, dx, dy, dz, w.range, n);
      let bestT = wallT;
      let victim: Agent | null = null;
      let region: HitRegion = 'torso';
      for (const b of this.agents) {
        if (!b.alive || b === a || b.team === a.team || this.isFrozen(b)) continue;
        const hit = rayHitAgent(ox, oy, oz, dx, dy, dz, b, this.headScale);
        if (hit && hit.t < bestT) {
          bestT = hit.t;
          victim = b;
          region = hit.region;
        }
      }
      this.emit({
        type: 'shot',
        shooter: a.id,
        weapon: w.id,
        ox,
        oy,
        oz,
        ex: ox + dx * bestT,
        ey: oy + dy * bestT,
        ez: oz + dz * bestT,
        hit: victim ? victim.id : -1,
        region: victim ? region : null,
        nx: n.x,
        ny: n.y,
        nz: n.z,
        world: !victim && wallT < w.range,
        first: p === 0
      });
      if (victim) {
        hitAny = true;
        const raw =
          this.damageRule === 'none'
            ? 0
            : this.damageRule === 'instagib'
              ? 999
              : this.damageRule === 'headshot'
                ? region === 'head'
                  ? 100
                  : 0
                : w.damage[region] * falloff(w, bestT);
        if (raw > 0) this.damage(victim, a, raw, region, dx, dy, dz, w.id);
      }
    }
    if (hitAny) a.hits++;
    this.alertByNoise(a);
    return true;
  }

  /** Gunfire gives away the shooter's position. */
  private alertByNoise(a: Agent, range = this.hearingRange): void {
    for (const b of this.agents) {
      if (!b.alive || b.team === a.team || b.control === 'player') continue;
      if (Math.hypot(b.x - a.x, b.z - a.z) > range || b.seesTarget) continue;
      b.targetId = a.id;
      b.lastSeenX = a.x + this.rng.gauss() * 1.5;
      b.lastSeenZ = a.z + this.rng.gauss() * 1.5;
      b.lastSeenT = this.time;
    }
  }

  /** Knife swing: hits the nearest enemy in front within reach. */
  melee(a: Agent): void {
    if (a.meleeCd > 0 || a.switchT > 0) return;
    a.meleeCd = WEAPONS.knife.interval;
    a.protectedUntil = 0;
    a.lastShotT = this.time;
    let best: Agent | null = null;
    let bestD = WEAPONS.knife.range;
    const fx = forwardX(a.yaw);
    const fz = forwardZ(a.yaw);
    for (const b of this.agents) {
      if (!b.alive || b.team === a.team) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || Math.abs(b.y - a.y) > 1.2) continue;
      if ((dx * fx + dz * fz) / Math.max(d, 1e-6) < 0.45) continue;
      best = b;
      bestD = d;
    }
    this.emit({ type: 'melee', agent: a.id, hit: best ? best.id : -1 });
    if (best) {
      if (this.onMeleeHit?.(a, best)) return;
      const raw = this.damageRule === 'none' ? 0 : this.damageRule === 'headshot' ? 100 : a.meleeDamage;
      if (raw > 0) this.damage(best, a, raw, 'torso', fx, 0.1, fz, 'knife');
    }
  }

  throwGrenade(a: Agent, yaw: number, pitch: number, speed: number): void {
    if (this.puppet || a.grenades <= 0 || a.grenadeCd > 0 || a.switchT > 0) return;
    a.grenades--;
    a.grenadeCd = 1;
    a.protectedUntil = 0;
    const cp = Math.cos(pitch);
    const ey = a.y + eyeHeight(a) - 0.1;
    this.grenades.push({
      owner: a.id,
      x: a.x + Math.sin(yaw) * 0.4,
      y: ey,
      z: a.z + Math.cos(yaw) * 0.4,
      vx: Math.sin(yaw) * cp * speed + a.vx * 0.5,
      vy: Math.sin(pitch) * speed + 1.5,
      vz: Math.cos(yaw) * cp * speed + a.vz * 0.5,
      fuse: GRENADE_FUSE
    });
    this.emit({ type: 'grenade', agent: a.id });
  }

  private stepGrenades(dt: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      const sub = 2;
      const h = dt / sub;
      for (let s = 0; s < sub; s++) {
        g.vy -= this.gravity * h;
        const px = g.x;
        const py = g.y;
        const pz = g.z;
        g.x += g.vx * h;
        g.y += g.vy * h;
        g.z += g.vz * h;
        if (g.y < 0.07) {
          g.y = 0.07;
          if (g.vy < 0) g.vy = -g.vy * 0.3;
          g.vx *= 0.6;
          g.vz *= 0.6;
        }
        const b = this.arena.boxAt(g.x, g.y, g.z);
        if (b) {
          // Bounce off whichever face it came through.
          if (px <= b.minX || px >= b.maxX) {
            g.x = px;
            g.vx = -g.vx * 0.4;
          } else if (pz <= b.minZ || pz >= b.maxZ) {
            g.z = pz;
            g.vz = -g.vz * 0.4;
          } else if (py >= b.h) {
            g.y = b.h + 0.07;
            g.vy = -g.vy * 0.3;
            g.vx *= 0.6;
            g.vz *= 0.6;
          } else {
            g.x = px;
            g.z = pz;
            g.vx = -g.vx * 0.3;
            g.vz = -g.vz * 0.3;
          }
        }
      }
      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.grenades.splice(i, 1);
        this.explode(g.x, g.y, g.z, g.owner, 'grenade');
      }
    }
  }

  /** Killstreak: strikes on every enemy's current position a couple of seconds later. */
  callAirstrike(owner: Agent): void {
    const targets = this.agents.filter((b) => b.alive && b.team !== owner.team).slice(0, 6);
    targets.forEach((b, i) => {
      this.strikes.push({ x: b.x, z: b.z, t: this.time + 2.2 + i * 0.35, owner: owner.id, target: b.id, jx: this.rng.gauss() * 1.2, jz: this.rng.gauss() * 1.2 });
    });
    this.emit({ type: 'airstrike', owner: owner.id });
  }

  private stepStrikes(): void {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      // The strike tracks its target until it locks on, 0.6 s before impact (time to dodge).
      const tgt = this.agents[s.target];
      if (tgt && tgt.alive && this.time < s.t - 0.6) {
        s.x = tgt.x + s.jx;
        s.z = tgt.z + s.jz;
      }
      if (this.time < s.t) continue;
      this.strikes.splice(i, 1);
      this.explode(s.x, 0.2, s.z, s.owner, 'airstrike');
    }
  }

  explode(x: number, y: number, z: number, ownerId: number, kind: 'grenade' | 'airstrike'): void {
    const owner = this.agents[ownerId] ?? null;
    const R = kind === 'grenade' ? GRENADE_RADIUS : AIRSTRIKE_RADIUS;
    const max = kind === 'grenade' ? GRENADE_DAMAGE : AIRSTRIKE_DAMAGE;
    this.emit({ type: 'explosion', x, y, z, owner: ownerId, kind });
    for (const b of this.agents) {
      if (!b.alive) continue;
      if (owner && b !== owner && b.team === owner.team) continue;
      const cy = b.y + 1;
      const d = Math.hypot(b.x - x, cy - y, b.z - z);
      if (d > R) continue;
      if (!this.arena.lineOfSight(x, y + 0.4, z, b.x, cy, b.z) && !this.arena.lineOfSight(x, y + 0.4, z, b.x, b.y + HITBOX.headY, b.z)) continue;
      let dmg = max * Math.pow(1 - d / R, 0.8);
      if (b === owner) dmg *= 0.5;
      const len = Math.max(d, 0.3);
      this.damage(b, owner, dmg, 'torso', (b.x - x) / len, 0.6, (b.z - z) / len, kind);
    }
    if (owner) this.alertByNoise(owner, this.hearingRange * 1.3);
  }

  /** `attacker` is null for environmental damage (the battle-royale zone). */
  damage(v: Agent, attacker: Agent | null, raw: number, region: HitRegion, dx: number, dy: number, dz: number, cause: DeathCause = 'rifle'): void {
    if (this.puppet || !v.alive || this.time < v.protectedUntil) return;
    let amount = v.control === 'player' ? raw * this.damageToPlayerScale : raw;
    amount *= v.armor;
    if (attacker) amount *= this.damageMul;
    const dealt = Math.min(amount, v.hp);
    v.hp -= amount;
    v.lastHitT = this.time;
    v.lastHitDirX = -dx;
    v.lastHitDirZ = -dz;
    v.damageTaken += dealt;
    v.reward -= dealt / 100;
    if (attacker && attacker !== v) {
      attacker.damageDealt += dealt;
      attacker.reward += dealt / 100;
      // Being shot reveals the shooter.
      v.targetId = attacker.id;
      v.lastSeenX = attacker.x;
      v.lastSeenZ = attacker.z;
      v.lastSeenT = this.time;
    }
    if (v.hp <= 0 && this.onLethal?.(v, attacker, cause)) {
      this.emit({ type: 'damage', target: v.id, attacker: attacker ? attacker.id : -1, amount: dealt, region, killed: true });
      return;
    }
    const killed = v.hp <= 0;
    this.emit({ type: 'damage', target: v.id, attacker: attacker ? attacker.id : -1, amount: dealt, region, killed });
    if (killed) {
      v.alive = false;
      v.hp = 0;
      v.deaths++;
      const victimStreak = v.streak;
      v.streak = 0;
      v.killedBy = attacker ? attacker.id : -1;
      v.deathRegion = region;
      v.deathDirX = dx;
      v.deathDirY = dy;
      v.deathDirZ = dz;
      v.deathT = this.time;
      v.deathCause = cause;
      if (attacker && attacker !== v) {
        attacker.kills++;
        attacker.streak++;
        attacker.reward += 1;
      }
      v.reward -= 1;
      const distance = attacker ? Math.hypot(attacker.x - v.x, attacker.z - v.z) : 0;
      this.emit({ type: 'death', target: v.id, attacker: attacker ? attacker.id : -1, region, cause, distance, victimStreak, attackerHp: attacker ? Math.max(0, Math.ceil(attacker.hp)) : 0 });
      this.onKill?.(v, attacker && attacker !== v ? attacker : null, cause);
    }
  }

  // ---------------------------------------------------------------- bot senses

  /** Can `a` see `b` right now? Vision cone + line of sight to head or chest. */
  canSee(a: Agent, b: Agent): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d > this.viewRange) return false;
    const alerted = this.time - a.lastHitT < 1.5;
    if (d > 4 && !alerted) {
      const cos = (dx * forwardX(a.yaw) + dz * forwardZ(a.yaw)) / Math.max(d, 1e-6);
      if (cos < SOLDIER.fovCos) return false;
    }
    const ey = a.y + eyeHeight(a);
    const k = crouchScale(b);
    return (
      this.arena.lineOfSight(a.x, ey, a.z, b.x, b.y + HITBOX.headY * k, b.z) ||
      this.arena.lineOfSight(a.x, ey, a.z, b.x, b.y + ((HITBOX.torsoMinY + HITBOX.torsoMaxY) / 2) * k, b.z)
    );
  }

  target(a: Agent): Agent | null {
    const t = this.agents[a.targetId];
    return t && t.alive && t.team !== a.team && !this.isFrozen(t) ? t : null;
  }

  /** Frozen soldiers (freeze tag, blindfolded seekers) can't move, shoot or be targeted. */
  isFrozen(a: Agent): boolean {
    return this.time < a.frozenUntil;
  }

  private jump(a: Agent): void {
    if (!a.onGround || a.slideT > 0) return;
    a.vy = SOLDIER.jumpSpeed * this.jumpMul;
    a.onGround = false;
    a.crouching = false;
  }

  knowsTarget(a: Agent): boolean {
    return this.time - a.lastSeenT < SOLDIER.memory;
  }

  /** Updates target choice, visibility, memory and cover state. Called at decision rate. */
  perceive(a: Agent): void {
    let best: Agent | null = null;
    let bestD = Infinity;
    let fallback: Agent | null = null;
    let fallbackD = Infinity;
    for (const b of this.agents) {
      if (!b.alive || b.team === a.team || this.isFrozen(b)) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < fallbackD) {
        fallbackD = d;
        fallback = b;
      }
      if (d < bestD && this.canSee(a, b)) {
        bestD = d;
        best = b;
      }
    }
    const wasSeeing = a.seesTarget;
    const prevTarget = a.targetId;
    if (best) {
      a.targetId = best.id;
      a.seesTarget = true;
      a.lastSeenX = best.x;
      a.lastSeenZ = best.z;
      a.lastSeenT = this.time;
      if (!wasSeeing || prevTarget !== best.id) a.trackT = 0;
    } else {
      a.seesTarget = false;
      a.trackT = 0;
      // Snipers who lose sight of someone hold the angle for a while.
      if (wasSeeing && a.style === 'sniper') a.holdUntil = this.time + 5 + this.rng.next() * 4;
      // Footsteps: sprinting is loud, walking is quieter, crouching is silent.
      for (const b of this.agents) {
        if (!b.alive || b.team === a.team || b.crouching || b.slideT > 0) continue;
        const speed = Math.hypot(b.vx, b.vz);
        const range = b.sprinting ? 16 : speed > 0.8 ? 8 : 0;
        if (range && Math.hypot(b.x - a.x, b.z - a.z) < range) {
          a.targetId = b.id;
          a.lastSeenX = b.x + this.rng.gauss() * 1.2;
          a.lastSeenZ = b.z + this.rng.gauss() * 1.2;
          a.lastSeenT = this.time;
          break;
        }
      }
      if (!this.target(a) && fallback) a.targetId = fallback.id;
      const t = this.target(a);
      if (t && !this.knowsTarget(a)) {
        if (this.hunt) {
          // Out of memory: the bot goes hunting toward a rough guess of where its enemy is.
          a.lastSeenX = t.x + this.rng.gauss() * 6;
          a.lastSeenZ = t.z + this.rng.gauss() * 6;
          a.lastSeenT = this.time - SOLDIER.memory * 0.6;
        } else if (this.time >= a.roamT) {
          // Big maps: wander locally (drifting toward the zone centre) until someone is seen or heard.
          // lastSeenT is left alone, so the bot still knows it has no target.
          const z = this.zone;
          const toward = z && this.outsideZone(a, 25) ? 0.6 : 0;
          const cx = z ? a.x + (z.x - a.x) * toward : a.x;
          const cz = z ? a.z + (z.z - a.z) * toward : a.z;
          const p = this.arena.randomFreePoint(() => this.rng.next(), cx, cz, toward > 0 ? 30 : 15);
          if (p) {
            a.lastSeenX = p.x;
            a.lastSeenZ = p.z;
          }
          // Linger between moves, like a player looting a building.
          a.roamT = this.time + 10 + this.rng.next() * 10;
        }
      }
    }
    const t = this.target(a);
    a.inCover = !!t && this.knowsTarget(a) && !this.arena.lineOfSight(a.x, a.y + eyeHeight(a), a.z, a.lastSeenX, 1.5, a.lastSeenZ);
  }

  /**
   * Best nearby spot that hides `a` from where its target was last seen.
   * Cached for half a second.
   */
  coverFor(a: Agent): Point | null {
    if (this.time - a.coverT < 0.5) return a.cover;
    a.coverT = this.time;
    a.cover = null;
    if (!this.target(a)) return null;
    const tx = a.lastSeenX;
    const tz = a.lastSeenZ;
    let bestScore = Infinity;
    for (const p of this.arena.coverPoints) {
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      if (d > 18) continue;
      const dt = Math.hypot(p.x - tx, p.z - tz);
      if (dt < 5) continue;
      const score = d + Math.max(0, 9 - dt) * 1.5;
      if (score >= bestScore) continue;
      if (this.arena.lineOfSight(p.x, 1.5, p.z, tx, 1.5, tz)) continue;
      bestScore = score;
      a.cover = p;
    }
    return a.cover;
  }

  // ---------------------------------------------------------------- bot motor

  /**
   * Bots jump too: over low crates in their way, to get unstuck, and (by
   * personality) to dodge during fights.
   */
  private botJumps(a: Agent, mx: number, mz: number, speed: number, name: string, crouch: boolean, dt: number): void {
    if (!a.onGround || crouch) {
      a.stuckT = 0;
      return;
    }
    const moving = mx !== 0 || mz !== 0;
    // Stuck: pushing into something without getting anywhere.
    if (moving && Math.hypot(a.vx, a.vz) < 0.5) {
      a.stuckT += dt;
      if (a.stuckT > 0.35) {
        this.jump(a);
        a.stuckT = 0;
        return;
      }
    } else a.stuckT = 0;
    // A low crate right ahead: hop onto it rather than walk around.
    if (moving && speed > 3) {
      const b = this.arena.boxAt(a.x + mx * 0.9, a.y + 0.4, a.z + mz * 0.9);
      const rise = b ? b.h - a.y : 0;
      if (b && rise > SOLDIER.stepHeight && rise < 1.3) {
        this.jump(a);
        return;
      }
    }
    // Combat hops, by personality.
    const rate = a.style === 'rusher' ? 0.012 : a.style === 'flanker' ? 0.006 : a.style === 'soldier' ? 0.004 : a.style === 'tactician' ? 0.002 : 0;
    if (a.seesTarget && (name === 'strafe_left' || name === 'strafe_right' || name === 'advance') && this.rng.next() < rate * this.jumpMul) this.jump(a);
  }

  private followPath(a: Agent, gx: number, gz: number): { x: number; z: number } {
    const moved = Math.hypot(gx - a.pathGoalX, gz - a.pathGoalZ) > 1.5;
    if (moved || a.path.length === 0 || this.time - a.pathT > 1.5) {
      a.path = this.arena.findPath({ x: a.x, z: a.z }, { x: gx, z: gz });
      a.pathGoalX = gx;
      a.pathGoalZ = gz;
      a.pathT = this.time;
    }
    while (a.path.length > 1 && Math.hypot(a.path[0].x - a.x, a.path[0].z - a.z) < 0.7) a.path.shift();
    const wp = a.path[0];
    if (!wp) return { x: 0, z: 0 };
    const dx = wp.x - a.x;
    const dz = wp.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) return { x: 0, z: 0 };
    return { x: dx / d, z: dz / d };
  }

  private driveBot(a: Agent, dt: number): void {
    if (this.isFrozen(a)) {
      this.accelerate(a, 0, 0, dt);
      return;
    }
    const t = this.target(a);
    const w = weaponOf(a);
    let name = ACTIONS[a.action];
    const tx = t && a.seesTarget ? t.x : a.lastSeenX;
    const tz = t && a.seesTarget ? t.z : a.lastSeenZ;
    const toYaw = yawTo(a.x, a.z, tx, tz);
    let mx = 0;
    let mz = 0;
    let speed: number = SOLDIER.walkSpeed;
    let mayFire = true;
    let faceMove = false;
    // Overrides that sit outside the learned action space: knife rushes, getting
    // back inside the zone, objectives, medkits and dog tags.
    const knife = w.slot === 'melee' || (this.noReload && a.ammo === 0);
    const zoneGoal = !a.seesTarget && this.zone && this.outsideZone(a, 3) ? this.zone : null;
    const tag = !zoneGoal && !a.seesTarget && this.botsWantTags ? this.nearestPickup(a, 'tag', 20) : null;
    const medkit = !zoneGoal && !tag && !a.seesTarget && a.hp < 70 ? this.nearestPickup(a, 'medkit', 22) : null;
    const r = this.rallyFor ? this.rallyFor(a) : this.rally;
    const farFromRally = !!r && Math.hypot(a.x - r.x, a.z - r.z) > r.r * 0.6;
    const urgent = r && r.urgent && farFromRally ? r : null;
    const rallyGoal = !zoneGoal && !tag && !medkit && !a.seesTarget && farFromRally ? r : null;
    const override = urgent ?? (knife && t && (a.seesTarget || this.knowsTarget(a)) ? { x: tx, z: tz } : (zoneGoal ?? tag ?? medkit ?? rallyGoal));
    const style = a.style;
    const known = this.knowsTarget(a);
    const dTarget = Math.hypot(tx - a.x, tz - a.z);
    let crouch = false;
    // Standing objectives (planting, defusing): hold still once there.
    if (r && r.hold && !farFromRally && (!a.seesTarget || r.urgent)) name = 'hold';
    if (!override) {
      if (style === 'rusher' && name === 'advance' && !a.seesTarget) name = 'sprint';
      if (style === 'sniper' && !a.seesTarget && known && (name === 'advance' || name === 'sprint') && this.time < a.holdUntil) name = 'hold';
      if (style === 'tactician' && a.seesTarget && a.hp < 40 && !a.inCover && this.coverFor(a)) name = 'take_cover';
      if ((style === 'sniper' || style === 'tactician') && name === 'hold') crouch = true;
    }
    // Flankers swing wide around a target they can't see instead of walking straight at it.
    const goal = (gx: number, gz: number): [number, number] => {
      if (style !== 'flanker' || a.seesTarget || dTarget < 12) return [gx, gz];
      const px = -(gz - a.z) / dTarget;
      const pz = (gx - a.x) / dTarget;
      const off = Math.min(12, dTarget * 0.5) * (a.id % 2 ? 1 : -1);
      return [gx + px * off, gz + pz * off];
    };
    switch (override ? 'override' : name) {
      case 'override': {
        const m = this.followPath(a, override!.x, override!.z);
        mx = m.x;
        mz = m.z;
        speed = SOLDIER.sprintSpeed;
        mayFire = false;
        faceMove = true;
        break;
      }
      case 'hold':
        break;
      case 'advance': {
        const [gx, gz] = goal(tx, tz);
        const m = this.followPath(a, gx, gz);
        mx = m.x;
        mz = m.z;
        // Flankers creep (silently) once they are close.
        if (style === 'flanker' && !a.seesTarget && dTarget < 16) crouch = true;
        break;
      }
      case 'strafe_left':
      case 'strafe_right': {
        const s = name === 'strafe_right' ? 1 : -1;
        mx = rightX(toYaw) * s;
        mz = rightZ(toYaw) * s;
        break;
      }
      case 'retreat':
        mx = -forwardX(toYaw);
        mz = -forwardZ(toYaw);
        speed = SOLDIER.backSpeed;
        break;
      case 'sprint': {
        const [gx, gz] = goal(tx, tz);
        const m = this.followPath(a, gx, gz);
        mx = m.x;
        mz = m.z;
        speed = SOLDIER.sprintSpeed;
        mayFire = false;
        faceMove = true;
        break;
      }
      case 'take_cover': {
        const c = this.coverFor(a);
        if (c && Math.hypot(c.x - a.x, c.z - a.z) > 0.5) {
          const m = this.followPath(a, c.x, c.z);
          mx = m.x;
          mz = m.z;
          speed = SOLDIER.sprintSpeed;
          mayFire = false;
          faceMove = true;
        }
        break;
      }
      case 'reload':
        this.startReload(a);
        mayFire = false;
        break;
    }
    speed *= w.move * a.speedMul;
    if (crouch) speed = Math.min(speed, SOLDIER.walkSpeed * 0.55);
    a.crouching = crouch;
    a.sprinting = !crouch && speed >= SOLDIER.sprintSpeed * 0.85 && (mx !== 0 || mz !== 0);
    this.botJumps(a, mx, mz, speed, name, crouch, dt);
    this.accelerate(a, mx * speed, mz * speed, dt);

    // Knife: swing when in reach.
    if (knife) {
      if (t && Math.hypot(t.x - a.x, t.z - a.z) < 2) {
        a.yaw = toYaw;
        this.melee(a);
      } else if (faceMove && (mx || mz)) a.yaw = Math.atan2(mx, mz);
      return;
    }

    // Grenade at a target that is known but hiding.
    const nadeRate = style === 'tactician' ? 0.012 : style === 'rusher' ? 0.006 : style === 'sniper' ? 0.002 : 0.004;
    if (t && a.grenades > 0 && !a.seesTarget && this.knowsTarget(a) && this.rng.next() < nadeRate) {
      const d = Math.hypot(tx - a.x, tz - a.z);
      if (d > 8 && d < 26) {
        // Flat-ground ballistic speed for a 35 degree throw.
        const th = 0.61;
        const v = Math.sqrt((d * this.gravity) / Math.sin(2 * th));
        this.throwGrenade(a, toYaw, th, Math.min(22, v * 0.92));
      }
    }

    // Aim.
    let wantYaw = toYaw;
    let wantPitch = 0;
    if (faceMove && (mx || mz)) {
      wantYaw = Math.atan2(mx, mz);
    } else if (t) {
      const aimY = a.seesTarget ? t.y + 1.25 * crouchScale(t) : 1.55;
      wantPitch = Math.atan2(aimY - (a.y + eyeHeight(a)), Math.max(0.5, Math.hypot(tx - a.x, tz - a.z)));
    }
    const maxTurn = BOT_AIM.turnRate * dt;
    a.yaw = wrapAngle(a.yaw + clamp(wrapAngle(wantYaw - a.yaw), -maxTurn, maxTurn));
    a.pitch += clamp(wantPitch - a.pitch, -maxTurn, maxTurn);
    a.aiming = mayFire && a.seesTarget;

    if (a.seesTarget) a.trackT += dt;
    a.aimErrT -= dt;
    if (a.aimErrT <= 0) {
      a.aimErrT = 0.25;
      const settle = Math.exp(-a.trackT / BOT_AIM.settleTime);
      const moving = Math.hypot(a.vx, a.vz) > 0.6 ? 1.6 : 1;
      const mag = (BOT_AIM.floor + (BOT_AIM.initial - BOT_AIM.floor) * settle) * a.skill * moving;
      a.aimErrYaw = this.rng.gauss() * mag;
      a.aimErrPitch = this.rng.gauss() * mag * 0.6;
    }

    if (!t || !a.seesTarget || !mayFire) return;
    // Snipers take longer to line up a shot.
    const aimTime = SOLDIER.reactionTime * a.skill + (w.scope ? 0.45 : 0);
    if (a.trackT < aimTime) return;
    if (Math.abs(wrapAngle(wantYaw - a.yaw)) > BOT_AIM.fireCone) return;
    // Bursts: a few rounds, then a short pause to re-aim.
    if (a.burstPauseT > 0) {
      a.burstPauseT -= dt;
      return;
    }
    if (a.burstLeft <= 0) a.burstLeft = w.auto ? 3 + this.rng.int(5) : 1;
    const moving = Math.hypot(a.vx, a.vz) > 0.6;
    const spread = moving ? w.spreadMoving : w.spreadStill * w.adsSpread;
    if (this.tryFire(a, a.yaw + a.aimErrYaw, a.pitch + a.aimErrPitch, spread)) {
      a.burstLeft--;
      if (a.burstLeft <= 0) a.burstPauseT = w.auto ? 0.15 + this.rng.next() * 0.3 : this.rng.next() * 0.15;
    }
  }
}

/** Crouching and sliding soldiers are about 70% as tall. */
export const crouchScale = (b: { crouching: boolean; slideT: number }): number => (b.crouching || b.slideT > 0 ? 0.7 : 1);

/** Ray against an agent's head sphere and torso/leg cylinders. */
export const rayHitAgent = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: Agent,
  headScale = 1
): { t: number; region: HitRegion } | null => {
  const k = crouchScale(b);
  let best = Infinity;
  let region: HitRegion = 'torso';
  // Head sphere.
  {
    const cx = b.x - ox;
    const cy = b.y + (HITBOX.headY + HITBOX.headR * (headScale - 1) * 0.6) * k - oy;
    const cz = b.z - oz;
    const tc = cx * dx + cy * dy + cz * dz;
    if (tc > 0) {
      const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
      const r2 = (HITBOX.headR * headScale) ** 2;
      if (d2 < r2) {
        const t = tc - Math.sqrt(r2 - d2);
        if (t < best) {
          best = t;
          region = 'head';
        }
      }
    }
  }
  const cyl = (r: number, y0: number, y1: number, reg: HitRegion) => {
    const qa = dx * dx + dz * dz;
    if (qa < 1e-9) return;
    const fx = ox - b.x;
    const fz = oz - b.z;
    const qb = 2 * (fx * dx + fz * dz);
    const qc = fx * fx + fz * fz - r * r;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return;
    const s = Math.sqrt(disc);
    for (const t of [(-qb - s) / (2 * qa), (-qb + s) / (2 * qa)]) {
      if (t < 0 || t >= best) continue;
      const y = oy + dy * t;
      if (y >= b.y + y0 && y <= b.y + y1) {
        best = t;
        region = reg;
        return;
      }
    }
  };
  cyl(HITBOX.torsoR, HITBOX.torsoMinY * k, HITBOX.torsoMaxY * k, 'torso');
  cyl(HITBOX.legsR, 0, HITBOX.torsoMinY * k, 'legs');
  return best < Infinity ? { t: best, region } : null;
};
