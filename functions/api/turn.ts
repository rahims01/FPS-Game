/**
 * Cloudflare Pages Function: GET /api/turn
 *
 * Hands the browser TURN relay servers, so two players on different networks
 * (school Wi-Fi, mobile data, strict routers) can still connect when a direct
 * peer-to-peer link is blocked. Every relay you configure is offered; the
 * browser uses whichever works. Configure any of these in the Pages project
 * (Settings > Variables and Secrets), then redeploy:
 *
 *   Free, static login (e.g. ExpressTURN, 1000 GB/month free, port 3478):
 *     TURN_URLS        comma-separated, e.g. turn:relay1.expressturn.com:3478
 *     TURN_USERNAME
 *     TURN_CREDENTIAL
 *
 *   Free, API key (Metered Open Relay, 20 GB/month free, also ports 80/443,
 *   which get through more school firewalls):
 *     METERED_DOMAIN   e.g. yourapp.metered.live
 *     METERED_API_KEY
 *
 *   Cloudflare Realtime TURN (paid beyond its free allowance):
 *     TURN_KEY_ID
 *     TURN_KEY_API_TOKEN
 *
 * With none set this returns 404 and the game uses direct connections only.
 */
interface Env {
  TURN_URLS?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
  METERED_DOMAIN?: string;
  METERED_API_KEY?: string;
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Browsers block port 53, so those URLs only add a timeout; STUN entries are dropped (the game has its own). */
const relaysOnly = (servers: IceServer[]): IceServer[] =>
  servers
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/.test(u) && !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);

const staticTurn = (env: Env): IceServer[] => {
  if (!env.TURN_URLS || !env.TURN_USERNAME || !env.TURN_CREDENTIAL) return [];
  const urls = env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean);
  return urls.length ? [{ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }] : [];
};

const metered = async (env: Env): Promise<IceServer[]> => {
  if (!env.METERED_DOMAIN || !env.METERED_API_KEY) return [];
  const domain = env.METERED_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`);
  if (!res.ok) return [];
  return (await res.json()) as IceServer[];
};

const cloudflare = async (env: Env): Promise<IceServer[]> => {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return [];
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
    // Longer than any match, so credentials never expire mid-game.
    body: JSON.stringify({ ttl: 6 * 60 * 60 })
  });
  if (!res.ok) return [];
  return ((await res.json()) as { iceServers: IceServer[] }).iceServers;
};

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> => {
  // One provider failing (quota, outage) never hides the others.
  const results = await Promise.allSettled([Promise.resolve(staticTurn(env)), metered(env), cloudflare(env)]);
  const iceServers = relaysOnly(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
  if (!iceServers.length) return json({ error: 'No TURN relay is configured' }, 404);
  return json({ iceServers });
};
