/**
 * GET /api/turn: TURN relay servers for the browser, so two players on
 * different networks (school Wi-Fi, mobile data, strict routers) can still
 * connect when a direct peer-to-peer link is blocked. Every relay configured
 * here is offered; the browser uses whichever works. Set these on the Worker
 * (Settings > Variables and Secrets):
 *
 *   ExpressTURN (free, 1000 GB/month, port 3478), the main relay:
 *     TURN_URLS        comma-separated, e.g. turn:relay1.expressturn.com:3478
 *     TURN_USERNAME
 *     TURN_CREDENTIAL  (secret)
 *
 *   Optional, Metered Open Relay (free, 20 GB/month, also ports 80/443):
 *     METERED_DOMAIN   e.g. yourapp.metered.live
 *     METERED_API_KEY  (secret)
 *
 *   Optional, Cloudflare Realtime TURN (paid beyond its free allowance):
 *     TURN_KEY_ID, TURN_KEY_API_TOKEN (secret)
 *
 * With none set this returns 404 and the game uses direct connections only.
 */
export interface TurnEnv {
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

/** A provider that hangs is skipped rather than holding up the others (the game waits about 4 s in total). */
const PROVIDER_TIMEOUT_MS = 2500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Browsers block port 53, so those URLs only add a timeout; STUN entries are dropped (the game has its own). */
const relaysOnly = (servers: IceServer[]): IceServer[] =>
  servers
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => /^turns?:/.test(u) && !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);

const staticTurn = (env: TurnEnv): IceServer[] => {
  if (!env.TURN_URLS || !env.TURN_USERNAME || !env.TURN_CREDENTIAL) return [];
  // Forgiving about how the address was pasted: quotes, spaces, or no "turn:" in front.
  const urls = env.TURN_URLS.split(',')
    .map((u) => u.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .map((u) => (/^turns?:/i.test(u) ? u : `turn:${u.replace(/^[a-z]+:\/\//i, '')}`));
  return urls.length ? [{ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }] : [];
};

const metered = async (env: TurnEnv): Promise<IceServer[]> => {
  if (!env.METERED_DOMAIN || !env.METERED_API_KEY) return [];
  const domain = env.METERED_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`, { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  // A broken service can answer 200 with an error object; only a list of servers counts.
  return Array.isArray(data) ? (data as IceServer[]) : [];
};

const cloudflare = async (env: TurnEnv): Promise<IceServer[]> => {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return [];
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
    // Longer than any match, so credentials never expire mid-game.
    body: JSON.stringify({ ttl: 6 * 60 * 60 }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  });
  if (!res.ok) return [];
  return ((await res.json()) as { iceServers: IceServer[] }).iceServers;
};

export const turn = async (env: TurnEnv): Promise<Response> => {
  // One provider failing (quota, outage) never hides the others.
  const results = await Promise.allSettled([Promise.resolve(staticTurn(env)), metered(env), cloudflare(env)]);
  const iceServers = relaysOnly(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
  if (!iceServers.length) {
    // Names only (never values), so a misnamed or missing setting is easy to spot.
    const names: (keyof TurnEnv)[] = ['TURN_URLS', 'TURN_USERNAME', 'TURN_CREDENTIAL', 'METERED_DOMAIN', 'METERED_API_KEY', 'TURN_KEY_ID', 'TURN_KEY_API_TOKEN'];
    return json(
      {
        error: 'No TURN relay is configured',
        settingsFound: names.filter((n) => !!env[n]),
        needs: 'TURN_URLS, TURN_USERNAME and TURN_CREDENTIAL under Settings > Variables and Secrets (not Build variables)'
      },
      404
    );
  }
  return json({ iceServers });
};
