import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * While developing, /api/* goes to `npm run dev:api` (scripts/dev-api.mts) on
 * port 8788. If that isn't running, the game still works: requests get a quiet
 * 503 instead of a proxy error in the terminal.
 */
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api', async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      try {
        const r = await fetch(`http://localhost:8788/api${req.url ?? ''}`, {
          method: req.method,
          headers: Object.fromEntries(Object.entries(req.headers).filter((e): e is [string, string] => typeof e[1] === 'string')),
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
        });
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
      } catch {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'The local API is not running (npm run dev:api)' }));
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), devApi()],
  server: { port: 5190 }
});
