import { loadProfile, saveProfile, xpForLevel, type Profile } from '../game/progression';
import { loadSettings, saveSettings, type GameSettings } from '../game/settings';
import { exportBotFriends, importBotFriends, setBotFriendsSavedHook } from '../game/botFriends';
import { onLocalSave } from '../game/saveHook';
import { ADMIN_ITEMS } from '../game/cosmetics';
import { WEAPONS } from '../sim/weapons';

/**
 * Your account: sign-up and sign-in, keeping progress in the cloud (so it
 * follows you between computers), a heartbeat that tells friends where you
 * are, news from the admin, and gifts or warnings waiting in your inbox.
 * Everything works signed out too; the account only adds to it.
 */

export interface AccountUser {
  id: number;
  name: string;
  email: string | null;
  role: 'player' | 'mod' | 'admin';
  title: string | null;
  created: number;
  mutedUntil: number;
}

export interface NewsItem {
  id: number;
  text: string;
  kind: 'info' | 'event' | 'warning' | 'celebrate';
  at: number;
  until: number;
}

export interface InboxItem {
  id: number;
  kind: 'reward' | 'warning' | 'renamed' | 'reset' | 'shout';
  body: { text?: string; name?: string; from?: string; xp?: number; levels?: number; unlocks?: string[]; weaponKills?: Record<string, number>; note?: string };
  at: number;
}

export interface EventTime {
  from: number;
  until: number;
}

export interface AccountState {
  user: AccountUser | null;
  /** Friends online, unread messages and friend requests (real accounts). */
  online: number;
  unread: number;
  requests: number;
  news: NewsItem[];
  /** Running and scheduled events (start and end, ms). */
  events: Record<string, EventTime>;
  maintenance: string | null;
  /** Messages to show the player once (warnings, gifts, renames). */
  notices: string[];
  /** When the cloud save was last written. */
  savedAt: number;
}

/** Where you are, for friends and the open-rooms list. */
export interface PresenceStatus {
  state: 'menu' | 'match' | 'lobby';
  mode?: string;
  room?: { code: string; mode: string; players: number; max: number; open: boolean };
}

const TOKEN_KEY = 'fps-account-v1';
const BACKUP_KEY = 'fps-local-backup-v1';
const HEARTBEAT_MS = 90_000;

let token: string | null = null;
let state: AccountState = { user: null, online: 0, unread: 0, requests: 0, news: [], events: {}, maintenance: null, notices: [], savedAt: 0 };
const listeners = new Set<(s: AccountState) => void>();
let statusOf: () => PresenceStatus = () => ({ state: 'menu' });
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let beatTimer: ReturnType<typeof setInterval> | null = null;
/** Set while a cloud save is being applied, so it doesn't immediately upload itself again. */
let applying = false;

try {
  const raw = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null');
  if (raw?.token) {
    token = raw.token;
    state = { ...state, user: raw.user ?? null };
  }
} catch {
  /* nothing saved */
}

const set = (patch: Partial<AccountState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
};
export const account = (): AccountState => state;
export const subscribeAccount = (fn: (s: AccountState) => void): (() => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const setPresenceSource = (fn: () => PresenceStatus) => (statusOf = fn);
export const isStaff = () => state.user?.role === 'admin' || state.user?.role === 'mod';
export const isAdmin = () => state.user?.role === 'admin';
export const dismissNotice = () => set({ notices: state.notices.slice(1) });

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; banned?: boolean };
}

/** Calls the game's API (same site). Network failures come back as status 0. */
export const api = async <T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> => {
  try {
    const res = await fetch(`/api/${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; banned?: boolean };
    // Signed out elsewhere (password reset, ban, expired): drop the stale session.
    if ((res.status === 401 && token && !path.startsWith('account/sign')) || data.banned) forget(data.error);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach the server" } as T & { error: string } };
  }
};

const remember = (t: string, user: AccountUser) => {
  token = t;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: t, user }));
  } catch {
    /* storage unavailable: signed in for this visit only */
  }
};

function forget(reason?: string): void {
  token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  stopHeartbeat();
  set({ user: null, online: 0, unread: 0, requests: 0, notices: reason ? [...state.notices, reason] : state.notices });
}

// ------------------------------------------------------------- cloud save

/** Settings that belong to this device (graphics, touch), not to you. */
const DEVICE_KEYS: (keyof GameSettings)[] = ['graphics', 'quality', 'autoQuality', 'vsync', 'fpsLimit', 'touchControls'];

interface CloudSave {
  v: 1;
  profile: Profile;
  settings: Partial<GameSettings>;
  botFriends: unknown;
}

const collect = (): CloudSave => {
  const settings = { ...loadSettings('Player', 0xffffff) } as Partial<GameSettings>;
  for (const k of DEVICE_KEYS) delete settings[k];
  return { v: 1, profile: loadProfile(), settings, botFriends: exportBotFriends() };
};

/** Replaces this browser's progress with the cloud copy (device settings stay). */
const applyCloud = (save: CloudSave) => {
  applying = true;
  try {
    if (save.profile) saveProfile({ ...loadProfile(), ...save.profile });
    if (save.settings) {
      const local = loadSettings('Player', 0xffffff);
      const merged = { ...local, ...save.settings } as GameSettings;
      for (const k of DEVICE_KEYS) (merged as unknown as Record<string, unknown>)[k] = local[k];
      saveSettings(merged);
    }
    if (save.botFriends) importBotFriends(save.botFriends);
  } finally {
    applying = false;
  }
  window.dispatchEvent(new Event('fps-save-replaced'));
};

/** Something saved locally changed: upload it shortly (batched). */
export const markDirty = (): void => {
  if (!token || applying) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), 4000);
};

export const pushNow = async (): Promise<void> => {
  pushTimer = null;
  if (!token) return;
  const r = await api<{ saveAt: number }>('account/save', { method: 'PUT', body: { save: collect() } });
  if (r.ok) set({ savedAt: r.data.saveAt });
};

// ------------------------------------------------------------- sign-up / sign-in

const afterSignIn = async (t: string, user: AccountUser, cloud: CloudSave | null) => {
  remember(t, user);
  set({ user, notices: state.notices });
  if (cloud && cloud.profile) {
    // Keep what was on this computer, in case it was the one that mattered.
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), save: collect() }));
    } catch {
      /* ignore */
    }
    applyCloud(cloud);
  } else await pushNow();
  startHeartbeat();
};

export const signUp = async (name: string, password: string, email: string): Promise<string | null> => {
  const r = await api<{ token: string; user: AccountUser }>('account/signup', { body: { name, password, email } });
  if (!r.ok) return r.data.error ?? 'Sign-up failed';
  await afterSignIn(r.data.token, r.data.user, null);
  return null;
};

export const signIn = async (login: string, password: string): Promise<string | null> => {
  const r = await api<{ token: string; user: AccountUser; save: CloudSave | null }>('account/signin', { body: { login, password } });
  if (!r.ok) return r.data.error ?? 'Sign-in failed';
  await afterSignIn(r.data.token, r.data.user, r.data.save);
  return null;
};

export const signOut = async (): Promise<void> => {
  if (pushTimer) await pushNow();
  await api('account/signout', { body: {} });
  forget();
};

/** The progress this computer had before the last sign-in replaced it. */
export const localBackup = (): { at: number } | null => {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null');
    return b?.at ? { at: b.at } : null;
  } catch {
    return null;
  }
};
export const restoreLocalBackup = (): void => {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null');
    if (b?.save) {
      applyCloud(b.save);
      markDirty();
    }
  } catch {
    /* ignore */
  }
};

// ------------------------------------------------------------- heartbeat and inbox

/** Applies a gift from the admin or a code to your progress. */
export const applyReward = (body: InboxItem['body']): void => {
  const p = loadProfile();
  if (body.xp) p.xp = Math.max(0, p.xp + body.xp);
  if (body.levels) {
    const lvl = Math.max(1, Math.min(55, levelFromXp(p.xp) + body.levels));
    p.xp = xpForLevel(lvl);
  }
  if (body.unlocks?.length) p.granted = [...new Set([...(p.granted ?? []), ...body.unlocks])];
  if (body.weaponKills) for (const [w, k] of Object.entries(body.weaponKills)) {
    if (w === '*') for (const id of Object.keys(WEAPONS)) p.weaponKills[id] = Math.max(p.weaponKills[id] ?? 0, k);
    else p.weaponKills[w] = (p.weaponKills[w] ?? 0) + k;
  }
  saveProfile(p);
  window.dispatchEvent(new Event('fps-save-replaced'));
};
const levelFromXp = (xp: number) => {
  let l = 1;
  while (l < 55 && xp >= xpForLevel(l + 1)) l++;
  return l;
};

const handleInbox = async (items: InboxItem[]) => {
  if (!items.length) return;
  const notices: string[] = [];
  for (const it of items) {
    if (it.kind === 'reward') {
      applyReward(it.body);
      notices.push(`Gift from the admin${it.body.note ? `: ${it.body.note}` : ''}`);
    } else if (it.kind === 'warning') notices.push(`Warning from a moderator: ${it.body.text}`);
    else if (it.kind === 'renamed') notices.push(`A moderator changed your username to ${it.body.name}.`);
    else if (it.kind === 'shout') notices.push(`Message from ${it.body.from ?? 'the admin'}: ${it.body.text}`);
    else if (it.kind === 'reset') {
      try {
        localStorage.removeItem('fps-profile-v1');
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event('fps-save-replaced'));
      notices.push('Your progress was reset by the admin.');
    }
  }
  set({ notices: [...state.notices, ...notices] });
  await api('inbox/ack', { body: { ids: items.map((i) => i.id) } });
  markDirty();
};

export const heartbeat = async (): Promise<void> => {
  if (!token) return;
  const r = await api<{ user: AccountUser; online: number; unread: number; requests: number; inbox: InboxItem[]; news: NewsItem[]; events: Record<string, EventTime>; maintenance: string | null }>('account/heartbeat', { body: { status: statusOf() } });
  if (!r.ok) return;
  const d = r.data;
  if (token) remember(token, d.user);
  set({ user: d.user, online: d.online, unread: d.unread, requests: d.requests, news: d.news, events: d.events, maintenance: d.maintenance });
  // Staff get their title to wear; the admin gets every admin-only item.
  const staff = d.user.role === 'admin' ? ADMIN_ITEMS : d.user.role === 'mod' ? ['staff_mod'] : null;
  if (staff) {
    const p = loadProfile();
    if (staff.some((id) => !(p.granted ?? []).includes(id))) {
      p.granted = [...new Set([...(p.granted ?? []), ...staff])];
      saveProfile(p);
      window.dispatchEvent(new Event('fps-save-replaced'));
    }
  }
  await handleInbox(d.inbox);
};

const startHeartbeat = () => {
  stopHeartbeat();
  void heartbeat();
  beatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
};
function stopHeartbeat() {
  if (beatTimer) clearInterval(beatTimer);
  beatTimer = null;
}

/** Signed out, news still shows (events, maintenance notices). */
export const refreshNews = async (): Promise<void> => {
  const r = await api<{ news: NewsItem[]; events: Record<string, EventTime>; maintenance: string | null }>('news');
  if (r.ok) set({ news: r.data.news, events: r.data.events, maintenance: r.data.maintenance });
};

/** Is a global event (double XP...) running right now? */
export const eventOn = (key: string): boolean => {
  const e = state.events[key];
  const now = Date.now();
  return !!e && e.from <= now && now < e.until;
};

/** The events running right now. */
export const liveEvents = (): string[] => Object.keys(state.events).filter(eventOn);

/** Change your account's username (once a week for players). */
export const renameAccount = async (name: string): Promise<string | null> => {
  const r = await api<{ user: AccountUser }>('account/rename', { body: { name } });
  if (!r.ok) return r.data.error ?? 'Could not change it';
  if (token) remember(token, r.data.user);
  set({ user: r.data.user });
  return null;
};

export const redeemCode = async (code: string): Promise<string> => {
  const r = await api<{ reward: InboxItem['body'] }>('redeem', { body: { code } });
  if (!r.ok) return r.data.error ?? 'That code did not work';
  applyReward(r.data.reward);
  markDirty();
  return 'Code redeemed!';
};

/** Starts things up on page load: resumes a saved session, or just fetches the news. */
export const startAccount = (): void => {
  onLocalSave(markDirty);
  setBotFriendsSavedHook(markDirty);
  if (token) startHeartbeat();
  else void refreshNews();
  // Leaving: send the last changes.
  window.addEventListener('pagehide', () => {
    if (pushTimer && token) {
      clearTimeout(pushTimer);
      try {
        void fetch('/api/account/save', { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ save: collect() }) });
      } catch {
        /* ignore */
      }
    }
  });
};
