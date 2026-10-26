/**
 * Cloudflare Pages Function: /api/online
 *
 *   GET                      -> { online }   real game tabs open right now
 *   POST { session, leaving? } -> { online } check in (or out) and get the count
 *
 * Forwards to the Presence Durable Object (workers/presence). Bind it in the
 * Pages project: Settings > Bindings > Durable Object, variable name PRESENCE,
 * Worker "fps-shooter-presence", class "Presence". Without the binding this
 * returns 404 and the game shows its shared estimate alone.
 */
interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}
interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}
interface Env {
  PRESENCE?: DurableObjectNamespace;
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.PRESENCE) return new Response(JSON.stringify({ error: 'Presence is not configured' }), { status: 404, headers: { 'content-type': 'application/json' } });
  if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  // One object for the whole game, so everyone reads the same number.
  const stub = env.PRESENCE.get(env.PRESENCE.idFromName('global'));
  return stub.fetch(request);
};
