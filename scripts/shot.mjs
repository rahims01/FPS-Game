// Visual smoke test against the dev server in headless Edge.
//   1. start Edge:  msedge --headless=new --remote-debugging-port=9334 ...
//   2. npm run dev
//   3. node scripts/shot.mjs <mode> [outDir]
// Uses puppeteer-core from the sibling Battle Simulator project if it is not installed here.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require('../../Battle Simulator/node_modules/puppeteer-core');
}

const mode = process.argv[2] ?? '1v1';
const DIST = Number(process.env.SHOT_DIST ?? 7);
const out = process.argv[3] ?? 'screenshots';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.connect({ browserURL: process.env.EDGE_URL ?? 'http://127.0.0.1:9334', defaultViewport: null });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => [...document.querySelectorAll('button.play')].some((b) => b.textContent === 'FIND MATCH'), { timeout: 120000 });
await page.screenshot({ path: `${out}/${mode}-0-menu.png` });

const names = { '1v1': '1v1 Duel', '2v2': '2v2', '3v3': '3v3', tdm: 'Team Deathmatch', koth: 'King of the Hill', ffa: 'Free-for-all', headshot: 'Headhunters', instagib: 'One Shot', survival: 'Survival', br: 'Battle Royale' };
await page.evaluate((name) => [...document.querySelectorAll('button.mode')].find((b) => b.querySelector('strong').textContent === name).click(), names[mode]);
await page.evaluate(() => document.querySelector('button.play').click());
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${out}/${mode}-0b-finding.png` });
await page.waitForFunction(() => [...document.querySelectorAll('button.play')].some((b) => b.textContent === 'DEPLOY' && !b.disabled), { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('button.play')].find((b) => b.textContent === 'DEPLOY').click());
await page.waitForFunction(() => window.__fps, { timeout: 60000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.evaluate(() => {
  window.__fps.paused = false;
});
await wait(2500);
await page.screenshot({ path: `${out}/${mode}-1-start.png` });
// Let the match play out a bit, then show the Tab scoreboard.
await page.evaluate(() => {
  window.__fps.match.sim.damageToPlayerScale = 0;
});
await wait(Number(process.env.SHOT_PLAY ?? 0));
await page.screenshot({ path: `${out}/${mode}-1b-playing.png` });
await page.evaluate(() => window.__fps.keys.add('Tab'));
await wait(300);
await page.screenshot({ path: `${out}/${mode}-1c-scoreboard.png` });
await page.evaluate(() => window.__fps.keys.delete('Tab'));

// Face the nearest enemy and aim down sights.
const info = await page.evaluate((DIST) => {
  const g = window.__fps;
  const sim = g.match.sim;
  const p = g.match.player;
  const enemies = sim.agents.filter((a) => a.alive && a.team !== p.team).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const e = enemies[0];
  // Put both somewhere open and bring the enemy close for a good look.
  sim.damageToPlayerScale = 0;
  const spot = sim.arena.randomFreePoint(() => 0.5, -8, -16, 0.1) ?? { x: p.x, z: p.z };
  p.x = spot.x;
  p.z = spot.z;
  p.yaw = 0;
  e.x = p.x + 0.8;
  e.z = p.z + DIST;
  e.control = "external";
  e.action = 0;
  e.targetId = p.id;
  e.seesTarget = true;
  g.yaw = p.yaw;
  g.pitch = -0.05;
  return { player: [p.x, p.z, p.yaw], enemy: e.id, n: sim.agents.length };
}, DIST);
await wait(1200);
await page.screenshot({ path: `${out}/${mode}-2-enemy.png` });
await page.evaluate((id) => {
  const g = window.__fps;
  const e = g.match.sim.agents[id];
  e.targetId = -1;
  e.seesTarget = false;
  e.lastSeenX = e.x - 20;
  e.lastSeenZ = e.z;
  e.lastSeenT = g.match.sim.time;
}, info.enemy);
await wait(1200);
await page.screenshot({ path: `${out}/${mode}-2b-side.png` });
await page.evaluate(() => {
  const g = window.__fps;
  g.mouse.right = true;
});
await wait(600);
await page.screenshot({ path: `${out}/${mode}-3-ads.png` });

// Kill the enemy to see a ragdoll.
await page.evaluate((id) => {
  const g = window.__fps;
  g.mouse.right = false;
  const sim = g.match.sim;
  const p = g.match.player;
  const e = sim.agents[id];
  sim.damage(e, p, 500, 'torso', Math.sin(p.yaw), 0.1, Math.cos(p.yaw));
}, info.enemy);
await wait(300);
await page.screenshot({ path: `${out}/${mode}-4-ragdoll-early.png` });
await wait(1500);
await page.screenshot({ path: `${out}/${mode}-5-ragdoll.png` });

// Kill the player to see the death cam.
await page.evaluate(() => {
  const g = window.__fps;
  const sim = g.match.sim;
  const p = g.match.player;
  const e = sim.agents.find((a) => a.alive && a.team !== p.team) ?? sim.agents.find((a) => a !== p);
  sim.damage(p, e, 500, 'head', -Math.sin(p.yaw), 0, -Math.cos(p.yaw));
});
await wait(2500);
await page.screenshot({ path: `${out}/${mode}-6-deathcam.png` });
console.log(JSON.stringify(info));
console.log(logs.filter((l) => !l.includes('[vite]') && !l.includes('React DevTools')).slice(0, 20).join('\n'));
await page.close();
await browser.disconnect();
