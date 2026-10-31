// The admin arsenal: perks only off ranked, Iron Will, the Permaban, Kick, Moderator marks, the appeal and the admin streaks.
import { Match } from '../src/sim/Match.ts';
import { setLoadout } from '../src/sim/Agent.ts';
import { WEAPONS } from '../src/sim/weapons.ts';
const NO_INPUT: any = { forward: 0, right: 0, yaw: 0, pitch: 0, fire: false, aim: false, reload: false, jump: false, sprint: false, crouch: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };
let fails = 0;
const ok = (label: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ' ' + JSON.stringify(extra)}`);
  if (!cond) fails++;
};
const steps = (m: Match, n: number) => { for (let i = 0; i < n; i++) m.step(NO_INPUT); };
const fresh = (mode = 'tdm', extra: any = {}) => {
  const m = new Match({ mode, difficulty: 'normal', botControl: 'heuristic', seed: 3, adminPerks: true, ...extra } as any);
  steps(m, 5);
  for (const a of m.sim.agents) a.protectedUntil = 0;
  return m;
};

{
  ok('admin perks on in TDM', fresh().player.admin === true);
  ok('admin perks off with a ranked skill', !fresh('tdm', { skill: 0.5 }).player.admin);
  ok('admin perks off without the flag', !new Match({ mode: 'tdm', difficulty: 'normal', botControl: 'heuristic', seed: 3 } as any).player.admin);
}

// Iron Will.
{
  const m = fresh();
  const p = m.player;
  const foe = m.sim.agents.find((a) => a.team !== p.team)!;
  const before = p.hp;
  m.sim.damage(p, foe, 40, 'torso', 0, 0, 1, 'rifle');
  const adminLoss = before - p.hp;
  const m2 = fresh('tdm', { adminPerks: false });
  const p2 = m2.player, f2 = m2.sim.agents.find((a) => a.team !== p2.team)!;
  const b2 = p2.hp;
  m2.sim.damage(p2, f2, 40, 'torso', 0, 0, 1, 'rifle');
  ok('Iron Will: 15% less damage', Math.abs(adminLoss - (b2 - p2.hp) * 0.85) < 0.01, { adminLoss, plain: b2 - p2.hp });
  ok('Spotlight: hit enemy marked for the admin team', (() => { m.sim.damage(foe, p, 5, 'torso', 0, 0, 1, 'rifle'); return foe.flaggedTeam === p.team && foe.flaggedUntil > m.sim.time; })());
}

// Overclocked.
{
  const m = fresh();
  const p = m.player;
  setLoadout(p, ['sovereign', 'gavel']);
  p.ammo = 1; p.switchT = 0; p.reloadT = 0;
  (m.sim as any).startReload(p);
  ok('Overclocked: reload ×0.6', Math.abs(p.reloadT - WEAPONS.sovereign.reload * 0.6 * (p.perks.includes('quickhands') ? 0.65 : 1)) < 0.01, p.reloadT);
}

// The Permaban: everyone along the line.
{
  const m = fresh();
  const p = m.player;
  setLoadout(p, ['permaban', 'gavel']);
  const foes = m.sim.agents.filter((a) => a.team !== p.team).slice(0, 2);
  const yaw = 0;
  foes.forEach((f, i) => { f.x = p.x + Math.sin(yaw) * (6 + i * 5); f.z = p.z + Math.cos(yaw) * (6 + i * 5); f.y = p.y; f.hp = 100; f.protectedUntil = 0; f.crouch = false; });
  const hp0 = foes.map((f) => f.hp);
  p.fireCooldown = 0; p.reloadT = 0; p.switchT = 0;
  let fired = m.sim.tryFire(p, yaw, 0, 0);
  if (!foes.some((f, i) => f.hp < hp0[i] || !f.alive)) {
    // Try the other facing convention.
    foes.forEach((f, i) => { f.x = p.x - Math.sin(yaw) * (6 + i * 5); f.z = p.z - Math.cos(yaw) * (6 + i * 5); f.hp = 100; });
    p.fireCooldown = 0;
    fired = m.sim.tryFire(p, Math.PI, 0, 0);
  }
  ok('Permaban fired', fired);
  ok('Permaban: both enemies in line hit', foes.every((f) => !f.alive || f.hp < 100), foes.map((f) => [f.alive, f.hp]));
}

// The Kick: shove.
{
  const m = fresh();
  const p = m.player;
  const foe = m.sim.agents.find((a) => a.team !== p.team)!;
  foe.vx = foe.vz = 0; foe.hp = 100;
  m.sim.damage(foe, p, 5, 'torso', 0, 0, 1, 'kick');
  ok('Kick: knocked back', foe.vz > 4 && foe.vy > 0, { vz: foe.vz, vy: foe.vy });
}

// Moderator: a non-admin hit with it still marks.
{
  const m = fresh('tdm', { adminPerks: false });
  const p = m.player;
  const foe = m.sim.agents.find((a) => a.team !== p.team)!;
  m.sim.damage(foe, p, 5, 'torso', 0, 0, 1, 'moderator');
  ok('Moderator: marks the target', foe.flaggedTeam === p.team && foe.flaggedUntil > m.sim.time);
  const foe2 = m.sim.agents.filter((a) => a.team !== p.team)[1];
  m.sim.damage(foe2, p, 5, 'torso', 0, 0, 1, 'rifle');
  ok('No mark from a normal gun for non-admins', foe2.flaggedUntil <= m.sim.time);
}

// The appeal: once, in round modes only.
{
  const m = fresh('2v2');
  const p = m.player;
  const foe = m.sim.agents.find((a) => a.team !== p.team)!;
  m.sim.damage(p, foe, 999, 'torso', 0, 0, 1, 'rifle');
  ok('Appeal: survived a lethal hit', p.alive && p.hp === 35, { alive: p.alive, hp: p.hp });
  p.protectedUntil = 0;
  m.sim.damage(p, foe, 999, 'torso', 0, 0, 1, 'rifle');
  ok('Appeal: only once', !p.alive);
  const t = fresh('tdm');
  t.sim.damage(t.player, t.sim.agents.find((a) => a.team !== t.player.team)!, 999, 'torso', 0, 0, 1, 'rifle');
  ok('No appeal in TDM', !t.player.alive);
}

// Admin killstreaks.
{
  const m = fresh();
  const p = m.player;
  (m as any).callStreak(p, 'restart');
  const foes = m.sim.agents.filter((a) => a.team !== p.team && a.alive);
  ok('Server Restart: enemies stunned', foes.every((f) => f.stunUntil > m.sim.time));
  const pos = foes.map((f) => [f.x, f.z]);
  steps(m, 60);
  ok('Server Restart: stunned enemies stay put', foes.every((f, i) => !f.alive || Math.hypot(f.x - pos[i][0], f.z - pos[i][1]) < 0.05), foes.map((f, i) => Math.hypot(f.x - pos[i][0], f.z - pos[i][1])));
  const m2 = fresh();
  const kills0 = m2.player.kills;
  (m2 as any).callStreak(m2.player, 'banwave');
  steps(m2, 6 * 40);
  ok('Ban Wave: four enemies struck', m2.player.kills - kills0 === 4, { kills: m2.player.kills - kills0 });
  const m3 = fresh();
  (m3 as any).callStreak(m3.player, 'godview');
  ok('God View: team sees enemies', m3.uavUntil[m3.player.id] > m3.sim.time + 40);
}

// Killstreak Royalty and admin-only streaks.
{
  const m = fresh();
  const p = m.player;
  m.streakChoices[p.id] = ['godview', 'uav', 'airstrike'] as any;
  const called: string[] = [];
  const orig = (m as any).callStreak.bind(m);
  (m as any).callStreak = (a: any, id: string) => { if (a === p) called.push(id); orig(a, id); };
  const foes = m.sim.agents.filter((a) => a.team !== p.team);
  for (let i = 0; i < 4; i++) {
    const f = foes[i % foes.length];
    if (!f.alive) { steps(m, 400); }
    f.protectedUntil = 0;
    m.sim.damage(f, p, 999, 'torso', 0, 0, 1, 'rifle');
    steps(m, 6);
  }
  ok('Royalty: God View at 4 kills, UAV at 2', called.includes('godview') && called.includes('uav'), { called, streak: p.streak });

  const n = fresh('tdm', { adminPerks: false });
  const q = n.player;
  n.streakChoices[q.id] = ['godview', 'uav', 'airstrike'] as any;
  const got: string[] = [];
  const o2 = (n as any).callStreak.bind(n);
  (n as any).callStreak = (a: any, id: string) => { if (a === q) got.push(id); o2(a, id); };
  const nf = n.sim.agents.filter((a) => a.team !== q.team);
  for (let i = 0; i < 6; i++) {
    const f = nf[i % nf.length];
    if (!f.alive) steps(n, 400);
    f.protectedUntil = 0;
    n.sim.damage(f, q, 999, 'torso', 0, 0, 1, 'rifle');
    steps(n, 6);
  }
  ok('Non-admin never gets God View', !got.includes('godview') && got.includes('uav'), { got, streak: q.streak });
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exitCode = fails ? 1 : 0;
