// Exercises the Accounts object end to end with node:sqlite standing in for Durable Object storage.
import { DatabaseSync } from 'node:sqlite';
import { Accounts } from '../worker/accounts.ts';

const db = new DatabaseSync(':memory:');
const state = {
  storage: {
    sql: {
      exec(q: string, ...b: unknown[]) {
        const st = db.prepare(q);
        const rows = st.columns().length ? (st.all(...(b as never[])) as Record<string, unknown>[]) : (st.run(...(b as never[])), []);
        return { toArray: () => rows };
      }
    }
  }
};
const acc = new Accounts(state, { ADMIN_EMAIL: 'Boss@Example.com', ADMIN_PASSWORD: 'secret-admin-pass' });
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const r = await acc.fetch(new Request(`https://x/api/${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: r.status, body: (await r.json()) as any };
};
let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' ' + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

// Sign-up rules.
check('bad name', (await call('POST', 'account/signup', { name: 'a', password: 'secret1' })).status === 400);
check('blocked name', (await call('POST', 'account/signup', { name: 'xXsh1tXx', password: 'secret1' })).status === 400);
check('reserved name', (await call('POST', 'account/signup', { name: 'Admin', password: 'secret1' })).status === 400);
check('short password', (await call('POST', 'account/signup', { name: 'alice', password: '123' })).status === 400);
const a = await call('POST', 'account/signup', { name: 'Alice', password: 'secret1', email: 'alice@school.org' });
check('signup alice', a.status === 200 && !!a.body.token, a.body);
check('name taken (case)', (await call('POST', 'account/signup', { name: 'ALICE', password: 'secret1' })).status === 400);
const b = await call('POST', 'account/signup', { name: 'bob_7', password: 'hunter22' });
check('signup bob (no email)', b.status === 200);
const A = a.body.token, B = b.body.token;

// Sign-in by name and email; wrong password.
check('signin by email', (await call('POST', 'account/signin', { login: 'ALICE@school.org', password: 'secret1' })).status === 200);
check('wrong password', (await call('POST', 'account/signin', { login: 'alice', password: 'nope' })).status === 401);
check('no token', (await call('GET', 'account/me')).status === 401);

// Cloud save.
await call('PUT', 'account/save', { save: { v: 1, profile: { xp: 1234 } } }, A);
const me = await call('GET', 'account/me', undefined, A);
check('save round trip', me.body.save?.profile?.xp === 1234, me.body);

// Friends: request, accept, message.
check('request', (await call('POST', 'friends/request', { name: 'BOB_7' }, A)).status === 200);
const bf = await call('GET', 'friends', undefined, B);
check('bob sees incoming', bf.body.incoming.length === 1 && bf.body.incoming[0].name === 'Alice', bf.body);
check('message before friends fails', (await call('POST', 'messages', { to: bf.body.incoming[0].id, text: 'hi' }, B)).status === 400);
check('accept', (await call('POST', 'friends/accept', { id: bf.body.incoming[0].id }, B)).status === 200);
const af = await call('GET', 'friends', undefined, A);
check('alice sees friend online', af.body.friends.length === 1 && af.body.friends[0].name === 'bob_7', af.body);
const bobId = af.body.friends[0].id;
await call('POST', 'messages', { to: bobId, text: 'gg that was a shit round' }, A);
const hb = await call('POST', 'account/heartbeat', { status: { state: 'menu', room: { code: 'ABC123', mode: 'tdm', players: 2, max: 10, open: true } } }, B);
check('bob heartbeat unread', hb.body.unread === 1, hb.body);
const msgs = await call('GET', `messages?with=${a.body.user.id}`, undefined, B);
check('chat masked', msgs.body.messages[0].text.includes('****'), msgs.body);
check('rooms list', (await call('GET', 'rooms')).body.rooms[0]?.code === 'ABC123');

// Profile card and report.
const card = await call('GET', 'profile?name=alice', undefined, B);
check('profile card', card.body.name === 'Alice' && card.body.friend === 'friends' && card.body.profile?.xp === 1234, card.body);
check('report', (await call('POST', 'report', { name: 'bob_7', reason: 'Cheating', details: 'aimbot', context: 'tdm' }, A)).status === 200);

// Not admin yet.
check('player blocked from admin', (await call('GET', 'admin/overview', undefined, A)).status === 403);

// Admin from secrets: wrong password, then right one.
check('admin wrong password', (await call('POST', 'account/signin', { login: 'boss@example.com', password: 'guess' })).status === 401);
const ad = await call('POST', 'account/signin', { login: 'boss@example.com', password: 'secret-admin-pass' });
check('admin created', ad.status === 200 && ad.body.user.role === 'admin', ad.body);
const AD = ad.body.token;
const ov = await call('GET', 'admin/overview', undefined, AD);
check('overview', ov.body.users === 3 && ov.body.openReports === 1, ov.body);
const reps = await call('GET', 'admin/reports', undefined, AD);
check('reports list', reps.body.reports[0]?.target_name === 'bob_7');
check('resolve', (await call('POST', 'admin/reports/resolve', { id: reps.body.reports[0].id, state: 'resolved', note: 'warned' }, AD)).status === 200);
check('warn', (await call('POST', 'admin/warn', { id: bobId, text: 'Be nice' }, AD)).status === 200);
check('mute', (await call('POST', 'admin/mute', { id: a.body.user.id, minutes: 30 }, AD)).status === 200);
check('muted cannot message', (await call('POST', 'messages', { to: bobId, text: 'hey' }, A)).status === 403);
check('grant', (await call('POST', 'admin/grant', { id: bobId, reward: { xp: 5000, unlocks: ['*'] } }, AD)).status === 200);
const hb2 = await call('POST', 'account/heartbeat', { status: { state: 'menu' } }, B);
check('bob inbox has warning + reward', hb2.body.inbox.length === 2, hb2.body.inbox);
await call('POST', 'inbox/ack', { ids: hb2.body.inbox.map((i: any) => i.id) }, B);
check('inbox cleared', (await call('POST', 'account/heartbeat', {}, B)).body.inbox.length === 0);
check('news', (await call('POST', 'admin/news', { text: 'Double XP this weekend!', kind: 'event', hours: 48 }, AD)).status === 200);
await call('POST', 'admin/event', { key: 'doubleXp', hours: 48 }, AD);
const news = await call('GET', 'news');
check('public news + event', news.body.news[0]?.text.startsWith('Double') && news.body.events.doubleXp?.until > Date.now(), news.body);
const code = await call('POST', 'admin/codes', { code: 'SCHOOL1', reward: { xp: 1000 }, uses: 2 }, AD);
check('code made', code.body.code === 'SCHOOL1', code.body);
check('redeem', (await call('POST', 'redeem', { code: 'school1' }, B)).body.reward?.xp === 1000);
check('redeem twice fails', (await call('POST', 'redeem', { code: 'SCHOOL1' }, B)).status === 400);
check('rename', (await call('POST', 'admin/rename', { id: bobId, name: 'Robert' }, AD)).status === 200);
const reset = await call('POST', 'admin/reset-password', { id: bobId }, AD);
check('reset password', /^[a-f0-9]{8}$/.test(reset.body.password), reset.body);
check('old session gone', (await call('GET', 'account/me', undefined, B)).status === 401);
check('temp password works', (await call('POST', 'account/signin', { login: 'robert', password: reset.body.password })).status === 200);
check('ban', (await call('POST', 'admin/ban', { id: bobId, minutes: 60, reason: 'Cheating' }, AD)).status === 200);
const banned = await call('POST', 'account/signin', { login: 'robert', password: reset.body.password });
check('banned sign-in refused with reason', banned.status === 403 && banned.body.error.includes('Cheating'), banned.body);
check('cannot ban admin', (await call('POST', 'admin/ban', { id: ad.body.user.id }, AD)).status === 403);
check('make mod', (await call('POST', 'admin/role', { id: a.body.user.id, role: 'mod' }, AD)).status === 200);
const modA = (await call('POST', 'account/signin', { login: 'alice', password: 'secret1' })).body.token;
check('mod sees reports', (await call('GET', 'admin/reports', undefined, modA)).status === 200);
check('mod cannot grant', (await call('POST', 'admin/grant', { id: bobId, reward: { xp: 1 } }, modA)).status === 403);
check('mod email hidden', (await call('GET', 'admin/users?q=', undefined, modA)).body.users.every((u: any) => !u.email || u.email === '(hidden)'));
const audit = await call('GET', 'admin/audit', undefined, AD);
check('audit log', audit.body.audit.length >= 10, audit.body.audit.length);
// Admin second sign-in uses the stored hash (secrets only seed it).
check('admin signs in again', (await call('POST', 'account/signin', { login: 'boss@example.com', password: 'secret-admin-pass' })).status === 200);
// Brute force guard.
for (let i = 0; i < 8; i++) await call('POST', 'account/signin', { login: 'alice', password: 'bad' });
check('lockout after 8 failures', (await call('POST', 'account/signin', { login: 'alice', password: 'secret1' })).status === 429);
console.log(failures ? `${failures} FAILED` : "all passed");
process.exitCode = failures ? 1 : 0;
