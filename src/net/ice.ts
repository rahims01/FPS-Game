/**
 * Where WebRTC looks for a route between two players.
 *
 * STUN lets each browser learn its public address, which is enough when both
 * networks allow a direct link. Many don't (school and office Wi-Fi, mobile
 * data, carrier-grade NAT), and then traffic has to go through a TURN relay.
 * PeerJS's built-in relays no longer answer, so the relay comes from our own
 * Cloudflare Pages Function (functions/api/turn.ts) when it is configured.
 */
export type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN: IceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

let cached: Promise<{ iceServers: IceServer[]; relay: boolean }> | null = null;

/** ICE servers for a new connection: relay credentials when the site has them, STUN only otherwise. */
export const iceConfig = (): Promise<{ iceServers: IceServer[]; relay: boolean }> => {
  cached ??= (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${import.meta.env.BASE_URL}api/turn`, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: IceServer[] };
        if (data.iceServers?.length) return { iceServers: [...data.iceServers, ...STUN], relay: true };
      }
    } catch {
      /* no function here (local dev) or it failed: direct connections only */
    }
    // Ask again next time rather than remembering a failure for the whole visit.
    cached = null;
    return { iceServers: STUN, relay: false };
  })();
  return cached;
};
