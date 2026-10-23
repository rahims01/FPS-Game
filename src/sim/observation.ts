import { ACTIONS, weaponOf, type Agent } from './Agent';
import { SOLDIER } from './config';
import type { FpsSim } from './FpsSim';
import { clamp, forwardX, forwardZ, rightX, rightZ, wrapAngle, yawTo } from './math';

/**
 * Egocentric observation for the combat policy. Everything is relative to
 * the agent's own heading, so one policy works on any map, any team size and
 * any spawn. Bump OBS_VERSION whenever the layout changes: the browser refuses
 * a policy trained on a different version.
 */
export const OBS_VERSION = 1;

const RAY_DIRS = 8;

export const OBS_LAYOUT = {
  self: 6, // hp, ammo, reloading, local vel fwd/side, recently hit
  target: 9, // known, visible, bearing sin/cos, dist, hp, facing me, time since seen, reloading
  aim: 1, // aim settled
  rays: RAY_DIRS, // free distance around the agent
  cover: 5, // has cover, bearing sin/cos, dist, currently in cover
  allies: 2, // allies alive nearby, nearest ally distance
  lastAction: ACTIONS.length
} as const;

export const OBS_SIZE = Object.values(OBS_LAYOUT).reduce((s, n) => s + n, 0);

export const buildObservation = (sim: FpsSim, a: Agent, out = new Float32Array(OBS_SIZE)): Float32Array => {
  let k = 0;
  const put = (v: number) => {
    out[k++] = v;
  };
  const fx = forwardX(a.yaw);
  const fz = forwardZ(a.yaw);
  const rx = rightX(a.yaw);
  const rz = rightZ(a.yaw);

  // Self.
  put(a.hp / SOLDIER.hp);
  put(a.ammo / Math.max(1, weaponOf(a).magazine));
  put(a.reloadT > 0 ? 1 : 0);
  put(clamp((a.vx * fx + a.vz * fz) / SOLDIER.sprintSpeed, -1, 1));
  put(clamp((a.vx * rx + a.vz * rz) / SOLDIER.sprintSpeed, -1, 1));
  put(Math.exp(-(sim.time - a.lastHitT) / 1.5));

  // Target.
  const t = sim.target(a);
  const known = !!t && sim.knowsTarget(a);
  const tx = t && a.seesTarget ? t.x : a.lastSeenX;
  const tz = t && a.seesTarget ? t.z : a.lastSeenZ;
  const bearing = wrapAngle(yawTo(a.x, a.z, tx, tz) - a.yaw);
  const d = Math.hypot(tx - a.x, tz - a.z);
  put(known ? 1 : 0);
  put(a.seesTarget ? 1 : 0);
  put(known ? Math.sin(bearing) : 0);
  put(known ? Math.cos(bearing) : 0);
  put(known ? clamp(d / 40, 0, 1) : 1);
  put(t && a.seesTarget ? t.hp / SOLDIER.hp : 0);
  if (t && a.seesTarget && d > 1e-3) {
    // 1 = the target is looking straight at me.
    put((forwardX(t.yaw) * (a.x - t.x) + forwardZ(t.yaw) * (a.z - t.z)) / d);
  } else put(0);
  put(clamp((sim.time - a.lastSeenT) / SOLDIER.memory, 0, 1));
  put(t && a.seesTarget && t.reloadT > 0 ? 1 : 0);

  // Aim.
  put(a.seesTarget ? clamp(a.trackT / 1, 0, 1) : 0);

  // Free space around the agent, relative to its heading.
  for (let i = 0; i < RAY_DIRS; i++) {
    const ang = a.yaw + (i / RAY_DIRS) * Math.PI * 2;
    put(sim.arena.probe(a.x, a.z, Math.sin(ang), Math.cos(ang), 10) / 10);
  }

  // Cover.
  const c = known ? sim.coverFor(a) : null;
  if (c) {
    const cb = wrapAngle(yawTo(a.x, a.z, c.x, c.z) - a.yaw);
    put(1);
    put(Math.sin(cb));
    put(Math.cos(cb));
    put(clamp(Math.hypot(c.x - a.x, c.z - a.z) / 20, 0, 1));
  } else {
    put(0);
    put(0);
    put(0);
    put(1);
  }
  put(a.inCover ? 1 : 0);

  // Allies.
  let allies = 0;
  let nearest = 30;
  for (const b of sim.agents) {
    if (b === a || !b.alive || b.team !== a.team) continue;
    const db = Math.hypot(b.x - a.x, b.z - a.z);
    if (db < 25) allies++;
    nearest = Math.min(nearest, db);
  }
  put(clamp(allies / 3, 0, 1));
  put(nearest / 30);

  // Last action, one-hot.
  for (let i = 0; i < ACTIONS.length; i++) put(i === a.action ? 1 : 0);
  return out;
};
