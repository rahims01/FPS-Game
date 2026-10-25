import { setLoadout, type Agent, type DeathCause } from '../sim/Agent';
import type { HitRegion } from '../sim/config';
import type { Match, MatchNotice } from '../sim/Match';
import type { SimEvent } from '../sim/FpsSim';
import type { WeaponId } from '../sim/weapons';
import type { ThrowableId } from '../sim/gear';

const KINDS: ThrowableId[] = ['frag', 'molotov', 'tknife', 'spear', 'flash', 'smoke'];
import { packAgent, type AgentNet, type Snapshot } from './protocol';

/** Host side: everything a client needs to draw this moment of the match. */
export const buildSnapshot = (m: Match, ev: SimEvent[], no: MatchNotice[]): Snapshot => {
  const sim = m.sim;
  return {
    time: sim.time,
    ag: sim.agents.map(packAgent),
    m: {
      phase: m.phase,
      scores: m.scores,
      round: m.round,
      wave: m.wave,
      banner: m.banner,
      bannerTeam: m.bannerTeam,
      bannerOther: m.bannerOther,
      bannerUntil: m.bannerUntil,
      placement: m.placement,
      winTeam: m.winTeam,
      hillHolder: m.hillHolder,
      hillMovedAt: m.hillMovedAt,
      waveQueue: m.waveQueue,
      brPhase: m.brPhase,
      brPhaseStart: m.brPhaseStart,
      zoneFrom: m.zoneFrom,
      zoneTo: m.zoneTo,
      uavUntil: m.uavUntil,
      flags: m.flags,
      ctf: m.ctf,
      party: m.party,
      gravity: sim.gravity,
      jumpMul: sim.jumpMul,
      headScale: sim.headScale
    },
    zone: sim.zone,
    rally: sim.rally,
    obj: sim.objectives,
    gr: sim.grenades.map((g) => [g.x, g.y, g.z, KINDS.indexOf(g.kind), g.vx, g.vy, g.vz]),
    fx: sim.fields.map((f) => [f.kind === 'fire' ? 0 : 1, f.x, f.z, f.r, f.until - sim.time]),
    pk: sim.pickups.map((p) => [p.id, p.kind === 'medkit' ? 0 : 1, p.x, p.z, p.active ? 1 : 0, p.team]),
    ev,
    no
  };
};

/** Where the client should draw other soldiers; it eases toward these each frame. */
export interface NetTarget {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

const num = (v: number | string) => v as number;

/**
 * Client side: copies a host snapshot into the local (puppet) match. The
 * client's own soldier keeps its locally simulated movement and weapon handling;
 * everything else (health, deaths, scores, other soldiers) comes from the host.
 */
export const applySnapshot = (m: Match, snap: Snapshot, meId: number, targets: Map<number, NetTarget>): void => {
  const sim = m.sim;
  if (Math.abs(sim.time - snap.time) > 0.25) sim.time = snap.time;
  for (const row of snap.ag) {
    const id = num(row[0]);
    while (sim.agents.length <= id) sim.spawn(num(row[11]), 'remote', num(row[1]), num(row[3]));
    applyAgent(sim.agents[id], row, id === meId, targets);
  }
  const n = snap.m;
  m.phase = n.phase;
  m.scores = n.scores;
  m.round = n.round;
  m.wave = n.wave;
  m.banner = n.banner;
  m.bannerTeam = n.bannerTeam;
  m.bannerOther = n.bannerOther;
  m.bannerUntil = n.bannerUntil;
  m.placement = n.placement;
  m.winTeam = n.winTeam;
  m.hillHolder = n.hillHolder;
  m.hillMovedAt = n.hillMovedAt;
  m.waveQueue = n.waveQueue;
  m.brPhase = n.brPhase;
  m.brPhaseStart = n.brPhaseStart;
  m.zoneFrom = n.zoneFrom;
  m.zoneTo = n.zoneTo;
  m.uavUntil = n.uavUntil;
  m.flags = n.flags;
  m.ctf = n.ctf;
  m.party = n.party;
  sim.gravity = n.gravity;
  sim.jumpMul = n.jumpMul;
  sim.headScale = n.headScale;
  sim.zone = snap.zone;
  sim.rally = snap.rally;
  sim.objectives = snap.obj;
  sim.grenades = snap.gr.map(([x, y, z, k, vx, vy, vz]) => ({ owner: -1, x, y, z, vx: vx ?? 0, vy: vy ?? 0, vz: vz ?? 0, fuse: 99, kind: KINDS[k] ?? 'frag' }));
  sim.fields = (snap.fx ?? []).map(([k, x, z, r, left]) => ({ kind: k === 0 ? 'fire' : 'smoke', x, z, r, until: sim.time + left, owner: -1 }));
  sim.pickups = snap.pk.map(([id, kind, x, z, active, team]) => ({
    id,
    kind: kind === 0 ? 'medkit' : 'tag',
    x,
    z,
    active: active === 1,
    team,
    expires: Infinity
  }));
  m.notices.push(...snap.no);
};

const applyAgent = (a: Agent, r: AgentNet, me: boolean, targets: Map<number, NetTarget>): void => {
  const life = num(r[12]);
  const flags = num(r[10]);
  const alive = (flags & 1) === 1;
  const respawned = life !== a.life;
  const weapons = (r[16] as string).split(',') as WeaponId[];
  if (respawned || weapons.join(',') !== a.weapons.join(',')) {
    setLoadout(a, weapons);
  }
  a.life = life;
  a.team = num(r[11]);
  a.hp = num(r[9]);
  a.kills = num(r[18]);
  a.deaths = num(r[19]);
  a.streak = num(r[20]);
  a.grenades = num(r[21]);
  a.armor = num(r[22]);
  a.protectedUntil = num(r[23]);
  a.deathCause = r[25] as DeathCause;
  a.deathRegion = r[26] as HitRegion;
  a.deathDirX = num(r[27]);
  a.deathDirY = num(r[28]);
  a.deathDirZ = num(r[29]);
  a.deathT = num(r[30]);
  a.killedBy = num(r[31]);
  a.tier = num(r[32]);
  a.tierKills = num(r[33]);
  a.frozenUntil = num(r[35] ?? 0);
  a.shots = num(r[36] ?? 0);
  a.hits = num(r[37] ?? 0);
  a.damageDealt = num(r[38] ?? 0);
  a.headshots = num(r[39] ?? 0);
  a.bestStreak = num(r[40] ?? 0);
  a.speedMul = num(r[41] ?? 1);
  a.blindUntil = num(r[42] ?? 0);
  a.scale = num(r[43] ?? 1);
  a.tacticals = num(r[44] ?? 0);
  a.lethal = (r[45] as ThrowableId) ?? 'frag';
  a.tactical = (r[46] as ThrowableId) ?? 'flash';
  a.reloadDur = num(r[47] ?? 1);
  const pos = { x: num(r[1]), y: num(r[2]), z: num(r[3]), yaw: num(r[7]), pitch: num(r[8]) };
  if (me) {
    // Our own movement is simulated locally; only take the host's position on respawn.
    if (respawned || (alive && !a.alive)) {
      a.x = pos.x;
      a.y = pos.y;
      a.z = pos.z;
      a.vx = a.vy = a.vz = 0;
    }
    a.alive = alive;
    return;
  }
  a.alive = alive;
  a.vx = num(r[4]);
  a.vy = num(r[5]);
  a.vz = num(r[6]);
  a.crouching = (flags & 2) === 2;
  a.sprinting = (flags & 4) === 4;
  a.onGround = (flags & 8) === 8;
  a.aiming = (flags & 16) === 16;
  a.slideT = num(r[13]);
  a.reloadT = num(r[14]);
  a.slot = num(r[15]);
  a.ammo = num(r[17]);
  a.lastShotT = num(r[24]);
  a.switchT = num(r[34]);
  const t = targets.get(a.id);
  if (!t || respawned || Math.hypot(t.x - pos.x, t.z - pos.z) > 6) {
    // Teleports (respawns, first sight) snap instead of sliding across the map.
    a.x = pos.x;
    a.y = pos.y;
    a.z = pos.z;
    a.yaw = pos.yaw;
    a.pitch = pos.pitch;
  }
  targets.set(a.id, pos);
};
