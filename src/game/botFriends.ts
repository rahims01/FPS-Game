import type { Cosmetics } from './cosmetics';
import { afterMatch, opener, PERSONALITIES, replyTo, typingDelay, type ChatMemory, type Personality } from './botChat';
import { MODES, type ModeId } from '../sim/Match';
import type { WeaponId } from '../sim/weapons';

/**
 * Friends who are computer players. You add them from a player card like
 * anyone else; from then on they keep their own hours (online, in a match,
 * offline), chat, invite you to play, and can be watched. Saved with your
 * account so they follow you between devices.
 */

export interface ChatLine {
  mine: boolean;
  text: string;
  at: number;
  invite?: { mode: string };
}

export interface BotFriend {
  key: string;
  name: string;
  seed: number;
  color: number;
  level: number;
  prestige: number;
  cosmetics: Cosmetics;
  favorite: WeaponId;
  personality: Personality;
  /** 'pending' until they accept the request. */
  state: 'pending' | 'friends';
  acceptAt: number;
  addedAt: number;
  chat: ChatLine[];
  unread: number;
  memory: ChatMemory;
  /** When they last messaged first, so they don't pester. */
  lastOpener: number;
}

export interface BotStatus {
  online: boolean;
  state: 'offline' | 'menu' | 'match';
  /** The mode they're playing, when in a match. */
  mode?: ModeId;
  /** Minutes since they were last on, when offline. */
  lastSeenMin?: number;
}

const KEY = 'fps-botfriends-v1';
const MAX_CHAT = 60;
const BLOCK_MS = 30 * 60_000;
const SUB_MS = 6 * 60_000;

/** Modes bots like to play (most of what a player would pick). */
const BOT_MODES: ModeId[] = ['tdm', 'ffa', 'kc', 'dom', 'gunfight', 'zombies', 'hardpoint', 'gungame', 'snd', 'ctf'].filter((m) => MODES.some((d) => d.id === m)) as ModeId[];
export const modeName = (m: string): string => MODES.find((d) => d.id === m)?.name ?? m;

const hash = (...n: number[]): number => {
  let h = 2166136261;
  for (const x of n) {
    h ^= x | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return (h >>> 0) / 4294967296;
};
export const seedOf = (name: string): number => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  return h >>> 0;
};

/** How likely anyone is to be playing at this hour (local time). */
const HOURS = [0.04, 0.02, 0.01, 0.01, 0.01, 0.02, 0.05, 0.12, 0.22, 0.25, 0.25, 0.28, 0.32, 0.3, 0.32, 0.45, 0.58, 0.62, 0.6, 0.62, 0.6, 0.48, 0.3, 0.12];

let friends: BotFriend[] = load();
const listeners = new Set<() => void>();
/** Replies waiting to be "typed" (in memory: a closed tab drops them, like a real conversation would). */
const queue: { key: string; at: number; line: ChatLine }[] = [];
/** Who is typing right now, for the "typing..." indicator. */
const typing = new Set<string>();
let onSaved: (() => void) | null = null;

function load(): BotFriend[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(friends));
  } catch {
    /* storage unavailable */
  }
  onSaved?.();
  for (const l of listeners) l();
};

/** Cloud save: everything that describes your bot friends. */
export const exportBotFriends = (): BotFriend[] => friends;
export const importBotFriends = (list: unknown): void => {
  if (!Array.isArray(list)) return;
  friends = list as BotFriend[];
  save();
};
export const setBotFriendsSavedHook = (fn: () => void) => (onSaved = fn);
export const subscribeBotFriends = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const botFriends = (): BotFriend[] => friends;
export const isTyping = (key: string) => typing.has(key);
export const botFriendByName = (name: string) => friends.find((f) => f.name.toLowerCase() === name.toLowerCase());

/** Where a bot friend is right now. Deterministic, so it's the same on every device. */
export const statusOf = (f: BotFriend, now = Date.now()): BotStatus => {
  const activity = 0.55 + hash(f.seed, 1) * 0.8;
  const onlineAt = (t: number) => {
    const block = Math.floor(t / BLOCK_MS);
    const hour = new Date(t).getHours();
    return hash(f.seed, block, 7) < HOURS[hour] * activity;
  };
  if (!onlineAt(now)) {
    let back = 1;
    while (back < 96 && !onlineAt(now - back * BLOCK_MS)) back++;
    return { online: false, state: 'offline', lastSeenMin: back >= 96 ? undefined : Math.round((back * BLOCK_MS - (now % BLOCK_MS)) / 60_000) };
  }
  const sub = Math.floor(now / SUB_MS);
  if (hash(f.seed, sub, 3) < 0.3) return { online: true, state: 'menu' };
  // Mostly their favourite few modes.
  const fav = Math.floor(hash(f.seed, 11) * BOT_MODES.length);
  const mode = hash(f.seed, sub, 5) < 0.55 ? BOT_MODES[fav] : BOT_MODES[Math.floor(hash(f.seed, sub, 9) * BOT_MODES.length)];
  return { online: true, state: 'match', mode };
};

/** Their level creeps up the longer you've been friends (they play too). */
export const levelNow = (f: BotFriend, now = Date.now()): number => Math.min(55, f.level + Math.floor((now - f.addedAt) / (2.5 * 24 * 3600_000)));

/** Lifetime stats for their card, made up from their level and seed but steady between looks. */
export const statsOf = (f: BotFriend, now = Date.now()) => statsFor(f.seed, levelNow(f, now), f.prestige);

/** The same made-up lifetime stats for any computer player, from their name's seed and level. */
export const statsFor = (seed: number, level: number, prestige: number) => {
  const f = { seed };
  const lvl = level + prestige * 55;
  const matches = Math.round(lvl * (9 + hash(f.seed, 21) * 8));
  const skill = 0.8 + hash(f.seed, 22) * 0.9;
  const kills = Math.round(matches * (9 + 7 * skill));
  return {
    matches,
    wins: Math.round(matches * (0.38 + hash(f.seed, 23) * 0.2)),
    kills,
    deaths: Math.round(kills / skill),
    headshots: Math.round(kills * (0.12 + hash(f.seed, 24) * 0.16)),
    bestStreak: 6 + Math.floor(hash(f.seed, 25) * 18),
    hours: Math.round(matches * 0.13)
  };
};

const context = (f: BotFriend, playerName: string, rand: () => number) => {
  const st = statusOf(f);
  return {
    personality: f.personality,
    favorite: f.favorite === 'rifle' ? 'm16' : f.favorite,
    favoriteMode: modeName(BOT_MODES[Math.floor(hash(f.seed, 11) * BOT_MODES.length)]).toLowerCase(),
    level: levelNow(f),
    playerName,
    busy: st.state === 'match' && rand() < 0.5,
    memory: f.memory,
    rand
  };
};

/** Send a friend request to a computer player (from their card). */
export const addBotFriend = (p: { name: string; color: number; level: number; prestige: number; cosmetics: Cosmetics; favorite: WeaponId }): BotFriend => {
  const existing = botFriendByName(p.name);
  if (existing) return existing;
  const now = Date.now();
  const seed = seedOf(p.name);
  const f: BotFriend = {
    key: `bot:${seed}`,
    name: p.name,
    seed,
    color: p.color,
    level: p.level,
    prestige: p.prestige,
    cosmetics: p.cosmetics,
    favorite: p.favorite,
    personality: PERSONALITIES[Math.floor(hash(seed, 31) * PERSONALITIES.length)],
    state: 'pending',
    acceptAt: 0,
    addedAt: now,
    chat: [],
    unread: 0,
    memory: { used: [], rude: 0 },
    lastOpener: now
  };
  // Online people accept within seconds to a minute; offline ones when they're next on.
  f.acceptAt = statusOf(f, now).online ? now + 4000 + hash(seed, now) * 50_000 : nextOnline(f, now) + 60_000;
  friends = [...friends, f];
  save();
  return f;
};

const nextOnline = (f: BotFriend, from: number): number => {
  for (let t = from; t < from + 3 * 24 * 3600_000; t += 10 * 60_000) if (statusOf(f, t).online) return t;
  return from + 24 * 3600_000;
};

export const removeBotFriend = (key: string): void => {
  friends = friends.filter((f) => f.key !== key);
  save();
};

export const markRead = (key: string): void => {
  const f = friends.find((x) => x.key === key);
  if (f && f.unread) {
    f.unread = 0;
    save();
  }
};

const push = (f: BotFriend, line: ChatLine, unread: boolean) => {
  f.chat = [...f.chat, line].slice(-MAX_CHAT);
  if (unread) f.unread++;
};

/** You send a message; they answer when (and if) they would. */
export const sendToBot = (key: string, text: string, playerName: string): void => {
  const f = friends.find((x) => x.key === key);
  if (!f || f.state !== 'friends') return;
  const now = Date.now();
  push(f, { mine: true, text: text.slice(0, 200), at: now }, false);
  save();
  const rand = Math.random;
  const st = statusOf(f, now);
  const reply = replyTo(text, context(f, playerName, rand));
  if (!reply) return;
  // Offline: they reply when they're next on (if the tab is still open then).
  const wait = st.online ? typingDelay(reply.text, rand) * (st.state === 'match' ? 2 + rand() * 6 : 1) : nextOnline(f, now) - now + 30_000 + rand() * 120_000;
  queue.push({ key, at: now + wait, line: { mine: false, text: reply.text, at: 0, invite: reply.invite } });
  // Sometimes a second, quick message after the first.
  if (st.online && rand() < 0.15) {
    const extra = replyTo('lol', context(f, playerName, rand));
    if (extra) queue.push({ key, at: now + wait + 1500 + rand() * 3000, line: { mine: false, text: extra.text, at: 0 } });
  }
};

/** A match ended: friends who played in it with you say something about it. */
export const matchEndedWith = (keys: string[], won: boolean, playerName: string): void => {
  const now = Date.now();
  for (const key of keys) {
    const f = friends.find((x) => x.key === key);
    if (!f || f.state !== 'friends' || Math.random() < 0.35) continue;
    const r = afterMatch(won, context(f, playerName, Math.random));
    queue.push({ key, at: now + 3000 + Math.random() * 9000, line: { mine: false, text: r.text, at: 0 } });
  }
};

/**
 * Called every few seconds while the game is open: accepts requests, delivers
 * typed replies, and now and then lets an online friend message first.
 */
export const tickBotFriends = (playerName: string, now = Date.now()): void => {
  let changed = false;
  for (const f of friends) {
    if (f.state === 'pending' && now >= f.acceptAt) {
      f.state = 'friends';
      f.lastOpener = now;
      if (Math.random() < 0.6) queue.push({ key: f.key, at: now + 2000 + Math.random() * 8000, line: { mine: false, text: replyTo('hi', context(f, playerName, Math.random))?.text ?? 'hey', at: 0 } });
      changed = true;
    }
  }
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    const f = friends.find((x) => x.key === q.key);
    if (!f) {
      queue.splice(i, 1);
      continue;
    }
    const left = q.at - now;
    if (left <= 0) {
      queue.splice(i, 1);
      typing.delete(q.key);
      push(f, { ...q.line, at: now }, true);
      changed = true;
    } else if (left < typingDelay(q.line.text, () => 0.5) * 0.8 && statusOf(f, now).online && !typing.has(q.key)) {
      typing.add(q.key);
      for (const l of listeners) l();
    }
  }
  // An online friend messages first: rarely, and not again for a while.
  for (const f of friends) {
    if (f.state !== 'friends' || now - f.lastOpener < 25 * 60_000 || queue.some((q) => q.key === f.key)) continue;
    if (!statusOf(f, now).online || Math.random() > 0.004) continue;
    f.lastOpener = now;
    const r = opener(context(f, playerName, Math.random));
    queue.push({ key: f.key, at: now + 1000, line: { mine: false, text: r.text, at: 0, invite: r.invite } });
    changed = true;
  }
  if (changed) save();
};

export const unreadBotMessages = (): number => friends.reduce((n, f) => n + f.unread, 0);

/** What mode a chat message means ("tdm", "zombies", "1v1", "search"...), defaulting to Team Deathmatch. */
export const resolveMode = (text: string): ModeId => {
  const t = text.toLowerCase().trim();
  const alias: Record<string, ModeId> = {
    tdm: 'tdm', 'team deathmatch': 'tdm', ffa: 'ffa', 'free for all': 'ffa', duel: '1v1', '1v1': '1v1', gunfight: 'gunfight', zombies: 'zombies',
    'kill confirmed': 'kc', kc: 'kc', domination: 'dom', dom: 'dom', search: 'snd', snd: 'snd', 'search & destroy': 'snd', 'gun game': 'gungame',
    'battle royale': 'br', br: 'br', paintball: 'paintball', ctf: 'ctf', 'capture the flag': 'ctf', infected: 'infected', boss: 'boss', survival: 'survival', hardpoint: 'koth', koth: 'koth'
  };
  return alias[t] ?? (MODES.find((m) => m.id === t || m.name.toLowerCase() === t)?.id as ModeId | undefined) ?? 'tdm';
};
