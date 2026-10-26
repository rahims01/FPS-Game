// Screenshots of the newer features: weapons, scope, grenades, flags, medals.
//   node scripts/features.mjs <mode> [outDir]
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require('../../Battle Simulator/node_modules/puppeteer-core');
}
const mode = process.argv[2] ?? 'dom';
const out = process.argv[3] ?? 'screenshots';
fs.mkdirSync(out, { recursive: true });
const names = { tdm: 'Team Deathmatch', kc: 'Kill Confirmed', dom: 'Domination', ctf: 'Capture the Flag', infected: 'Infected', gungame: 'Gun Game', snipers: 'Snipers Only', ffa: 'Free-for-all' };
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9334', defaultViewport: null });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => [...document.querySelectorAll('button.play')].some((b) => b.textContent.startsWith('FIND MATCH')), { timeout: 120000 });
await page.screenshot({ path: `${out}/menu.png` });
await page.evaluate((name) => [...document.querySelectorAll('button.mode')].find((b) => b.querySelector('strong').textContent.startsWith(name)).click(), names[mode]);
await page.evaluate(() => document.querySelector('button.play').click());
await page.waitForFunction(() => [...document.querySelectorAll('button.play')].some((b) => b.textContent === 'DEPLOY' && !b.disabled), { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('button.play')].find((b) => b.textContent === 'DEPLOY').click());
await page.waitForFunction(() => window.__fps, { timeout: 60000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = async (name, fn, ms = 800) => {
  await page.evaluate(fn);
  await wait(ms);
  await page.screenshot({ path: `${out}/${mode}-${name}.png` });
};
await step('start', () => {
  window.__fps.paused = false;
  window.__fps.match.sim.damageToPlayerScale = 0;
}, 2500);
await step('play', () => {}, Number(process.env.PLAY ?? 15000));
// Look at the nearest other player from 6 m.
await step('enemy', () => {
  const g = window.__fps;
  const sim = g.match.sim;
  const p = g.match.player;
  const e = sim.agents.filter((a) => a !== p && a.alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (!e) return;
  const spot = sim.arena.randomFreePoint(() => 0.5, 0, 0, 3) ?? { x: p.x, z: p.z };
  p.x = spot.x;
  p.z = spot.z;
  e.x = p.x + 0.6;
  e.z = p.z + 6;
  e.control = 'external';
  e.action = 0;
  g.yaw = 0;
  g.pitch = -0.05;
});
await step('ads', () => {
  window.__fps.mouse.right = true;
}, 900);
await step('grenade', () => {
  const g = window.__fps;
  g.mouse.right = false;
  const p = g.match.player;
  p.grenades = 2;
  g.match.sim.throwGrenade(p, g.yaw, 0.35, 12);
}, 2700);
await step('switch', () => {
  window.__fps.switchQueued = 1;
}, 900);
await step('knife', () => {
  window.__fps.meleeQueued = true;
}, 150);
await step('scoreboard', () => window.__fps.keys.add('Tab'), 300);
console.log(logs.filter((l) => !l.includes('vite') && !l.includes('DevTools') && !l.includes('skinning')).slice(0, 15).join('\n'));
await page.close();
await browser.disconnect();
