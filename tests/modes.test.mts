// Drives the new modes' rules directly: course checkpoints/falls/finish, race, tag passing, dodgeball rounds.
import { Match } from '../src/sim/Match.ts';
import { COURSE } from '../src/sim/layouts.ts';
const NO_INPUT: any = { forward: 0, right: 0, yaw: 0, pitch: 0, fire: false, aim: false, reload: false, jump: false, sprint: false, crouch: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };

let fails = 0;
const ok = (label: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ' ' + JSON.stringify(extra)}`);
  if (!cond) fails++;
};
const steps = (m: Match, n: number) => { for (let i = 0; i < n; i++) m.step(NO_INPUT); };
const put = (a: any, x: number, z: number, y: number) => { a.x = x; a.z = z; a.y = y; a.vx = a.vz = a.vy = 0; };

// --- Course.
{
  const m = new Match({ mode: 'course', difficulty: 'normal', botControl: 'heuristic', seed: 1 });
  const p = m.player;
  ok('course: one player, knife only', m.sim.agents.length === 1 && p.weapons.join() === 'knife', p.weapons);
  steps(m, 10);
  // Walk off the start pad onto the first step.
  put(p, 0, -43, 0.8); steps(m, 12);
  ok('course: clock started', m.party.course.started[p.id] !== undefined);
  put(p, 0, -14, 2.4); steps(m, 12);
  ok('course: checkpoint 1', m.party.course.cp[p.id] === 1, m.party.course.cp);
  // Fall off the beam to the ground.
  put(p, 4, -4, 0); steps(m, 12);
  ok('course: fall resets to checkpoint 1', Math.hypot(p.x - 0, p.z + 14) < 0.5 && p.y >= 2.3, { x: p.x, z: p.z, y: p.y });
  ok('course: fall counted', m.party.course.falls[p.id] === 1);
  for (const k of COURSE.checkpoints.slice(2)) { put(p, k.x, k.z, k.h); steps(m, 12); }
  ok('course: checkpoint 4', m.party.course.cp[p.id] === 4);
  put(p, 0, 66, 0); steps(m, 12);
  ok('course: finished', m.phase === 'over' && m.party.course.finished[p.id] > 0, m.phase);
  ok('course: status line', (m.statusFor(p, () => 'x') ?? '').includes('checkpoint'), m.statusFor(p, () => 'x'));
}

// --- Race (two humans): first across wins.
{
  const m = new Match({ mode: 'race', difficulty: 'normal', botControl: 'heuristic', humans: 2, seed: 2 });
  ok('race: two racers, no bots', m.sim.agents.length === 2, m.sim.agents.length);
  const [a, b] = m.sim.agents;
  b.control = 'external';
  steps(m, 12);
  put(b, 0, -14, 2.4); steps(m, 12);
  ok('race: other ahead in places', (m.statusFor(a, () => 'x') ?? '').startsWith('Place 2'), m.statusFor(a, () => 'x'));
  put(b, 0, 66, 0); steps(m, 12);
  ok('race: other wins', m.phase === 'over' && m.winTeam === b.team, { phase: m.phase, win: m.winTeam });
}

// --- Tag.
{
  const m = new Match({ mode: 'tag', difficulty: 'normal', botControl: 'heuristic', humans: 3, seed: 3 });
  ok('tag: three players, no bots', m.sim.agents.length === 3, m.sim.agents.length);
  for (const a of m.sim.agents) if (a !== m.player) a.control = 'external';
  steps(m, 30);
  const it = m.party.holder;
  ok('tag: someone is IT', it >= 0);
  const others = m.sim.agents.filter((a) => a.id !== it);
  steps(m, 150);
  m.sim.onMeleeHit!(m.sim.agents[it], others[0]);
  ok('tag: passed', m.party.holder === others[0].id);
  m.sim.onMeleeHit!(others[0], m.sim.agents[it]);
  ok('tag: no instant tag-back', m.party.holder === others[0].id);
  ok('tag: IT time counted', (m.party.itTime[it] ?? 0) > 2, m.party.itTime);
  m.sim.time = m['startTime'] + 151; steps(m, 12);
  ok('tag: ends after 2.5 min', m.phase === 'over');
}

// --- Dodgeball.
{
  const m = new Match({ mode: 'dodgeball', difficulty: 'normal', botControl: 'heuristic', humans: 2, seed: 4 });
  const [a, b] = m.sim.agents;
  ok('dodgeball: two teams', a.team !== b.team, [a.team, b.team]);
  ok('dodgeball: balls as lethal', a.lethal === 'ball' && a.grenades > 50 && a.tacticals === 0, { l: a.lethal, g: a.grenades });
  b.control = 'external';
  steps(m, 10);
  // Throw straight at the other player.
  put(a, 0, 0, 0); put(b, 0, 6, 0);
  a.protectedUntil = 0; b.protectedUntil = 0;
  const thrown = m.sim.throwItem(a, 'lethal', 0, 0.05);
  steps(m, 40);
  ok('dodgeball: thrown', thrown);
  ok('dodgeball: hit = out', !b.alive, { alive: b.alive, hp: b.hp });
  ok('dodgeball: balls refilled', a.grenades === 99, a.grenades);
  ok('dodgeball: round scored', m.scores[a.team] === 1, m.scores);
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exitCode = fails ? 1 : 0;
