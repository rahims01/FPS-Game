import type { Agent } from '../sim/Agent';
import type { SimEvent } from '../sim/FpsSim';
import type { Difficulty, LobbyRules, Match, MatchNotice, ModeId } from '../sim/Match';
import type { SkinChoice } from '../assets/skins';
import type { StreakId } from '../sim/killstreaks';
import type { PerkId, ThrowableId } from '../sim/gear';
import type { Cosmetics } from '../game/cosmetics';
import type { WeaponId } from '../sim/weapons';

/**
 * Online play is host-authoritative peer-to-peer (WebRTC via PeerJS, so it
 * runs on static hosting such as Cloudflare Pages). The host's browser runs
 * the real match. Clients move their own soldier locally (so movement feels
 * instant), send their position and button state, and draw everything else
 * from the host's snapshots.
 */
export const PROTOCOL_VERSION = 4;
export const PEER_PREFIX = 'fpsgame-v1-';
export const SNAPSHOT_HZ = 20;

export interface PlayerProfile {
  name: string;
  color: number;
  primary: WeaponId;
  secondary: WeaponId;
  skins: SkinChoice;
  streaks: StreakId[];
  perks: PerkId[];
  lethal: ThrowableId;
  tactical: ThrowableId;
  cosmetics: Cosmetics;
}

export interface LobbyPlayer {
  /** Stable id within the room ('host' for the host). */
  id: string;
  name: string;
  color: number;
  host: boolean;
  /** Chosen to play; everyone else spectates (when the room has more people than the mode has slots). */
  playing: boolean;
}

export interface LobbyMsg {
  t: 'lobby';
  mode: ModeId;
  difficulty: Difficulty;
  players: LobbyPlayer[];
  max: number;
  /** Players the mode can take; the rest spectate. */
  slots: number;
  rules: LobbyRules;
  /** A party: friends queue together into a normal matchmade game. */
  party: boolean;
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
  tactical: boolean;
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
  | { t: 'ping'; at: number }
  | { t: 'chat'; text: string };

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
  /** This client watches instead of playing (`you` is then -1). */
  spectate: boolean;
  /** Weapon skins by agent id. */
  skins: (SkinChoice | null)[];
  rules: LobbyRules;
  /** Calling cards and emblems by agent id. */
  cosmetics: (Cosmetics | null)[];
  party: boolean;
  /** Night map. */
  night: boolean;
}

export type HostMsg =
  | LobbyMsg
  | { t: 'chat'; name: string; color: number; text: string; system?: boolean }
  /** Someone left mid-match: a bot now plays their soldier under a new name. */
  | { t: 'rename'; id: number; name: string }
  /** The match is over and the host has taken everyone back to the room. */
  | { t: 'toLobby' }
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
  /** Throwables in flight: x, y, z, kind index, vx, vy, vz. */
  gr: number[][];
  /** Fire and smoke: kind (0 fire, 1 smoke), x, z, r, seconds left. */
  fx: number[][];
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
  r3(a.frozenUntil),
  a.shots,
  a.hits,
  Math.round(a.damageDealt),
  a.headshots,
  a.bestStreak,
  r3(a.speedMul),
  r3(a.blindUntil),
  a.scale,
  a.tacticals,
  a.lethal,
  a.tactical,
  r3(a.reloadDur)
];
