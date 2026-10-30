import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // /api/* goes to `npm run dev:api` (scripts/dev-api.mts) while developing.
  server: { port: 5190, proxy: { '/api': 'http://localhost:8788' } }
});
