// Attachments, zombies tuning, staff-only items, the campaign's data and the event list.
import { Match } from '../src/sim/Match.ts';
import { setLoadout, weaponOf } from '../src/sim/Agent.ts';
import { WEAPONS } from '../src/sim/weapons.ts';
import { MISSIONS } from '../src/game/campaign.ts';
import { EVENTS } from '../src/game/events.ts';
import { BADGES, CARDS, CHARMS, COLLECTIONS, listedFor, TITLES, type ProfileLike } from '../src/game/cosmetics.ts';

const NO: any = { forward: 0, right: 0, yaw: 0, pitch: 0, fire: false, aim: false, reload: false, jump: false, sprint: false, crouch: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };
let fails = 0;
const ok = (label: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ' ' + JSON.stringify(extra)}`);
  if (!cond) fails++;
};
const steps = (m: Match, n: number) => { for (let i = 0; i < n; i++) m.step(NO); };

// Attachments change only the gun they're on, and only for you.
{
  const m = new Match({ mode: 'tdm', difficulty: 'normal', botControl: 'heuristic', seed: 5, primary: 'rifle', secondary: 'pistol', attachments: { rifle: { mag: 'extmag', muzzle: 'suppressor' }, sniper: { optic: 'reddot' } } } as never);
  const p = m.player;
  ok('attachments: extended mag', weaponOf(p).magazine > WEAPONS.rifle.magazine, weaponOf(p).magazine);
  ok('attachments: suppressor', weaponOf(p).suppressed === true);
  setLoadout(p, ['sniper', 'pistol']);
  ok('attachments: an optic that does not fit is ignored', !weaponOf(p).optic);
  const bot = m.sim.agents.find((a) => a !== p)!;
  ok('attachments: bots keep stock guns', weaponOf(bot).magazine === WEAPONS[bot.weapons[0]].magazine);
}

// Zombies: early waves are gentle, and nothing ever one- or two-shots you.
{
  const m = new Match({ mode: 'zombies', difficulty: 'normal', botControl: 'heuristic', seed: 3 } as never);
  steps(m, 6 * 30);
  const z = m.sim.agents.filter((a) => a.team === 1);
  ok('zombies: wave 1 is small', m.waveQueue + z.length <= 6, { queue: m.waveQueue, alive: z.length });
  ok('zombies: wave 1 claws take 5 hits', z.every((a) => a.meleeDamage <= 22), z.map((a) => a.meleeDamage));
  ok('zombies: wave 1 is slower than you', z.every((a) => a.speedMul < 0.7));
  ok('zombies: claws are slower than a knife', z.every((a) => (a.meleeRate ?? 1) > 1));
  (m as any).wave = 30;
  (m as any).waveQueue = 1;
  steps(m, 6 * 10);
  const late = m.sim.agents.filter((a) => a.team === 1 && a.alive).pop()!;
  ok('zombies: even wave 30 needs 3 claws', late.meleeDamage < 34.01 && 100 / late.meleeDamage > 2.9, late.meleeDamage);
  ok('zombies: never faster than you', late.speedMul <= 1);
}

// Staff-only items stay out of everyone else's lists; collections stay earnable.
{
  const fresh: ProfileLike = { xp: 0, matches: 0, wins: 0, kills: 0, weaponKills: {}, bestSr: 1000, rankedMatches: 0, stats: {} };
  const listed = listedFor(fresh, 1);
  ok('staff items: admin cards hidden from players', !CARDS.filter(listed).some((c) => c.unlock && 'special' in c.unlock && /Admin/.test(c.unlock.special)));
  ok('staff items: admin titles hidden from players', !TITLES.filter(listed).some((t) => t.id.startsWith('adm_')));
  ok('staff items: the admin still sees them', CARDS.filter(listedFor({ ...fresh, granted: ['adm_throne'] }, 1)).some((c) => c.id === 'adm_throne'));
  const charmed = COLLECTIONS.find((c) => c.id === 'charmed')!;
  const [, need] = charmed.progress(fresh, 1);
  ok('collections: "every charm" leaves out admin and event charms', need === CHARMS.filter((c) => !c.secret && !(c.unlock && 'special' in c.unlock)).length, need);
}

// The campaign's data.
{
  const ids = MISSIONS.map((m) => m.id);
  ok('campaign: 16 missions', MISSIONS.length === 16, MISSIONS.length);
  ok('campaign: unique ids', new Set(ids).size === ids.length);
  ok('campaign: every mission has a briefing and 3 goals', MISSIONS.every((m) => m.briefing.length > 40 && m.goals.length === 3));
  ok('campaign: four acts', new Set(MISSIONS.map((m) => m.act)).size === 4);
  ok('campaign: every operation kind appears', ['assassinate', 'rescue', 'intel', 'sabotage', 'defend', 'escape'].every((k) => MISSIONS.some((m) => m.op?.kind === k)));
  ok('campaign: the hidden mode never reaches matchmaking', MISSIONS.filter((m) => m.mode === 'op').every((m) => !!m.op));
}

// Events: each has a badge, and none of them clash.
{
  const keys = EVENTS.map((e) => e.key);
  ok('events: 26 events', EVENTS.length === 26, EVENTS.length);
  ok('events: unique keys', new Set(keys).size === keys.length);
  ok('events: a badge for every event', EVENTS.every((e) => BADGES.some((b) => b.id === `ev_${e.key}`)));
  ok('events: badges do not count toward Completionist', !!BADGES.find((b) => b.id === 'everything'));
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
