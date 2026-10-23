// Two-browser multiplayer smoke test: page A hosts, page B joins by room code,
// the host starts a match and both sides are checked.
//   node scripts/mp-test.mjs [mode] [outDir]
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require('../../Battle Simulator/node_modules/puppeteer-core');
}
const modeName = process.argv[2] ?? '1v1 Duel';
const out = process.argv[3] ?? 'screenshots';
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9334', defaultViewport: null });
const open = async (label) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 680 });
  page.on('pageerror', (e) => console.log(`[${label} pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) console.log(`[${label}] ${m.text()}`);
  });
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelectorAll('button.play')].some((b) => b.textContent === 'FIND MATCH'), { timeout: 120000 });
  return page;
};
const clickText = (page, sel, text) => page.evaluate((sel, text) => [...document.querySelectorAll(sel)].find((b) => b.textContent.trim() === text).click(), sel, text);

const host = await open('host');
const guest = await open('guest');
await host.evaluate((name) => [...document.querySelectorAll('button.mode')].find((b) => b.querySelector('strong').textContent.startsWith(name)).click(), modeName);
await clickText(host, 'button.chip', 'Host game');
await host.waitForSelector('.room-code', { timeout: 30000 });
const code = await host.$eval('.room-code', (e) => e.textContent);
console.log('room code', code);
await guest.type('.code-input', code);
await clickText(guest, 'button.chip', 'Join');
await guest.waitForSelector('.room-code', { timeout: 30000 });
await host.waitForFunction(() => document.querySelectorAll('.lobby-players .lb-row').length >= 2, { timeout: 30000 });
await host.screenshot({ path: `${out}/mp-host-lobby.png` });
await guest.screenshot({ path: `${out}/mp-guest-lobby.png` });
await clickText(host, 'button.play', 'START');
await host.waitForFunction(() => window.__fps, { timeout: 60000 });
await guest.waitForFunction(() => window.__fps, { timeout: 60000 });
await host.evaluate(() => {
  window.__fps.paused = false;
});
await guest.evaluate(() => {
  window.__fps.paused = false;
});
await wait(3000);
const report = async (page) =>
  page.evaluate(() => {
    const g = window.__fps;
    const m = g.match;
    return {
      me: m.player.id,
      controls: m.sim.agents.map((a) => a.control).join(','),
      time: +m.sim.time.toFixed(1),
      pos: m.sim.agents.map((a) => `${a.x.toFixed(1)},${a.z.toFixed(1)}`).join(' | '),
      hp: m.sim.agents.map((a) => Math.round(a.hp)).join(','),
      shots: m.sim.agents.map((a) => a.shots + '/' + a.ammo + (a.sprinting ? 's' : '') + (a.alive ? '' : 'X')).join(','),
      yaw: m.sim.agents.map((a) => a.yaw.toFixed(2)).join(',')
    };
  });
console.log('host ', JSON.stringify(await report(host)));
console.log('guest', JSON.stringify(await report(guest)));
// Guest walks forward and the host should see it move.
await guest.evaluate(() => window.__fps.keys.add('KeyW'));
await wait(1500);
await guest.evaluate(() => window.__fps.keys.delete('KeyW'));
await wait(400);
console.log('after guest walks:');
console.log('host ', JSON.stringify(await report(host)));
console.log('guest', JSON.stringify(await report(guest)));
// The host walks into the open 6 m in front of the guest; the guest aims and fires.
await host.evaluate(() => {
  const g = window.__fps;
  const me = g.match.player;
  const guestAgent = g.match.sim.agents[1];
  me.x = guestAgent.x;
  me.z = guestAgent.z - 6;
});
await wait(800);
await guest.evaluate(() => {
  const g = window.__fps;
  const me = g.match.player;
  const target = g.match.sim.agents[0];
  g.yaw = Math.atan2(target.x - me.x, target.z - me.z);
  g.pitch = -0.08;
  g.mouse.left = true;
});
await wait(1200);
await guest.evaluate(() => {
  window.__fps.mouse.left = false;
});
await wait(500);
console.log('after guest fires:');
console.log('host ', JSON.stringify(await report(host)));
console.log('guest', JSON.stringify(await report(guest)));
await host.screenshot({ path: `${out}/mp-host.png` });
await guest.screenshot({ path: `${out}/mp-guest.png` });
await host.close();
await wait(7500);
const ended = await guest.evaluate(() => window.__fps?.netMessage ?? null);
console.log('guest after host leaves:', ended);
await guest.close();
await browser.disconnect();
