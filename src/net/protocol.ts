import type { Agent } from '../sim/Agent';
import type { SimEvent } from '../sim/FpsSim';
import type { Difficulty, Match, MatchNotice, ModeId } from '../sim/Match';
import type { WeaponId } from '../sim/weapons';

/**
 * Online play is host-authoritative peer-to-peer (WebRTC via PeerJS, so it
 * runs on static hosting such as Cloudflare Pages). The host's browser runs
 * the real match. Clients move their own soldier locally (so movement feels
 * instant), send their position and button state, and draw everything else
 * from the host's snapshots.
 */
export const PROTOCOL_VERSION = 2;
export const PEER_PREFIX = 'fpsgame-v1-';
export const SNAPSHOT_HZ = 20;

export interface PlayerProfile {
  name: string;
  color: number;
  primary: WeaponId;
}

export interface LobbyPlayer {
  name: string;
  color: number;
  host: boolean;
}

/** Buttons sent by a client each input packet. One-shot actions are latched until sent. */
export interface NetButtons {
  fire: boolean;
  aim: boolean;
  sprint: boolean;
  crouch: boolean;
  reload: boolean;
  melee: boolean;
  grenade: boolean;
  switchSlot: number;
}

export type ClientMsg =
  | { t: 'hello'; v: number; profile: PlayerProfile }
  | {
      t: 'in';
      /** The life the client is playing (stale packets from a previous life are ignored). */
      life: number;
      /** x, y, z, vx, vy, vz, yaw, pitch */
      s: number[];
      /** bit 1 onGround, 2 crouching, 4 sprinting */
      f: number;
      slide: number;
      b: NetButtons;
    }
  | { t: 'bye' }
  | { t: 'ping'; at: number };

export interface StartMsg {
  t: 'start';
  mode: ModeId;
  difficulty: Difficulty;
  seed: number;
  /** The agent this client controls. */
  you: number;
  names: string[];
  colors: number[];
  teamColors: [number, number] | null;
  /** Agents controlled by humans (for nametag styling and so on). */
  humans: number[];
}

export type HostMsg =
  | { t: 'lobby'; mode: ModeId; difficulty: Difficulty; players: LobbyPlayer[]; max: number }
  | { t: 'reject'; reason: string }
  | StartMsg
  | { t: 'snap'; snap: Snapshot }
  | { t: 'end'; reason: string }
  | { t: 'pong'; at: number };

/** Compact agent record (array to keep packets small). See AGENT_FIELDS for the layout. */
export type AgentNet = (number | string)[];

export interface Snapshot {
  time: number;
  ag: AgentNet[];
  m: MatchNet;
  zone: { x: number; z: number; r: number; dps: number } | null;
  rally: { x: number; z: number; r: number } | null;
  obj: { label: string; x: number; z: number; r: number; owner: number; progress: number; carried?: boolean }[];
  /** Grenades in flight: x, y, z. */
  gr: number[][];
  /** Pickups: id, kind (0 medkit, 1 tag), x, z, active, team. */
  pk: number[][];
  ev: SimEvent[];
  no: MatchNotice[];
}

export interface MatchNet {
  phase: 'live' | 'roundOver' | 'over';
  scores: [number, number];
  round: number;
  wave: number;
  banner: string;
  bannerTeam: number;
  bannerOther: string;
  bannerUntil: number;
  placement: number;
  winTeam: number;
  hillHolder: number;
  hillMovedAt: number;
  waveQueue: number;
  brPhase: number;
  brPhaseStart: number;
  zoneFrom: { x: number; z: number; r: number };
  zoneTo: { x: number; z: number; r: number };
  uavUntil: Record<number, number>;
  flags: { label: string; x: number; z: number; r: number; owner: number; progress: number }[];
  ctf: { team: number; homeX: number; homeZ: number; x: number; z: number; carrier: number; home: boolean; droppedAt: number }[];
  party: Match['party'];
  gravity: number;
  jumpMul: number;
  headScale: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Packs an agent: [id, x, y, z, vx, vy, vz, yaw, pitch, hp, flags, team, life, slideT, reloadT, slot, weapons, ammo,
 * kills, deaths, streak, grenades, armor, protectedUntil, lastShotT, deathCause, deathRegion, ddx, ddy, ddz, deathT,
 * killedBy, tier, tierKills, switchT] */
export const packAgent = (a: Agent): AgentNet => [
  a.id,
  r3(a.x),
  r3(a.y),
  r3(a.z),
  r3(a.vx),
  r3(a.vy),
  r3(a.vz),
  r3(a.yaw),
  r3(a.pitch),
  Math.ceil(a.hp),
  (a.alive ? 1 : 0) | (a.crouching ? 2 : 0) | (a.sprinting ? 4 : 0) | (a.onGround ? 8 : 0) | (a.aiming ? 16 : 0),
  a.team,
  a.life,
  r3(a.slideT),
  r3(a.reloadT),
  a.slot,
  a.weapons.join(','),
  a.ammo,
  a.kills,
  a.deaths,
  a.streak,
  a.grenades,
  a.armor,
  r3(a.protectedUntil),
  r3(a.lastShotT),
  a.deathCause,
  a.deathRegion,
  r3(a.deathDirX),
  r3(a.deathDirY),
  r3(a.deathDirZ),
  r3(a.deathT),
  a.killedBy,
  a.tier,
  a.tierKills,
  r3(a.switchT),
  r3(a.frozenUntil)
];
