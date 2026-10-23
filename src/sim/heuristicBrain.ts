import { A, type Agent } from './Agent';
import type { FpsSim } from './FpsSim';

/**
 * Hand-written baseline. Bots use it when no trained policy is loaded, and
 * the trainer uses it as the opponent the policy learns to beat. It speaks the
 * same action space as the policy, so the two are interchangeable per bot.
 */
export const heuristicBrain = (a: Agent, sim: FpsSim): number => {
  const t = sim.target(a);
  if (!t) return a.ammo < 30 ? A.reload : A.hold;
  const known = sim.knowsTarget(a);
  const tx = a.seesTarget ? t.x : a.lastSeenX;
  const tz = a.seesTarget ? t.z : a.lastSeenZ;
  const d = Math.hypot(tx - a.x, tz - a.z);
  const b = a.brain;

  if (a.reloadT > 0) {
    if (a.seesTarget && !a.inCover && sim.coverFor(a)) return A.take_cover;
    return a.seesTarget ? strafe(a, sim) : A.hold;
  }
  if (a.ammo === 0) return A.reload;
  if (!a.seesTarget && a.ammo < 12) return A.reload;
  if (a.hp < 40 && a.seesTarget && !a.inCover && sim.coverFor(a)) return A.take_cover;

  if (a.seesTarget) {
    if (d > 30 - 12 * b.aggression) return A.advance;
    if (d < 5) return A.retreat;
    if (sim.rng.next() < 0.04) return A.hold;
    return strafe(a, sim);
  }
  // Hidden and hurt: wait for health to come back, unless aggressive.
  if (a.inCover && a.hp < 60 && b.aggression < 0.7) return A.hold;
  // No contact: hunt fast on small maps, wander at walking pace on big ones.
  if (!known) return sim.hunt ? A.sprint : A.advance;
  return d > 14 ? A.sprint : A.advance;
};

/** Strafe in one direction for a while, then switch. Flip early when blocked. */
const strafe = (a: Agent, sim: FpsSim): number => {
  const b = a.brain;
  const blocked = sim.time - a.actionSince > 0.4 && Math.hypot(a.vx, a.vz) < 0.3;
  if (sim.time > b.strafeUntil || blocked) {
    b.strafeDir = -b.strafeDir;
    b.strafeUntil = sim.time + 0.7 + sim.rng.next() * 1.4;
  }
  return b.strafeDir > 0 ? A.strafe_right : A.strafe_left;
};
