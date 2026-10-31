// Campaign operations: stealth, alarms, every objective type, lives and extraction.
import { Match } from '../src/sim/Match.ts';
import { MISSIONS } from '../src/game/campaign.ts';
const NO: any = { forward: 0, right: 0, yaw: 0, pitch: 0, fire: false, aim: false, reload: false, jump: false, sprint: false, crouch: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };
let fails = 0;
const ok = (label: string, cond: boolean, extra?: unknown) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ' ' + JSON.stringify(extra)}`); if (!cond) fails++; };
const steps = (m: Match, n: number) => { for (let i = 0; i < n; i++) m.step(NO); };
const make = (op: any, seed = 5) => new Match({ mode: 'op', difficulty: 'normal', botControl: 'heuristic', seed, op } as any);
const tp = (a: any, x: number, z: number) => { a.x = x; a.z = z; a.vx = a.vz = 0; };
const enemies = (m: Match) => m.sim.agents.filter((a) => a.team === 1);

// Every mission builds and runs a few seconds without errors.
for (const mi of MISSIONS.filter((x) => x.op)) {
  try { const m = make(mi.op, 11); steps(m, 120); ok(`${mi.title}: runs`, m.phase !== 'over', m.banner); }
  catch (e) { ok(`${mi.title}: runs`, false, String(e)); }
}

// Stealth: guards stay put and don't shoot while you're unseen.
{
  const m = make({ kind: 'intel', items: 2, guards: 3, patrols: 2, stealth: true, reinforce: 2, size: 38 });
  const g = enemies(m);
  ok('stealth: guards on watch', g.every((a) => a.passive));
  const p = m.player;
  steps(m, 180);
  ok('stealth: no alarm while hidden away', !m.op!.alarm && p.hp === 100, { alarm: m.op!.alarm, hp: p.hp, s: m.op!.suspicion });
  ok('stealth: status says undetected', m.statusFor(p, () => 'x')!.includes('Undetected'), m.statusFor(p, () => 'x'));
  tp(p, g[0].x + 6, g[0].z);
  p.lastShotT = m.sim.time;
  steps(m, 12);
  ok('stealth: a loud shot raises the alarm', m.op!.alarm && g.every((a) => !a.passive));
  ok('stealth: report shows detected', m.op!.report.undetected === false);
}
// Being seen fills the meter.
{
  const m = make({ kind: 'intel', items: 2, guards: 2, patrols: 0, stealth: true, size: 38 });
  const g = enemies(m)[0];
  const p = m.player;
  tp(p, g.x + Math.sin(g.yaw) * 6, g.z + Math.cos(g.yaw) * 6);
  let i = 0;
  while (!m.op!.alarm && i++ < 60) { g.yaw = Math.atan2(p.x - g.x, p.z - g.z); m.step(NO); }
  ok('stealth: standing in front of a guard gets you spotted', m.op!.alarm, { s: m.op!.suspicion, i });
}
// Intel: grab both, then extract.
{
  const m = make({ kind: 'intel', items: 2, guards: 0, patrols: 0, stealth: true, size: 38 });
  const p = m.player;
  const start = { x: p.x, z: p.z };
  for (const o of m.sim.objectives.slice()) { tp(p, o.x, o.z); steps(m, 12); }
  ok('intel: all taken, extract phase', m.op!.phase === 'extract', m.op!.phase);
  ok('intel: EXIT marker', m.sim.objectives.some((o) => o.label === 'EXIT'));
  tp(p, start.x, start.z); steps(m, 12);
  ok('intel: extraction wins', m.phase === 'over' && m.result === 'win', { phase: m.phase, r: m.result });
  ok('intel: undetected run', m.op!.report.undetected);
}
// Assassinate: the target escapes after the alarm.
{
  const m = make({ kind: 'assassinate', targetName: 'The Courier', guards: 1, patrols: 0, stealth: true, escapeAfter: 5, size: 38 });
  const p = m.player;
  p.lastShotT = m.sim.time;
  tp(p, enemies(m)[0].x + 5, enemies(m)[0].z);
  steps(m, 12);
  ok('assassinate: alarm starts the escape clock', m.statusFor(p, () => 'x')!.includes('escapes in'), m.statusFor(p, () => 'x'));
  p.protectedUntil = 1e9;
  steps(m, 6 * 60);
  ok('assassinate: target escaped = failed', m.phase === 'over' && m.result === 'lose' && /escaped/.test(m.banner), m.banner);
}
// Assassinate: take the target down, then extract.
{
  const m = make({ kind: 'assassinate', targetName: 'The Courier', guards: 2, patrols: 0, stealth: true, escapeAfter: 30, size: 38 });
  const p = m.player;
  const start = { x: p.x, z: p.z };
  const t = m.sim.agents.find((a) => m.op!.names[a.id] === 'The Courier')!;
  m.sim.damage(t, p, 999, 'head', 0, 0, 1, 'rifle');
  steps(m, 6);
  ok('assassinate: target down, go to extraction', m.op!.phase === 'extract', m.op!.phase);
  tp(p, start.x, start.z); steps(m, 12);
  ok('assassinate: win', m.result === 'win');
}
// Rescue: free the hostage, they follow, extract with them.
{
  const m = make({ kind: 'rescue', targetName: 'Dr. Reyes', guards: 0, patrols: 0, stealth: true, size: 38 });
  const p = m.player;
  const start = { x: p.x, z: p.z };
  const h = m.sim.agents.find((a) => m.op!.names[a.id] === 'Dr. Reyes')!;
  tp(p, h.x + 1, h.z); steps(m, 6 * 20);
  ok('rescue: freed after standing by them', m.op!.phase === 'extract', m.op!.phase);
  ok('rescue: freeing them does not count as spotted', m.op!.report.undetected);
  tp(p, h.x + 10, h.z); const d0 = Math.hypot(h.x - p.x, h.z - p.z); steps(m, 120);
  ok('rescue: hostage follows you', Math.hypot(h.x - p.x, h.z - p.z) < d0 - 2, { d0, d1: Math.hypot(h.x - p.x, h.z - p.z) });
  tp(p, start.x, start.z); tp(h, start.x + 1, start.z); steps(m, 12);
  ok('rescue: win with the hostage at extraction', m.result === 'win', { r: m.result, b: m.banner });
}
{
  const m = make({ kind: 'rescue', targetName: 'Dr. Reyes', guards: 1, patrols: 0, stealth: true, size: 38 });
  const h = m.sim.agents.find((a) => m.op!.names[a.id] === 'Dr. Reyes')!;
  m.sim.damage(h, enemies(m)[0], 999, 'torso', 0, 0, 1, 'rifle');
  steps(m, 6);
  ok('rescue: hostage killed = failed', m.result === 'lose' && /make it/.test(m.banner), m.banner);
}
// Sabotage: plant each charge, then beat the fuse.
{
  const m = make({ kind: 'sabotage', items: 2, fuse: 3, guards: 0, patrols: 0, stealth: true, size: 38 });
  const p = m.player;
  for (const o of m.sim.objectives.slice()) { tp(p, o.x, o.z); steps(m, 6 * 33); }
  ok('sabotage: all planted, fuse running', m.op!.phase === 'extract' && /blast in/.test(m.statusFor(p, () => 'x')!), m.statusFor(p, () => 'x'));
  steps(m, 6 * 40);
  ok('sabotage: too slow = failed', m.result === 'lose', m.banner);
}
// Defend: time only counts inside the ring.
{
  const m = make({ kind: 'defend', hold: 3, guards: 0, patrols: 0, stealth: false, size: 36 });
  const p = m.player;
  const hold = m.sim.objectives.find((o) => o.label === 'HOLD')!;
  tp(p, hold.x + 30, hold.z); steps(m, 6 * 40);
  ok('defend: outside the ring nothing counts', m.phase !== 'over');
  tp(p, hold.x, hold.z); steps(m, 6 * 35);
  ok('defend: held = win', m.result === 'win', m.banner);
}
// Lives: back to the start, then out of lives = failed.
{
  const m = make({ kind: 'intel', items: 2, guards: 1, patrols: 0, stealth: false, lives: 2, size: 38 });
  const p = m.player;
  const e = enemies(m)[0];
  m.sim.damage(p, e, 999, 'torso', 0, 0, 1, 'rifle');
  steps(m, 6 * 35);
  ok('lives: respawned after a death', p.alive && m.phase !== 'over');
  p.protectedUntil = 0;
  m.sim.damage(p, e, 999, 'torso', 0, 0, 1, 'rifle');
  steps(m, 12);
  ok('lives: out of lives = failed', m.result === 'lose' && /lives/.test(m.banner), m.banner);
}
// Escape and fixed loadouts.
{
  const m = make({ kind: 'escape', guards: 3, patrols: 0, stealth: false, size: 44 });
  const exit = m.sim.objectives.find((o) => o.label === 'EXIT')!;
  ok('escape: starts far from the exit', Math.hypot(m.player.x - exit.x, m.player.z - exit.z) > 30, Math.hypot(m.player.x - exit.x, m.player.z - exit.z));
  tp(m.player, exit.x, exit.z); steps(m, 12);
  ok('escape: reaching the exit wins', m.result === 'win');
  const s = make({ kind: 'assassinate', targetName: 'B', loadout: ['sniper', 'pistol'], guards: 1, patrols: 0, stealth: true, size: 40 });
  ok('loadout: mission gives the sniper', s.player.weapons[0] === 'sniper');
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exitCode = fails ? 1 : 0;
