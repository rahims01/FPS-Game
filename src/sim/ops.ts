import { setLoadout, weaponOf, type Agent } from './Agent';
import type { FpsSim, PlayerInput } from './FpsSim';
import type { WeaponId } from './weapons';
import type { Point } from './Arena';

/**
 * Campaign operations: solo missions with a real objective instead of a score.
 *
 * - assassinate: take out a named target among bodyguards; once the alarm goes up the target
 *   runs for it, so you have a short time to finish the job.
 * - rescue: reach a hostage, free them, and bring them back to extraction alive.
 * - intel: grab every intel case, then get out.
 * - sabotage: plant charges at each site, then reach extraction before they blow.
 * - defend: hold the position until help arrives.
 * - escape: you start behind enemy lines; reach extraction on the far side.
 *
 * With `stealth`, guards stand watch and don't fight until they spot you (a meter fills while
 * they can see you; crouching halves it), hear an unsuppressed shot, get hurt, or see a body.
 */
export type OpKind = 'assassinate' | 'rescue' | 'intel' | 'sabotage' | 'defend' | 'escape';

export interface OpSpec {
  kind: OpKind;
  /** The mission's name, for the scorebug. */
  title?: string;
  /** Map half-width (metres). */
  size?: number;
  /** Enemies guarding the objective(s). */
  guards: number;
  /** Enemies on watch elsewhere on the map. */
  patrols: number;
  /** Guards stand watch until the alarm. */
  stealth: boolean;
  /** Enemies who arrive after the alarm (or over time in defend / escape). */
  reinforce?: number;
  /** The target (assassinate) or hostage (rescue). */
  targetName?: string;
  /** The target takes this share of damage (bosses are tougher). */
  targetArmor?: number;
  /** Assassinate: seconds from the alarm until the target escapes. */
  escapeAfter?: number;
  /** Intel cases or charge sites. */
  items?: number;
  /** Defend: seconds to hold. */
  hold?: number;
  /** Sabotage: seconds from the last charge to the blast. */
  fuse?: number;
  /** Lives for the attempt (default 3). */
  lives?: number;
  /** A fixed loadout for the mission (otherwise your own). */
  loadout?: [WeaponId, WeaponId];
}

export interface OpReport {
  /** Never seen or heard. */
  undetected: boolean;
  /** Guards and patrols taken down. */
  guardsDown: number;
  /** Hostage health at the end (rescue). */
  hostageHp: number;
}

interface Host {
  sim: FpsSim;
  player: Agent;
  announce: (text: string, seconds?: number) => void;
  end: (win: boolean, text: string) => void;
}

const DT = 0.1;
const NO: PlayerInput = { forward: 0, right: 0, yaw: 0, pitch: 0, fire: false, aim: false, reload: false, jump: false, sprint: false, crouch: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };

interface Site {
  x: number;
  z: number;
  done: boolean;
  /** Seconds spent planting / freeing here. */
  t: number;
}

export class Operation {
  readonly spec: OpSpec;
  phase: 'objective' | 'extract' | 'done' = 'objective';
  alarm = false;
  /** 0..1: how close the guards are to spotting you. */
  suspicion = 0;
  /** Names for the HUD (target, hostage, guards). */
  readonly names: Record<number, string> = {};
  private enemies: Agent[] = [];
  private target: Agent | null = null;
  private hostage: Agent | null = null;
  private freed = false;
  private sites: Site[] = [];
  private start: Point;
  private extract: Point;
  private escapeAt = Infinity;
  private blastAt = Infinity;
  private held = 0;
  private toReinforce = 0;
  private nextReinforce = 0;
  private respawnAt = -1;
  private hostageStuck = 0;
  private hostageLast = { x: 0, z: 0 };
  private undetected = true;
  private guardsDown = 0;
  private reason = '';

  constructor(
    private host: Host,
    spec: OpSpec
  ) {
    this.spec = spec;
    const sim = host.sim;
    const spawns = sim.arena.spawns.slice();
    // You start at one end; the objective is as far away as the map allows.
    this.start = sim.arena.teamSpawns[0][0];
    const far = (p: Point) => Math.hypot(p.x - this.start.x, p.z - this.start.z);
    spawns.sort((a, b) => far(b) - far(a));
    const goal = spawns[0];
    this.extract = spec.kind === 'escape' ? goal : this.start;
    if (spec.kind === 'escape') {
      // Behind enemy lines: start at the far end, and the enemy is everywhere.
      this.start = sim.arena.teamSpawns[1][0];
      this.extract = sim.arena.teamSpawns[0][0];
      host.player.x = this.start.x;
      host.player.z = this.start.z;
    } else {
      host.player.x = this.start.x;
      host.player.z = this.start.z;
    }
    const rand = () => sim.rng.next();
    const near = (c: Point, r: number) => sim.arena.randomFreePoint(rand, c.x, c.z, r) ?? c;
    const enemy = (p: Point, name: string) => {
      const a = sim.spawn(1, 'heuristic', p.x, p.z, rand() * Math.PI * 2);
      a.style = 'soldier';
      this.names[a.id] = name;
      this.enemies.push(a);
      return a;
    };

    // The objective's position(s).
    const mid = spawns[Math.floor(spawns.length / 2)] ?? goal;
    switch (spec.kind) {
      case 'assassinate': {
        const t = enemy(goal, spec.targetName ?? 'The Target');
        t.armor = spec.targetArmor ?? 1;
        this.target = t;
        break;
      }
      case 'rescue': {
        const h = sim.spawn(0, 'remote', goal.x, goal.z, 0);
        setLoadout(h, ['pistol']);
        h.grenades = 0;
        h.armor = 0.6;
        this.names[h.id] = spec.targetName ?? 'The Hostage';
        this.hostage = h;
        this.sites.push({ x: goal.x, z: goal.z, done: false, t: 0 });
        break;
      }
      case 'intel':
      case 'sabotage': {
        // Spread across the far two-thirds of the map.
        const pool = spawns.slice(0, Math.max(spec.items ?? 3, Math.ceil(spawns.length * 0.66)));
        const step = pool.length / (spec.items ?? 3);
        for (let i = 0; i < (spec.items ?? 3); i++) {
          const p = pool[Math.floor(i * step)];
          this.sites.push({ x: p.x, z: p.z, done: false, t: 0 });
        }
        break;
      }
      case 'defend':
        this.extract = mid;
        host.player.x = mid.x;
        host.player.z = mid.z;
        break;
      case 'escape':
        break;
    }

    // Guards around the objective(s), patrols elsewhere.
    // Escape: posted along the way out instead.
    const posts: Point[] = this.sites.length ? this.sites : spec.kind === 'escape' ? spawns.slice(Math.floor(spawns.length * 0.2), Math.max(1, Math.floor(spawns.length * 0.8))) : [goal];
    let n = 0;
    for (let i = 0; i < spec.guards; i++) enemy(near(posts[i % posts.length], 7), `Guard ${++n}`);
    const others = spawns.filter((p) => far(p) > 18);
    for (let i = 0; i < spec.patrols; i++) enemy(near(others[(i * 3 + 1) % Math.max(1, others.length)] ?? goal, 4), `Sentry ${i + 1}`);

    for (const a of this.enemies) {
      setLoadout(a, a === this.target ? ['pistol', 'pistol'] : [(['rifle', 'ak', 'smg', 'burst', 'shotgun'] as WeaponId[])[sim.rng.int(5)], 'pistol']);
      a.passive = spec.stealth;
    }
    if (spec.loadout) setLoadout(host.player, spec.loadout);
    this.toReinforce = spec.reinforce ?? 0;
    if (!spec.stealth) this.raise(false);
    this.markers();
  }

  get report(): OpReport {
    return { undetected: this.undetected, guardsDown: this.guardsDown, hostageHp: this.hostage?.alive ? Math.round(this.hostage.hp) : 0 };
  }

  /** The objective line under the scorebug. */
  status(): string {
    const sim = this.host.sim;
    const sec = (t: number) => `${Math.max(0, Math.ceil(t - sim.time))} s`;
    const lives = `Lives ${Math.max(0, (this.spec.lives ?? 3) - this.host.player.deaths)}`;
    const stealth = this.spec.stealth && !this.alarm ? (this.suspicion > 0.05 ? `Being spotted ${Math.round(this.suspicion * 100)}%` : 'Undetected') : this.alarm && this.spec.stealth ? 'ALARM' : '';
    let goal = '';
    if (this.phase === 'extract') goal = this.blastAt < Infinity ? `Get to extraction · blast in ${sec(this.blastAt)}` : this.hostage ? `Bring ${this.names[this.hostage.id]} to extraction` : 'Get to extraction';
    else
      switch (this.spec.kind) {
        case 'assassinate':
          goal = `Eliminate ${this.names[this.target!.id]}${this.escapeAt < Infinity ? ` · escapes in ${sec(this.escapeAt)}` : ''}`;
          break;
        case 'rescue':
          goal = `Free ${this.names[this.hostage!.id]}${this.sites[0].t > 0 ? ` · ${Math.round((this.sites[0].t / 1.5) * 100)}%` : ''}`;
          break;
        case 'intel':
          goal = `Intel ${this.sites.filter((s) => s.done).length}/${this.sites.length}`;
          break;
        case 'sabotage': {
          const at = this.sites.find((s) => !s.done && s.t > 0);
          goal = `Charges ${this.sites.filter((s) => s.done).length}/${this.sites.length}${at ? ` · planting ${Math.round((at.t / 3) * 100)}%` : ''}`;
          break;
        }
        case 'defend':
          goal = `Hold the position · ${Math.max(0, Math.ceil((this.spec.hold ?? 90) - this.held))} s`;
          break;
        case 'escape':
          goal = 'Reach extraction';
          break;
      }
    return [goal, stealth, lives].filter(Boolean).join(' · ');
  }

  /** Called when anyone dies. */
  onKill(v: Agent, killer: Agent | null): void {
    if (this.enemies.includes(v) && killer === this.host.player) this.guardsDown++;
    if (v === this.hostage) {
      this.fail(`${this.names[v.id]} didn't make it`);
      return;
    }
    // A guard down where another can see it raises the alarm.
    if (!this.alarm && this.enemies.includes(v)) {
      const sim = this.host.sim;
      for (const g of this.enemies) {
        if (g === v || !g.alive) continue;
        if (Math.hypot(g.x - v.x, g.z - v.z) < 16 && sim.arena.lineOfSight(g.x, g.y + 1.5, g.z, v.x, v.y + 0.6, v.z)) {
          this.raise(true, 'A guard found the body!');
          break;
        }
      }
    }
  }

  tick(): void {
    if (this.phase === 'done') return;
    const sim = this.host.sim;
    const p = this.host.player;
    // Lives: back at the start (or the position, in defend) after a few seconds.
    if (!p.alive) {
      if (p.deaths >= (this.spec.lives ?? 3)) return this.fail('Out of lives');
      if (this.respawnAt < 0) this.respawnAt = sim.time + 3;
      else if (sim.time >= this.respawnAt) {
        this.respawnAt = -1;
        const at = this.spec.kind === 'defend' ? this.extract : this.start;
        sim.respawn(p, at.x, at.z, 0);
        p.protectedUntil = sim.time + 3;
      }
      return;
    }
    if (this.spec.stealth && !this.alarm) this.watch();
    this.reinforce();
    if (this.hostage) this.driveHostage();

    if (this.phase === 'objective') {
      switch (this.spec.kind) {
        case 'assassinate': {
          const t = this.target!;
          if (!t.alive) this.next('Target down. Get to extraction!');
          else if (sim.time >= this.escapeAt) this.fail(`${this.names[t.id]} escaped`);
          break;
        }
        case 'rescue': {
          const s = this.sites[0];
          if (this.dist(p, this.hostage!) < 2.6) s.t += DT;
          else s.t = Math.max(0, s.t - DT * 0.5);
          if (s.t >= 1.5) {
            s.done = true;
            this.freed = true;
            this.raise(false, `${this.names[this.hostage!.id]} is free. Get them out!`);
            this.next(null);
          }
          break;
        }
        case 'intel':
          for (const s of this.sites) if (!s.done && this.dist(p, s) < 2.2) {
            s.done = true;
            this.host.announce(`Intel ${this.sites.filter((x) => x.done).length}/${this.sites.length}`);
          }
          if (this.sites.every((s) => s.done)) this.next('All the intel. Get to extraction!');
          break;
        case 'sabotage':
          for (const s of this.sites) {
            if (s.done) continue;
            if (this.dist(p, s) < 2.6 && !p.sprinting) s.t += DT;
            else s.t = Math.max(0, s.t - DT);
            if (s.t >= 3) {
              s.done = true;
              this.host.announce('Charge set');
            }
          }
          if (this.sites.every((s) => s.done)) {
            this.blastAt = sim.time + (this.spec.fuse ?? 60);
            this.raise(true, 'Charges set. Get out before they blow!');
            this.next(null);
          }
          break;
        case 'defend':
          if (this.dist(p, this.extract) < 9) this.held += DT;
          if (this.held >= (this.spec.hold ?? 90)) this.win('The position held. Help has arrived');
          break;
        case 'escape':
          if (this.dist(p, this.extract) < 4) this.win('You made it out');
          break;
      }
    } else if (this.phase === 'extract') {
      if (sim.time >= this.blastAt) return this.fail('The charges blew with you still inside');
      const hostageIn = !this.hostage || this.dist(this.hostage, this.extract) < 7;
      if (this.dist(p, this.extract) < 4 && hostageIn) this.win('Mission complete');
    }
    this.markers();
  }

  // ---------------------------------------------------------------- stealth

  /** Guards on watch: seeing you fills the meter; shots, hits and bodies set off the alarm at once. */
  private watch(): void {
    const sim = this.host.sim;
    const p = this.host.player;
    const w = weaponOf(p);
    const shot = sim.time - p.lastShotT < 0.15 && w.slot !== 'melee';
    let seen = 0;
    for (const g of this.enemies) {
      if (!g.alive) continue;
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (g.hp < 100 || sim.time - g.lastHitT < 0.5) return this.raise(true, 'You were spotted!');
      if (shot && d < (w.suppressed ? 9 : 40)) return this.raise(true, 'They heard that!');
      if (d < 28 && sim.canSee(g, p)) seen = Math.max(seen, (1 - d / 28) * 2.4 + 0.25);
    }
    if (seen > 0) this.suspicion += seen * DT * (p.crouching ? 0.5 : 1) * (p.sprinting ? 1.4 : 1);
    else this.suspicion = Math.max(0, this.suspicion - 0.2 * DT);
    if (this.suspicion >= 1) this.raise(true, 'You were spotted!');
  }

  private raise(loud: boolean, text?: string): void {
    if (this.alarm) {
      if (text) this.host.announce(text);
      return;
    }
    this.alarm = true;
    if (loud) this.undetected = false;
    this.suspicion = 1;
    for (const g of this.enemies) g.passive = false;
    if (this.target && this.spec.escapeAfter) this.escapeAt = this.host.sim.time + this.spec.escapeAfter;
    this.nextReinforce = this.host.sim.time + 5;
    if (text) this.host.announce(this.target && this.spec.escapeAfter ? `${text} The target is running!` : text);
  }

  /** Reinforcements walk in from the far side, one every few seconds. */
  private reinforce(): void {
    const sim = this.host.sim;
    if (!this.alarm || this.toReinforce <= 0 || sim.time < this.nextReinforce) return;
    const p = this.host.player;
    const spots = sim.arena.spawns.filter((s) => Math.hypot(s.x - p.x, s.z - p.z) > 22);
    const at = spots[sim.rng.int(Math.max(1, spots.length))] ?? sim.arena.spawns[0];
    const a = sim.spawn(1, 'heuristic', at.x, at.z, 0);
    a.style = 'soldier';
    setLoadout(a, [(['rifle', 'ak', 'smg', 'burst'] as WeaponId[])[sim.rng.int(4)], 'pistol']);
    a.grenades = 1;
    this.names[a.id] = 'Reinforcement';
    this.enemies.push(a);
    this.toReinforce--;
    this.nextReinforce = sim.time + 4;
  }

  // ---------------------------------------------------------------- the hostage

  /** Freed, the hostage keeps close behind you (walking, or running to catch up). */
  private driveHostage(): void {
    const sim = this.host.sim;
    const h = this.hostage!;
    if (!h.alive) return;
    const p = this.host.player;
    if (!this.freed) {
      sim.remoteInputs.set(h.id, { ...NO, crouch: true, yaw: h.yaw });
      return;
    }
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    const yaw = Math.atan2(p.x - h.x, p.z - h.z);
    sim.remoteInputs.set(h.id, { ...NO, yaw, forward: d > 2.8 ? 1 : 0, sprint: d > 7 });
    // Stuck on a wall for a while, out of reach: catch up behind you.
    const moved = Math.hypot(h.x - this.hostageLast.x, h.z - this.hostageLast.z);
    this.hostageLast = { x: h.x, z: h.z };
    this.hostageStuck = d > 5 && moved < 0.05 ? this.hostageStuck + DT : 0;
    if (this.hostageStuck > 3 && p.alive) {
      h.x = p.x - Math.sin(p.yaw) * 1.5;
      h.z = p.z - Math.cos(p.yaw) * 1.5;
      this.hostageStuck = 0;
    }
  }

  // ---------------------------------------------------------------- endings and markers

  private next(text: string | null): void {
    this.phase = 'extract';
    if (text) this.host.announce(text);
  }

  private win(text: string): void {
    this.phase = 'done';
    this.host.end(true, text);
  }

  private fail(text: string): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.reason = text;
    this.host.end(false, `Mission failed: ${text}`);
  }

  get failure(): string {
    return this.reason;
  }

  private dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  /** World and minimap markers for what to do next. */
  private markers(): void {
    const o = this.host.sim.objectives;
    o.length = 0;
    if (this.phase === 'extract' || this.spec.kind === 'escape') o.push({ label: 'EXIT', x: this.extract.x, z: this.extract.z, r: 4, owner: -1, progress: 0 });
    if (this.phase !== 'objective') return;
    switch (this.spec.kind) {
      case 'assassinate': {
        const t = this.target!;
        if (t.alive) o.push({ label: 'TARGET', x: t.x, z: t.z, r: 1, owner: -1, progress: 0, carried: true });
        break;
      }
      case 'rescue': {
        const h = this.hostage!;
        o.push({ label: 'SAVE', x: h.x, z: h.z, r: 2.6, owner: -1, progress: this.sites[0].t / 1.5, carried: true });
        break;
      }
      case 'intel':
        for (const s of this.sites) if (!s.done) o.push({ label: 'INTEL', x: s.x, z: s.z, r: 2.2, owner: -1, progress: 0 });
        break;
      case 'sabotage':
        for (const s of this.sites) if (!s.done) o.push({ label: 'PLANT', x: s.x, z: s.z, r: 2.6, owner: -1, progress: s.t / 3 });
        break;
      case 'defend':
        o.push({ label: 'HOLD', x: this.extract.x, z: this.extract.z, r: 9, owner: -1, progress: this.held / (this.spec.hold ?? 90) });
        break;
    }
  }
}
