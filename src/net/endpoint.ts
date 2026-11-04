/**
 * Where the game's API lives. On the game's own site it is the same address
 * (relative). A build for a game portal sets VITE_API_BASE (in the gitignored
 * .env.production.local) to the Worker's full address, since the portal serves
 * the files from its own domain where there is no /api.
 */
const base = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').trim().replace(/\/+$/, '');

export const apiUrl = (path: string): string => (base ? `${base}/api/${path}` : `${import.meta.env.BASE_URL}api/${path}`);
