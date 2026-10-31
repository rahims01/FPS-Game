/**
 * Accounts: sign-up and sign-in, cloud saves, friends, messages, reports,
 * news, gift codes, the open-rooms list and the admin tools. One Durable
 * Object with its own SQLite database (free plan), so every request sees the
 * same data and nothing needs a separate database to set up.
 *
 * Passwords are salted PBKDF2 hashes; session tokens are stored only as
 * hashes. The admin account is created from two dashboard Secrets on its first
 * sign-in (ADMIN_EMAIL, ADMIN_PASSWORD), so no password lives in the code.
 */

/** The parts of the Durable Object API used here. */
interface SqlCursor {
  toArray(): Record<string, unknown>[];
}
export interface DoState {
  storage: { sql: { exec(query: string, ...bindings: unknown[]): SqlCursor } };
}
export interface AccountsEnv {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

type Row = Record<string, unknown>;
type Role = 'player' | 'mod' | 'admin';

interface User {
  id: number;
  name: string;
  email: string | null;
  role: Role;
  created: number;
  banned_until: number;
  ban_reason: string | null;
  muted_until: number;
  title: string | null;
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** PBKDF2 rounds: kept modest because the free plan allows little CPU per request. Stored per account so it can rise later. */
const ITERATIONS = 20_000;
const SESSION_IDLE = 90 * DAY;
/** Signed-in players count as online this long after their last heartbeat (clients beat every 90 s). */
const ONLINE_MS = 3 * MIN;
const ROOM_TTL = 3 * MIN;
const MAX_SAVE = 256 * 1024;
const NAME = /^[A-Za-z0-9_]{3,16}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PERMANENT = 8_640_000_000_000_000;

/**
 * Words that can't be in a username and get masked in chat. Kept short and
 * obvious; admins can rename anything that slips through.
 */
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'retard', 'whore', 'slut', 'dick', 'pussy', 'nazi', 'hitler', 'porn', 'sex', 'kys'];
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'staff', 'system', 'support', 'official'];

const blocked = (s: string) => {
  // Look-alike digits become letters first, then everything else is dropped ("sh1t" -> "shit").
  const flat = s.toLowerCase().replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
  return BLOCKED.some((w) => flat.includes(w));
};
const maskChat = (s: string) => {
  let out = s;
  for (const w of BLOCKED) out = out.replace(new RegExp(w.split('').join('[^a-z]?'), 'gi'), (m) => '*'.repeat(m.length));
  return out;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

const pbkdf2 = async (password: string, salt: string, iterations: number) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return hex(bits);
};

/** Constant-time string compare (password and hash checks). */
const same = (a: string, b: string) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};

/** What a reward (code, admin gift) can hold. The client applies it to the player's save. */
export interface Reward {
  xp?: number;
  levels?: number;
  /** Cosmetic ids (cards, titles, charms...) unlocked outright; "*" means everything. */
  unlocks?: string[];
  /** Kills added to weapons (camos), e.g. { rifle: 100 }; "*" means every weapon. */
  weaponKills?: Record<string, number>;
  note?: string;
}

const cleanReward = (r: unknown): Reward | null => {
  if (!r || typeof r !== 'object') return null;
  const x = r as Reward;
  const out: Reward = {};
  if (Number.isFinite(x.xp)) out.xp = Math.max(-10_000_000, Math.min(10_000_000, Math.round(x.xp!)));
  if (Number.isFinite(x.levels)) out.levels = Math.max(-55, Math.min(55, Math.round(x.levels!)));
  if (Array.isArray(x.unlocks)) out.unlocks = x.unlocks.filter((u) => typeof u === 'string' && u.length < 40).slice(0, 200);
  if (x.weaponKills && typeof x.weaponKills === 'object') {
    out.weaponKills = {};
    for (const [k, v] of Object.entries(x.weaponKills)) if (k.length < 20 && Number.isFinite(v)) out.weaponKills[k] = Math.max(0, Math.min(100_000, Math.round(v)));
  }
  if (typeof x.note === 'string') out.note = x.note.slice(0, 140);
  return Object.keys(out).length ? out : null;
};

export class Accounts {
  private sql: DoState['storage']['sql'];
  /** Failed sign-ins and sign-ups by key, for slowing down guessing (memory only). */
  private attempts = new Map<string, { n: number; until: number }>();

  constructor(state: DoState, private env: AccountsEnv) {
    this.sql = state.storage.sql;
    this.migrate();
  }

  private q(query: string, ...b: unknown[]): Row[] {
    return this.sql.exec(query, ...b).toArray();
  }
  private one(query: string, ...b: unknown[]): Row | undefined {
    return this.q(query, ...b)[0];
  }

  private migrate(): void {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, lname TEXT NOT NULL UNIQUE, email TEXT, lemail TEXT, hash TEXT NOT NULL, salt TEXT NOT NULL, iters INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'player', created INTEGER NOT NULL, last_seen INTEGER NOT NULL DEFAULT 0, status TEXT, banned_until INTEGER NOT NULL DEFAULT 0, ban_reason TEXT, muted_until INTEGER NOT NULL DEFAULT 0, title TEXT, save TEXT, save_at INTEGER NOT NULL DEFAULT 0)`,
      `CREATE INDEX IF NOT EXISTS users_email ON users (lemail)`,
      `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid INTEGER NOT NULL, created INTEGER NOT NULL, last INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS friends (a INTEGER NOT NULL, b INTEGER NOT NULL, state TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (a, b))`,
      `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, src INTEGER NOT NULL, dst INTEGER NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)`,
      `CREATE INDEX IF NOT EXISTS messages_pair ON messages (dst, src, id)`,
      `CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter INTEGER, target_uid INTEGER, target_name TEXT NOT NULL, reason TEXT NOT NULL, details TEXT, context TEXT, at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'open', handled_by INTEGER, note TEXT)`,
      `CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, until INTEGER NOT NULL, by INTEGER)`,
      `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, admin INTEGER NOT NULL, action TEXT NOT NULL, target TEXT, details TEXT, at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, reward TEXT NOT NULL, uses_left INTEGER NOT NULL, until INTEGER NOT NULL, by INTEGER, at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS redeemed (code TEXT NOT NULL, uid INTEGER NOT NULL, PRIMARY KEY (code, uid))`,
      `CREATE TABLE IF NOT EXISTS inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, uid INTEGER, host TEXT NOT NULL, mode TEXT NOT NULL, players INTEGER NOT NULL, max INTEGER NOT NULL, open INTEGER NOT NULL, updated INTEGER NOT NULL)`
    ];
    for (const t of tables) this.sql.exec(t);
    // Columns added after the first release (the ALTER fails harmlessly once they exist).
    for (const alter of ['ALTER TABLE users ADD COLUMN renamed_at INTEGER NOT NULL DEFAULT 0']) {
      try {
        this.sql.exec(alter);
      } catch {
        /* already there */
      }
    }
  }

  // ------------------------------------------------------------- helpers

  private user(id: number): User | undefined {
    return this.one('SELECT id, name, email, role, created, banned_until, ban_reason, muted_until, title FROM users WHERE id = ?', id) as User | undefined;
  }

  private publicUser(u: User, now: number) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      title: u.title,
      created: u.created,
      mutedUntil: u.muted_until > now ? u.muted_until : 0
    };
  }

  private async session(request: Request, now: number): Promise<User | null> {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const key = await sha256(token);
    const s = this.one('SELECT uid, last FROM sessions WHERE token = ?', key);
    if (!s || now - (s.last as number) > SESSION_IDLE) return null;
    const u = this.user(s.uid as number);
    if (!u) return null;
    // Touch at most once a minute, to keep writes down.
    if (now - (s.last as number) > MIN) this.sql.exec('UPDATE sessions SET last = ? WHERE token = ?', now, key);
    return u;
  }

  private async newSession(uid: number, now: number): Promise<string> {
    const token = randomHex(32);
    this.sql.exec('INSERT INTO sessions (token, uid, created, last) VALUES (?, ?, ?, ?)', await sha256(token), uid, now, now);
    // Keep at most 10 devices signed in per account.
    this.sql.exec('DELETE FROM sessions WHERE uid = ? AND token NOT IN (SELECT token FROM sessions WHERE uid = ? ORDER BY last DESC LIMIT 10)', uid, uid);
    return token;
  }

  /** Too many failures for this key (account name or address) recently? */
  private limited(key: string, now: number): number {
    const a = this.attempts.get(key);
    return a && a.n >= 8 && now < a.until ? a.until : 0;
  }
  private failed(key: string, now: number): void {
    const a = this.attempts.get(key);
    if (!a || now > a.until) this.attempts.set(key, { n: 1, until: now + 10 * MIN });
    else a.n++;
    if (this.attempts.size > 50_000) this.attempts.clear();
  }

  private log(admin: User, action: string, target: string | number | null, details?: unknown): void {
    this.sql.exec('INSERT INTO audit (admin, action, target, details, at) VALUES (?, ?, ?, ?, ?)', admin.id, action, target === null ? null : String(target), details === undefined ? null : JSON.stringify(details), Date.now());
  }

  private give(uid: number, kind: string, body: unknown, now: number): void {
    this.sql.exec('INSERT INTO inbox (uid, kind, body, at) VALUES (?, ?, ?, ?)', uid, kind, JSON.stringify(body), now);
  }

  private kv(k: string): string | null {
    return (this.one('SELECT v FROM kv WHERE k = ?', k)?.v as string | undefined) ?? null;
  }
  private setKv(k: string, v: string | null): void {
    if (v === null) this.sql.exec('DELETE FROM kv WHERE k = ?', k);
    else this.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, v);
  }

  private news(now: number) {
    const items = this.q('SELECT id, text, kind, at, until FROM news WHERE until > ? ORDER BY at DESC LIMIT 5', now);
    return { news: items, events: this.events(now), maintenance: this.kv('maintenance') };
  }

  /** Running and scheduled events (older saves kept just an end time). */
  private events(now: number): Record<string, { from: number; until: number }> {
    const raw = JSON.parse(this.kv('events') ?? '{}') as Record<string, number | { from: number; until: number }>;
    const out: Record<string, { from: number; until: number }> = {};
    for (const [k, v] of Object.entries(raw)) {
      const e = typeof v === 'number' ? { from: 0, until: v } : v;
      if (e.until > now) out[k] = e;
    }
    return out;
  }

  private banText(u: User, now: number): string | null {
    if (u.banned_until <= now) return null;
    const until = u.banned_until >= PERMANENT ? 'permanently' : `until ${new Date(u.banned_until).toUTCString()}`;
    return `This account is banned ${until}${u.ban_reason ? `: ${u.ban_reason}` : '.'}`;
  }

  /**
   * The admin account comes from the dashboard Secrets. Signing in with the
   * admin email and the ADMIN_PASSWORD secret always works: it creates the
   * account the first time, and promotes (and re-keys) an account that was
   * made with that email before the secrets were set. Pasted values are
   * forgiven surrounding quotes and spaces.
   */
  private async adminSignIn(login: string, password: string, now: number): Promise<User | null> {
    const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
    const email = clean(this.env.ADMIN_EMAIL).toLowerCase();
    const pass = clean(this.env.ADMIN_PASSWORD);
    if (!email || !pass || login.trim().toLowerCase() !== email) return null;
    const existing = this.one('SELECT id FROM users WHERE lemail = ?', email);
    if (existing) this.sql.exec("UPDATE users SET role = 'admin', title = COALESCE(title, 'Admin') WHERE id = ?", existing.id);
    if (!same(password, pass) && !same(password.trim(), pass)) return null; // their own account password may still match below
    const salt = randomHex(16);
    const hash = await pbkdf2(password, salt, ITERATIONS);
    if (existing) {
      this.sql.exec('UPDATE users SET hash = ?, salt = ?, iters = ?, banned_until = 0 WHERE id = ?', hash, salt, ITERATIONS, existing.id);
    } else {
      let name = 'Admin';
      for (let i = 2; this.one('SELECT id FROM users WHERE lname = ?', name.toLowerCase()); i++) name = `Admin${i}`;
      this.sql.exec("INSERT INTO users (name, lname, email, lemail, hash, salt, iters, role, created, title) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?, 'Admin')", name, name.toLowerCase(), clean(this.env.ADMIN_EMAIL), email, hash, salt, ITERATIONS, now);
    }
    return this.one('SELECT id, name, email, role, created, banned_until, ban_reason, muted_until, title FROM users WHERE lemail = ?', email) as unknown as User;
  }

  private friendIds(uid: number): number[] {
    return this.q("SELECT b FROM friends WHERE a = ? AND state = 'friends'", uid).map((r) => r.b as number);
  }

  // ------------------------------------------------------------- routing

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\//, '');
    const now = Date.now();
    const method = request.method;
    const body = method === 'POST' || method === 'PUT' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';

    try {
      if (path === 'news' && method === 'GET') return json(this.news(now));
      if (path === 'rooms' && method === 'GET') {
        const rooms = this.q('SELECT code, host, mode, players, max FROM rooms WHERE open = 1 AND updated > ? ORDER BY updated DESC LIMIT 40', now - ROOM_TTL);
        return json({ rooms });
      }
      if (path === 'account/signup' && method === 'POST') return this.signup(body, ip, now);
      if (path === 'account/signin' && method === 'POST') return this.signin(body, ip, now);

      const me = await this.session(request, now);
      if (!me) return fail('Not signed in', 401);
      const ban = this.banText(me, now);
      if (ban) return fail(ban, 403, { banned: true });

      if (path.startsWith('admin/')) {
        if (me.role !== 'admin' && me.role !== 'mod') return fail('Not allowed', 403);
        return this.admin(path.slice(6), method, body, url, me, now);
      }
      return this.player(path, method, body, url, me, request, now);
    } catch (e) {
      return fail(`Server error: ${(e as Error).message}`, 500);
    }
  }

  // ------------------------------------------------------------- sign-up / sign-in

  private async signup(body: Record<string, unknown>, ip: string, now: number): Promise<Response> {
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');
    const email = String(body.email ?? '').trim();
    // A whole class may share one address, so the limit is generous.
    const key = `signup:${ip}`;
    const a = this.attempts.get(key);
    if (a && a.n >= 60 && now < a.until) return fail('Too many new accounts from here. Try again later.', 429);
    if (!NAME.test(name)) return fail('Usernames are 3 to 16 letters, numbers or _');
    if (blocked(name) || RESERVED.includes(name.toLowerCase())) return fail("That username isn't allowed");
    if (password.length < 6 || password.length > 128) return fail('Passwords need at least 6 characters');
    if (email && !EMAIL.test(email)) return fail("That email doesn't look right");
    if (this.one('SELECT id FROM users WHERE lname = ?', name.toLowerCase())) return fail('That username is taken');
    if (email && this.one('SELECT id FROM users WHERE lemail = ?', email.toLowerCase())) return fail('That email already has an account');
    if (email && this.env.ADMIN_EMAIL && email.toLowerCase() === this.env.ADMIN_EMAIL.trim().replace(/^["']|["']$/g, '').trim().toLowerCase()) return fail('That email already has an account');
    if (!a || now > a.until) this.attempts.set(key, { n: 1, until: now + 60 * MIN });
    else a.n++;
    const salt = randomHex(16);
    this.sql.exec('INSERT INTO users (name, lname, email, lemail, hash, salt, iters, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', name, name.toLowerCase(), email || null, email ? email.toLowerCase() : null, await pbkdf2(password, salt, ITERATIONS), salt, ITERATIONS, now, now);
    const u = this.one('SELECT id FROM users WHERE lname = ?', name.toLowerCase())!;
    const user = this.user(u.id as number)!;
    return json({ token: await this.newSession(user.id, now), user: this.publicUser(user, now), save: null, saveAt: 0 });
  }

  private async signin(body: Record<string, unknown>, ip: string, now: number): Promise<Response> {
    const login = String(body.login ?? '').trim();
    const password = String(body.password ?? '');
    if (!login || !password) return fail('Enter your username (or email) and password');
    const lkey = `in:${login.toLowerCase()}`;
    const ikey = `ip:${ip}`;
    const wait = Math.max(this.limited(lkey, now), 0);
    if (wait) return fail(`Too many wrong passwords. Try again in ${Math.ceil((wait - now) / MIN)} min.`, 429);
    // Many players share a school address: only block an address after a lot of failures.
    const ia = this.attempts.get(ikey);
    if (ia && ia.n >= 100 && now < ia.until) return fail('Too many sign-in attempts from here. Try again later.', 429);

    const created = await this.adminSignIn(login, password, now);
    let row = created ? this.one('SELECT id, hash, salt, iters FROM users WHERE id = ?', created.id) : this.one('SELECT id, hash, salt, iters FROM users WHERE lname = ? OR lemail = ?', login.toLowerCase(), login.toLowerCase());
    if (!row || !same(await pbkdf2(password, row.salt as string, row.iters as number), row.hash as string)) {
      this.failed(lkey, now);
      this.failed(ikey, now);
      return fail('Wrong username or password', 401);
    }
    // Old hashes move up to the current strength on the next good sign-in.
    if ((row.iters as number) < ITERATIONS) {
      const salt = randomHex(16);
      this.sql.exec('UPDATE users SET hash = ?, salt = ?, iters = ? WHERE id = ?', await pbkdf2(password, salt, ITERATIONS), salt, ITERATIONS, row.id);
    }
    const user = this.user(row.id as number)!;
    const ban = this.banText(user, now);
    if (ban) return fail(ban, 403, { banned: true });
    this.attempts.delete(lkey);
    this.sql.exec('UPDATE users SET last_seen = ? WHERE id = ?', now, user.id);
    const save = this.one('SELECT save, save_at FROM users WHERE id = ?', user.id)!;
    return json({ token: await this.newSession(user.id, now), user: this.publicUser(user, now), save: save.save ? JSON.parse(save.save as string) : null, saveAt: save.save_at });
  }

  // ------------------------------------------------------------- signed-in players

  private async player(path: string, method: string, body: Record<string, unknown>, url: URL, me: User, request: Request, now: number): Promise<Response> {
    switch (`${method} ${path}`) {
      case 'GET account/me': {
        const save = this.one('SELECT save, save_at FROM users WHERE id = ?', me.id)!;
        return json({ user: this.publicUser(me, now), save: save.save ? JSON.parse(save.save as string) : null, saveAt: save.save_at });
      }
      case 'POST account/signout': {
        const token = (request.headers.get('authorization') ?? '').slice(7);
        this.sql.exec('DELETE FROM sessions WHERE token = ?', await sha256(token));
        return json({ ok: true });
      }
      case 'PUT account/save': {
        const text = JSON.stringify(body.save ?? null);
        if (text.length > MAX_SAVE) return fail('Save is too big');
        this.sql.exec('UPDATE users SET save = ?, save_at = ? WHERE id = ?', text, now, me.id);
        return json({ saveAt: now });
      }
      case 'POST account/password': {
        const row = this.one('SELECT hash, salt, iters FROM users WHERE id = ?', me.id)!;
        if (!same(await pbkdf2(String(body.old ?? ''), row.salt as string, row.iters as number), row.hash as string)) return fail('Current password is wrong', 401);
        const pw = String(body.password ?? '');
        if (pw.length < 6 || pw.length > 128) return fail('Passwords need at least 6 characters');
        const salt = randomHex(16);
        this.sql.exec('UPDATE users SET hash = ?, salt = ?, iters = ? WHERE id = ?', await pbkdf2(pw, salt, ITERATIONS), salt, ITERATIONS, me.id);
        return json({ ok: true });
      }
      case 'POST account/rename': {
        // Players can change their username once a week; staff any time.
        const name = String(body.name ?? '').trim();
        if (!NAME.test(name)) return fail('Usernames are 3 to 16 letters, numbers or _');
        if (blocked(name) || (RESERVED.includes(name.toLowerCase()) && me.role === 'player')) return fail("That username isn't allowed");
        if (this.one('SELECT id FROM users WHERE lname = ? AND id != ?', name.toLowerCase(), me.id)) return fail('That username is taken');
        const last = (this.one('SELECT renamed_at FROM users WHERE id = ?', me.id)?.renamed_at as number) ?? 0;
        const wait = last + 7 * DAY - now;
        if (me.role === 'player' && wait > 0 && name.toLowerCase() !== me.name.toLowerCase()) return fail(`You can change your username again in ${Math.ceil(wait / DAY)} day(s)`);
        this.sql.exec('UPDATE users SET name = ?, lname = ?, renamed_at = ? WHERE id = ?', name, name.toLowerCase(), now, me.id);
        return json({ user: this.publicUser({ ...me, name }, now) });
      }
      case 'POST account/email': {
        const email = String(body.email ?? '').trim();
        if (email && !EMAIL.test(email)) return fail("That email doesn't look right");
        if (email && this.one('SELECT id FROM users WHERE lemail = ? AND id != ?', email.toLowerCase(), me.id)) return fail('That email already has an account');
        this.sql.exec('UPDATE users SET email = ?, lemail = ? WHERE id = ?', email || null, email ? email.toLowerCase() : null, me.id);
        return json({ ok: true });
      }
      case 'POST account/heartbeat': {
        // Where you are (menu, a match, hosting a room): friends see it, and open rooms get listed.
        const st = (body.status ?? {}) as { state?: string; mode?: string; room?: { code: string; mode: string; players: number; max: number; open: boolean } };
        const status = { state: String(st.state ?? 'menu').slice(0, 20), mode: st.mode ? String(st.mode).slice(0, 30) : null, room: st.room?.code ? String(st.room.code).slice(0, 12) : null };
        this.sql.exec('UPDATE users SET last_seen = ?, status = ? WHERE id = ?', now, JSON.stringify(status), me.id);
        if (st.room?.code && /^[A-Z0-9]{3,12}$/.test(st.room.code)) {
          this.sql.exec(
            'INSERT INTO rooms (code, uid, host, mode, players, max, open, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO UPDATE SET mode = excluded.mode, players = excluded.players, max = excluded.max, open = excluded.open, updated = excluded.updated',
            st.room.code, me.id, me.name, String(st.room.mode).slice(0, 30), Math.max(0, Math.min(64, Number(st.room.players) || 0)), Math.max(1, Math.min(64, Number(st.room.max) || 1)), st.room.open ? 1 : 0, now
          );
        }
        this.sql.exec('DELETE FROM rooms WHERE updated < ?', now - ROOM_TTL);
        const ids = this.friendIds(me.id);
        const online = ids.length ? this.q(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(',')}) AND last_seen > ?`, ...ids, now - ONLINE_MS).length : 0;
        const unread = (this.one('SELECT COUNT(*) AS n FROM messages WHERE dst = ? AND seen = 0', me.id)?.n as number) ?? 0;
        const requests = (this.one("SELECT COUNT(*) AS n FROM friends WHERE b = ? AND state = 'pending'", me.id)?.n as number) ?? 0;
        const inbox = this.q('SELECT id, kind, body, at FROM inbox WHERE uid = ? ORDER BY id LIMIT 20', me.id).map((r) => ({ ...r, body: JSON.parse(r.body as string) }));
        return json({ user: this.publicUser(me, now), online, unread, requests, inbox, ...this.news(now) });
      }
      case 'POST inbox/ack': {
        const ids = (Array.isArray(body.ids) ? body.ids : []).filter((n): n is number => Number.isInteger(n)).slice(0, 50);
        if (ids.length) this.sql.exec(`DELETE FROM inbox WHERE uid = ? AND id IN (${ids.map(() => '?').join(',')})`, me.id, ...ids);
        return json({ ok: true });
      }
      case 'GET friends': {
        const rows = this.q(
          `SELECT u.id, u.name, u.title, u.last_seen, u.status, f.state, f.a = ? AS mine FROM friends f JOIN users u ON u.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END WHERE (f.a = ? OR (f.b = ? AND f.state = 'pending'))`,
          me.id, me.id, me.id, me.id
        );
        const unread = new Map(this.q('SELECT src, COUNT(*) AS n FROM messages WHERE dst = ? AND seen = 0 GROUP BY src', me.id).map((r) => [r.src as number, r.n as number]));
        const friends = [];
        const incoming = [];
        const outgoing = [];
        for (const r of rows) {
          const entry = { id: r.id, name: r.name, title: r.title, online: (r.last_seen as number) > now - ONLINE_MS, lastSeen: r.last_seen, status: r.status ? JSON.parse(r.status as string) : null, unread: unread.get(r.id as number) ?? 0 };
          if (r.state === 'friends') friends.push(entry);
          else if (r.mine) outgoing.push(entry);
          else incoming.push(entry);
        }
        return json({ friends, incoming, outgoing });
      }
      case 'POST friends/request': {
        const target = this.one('SELECT id FROM users WHERE lname = ?', String(body.name ?? '').trim().toLowerCase());
        if (!target) return fail('No player with that username');
        const tid = target.id as number;
        if (tid === me.id) return fail("That's you");
        const existing = this.one('SELECT state FROM friends WHERE a = ? AND b = ?', me.id, tid);
        if (existing?.state === 'friends') return fail('Already friends');
        // They already asked you: this accepts.
        if (this.one("SELECT 1 FROM friends WHERE a = ? AND b = ? AND state = 'pending'", tid, me.id)) {
          this.sql.exec("UPDATE friends SET state = 'friends', at = ? WHERE a = ? AND b = ?", now, tid, me.id);
          this.sql.exec("INSERT OR REPLACE INTO friends (a, b, state, at) VALUES (?, ?, 'friends', ?)", me.id, tid, now);
          return json({ ok: true, accepted: true });
        }
        if ((this.one("SELECT COUNT(*) AS n FROM friends WHERE a = ? AND state = 'pending'", me.id)?.n as number) >= 50) return fail('Too many requests waiting');
        this.sql.exec("INSERT OR IGNORE INTO friends (a, b, state, at) VALUES (?, ?, 'pending', ?)", me.id, tid, now);
        return json({ ok: true });
      }
      case 'POST friends/accept': {
        const id = Number(body.id);
        if (!this.one("SELECT 1 FROM friends WHERE a = ? AND b = ? AND state = 'pending'", id, me.id)) return fail('No request from them');
        this.sql.exec("UPDATE friends SET state = 'friends', at = ? WHERE a = ? AND b = ?", now, id, me.id);
        this.sql.exec("INSERT OR REPLACE INTO friends (a, b, state, at) VALUES (?, ?, 'friends', ?)", me.id, id, now);
        return json({ ok: true });
      }
      case 'POST friends/remove': {
        // Removes a friend, cancels your request, or declines theirs.
        const id = Number(body.id);
        this.sql.exec('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me.id, id, id, me.id);
        return json({ ok: true });
      }
      case 'GET messages': {
        const other = Number(url.searchParams.get('with'));
        const after = Number(url.searchParams.get('after') ?? 0);
        const rows = this.q('SELECT id, src, text, at FROM messages WHERE ((src = ? AND dst = ?) OR (src = ? AND dst = ?)) AND id > ? ORDER BY id DESC LIMIT 60', me.id, other, other, me.id, after).reverse();
        this.sql.exec('UPDATE messages SET seen = 1 WHERE dst = ? AND src = ? AND seen = 0', me.id, other);
        return json({ messages: rows.map((r) => ({ id: r.id, mine: r.src === me.id, text: r.text, at: r.at })) });
      }
      case 'POST messages': {
        const to = Number(body.to);
        const text = String(body.text ?? '').trim().slice(0, 200);
        if (!text) return fail('Empty message');
        if (me.muted_until > now) return fail(`You're muted until ${new Date(me.muted_until).toUTCString()}`, 403);
        if (!this.one("SELECT 1 FROM friends WHERE a = ? AND b = ? AND state = 'friends'", me.id, to)) return fail('You can only message friends');
        // A light flood guard: 20 messages a minute.
        if ((this.one('SELECT COUNT(*) AS n FROM messages WHERE src = ? AND at > ?', me.id, now - MIN)?.n as number) >= 20) return fail('Slow down a little', 429);
        this.sql.exec('INSERT INTO messages (src, dst, text, at) VALUES (?, ?, ?, ?)', me.id, to, maskChat(text), now);
        this.sql.exec('DELETE FROM messages WHERE at < ?', now - 60 * DAY);
        return json({ ok: true });
      }
      case 'GET profile': {
        // Another player's public card.
        const name = String(url.searchParams.get('name') ?? '').toLowerCase();
        const r = this.one('SELECT id, name, title, role, created, last_seen, status, save FROM users WHERE lname = ?', name);
        if (!r) return fail('No player with that username', 404);
        const save = r.save ? (JSON.parse(r.save as string) as { profile?: unknown; settings?: { cosmetics?: unknown; primary?: string } }) : null;
        const rel = this.one('SELECT state, a = ? AS mine FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', me.id, me.id, r.id, r.id, me.id);
        return json({
          id: r.id,
          name: r.name,
          title: r.title,
          role: r.role,
          created: r.created,
          online: (r.last_seen as number) > now - ONLINE_MS,
          status: r.status ? JSON.parse(r.status as string) : null,
          profile: save?.profile ?? null,
          cosmetics: save?.settings?.cosmetics ?? null,
          favorite: save?.settings?.primary ?? null,
          friend: rel ? (rel.state === 'friends' ? 'friends' : rel.mine ? 'sent' : 'received') : 'none'
        });
      }
      case 'POST report': {
        const targetName = String(body.name ?? '').trim().slice(0, 32);
        const reason = String(body.reason ?? '').slice(0, 40);
        if (!targetName || !reason) return fail('Pick who and why');
        if ((this.one('SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND at > ?', me.id, now - 60 * MIN)?.n as number) >= 15) return fail('Too many reports this hour', 429);
        const target = this.one('SELECT id FROM users WHERE lname = ?', targetName.toLowerCase());
        this.sql.exec('INSERT INTO reports (reporter, target_uid, target_name, reason, details, context, at) VALUES (?, ?, ?, ?, ?, ?, ?)', me.id, target?.id ?? null, targetName, reason, String(body.details ?? '').slice(0, 500), String(body.context ?? '').slice(0, 200), now);
        return json({ ok: true });
      }
      case 'POST redeem': {
        const code = String(body.code ?? '').trim().toUpperCase();
        const c = this.one('SELECT reward, uses_left, until FROM codes WHERE code = ?', code);
        if (!c || (c.until as number) < now || (c.uses_left as number) <= 0) return fail("That code isn't valid (or has run out)");
        if (this.one('SELECT 1 FROM redeemed WHERE code = ? AND uid = ?', code, me.id)) return fail("You've already used that code");
        this.sql.exec('INSERT INTO redeemed (code, uid) VALUES (?, ?)', code, me.id);
        this.sql.exec('UPDATE codes SET uses_left = uses_left - 1 WHERE code = ?', code);
        return json({ reward: JSON.parse(c.reward as string) });
      }
    }
    return fail('Not found', 404);
  }

  // ------------------------------------------------------------- admin and moderators

  private async admin(path: string, method: string, body: Record<string, unknown>, url: URL, me: User, now: number): Promise<Response> {
    const isAdmin = me.role === 'admin';
    const target = (): User | null => this.user(Number(body.id)) ?? null;
    const adminOnly = () => fail('Only the admin can do that', 403);
    switch (`${method} ${path}`) {
      case 'GET overview': {
        const n = (sqlq: string, ...b: unknown[]) => (this.one(sqlq, ...b)?.n as number) ?? 0;
        return json({
          users: n('SELECT COUNT(*) AS n FROM users'),
          newToday: n('SELECT COUNT(*) AS n FROM users WHERE created > ?', now - DAY),
          online: n('SELECT COUNT(*) AS n FROM users WHERE last_seen > ?', now - ONLINE_MS),
          openReports: n("SELECT COUNT(*) AS n FROM reports WHERE state = 'open'"),
          banned: n('SELECT COUNT(*) AS n FROM users WHERE banned_until > ?', now),
          muted: n('SELECT COUNT(*) AS n FROM users WHERE muted_until > ?', now),
          rooms: n('SELECT COUNT(*) AS n FROM rooms WHERE updated > ?', now - ROOM_TTL),
          messagesToday: n('SELECT COUNT(*) AS n FROM messages WHERE at > ?', now - DAY),
          role: me.role,
          ...this.news(now)
        });
      }
      case 'GET reports': {
        const state = url.searchParams.get('state') ?? 'open';
        const rows = this.q(
          'SELECT r.*, u.name AS reporter_name, (SELECT COUNT(*) FROM reports x WHERE x.target_name = r.target_name COLLATE NOCASE) AS total FROM reports r LEFT JOIN users u ON u.id = r.reporter WHERE r.state = ? ORDER BY r.id DESC LIMIT 100',
          state
        );
        return json({ reports: rows });
      }
      case 'POST reports/resolve': {
        this.sql.exec('UPDATE reports SET state = ?, handled_by = ?, note = ? WHERE id = ?', body.state === 'dismissed' ? 'dismissed' : 'resolved', me.id, String(body.note ?? '').slice(0, 200), Number(body.id));
        this.log(me, 'report', Number(body.id), { state: body.state, note: body.note });
        return json({ ok: true });
      }
      case 'GET users': {
        const s = `%${String(url.searchParams.get('q') ?? '').toLowerCase().replace(/[%_]/g, '')}%`;
        const rows = this.q('SELECT id, name, email, role, created, last_seen, banned_until, muted_until, title FROM users WHERE lname LIKE ? OR lemail LIKE ? ORDER BY last_seen DESC LIMIT 50', s, s);
        return json({ users: rows.map((r) => ({ ...r, online: (r.last_seen as number) > now - ONLINE_MS, email: isAdmin ? r.email : r.email ? '(hidden)' : null })) });
      }
      case 'GET user': {
        const id = Number(url.searchParams.get('id'));
        const r = this.one('SELECT id, name, email, role, created, last_seen, status, banned_until, ban_reason, muted_until, title, save, save_at FROM users WHERE id = ?', id);
        if (!r) return fail('No such player', 404);
        const save = r.save ? JSON.parse(r.save as string) : null;
        return json({
          user: { ...r, save: undefined, email: isAdmin ? r.email : r.email ? '(hidden)' : null, status: r.status ? JSON.parse(r.status as string) : null, online: (r.last_seen as number) > now - ONLINE_MS },
          profile: save?.profile ?? null,
          reportsAgainst: this.q('SELECT id, reason, details, at, state, context FROM reports WHERE target_uid = ? OR target_name = ? COLLATE NOCASE ORDER BY id DESC LIMIT 30', id, r.name),
          reportsMade: (this.one('SELECT COUNT(*) AS n FROM reports WHERE reporter = ?', id)?.n as number) ?? 0,
          friends: this.friendIds(id).length,
          recentMessages: this.q('SELECT m.text, m.at, u.name AS to_name FROM messages m JOIN users u ON u.id = m.dst WHERE m.src = ? ORDER BY m.id DESC LIMIT 20', id),
          history: this.q('SELECT a.action, a.details, a.at, u.name AS admin FROM audit a JOIN users u ON u.id = a.admin WHERE a.target = ? ORDER BY a.id DESC LIMIT 30', String(id))
        });
      }
      case 'POST ban': {
        const t = target();
        if (!t) return fail('No such player', 404);
        if (t.role === 'admin' || (t.role === 'mod' && !isAdmin)) return fail("Can't ban staff", 403);
        const minutes = Number(body.minutes) || 0;
        const until = minutes > 0 ? now + minutes * MIN : PERMANENT;
        const reason = String(body.reason ?? '').slice(0, 200);
        this.sql.exec('UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?', until, reason, t.id);
        this.sql.exec('DELETE FROM sessions WHERE uid = ?', t.id);
        this.sql.exec('DELETE FROM rooms WHERE uid = ?', t.id);
        this.log(me, 'ban', t.id, { minutes, reason });
        return json({ ok: true });
      }
      case 'POST unban': {
        const t = target();
        if (!t) return fail('No such player', 404);
        this.sql.exec('UPDATE users SET banned_until = 0, ban_reason = NULL WHERE id = ?', t.id);
        this.log(me, 'unban', t.id);
        return json({ ok: true });
      }
      case 'POST mute': {
        const t = target();
        if (!t) return fail('No such player', 404);
        const minutes = Number(body.minutes) || 60;
        this.sql.exec('UPDATE users SET muted_until = ? WHERE id = ?', minutes > 0 ? now + minutes * MIN : 0, t.id);
        this.log(me, minutes > 0 ? 'mute' : 'unmute', t.id, { minutes });
        return json({ ok: true });
      }
      case 'POST warn': {
        const t = target();
        if (!t) return fail('No such player', 404);
        const text = String(body.text ?? '').slice(0, 300) || 'Please follow the rules and be kind to other players.';
        this.give(t.id, 'warning', { text }, now);
        this.log(me, 'warn', t.id, { text });
        return json({ ok: true });
      }
      case 'POST rename': {
        const t = target();
        if (!t) return fail('No such player', 404);
        const name = String(body.name ?? '').trim();
        if (!NAME.test(name)) return fail('Usernames are 3 to 16 letters, numbers or _');
        if (this.one('SELECT id FROM users WHERE lname = ? AND id != ?', name.toLowerCase(), t.id)) return fail('That username is taken');
        this.sql.exec('UPDATE users SET name = ?, lname = ? WHERE id = ?', name, name.toLowerCase(), t.id);
        this.give(t.id, 'renamed', { name, from: t.name }, now);
        this.log(me, 'rename', t.id, { from: t.name, to: name });
        return json({ ok: true });
      }
      case 'POST reset-password': {
        if (!isAdmin) return adminOnly();
        const t = target();
        if (!t) return fail('No such player', 404);
        const temp = randomHex(4);
        const salt = randomHex(16);
        this.sql.exec('UPDATE users SET hash = ?, salt = ?, iters = ? WHERE id = ?', await pbkdf2(temp, salt, ITERATIONS), salt, ITERATIONS, t.id);
        this.sql.exec('DELETE FROM sessions WHERE uid = ?', t.id);
        this.log(me, 'reset-password', t.id);
        return json({ password: temp });
      }
      case 'POST role': {
        if (!isAdmin) return adminOnly();
        const t = target();
        if (!t || t.id === me.id) return fail("Can't change that account's role");
        const role = body.role === 'mod' ? 'mod' : 'player';
        this.sql.exec('UPDATE users SET role = ? WHERE id = ?', role, t.id);
        this.log(me, 'role', t.id, { role });
        return json({ ok: true });
      }
      case 'POST title': {
        if (!isAdmin) return adminOnly();
        const t = target();
        if (!t) return fail('No such player', 404);
        const title = String(body.title ?? '').trim().slice(0, 24) || null;
        this.sql.exec('UPDATE users SET title = ? WHERE id = ?', title, t.id);
        this.log(me, 'title', t.id, { title });
        return json({ ok: true });
      }
      case 'POST grant': {
        if (!isAdmin) return adminOnly();
        const reward = cleanReward(body.reward);
        if (!reward) return fail('Nothing to give');
        const ids: number[] = body.everyone ? this.q('SELECT id FROM users').map((r) => r.id as number) : [Number(body.id)];
        for (const id of ids) if (this.user(id)) this.give(id, 'reward', reward, now);
        this.log(me, 'grant', body.everyone ? 'everyone' : Number(body.id), reward);
        return json({ ok: true, count: ids.length });
      }
      case 'POST reset-progress': {
        if (!isAdmin) return adminOnly();
        const t = target();
        if (!t) return fail('No such player', 404);
        this.give(t.id, 'reset', {}, now);
        this.sql.exec('UPDATE users SET save = NULL, save_at = ? WHERE id = ?', now, t.id);
        this.log(me, 'reset-progress', t.id);
        return json({ ok: true });
      }
      case 'POST delete': {
        if (!isAdmin) return adminOnly();
        const t = target();
        if (!t || t.role === 'admin') return fail("Can't delete that account");
        for (const s of ['DELETE FROM sessions WHERE uid = ?', 'DELETE FROM friends WHERE a = ? OR b = ?', 'DELETE FROM messages WHERE src = ? OR dst = ?', 'DELETE FROM inbox WHERE uid = ?', 'DELETE FROM rooms WHERE uid = ?', 'DELETE FROM users WHERE id = ?']) {
          this.sql.exec(s, ...Array(s.split('?').length - 1).fill(t.id));
        }
        this.log(me, 'delete', t.id, { name: t.name });
        return json({ ok: true });
      }
      case 'POST shout': {
        // A personal message from the staff (one player, or everyone online).
        const text = String(body.text ?? '').trim().slice(0, 240);
        if (!text) return fail('Write something');
        const ids: number[] = body.everyone ? this.q('SELECT id FROM users WHERE last_seen > ?', now - ONLINE_MS).map((r) => r.id as number) : [Number(body.id)];
        for (const id of ids) if (this.user(id)) this.give(id, 'shout', { text, from: me.name }, now);
        this.log(me, 'shout', body.everyone ? 'everyone online' : Number(body.id), { text });
        return json({ ok: true, count: ids.length });
      }
      case 'POST giveaway': {
        if (!isAdmin) return adminOnly();
        // A random player who's online right now wins.
        const reward = cleanReward(body.reward) ?? { xp: 5000 };
        const online = this.q("SELECT id, name FROM users WHERE last_seen > ? AND role = 'player' AND banned_until < ?", now - ONLINE_MS, now);
        if (!online.length) return fail('Nobody is online right now');
        const w = online[Math.floor(Math.random() * online.length)];
        this.give(w.id as number, 'reward', { ...reward, note: `You won the admin's giveaway!` }, now);
        this.sql.exec('INSERT INTO news (text, kind, at, until, by) VALUES (?, ?, ?, ?, ?)', `${w.name} just won the admin's giveaway!`, 'celebrate', now, now + 2 * 60 * MIN, me.id);
        this.log(me, 'giveaway', w.id as number, reward);
        return json({ winner: w.name, entrants: online.length });
      }
      case 'POST rain': {
        if (!isAdmin) return adminOnly();
        // XP for everyone online right now.
        const xp = Math.max(1, Math.min(100_000, Math.round(Number(body.xp) || 1000)));
        const online = this.q('SELECT id FROM users WHERE last_seen > ?', now - ONLINE_MS);
        for (const r of online) this.give(r.id as number, 'reward', { xp, note: `XP rain! +${xp} XP from the admin` }, now);
        this.log(me, 'rain', 'everyone online', { xp });
        return json({ count: online.length });
      }
      case 'POST news': {
        const text = String(body.text ?? '').trim().slice(0, 280);
        if (!text) return fail('Write something');
        const hours = Math.max(0.1, Math.min(24 * 30, Number(body.hours) || 24));
        const kind = ['info', 'event', 'warning', 'celebrate'].includes(String(body.kind)) ? String(body.kind) : 'info';
        this.sql.exec('INSERT INTO news (text, kind, at, until, by) VALUES (?, ?, ?, ?, ?)', text, kind, now, now + hours * 60 * MIN, me.id);
        this.log(me, 'news', null, { text, kind, hours });
        return json({ ok: true });
      }
      case 'POST news/end': {
        this.sql.exec('UPDATE news SET until = ? WHERE id = ?', now, Number(body.id));
        this.log(me, 'news-end', Number(body.id));
        return json({ ok: true });
      }
      case 'POST event': {
        if (!isAdmin) return adminOnly();
        const key = String(body.key ?? '');
        if (!/^[a-zA-Z]{2,20}$/.test(key)) return fail('Unknown event');
        const events = this.events(now);
        const hours = Number(body.hours) || 0;
        // An optional start time (up to 60 days ahead) schedules it; otherwise it starts now.
        const from = Math.min(now + 60 * 24 * 60 * MIN, Math.max(now, Number(body.from) || now));
        if (hours > 0) events[key] = { from, until: from + Math.min(24 * 14, hours) * 60 * MIN };
        else delete events[key];
        this.setKv('events', JSON.stringify(events));
        this.log(me, 'event', key, { hours, ...(from > now ? { from: new Date(from).toISOString() } : {}) });
        return json({ ok: true });
      }
      case 'POST maintenance': {
        if (!isAdmin) return adminOnly();
        const message = String(body.message ?? '').trim().slice(0, 200);
        this.setKv('maintenance', message || null);
        this.log(me, 'maintenance', null, { message });
        return json({ ok: true });
      }
      case 'GET codes':
        return json({ codes: this.q('SELECT code, reward, uses_left, until, at FROM codes ORDER BY at DESC LIMIT 50') });
      case 'POST codes': {
        if (!isAdmin) return adminOnly();
        const reward = cleanReward(body.reward);
        if (!reward) return fail('Nothing to give');
        const code = (String(body.code ?? '').trim().toUpperCase() || randomHex(4).toUpperCase()).replace(/[^A-Z0-9]/g, '').slice(0, 16);
        if (code.length < 4) return fail('Codes need at least 4 letters or numbers');
        const hours = Math.max(1, Math.min(24 * 90, Number(body.hours) || 24 * 7));
        this.sql.exec('INSERT OR REPLACE INTO codes (code, reward, uses_left, until, by, at) VALUES (?, ?, ?, ?, ?, ?)', code, JSON.stringify(reward), Math.max(1, Math.min(100_000, Number(body.uses) || 100)), now + hours * 60 * MIN, me.id, now);
        this.log(me, 'code', code, reward);
        return json({ code });
      }
      case 'GET rooms':
        return json({ rooms: this.q('SELECT code, host, mode, players, max, open, updated FROM rooms WHERE updated > ? ORDER BY updated DESC', now - ROOM_TTL) });
      case 'GET audit':
        return json({ audit: this.q('SELECT a.id, a.action, a.target, a.details, a.at, u.name AS admin, t.name AS target_name FROM audit a JOIN users u ON u.id = a.admin LEFT JOIN users t ON CAST(t.id AS TEXT) = a.target ORDER BY a.id DESC LIMIT 100') });
    }
    return fail('Not found', 404);
  }
}
