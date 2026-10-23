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
import type { GameSettings } from './settings';
import type { ClientSession, HostSession } from '../net/Session';
import type { Snapshot, StartMsg } from '../net/protocol';
import { applySnapshot, type NetTarget } from '../net/snapshot';

/** Online role of this browser, if any. */
export type NetRole = { role: 'host'; session: HostSession; seed: number } | { role: 'client'; session: ClientSession; start: StartMsg };

export type { GameSettings } from './settings';

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
  killcam: { killer: string; color: string; weapon: string } | null;
  /** Online: why the match ended for us (host left, connection lost), or null. */
  netMessage: string | null;
  /** One line of mode-specific state (juggernaut, lives, bomb timer…). */
  modeStatus: string | null;
  /** Hide & Seek: seconds a blindfolded seeker still has to wait. */
  blind: number | null;
  /** A killcam is about to play (the end screen waits for it). */
  killcamPending: boolean;
  fps: number;
  /** Online round-trip time to the host in ms (null when not a client). */
  ping: number | null;
  online: boolean;
}

/** One recorded agent state for the killcam. */
interface Snap {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  crouching: boolean;
  slideT: number;
  sprinting: boolean;
  reloadT: number;
  weapon: WeaponId;
  lastShotT: number;
  alive: boolean;
}

const KILLCAM_BEFORE = 3.5;
const KILLCAM_AFTER = 0.6;
const KILLCAM_DELAY = 0.9;

/** Shown to the player as they approach each killstreak. */
const STREAK_LADDER = [
  { kills: 3, name: 'UAV' },
  { kills: 5, name: 'Airstrike' },
  { kills: 8, name: 'Juggernaut' }
];

const causeName = (c: DeathCause): string =>
  c === 'grenade' ? 'Frag Grenade' : c === 'airstrike' ? 'Airstrike' : c === 'zone' ? 'The Zone' : WEAPONS[c as WeaponId]?.name ?? c;
const causeTag = (c: DeathCause): string => (c === 'grenade' ? 'FRAG' : c === 'airstrike' ? 'AIRSTRIKE' : c === 'zone' ? 'ZONE' : WEAPONS[c as WeaponId]?.tag ?? '');

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
  private aimToggled = false;
  private crouchToggled = false;
  private fps = 60;
  private baseFogFar = 100;
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
  // Online.
  private netTargets = new Map<number, NetTarget>();
  private netTick = 0;
  netMessage: string | null = null;
  private ticker: Worker | null = null;
  private lastSnapAt = performance.now();
  // Killcam (1v1 only): a short history of every agent plus the shots fired.
  private history: { t: number; s: Snap[] }[] = [];
  private shotLog: { t: number; shooter: number; ex: number; ey: number; ez: number }[] = [];
  private pendingKillcam: { at: number; killer: number; victim: number; deathT: number } | null = null;
  private killcam: {
    killer: number;
    victim: number;
    deathT: number;
    clock: number;
    end: number;
    ghosts: Map<number, SoldierView>;
    victimDead: boolean;
    weapon: WeaponId;
  } | null = null;
  private recordTick = 0;

  constructor(
    private container: HTMLElement,
    private assets: LoadedAssets,
    opts: MatchOptions,
    learned: Brain | null,
    private settings: GameSettings,
    audio: GameAudio,
    readonly net: NetRole | null = null
  ) {
    this.audio = audio;
    const control = opts.botControl === 'learned' && learned ? 'learned' : 'heuristic';
    const client = net?.role === 'client' ? net : null;
    this.match = new Match({
      ...opts,
      botControl: control,
      seed: client ? client.start.seed : net?.role === 'host' ? net.seed : opts.seed,
      ...(client ? { mode: client.start.mode, difficulty: client.start.difficulty, humans: client.start.humans.length } : {})
    });
    const sim = this.match.sim;
    if (client) {
      // Mirror the host's match: we steer our own soldier, everyone else comes from snapshots.
      const me = sim.agents[client.start.you];
      sim.agents[0].control = 'remote';
      me.control = 'player';
      this.match.player = me;
      sim.puppet = true;
      sim.onKill = null;
      sim.onPickup = null;
      client.session.onSnap = (snap) => this.onSnapshot(snap);
      client.session.onEnd = (reason) => {
        this.netMessage = reason;
      };
    } else if (net?.role === 'host') {
      net.session.onClientLeft = (name) => this.callout(`${name} left the match`);
    }
    sim.brains.heuristic = heuristicBrain;
    if (learned) {
      // A learned bot without a target (or a policy that errors) falls back to the baseline.
      sim.brains.learned = (a, s) => {
        const act = learned(a, s);
        return act >= 0 ? act : heuristicBrain(a, s);
      };
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: settings.graphics.antialias, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x9cc3e6);
    this.scene.fog = new THREE.Fog(0x9cc3e6, 40, sim.arena.half * 3.2);
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 600);
    this.baseFogFar = sim.arena.half * 3.2;
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    SoldierView.headScale = sim.headScale;
    this.arenaView = new ArenaView(sim);
    this.scene.add(this.arenaView.group, this.effects.group);
    this.physics = new PhysicsWorld(sim.arena);
    this.viewmodel = new Viewmodel(weaponModels(assets.rifle), flashTexture());
    this.scene.add(this.grenadeGroup);

    const p = this.match.player;
    this.yaw = p.yaw;
    if (client) {
      this.ids = { names: client.start.names.slice(), colors: client.start.colors.slice(), teamColors: client.start.teamColors };
    } else {
      this.ids = assignIdentities(this.match, settings.playerName || 'Player', settings.playerColor);
      if (net?.role === 'host') net.session.begin(this.match, net.seed, this.ids.names, this.ids.colors, this.ids.teamColors);
    }
    this.yaw = this.match.player.yaw;
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

    this.applySettings(settings);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (net) this.startBackgroundTicker();
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
    const k = this.settings.keys;
    if (e.code === 'Tab' || e.code === k.scores) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === k.jump && this.killcam) {
      this.endKillcam();
      return;
    }
    if (e.code === k.jump) {
      this.jumpQueued = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
    }
    if (e.code === k.crouch && this.settings.toggleCrouch) this.crouchToggled = !this.crouchToggled;
    if (e.code === k.reload) this.reloadQueued = true;
    if (e.code === k.melee) this.meleeQueued = true;
    if (e.code === k.grenade) this.grenadeQueued = true;
    if (e.code === k.weapon1) this.switchQueued = 0;
    if (e.code === k.weapon2) this.switchQueued = 1;
    if (e.code === k.swap) this.switchQueued = this.match.player.slot === 0 ? 1 : 0;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    const s = this.settings;
    const ads = this.viewmodel.adsAmount;
    const k = 0.0022 * s.sensitivity * (1 + (s.adsSensitivity - 1) * ads);
    this.yaw -= e.movementX * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * k * (s.invertY ? -1 : 1), -1.45, 1.45);
    this.lookDX += e.movementX;
    this.lookDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) return;
    if (e.button === 0 && this.killcam) {
      this.endKillcam();
      return;
    }
    if (e.button === 0) {
      this.mouse.left = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
      const p = this.match.player;
      if (p.alive && p.ammo === 0 && p.reloadT <= 0) this.audio.dryFire();
    }
    if (e.button === 2) {
      this.mouse.right = true;
      if (this.settings.toggleAim) this.aimToggled = !this.aimToggled;
    }
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

  /** Applies settings live (everything except antialiasing, which needs a new renderer next match). */
  applySettings(s: GameSettings): void {
    this.settings = s;
    this.audio.setVolume(s.volume);
    const g = s.graphics;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * g.renderScale);
    this.onResize();
    this.renderer.shadowMap.enabled = g.shadows !== 'off';
    this.arenaView.setShadows(g.shadows);
    this.effects.density = g.effects === 'low' ? 0.35 : 1;
    const fog = this.scene.fog as THREE.Fog;
    fog.far = this.baseFogFar * g.viewDistance;
    fog.near = Math.min(40, fog.far * 0.4);
    this.camera.far = Math.max(60, fog.far + 20);
    this.camera.updateProjectionMatrix();
    if (!s.toggleAim) this.aimToggled = false;
    if (!s.toggleCrouch) this.crouchToggled = false;
  }

  private input(): PlayerInput {
    const k = this.keys;
    const b = this.settings.keys;
    const inp: PlayerInput = {
      forward: (k.has(b.forward) || k.has('ArrowUp') ? 1 : 0) - (k.has(b.back) || k.has('ArrowDown') ? 1 : 0),
      right: (k.has(b.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(b.left) || k.has('ArrowLeft') ? 1 : 0),
      yaw: this.yaw,
      pitch: this.pitch,
      fire: this.mouse.left,
      aim: this.settings.toggleAim ? this.aimToggled : this.mouse.right,
      reload: this.reloadQueued,
      jump: this.jumpQueued,
      sprint: k.has(b.sprint),
      crouch: this.settings.toggleCrouch ? this.crouchToggled : k.has(b.crouch),
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
    this.advance(now, true);
  };

  /**
   * Browsers stop animation frames in background tabs. In an online match the
   * other players would freeze, so a worker keeps ticking the game (without
   * drawing) while this tab is hidden.
   */
  private startBackgroundTicker(): void {
    const src = 'setInterval(() => postMessage(0), 16);';
    this.ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    this.ticker.onmessage = () => {
      if (!this.disposed && document.hidden) this.advance(performance.now(), false);
    };
  }

  private advance(now: number, render: boolean): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    if (render && dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.last = now;
    const sim = this.match.sim;
    const player = this.match.player;

    // Online matches never pause: other people are still playing.
    if (!this.paused || this.net) {
      this.acc += dt;
      const net = this.net;
      while (this.acc >= SIM.dt) {
        for (const a of sim.agents) this.prev.set(a.id, { x: a.x, y: a.y, z: a.z });
        const ammoBefore = player.ammo;
        const reloadBefore = player.reloadT;
        const input = this.input();
        if (net?.role === 'client') {
          // Predict our own soldier locally; send inputs to the host at 30 Hz.
          net.session.press(input);
          sim.stepLocal(player, input);
          if (++this.netTick % 2 === 0) net.session.sendInput(player, input);
        } else {
          if (net) net.session.applyInputs();
          this.match.step(input);
          if (net) net.session.clearOneShots();
        }
        if (player.ammo < ammoBefore) this.viewmodel.fire();
        if (player.reloadT > 0 && reloadBefore <= 0) this.audio.reload();
        const events = sim.drainEvents();
        if (net?.role === 'host') net.session.queueEvents(events);
        this.handleEvents(events);
        this.drainNotices();
        if (++this.recordTick % 2 === 0) this.record();
        this.acc -= SIM.dt;
      }
      if (net?.role === 'host') net.session.tick(now);
      if (net?.role === 'client') {
        this.smoothRemotes(dt);
        // WebRTC can take a long time to notice a vanished host; give up after 6 s of silence.
        if (!this.netMessage && now - this.lastSnapAt > 6000) this.netMessage = 'Lost connection to the host.';
      }
      this.physics.step(dt);
    }
    if (!render) return;
    const alpha = this.paused ? 1 : this.acc / SIM.dt;
    this.renderFrame(this.paused ? 0 : dt, alpha);
  }

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
        if (e.first) this.shotLog.push({ t: sim.time, shooter: e.shooter, ex: e.ex, ey: e.ey, ez: e.ez });
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
        if (victim === player && killer && killer !== victim) {
          this.pendingKillcam = { at: sim.time + KILLCAM_DELAY, killer: killer.id, victim: victim.id, deathT: sim.time };
        }
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

  // ---------------------------------------------------------------- online

  /** Client: a snapshot from the host. */
  private onSnapshot(snap: Snapshot): void {
    const me = this.match.player.id;
    this.lastSnapAt = performance.now();
    applySnapshot(this.match, snap, me, this.netTargets);
    // Our own shots, swings and reloads were already shown locally.
    const events = snap.ev.filter((e) => {
      if (e.type === 'shot') return e.shooter !== me;
      if (e.type === 'melee' || e.type === 'reload' || e.type === 'switch' || e.type === 'grenade') return e.agent !== me;
      return true;
    });
    this.handleEvents(events);
    this.drainNotices();
  }

  /** Client: other soldiers ease toward their latest snapshot positions. */
  private smoothRemotes(dt: number): void {
    SoldierView.headScale = this.match.sim.headScale;
    const k = 1 - Math.exp(-dt * 14);
    for (const a of this.match.sim.agents) {
      if (a === this.match.player) continue;
      const t = this.netTargets.get(a.id);
      if (!t) continue;
      a.x += (t.x - a.x) * k;
      a.y += (t.y - a.y) * k;
      a.z += (t.z - a.z) * k;
      a.yaw += wrapAngle(t.yaw - a.yaw) * k;
      a.pitch += (t.pitch - a.pitch) * k;
      this.prev.set(a.id, { x: a.x, y: a.y, z: a.z });
    }
  }

  /** Win or lose from this player's point of view (online clients work it out from the winning team). */
  private myResult(): 'win' | 'lose' | null {
    const m = this.match;
    if (this.net?.role !== 'client') return m.result;
    if (m.phase !== 'over') return null;
    if (m.mode === 'br') return m.player.alive ? 'win' : 'lose';
    if (m.mode === 'survival') return 'lose';
    return m.winTeam === m.player.team ? 'win' : 'lose';
  }

  private myBanner(): string {
    const m = this.match;
    const sim = m.sim;
    if (m.phase === 'over' && this.net?.role === 'client') {
      const win = this.myResult() === 'win';
      if (m.mode === 'br') return win ? 'Winner winner!' : 'Eliminated';
      if (m.mode === 'survival') return `Survived ${m.wave - 1} waves`;
      return win ? 'Victory' : 'Defeat';
    }
    return sim.time < m.bannerUntil ? m.bannerFor(m.player.team) : '';
  }

  // ---------------------------------------------------------------- killcam

  private record(): void {
    const sim = this.match.sim;
    this.history.push({
      t: sim.time,
      s: sim.agents.map((a) => ({
        x: a.x,
        y: a.y,
        z: a.z,
        yaw: a.yaw,
        pitch: a.pitch + (a.control === 'player' ? a.recoil : 0),
        vx: a.vx,
        vz: a.vz,
        crouching: a.crouching,
        slideT: a.slideT,
        sprinting: a.sprinting,
        reloadT: a.reloadT,
        weapon: a.weapons[a.slot] ?? 'rifle',
        lastShotT: a.lastShotT,
        alive: a.alive
      }))
    });
    const keep = sim.time - (KILLCAM_BEFORE + KILLCAM_AFTER + KILLCAM_DELAY + 1);
    while (this.history.length && this.history[0].t < keep) this.history.shift();
    while (this.shotLog.length && this.shotLog[0].t < keep) this.shotLog.shift();
  }

  /** Recorded state of agent `id` at time `t`, interpolated. */
  private snapAt(id: number, t: number): Snap | null {
    const h = this.history;
    if (!h.length) return null;
    let i = h.findIndex((f) => f.t >= t);
    if (i < 0) i = h.length - 1;
    const b = h[i].s[id];
    const a = i > 0 ? h[i - 1].s[id] : b;
    if (!a || !b) return b ?? null;
    const t0 = i > 0 ? h[i - 1].t : h[i].t;
    const k = h[i].t > t0 ? Math.min(1, Math.max(0, (t - t0) / (h[i].t - t0))) : 1;
    return {
      ...b,
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      z: a.z + (b.z - a.z) * k,
      yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * k,
      pitch: a.pitch + (b.pitch - a.pitch) * k
    };
  }

  /** Starts, advances and renders the killcam. Returns true while it is showing. */
  private updateKillcam(dt: number): boolean {
    const sim = this.match.sim;
    const pk = this.pendingKillcam;
    if (pk && !this.killcam && sim.time >= pk.at) {
      this.pendingKillcam = null;
      const start = pk.deathT - KILLCAM_BEFORE;
      // Only if we are still dead (a fast respawn skips it).
      if (this.history.length && !this.match.player.alive) {
        const killerSnap = this.snapAt(pk.killer, pk.deathT);
        this.killcam = {
          killer: pk.killer,
          victim: pk.victim,
          deathT: pk.deathT,
          clock: Math.max(start, this.history[0].t),
          end: pk.deathT + KILLCAM_AFTER,
          ghosts: new Map(),
          victimDead: false,
          weapon: killerSnap?.weapon ?? 'rifle'
        };
      }
    }
    const kc = this.killcam;
    if (!kc) return false;
    const prev = kc.clock;
    kc.clock += dt;
    if (kc.clock >= kc.end || this.match.player.alive) {
      this.endKillcam();
      return false;
    }
    // Hide the live world's soldiers; the replay draws ghosts from the recording.
    for (const v of this.views.values()) v.setVisible(false);
    const killer = this.snapAt(kc.killer, kc.clock);
    if (!killer) {
      this.endKillcam();
      return false;
    }
    // Ghosts for everyone near the killer at this moment (the 12 closest).
    const near = sim.agents
      .filter((a) => a.id !== kc.killer)
      .map((a) => ({ a, s: this.snapAt(a.id, kc.clock) }))
      .filter((g): g is { a: Agent; s: Snap } => !!g.s && (g.s.alive || g.a.id === kc.victim))
      .map((g) => ({ ...g, d: Math.hypot(g.s.x - killer.x, g.s.z - killer.z) }))
      .filter((g) => g.d < 70)
      .sort((x, y) => x.d - y.d)
      .slice(0, 12);
    const shown = new Set<number>();
    for (const { a, s } of near) {
      shown.add(a.id);
      let ghost = kc.ghosts.get(a.id);
      if (!ghost) {
        ghost = new SoldierView(this.assets, { ...a, life: -1 }, this.colorOf(a.id));
        this.scene.add(ghost.root);
        kc.ghosts.set(a.id, ghost);
      }
      ghost.setVisible(true);
      const fake = { ...a, ...s, weapons: [s.weapon], slot: 0, alive: true };
      if (a.id === kc.victim && !kc.victimDead && kc.clock >= kc.deathT) {
        kc.victimDead = true;
        ghost.die({ ...a, ...s }, this.physics, sim.time);
      }
      ghost.update(fake, s.x, s.y, s.z, dt, kc.clock);
    }
    for (const [id, g] of kc.ghosts) if (!shown.has(id) && !g.ragdoll) g.setVisible(false);

    const eye = eyeHeight(killer);
    this.camera.position.set(killer.x, killer.y + eye, killer.z);
    this.camera.rotation.set(killer.pitch, killer.yaw + Math.PI, 0);
    if (this.camera.fov !== this.settings.fov) {
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }
    if (killer.weapon !== this.lastWeapon) {
      this.lastWeapon = killer.weapon;
      this.viewmodel.setWeapon(killer.weapon);
    }
    // Replay the shots fired in this slice of time.
    for (const sh of this.shotLog) {
      if (sh.t <= prev || sh.t > kc.clock) continue;
      const end = new THREE.Vector3(sh.ex, sh.ey, sh.ez);
      if (sh.shooter === kc.killer) {
        this.viewmodel.fire();
        const from = this.camera.localToWorld(this.viewmodel.muzzleLocal(new THREE.Vector3()));
        this.effects.tracer(from, end);
        this.audio.gunshot(0, 0, true, killer.weapon);
      } else {
        const g = kc.ghosts.get(sh.shooter);
        if (!g || !g.root.visible) continue;
        const from = g.muzzle(new THREE.Vector3());
        this.effects.tracer(from, end);
        this.effects.muzzleFlash(from, true);
        this.audio.gunshot(this.distTo(from.x, from.z), 0, false);
      }
    }
    this.viewmodel.update(dt, {
      speed: Math.hypot(killer.vx, killer.vz),
      aiming: false,
      sprinting: killer.sprinting,
      reload: 0,
      switching: 0,
      onGround: true,
      lookDX: 0,
      lookDY: 0,
      visible: true,
      scope: false
    });
    return true;
  }

  private endKillcam(): void {
    const kc = this.killcam;
    if (!kc) return;
    for (const g of kc.ghosts.values()) g.dispose();
    this.killcam = null;
    // Force the viewmodel back to the player's own weapon.
    this.lastWeapon = null;
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
    const me = m.player.id;
    // An online host forwards every notice to its clients before reacting to them itself.
    if (this.net?.role === 'host' && m.notices.length) this.net.session.queueNotices(m.notices);
    while (m.notices.length) {
      const n = m.notices.shift()!;
      if (n.kind === 'streak') {
        if (n.agent !== me) continue;
        this.callout(n.name === 'UAV' ? 'UAV online: enemies shown on your minimap' : n.name === 'Airstrike' ? 'Airstrike inbound!' : 'Juggernaut armour equipped');
        this.audio.fanfare();
      } else if (n.kind === 'capture' && n.on.includes(me) && n.team === m.player.team) this.medal(MEDALS.captured);
      else if (n.kind === 'tag' && n.by === me) this.medal(n.confirmed ? MEDALS.confirmed : MEDALS.denied);
      else if (n.kind === 'infected') {
        if (n.by === me) this.medal(MEDALS.infect);
        if (n.victim === me) this.callout('You have been infected! Knife the survivors.');
      } else if (n.kind === 'promote') {
        if (n.agent !== me) continue;
        this.medal(MEDALS.promoted);
        this.callout(`Upgraded to ${WEAPONS[n.weapon].name}`);
      } else if (n.kind === 'demote') {
        if (n.agent === me) this.callout(`Knifed! Back to ${WEAPONS[n.weapon].name}`);
      } else if (n.kind === 'jugg') {
        this.callout(n.agent === me ? 'You are the Juggernaut!' : `${this.nameOf(n.agent)} is the Juggernaut`);
        if (n.agent === me) this.audio.fanfare();
      } else if (n.kind === 'sharp') {
        this.callout(`New weapon: ${WEAPONS[n.weapon].name}`);
        this.audio.weaponSwitch();
      } else if (n.kind === 'potato') {
        if (n.holder === me) {
          this.callout('YOU HAVE THE BOMB! Knife someone to pass it!');
          this.audio.whistle();
        } else if (n.from === me) this.callout(`Bomb passed to ${this.nameOf(n.holder)}`);
        else this.callout(`${this.nameOf(n.holder)} has the bomb`);
      } else if (n.kind === 'ctf') {
        const ours = n.team === m.player.team;
        const byMe = n.by === me;
        if (n.event === 'taken') {
          if (byMe) {
            this.medal(MEDALS.flagTaken);
            this.callout('You have the flag! Bring it back to your base.');
          } else this.callout(ours ? 'Your flag has been taken!' : 'Your team has the enemy flag');
        } else if (n.event === 'captured') {
          if (byMe) this.medal(MEDALS.flagCaptured);
          this.audio.fanfare();
        } else if (n.event === 'returned') {
          if (byMe) this.medal(MEDALS.flagReturned);
          this.callout(ours ? 'Your flag was returned' : 'Enemy flag returned');
        } else if (n.event === 'dropped') {
          if (byMe) this.medal(MEDALS.carrierKill);
          this.callout(ours ? 'Your flag was dropped. Go return it!' : 'Enemy flag dropped');
        }
      }
    }
    if (m.phase === 'over' && !this.xpBanked) {
      this.xpBanked = true;
      this.medal(MEDALS.played);
      const won = this.myResult() === 'win';
      if (won) this.medal(MEDALS.win);
      const prof = loadProfile();
      prof.xp += this.xp;
      prof.matches++;
      if (won) prof.wins++;
      prof.kills += m.player.kills;
      prof.deaths += m.player.deaths;
      saveProfile(prof);
    }
  }

  /** Oldest corpses go first once too many ragdolls are simulating. */
  private capRagdolls(): void {
    const dead = [...this.views.entries()].filter(([, v]) => v.ragdoll).sort((a, b) => a[1].diedAt - b[1].diedAt);
    while (dead.length > this.settings.graphics.maxRagdolls) {
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

    const inKillcam = this.updateKillcam(dt);
    // Camera.
    if (inKillcam) {
      // The killcam drives the camera and viewmodel.
    } else if (player.alive) {
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

    if (!inKillcam) this.updateViewmodel(dt);
    this.lookDX = 0;
    this.lookDY = 0;
    this.arenaView.update(time, this.camera.position);
    this.effects.update(dt);

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewmodel.scene, this.viewmodel.camera);
  }

  private updateViewmodel(dt: number): void {
    const player = this.match.player;
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
      banner: this.myBanner(),
      phase: m.phase,
      result: this.myResult(),
      scores: m.scores,
      teamCounts: m.teamCounts(),
      showTeams: teamMode,
      teamColors: this.ids.teamColors ? [cssColor(this.ids.teamColors[0]), cssColor(this.ids.teamColors[1])] : null,
      players,
      showScoreboard: this.keys.has(this.settings.keys.scores) && !this.paused,
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
      canRespawn: this.net?.role === 'client' ? false : m.canPlayerRespawn(),
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
      uav: sim.time < (m.uavUntil[p.id] ?? -1),
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
      netMessage: this.netMessage,
      modeStatus: m.statusFor(p, (id) => this.nameOf(id)),
      blind: p.alive && sim.time < p.frozenUntil ? Math.ceil(p.frozenUntil - sim.time) : null,
      killcamPending: !!this.pendingKillcam,
      fps: Math.round(this.fps),
      ping: this.net?.role === 'client' ? this.net.session.ping : this.net ? 0 : null,
      online: !!this.net,
      killcam: this.killcam
        ? { killer: this.nameOf(this.killcam.killer), color: cssColor(this.colorOf(this.killcam.killer)), weapon: WEAPONS[this.killcam.weapon].name }
        : null,
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
      const uav = sim.time < (this.match.uavUntil[this.match.player.id] ?? -1);
      const marked = a.id === this.match.party.juggId || a.id === this.match.party.holder;
      if (!ally && !firing && !uav && !marked) continue;
      if (marked) {
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        ctx.arc(X(a.x), Z(a.z), 6, 0, Math.PI * 2);
        ctx.fill();
      }
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
    this.ticker?.terminate();
    if (this.net?.role === 'host') this.net.session.close();
    if (this.net?.role === 'client') this.net.session.leave();
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
