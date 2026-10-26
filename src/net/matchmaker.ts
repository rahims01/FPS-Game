import type { Difficulty, ModeId } from '../sim/Match';
import { PEER_PREFIX, type PlayerProfile } from './protocol';
import { ClientSession, HostSession } from './Session';

/**
 * Real-player matchmaking with no server of our own (it runs on static hosting
 * like Cloudflare Pages). Players searching for the same mode and lobby share
 * a few well-known peer ids ("buckets") on the public PeerJS signalling server:
 *
 *   1. Try to join a bucket someone is already waiting in.
 *   2. Otherwise claim a free bucket and wait in it while the matchmaking
 *      screen fills up. If someone joins in that window, you play together.
 *
 * Two players only meet if they search the same mode within the same few
 * seconds, so with a handful of players online it almost never happens, and
 * the more people play, the more often lobbies have real people in them.
 * Everyone else in the lobby is a computer player, as usual.
 */
export type MatchmakingResult = { role: 'host'; session: HostSession } | { role: 'client'; session: ClientSession } | null;

/** Buckets per mode and lobby. More buckets lets more searches wait at once. */
const BUCKETS = 2;

const bucketId = (mode: ModeId, difficulty: Difficulty, k: number) => `${PEER_PREFIX}mm-${mode}-${difficulty}-${k}`;

/** Modes that can pull real players together (normal matchmade modes only). */
export const canMatchmake = (mode: ModeId): boolean => !['training', 'aimtrainer', 'freeroam', 'survival', 'zombies'].includes(mode);

export const seekPlayers = async (mode: ModeId, difficulty: Difficulty, profile: PlayerProfile, cancelled: () => boolean): Promise<MatchmakingResult> => {
  // Claiming a peer id is atomic on the signalling server, so: try to claim a
  // bucket and host in it; if it's taken, someone is waiting there, so join them.
  // (Joining first would let two searchers both miss each other and both host.)
  for (let k = 0; k < BUCKETS && !cancelled(); k++) {
    const id = bucketId(mode, difficulty, k);
    try {
      const host = await HostSession.createAt(id, mode, difficulty, profile.name, profile.color);
      if (cancelled()) {
        host.close();
        return null;
      }
      return { role: 'host', session: host };
    } catch (e) {
      if ((e as { type?: string }).type !== 'unavailable-id') return null;
    }
    // Someone holds this bucket: join their lobby (they may be full or already playing).
    let session: ClientSession | null = null;
    try {
      session = await ClientSession.connect('', profile, id, 3000);
      const s = session;
      const ok = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 3000);
        s.onLobby = () => {
          clearTimeout(timer);
          resolve(true);
        };
        s.onEnd = () => {
          clearTimeout(timer);
          resolve(false);
        };
      });
      if (ok && !cancelled()) return { role: 'client', session: s };
      s.leave();
    } catch {
      session?.leave();
    }
  }
  return null;
};
