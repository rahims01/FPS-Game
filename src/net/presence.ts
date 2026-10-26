/**
 * The "players online" number.
 *
 * Everyone sees the same figure at the same moment: a shared estimate worked
 * out from the clock alone (a daily rhythm on US Eastern time, busier at
 * weekends, with minute-to-minute wobble from a hash of the minute rather than
 * Math.random), plus the real people who have the game open right now, counted
 * by the presence Durable Object in the site's Worker (worker/presence.ts) behind /api/online.
 */

/** 0..1 from an integer, the same on every device. */
const hash01 = (n: number): number => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** How busy each hour is (US Eastern): quiet overnight, school-day lull, peak in the evening. */
const ACTIVITY = [0.55, 0.42, 0.32, 0.25, 0.2, 0.2, 0.25, 0.32, 0.36, 0.38, 0.42, 0.48, 0.55, 0.58, 0.62, 0.72, 0.82, 0.88, 0.94, 1, 1, 0.95, 0.85, 0.7];

/** The shared estimate for a moment in time. */
export const estimatedOnline = (now = Date.now()): number => {
  // US Eastern (fixed UTC-5), so the rhythm doesn't depend on the viewer's time zone.
  const east = new Date(now - 5 * 3600 * 1000);
  const h = east.getUTCHours() + east.getUTCMinutes() / 60;
  const i = Math.floor(h) % 24;
  const activity = ACTIVITY[i] + (ACTIVITY[(i + 1) % 24] - ACTIVITY[i]) * (h - Math.floor(h));
  const day = east.getUTCDay();
  const weekend = day === 0 || day === 6 ? 1.25 : 1;
  // Wobble eases between per-minute values so the number drifts instead of jumping.
  const minute = Math.floor(now / 60000);
  const t = (now % 60000) / 60000;
  const wobble = (hash01(minute) * (1 - t) + hash01(minute + 1) * t - 0.5) * 400;
  return Math.round((3000 + 18000 * activity) * weekend + wobble);
};

const CHECK_IN_MS = 2 * 60 * 1000;
let session = '';
let real = 0;

const newSession = (): string => {
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => n.toString(36)).join('').slice(0, 24).padEnd(8, '0');
};

const checkIn = async (leaving = false): Promise<void> => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/online`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, leaving }),
      keepalive: leaving
    });
    if (res.ok) real = ((await res.json()) as { online?: number }).online ?? 0;
  } catch {
    /* no presence on this site (local dev) or offline: the estimate alone */
  }
};

/** Starts checking in (once per tab). Hidden tabs stop checking in and drop off after a few minutes. */
export const startPresence = (): void => {
  if (session) return;
  session = newSession();
  void checkIn();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkIn();
  }, CHECK_IN_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkIn();
  });
  window.addEventListener('pagehide', () => void checkIn(true));
};

/** What to show: the shared estimate plus the real people online. */
export const playersOnline = (now = Date.now()): number => estimatedOnline(now) + real;
