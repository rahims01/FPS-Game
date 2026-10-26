/**
 * The site's Cloudflare Worker. Static files (the built game in dist/) are
 * served straight from assets; only /api/* runs this script (wrangler.jsonc,
 * run_worker_first), so the game itself costs no Worker requests.
 *
 *   GET  /api/turn    relay servers for cross-device multiplayer (turn.ts)
 *   GET  /api/online  real players online right now (presence.ts)
 *   POST /api/online  { session, leaving? }: check in or out, returns the count
 */
import { Presence } from './presence';
import { turn, type TurnEnv } from './turn';

export { Presence };

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

interface Env extends TurnEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  PRESENCE?: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/turn' && request.method === 'GET') return turn(env);
    if (pathname === '/api/online' && (request.method === 'GET' || request.method === 'POST')) {
      if (!env.PRESENCE) return new Response(JSON.stringify({ error: 'Presence is not configured' }), { status: 404, headers: { 'content-type': 'application/json' } });
      // One object for the whole game, so everyone reads the same number.
      return env.PRESENCE.get(env.PRESENCE.idFromName('global')).fetch(request);
    }
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
