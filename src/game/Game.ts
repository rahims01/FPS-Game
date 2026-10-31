import * as THREE from 'three';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ArenaView } from '../render/ArenaView';
import { Effects, flashTexture } from '../render/Effects';
import { SoldierView } from '../render/SoldierView';
import { Viewmodel } from '../render/Viewmodel';
import { eyeHeight, weaponOf, type Agent, type DeathCause } from '../sim/Agent';
import { weaponModels } from '../assets/weaponModels';
import { WEAPONS, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_TIER, PRIMARIES, SECONDARIES, type WeaponId } from '../sim/weapons';
import { setLoadout } from '../sim/Agent';
import { MEDALS, levelOf, loadProfile, saveProfile, type Medal } from './progression';
import { SKINS } from '../assets/skins';
import { streakDef } from '../sim/killstreaks';
import { hasPerk, THROWABLES, type ThrowableId } from '../sim/gear';
import { isBrMode } from '../sim/Match';
import { thrownModel } from '../render/thrown';
import { setMetalNight } from '../render/realMetal';
import { camoKey, meleeDef } from '../assets/melees';
import { Hints, type HintId } from './hints';
import { Gamepads, type PadFrame } from './gamepad';
import { BADGES, claimCollections, earned, emblemDef, flashDef, masteryOf, randomCosmetics, styleDef, titleDef, tracerDef, type Cosmetics, type StatKey } from './cosmetics';
import { tickSkins } from '../assets/skins';
import { SIM } from '../sim/config';
import type { Brain, PlayerInput, SimEvent } from '../sim/FpsSim';
import { heuristicBrain } from '../sim/heuristicBrain';
import { Match, PRACTICE_MODES, type MatchOptions, type ModeId } from '../sim/Match';
import { assignIdentities, basePingFor, COLORS, cssColor, freshNames, lateJoinerColor, levelFor, randomUsername, type Identities } from './identity';
import { botFriendByName, botFriends } from './botFriends';
import { COURSE } from '../sim/layouts';
import type { MissionRun } from './campaign';
import { account, eventOn } from '../net/account';
import { say, setClassroom } from './words';
import { wrapAngle, yawTo } from '../sim/math';
import { GameAudio } from './Audio';
import { keyLabel, lowerQuality, QUALITY_PRESETS, touchEnabled, type GameSettings } from './settings';
import type { ClientSession, HostSession } from '../net/Session';
import type { Snapshot, StartMsg } from '../net/protocol';
import { applySnapshot, type NetTarget } from '../net/snapshot';

/** Online role of this browser, if any. */
export type NetRole = { role: 'host'; session: HostSession; seed: number } | { role: 'client'; session: ClientSession; start: StartMsg };

export type { GameSettings } from './settings';

/** A player card: who someone is, what they wear, and whether you can friend them. */
export interface PlayerCardData {
  name: string;
  level: number;
  prestige: number;
  cosmetics: Cosmetics | null;
  color: number;
  favorite: WeaponId;
  /** You, a real person, a computer player, or a bot openly labelled as one (friend rooms). */
  kind: 'me' | 'human' | 'bot' | 'labelled';
  account: string | null;
  kills: number;
  deaths: number;
  mode: string;
}

/** The end screen's "your match" panel. */
export interface MatchSummary {
  xp: number;
  medals: { name: string; count: number; xp: number }[];
  kills: number;
  deaths: number;
  damage: number;
  shots: number;
  hits: number;
  headshots: number;
  bestStreak: number;
  longestKill: number;
  meters: number;
  seconds: number;
  /** Kills by weapon name, most first. */
  weapons: { name: string; kills: number }[];
  /** Titles from collections finished this match. */
  newTitles: string[];
  doubleXp: boolean;
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
  damage: number;
  /** Hit percentage (0..100), or -1 if no shots. */
  accuracy: number;
  headshots: number;
  bestStreak: number;
  /** Bots in online rooms are labelled as such. */
  bot: boolean;
  level: number;
  /** Connection in ms (null for bots and the local player offline). */
  ping: number | null;
  /** Emblem shown by the name. */
  emblem: { glyph: string; color: string } | null;
  /** Colour of the player's best weapon-mastery badge, if any. */
  mastery: string | null;
  card: string;
  emblemId: string;
  prestige: number;
  frame: string;
  title: string;
  nametag: string;
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
  /** The admin got this one (a crown in the feed). */
  killerAdmin?: boolean;
  victimIsPlayer: boolean;
  /** A line that is not a kill ("X left the match"). */
  system?: string;
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
  /** Squad battle royale: seconds until you redeploy, if a squadmate is alive. */
  redeployIn: number | null;
  /** Pre-match lineup: seconds left (null once the match is on). */
  intro: number | null;
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
  /** Aiming through a red dot or holographic sight. */
  optic: 'reddot' | 'holo' | null;
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
  killedBy: { name: string; color: string; weapon: string; distance: number; hp: number; headshot: boolean; card: string; emblem: string; level: number; title: string; frame: string; prestige: number } | null;
  ctf: { ours: 'home' | 'taken' | 'dropped'; theirs: 'home' | 'taken' | 'dropped'; carrying: boolean } | null;
  killcam: { killer: string; color: string; weapon: string } | null;
  /** Online: why the match ended for us (host left, connection lost), or null. */
  netMessage: string | null;
  /** One line of mode-specific state (juggernaut, lives, bomb timer…). */
  modeStatus: string | null;
  /** Hide & Seek: seconds a blindfolded seeker still has to wait. */
  blind: number | null;
  /** Stunned by the admin's Server Restart: seconds left. */
  reconnecting: number | null;
  /** A killcam is about to play (the end screen waits for it). */
  killcamPending: boolean;
  fps: number;
  /** Hardcore: no crosshair, no minimap. */
  hardcore: boolean;
  /** Online round-trip time to the host in ms (null when not a client). */
  ping: number | null;
  online: boolean;
  /** Watching another player (after dying in a no-respawn mode, or benched online). */
  spectating: { name: string; color: string; weapon: string } | null;
  /** Benched in an online room: watching the whole match. */
  spectator: boolean;
  chatOpen: boolean;
  /** Best player of the match (agent id), for the end screen. */
  mvp: number;
  /** Counter-UAV: your minimap is jammed. */
  jammed: boolean;
  /** Your three killstreaks, for the HUD. */
  streaks: { name: string; kills: number; earned: boolean }[];
  touch: boolean;
  /** Flashbang whiteout, 0..1. */
  flashed: number;
  /** Boss fight: the boss's health 0..1 and phase. */
  boss: { hp: number; phase: number } | null;
  /** Visual sound cues (accessibility): direction relative to the view, kind and age. */
  sounds: { angle: number; kind: 'shot' | 'step' | 'boom'; at: number }[];
  /** Badges unlocked by this match (for the end screen). */
  newBadges: string[];
  /** Your match in numbers, once it's over. */
  summary: MatchSummary | null;
  /** Your throwables: lethal and tactical, with counts. */
  throwables: { lethal: ThrowableId; lethals: number; tactical: ThrowableId; tacticals: number };
  night: boolean;
  party: boolean;
  /** Public matchmaking with strangers (no chat). */
  publicMatch: boolean;
  /** A first-match control hint: the keys or buttons, and what they do. */
  hint: { keys: string[]; text: string } | null;
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
  /** Aiming down sights (bots aim whenever they have a target in view). */
  aiming: boolean;
  reloadDur: number;
  hp: number;
  ammo: number;
  streak: number;
  onGround: boolean;
  weapons: WeaponId[];
  slot: number;
  grenades: number;
  tacticals: number;
  kills: number;
  deaths: number;
}

/** World state the killcam replays besides soldiers: smoke and fire, and throwables in flight. */
interface WorldSnap {
  fields: { kind: 'fire' | 'smoke'; x: number; z: number; r: number; until: number }[];
  grenades: { kind: ThrowableId; x: number; y: number; z: number; vx: number; vy: number; vz: number }[];
}

const KILLCAM_BEFORE = 3.5;
const KILLCAM_AFTER = 0.6;
const KILLCAM_DELAY = 0.9;

/** Thrown and placed things that kill, by name and kill-feed tag. */
const THROWN_CAUSES: Partial<Record<string, [string, string]>> = {
  grenade: ['Frag Grenade', 'FRAG'],
  airstrike: ['Airstrike', 'AIRSTRIKE'],
  zone: ['The Zone', 'ZONE'],
  ball: ['Dodgeball', 'BALL'],
  tknife: ['Throwing Knife', 'THROWING KNIFE'],
  spear: ['Spear', 'SPEAR'],
  molotov: ['Molotov', 'MOLOTOV']
};
const causeName = (c: DeathCause): string => THROWN_CAUSES[c]?.[0] ?? WEAPONS[c as WeaponId]?.name ?? c;
const causeTag = (c: DeathCause): string => THROWN_CAUSES[c]?.[1] ?? WEAPONS[c as WeaponId]?.tag ?? '';

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
  private tacticalQueued = false;
  // Controller.
  private pads = new Gamepads();
  private pad: PadFrame | null = null;
  private padMode = false;
  // Thrown items stuck in walls (they fade after a while).
  private wallStuck: { mesh: THREE.Object3D; until: number }[] = [];
  private thrownMeshes: { kind: ThrowableId; mesh: THREE.Object3D }[] = [];
  // Night: the player's flashlight and a few lights for others' flashlights.
  readonly night: boolean;
  private flashlight: THREE.SpotLight | null = null;
  private otherLights: THREE.SpotLight[] = [];
  private beams = new Map<number, THREE.Mesh>();
  // Accessibility: recent sounds to show as arrows.
  private soundCues: HudState['sounds'] = [];
  // Lifetime stats gathered this match (banked into the profile at the end).
  private matchStats: Partial<Record<StatKey, number>> = {};
  private newBadges: string[] = [];
  private summary: MatchSummary | null = null;
  /** This match: medals by key, distance moved and the longest kill. */
  private medalCounts: Record<string, number> = {};
  private meters = 0;
  private lastPos: { x: number; z: number } | null = null;
  private longestKill = 0;
  private lastBeat = 0;
  private prevPhase: Match['phase'] = 'live';
  private prevScores: [number, number] = [0, 0];
  /** Keep the online session open when this match is disposed (going back to the room). */
  keepNet = false;
  readonly party: boolean;
  private nextFrameAt = 0;
  /** Pre-match lineup: the match waits until then (offline matches only). */
  private introUntil = 0;
  /** The lineup starts with the first frame actually drawn (scene setup can take a moment). */
  private introPending = false;
  private lateAfkDone = false;
  /** Calling card, emblem and charm by agent id. */
  private cosmetics: (Cosmetics | null)[] = [];
  /** Account usernames by agent id (signed-in humans). */
  private accounts: (string | null)[] = [];
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
  private stride = new Map<number, number>();
  /** Simplified soldiers: the camera's view volume (from the last drawn frame). */
  private frustum = new THREE.Frustum();
  private viewProj = new THREE.Matrix4();
  /** Auto quality: real seconds this match has run slowly, seconds since the last check or change, and frames in the current window. */
  private slowFor = 0;
  private qualityWatch = 0;
  private watchAt = 0;
  private watchWindow = 0;
  private watchFrames = 0;
  /** First-match control hints, and when the player last came alive (for their timing). */
  private hints: Hints;
  private aliveSince = -1;
  /** Called when the game changes the player's settings by itself (auto quality), so they get saved. */
  onSettings: ((s: GameSettings) => void) | null = null;
  // Progression.
  private medals: HudState['medals'] = [];
  private callouts: HudState['callouts'] = [];
  private medalId = 0;
  private xp = 0;
  private xpBanked = false;
  /** Admin events running when the match started. */
  private readonly doubleXp = eventOn('doubleXp');
  private readonly confettiKills = eventOn('confettiKills');
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
  private history: { t: number; s: Snap[]; world: WorldSnap }[] = [];
  /** Every shot (pellets included) for the killcam: tracers, impacts, blood and hit reactions. */
  private shotLog: {
    t: number;
    shooter: number;
    first: boolean;
    weapon: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    ex: number;
    ey: number;
    ez: number;
    world: { nx: number; ny: number; nz: number } | null;
    hit: number;
    region: 'head' | 'torso' | 'legs';
  }[] = [];
  /** Explosions, flashbangs and shatters for the killcam. */
  private fxLog: { t: number; type: 'explosion' | 'flash' | 'shatter'; x: number; y: number; z: number; kind: string }[] = [];
  /** Hits, for replaying the killer's hit markers and damage numbers in the killcam. */
  private hitLog: { t: number; attacker: number; target: number; amount: number; head: boolean; killed: boolean; x: number; y: number; z: number }[] = [];
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
  private endFrameDrawn = false;
  // Spectating.
  /** Benched in an online room: never plays, only watches. */
  readonly spectator: boolean;
  private specId = -1;
  private specShown = -1;
  // Floating damage numbers.
  private dmgNumbers: { target: number; sprite: THREE.Sprite; amount: number; head: boolean; born: number; x: number; y: number; z: number }[] = [];
  // Skin unlocks this match.
  private baseWeaponKills: Record<string, number> = {};
  private weaponKills: Record<string, number> = {};
  // Matchmade lobbies: people come and go, and everyone has a connection.
  private nextChurn = 30;
  /** Rage quits so far this match (at most two). */
  private quits = 0;
  private botCount = 0;
  private pings = new Map<number, number>();
  private pingT = 0;
  // Chat and touch.
  chatOpen = false;
  /** Touch: the scoreboard button is held. */
  showScores = false;
  private touchMode = false;
  /** Touch controls: stick (-1..1) and held buttons. */
  readonly touch = { moveX: 0, moveY: 0, fire: false, aim: false, sprint: false, crouch: false };

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
    this.hints = new Hints(settings.hints);
    const control = opts.botControl === 'learned' && learned ? 'learned' : 'heuristic';
    const client = net?.role === 'client' ? net : null;
    this.match = new Match({
      ...opts,
      botControl: control,
      seed: client ? client.start.seed : net?.role === 'host' ? net.seed : opts.seed,
      ...(client ? { mode: client.start.mode, difficulty: client.start.difficulty, humans: client.start.humans.length, rules: client.start.rules } : {})
    });
    const sim = this.match.sim;
    this.spectator = client ? client.start.spectate : net?.role === 'host' ? !net.session.hostPlaying : !!opts.watch;
    this.party = client ? !!client.start.party : net?.role === 'host' ? net.session.party : false;
    this.night = client ? !!client.start.night : !!this.match.opts.night;
    setMetalNight(this.night);
    if (client) {
      // Mirror the host's match: we steer our own soldier, everyone else comes from snapshots.
      sim.agents[0].control = 'remote';
      const me = sim.agents[client.start.you];
      if (me) {
        me.control = 'player';
        this.match.player = me;
        this.match.streakChoices[me.id] = settings.streaks;
        // Perks and attachments change how our own soldier moves and reloads, which we predict locally.
        me.perks = settings.perks.slice();
        me.attach = settings.attachments;
        setLoadout(me, me.weapons);
      }
      sim.puppet = true;
      sim.onKill = null;
      sim.onPickup = null;
      client.session.onSnap = (snap) => this.onSnapshot(snap);
      client.session.onEnd = (reason) => {
        this.netMessage = reason;
      };
      client.session.onRename = (id, name) => {
        const old = this.ids.names[id];
        this.ids.names[id] = name;
        client.start.humans = client.start.humans.filter((h) => h !== id);
        this.callout(`${old} left · ${name} took over`);
        this.refreshTag(id);
      };
    } else if (net?.role === 'host') {
      net.session.onClientLeft = (name, id, bot) => {
        this.callout(bot ? `${name} left · ${bot} took over` : `${name} left the match`);
        if (id >= 0) this.refreshTag(id);
      };
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
    SoldierView.lowDetail = settings.graphics.simpleSoldiers;
    this.arenaView = new ArenaView(sim);
    this.scene.add(this.arenaView.group, this.effects.group);
    this.physics = new PhysicsWorld(sim.arena);
    this.viewmodel = new Viewmodel(weaponModels(assets.rifle), flashTexture());
    this.viewmodel.skins = settings.skins;
    this.baseWeaponKills = { ...loadProfile().weaponKills };
    try {
      this.match.party.aimBest = Number(localStorage.getItem('fps-aim-best') ?? 0) || 0;
    } catch {
      /* no storage */
    }
    this.scene.add(this.grenadeGroup);

    const p = this.match.player;
    this.yaw = p.yaw;
    if (client) {
      this.ids = { names: client.start.names.slice(), colors: client.start.colors.slice(), teamColors: client.start.teamColors, skins: client.start.skins.slice() };
      this.cosmetics = (client.start.cosmetics ?? []).slice();
      this.accounts = (client.start.accounts ?? []).slice();
    } else {
      // Watching a friend: your soldier is just another player, under someone else's name.
      if (opts.watch) this.match.player.control = opts.botControl;
      this.ids = assignIdentities(this.match, opts.watch ? freshNames(1)[0] : settings.playerName || 'Player', settings.playerColor, settings.skins);
      // The admin's team wears the admin's colour (the other side gets one that stands apart).
      if (!opts.watch && account().user?.role === 'admin' && this.ids.teamColors) recolorTeam(this.ids, this.match, this.match.player.team, settings.playerColor);
      // Everyone else's calling card and emblem (yours from the menu).
      this.cosmetics = this.match.sim.agents.map((a) => {
        if (a === this.match.player && !opts.watch) {
          const role = account().user?.role;
          return { ...settings.cosmetics, prestige: loadProfile().prestige, ...(role === 'admin' || role === 'mod' ? { staff: role } : {}) };
        }
        if (a.dummy) return null;
        // Bot friends wear what they always wear.
        const friend = botFriendByName(this.ids.names[a.id]);
        if (friend?.state === 'friends') return { ...friend.cosmetics, prestige: friend.prestige };
        // Other players wear what they've unlocked; long-time players have often prestiged.
        const lvl = levelFor(this.ids.names[a.id]);
        const prestige = a.smurf ? 0 : lvl > 30 && Math.random() < 0.3 ? 1 + Math.floor(Math.random() * Math.random() * 6) : 0;
        return randomCosmetics(lvl, Math.random, prestige);
      });
      this.clanTags();
      this.accounts = this.match.sim.agents.map((a) => (a === this.match.player && !opts.watch ? (account().user?.name ?? null) : null));
      if (net?.role === 'host') net.session.begin(this.match, net.seed, this.ids.names, this.ids.colors, this.ids.teamColors, this.ids.skins, this.cosmetics, this.accounts);
      if (opts.watch) this.specId = this.match.sim.agents.find((a) => this.ids.names[a.id] === opts.watch)?.id ?? -1;
      // Admin events for everyone's casual matches (not ranked or tournaments, which pass an exact skill).
      // Golden Guns (an admin event): everyone's guns are gold. Looks only.
      SoldierView.goldGuns = Viewmodel.goldGuns = eventOn('goldenGuns');
      if (!opts.skill) {
        if (eventOn('bigHeads')) this.match.sim.headScale = Math.max(this.match.sim.headScale, 1.8);
        if (eventOn('lowGravity')) this.match.sim.gravity *= 0.45;
      }
    }
    // Colourblind modes swap the team colours for a pair that stays distinct.
    const cb = settings.access.colorblind;
    if (cb !== 'off' && this.ids.teamColors) this.ids.teamColors = cb === 'tritanopia' ? [0xd9483d, 0x2fb8b0] : [0x3d7bd9, 0xe08a2e];
    this.yaw = this.match.player.yaw;
    if (this.ids.teamColors) this.arenaView.teamColors = this.ids.teamColors;
    if (this.night) this.setupNight();
    if (this.match.mode === 'course' || this.match.mode === 'race') this.addCourseMarks();
    this.viewmodel.charm = settings.cosmetics.charm;

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
    // Offline matches open with the lineup (practice drops you straight in).
    if (!net && !this.practice && this.match.mode !== 'survival' && this.match.mode !== 'zombies') this.introPending = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (net) this.startBackgroundTicker();
  }

  // ---------------------------------------------------------------- input

  requestLock(): void {
    this.audio.unlock();
    if (this.touchMode || this.padMode) {
      this.locked = true;
      this.paused = false;
      return;
    }
    // Browsers may refuse (no user gesture yet, or an unfocused document); the pause screen handles that.
    void Promise.resolve(this.renderer.domElement.requestPointerLock?.()).catch(() => {});
  }

  /** Touch screens play without pointer lock: the on-screen controls drive the input. */
  setTouchMode(on: boolean): void {
    if (on === this.touchMode) return;
    this.touchMode = on;
    if (on) this.releaseLock();
  }

  /** Touch: pauses (the on-screen pause button). */
  pause(): void {
    this.hints.learn('pause');
    if (this.touchMode) {
      this.locked = false;
      this.paused = true;
      this.clearTouch();
    } else this.releaseLock();
  }

  private clearTouch(): void {
    const t = this.touch;
    t.moveX = t.moveY = 0;
    t.fire = t.aim = t.sprint = t.crouch = false;
  }

  /** Touch: drag to look (pixels). */
  touchLook(dx: number, dy: number): void {
    if (!this.locked) return;
    const s = this.settings;
    const ads = this.viewmodel.adsAmount;
    const k = 0.0045 * s.sensitivity * (1 + (s.adsSensitivity - 1) * ads);
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k * (s.invertY ? -1 : 1), -1.45, 1.45);
    this.lookDX += dx;
    this.lookDY += dy;
  }

  /** Touch: one-shot buttons. */
  touchPress(action: 'jump' | 'reload' | 'grenade' | 'tactical' | 'melee' | 'swap' | 'fire'): void {
    if (!this.locked) return;
    if (action === 'fire') {
      if (this.killcam) this.endKillcam();
      else if (this.watching()) this.cycleSpectate(1);
      else if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
      return;
    }
    if (action === 'jump') {
      if (this.killcam) {
        this.endKillcam();
        return;
      }
      this.jumpQueued = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
    }
    if (action === 'reload') this.reloadQueued = true;
    if (action === 'grenade') this.grenadeQueued = true;
    if (action === 'tactical') this.tacticalQueued = true;
    if (action === 'melee') this.meleeQueued = true;
    if (action === 'swap') this.switchQueued = this.match.player.slot === 0 ? 1 : 0;
  }

  /** Skips the pre-match lineup. */
  skipIntro(): void {
    this.introUntil = 0;
    this.introPending = false;
  }

  /** Practice modes: no medals, XP, camo progress or killcams. */
  get practice(): boolean {
    return PRACTICE_MODES.includes(this.match.mode);
  }

  /** Practice: swap the primary for the next gun in the list. */
  private nextPracticeGun(): void {
    const p = this.match.player;
    if (!p.alive) return;
    // Cycles whichever slot is in hand: primaries on the main gun, pistols on the sidearm.
    const slot = p.slot === 1 ? 1 : 0;
    const pool = slot === 1 ? SECONDARIES : PRIMARIES;
    const held = p.weapons[slot];
    const next = pool[(pool.indexOf(held) + 1) % pool.length];
    const weapons = [p.weapons[0] ?? 'rifle', p.weapons[1] ?? 'pistol'];
    weapons[slot] = next;
    setLoadout(p, weapons);
    p.slot = slot;
    p.ammo = p.stash[slot];
    p.switchT = 0.45;
    const swapKey = keyLabel(slot === 1 ? this.settings.keys.weapon1 : this.settings.keys.weapon2);
    this.callout(`${WEAPONS[next].name} · ${keyLabel(this.settings.keys.cycle)} next ${slot === 1 ? 'pistol' : 'gun'} · ${swapKey} for your ${slot === 1 ? 'main gun' : 'pistol'}`);
    this.audio.weaponSwitch();
  }

  /** Opens the chat box (online rooms only); game keys are ignored while typing. */
  openChat(): void {
    if (!this.net) return;
    this.chatOpen = true;
    this.keys.clear();
  }

  closeChat(): void {
    this.chatOpen = false;
  }

  releaseLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onLockChange = () => {
    if (this.touchMode || this.padMode) return;
    this.locked = document.pointerLockElement === this.renderer.domElement;
    this.paused = !this.locked;
    if (!this.locked) this.keys.clear();
  };

  private onBlur = () => {
    this.keys.clear();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.locked || this.chatOpen) return;
    const k = this.settings.keys;
    if (e.code === k.chat && this.net) {
      e.preventDefault();
      this.openChat();
      return;
    }
    if (e.code === 'Tab' || e.code === k.scores) e.preventDefault();
    if (e.repeat) return;
    this.press(e.code);
  };

  /** A key or mouse button ("Mouse0" etc.) going down: every action can be bound to either. */
  private press(code: string): void {
    const k = this.settings.keys;
    this.keys.add(code);
    if (code === k.fire) {
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
      const p = this.match.player;
      if (p.alive && p.ammo === 0 && p.reloadT <= 0) this.audio.dryFire();
    }
    if (code === k.aim && this.settings.toggleAim) this.aimToggled = !this.aimToggled;
    if (performance.now() < this.introUntil && (code === k.jump || code === 'Enter')) {
      this.skipIntro();
      return;
    }
    if (code === k.jump && this.killcam) {
      this.endKillcam();
      return;
    }
    if (code === k.jump && this.watching()) {
      this.cycleSpectate(1);
      return;
    }
    if (code === k.jump) {
      this.jumpQueued = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
    }
    if (code === k.crouch && this.settings.toggleCrouch) this.crouchToggled = !this.crouchToggled;
    if (code === k.reload) this.reloadQueued = true;
    if (code === k.melee) this.meleeQueued = true;
    if (code === k.grenade) this.grenadeQueued = true;
    if (code === k.tactical) this.tacticalQueued = true;
    if (code === k.cycle && this.practice && this.net?.role !== 'client') this.nextPracticeGun();
    if (code === k.weapon1) this.switchQueued = 0;
    if (code === k.weapon2) this.switchQueued = 1;
    if (code === k.swap) this.switchQueued = this.match.player.slot === 0 ? 1 : 0;
  }

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
    if (this.watching() && (e.button === 0 || e.button === 2)) {
      this.cycleSpectate(e.button === 0 ? 1 : -1);
      return;
    }
    this.press(`Mouse${e.button}`);
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.locked) return;
    const p = this.match.player;
    if (p.weapons.length > 1) this.switchQueued = (p.slot + (e.deltaY > 0 ? 1 : p.weapons.length - 1)) % p.weapons.length;
  };

  private onMouseUp = (e: MouseEvent) => {
    this.keys.delete(`Mouse${e.button}`);
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
    this.effects.reduceFlash = s.access.reduceFlash;
    // Classroom mode: no blood, coloured sparks on hits.
    this.effects.bloodOn = s.blood && !s.classroom;
    this.effects.sparkHits = s.classroom;
    setClassroom(s.classroom);
    this.viewmodel.reduceMotion = s.access.reduceMotion;
    this.pads.deadzone = s.pad.deadzone;
    const fog = this.scene.fog as THREE.Fog;
    fog.far = this.baseFogFar * g.viewDistance;
    fog.near = Math.min(40, fog.far * 0.4);
    this.camera.far = Math.max(60, fog.far + 20);
    this.camera.updateProjectionMatrix();
    this.setTouchMode(touchEnabled(s));
    // Switching soldier detail rebuilds the living soldiers (corpses keep theirs).
    if (SoldierView.lowDetail !== g.simpleSoldiers) {
      SoldierView.lowDetail = g.simpleSoldiers;
      for (const [id, v] of this.views) {
        if (v.ragdoll) continue;
        v.dispose();
        this.views.delete(id);
      }
    }
    if (!s.toggleAim) this.aimToggled = false;
    if (!s.toggleCrouch) this.crouchToggled = false;
  }

  private input(): PlayerInput {
    const k = this.keys;
    const b = this.settings.keys;
    const t = this.touch;
    const pd = this.pad && this.padMode && this.locked ? this.pad : null;
    if (pd) this.padLook(pd);
    const inp: PlayerInput = {
      forward: THREE.MathUtils.clamp((k.has(b.forward) || k.has('ArrowUp') ? 1 : 0) - (k.has(b.back) || k.has('ArrowDown') ? 1 : 0) - t.moveY - (pd?.moveY ?? 0), -1, 1),
      right: THREE.MathUtils.clamp((k.has(b.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(b.left) || k.has('ArrowLeft') ? 1 : 0) + t.moveX + (pd?.moveX ?? 0), -1, 1),
      yaw: this.yaw,
      pitch: this.pitch,
      fire: k.has(b.fire) || t.fire || !!pd?.fire,
      aim: (this.settings.toggleAim ? this.aimToggled : k.has(b.aim)) || t.aim || !!pd?.aim,
      reload: this.reloadQueued,
      jump: this.jumpQueued,
      sprint: k.has(b.sprint) || t.sprint || -t.moveY > 0.92 || !!pd?.sprint,
      crouch: (this.settings.toggleCrouch ? this.crouchToggled : k.has(b.crouch)) || t.crouch || !!pd?.crouch,
      melee: this.meleeQueued,
      grenade: this.grenadeQueued,
      tactical: this.tacticalQueued,
      switchSlot: this.switchQueued
    };
    if (inp.switchSlot >= 0) this.hints.learn('swap');
    if (inp.grenade) this.hints.learn('lethal');
    if (inp.tactical) this.hints.learn('tactical');
    if (inp.reload) this.hints.learn('reload');
    if (inp.melee) this.hints.learn('knife');
    if (inp.fire && (inp.forward !== 0 || inp.right !== 0)) this.hints.learn('move');
    this.tacticalQueued = false;
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
    // V-sync off: draw as often as the browser allows instead of once per display refresh.
    if (this.settings.vsync) this.raf = requestAnimationFrame(this.frame);
    else window.setTimeout(() => this.frame(performance.now()), 0);
    // Frame cap: skip frames that come too soon (the simulation catches up on the next one).
    const cap = this.settings.fpsLimit;
    if (cap > 0) {
      if (now < this.nextFrameAt) return;
      this.nextFrameAt = Math.max(now, this.nextFrameAt + 1000 / cap);
    }
    this.pollPad();
    this.advance(now, true);
  };

  /** Controller: buttons that act once per press, and switching into controller mode. */
  private pollPad(): void {
    const f = this.pads.poll();
    this.pad = f;
    if (!f.connected) return;
    const active = f.pressed.size > 0 || Math.abs(f.moveX) + Math.abs(f.moveY) + Math.abs(f.lookX) + Math.abs(f.lookY) > 0.2;
    if (active && !this.padMode) {
      // Using the controller: play without pointer lock (like touch).
      this.padMode = true;
      this.releaseLock();
    }
    if (!this.padMode) return;
    const p = f.pressed;
    if (p.has('start')) {
      if (this.paused) this.requestLock();
      else this.pause();
      return;
    }
    this.showScores = f.scores;
    if (!this.locked) return;
    if (this.killcam && (p.has('a') || p.has('rt'))) {
      this.endKillcam();
      return;
    }
    if (this.watching() && (p.has('a') || p.has('rt') || p.has('lt'))) {
      this.cycleSpectate(p.has('lt') ? -1 : 1);
      return;
    }
    if (p.has('a')) {
      this.jumpQueued = true;
      if (this.match.canPlayerRespawn()) this.match.respawnPlayer();
    }
    if (p.has('rt') && this.match.canPlayerRespawn()) this.match.respawnPlayer();
    if (p.has('x')) this.reloadQueued = true;
    if (p.has('y')) this.switchQueued = this.match.player.slot === 0 ? 1 : 0;
    if (p.has('rb')) this.grenadeQueued = true;
    if (p.has('lb')) this.tacticalQueued = true;
    if (p.has('rs')) this.meleeQueued = true;
    if (p.has('up') && this.net) this.openChat();
    if (p.has('right') && this.practice) this.nextPracticeGun();
  }

  /** Controller look, with aim assist: slower over an enemy and a gentle pull along with them. */
  private padLook(f: PadFrame): void {
    const s = this.settings;
    const ads = this.viewmodel.adsAmount;
    let rate = 3.2 * s.pad.sensitivity * (1 + (s.adsSensitivity - 1) * ads) * SIM.dt;
    let pullYaw = 0;
    let pullPitch = 0;
    if (s.pad.aimAssist) {
      const p = this.match.player;
      let best = 0.09;
      for (const a of this.match.sim.agents) {
        if (!a.alive || a.team === p.team) continue;
        const dx = a.x - p.x;
        const dz = a.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 60) continue;
        const ey = p.y + eyeHeight(p);
        const dyaw = wrapAngle(Math.atan2(dx, dz) - this.yaw);
        const dpitch = Math.atan2(a.y + 1.3 * a.scale - ey, d) - this.pitch;
        const off = Math.hypot(dyaw, dpitch);
        if (off < best && this.match.sim.arena.lineOfSight(p.x, ey, p.z, a.x, a.y + 1.3, a.z)) {
          best = off;
          pullYaw = dyaw;
          pullPitch = dpitch;
        }
      }
      if (best < 0.09) {
        rate *= 0.55;
        // Only pull while the player is steering, so it never aims on its own.
        if (Math.abs(f.lookX) + Math.abs(f.lookY) + Math.abs(f.moveX) > 0.1) {
          this.yaw += pullYaw * 0.06;
          this.pitch += pullPitch * 0.04;
        }
      }
    }
    this.yaw -= f.lookX * rate;
    this.pitch = THREE.MathUtils.clamp(this.pitch - f.lookY * rate * (s.pad.invertY ? -1 : 1), -1.45, 1.45);
    this.lookDX += f.lookX * 8;
    this.lookDY += f.lookY * 8;
  }

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
    // Clamped: animation-frame timestamps and the background ticker can arrive out of order.
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    if (render && dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.last = now;
    const sim = this.match.sim;
    const player = this.match.player;

    // Once the match is over (and any killcam has played) everything stops: no
    // simulation, physics or drawing behind the end screen.
    const ended = this.match.phase === 'over' && !this.pendingKillcam && !this.killcam;
    if (ended) {
      if (this.net?.role === 'host') this.net.session.tick(now);
      if (render && !this.endFrameDrawn) {
        this.endFrameDrawn = true;
        this.renderFrame(0, 1);
      }
      this.acc = 0;
      return;
    }
    // The pre-match lineup: draw the scene but hold the match.
    if (this.introPending && render) {
      this.introPending = false;
      this.introUntil = now + 4500;
    }
    if (now < this.introUntil || this.introPending) {
      this.last = now;
      if (render) this.renderFrame(0, 1);
      return;
    }
    // Online matches never pause: other people are still playing.
    if (!this.paused || this.net) {
      this.acc += dt;
      const net = this.net;
      while (this.acc >= SIM.dt) {
        for (const a of sim.agents) this.prev.set(a.id, { x: a.x, y: a.y, z: a.z });
        const ammoBefore = player.ammo;
        const reloadBefore = player.reloadT;
        const input = this.input();
        if (net?.role === 'client' && this.spectator) {
          // Watching only: everything comes from the host.
        } else if (net?.role === 'client') {
          // Predict our own soldier locally; send inputs to the host at 30 Hz.
          net.session.press(input);
          sim.stepLocal(player, input);
          if (++this.netTick % 2 === 0) net.session.sendInput(player, input);
        } else {
          if (net) net.session.applyInputs();
          this.match.step(input);
          if (net) net.session.clearOneShots();
        }
        if (player.ammo < ammoBefore && !this.spectator) this.viewmodel.fire();
        if (player.reloadT > 0 && reloadBefore <= 0 && !this.spectator) this.audio.reload();
        const m0 = this.match;
        if (m0.phase !== this.prevPhase) {
          const mine = m0.player.team as 0 | 1;
          if (m0.phase === 'roundOver' && m0.def.teams && m0.scores[mine] > this.prevScores[mine] && m0.player.alive && !this.spectator) {
            const mates = sim.agents.filter((a) => a.team === mine && a !== m0.player);
            if (mates.length > 0 && mates.every((a) => !a.alive)) this.matchStats.clutches = (this.matchStats.clutches ?? 0) + 1;
          }
          this.prevPhase = m0.phase;
        }
        this.prevScores = [m0.scores[0], m0.scores[1]];
        const events = sim.drainEvents();
        if (net?.role === 'host') net.session.queueEvents(events);
        this.handleEvents(events);
        this.drainNotices();
        if (++this.recordTick % 2 === 0) this.record();
        this.acc -= SIM.dt;
      }
      if (net?.role === 'host') net.session.tick(now);
      if (!net) this.updateLobby();
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
    if (a.team === me.team || this.spectator) return true;
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
      this.ids.names.push(this.net && !this.party && !this.isPublic ? `Bot ${this.ids.names.length + 1}` : randomUsername(this.ids.names));
      this.ids.skins.push(null);
      this.ids.colors.push(lateJoinerColor(this.ids, a ? a.team : 1));
    }
  }

  private nameOf(id: number): string {
    this.ensureIdentity(id);
    const agents = this.match.sim.agents;
    if (this.match.mode === 'zombies' && agents[id]?.team === 1) return 'Zombie';
    if (agents[id]?.dummy) return agents[id].dummy === 'strafe' ? 'Moving Target' : 'Target';
    // Survival waves are faceless: Enemy 1, Enemy 2, ...
    if (this.match.mode === 'survival' && agents[id]?.team === 1) return `Enemy ${agents.filter((a) => a.team === 1 && a.id <= id).length}`;
    return this.ids.names[id];
  }

  /** Agents played by people (online), for labelling everyone else as a bot. */
  private isHumanId(id: number): boolean {
    const net = this.net;
    if (net?.role === 'client') return net.start.humans.includes(id);
    const a = this.match.sim.agents[id];
    return !!a && (a.control === 'player' || a.control === 'remote');
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
      v = new SoldierView(this.assets, a, this.colorOf(a.id), this.ids.skins[a.id] ?? {}, this.cosmetics[a.id]?.charm ?? 'none', meleeDef(this.cosmetics[a.id]?.melee).id, a.attach ?? {});
      const cos = this.cosmetics[a.id];
      v.setStyle(this.styleFor(a), this.colorOf(a.id));
      if (cosAdmin(this.cosmetics[a.id]) && a.alive && !this.killcam) this.effects.adminArrive(new THREE.Vector3(a.x, a.y, a.z));
      if (a !== this.match.player || this.spectator) {
        const title = cos && cos.title !== 'none' ? titleDef(cos.title).text : null;
        v.setNameTag(this.nameOf(a.id), cssColor(this.colorOf(a.id)), a.team === this.match.player.team, cos?.nametag ?? 'plain', title);
      }
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
    // While the killcam plays, the live match keeps running but stays invisible and silent:
    // the replay draws only what was recorded at the time.
    const live = !this.killcam;
    for (const e of events) {
      if (e.type === 'shot') {
        const shooter = sim.agents[e.shooter];
        this.shotLog.push({
          t: sim.time,
          shooter: e.shooter,
          first: e.first,
          weapon: e.weapon,
          ox: e.ox,
          oy: e.oy,
          oz: e.oz,
          ex: e.ex,
          ey: e.ey,
          ez: e.ez,
          world: e.world ? { nx: e.nx, ny: e.ny, nz: e.nz } : null,
          hit: e.hit,
          region: e.region ?? 'torso'
        });
        if (!live) continue;
        const end = this.tmpB.set(e.ex, e.ey, e.ez);
        let from: THREE.Vector3;
        if ((shooter === player && !this.spectator) || shooter.id === this.specShown) {
          from = this.camera.localToWorld(this.viewmodel.muzzleLocal(this.tmpA));
          if (e.first) {
            this.audio.gunshot(0, 0, true, e.weapon, false, !!weaponOf(shooter).suppressed);
            if (shooter.id === this.specShown) this.viewmodel.fire();
          }
        } else {
          const v = this.views.get(shooter.id);
          from = v ? v.muzzle(this.tmpA) : this.tmpA.set(e.ox, e.oy, e.oz);
          if (e.first) {
            const fl = flashDef(this.cosmetics[shooter.id]?.flash ?? 'default');
            this.effects.muzzleFlash(from, true, fl.scale, fl.color);
            // Behind you (more than ~110 degrees off where you look): muffled.
            const off = Math.abs(wrapAngle(yawTo(this.camera.position.x, this.camera.position.z, shooter.x, shooter.z) - this.yaw));
            this.audio.gunshot(this.distTo(shooter.x, shooter.z), this.panTo(shooter.x, shooter.z), false, e.weapon, off > 1.9, !!weaponOf(shooter).suppressed);
          }
          // A miss that passes close to your head: the whiz of the bullet going by.
          if (player.alive && !this.spectator && e.hit !== player.id && shooter.team !== player.team && this.nearMiss(e, player)) this.audio.whiz(this.panTo(e.ex, e.ez));
        }
        if (WEAPONS[e.weapon].pierce) this.effects.beam(from, end);
        else this.effects.tracer(from, end, WEAPONS[e.weapon].admin ? 0xffd34d : this.tracerColor(shooter.id));
        const paintball = this.match.mode === 'paintball';
        const paint = paintball ? this.colorOf(shooter.id) : 0;
        if (e.world) {
          if (paintball) this.effects.paint(end, this.tmpN.set(e.nx, e.ny, e.nz), paint);
          else this.effects.impact(end, this.tmpN.set(e.nx, e.ny, e.nz));
        }
        if (e.first && shooter !== player && this.settings.access.visualSound) this.soundCue(shooter.x, shooter.z, 'shot', 45);
        if (e.hit >= 0 && e.hit !== player.id) {
          const dir = this.tmpN.set(e.ex - e.ox, e.ey - e.oy, e.ez - e.oz).normalize();
          if (paintball) this.effects.paint(end, dir.clone().negate(), paint);
          else this.effects.blood(end, dir, e.region === 'head');
          const v = this.views.get(e.hit);
          if (v) {
            const victim = sim.agents[e.hit];
            // React to where the hit came from, where it landed and how hard it was.
            const side = Math.sign(Math.sin(wrapAngle(Math.atan2(dir.x, dir.z) - victim.yaw))) || 1;
            const w = WEAPONS[e.weapon];
            const strength = THREE.MathUtils.clamp((w.damage.torso * w.pellets) / 40, 0.5, 1.5);
            v.hit(side, e.region ?? 'torso', strength, dir.x, dir.z);
          }
        }
      } else if (e.type === 'appeal') {
        if (!live) continue;
        const a = sim.agents[e.agent];
        if (a) this.effects.adminArrive(new THREE.Vector3(a.x, a.y, a.z));
        this.callout(a === player && !this.spectator ? 'APPEAL GRANTED: back in the fight' : `${this.nameOf(e.agent)} appealed the ban!`);
        this.audio.fanfare();
      } else if (e.type === 'damage') {
        const victim = sim.agents[e.target];
        if (victim && e.attacker >= 0 && e.amount > 0) {
          this.hitLog.push({ t: sim.time, attacker: e.attacker, target: e.target, amount: e.amount, head: e.region === 'head', killed: e.killed, x: victim.x, y: victim.y, z: victim.z });
        }
        if (e.attacker === player.id && e.target !== player.id && !this.spectator) {
          this.hitMarkerAt = sim.time;
          this.hitMarkerKind = e.killed ? 'kill' : e.region === 'head' ? 'head' : 'hit';
          if (this.settings.hitSounds) this.audio.hitMarker(e.region === 'head', e.killed);
          if (this.settings.damageNumbers && e.amount > 0) this.damageNumber(e.target, e.amount, e.region === 'head', e.killed);
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
          weapon: e.cause === 'knife' && killer ? meleeDef(this.cosmetics[killer.id]?.melee).tag : causeTag(e.cause),
          killerIsPlayer: killer === player,
          killerAdmin: !!killer && this.cosmetics[killer.id]?.staff === 'admin',
          victimIsPlayer: victim === player,
          at: sim.time
        });
        if (this.feed.length > 6) this.feed.shift();
        const v = this.viewFor(victim);
        v.setVisible(true);
        if (live && killer && (this.cosmetics[killer.id]?.staff === 'admin' || this.confettiKills)) {
          this.effects.confetti(new THREE.Vector3(victim.x, victim.y, victim.z), this.cosmetics[killer.id]?.staff === 'admin');
          if (victim === player && this.cosmetics[killer.id]?.staff === 'admin') this.callout('Taken down by the Admin ♛');
        }
        v.die(victim, this.physics, sim.time, { distance: e.distance, melee: killer ? this.cosmetics[killer.id]?.melee : undefined });
        // The pool goes where the body ends up, once it has mostly landed.
        if (live && e.attacker >= 0 && this.match.mode !== 'paintball') this.pendingPools.push({ view: v, at: sim.time + 0.7, y: victim.y });
        // No killcam for wave enemies (zombies, survival) or labelled bots: nothing worth replaying.
        const waveEnemy = this.match.mode === 'zombies' || this.match.mode === 'survival';
        if (victim === player && e.attacker === player.id && !this.spectator && (e.cause === 'grenade' || e.cause === 'molotov' || e.cause === 'airstrike')) this.matchStats.ownGoals = (this.matchStats.ownGoals ?? 0) + 1;
        if (victim === player && killer && killer !== victim && !this.spectator && !this.practice && !waveEnemy && !this.isLabelledBot(killer)) {
          this.pendingKillcam = { at: sim.time + KILLCAM_DELAY, killer: killer.id, victim: victim.id, deathT: sim.time };
        }
        if (victim === player) {
          this.deathCamT = 0;
          this.deathsSinceKill++;
          this.lastKillerOfPlayer = killer ? killer.id : -1;
          this.killedBy = {
            name: killer ? this.nameOf(killer.id) : causeName(e.cause),
            color: killer ? cssColor(this.colorOf(killer.id)) : '#4fb3ff',
            weapon: e.cause === 'knife' && killer ? meleeDef(this.cosmetics[killer.id]?.melee).name : causeName(e.cause),
            distance: Math.round(e.distance),
            hp: e.attackerHp,
            headshot: e.region === 'head',
            card: killer ? (this.cosmetics[killer.id]?.card ?? 'recruit') : 'recruit',
            emblem: killer ? (this.cosmetics[killer.id]?.emblem ?? 'star') : 'star',
            level: killer ? this.levelOfAgent(killer) : 0,
            title: killer ? (this.cosmetics[killer.id]?.title ?? 'none') : 'none',
            frame: killer ? (this.cosmetics[killer.id]?.frame ?? 'none') : 'none',
            prestige: killer ? (this.cosmetics[killer.id]?.prestige ?? 0) : 0
          };
        }
        if (killer === player && victim !== player && !this.spectator && !this.practice) this.awardKill(e, victim);
        if (killer && !this.firstBlood) this.firstBlood = true;
        this.capRagdolls();
      } else if (e.type === 'stick' && e.kind === 'ball') {
        this.effects.puff(new THREE.Vector3(e.x, e.y, e.z));
      } else if (e.type === 'stick') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        const dir = new THREE.Vector3(e.dx, e.dy, e.dz);
        const kind = e.kind === 'spear' ? 'spear' : 'tknife';
        if (e.target >= 0) {
          this.views.get(e.target)?.stick(kind, at, dir);
          if (live && this.match.mode !== 'paintball') this.effects.blood(at, dir, e.region === 'head');
        } else {
          // Stuck in a wall or the floor for a while.
          const mesh = thrownModel(kind);
          mesh.position.copy(at).addScaledVector(dir, kind === 'spear' ? 0.2 : 0.05);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          this.scene.add(mesh);
          this.wallStuck.push({ mesh, until: sim.time + 15 });
          if (live) this.effects.impact(at, dir.clone().negate());
        }
        if (live) this.audio.knife();
      } else if (e.type === 'flash') {
        this.fxLog.push({ t: sim.time, type: 'flash', x: e.x, y: e.y, z: e.z, kind: '' });
        if (!live) continue;
        this.effects.flashBurst(new THREE.Vector3(e.x, e.y, e.z));
        this.audio.explosion(this.distTo(e.x, e.z) + 6, this.panTo(e.x, e.z));
        if (this.settings.access.visualSound) this.soundCue(e.x, e.z, 'boom', 40);
      } else if (e.type === 'shatter') {
        this.fxLog.push({ t: sim.time, type: 'shatter', x: e.x, y: e.y, z: e.z, kind: e.kind });
        if (!live) continue;
        this.effects.shatter(new THREE.Vector3(e.x, e.y, e.z), e.kind === 'molotov');
        this.audio.knife();
      } else if (e.type === 'explosion') {
        this.fxLog.push({ t: sim.time, type: 'explosion', x: e.x, y: e.y, z: e.z, kind: e.kind });
        const p = this.tmpA.set(e.x, e.y, e.z);
        if (live) {
          if (this.settings.access.visualSound) this.soundCue(e.x, e.z, 'boom', 60);
          this.effects.explosion(p, e.kind === 'airstrike');
          this.audio.explosion(this.distTo(e.x, e.z), this.panTo(e.x, e.z));
        }
        const d = this.distTo(e.x, e.z);
        if (live && !this.settings.access.reduceMotion) this.shake = Math.max(this.shake, Math.max(0, 1 - d / 25) * (e.kind === 'airstrike' ? 1 : 0.7));
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
        if (live && (a === player || this.distTo(a.x, a.z) < 12)) this.audio.knife();
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

  // ---------------------------------------------------------------- matchmade lobby

  private myLevel = levelOf(loadProfile().xp).level;

  /** Bot squads that queued together wear a shared clan tag. */
  private clanTags(): void {
    const TAGS = ['[GG]', '[OG]', '[TTV]', '[SWAT]', '[KOS]', '[NoX]', '[EZ]', '[RIP]', '[FaZz]', '[W33D]', '[MLG]', '[ACE]', '[VOID]', '[DUSK]'];
    const groups = new Map<number, Agent[]>();
    for (const a of this.match.sim.agents) {
      if (a === this.match.player || a.squad < 0) continue;
      // Battle-royale squads: only some of them are a clan.
      if (a.squad < 100 && (a.squad * 7919) % 10 > 3) continue;
      groups.set(a.squad, [...(groups.get(a.squad) ?? []), a]);
    }
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const tag = TAGS[Math.floor(Math.random() * TAGS.length)];
      for (const a of members) if (!this.ids.names[a.id].startsWith('[')) this.ids.names[a.id] = `${tag}${this.ids.names[a.id]}`.slice(0, 20);
    }
  }

  /**
   * Shown as "Bot N" with a BOT tag: computer players in rooms with friends,
   * the robotic bots that take over a leaver's slot, and practice dummies.
   */
  private isLabelledBot(a: Agent): boolean {
    const roomBots = !!this.net && !this.party && !this.isPublic;
    return (roomBots && a.control !== 'player' && a.control !== 'remote' && !this.isHumanId(a.id)) || a.robotic || !!a.dummy;
  }

  /** Public matchmaking with strangers: looks like any matchmade game (nobody is labelled). */
  private get isPublic(): boolean {
    return this.net?.role === 'client' ? !!this.net.start.public : this.net?.role === 'host' ? this.net.session.public : false;
  }

  /** Your prestige rank, for the scoreboard. */
  private myPrestige = loadProfile().prestige;

  /**
   * The style a soldier wears. Team modes keep the team colour readable: styles
   * that change the hue (rainbow, glitch...) pulse in the team colour instead.
   */
  private styleFor(a: Agent): string {
    const id = this.cosmetics[a.id]?.style ?? 'none';
    if (this.match.mode === 'paintball' || a.dummy) return 'none';
    return this.ids.teamColors && styleDef(id).hueShift ? 'pulse' : id;
  }

  /** Bullet tracer colour for a shooter (-1 = rainbow). */
  private tracerColor(id: number): number {
    const c = tracerDef(this.cosmetics[id]?.tracer ?? 'default').color;
    return c === 'rainbow' ? -1 : c;
  }

  /** Everything a player card needs about someone in this match. */
  cardOf(id: number): PlayerCardData | null {
    const a = this.match.sim.agents[id];
    if (!a || a.dummy) return null;
    const me = a === this.match.player && !this.spectator;
    const human = me || a.control === 'remote' || (this.net?.role === 'client' && this.net.start.humans.includes(a.id));
    const cos = this.cosmetics[a.id];
    return {
      name: this.nameOf(a.id),
      level: this.levelOfAgent(a),
      prestige: cos?.prestige ?? 0,
      cosmetics: cos ?? null,
      color: this.colorOf(a.id),
      favorite: a.weapons[0] ?? 'rifle',
      kind: me ? 'me' : human ? 'human' : this.isLabelledBot(a) ? 'labelled' : 'bot',
      account: this.accounts[a.id] ?? null,
      kills: a.kills,
      deaths: a.deaths,
      mode: this.match.def.name
    };
  }

  /** Movement course: the ground glows red (touch it and you go back), the start and finish pads green, and a beacon on each checkpoint. */
  private addCourseMarks(): void {
    const H = this.match.sim.arena.half;
    const flat = (w: number, d: number, color: number, opacity: number, x: number, z: number, y: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.renderOrder = 1;
      this.scene.add(m);
    };
    flat(H * 2, H * 2, 0xd32f3a, 0.35, 0, 0, 0.02);
    for (const b of [COURSE.start, COURSE.finish]) flat(b.maxX - b.minX, b.maxZ - b.minZ, 0x45d483, 0.55, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 0.03);
    for (const k of COURSE.checkpoints.slice(1)) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.6 }));
      beam.position.set(k.x + 2.4, k.h + 3, k.z);
      this.scene.add(beam);
    }
  }

  /** Movement course: keep the best time (and say if it's a new one). */
  private courseBest(time: number): void {
    const prof = loadProfile();
    const best = prof.stats.courseBest ?? 0;
    if (!best || time < best) {
      prof.stats.courseBest = Math.round(time * 100) / 100;
      saveProfile(prof);
      this.callout(best ? `New best! (was ${best.toFixed(2)} s)` : 'Best time set');
    }
  }

  /** How a campaign mission went (read straight from the match, practice modes included). */
  missionRun(): MissionRun {
    const m = this.match;
    const p = m.player;
    const won = this.myResult() === 'win';
    return {
      won,
      kills: p.kills,
      deaths: p.deaths,
      shots: p.shots,
      hits: p.hits,
      headshots: p.headshots,
      longestKill: Math.round(this.longestKill),
      seconds: Math.round(m.sim.time - m.startTime),
      wave: m.wave,
      courseTime: m.party.course.finished[p.id] ?? 0,
      medals: { ...this.medalCounts }
    };
  }

  /** Names of everyone in the match (for bot friends' after-match messages). */
  names(): string[] {
    return this.match.sim.agents.map((a) => this.nameOf(a.id));
  }

  /** Smurfs show a low level; everyone else's comes from their name. */
  private levelOfAgent(a: Agent): number {
    if (a === this.match.player && !this.spectator) return this.myLevel;
    const lvl = levelFor(this.nameOf(a.id));
    return a.smurf ? 1 + (lvl % 6) : lvl;
  }

  /** A believable weapon-mastery badge for other players (high levels more often). */
  private botMastery(a: Agent): string | null {
    if (a.dummy || a.robotic) return null;
    const lvl = this.levelOfAgent(a);
    const h = (a.id * 2654435761 + lvl * 97) % 100;
    if (lvl < 10 || h > lvl * 1.4) return null;
    const tier = Math.min(3, Math.floor(((h % 40) / 40) * (lvl / 14)));
    return masteryOf([25, 75, 200, 500][tier]).color;
  }

  /** Accessibility: remember a sound so the HUD can show an arrow toward it. */
  private soundCue(x: number, z: number, kind: 'shot' | 'step' | 'boom', range: number): void {
    const p = this.match.player;
    if (Math.hypot(x - p.x, z - p.z) > range) return;
    this.soundCues.push({ angle: wrapAngle(yawTo(this.camera.position.x, this.camera.position.z, x, z) - this.yaw), kind, at: this.match.sim.time });
    if (this.soundCues.length > 10) this.soundCues.shift();
  }

  // ---------------------------------------------------------------- night

  /** Dark sky and fog, a flashlight on your gun, and a few lights for other players' flashlights. */
  private setupNight(): void {
    const bg = new THREE.Color(0x070b16);
    this.scene.background = bg;
    const fog = this.scene.fog as THREE.Fog;
    fog.color = bg;
    this.arenaView.setNight(true);
    const fl = new THREE.SpotLight(0xfff4dd, 40, 45, 0.42, 0.45, 1.6);
    fl.position.set(0.15, -0.1, 0);
    fl.target.position.set(0, 0, -5);
    this.camera.add(fl, fl.target);
    this.flashlight = fl;
    for (let i = 0; i < 3; i++) {
      const l = new THREE.SpotLight(0xfff4dd, 0, 35, 0.4, 0.5, 1.6);
      this.scene.add(l, l.target);
      this.otherLights.push(l);
    }
  }

  /** Other players' flashlights: a visible beam for everyone, real light for the three closest. */
  private updateNight(): void {
    const sim = this.match.sim;
    const cam = this.camera.position;
    const lit = sim.agents.filter((a) => a.alive && a.id !== this.specShown && (a !== this.match.player || this.spectator)).sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z));
    const fwd = new THREE.Vector3();
    const shown = new Set<number>();
    lit.forEach((a, i) => {
      const v = this.views.get(a.id);
      if (!v) return;
      const from = v.muzzle(new THREE.Vector3());
      fwd.set(Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), Math.cos(a.yaw) * Math.cos(a.pitch));
      if (i < this.otherLights.length) {
        const l = this.otherLights[i];
        l.intensity = 30;
        l.position.copy(from);
        l.target.position.copy(from).addScaledVector(fwd, 6);
      }
      if (i < 14) {
        let beam = this.beams.get(a.id);
        if (!beam) {
          const geo = new THREE.ConeGeometry(1.1, 7, 16, 1, true);
          geo.translate(0, -3.5, 0);
          beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          this.scene.add(beam);
          this.beams.set(a.id, beam);
        }
        beam.visible = true;
        beam.position.copy(from);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), fwd);
        shown.add(a.id);
      }
    });
    for (let i = lit.length; i < this.otherLights.length; i++) this.otherLights[i].intensity = 0;
    for (const [id, b] of this.beams) if (!shown.has(id)) b.visible = false;
    if (this.flashlight) this.flashlight.intensity = this.match.player.alive || this.killcam || this.specShown >= 0 ? 40 : 0;
  }

  /** Rebuilds a soldier's view so its nametag shows a new name. */
  private refreshTag(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    v.dispose();
    this.views.delete(id);
  }

  /** Feed line for something other than a kill. */
  private systemLine(text: string): void {
    const sim = this.match.sim;
    this.feed.push({ id: this.feedId++, killer: '', victim: '', headshot: false, weapon: '', killerColor: '', victimColor: '', killerIsPlayer: false, victimIsPlayer: false, at: sim.time, system: text });
    if (this.feed.length > 6) this.feed.shift();
  }

  /**
   * Matchmade lobbies behave like public servers: pings drift, and every
   * minute or two someone who just died quits and a new player takes the slot
   * a few seconds later.
   */
  private updateLobby(): void {
    const m = this.match;
    const sim = m.sim;
    if (sim.time - this.pingT > 1) {
      this.pingT = sim.time;
      for (const a of sim.agents) {
        const base = a === m.player ? 22 + (this.myLevel % 18) : basePingFor(this.nameOf(a.id));
        const prev = this.pings.get(a.id) ?? base;
        // Drift around the base, with the odd spike.
        const spike = Math.random() < 0.03 ? 40 + Math.random() * 80 : 0;
        this.pings.set(a.id, Math.max(8, Math.round(prev + (base - prev) * 0.5 + (Math.random() - 0.5) * 8 + spike)));
      }
    }
    // Late in a long match someone goes properly AFK for a while (food, phone, door...).
    const goal = m.goal(m.mode);
    if (!this.lateAfkDone && goal && m.allowsChurn) {
      const progress = m.def.teams ? Math.max(...m.scores) / goal : Math.max(...sim.agents.map((a) => a.kills)) / goal;
      if (progress > 0.6) {
        this.lateAfkDone = true;
        const pool = sim.agents.filter((a) => a !== m.player && !a.robotic && a.alive);
        const a = pool[Math.floor(Math.random() * pool.length)];
        if (a && Math.random() < 0.35) {
          a.afkUntil = sim.time + 20 + Math.random() * 25;
          a.afkDeep = true;
        }
      }
    }
    if (!m.allowsChurn || sim.time < this.nextChurn || this.quits >= 2) return;
    this.nextChurn = sim.time + 20;
    // Rage quits are rare: only someone whose side is getting crushed, right after dying.
    const quitters = sim.agents.filter((a) => a !== m.player && !a.robotic && !a.alive && sim.time - a.deathT < 3 && this.hopeless(a));
    const q = quitters[Math.floor(Math.random() * quitters.length)];
    if (!q || Math.random() > 0.2) return;
    // Nobody joins mid-match: a labelled, robotic bot takes the slot for the rest of the game.
    const left = this.nameOf(q.id);
    const bot = `Bot ${++this.botCount}`;
    m.resetSlot(q);
    q.robotic = true;
    this.ids.names[q.id] = bot;
    this.ids.skins[q.id] = null;
    this.quits++;
    this.systemLine(`${left} left · ${bot} took over`);
  }

  /**
   * Losing so badly that a comeback is close to impossible: in team modes the
   * other team is well on the way to winning and far ahead; in free-for-all the
   * leader is close to winning and this player is near the bottom.
   */
  private hopeless(a: Agent): boolean {
    const m = this.match;
    const goal = m.goal(m.mode);
    if (!goal) return false;
    if (m.def.teams) {
      const mine = m.scores[a.team as 0 | 1];
      const theirs = m.scores[a.team === 0 ? 1 : 0];
      return theirs >= goal * 0.6 && theirs - mine >= goal * 0.45;
    }
    const leader = Math.max(...m.sim.agents.filter((b) => b !== a).map((b) => b.kills));
    return leader >= goal * 0.6 && a.kills <= leader * 0.25 && a.deaths >= a.kills + 6;
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
    if (isBrMode(m.mode)) return m.winTeam === m.player.team ? 'win' : 'lose';
    if (m.mode === 'survival') return 'lose';
    return m.winTeam === m.player.team ? 'win' : 'lose';
  }

  private myBanner(): string {
    const m = this.match;
    const sim = m.sim;
    if (m.phase === 'over' && this.net?.role === 'client') {
      const win = this.myResult() === 'win';
      if (isBrMode(m.mode)) return win ? 'Winner winner!' : 'Eliminated';
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
        alive: a.alive,
        aiming: a.aiming,
        reloadDur: a.reloadDur,
        hp: a.hp,
        ammo: a.ammo,
        streak: a.streak,
        onGround: a.onGround,
        weapons: a.weapons,
        slot: a.slot,
        grenades: a.grenades,
        tacticals: a.tacticals,
        kills: a.kills,
        deaths: a.deaths
      })),
      world: {
        fields: sim.fields.map((f) => ({ kind: f.kind, x: f.x, z: f.z, r: f.r, until: f.until })),
        grenades: sim.grenades.map((g) => ({ kind: g.kind, x: g.x, y: g.y, z: g.z, vx: g.vx, vy: g.vy, vz: g.vz }))
      }
    });
    const keep = sim.time - (KILLCAM_BEFORE + KILLCAM_AFTER + KILLCAM_DELAY + 1);
    while (this.history.length && this.history[0].t < keep) this.history.shift();
    while (this.shotLog.length && this.shotLog[0].t < keep) this.shotLog.shift();
    while (this.hitLog.length && this.hitLog[0].t < keep) this.hitLog.shift();
    while (this.fxLog.length && this.fxLog[0].t < keep) this.fxLog.shift();
  }

  /** Recorded smoke, fire and throwables nearest to time `t`. */
  private worldAt(t: number): WorldSnap | null {
    const h = this.history;
    if (!h.length) return null;
    const i = h.findIndex((f) => f.t >= t);
    return h[i < 0 ? h.length - 1 : i].world;
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
    const killerTeam = sim.agents[kc.killer]?.team ?? -1;
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
        ghost = new SoldierView(this.assets, { ...a, life: -1 }, this.colorOf(a.id), this.ids.skins[a.id] ?? {}, this.cosmetics[a.id]?.charm ?? 'none', meleeDef(this.cosmetics[a.id]?.melee).id);
        // Dressed and tagged as the killer saw them.
        ghost.setStyle(this.styleFor(a), this.colorOf(a.id));
        const cos = this.cosmetics[a.id];
        const title = cos && cos.title !== 'none' ? titleDef(cos.title).text : null;
        ghost.setNameTag(this.nameOf(a.id), cssColor(this.colorOf(a.id)), a.team === killerTeam, cos?.nametag ?? 'plain', title);
        this.scene.add(ghost.root);
        kc.ghosts.set(a.id, ghost);
      }
      ghost.setVisible(true);
      const fake = { ...a, ...s, weapons: [s.weapon], slot: 0, alive: true, meleeCd: 0 };
      const ghostDist = Math.hypot(s.x - killer.x, s.z - killer.z);
      // Teammates' tags always show; enemies' only when the killer could see them.
      const tagShown =
        a.team === killerTeam || (ghostDist < 45 && sim.arena.lineOfSight(killer.x, killer.y + eyeHeight(killer), killer.z, s.x, s.y + 1.7, s.z));
      ghost.showTag(s.alive && tagShown, ghostDist);
      if (a.id === kc.victim && !kc.victimDead && kc.clock >= kc.deathT) {
        kc.victimDead = true;
        ghost.die({ ...a, ...s }, this.physics, sim.time, { distance: Math.hypot(s.x - killer.x, s.z - killer.z), melee: this.cosmetics[kc.killer]?.melee });
      }
      ghost.update(fake, s.x, s.y, s.z, dt, kc.clock);
    }
    for (const [id, g] of kc.ghosts) if (!shown.has(id) && !g.ragdoll) g.setVisible(false);

    const eye = eyeHeight(killer);
    this.camera.position.set(killer.x, killer.y + eye, killer.z);
    this.camera.rotation.set(killer.pitch, killer.yaw + Math.PI, 0);
    const kw = WEAPONS[killer.weapon];
    const zoom = kw.scope ? Math.max(0, this.settings.fov - 20) : kw.adsFov;
    const kcFov = this.settings.fov - this.viewmodel.adsAmount * zoom;
    if (Math.abs(this.camera.fov - kcFov) > 0.01) {
      this.camera.fov = kcFov;
      this.camera.updateProjectionMatrix();
    }
    if (killer.weapon !== this.lastWeapon) {
      this.lastWeapon = killer.weapon;
      this.viewmodel.setWeapon(killer.weapon, this.ids.skins[kc.killer] ?? {}, this.cosmetics[kc.killer]?.charm ?? 'none', meleeDef(this.cosmetics[kc.killer]?.melee).id);
    }
    // The killer's hits: hit markers, the tick and damage numbers, as they saw them.
    for (const h of this.hitLog) {
      if (h.t <= prev || h.t > kc.clock || h.attacker !== kc.killer) continue;
      this.hitMarkerAt = sim.time;
      this.hitMarkerKind = h.killed ? 'kill' : h.head ? 'head' : 'hit';
      if (this.settings.hitSounds) this.audio.hitMarker(h.head, h.killed);
      if (this.settings.damageNumbers) this.damageNumber(h.target, h.amount, h.head, h.killed, h);
    }
    // Replay the shots fired in this slice of time: tracers, flashes, impacts, blood and hit reactions.
    const paintball = this.match.mode === 'paintball';
    for (const sh of this.shotLog) {
      if (sh.t <= prev || sh.t > kc.clock) continue;
      const end = new THREE.Vector3(sh.ex, sh.ey, sh.ez);
      let from: THREE.Vector3;
      if (sh.shooter === kc.killer) {
        from = this.camera.localToWorld(this.viewmodel.muzzleLocal(new THREE.Vector3()));
        if (sh.first) {
          this.viewmodel.fire();
          this.audio.gunshot(0, 0, true, killer.weapon);
        }
      } else {
        const g = kc.ghosts.get(sh.shooter);
        if (!g || !g.root.visible) continue;
        from = g.muzzle(new THREE.Vector3());
        if (sh.first) {
          const fl = flashDef(this.cosmetics[sh.shooter]?.flash ?? 'default');
          this.effects.muzzleFlash(from, true, fl.scale, fl.color);
          this.audio.gunshot(this.distTo(from.x, from.z), this.panTo(from.x, from.z), false, sh.weapon);
        }
      }
      this.effects.tracer(from, end, this.tracerColor(sh.shooter));
      const paint = paintball ? this.colorOf(sh.shooter) : 0;
      if (sh.world) {
        const n = new THREE.Vector3(sh.world.nx, sh.world.ny, sh.world.nz);
        if (paintball) this.effects.paint(end, n, paint);
        else this.effects.impact(end, n);
      }
      if (sh.hit >= 0) {
        const dir = new THREE.Vector3(sh.ex - sh.ox, sh.ey - sh.oy, sh.ez - sh.oz).normalize();
        if (paintball) this.effects.paint(end, dir.clone().negate(), paint);
        else this.effects.blood(end, dir, sh.region === 'head');
        const g = kc.ghosts.get(sh.hit);
        const vs = this.snapAt(sh.hit, sh.t);
        if (g && vs) {
          const side = Math.sign(Math.sin(wrapAngle(Math.atan2(dir.x, dir.z) - vs.yaw))) || 1;
          const w = WEAPONS[sh.weapon];
          g.hit(side, sh.region, THREE.MathUtils.clamp((w.damage.torso * w.pellets) / 40, 0.5, 1.5), dir.x, dir.z);
        }
      }
    }
    // Explosions, flashbangs and shattering molotovs from the same moment.
    for (const fx of this.fxLog) {
      if (fx.t <= prev || fx.t > kc.clock) continue;
      const at = new THREE.Vector3(fx.x, fx.y, fx.z);
      if (fx.type === 'explosion') {
        this.effects.explosion(at, fx.kind === 'airstrike');
        this.audio.explosion(this.distTo(fx.x, fx.z), this.panTo(fx.x, fx.z));
      } else if (fx.type === 'flash') {
        this.effects.flashBurst(at);
        this.audio.explosion(this.distTo(fx.x, fx.z) + 6, this.panTo(fx.x, fx.z));
      } else {
        this.effects.shatter(at, fx.kind === 'molotov');
      }
    }
    this.viewmodel.update(dt, {
      speed: Math.hypot(killer.vx, killer.vz),
      aiming: killer.aiming,
      sprinting: killer.sprinting,
      reload: killer.reloadT > 0 && killer.reloadDur > 0 ? 1 - killer.reloadT / killer.reloadDur : 0,
      switching: 0,
      onGround: killer.onGround,
      lookDX: 0,
      lookDY: 0,
      visible: true,
      scope: kw.scope
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

  /** Does a shot's line pass within 1.6 m of the player's head (without hitting them)? */
  private nearMiss(e: { ox: number; oy: number; oz: number; ex: number; ey: number; ez: number }, p: Agent): boolean {
    const hx = p.x, hy = p.y + eyeHeight(p), hz = p.z;
    const dx = e.ex - e.ox, dy = e.ey - e.oy, dz = e.ez - e.oz;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1) return false;
    const t = Math.max(0, Math.min(1, ((hx - e.ox) * dx + (hy - e.oy) * dy + (hz - e.oz) * dz) / len2));
    return Math.hypot(e.ox + dx * t - hx, e.oy + dy * t - hy, e.oz + dz * t - hz) < 1.6;
  }

  private panTo(x: number, z: number): number {
    return -Math.sin(wrapAngle(yawTo(this.camera.position.x, this.camera.position.z, x, z) - this.yaw));
  }

  private medal(m: Medal): void {
    const sim = this.match.sim;
    const key = (Object.keys(MEDALS) as (keyof typeof MEDALS)[]).find((k) => MEDALS[k] === m);
    if (key) this.medalCounts[key] = (this.medalCounts[key] ?? 0) + 1;
    // Double XP weekend (an admin event).
    const xp = m.xp * (this.doubleXp ? 2 : 1);
    this.xp += xp;
    this.medals.push({ id: this.medalId++, name: say(m.name), xp, big: !!m.big, at: sim.time });
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
    if (WEAPONS[e.cause as WeaponId]) {
      // Knife kills count toward the melee in hand, which has its own camos.
      const w = camoKey(e.cause, this.settings.cosmetics.melee);
      this.weaponKills[w] = (this.weaponKills[w] ?? 0) + 1;
      const total = (this.baseWeaponKills[w] ?? 0) + this.weaponKills[w];
      const name = e.cause === 'knife' ? meleeDef(w).name : WEAPONS[e.cause as WeaponId].name;
      // Several camos can unlock at the same kill count; name them all.
      const unlocked = SKINS.filter((s) => s.kills > 0 && s.kills === total).map((s) => s.name);
      if (unlocked.length) this.callout(`Unlocked: ${unlocked.join(' and ')} ${unlocked.length > 1 ? 'camos' : 'camo'} for the ${name}`);
    }
    if (gun && e.region === 'head') this.medal(MEDALS.headshot);
    if (e.cause === 'knife') this.medal(MEDALS.knife);
    if (e.cause === 'grenade') this.medal(MEDALS.frag);
    if (e.cause === 'airstrike') this.medal(MEDALS.airstrike);
    if (gun && e.distance > 35) this.medal(MEDALS.longshot);
    const bump = (k: StatKey) => (this.matchStats[k] = (this.matchStats[k] ?? 0) + 1);
    if (gun && e.region === 'head') bump('headshots');
    if (e.cause === 'knife') bump('knifeKills');
    if (e.cause === 'tknife' || e.cause === 'spear') bump('throwKills');
    if (e.cause === 'grenade') bump('fragKills');
    if (e.cause === 'molotov') bump('molotovKills');
    if (gun && e.distance > 35) bump('longshots');
    if (gun) this.longestKill = Math.max(this.longestKill, e.distance);
    if (gun && !player.onGround) bump('airKills');
    if (e.cause === 'knife' && player.crouching) bump('crouchKnives');
    if (gun && player.ammo === 0 && player.alive) bump('lastBullet');
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
    if (chain === 3) this.matchStats.tripleKills = (this.matchStats.tripleKills ?? 0) + 1;
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
        if (n.id === 'nuke' && n.agent === me && !this.spectator) this.matchStats.nukes = (this.matchStats.nukes ?? 0) + 1;
        if (n.id === 'nuke') {
          this.callout(n.agent === me && !this.spectator ? 'TACTICAL NUKE INCOMING' : `${this.nameOf(n.agent)} called in a Tactical Nuke!`);
          this.audio.whistle();
          continue;
        }
        if (n.agent !== me || this.spectator) continue;
        const lines: Record<string, string> = {
          adrenaline: 'Adrenaline: full health and faster movement',
          uav: 'UAV online: enemies shown on your minimap',
          supply: 'Supply drop: health, ammo and grenades refilled',
          counter: 'Counter-UAV: enemy minimaps jammed',
          airstrike: 'Airstrike inbound!',
          cluster: 'Cluster strike inbound!',
          jugg: 'Juggernaut armour equipped',
          godview: 'God View: every enemy on your team’s map',
          banwave: 'BAN WAVE incoming',
          restart: 'Server Restart: the enemy is reconnecting…'
        };
        this.callout(lines[n.id] ?? `${n.name}!`);
        this.audio.fanfare();
      } else if (n.kind === 'cranked') {
        if (n.agent !== me) continue;
        if (n.event === 'cranked') this.callout('CRANKED! Get a kill every 30 s or explode');
        this.audio.whistle();
      } else if (n.kind === 'boss') {
        if (n.event === 'phase') this.callout(n.phase === 1 ? 'The boss is calling in airstrikes!' : 'The boss called for backup!');
        if (n.event === 'down') this.callout('The boss is down!');
        this.audio.fanfare();
      } else if (n.kind === 'defender') {
        if (n.event === 'taken') this.callout(n.agent === me ? 'You have the flag! Your kills count double' : n.team === m.player.team ? `${this.nameOf(n.agent)} grabbed the flag` : 'The enemy has the flag');
        else this.callout(n.team === m.player.team ? 'Your team dropped the flag' : 'The enemy dropped the flag');
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
      } else if (n.kind === 'frozen') {
        if (n.by === me) this.medal(MEDALS.freeze);
        if (n.agent === me) this.callout('You are frozen! A teammate can thaw you.');
      } else if (n.kind === 'thawed') {
        if (n.by.includes(me)) this.medal(MEDALS.thaw);
        if (n.agent === me) this.callout('Thawed! Back in the fight.');
      } else if (n.kind === 'vip') {
        if (n.agent === me) {
          this.callout('You are the VIP! Stay alive.');
          this.audio.fanfare();
        } else this.callout(n.team === m.player.team ? `${this.nameOf(n.agent)} is your VIP. Protect them!` : `New enemy VIP: ${this.nameOf(n.agent)}`);
      } else if (n.kind === 'vipkill') {
        if (n.by === me) this.medal(MEDALS.vipKill);
        else this.callout(n.team === m.player.team ? 'Enemy VIP down!' : 'Your VIP was killed');
      } else if (n.kind === 'snd') {
        if (n.event === 'planted') {
          if (n.by === me) this.medal(MEDALS.planted);
          this.audio.whistle();
        } else if (n.event === 'defused') {
          if (n.by === me) this.medal(MEDALS.defused);
        } else if (n.event === 'pickup' && n.by === me) this.callout('You picked up the bomb');
        else if (n.event === 'dropped') this.callout('The bomb was dropped');
      } else if (n.kind === 'jugg') {
        this.callout(n.agent === me ? 'You are the Juggernaut!' : `${this.nameOf(n.agent)} is the Juggernaut`);
        if (n.agent === me) this.audio.fanfare();
      } else if (n.kind === 'sharp') {
        this.callout(`New weapon: ${WEAPONS[n.weapon].name}`);
        this.audio.weaponSwitch();
      } else if (n.kind === 'bolt') {
        if (this.killcam) continue;
        const at = this.tmpB.set(n.x, 0, n.z);
        this.effects.bolt(at);
        this.audio.explosion(this.distTo(n.x, n.z), this.panTo(n.x, n.z));
        if (!this.settings.access.reduceMotion) this.shake = Math.max(this.shake, Math.max(0, 1 - this.distTo(n.x, n.z) / 30) * 0.6);
      } else if (n.kind === 'restart') {
        if (n.team !== m.player.team && !this.spectator) this.audio.whistle();
      } else if (n.kind === 'tagit') {
        if (n.holder === me) {
          this.callout(n.from >= 0 ? `${this.nameOf(n.from)} tagged you. YOU'RE IT!` : "YOU'RE IT! Hit someone to pass it on");
          this.audio.whistle();
        } else if (n.from === me) this.callout(`Tagged ${this.nameOf(n.holder)}! Run!`);
        else this.callout(`${this.nameOf(n.holder)} is IT`);
      } else if (n.kind === 'course') {
        if (n.agent === me) {
          const t = `${n.time.toFixed(2)} s`;
          if (n.finished) {
            this.callout(`Finished in ${t}`);
            this.audio.fanfare();
            if (m.mode === 'course') this.courseBest(n.time);
          } else {
            this.callout(`${n.name} · ${t}`);
            this.audio.medal();
          }
        } else if (n.finished) this.callout(`${this.nameOf(n.agent)} finished in ${n.time.toFixed(2)} s`);
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
    if (m.phase === 'over' && !this.xpBanked && (this.spectator || this.practice)) {
      this.xpBanked = true;
      // Aim trainer: keep the best score.
      if (m.mode === 'aimtrainer' && m.player.kills > m.party.aimBest) {
        try {
          localStorage.setItem('fps-aim-best', String(m.player.kills));
          const prof = loadProfile();
          prof.stats.aimBest = Math.max(prof.stats.aimBest ?? 0, m.player.kills);
          saveProfile(prof);
        } catch {
          /* no storage */
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
      // Lifetime stats and badges.
      const levelBefore = levelOf(prof.xp - this.xp).level;
      const before = new Set(BADGES.filter((b) => earned(b, { ...prof, xp: prof.xp - this.xp, kills: prof.kills - m.player.kills, wins: prof.wins - (won ? 1 : 0), matches: prof.matches - 1 }, levelBefore)).map((b) => b.id));
      const st = prof.stats;
      for (const [k, v] of Object.entries(this.matchStats)) st[k as StatKey] = (st[k as StatKey] ?? 0) + (v ?? 0);
      st.bestStreak = Math.max(st.bestStreak ?? 0, m.player.bestStreak);
      if (won && m.player.deaths === 0 && m.player.kills >= 5) st.flawlessWins = (st.flawlessWins ?? 0) + 1;
      if (won && m.mode === 'br') st.brWins = (st.brWins ?? 0) + 1;
      if (won && (m.mode === 'br_duos' || m.mode === 'br_trios')) st.squadWins = (st.squadWins ?? 0) + 1;
      if (won && m.mode === 'boss') st.bossWins = (st.bossWins ?? 0) + 1;
      if (won && m.mode === 'paintball') st.paintballWins = (st.paintballWins ?? 0) + 1;
      // Career totals.
      const pl = m.player;
      const add = (k: StatKey, v: number) => (st[k] = (st[k] ?? 0) + v);
      const max = (k: StatKey, v: number) => (st[k] = Math.max(st[k] ?? 0, v));
      add('damage', Math.round(pl.damageDealt));
      add('shots', pl.shots);
      add('hits', pl.hits);
      add('seconds', Math.round(m.sim.time));
      add('meters', Math.round(this.meters));
      max('longestKill', Math.round(this.longestKill));
      max('bestMatchKills', pl.kills);
      if (pl.kills >= 10 && pl.shots > 0 && pl.hits / pl.shots >= 0.5) add('accurateMatches', 1);
      if (m.mode === 'zombies') max('zombieWave', m.wave);
      if (m.mode === 'survival') max('survivalWave', m.wave);
      if (won && pl.kills === 0) add('noKillWins', 1);
      const hour = new Date().getHours();
      if (hour < 4) add('nightOwl', 1);
      if (hour >= 5 && hour < 7) add('earlyBird', 1);
      max('friends', botFriends().filter((f) => f.state === 'friends').length + realFriendCount);
      prof.medals = { ...(prof.medals ?? {}) };
      for (const [k, n] of Object.entries(this.medalCounts)) prof.medals[k] = (prof.medals[k] ?? 0) + n;
      prof.modes = { ...(prof.modes ?? {}) };
      const mm = prof.modes[m.mode] ?? { played: 0, won: 0 };
      prof.modes[m.mode] = { played: mm.played + 1, won: mm.won + (won ? 1 : 0) };
      const matchWeapons = { ...this.weaponKills };
      for (const [w, k] of Object.entries(this.weaponKills)) prof.weaponKills[w] = (prof.weaponKills[w] ?? 0) + k;
      this.weaponKills = {};
      const levelAfter = levelOf(prof.xp).level;
      this.newBadges = BADGES.filter((b) => !before.has(b.id) && earned(b, prof, levelAfter)).map((b) => b.id);
      const newTitles = claimCollections(prof, levelAfter);
      saveProfile(prof);
      this.summary = {
        xp: this.xp,
        medals: Object.entries(this.medalCounts)
          .map(([k, count]) => {
            const md = MEDALS[k as keyof typeof MEDALS];
            return { name: say(md.name), count, xp: md.xp * count * (this.doubleXp ? 2 : 1) };
          })
          .sort((a, b) => b.xp - a.xp),
        kills: pl.kills,
        deaths: pl.deaths,
        damage: Math.round(pl.damageDealt),
        shots: pl.shots,
        hits: pl.hits,
        headshots: pl.headshots,
        bestStreak: pl.bestStreak,
        longestKill: Math.round(this.longestKill),
        meters: Math.round(this.meters),
        seconds: Math.round(m.sim.time),
        weapons: Object.entries(matchWeapons)
          .map(([w, kills]) => ({ name: WEAPONS[w as WeaponId]?.name ?? meleeDef(w).name, kills }))
          .sort((a, b) => b.kills - a.kills),
        newTitles,
        doubleXp: this.doubleXp
      };
    }
  }

  /** Blood pools waiting for their bodies to land, and the round number last seen (for clean-up). */
  private pendingPools: { view: SoldierView; at: number; y: number }[] = [];
  private seenRound = -1;
  private _hips = new THREE.Vector3();

  private updatePools(): void {
    const m = this.match;
    // A new round starts on a clean map: no bodies, blood, bullet holes or scorch marks.
    // Paintball keeps its paint: the mess is half the fun.
    if (m.round !== this.seenRound) {
      if (this.seenRound >= 0 && m.mode !== 'paintball') {
        this.effects.clearMarks();
        this.pendingPools = [];
        for (const [id, v] of this.views) {
          if (!v.ragdoll) continue;
          v.dispose();
          this.views.delete(id);
        }
      }
      this.seenRound = m.round;
    }
    if (!this.pendingPools.length) return;
    const now = m.sim.time;
    this.pendingPools = this.pendingPools.filter((p) => {
      if (now < p.at) return true;
      if (p.view.ragdoll) {
        p.view.ragdoll.getHipsWorldPosition(this._hips);
        this.effects.bloodPool(this._hips.x, p.y, this._hips.z);
      }
      return false;
    });
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

  private _sphere = new THREE.Sphere();
  /**
   * Simplified soldiers: whether this soldier gets a full pose this frame.
   * Out of view: no (it still moves, and catches up when seen).
   */
  private needsPose(a: Agent, x: number, y: number, z: number): boolean {
    if (a.id === this.specShown || this.killcam) return true;
    this._sphere.center.set(x, y + 1, z);
    this._sphere.radius = 1.6 * a.scale;
    // Everyone on screen poses every frame: skipping frames for distant soldiers read as robotic, choppy movement.
    return this.frustum.intersectsSphere(this._sphere);
  }

  /**
   * Auto quality: if a match keeps running below ~40 fps, step the preset down
   * (High -> Medium -> Low, then a lower resolution) and save it. Only slow
   * devices ever trigger this; picking a preset yourself turns it off.
   */
  private watchFrameRate(dt: number): void {
    const s = this.settings;
    // Real time, not game time: game time is capped per frame, so on a very slow device it would barely move.
    const now = performance.now();
    const real = Math.min(1, (now - this.watchAt) / 1000);
    this.watchAt = now;
    if (!s.autoQuality || this.paused || dt <= 0 || this.killcam || this.match.phase === 'over') return;
    this.qualityWatch += real;
    // Let loading hitches settle first.
    if (this.qualityWatch < 4) return;
    // Frame rate over 2-second windows.
    this.watchWindow += real;
    this.watchFrames++;
    if (this.watchWindow < 2) return;
    const fps = this.watchFrames / this.watchWindow;
    const span = this.watchWindow;
    this.watchWindow = 0;
    this.watchFrames = 0;
    const target = s.fpsLimit > 0 ? Math.min(40, s.fpsLimit * 0.8) : 40;
    if (fps < target) this.slowFor += span;
    else this.slowFor = Math.max(0, this.slowFor - span);
    if (this.slowFor < 6) return;
    this.slowFor = 0;
    this.qualityWatch = 0;
    const next = lowerQuality(s.quality);
    let changed: GameSettings | null = null;
    if (next) changed = { ...s, quality: next, graphics: { ...QUALITY_PRESETS[next] } };
    else if (s.graphics.renderScale > 0.45 || !s.graphics.simpleSoldiers) changed = { ...s, graphics: { ...s.graphics, renderScale: 0.45, simpleSoldiers: true } };
    if (!changed) return;
    this.applySettings(changed);
    this.onSettings?.(changed);
    this.callout(next ? `Graphics lowered to ${next[0].toUpperCase()}${next.slice(1)} to keep the game smooth` : 'Resolution lowered to keep the game smooth');
  }

  private renderFrame(dt: number, alpha: number): void {
    this.watchFrameRate(dt);
    const sim = this.match.sim;
    const player = this.match.player;
    const time = sim.time;

    const simple = this.settings.graphics.simpleSoldiers;
    if (simple) {
      this.frustum.setFromProjectionMatrix(this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    }
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
      // The player's own body is only shown once it is a corpse (and nobody's while we look through their eyes).
      v.setVisible(((a !== player || this.spectator) && a.id !== this.specShown) || !a.alive);
      const frozen = sim.isFrozen(a);
      v.setFrozen(frozen);
      if (dt > 0 || a !== player) {
        if (simple && a.alive && a !== player && !this.needsPose(a, x, y, z)) v.follow(a, x, y, z, frozen ? 0 : dt);
        else v.update(a, x, y, z, frozen ? 0 : dt, time);
      }
      if (a !== player) v.showTag(a.alive && this.tagVisible(a), this.camera.position.distanceTo(v.root.position));
      // Footsteps: one per stride, louder when sprinting, silent when crouched.
      if (a.alive && a.onGround && dt > 0) {
        const speed = Math.hypot(a.vx, a.vz);
        const stride = (this.stride.get(a.id) ?? 0) + speed * dt;
        const len = a.sprinting ? 2.2 : 1.7;
        if (stride > len) {
          this.stride.set(a.id, 0);
          const vol = a.crouching ? 0 : a.sprinting ? 1 : 0.6;
          if (a === player && !this.spectator) this.audio.footstep(0.5, 0, vol * 0.5);
          else if (vol > 0) {
            const d = this.distTo(a.x, a.z);
            if (d < 30 && !hasPerk(a, 'ninja')) {
              this.audio.footstep(d, this.panTo(a.x, a.z), vol);
              if (this.settings.access.visualSound && a.team !== player.team && d < 18) this.soundCue(a.x, a.z, 'step', 18);
            }
          }
        } else this.stride.set(a.id, stride);
      }
    }

    // Throwables in flight: knives and spears point along their flight, the rest tumble.
    // During the killcam they come from the recording, like the smoke and fire below.
    const replayWorld = this.killcam ? this.worldAt(this.killcam.clock) : null;
    const thrown = replayWorld ? replayWorld.grenades : sim.grenades;
    const worldTime = this.killcam ? this.killcam.clock : sim.time;
    thrown.forEach((g, i) => {
      let slot = this.thrownMeshes[i];
      if (!slot || slot.kind !== g.kind) {
        if (slot) this.grenadeGroup.remove(slot.mesh);
        slot = { kind: g.kind, mesh: thrownModel(g.kind) };
        this.grenadeGroup.add(slot.mesh);
        this.thrownMeshes[i] = slot;
      }
      const m = slot.mesh;
      m.visible = true;
      m.position.set(g.x, g.y, g.z);
      if (g.kind === 'tknife' || g.kind === 'spear') {
        const v = this.tmpB.set(g.vx, g.vy, g.vz);
        if (v.lengthSq() > 0.01) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
        // A thrown knife spins end over end.
        if (g.kind === 'tknife') m.rotateX(worldTime * 25);
      } else {
        m.rotation.x += dt * 8;
        m.rotation.z += dt * 5;
      }
    });
    for (let i = thrown.length; i < this.thrownMeshes.length; i++) this.thrownMeshes[i].mesh.visible = false;
    // Smoke clouds and fires, and thrown knives fading out of walls.
    this.effects.syncFields(replayWorld ? replayWorld.fields : sim.fields, worldTime);
    for (let i = this.wallStuck.length - 1; i >= 0; i--) {
      if (sim.time < this.wallStuck[i].until) continue;
      this.scene.remove(this.wallStuck[i].mesh);
      this.wallStuck.splice(i, 1);
    }
    if (this.night) this.updateNight();

    tickSkins(time);
    const inKillcam = this.updateKillcam(dt);
    const spec = inKillcam ? null : this.spectateTarget();
    this.specShown = spec ? spec.id : -1;
    // Camera.
    if (inKillcam) {
      // The killcam drives the camera and viewmodel.
    } else if (spec) {
      this.spectateCamera(spec, dt, alpha);
    } else if (player.alive && !this.spectator) {
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
      const roll = player.slideT > 0 && !this.settings.access.reduceMotion ? 0.08 : 0;
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

    if (!inKillcam && !spec) this.updateViewmodel(dt);
    this.updateDamageNumbers(time);
    this.lookDX = 0;
    this.lookDY = 0;
    this.arenaView.update(time, this.camera.position);
    this.updatePools();
    const me = this.match.player;
    if (me.alive && !this.spectator && me.hp < 30 && this.match.phase !== 'over' && time - this.lastBeat > 0.85) {
      this.lastBeat = time;
      this.audio.heartbeat();
    }
    if (me.alive && !this.spectator) {
      if (this.lastPos) {
        const d = Math.hypot(me.x - this.lastPos.x, me.z - this.lastPos.z);
        if (d < 3) this.meters += d;
      }
      this.lastPos = { x: me.x, z: me.z };
    } else this.lastPos = null;
    this.effects.update(dt);

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewmodel.scene, this.viewmodel.camera);
  }

  // ---------------------------------------------------------------- spectating

  /** True while we are watching someone else (benched, or out of lives / out for the round). */
  private watching(): boolean {
    return !this.killcam && !!this.spectateTarget();
  }

  private spectateCandidates(): Agent[] {
    const m = this.match;
    const p = m.player;
    const alive = m.sim.agents.filter((a) => a.alive && (this.spectator || a !== p));
    if (this.spectator || !m.def.teams) return alive;
    // Teammates first; the whole lobby once the team is wiped.
    const team = alive.filter((a) => a.team === p.team);
    return team.length ? team : alive;
  }

  private spectateTarget(): Agent | null {
    const m = this.match;
    const p = m.player;
    const want = this.spectator || (!p.alive && !this.pendingKillcam && this.deathCamT > 2.5 && !m.respawns(p) && m.phase !== 'over');
    if (!want) {
      this.specId = -1;
      return null;
    }
    const pool = this.spectateCandidates();
    if (!pool.length) return null;
    let t = pool.find((a) => a.id === this.specId);
    if (!t) {
      t = pool[0];
      this.specId = t.id;
    }
    return t;
  }

  private cycleSpectate(dir: number): void {
    const pool = this.spectateCandidates();
    if (!pool.length) return;
    const i = pool.findIndex((a) => a.id === this.specId);
    this.specId = pool[(i + dir + pool.length) % pool.length].id;
  }

  /** First person through the spectated player's eyes, with their gun. */
  private spectateCamera(t: Agent, dt: number, alpha: number): void {
    const p = this.prev.get(t.id) ?? t;
    const x = p.x + (t.x - p.x) * alpha;
    const y = p.y + (t.y - p.y) * alpha;
    const z = p.z + (t.z - p.z) * alpha;
    this.camera.position.set(x, y + eyeHeight(t), z);
    this.camera.rotation.set(t.pitch + (t.control === 'player' ? t.recoil : 0), t.yaw + Math.PI, 0);
    const w = weaponOf(t);
    const zoom = w.scope ? Math.max(0, this.settings.fov - 20) : w.adsFov;
    const fov = this.settings.fov - this.viewmodel.adsAmount * zoom;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const key = `${t.id}:${w.id}`;
    if (key !== this.lastSpecWeapon) {
      this.lastSpecWeapon = key;
      this.lastWeapon = null;
      this.viewmodel.setWeapon(w.id, this.ids.skins[t.id] ?? {}, this.cosmetics[t.id]?.charm ?? 'none', meleeDef(this.cosmetics[t.id]?.melee).id, t.attach?.[w.id]);
    }
    this.viewmodel.update(dt, {
      speed: Math.hypot(t.vx, t.vz),
      aiming: t.aiming,
      sprinting: t.sprinting,
      reload: t.reloadT > 0 && t.reloadDur > 0 ? 1 - t.reloadT / t.reloadDur : 0,
      switching: t.switchT / 0.45,
      onGround: t.onGround,
      lookDX: 0,
      lookDY: 0,
      visible: true,
      scope: w.scope
    });
  }

  private lastSpecWeapon = '';

  // ---------------------------------------------------------------- damage numbers

  private damageNumber(target: number, amount: number, head: boolean, killed: boolean, at?: { x: number; y: number; z: number }): void {
    const a = at ?? this.match.sim.agents[target];
    if (!a) return;
    const time = this.match.sim.time;
    // Pellets and bursts on one target add up into one number.
    const recent = this.dmgNumbers.find((d) => d.target === target && time - d.born < 0.3);
    if (recent) {
      recent.amount += amount;
      recent.head ||= head;
      this.paintNumber(recent.sprite, recent.amount, recent.head, killed);
      return;
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    sprite.renderOrder = 10;
    this.paintNumber(sprite, amount, head, killed);
    const side = (Math.random() - 0.5) * 0.5;
    this.scene.add(sprite);
    this.dmgNumbers.push({ target, sprite, amount, head, born: time, x: a.x + side, y: a.y + 2.05, z: a.z });
    if (this.dmgNumbers.length > 24) this.dropNumber(0);
  }

  private paintNumber(sprite: THREE.Sprite, amount: number, head: boolean, killed: boolean): void {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.font = `900 ${head ? 44 : 38}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    const text = String(Math.round(amount));
    g.strokeText(text, 64, 34);
    g.fillStyle = killed ? '#ff5a4a' : head ? '#ffd34d' : '#ffffff';
    g.fillText(text, 64, 34);
    const mat = sprite.material;
    mat.map?.dispose();
    mat.map = new THREE.CanvasTexture(c);
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.needsUpdate = true;
  }

  private dropNumber(i: number): void {
    const d = this.dmgNumbers[i];
    this.scene.remove(d.sprite);
    d.sprite.material.map?.dispose();
    d.sprite.material.dispose();
    this.dmgNumbers.splice(i, 1);
  }

  private updateDamageNumbers(time: number): void {
    for (let i = this.dmgNumbers.length - 1; i >= 0; i--) {
      const d = this.dmgNumbers[i];
      const age = time - d.born;
      if (age > 0.9 || age < 0) {
        this.dropNumber(i);
        continue;
      }
      d.sprite.position.set(d.x, d.y + age * 0.9, d.z);
      // Constant size on screen.
      const dist = this.camera.position.distanceTo(d.sprite.position);
      const s = Math.max(0.35, dist * 0.045) * (d.head ? 1.15 : 1) * (age < 0.08 ? 1.3 - age * 3.75 : 1);
      d.sprite.scale.set(s * 2, s, 1);
      d.sprite.material.opacity = age > 0.55 ? 1 - (age - 0.55) / 0.35 : 1;
    }
  }

  private updateViewmodel(dt: number): void {
    const player = this.match.player;
    const pw = weaponOf(player);
    this.lastSpecWeapon = '';
    if (pw.id !== this.lastWeapon) {
      this.lastWeapon = pw.id;
      this.viewmodel.setWeapon(pw.id, this.settings.skins, this.settings.cosmetics.charm, meleeDef(this.settings.cosmetics.melee).id, this.settings.attachments?.[pw.id]);
    }
    this.viewmodel.kills = player.kills;
    const myFlash = flashDef(this.settings.cosmetics.flash);
    this.viewmodel.flashColor = myFlash.color;
    this.viewmodel.flashScale = myFlash.scale;
    this.viewmodel.update(dt, {
      speed: Math.hypot(player.vx, player.vz),
      aiming: player.aiming && player.alive,
      sprinting: player.sprinting,
      reload: player.reloadT > 0 && player.reloadDur > 0 ? 1 - player.reloadT / player.reloadDur : 0,
      switching: player.switchT / 0.45,
      onGround: player.onGround,
      lookDX: this.lookDX,
      lookDY: this.lookDY,
      visible: player.alive && !this.spectator,
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
    const picks = m.streaksFor(p).map(streakDef);
    const next = picks.find((s) => s.kills > p.streak) ?? null;
    const myMastery = masteryOf(Math.max(0, ...Object.values({ ...this.baseWeaponKills })));
    const spec = this.specShown >= 0 ? sim.agents[this.specShown] : null;
    // During the killcam the HUD shows the killer's health, ammo and crosshair.
    const kcSnap = this.killcam ? this.snapAt(this.killcam.killer, this.killcam.clock) : null;
    const mvp = sim.agents.reduce((best, a) => (a.kills * 100 + a.damageDealt > best.kills * 100 + best.damageDealt ? a : best), sim.agents[0]);
    const teamMode = m.def.teams && m.mode !== 'survival' && m.mode !== 'boss' && !this.practice;
    const players: ScoreRow[] = sim.agents
      .map((a) => ({
        id: a.id,
        name: this.nameOf(a.id),
        color: cssColor(this.colorOf(a.id)),
        kills: a.kills,
        deaths: a.deaths,
        alive: a.alive,
        isPlayer: a === p && !this.spectator,
        ally: a.team === p.team,
        damage: Math.round(a.damageDealt),
        accuracy: a.shots > 0 ? Math.round((a.hits / a.shots) * 100) : -1,
        headshots: a.headshots,
        bestStreak: a.bestStreak,
        bot: this.isLabelledBot(a),
        level: a === p && !this.spectator ? this.myLevel : this.levelOfAgent(a),
        emblem: this.cosmetics[a.id] ? { glyph: emblemDef(this.cosmetics[a.id]!.emblem).glyph, color: emblemDef(this.cosmetics[a.id]!.emblem).color } : null,
        mastery: a === p && !this.spectator ? (myMastery.tier >= 0 ? myMastery.color : null) : this.botMastery(a),
        card: this.cosmetics[a.id]?.card ?? 'recruit',
        emblemId: this.cosmetics[a.id]?.emblem ?? 'star',
        prestige: a === p && !this.spectator ? this.myPrestige : (this.cosmetics[a.id]?.prestige ?? 0),
        frame: this.cosmetics[a.id]?.frame ?? 'none',
        title: this.cosmetics[a.id]?.title ?? 'none',
        nametag: this.cosmetics[a.id]?.nametag ?? 'plain',
        ping: this.pings.get(a.id) ?? null
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const hill = sim.rally
      ? {
          holder: (m.hillHolder === -2 ? 'contested' : m.hillHolder === -1 ? 'none' : m.hillHolder === p.team ? 'us' : 'them') as 'us' | 'them' | 'contested' | 'none',
          seconds: m.hillSeconds(),
          onHill: p.alive && Math.hypot(p.x - sim.rally.x, p.z - sim.rally.z) < sim.rally.r
        }
      : null;
    // First-match hints: only while actually playing (no killcam, lineup, pause or spectating).
    if (p.alive && this.aliveSince < 0) this.aliveSince = sim.time;
    if (!p.alive) this.aliveSince = -1;
    if (this.showScores || this.keys.has(this.settings.keys.scores)) this.hints.learn('scores');
    const hintId = this.hints.update({
      aliveFor: this.aliveSince < 0 ? 0 : sim.time - this.aliveSince,
      ammo: w.magazine > 0 ? p.ammo / w.magazine : 1,
      reloading: p.reloadT > 0,
      ok: p.alive && !this.spectator && !this.paused && !this.killcam && !this.introPending && performance.now() >= this.introUntil && m.phase !== 'over',
      time: sim.time
    });
    const state: HudState = {
      hint: hintId ? this.hintFor(hintId) : null,
      mode: m.mode,
      modeName: m.def.name,
      hp: Math.max(0, Math.ceil(p.hp)),
      ammo: p.ammo,
      magazine: w.magazine,
      reloading: p.reloadT > 0 && p.reloadDur > 0 ? 1 - p.reloadT / p.reloadDur : 0,
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
      showScoreboard: (this.keys.has(this.settings.keys.scores) || this.showScores) && !this.paused,
      hill,
      targetScore: m.goal(m.mode) ?? 0,
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
      redeployIn: m.redeployIn(p),
      intro: this.introPending ? 4.5 : this.introUntil > performance.now() ? (this.introUntil - performance.now()) / 1000 : null,
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
      scoped: this.viewmodel.scoped && (p.alive || !!this.killcam),
      optic: p.alive && !this.killcam && !this.spectator && this.viewmodel.adsAmount > 0.75 ? (weaponOf(p).optic ?? null) : null,
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
      modeStatus: ((st) => (m.opts.timeLimit ? `${st ? `${st} · ` : ''}Mission: ${Math.max(0, Math.ceil(m.opts.timeLimit - (sim.time - m.startTime)))} s left` : st))(m.statusFor(p, (id) => this.nameOf(id))),
      blind: p.alive && sim.time < p.frozenUntil ? Math.ceil(p.frozenUntil - sim.time) : null,
      reconnecting: p.alive && sim.time < p.stunUntil ? Math.ceil(p.stunUntil - sim.time) : null,
      killcamPending: !!this.pendingKillcam,
      fps: Math.round(this.fps),
      hardcore: m.mode === 'hardcore',
      ping: this.net?.role === 'client' ? this.net.session.ping : this.net ? 0 : this.practice ? null : (this.pings.get(p.id) ?? null),
      online: !!this.net,
      spectating: spec ? { name: this.nameOf(spec.id), color: cssColor(this.colorOf(spec.id)), weapon: weaponOf(spec).name } : null,
      spectator: this.spectator,
      chatOpen: this.chatOpen,
      mvp: mvp ? mvp.id : -1,
      jammed: sim.time < (m.party.jamUntil[p.team] ?? -1),
      streaks: this.practice ? [] : picks.map((s) => ({ name: s.name, kills: s.kills, earned: p.streak >= s.kills })),
      touch: this.touchMode,
      flashed: p.alive && !this.killcam ? Math.max(0, Math.min(1, (p.blindUntil - sim.time) / 1.2)) * (this.settings.access.reduceFlash ? 0.6 : 1) : 0,
      boss: m.mode === 'boss' ? { hp: m.bossHealth(), phase: m.party.bossPhase } : null,
      sounds: this.soundCues.filter((c) => sim.time - c.at < 1.2),
      newBadges: this.newBadges,
      summary: this.summary,
      throwables: { lethal: p.lethal, lethals: p.grenades, tactical: p.tactical, tacticals: p.tacticals },
      night: this.night,
      party: this.party,
      publicMatch: this.net?.role === 'client' ? !!this.net.start.public : this.net?.role === 'host' ? this.net.session.public : false,
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
    if (kcSnap) {
      const killerAgent = sim.agents[this.killcam!.killer];
      const kw = WEAPONS[kcSnap.weapon];
      const moving = Math.hypot(kcSnap.vx, kcSnap.vz) > 0.6;
      Object.assign(state, {
        alive: true,
        hp: Math.max(0, Math.ceil(kcSnap.hp)),
        ammo: kcSnap.ammo,
        magazine: kw.magazine,
        reloading: kcSnap.reloadT > 0 && kw.reload > 0 ? 1 - kcSnap.reloadT / kw.reload : 0,
        aiming: kcSnap.aiming,
        spread: (moving ? kw.spreadMoving : kw.spreadStill) * (kcSnap.aiming ? kw.adsSpread : 1),
        weaponName: kw.name,
        weaponId: kw.id,
        loadout: kcSnap.weapons.map((id, i) => ({ id, name: WEAPONS[id].tag, active: i === kcSnap.slot })),
        grenades: kcSnap.grenades,
        throwables: { ...state.throwables, lethal: killerAgent?.lethal ?? state.throwables.lethal, tactical: killerAgent?.tactical ?? state.throwables.tactical, lethals: kcSnap.grenades, tacticals: kcSnap.tacticals },
        kills: kcSnap.kills,
        deaths: kcSnap.deaths,
        // The kill feed as it stood at that moment of the replay.
        feed: this.feed.filter((f) => f.at <= this.killcam!.clock && this.killcam!.clock - f.at < 7),
        callouts: [],
        medals: [],
        crouching: kcSnap.crouching,
        protected: false,
        streak: kcSnap.streak,
        nextStreak: null,
        streaks: [],
        damage: [],
        killedBy: null
      });
    }
    return state;
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
    if (sim.time < (this.match.party.jamUntil[p.team] ?? -1)) {
      // Counter-UAV: static instead of a map.
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 3, 2);
      }
      ctx.fillStyle = '#ff5a4a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JAMMED', size / 2, size / 2);
      return;
    }
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
    if (this.killcam) {
      this.drawKillcamMinimap(ctx, X, Z);
      return;
    }
    for (const a of sim.agents) {
      if (!a.alive || a === p) continue;
      const ally = a.team === p.team;
      const firing = sim.time - a.lastShotT < 1 && !weaponOf(a).suppressed;
      const uav = sim.time < (this.match.uavUntil[this.match.player.id] ?? -1);
      const party = this.match.party;
      const marked = a.id === party.juggId || a.id === party.holder || (this.match.mode === 'vip' && party.vipIds.includes(a.id));
      const ghost = hasPerk(a, 'ghost');
      const flagged = !ally && sim.time < a.flaggedUntil && a.flaggedTeam === p.team;
      if (!ally && ((!firing && !uav) || ghost) && !marked && !flagged) continue;
      if (flagged) {
        ctx.strokeStyle = '#b46bff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(a.x), Z(a.z), 6, 0, Math.PI * 2);
        ctx.stroke();
      }
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

  /** A hint's keys and words, for whatever the player is using: keyboard, controller or touch. */
  private hintFor(id: HintId): { keys: string[]; text: string } {
    const k = this.settings.keys;
    const p = this.match.player;
    const lethal = THROWABLES[p.lethal].name.toLowerCase();
    const tactical = THROWABLES[p.tactical].name.toLowerCase();
    const pad = this.padMode;
    const touch = this.touchMode;
    const key = (code: string) => keyLabel(code);
    switch (id) {
      case 'move':
        if (touch) return { keys: ['LEFT STICK', 'FIRE'], text: 'Move with the left side, drag the right side to aim, FIRE to shoot' };
        if (pad) return { keys: ['L-STICK', 'RT'], text: 'Move, aim with the right stick, RT to shoot' };
        return { keys: [`${key(k.forward)}${key(k.left)}${key(k.back)}${key(k.right)}`, key(k.fire)], text: `Move, look with the mouse, ${key(k.fire)} to shoot, ${key(k.aim)} to aim` };
      case 'swap':
        if (touch) return { keys: ['SWAP'], text: 'Switch weapons' };
        if (pad) return { keys: ['Y'], text: 'Switch weapons' };
        return { keys: [key(k.weapon1), key(k.weapon2), key(k.swap)], text: 'Switch weapons (or the mouse wheel)' };
      case 'reload':
        return { keys: [touch ? 'R' : pad ? 'X' : key(k.reload)], text: 'Reload' };
      case 'lethal':
        return { keys: [touch ? 'G' : pad ? 'RB' : key(k.grenade)], text: `Throw your ${lethal}` };
      case 'tactical':
        return { keys: [touch ? 'H' : pad ? 'LB' : key(k.tactical)], text: `Throw your ${tactical}` };
      case 'knife':
        return { keys: [touch ? 'KNIFE' : pad ? 'R3' : key(k.melee)], text: 'Quick knife: one stab up close' };
      case 'scores':
        return { keys: [touch ? 'SCORES' : pad ? 'BACK' : key(k.scores)], text: 'Hold for the scoreboard' };
      case 'pause':
        return { keys: [touch ? 'PAUSE' : pad ? 'START' : 'Esc'], text: 'Pause, settings and the full controls list' };
    }
  }

  /** Killcam minimap: the killer's teammates, enemies who were firing, and the killer's arrow, all from the recording. */
  private drawKillcamMinimap(ctx: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number): void {
    const kc = this.killcam!;
    const sim = this.match.sim;
    const me = this.snapAt(kc.killer, kc.clock);
    const team = sim.agents[kc.killer]?.team ?? -1;
    for (const a of sim.agents) {
      if (a.id === kc.killer) continue;
      const s = this.snapAt(a.id, kc.clock);
      if (!s || !s.alive) continue;
      if (a.team !== team && kc.clock - s.lastShotT > 1) continue;
      ctx.fillStyle = cssColor(this.colorOf(a.id));
      ctx.beginPath();
      ctx.arc(X(s.x), Z(s.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!me) return;
    const px = X(me.x);
    const pz = Z(me.z);
    const fx = -Math.sin(me.yaw);
    const fz = -Math.cos(me.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px + fx * 7, pz + fz * 7);
    ctx.lineTo(px - fx * 4 - fz * 4, pz - fz * 4 + fx * 4);
    ctx.lineTo(px - fx * 4 + fz * 4, pz - fz * 4 - fx * 4);
    ctx.closePath();
    ctx.fill();
  }

  dispose(): void {
    this.disposed = true;
    this.ticker?.terminate();
    if (this.net?.role === 'host' && !this.keepNet) this.net.session.close();
    if (this.net?.role === 'client' && !this.keepNet) this.net.session.leave();
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

/** Real (account) friends, as last counted by the friends list: for the friends achievements. */
let realFriendCount = 0;
export const setRealFriendCount = (n: number) => (realFriendCount = n);

const cosAdmin = (c: Cosmetics | null | undefined) => c?.staff === 'admin';

/** Gives one team a chosen colour, and the other the most different colour in the palette. */
export const recolorTeam = (ids: Identities, match: { sim: { agents: Agent[] }; player: Agent }, team: number, color: number): void => {
  if (!ids.teamColors) return;
  const mine = team === match.player.team ? 0 : 1;
  const hue = (c: number) => {
    const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return 0;
    const h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
    return ((h * 60) + 360) % 360;
  };
  const far = COLORS.map((c) => c.hex)
    .filter((c) => c !== color)
    .sort((a, b) => Math.abs(180 - Math.abs(hue(b) - hue(color))) - Math.abs(180 - Math.abs(hue(a) - hue(color))))
    .reverse()[0];
  ids.teamColors[mine] = color;
  ids.teamColors[1 - mine] = far ?? ids.teamColors[1 - mine];
  match.sim.agents.forEach((a) => (ids.colors[a.id] = ids.teamColors![a.team === match.player.team ? 0 : 1]));
};
