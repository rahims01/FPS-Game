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
const adm = await call('POST', 'account/signin', { login: 'boss@example.com', password: 'secret-admin-pass' });
check('admin signs in', adm.status === 200, adm.body);
const AT = adm.body.token, aname = adm.body.user?.name;
const pl = await call('POST', 'account/signup', { name: 'Mallory', password: 'secret1' });
const PT = pl.body.token;
check('player cannot get a ticket', (await call('POST', 'account/admin-ticket', {}, PT)).status === 403);
check('signed-out cannot get a ticket', (await call('POST', 'account/admin-ticket', {})).status === 401);
const t1 = (await call('POST', 'account/admin-ticket', {}, AT)).body.ticket;
check('admin gets a ticket', /^[0-9a-f]{48}$/.test(t1), t1);
check('wrong name fails', (await call('POST', 'account/admin-check', { ticket: t1, name: 'Mallory' })).body.admin === false);
check('ticket used up after a failed check', (await call('POST', 'account/admin-check', { ticket: t1, name: aname })).body.admin === false);
const t2 = (await call('POST', 'account/admin-ticket', {}, AT)).body.ticket;
check('right name passes', (await call('POST', 'account/admin-check', { ticket: t2, name: aname.toUpperCase() })).body.admin === true);
check('second use fails', (await call('POST', 'account/admin-check', { ticket: t2, name: aname })).body.admin === false);
check('made-up ticket fails', (await call('POST', 'account/admin-check', { ticket: 'f'.repeat(48), name: aname })).body.admin === false);
check('junk fails', (await call('POST', 'account/admin-check', { ticket: "' OR 1=1 --", name: aname })).body.admin === false);
const t3 = (await call('POST', 'account/admin-ticket', {}, AT)).body.ticket;
db.prepare('UPDATE admin_tickets SET exp = 1').run();
check('expired ticket fails', (await call('POST', 'account/admin-check', { ticket: t3, name: aname })).body.admin === false);
console.log(failures ? `${failures} FAILED` : "all passed");
process.exitCode = failures ? 1 : 0;
