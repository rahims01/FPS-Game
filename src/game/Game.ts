import * as THREE from 'three';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ArenaView } from '../render/ArenaView';
import { Effects, flashTexture } from '../render/Effects';
import { SoldierView } from '../render/SoldierView';
import { Viewmodel } from '../render/Viewmodel';
import { eyeHeight, weaponOf, type Agent, type DeathCause } from '../sim/Agent';
import { grenadeMesh, weaponModels } from '../assets/weaponModels';
import { WEAPONS, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_TIER, type WeaponId } from '../sim/weapons';
import { MEDALS, loadProfile, saveProfile, type Medal } from './progression';
import { SIM } from '../sim/config';
import type { Brain, PlayerInput, SimEvent } from '../sim/FpsSim';
import { heuristicBrain } from '../sim/heuristicBrain';
import { Match, TARGETS, type MatchOptions, type ModeId } from '../sim/Match';
import { assignIdentities, cssColor, lateJoinerColor, randomUsername, type Identities } from './identity';
import { wrapAngle, yawTo } from '../sim/math';
import { GameAudio } from './Audio';

export interface GameSettings {
  sensitivity: number;
  fov: number;
  volume: number;
  playerName: string;
  /** Your colour in free-for-all modes (team modes use team colours). */
  playerColor: number;
  /** Your primary weapon. */
  primary: WeaponId;
}

export interface ScoreRow {
  id: number;
  name: string;
  color: string;
  kills: number;
  deaths: number;
  alive: boolean;
  isPlayer: boolean;
  ally: boolean;
}

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  headshot: boolean;
  weapon: string;
  killerColor: string;
  victimColor: string;
  killerIsPlayer: boolean;
  victimIsPlayer: boolean;
  at: number;
}

export interface HudState {
  mode: ModeId;
  modeName: string;
  hp: number;
  ammo: number;
  magazine: number;
  reloading: number;
  alive: boolean;
  aiming: boolean;
  spread: number;
  banner: string;
  phase: Match['phase'];
  result: Match['result'];
  scores: [number, number];
  teamCounts: [number, number];
  showTeams: boolean;
  /** Team colours as CSS (yours first), for team modes. */
  teamColors: [string, string] | null;
  /** Everyone, sorted by kills. */
  players: ScoreRow[];
  showScoreboard: boolean;
  hill: { holder: 'us' | 'them' | 'contested' | 'none'; seconds: number; onHill: boolean } | null;
  targetScore: number;
  wave: number;
  enemiesLeft: number;
  kills: number;
  deaths: number;
  topKills: number;
  zone: { shrinking: boolean; seconds: number; phase: number } | null;
  outsideZone: boolean;
  aliveTotal: number;
  placement: number;
  canRespawn: boolean;
  feed: KillFeedEntry[];
  hitMarkerAt: number;
  hitMarkerKind: 'hit' | 'head' | 'kill';
  damage: { angle: number; at: number }[];
  pickupAt: number;
  time: number;
  paused: boolean;
  weaponName: string;
  weaponId: WeaponId;
  /** Weapons in the loadout, with the slot in hand. */
  loadout: { id: WeaponId; name: string; active: boolean }[];
  grenades: number;
  scoped: boolean;
  crouching: boolean;
  protected: boolean;
  streak: number;
  nextStreak: { name: string; kills: number } | null;
  uav: boolean;
  juggernaut: boolean;
  flags: { label: string; owner: 'us' | 'them' | 'none'; progress: number; onIt: boolean }[];
  infectedSeconds: number | null;
  gunTier: { index: number; total: number; weapon: string; next: string; kills: number; perTier: number } | null;
  medals: { id: number; name: string; xp: number; big: boolean; at: number }[];
  callouts: { id: number; text: string; at: number }[];
  xp: number;
  killedBy: { name: string; color: string; weapon: string; distance: number; hp: number; headshot: boolean } | null;
  ctf: { ours: 'home' | 'taken' | 'dropped'; theirs: 'home' | 'taken' | 'dropped'; carrying: boolean } | null;
}

/** Shown to the player as they approach each killstreak. */
const STREAK_LADDER = [
  { kills: 3, name: 'UAV' },
  { kills: 5, name: 'Airstrike' },
  { kills: 8, name: 'Juggernaut' }
];

const causeName = (c: DeathCause): string =>
  c === 'grenade' ? 'Frag Grenade' : c === 'airstrike' ? 'Airstrike' : c === 'zone' ? 'The Zone' : WEAPONS[c as WeaponId]?.name ?? c;
const causeTag = (c: DeathCause): string => (c === 'grenade' ? 'FRAG' : c === 'airstrike' ? 'AIRSTRIKE' : c === 'zone' ? 'ZONE' : WEAPONS[c as WeaponId]?.tag ?? '');

const MAX_RAGDOLLS = 14;
const CORPSE_SECONDS = 25;

/**
 * Owns one match: the simulation, the three.js scene and the input. React
 * mounts it on a container and polls hud() for the overlay.
 */
export class Game {
  readonly match: Match;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private viewmodel: Viewmodel;
  private arenaView: ArenaView;
  private effects = new Effects();
  private physics: PhysicsWorld;
  private views = new Map<number, SoldierView>();
  private prev = new Map<number, { x: number; y: number; z: number }>();
  private audio: GameAudio;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private disposed = false;
  private ids: Identities;

  // Input.
  private keys = new Set<string>();
  private mouse = { left: false, right: false };
  private yaw = 0;
  private pitch = 0;
  private lookDX = 0;
  private lookDY = 0;
  private jumpQueued = false;
  private reloadQueued = false;
  private meleeQueued = false;
  private grenadeQueued = false;
  private switchQueued = -1;
  private locked = false;
  paused = true;

  // HUD.
  private feed: KillFeedEntry[] = [];
  private feedId = 0;
  private hitMarkerAt = -10;
  private hitMarkerKind: HudState['hitMarkerKind'] = 'hit';
  private damageMarks: { angle: number; at: number }[] = [];
  private pickupAt = -10;
  private deathCamT = 0;
  private camEye = 1.62;
  private shake = 0;
  private grenadeGroup = new THREE.Group();
  private grenadeMeshes: THREE.Mesh[] = [];
  private stride = new Map<number, number>();
  // Progression.
  private medals: HudState['medals'] = [];
  private callouts: HudState['callouts'] = [];
  private medalId = 0;
  private xp = 0;
  private xpBanked = false;
  private killTimes: number[] = [];
  private firstBlood = false;
  private lastKillerOfPlayer = -1;
  private deathsSinceKill = 0;
  private killedBy: HudState['killedBy'] = null;
  private lastWeapon: WeaponId | null = null;

  constructor(
    private container: HTMLElement,
    private assets: LoadedAssets,
    opts: MatchOptions,
    learned: Brain | null,
    private settings: GameSettings,
    audio: GameAudio
  ) {
    this.audio = audio;
    const control = opts.botControl === 'learned' && learned ? 'learned' : 'heuristic';
    this.match = new Match({ ...opts, botControl: control });
    const sim = this.match.sim;
    sim.brains.heuristic = heuristicBrain;
    if (learned) {
      // A learned bot without a target (or a policy that errors) falls back to the baseline.
      sim.brains.learned = (a, s) => {
        const act = learned(a, s);
        return act >= 0 ? act : heuristicBrain(a, s);
      };
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x9cc3e6);
    this.scene.fog = new THREE.Fog(0x9cc3e6, 40, sim.arena.half * 3.2);
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.arenaView = new ArenaView(sim);
    this.scene.add(this.arenaView.group, this.effects.group);
    this.physics = new PhysicsWorld(sim.arena);
    this.viewmodel = new Viewmodel(weaponModels(assets.rifle), flashTexture());
    this.scene.add(this.grenadeGroup);

    const p = this.match.player;
    this.yaw = p.yaw;
    this.ids = assignIdentities(this.match, settings.playerName || 'Player', settings.playerColor);
    if (this.ids.teamColors) this.arenaView.teamColors = this.ids.teamColors;

    this.onResize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel);
    window.addEventListener('contextmenu', this.onContext);
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('blur', this.onBlur);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------- input

  requestLock(): void {
    this.audio.unlock();
    void this.renderer.domElement.requestPointerLock?.();
  }

  releaseLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement;
    this.paused = !this.locked;
    if (!this.locked) {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    }
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouse.left = this.mouse.right = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.locked) return;
    this.keys.add(e.code);
    if (e.code === 'Space') {
      this.jumpQueued = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
    }
    if (e.code === 'KeyR') this.reloadQueued = true;
    if (e.code === 'KeyV') this.meleeQueued = true;
    if (e.code === 'KeyG') this.grenadeQueued = true;
    if (e.code === 'Digit1') this.switchQueued = 0;
    if (e.code === 'Digit2') this.switchQueued = 1;
    if (e.code === 'KeyQ') this.switchQueued = this.match.player.slot === 0 ? 1 : 0;
    if (e.code === 'Tab') e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    const k = 0.0022 * this.settings.sensitivity * (1 - this.viewmodel.adsAmount * 0.35);
    this.yaw -= e.movementX * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * k, -1.45, 1.45);
    this.lookDX += e.movementX;
    this.lookDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) return;
    if (e.button === 0) {
      this.mouse.left = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
      const p = this.match.player;
      if (p.alive && p.ammo === 0 && p.reloadT <= 0) this.audio.dryFire();
    }
    if (e.button === 2) this.mouse.right = true;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.locked) return;
    const p = this.match.player;
    if (p.weapons.length > 1) this.switchQueued = (p.slot + (e.deltaY > 0 ? 1 : p.weapons.length - 1)) % p.weapons.length;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = false;
    if (e.button === 2) this.mouse.right = false;
  };

  private onContext = (e: MouseEvent) => e.preventDefault();

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewmodel.setAspect(w / h, 60);
  };

  applySettings(s: GameSettings): void {
    this.settings = s;
    this.audio.setVolume(s.volume);
  }

  private input(): PlayerInput {
    const k = this.keys;
    const inp: PlayerInput = {
      forward: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0),
      right: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0),
      yaw: this.yaw,
      pitch: this.pitch,
      fire: this.mouse.left,
      aim: this.mouse.right,
      reload: this.reloadQueued,
      jump: this.jumpQueued,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('KeyC') || k.has('ControlLeft'),
      melee: this.meleeQueued,
      grenade: this.grenadeQueued,
      switchSlot: this.switchQueued
    };
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.meleeQueued = false;
    this.grenadeQueued = false;
    this.switchQueued = -1;
    return inp;
  }

  // ---------------------------------------------------------------- loop

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const sim = this.match.sim;
    const player = this.match.player;

    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= SIM.dt) {
        for (const a of sim.agents) this.prev.set(a.id, { x: a.x, y: a.y, z: a.z });
        const ammoBefore = player.ammo;
        const reloadBefore = player.reloadT;
        this.match.step(this.input());
        if (player.ammo < ammoBefore) this.viewmodel.fire();
        if (player.reloadT > 0 && reloadBefore <= 0) this.audio.reload();
        this.drainNotices();
        this.handleEvents(sim.drainEvents());
        this.acc -= SIM.dt;
      }
      this.physics.step(dt);
    }
    const alpha = this.paused ? 1 : this.acc / SIM.dt;
    this.renderFrame(this.paused ? 0 : dt, alpha);
  };

  /** Allies' tags always show; an enemy's only while you can see them within 45 m. */
  private tagVisible(a: Agent): boolean {
    const me = this.match.player;
    if (a.team === me.team) return true;
    const c = this.camera.position;
    const tx = a.x;
    const ty = a.y + 1.7;
    const tz = a.z;
    const d = Math.hypot(tx - c.x, ty - c.y, tz - c.z);
    if (d > 45) return false;
    return this.match.sim.arena.lineOfSight(c.x, c.y, c.z, tx, ty, tz);
  }

  /** Players who joined after the start (survival waves) get a name and colour on first sight. */
  private ensureIdentity(id: number): void {
    const a = this.match.sim.agents[id];
    while (this.ids.names.length <= id) {
      this.ids.names.push(randomUsername());
      this.ids.colors.push(lateJoinerColor(this.ids, a ? a.team : 1));
    }
  }

  private nameOf(id: number): string {
    this.ensureIdentity(id);
    return this.ids.names[id];
  }

  private colorOf(id: number): number {
    this.ensureIdentity(id);
    const a = this.match.sim.agents[id];
    // Team colours follow the team (infected players change colour when they turn).
    if (this.ids.teamColors && a) return this.ids.teamColors[a.team === 0 ? 0 : 1];
    return this.ids.colors[id];
  }

  private viewFor(a: Agent): SoldierView {
    let v = this.views.get(a.id);
    if (v && v.life !== a.life) {
      v.dispose();
      v = undefined;
    }
    if (!v) {
      v = new SoldierView(this.assets, a, this.colorOf(a.id));
      if (a !== this.match.player) v.setNameTag(this.nameOf(a.id), cssColor(this.colorOf(a.id)), a.team === this.match.player.team);
      this.scene.add(v.root);
      this.views.set(a.id, v);
      this.prev.set(a.id, { x: a.x, y: a.y, z: a.z });
    }
    return v;
  }

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpN = new THREE.Vector3();

  private handleEvents(events: SimEvent[]): void {
    const sim = this.match.sim;
    const player = this.match.player;
    for (const e of events) {
      if (e.type === 'shot') {
        const shooter = sim.agents[e.shooter];
        const end = this.tmpB.set(e.ex, e.ey, e.ez);
        let from: THREE.Vector3;
        if (shooter === player) {
          from = this.camera.localToWorld(this.viewmodel.muzzleLocal(this.tmpA));
          if (e.first) this.audio.gunshot(0, 0, true, e.weapon);
        } else {
          const v = this.views.get(shooter.id);
          from = v ? v.muzzle(this.tmpA) : this.tmpA.set(e.ox, e.oy, e.oz);
          if (e.first) {
            this.effects.muzzleFlash(from, true);
            this.audio.gunshot(this.distTo(shooter.x, shooter.z), this.panTo(shooter.x, shooter.z), false, e.weapon);
          }
        }
        this.effects.tracer(from, end);
        if (e.world) this.effects.impact(end, this.tmpN.set(e.nx, e.ny, e.nz));
        if (e.hit >= 0 && e.hit !== player.id) {
          const dir = this.tmpN.set(e.ex - e.ox, e.ey - e.oy, e.ez - e.oz).normalize();
          this.effects.blood(end, dir, e.region === 'head');
          const v = this.views.get(e.hit);
          if (v) {
            const victim = sim.agents[e.hit];
            const side = Math.sign(Math.sin(wrapAngle(Math.atan2(dir.x, dir.z) - victim.yaw))) || 1;
            v.hit(side);
          }
        }
      } else if (e.type === 'damage') {
        if (e.attacker === player.id && e.target !== player.id) {
          this.hitMarkerAt = sim.time;
          this.hitMarkerKind = e.killed ? 'kill' : e.region === 'head' ? 'head' : 'hit';
          this.audio.hitMarker(e.region === 'head', e.killed);
        }
        if (e.target === player.id) {
          const attacker = sim.agents[e.attacker];
          if (attacker) this.damageMarks.push({ angle: wrapAngle(yawTo(player.x, player.z, attacker.x, attacker.z) - this.yaw), at: sim.time });
          if (this.damageMarks.length > 6) this.damageMarks.shift();
          this.audio.hurt();
        }
      } else if (e.type === 'death') {
        const victim = sim.agents[e.target];
        const killer = sim.agents[e.attacker];
        this.feed.push({
          id: this.feedId++,
          killer: killer ? this.nameOf(killer.id) : 'The zone',
          victim: this.nameOf(victim.id),
          killerColor: killer ? cssColor(this.colorOf(killer.id)) : '#4fb3ff',
          victimColor: cssColor(this.colorOf(victim.id)),
          headshot: e.region === 'head' && e.cause !== 'grenade' && e.cause !== 'airstrike',
          weapon: causeTag(e.cause),
          killerIsPlayer: killer === player,
          victimIsPlayer: victim === player,
          at: sim.time
        });
        if (this.feed.length > 6) this.feed.shift();
        const v = this.viewFor(victim);
        v.setVisible(true);
        v.die(victim, this.physics, sim.time);
        if (e.attacker >= 0) this.effects.bloodPool(victim.x, victim.z);
        if (victim === player) {
          this.deathCamT = 0;
          this.deathsSinceKill++;
          this.lastKillerOfPlayer = killer ? killer.id : -1;
          this.killedBy = {
            name: killer ? this.nameOf(killer.id) : causeName(e.cause),
            color: killer ? cssColor(this.colorOf(killer.id)) : '#4fb3ff',
            weapon: causeName(e.cause),
            distance: Math.round(e.distance),
            hp: e.attackerHp,
            headshot: e.region === 'head'
          };
        }
        if (killer === player && victim !== player) this.awardKill(e, victim);
        if (killer && !this.firstBlood) this.firstBlood = true;
        this.capRagdolls();
      } else if (e.type === 'explosion') {
        const p = this.tmpA.set(e.x, e.y, e.z);
        this.effects.explosion(p, e.kind === 'airstrike');
        const d = this.distTo(e.x, e.z);
        this.audio.explosion(d, this.panTo(e.x, e.z));
        this.shake = Math.max(this.shake, Math.max(0, 1 - d / 25) * (e.kind === 'airstrike' ? 1 : 0.7));
        // Knock nearby corpses around.
        for (const v of this.views.values()) {
          if (!v.ragdoll) continue;
          const h = v.hips(this.tmpB);
          const dd = h.distanceTo(p);
          if (dd < 8) v.ragdoll.applyImpulseToHips(h.clone().sub(p).setY(2).normalize().multiplyScalar(60 * (1 - dd / 8)));
        }
      } else if (e.type === 'melee') {
        const a = sim.agents[e.agent];
        if (a === player) this.viewmodel.swing();
        if (a === player || this.distTo(a.x, a.z) < 12) this.audio.knife();
      } else if (e.type === 'switch') {
        if (e.agent === player.id) this.audio.weaponSwitch();
      } else if (e.type === 'airstrike') {
        this.audio.whistle();
      } else if (e.type === 'pickup') {
        if (e.agent === player.id) {
          this.pickupAt = sim.time;
          this.audio.pickup();
        }
      }
    }
  }

  private teamCss(team: number): string {
    return this.ids.teamColors ? cssColor(this.ids.teamColors[team === 0 ? 0 : 1]) : team === this.match.player.team ? '#5aff8a' : '#ff5a4a';
  }

  private distTo(x: number, z: number): number {
    return Math.hypot(x - this.camera.position.x, z - this.camera.position.z);
  }

  private panTo(x: number, z: number): number {
    return -Math.sin(wrapAngle(yawTo(this.camera.position.x, this.camera.position.z, x, z) - this.yaw));
  }

  private medal(m: Medal): void {
    const sim = this.match.sim;
    this.xp += m.xp;
    this.medals.push({ id: this.medalId++, name: m.name, xp: m.xp, big: !!m.big, at: sim.time });
    if (this.medals.length > 8) this.medals.shift();
    if (m.big) this.audio.fanfare();
    else this.audio.medal();
  }

  private callout(text: string): void {
    this.callouts.push({ id: this.medalId++, text, at: this.match.sim.time });
    if (this.callouts.length > 3) this.callouts.shift();
  }

  /** Medals for one of the player's kills. */
  private awardKill(e: Extract<SimEvent, { type: 'death' }>, victim: Agent): void {
    const sim = this.match.sim;
    const player = this.match.player;
    this.medal(MEDALS.kill);
    const gun = e.cause !== 'grenade' && e.cause !== 'airstrike' && e.cause !== 'knife' && e.cause !== 'zone';
    if (gun && e.region === 'head') this.medal(MEDALS.headshot);
    if (e.cause === 'knife') this.medal(MEDALS.knife);
    if (e.cause === 'grenade') this.medal(MEDALS.frag);
    if (e.cause === 'airstrike') this.medal(MEDALS.airstrike);
    if (gun && e.distance > 35) this.medal(MEDALS.longshot);
    if (gun && e.distance < 2.5) this.medal(MEDALS.pointBlank);
    if (!this.firstBlood) this.medal(MEDALS.firstBlood);
    if (victim.id === this.lastKillerOfPlayer) {
      this.medal(MEDALS.revenge);
      this.lastKillerOfPlayer = -1;
    }
    if (!player.alive) this.medal(MEDALS.afterlife);
    if (this.deathsSinceKill >= 3) this.medal(MEDALS.comeback);
    if (e.victimStreak >= 3) this.medal(MEDALS.buzzkill);
    this.deathsSinceKill = 0;
    this.killTimes = this.killTimes.filter((t) => sim.time - t < 4);
    this.killTimes.push(sim.time);
    const chain = this.killTimes.length;
    if (chain === 2) this.medal(MEDALS.double);
    else if (chain === 3) this.medal(MEDALS.triple);
    else if (chain >= 4) this.medal(MEDALS.multi);
    if (player.streak === 5) this.medal(MEDALS.spree);
    if (player.streak === 10) this.medal(MEDALS.unstoppable);
    if (player.streak === 15) this.medal(MEDALS.godlike);
  }

  /** Mode notices: killstreaks, captures, dog tags, gun game, infection. Banks XP at the end. */
  private drainNotices(): void {
    const m = this.match;
    while (m.notices.length) {
      const n = m.notices.shift()!;
      if (n.kind === 'streak') {
        this.callout(n.name === 'UAV' ? 'UAV online: enemies shown on your minimap' : n.name === 'Airstrike' ? 'Airstrike inbound!' : 'Juggernaut armour equipped');
        this.audio.fanfare();
      } else if (n.kind === 'capture' && n.byPlayer && n.team === m.player.team) this.medal(MEDALS.captured);
      else if (n.kind === 'tag' && n.byPlayer) this.medal(n.confirmed ? MEDALS.confirmed : MEDALS.denied);
      else if (n.kind === 'infected') {
        if (n.byPlayer) this.medal(MEDALS.infect);
        if (n.player) this.callout('You have been infected! Knife the survivors.');
      } else if (n.kind === 'promote') {
        this.medal(MEDALS.promoted);
        this.callout(`Upgraded to ${WEAPONS[n.weapon].name}`);
      } else if (n.kind === 'demote') this.callout(`Knifed! Back to ${WEAPONS[n.weapon].name}`);
      else if (n.kind === 'ctf') {
        const ours = n.team === m.player.team;
        if (n.event === 'taken') {
          if (n.byPlayer) {
            this.medal(MEDALS.flagTaken);
            this.callout('You have the flag! Bring it back to your base.');
          } else this.callout(ours ? 'Your flag has been taken!' : 'Your team has the enemy flag');
        } else if (n.event === 'captured') {
          if (n.byPlayer) this.medal(MEDALS.flagCaptured);
          this.audio.fanfare();
        } else if (n.event === 'returned') {
          if (n.byPlayer) this.medal(MEDALS.flagReturned);
          this.callout(ours ? 'Your flag was returned' : 'Enemy flag returned');
        } else if (n.event === 'dropped') {
          if (n.byPlayer) this.medal(MEDALS.carrierKill);
          this.callout(ours ? 'Your flag was dropped. Go return it!' : 'Enemy flag dropped');
        }
      }
    }
    if (m.phase === 'over' && !this.xpBanked) {
      this.xpBanked = true;
      this.medal(MEDALS.played);
      if (m.result === 'win') this.medal(MEDALS.win);
      const prof = loadProfile();
      prof.xp += this.xp;
      prof.matches++;
      if (m.result === 'win') prof.wins++;
      prof.kills += m.player.kills;
      prof.deaths += m.player.deaths;
      saveProfile(prof);
    }
  }

  /** Oldest corpses go first once too many ragdolls are simulating. */
  private capRagdolls(): void {
    const dead = [...this.views.entries()].filter(([, v]) => v.ragdoll).sort((a, b) => a[1].diedAt - b[1].diedAt);
    while (dead.length > MAX_RAGDOLLS) {
      const [id, v] = dead.shift()!;
      if (id === this.match.player.id) continue;
      v.dispose();
      this.views.delete(id);
    }
  }

  private renderFrame(dt: number, alpha: number): void {
    const sim = this.match.sim;
    const player = this.match.player;
    const time = sim.time;

    for (const a of sim.agents) {
      let v = this.views.get(a.id);
      if (!a.alive && (!v || v.life !== a.life || !v.ragdoll)) continue;
      v = this.viewFor(a);
      if (!a.alive && time - v.diedAt > CORPSE_SECONDS && a !== player) {
        v.dispose();
        this.views.delete(a.id);
        continue;
      }
      const p = this.prev.get(a.id) ?? a;
      const x = p.x + (a.x - p.x) * alpha;
      const y = p.y + (a.y - p.y) * alpha;
      const z = p.z + (a.z - p.z) * alpha;
      // The player's own body is only shown once it is a corpse.
      v.setVisible(a !== player || !a.alive);
      if (dt > 0 || a !== player) v.update(a, x, y, z, dt, time);
      if (a !== player) v.showTag(a.alive && this.tagVisible(a), this.camera.position.distanceTo(v.root.position));
      // Footsteps: one per stride, louder when sprinting, silent when crouched.
      if (a.alive && a.onGround && dt > 0) {
        const speed = Math.hypot(a.vx, a.vz);
        const stride = (this.stride.get(a.id) ?? 0) + speed * dt;
        const len = a.sprinting ? 2.2 : 1.7;
        if (stride > len) {
          this.stride.set(a.id, 0);
          const vol = a.crouching ? 0 : a.sprinting ? 1 : 0.6;
          if (a === player) this.audio.footstep(0.5, 0, vol * 0.5);
          else if (vol > 0) {
            const d = this.distTo(a.x, a.z);
            if (d < 30) this.audio.footstep(d, this.panTo(a.x, a.z), vol);
          }
        } else this.stride.set(a.id, stride);
      }
    }

    // Grenades in flight.
    while (this.grenadeMeshes.length < sim.grenades.length) {
      const m = grenadeMesh();
      this.grenadeGroup.add(m);
      this.grenadeMeshes.push(m);
    }
    this.grenadeMeshes.forEach((m, i) => {
      const g = sim.grenades[i];
      m.visible = !!g;
      if (g) {
        m.position.set(g.x, g.y, g.z);
        m.rotation.x += dt * 8;
        m.rotation.z += dt * 5;
      }
    });

    // Camera.
    if (player.alive) {
      const p = this.prev.get(player.id) ?? player;
      const x = p.x + (player.x - p.x) * alpha;
      const y = p.y + (player.y - p.y) * alpha;
      const z = p.z + (player.z - p.z) * alpha;
      this.camEye += (eyeHeight(player) - this.camEye) * Math.min(1, dt * 12);
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const sx = (Math.random() - 0.5) * this.shake * 0.04;
      const sy = (Math.random() - 0.5) * this.shake * 0.04;
      this.camera.position.set(x, y + this.camEye, z);
      // Sliding tilts the view a little.
      const roll = player.slideT > 0 ? 0.08 : 0;
      this.camera.rotation.set(this.pitch + player.recoil + sy, this.yaw + Math.PI + player.recoilYaw + sx, roll);
      const ads = this.viewmodel.adsAmount;
      const w = weaponOf(player);
      const zoom = w.scope ? Math.max(0, this.settings.fov - 20) : w.adsFov;
      const fov = this.settings.fov - ads * zoom;
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    } else {
      // Death cam: orbit the ragdoll.
      this.deathCamT += dt;
      const v = this.views.get(player.id);
      const hips = v ? v.hips(this.tmpA) : this.tmpA.set(player.x, 1, player.z);
      const ang = this.yaw + Math.PI + this.deathCamT * 0.25;
      const dist = 2.2 + Math.min(2.5, this.deathCamT * 1.5);
      const want = this.tmpB.set(hips.x + Math.sin(ang) * dist, hips.y + 1.2 + Math.min(1.5, this.deathCamT), hips.z + Math.cos(ang) * dist);
      // Keep the camera out of walls.
      const dir = want.clone().sub(hips);
      const len = dir.length();
      dir.normalize();
      const free = sim.arena.raycast(hips.x, hips.y + 0.2, hips.z, dir.x, dir.y, dir.z, len);
      this.camera.position.copy(hips).addScaledVector(dir, Math.max(0.6, free - 0.3));
      this.camera.lookAt(hips);
      this.camEye = 1.62;
      if (this.camera.fov !== this.settings.fov) {
        this.camera.fov = this.settings.fov;
        this.camera.updateProjectionMatrix();
      }
    }

    const pw = weaponOf(player);
    if (pw.id !== this.lastWeapon) {
      this.lastWeapon = pw.id;
      this.viewmodel.setWeapon(pw.id);
    }
    this.viewmodel.update(dt, {
      speed: Math.hypot(player.vx, player.vz),
      aiming: player.aiming && player.alive,
      sprinting: player.sprinting,
      reload: player.reloadT > 0 && pw.reload > 0 ? 1 - player.reloadT / pw.reload : 0,
      switching: player.switchT / 0.45,
      onGround: player.onGround,
      lookDX: this.lookDX,
      lookDY: this.lookDY,
      visible: player.alive,
      scope: pw.scope
    });
    this.lookDX = 0;
    this.lookDY = 0;
    this.arenaView.update(time, this.camera.position);
    this.effects.update(dt);

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewmodel.scene, this.viewmodel.camera);
  }

  // ---------------------------------------------------------------- HUD

  hud(): HudState {
    const m = this.match;
    const sim = m.sim;
    const p = m.player;
    const moving = Math.hypot(p.vx, p.vz) > 0.6;
    const w = weaponOf(p);
    let spread = !p.onGround ? w.spreadAir : moving ? w.spreadMoving : w.spreadStill;
    if (p.aiming) spread *= w.adsSpread;
    if (p.crouching) spread *= 0.75;
    const next = STREAK_LADDER.find((s) => s.kills > p.streak) ?? null;
    const teamMode = m.def.teams && m.mode !== 'survival';
    const players: ScoreRow[] = sim.agents
      .map((a) => ({
        id: a.id,
        name: this.nameOf(a.id),
        color: cssColor(this.colorOf(a.id)),
        kills: a.kills,
        deaths: a.deaths,
        alive: a.alive,
        isPlayer: a === p,
        ally: a.team === p.team
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const hill = sim.rally
      ? {
          holder: (m.hillHolder === -2 ? 'contested' : m.hillHolder === -1 ? 'none' : m.hillHolder === p.team ? 'us' : 'them') as 'us' | 'them' | 'contested' | 'none',
          seconds: m.hillSeconds(),
          onHill: p.alive && Math.hypot(p.x - sim.rally.x, p.z - sim.rally.z) < sim.rally.r
        }
      : null;
    return {
      mode: m.mode,
      modeName: m.def.name,
      hp: Math.max(0, Math.ceil(p.hp)),
      ammo: p.ammo,
      magazine: w.magazine,
      reloading: p.reloadT > 0 && w.reload > 0 ? 1 - p.reloadT / w.reload : 0,
      alive: p.alive,
      aiming: p.aiming,
      spread: spread + p.recoil * 0.5,
      banner: sim.time < m.bannerUntil ? m.banner : '',
      phase: m.phase,
      result: m.result,
      scores: m.scores,
      teamCounts: m.teamCounts(),
      showTeams: teamMode,
      teamColors: this.ids.teamColors ? [cssColor(this.ids.teamColors[0]), cssColor(this.ids.teamColors[1])] : null,
      players,
      showScoreboard: this.keys.has('Tab') && !this.paused,
      hill,
      targetScore: TARGETS[m.mode] ?? 0,
      wave: m.wave,
      enemiesLeft: m.enemiesRemaining(),
      kills: p.kills,
      deaths: p.deaths,
      topKills: Math.max(...sim.agents.filter((a) => a !== p).map((a) => a.kills), 0),
      zone: m.zoneInfo(),
      outsideZone: !!sim.zone && p.alive && sim.outsideZone(p, 0),
      aliveTotal: sim.agents.filter((a) => a.alive).length,
      placement: m.placement,
      canRespawn: m.canPlayerRespawn(),
      feed: this.feed.filter((f) => sim.time - f.at < 7),
      hitMarkerAt: this.hitMarkerAt,
      hitMarkerKind: this.hitMarkerKind,
      damage: this.damageMarks.filter((d) => sim.time - d.at < 1.2),
      pickupAt: this.pickupAt,
      time: sim.time,
      paused: this.paused,
      weaponName: w.name,
      weaponId: w.id,
      loadout: p.weapons.map((id, i) => ({ id, name: WEAPONS[id].tag, active: i === p.slot })),
      grenades: p.grenades,
      scoped: this.viewmodel.scoped && p.alive,
      crouching: p.crouching || p.slideT > 0,
      protected: sim.time < p.protectedUntil,
      streak: p.streak,
      nextStreak: next,
      uav: sim.time < m.uavUntil,
      juggernaut: p.armor < 1,
      flags: m.flags.map((f) => ({
        label: f.label,
        owner: (f.owner === -1 ? 'none' : f.owner === p.team ? 'us' : 'them') as 'us' | 'them' | 'none',
        progress: p.team === 0 ? f.progress : -f.progress,
        onIt: p.alive && Math.hypot(p.x - f.x, p.z - f.z) < f.r
      })),
      infectedSeconds: m.mode === 'infected' ? m.infectedSeconds() : null,
      gunTier:
        m.mode === 'gungame'
          ? {
              index: p.tier,
              total: GUN_GAME_LADDER.length,
              weapon: WEAPONS[GUN_GAME_LADDER[p.tier]].name,
              next: p.tier + 1 < GUN_GAME_LADDER.length ? WEAPONS[GUN_GAME_LADDER[p.tier + 1]].name : 'Win',
              kills: p.tierKills,
              perTier: p.tier === GUN_GAME_LADDER.length - 1 ? 1 : GUN_GAME_KILLS_PER_TIER
            }
          : null,
      medals: this.medals.filter((x) => sim.time - x.at < 3),
      callouts: this.callouts.filter((x) => sim.time - x.at < 3.5),
      xp: this.xp,
      killedBy: p.alive ? null : this.killedBy,
      ctf: m.ctf.length
        ? (() => {
            const state = (f: (typeof m.ctf)[number]) => (f.home ? 'home' : f.carrier >= 0 ? 'taken' : 'dropped') as 'home' | 'taken' | 'dropped';
            const own = m.ctf[p.team];
            const enemy = m.ctf[1 - p.team];
            return { ours: state(own), theirs: state(enemy), carrying: enemy.carrier === p.id };
          })()
        : null
    };
  }

  /** Top-down map: walls, zone, medkits, allies; enemies only while they are firing. */
  drawMinimap(ctx: CanvasRenderingContext2D, size: number): void {
    const sim = this.match.sim;
    const p = this.match.player;
    const H = sim.arena.half;
    const s = size / (2 * H);
    // North-up: screen up is +Z, so screen right is -X (a soldier facing +Z has -X on their right).
    const X = (x: number) => (H - x) * s;
    const Z = (z: number) => (H - z) * s;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(20,24,20,0.72)';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(200,200,190,0.75)';
    for (const b of sim.arena.boxes) {
      ctx.fillRect(X(b.maxX), Z(b.maxZ), (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
    }
    for (const f of this.match.ctf) {
      ctx.strokeStyle = this.teamCss(f.team);
      ctx.lineWidth = 2;
      ctx.strokeRect(X(f.homeX) - 5, Z(f.homeZ) - 5, 10, 10);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(X(f.x), Z(f.z) - 8);
      ctx.lineTo(X(f.x) + 7, Z(f.z) - 5);
      ctx.lineTo(X(f.x), Z(f.z) - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(X(f.x) - 1, Z(f.z) - 8, 2, 10);
    }
    for (const f of this.match.flags) {
      ctx.fillStyle = f.owner === -1 ? 'rgba(255,255,255,0.8)' : this.teamCss(f.owner);
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      ctx.arc(X(f.x), Z(f.z), 7, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillText(f.label, X(f.x), Z(f.z) + 1);
    }
    if (sim.rally) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(sim.rally.x), Z(sim.rally.z), Math.max(3, sim.rally.r * s), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (sim.zone) {
      ctx.strokeStyle = '#4fb3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(sim.zone.x), Z(sim.zone.z), Math.max(0, sim.zone.r * s), 0, Math.PI * 2);
      ctx.stroke();
      const t = this.match.zoneTarget();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(X(t.x), Z(t.z), Math.max(0, t.r * s), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Medkits as small green crosses (red is reserved for enemies).
    ctx.fillStyle = '#4cff7a';
    for (const m of sim.pickups) {
      if (!m.active || m.kind !== 'medkit') continue;
      ctx.fillRect(X(m.x) - 3, Z(m.z) - 1, 6, 2);
      ctx.fillRect(X(m.x) - 1, Z(m.z) - 3, 2, 6);
    }
    for (const a of sim.agents) {
      if (!a.alive || a === p) continue;
      const ally = a.team === p.team;
      const firing = sim.time - a.lastShotT < 1;
      const uav = sim.time < this.match.uavUntil;
      if (!ally && !firing && !uav) continue;
      ctx.fillStyle = cssColor(this.colorOf(a.id));
      ctx.beginPath();
      ctx.arc(X(a.x), Z(a.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.alive) {
      const px = X(p.x);
      const pz = Z(p.z);
      // Screen x grows toward -X world, screen y toward -Z: forward (sin, cos) maps to (-sin, -cos).
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px + fx * 7, pz + fz * 7);
      ctx.lineTo(px - fx * 4 - fz * 4, pz - fz * 4 + fx * 4);
      ctx.lineTo(px - fx * 4 + fz * 4, pz - fz * 4 - fx * 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.releaseLock();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContext);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('blur', this.onBlur);
    for (const v of this.views.values()) v.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
