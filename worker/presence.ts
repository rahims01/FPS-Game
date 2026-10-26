/**
 * Live player counter: one Durable Object that remembers which game tabs have
 * checked in recently. Memory only (no storage writes), which is all a "who's
 * online right now" number needs; if Cloudflare evicts the object the count
 * rebuilds within one check-in interval. Free plan: SQLite-backed class (see
 * wrangler.jsonc), 100,000 requests a day.
 */

/** A tab counts as online for this long after its last check-in (clients check in every 2 minutes). */
const TTL_MS = 5 * 60 * 1000;
/** Ignore anything that doesn't look like our random session ids. */
const SESSION = /^[a-z0-9]{8,32}$/;

export class Presence {
  private seen = new Map<string, number>();

  private count(now: number): number {
    for (const [id, at] of this.seen) if (now - at > TTL_MS) this.seen.delete(id);
    return this.seen.size;
  }

  async fetch(request: Request): Promise<Response> {
    const now = Date.now();
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as { session?: string; leaving?: boolean } | null;
      const id = body?.session;
      if (id && SESSION.test(id)) {
        if (body?.leaving) this.seen.delete(id);
        // A hard cap keeps a flood of fake ids from growing memory without bound.
        else if (this.seen.size < 100000 || this.seen.has(id)) this.seen.set(id, now);
      }
    }
    return new Response(JSON.stringify({ online: this.count(now) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
}
