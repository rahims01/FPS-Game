/**
 * The site's /api/* endpoints on your own computer, for `npm run dev`
 * (wrangler dev isn't needed). Runs the real Worker code with Node's built-in
 * SQLite standing in for Durable Object storage, saved to .dev-api.sqlite.
 *
 *   npm run dev:api          then, in another terminal, npm run dev
 *
 * Optional: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run dev:api
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import worker, { Accounts, Presence } from '../worker/index.ts';

const db = new DatabaseSync('.dev-api.sqlite');
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
const env = { ADMIN_EMAIL: process.env.ADMIN_EMAIL, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, TURN_URLS: process.env.TURN_URLS, TURN_USERNAME: process.env.TURN_USERNAME, TURN_CREDENTIAL: process.env.TURN_CREDENTIAL };
const accounts = new Accounts(state, env);
const presence = new Presence();
const ns = (obj: { fetch(r: Request): Promise<Response> }) => ({ idFromName: () => 'global', get: () => obj });
const fullEnv = { ...env, ASSETS: { fetch: async () => new Response('Use the Vite dev server for the game', { status: 404 }) }, ACCOUNTS: ns(accounts), PRESENCE: ns(presence) };

const PORT = Number(process.env.PORT ?? 8788);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])) as [string, string][],
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
  });
  const response = await worker.fetch(request, fullEnv as never);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`API on http://localhost:${PORT} (Vite proxies /api here)`));
