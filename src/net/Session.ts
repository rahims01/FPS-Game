import Peer, { type DataConnection } from 'peerjs';
import { setLoadout, type Agent } from '../sim/Agent';
import type { PlayerInput, SimEvent } from '../sim/FpsSim';
import type { Difficulty, Match, MatchNotice, ModeId } from '../sim/Match';
import { modeDef } from '../sim/Match';
import {
  PEER_PREFIX,
  PROTOCOL_VERSION,
  SNAPSHOT_HZ,
  type ClientMsg,
  type HostMsg,
  type LobbyPlayer,
  type NetButtons,
  type PlayerProfile,
  type Snapshot,
  type StartMsg
} from './protocol';
import { buildSnapshot } from './snapshot';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** Opens a PeerJS peer (free public signalling server; the game traffic itself is peer-to-peer). */
const openPeer = (id?: string): Promise<Peer> =>
  new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error('Could not reach the matchmaking server. Check your connection.'));
    }, 12000);
    peer.on('open', () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on('error', (e) => {
      clearTimeout(timer);
      peer.destroy();
      reject(e);
    });
  });

interface RemoteClient {
  conn: DataConnection;
  profile: PlayerProfile | null;
  agentId: number;
  input: PlayerInput;
  /** Latest reported body state, applied once per host tick. */
  state: { life: number; s: number[]; f: number; slide: number } | null;
}

const blankInput = (): PlayerInput => ({
  forward: 0,
  right: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  aim: false,
  reload: false,
  jump: false,
  sprint: false,
  crouch: false,
  melee: false,
  grenade: false,
  switchSlot: -1
});

/**
 * The host: owns the room code, the lobby and, during a match, receives client
 * inputs and broadcasts snapshots.
 */
export class HostSession {
  readonly code: string;
  private clients: RemoteClient[] = [];
  private match: Match | null = null;
  private events: SimEvent[] = [];
  private notices: MatchNotice[] = [];
  private lastSnap = 0;
  lobby: { mode: ModeId; difficulty: Difficulty; hostName: string; hostColor: number };
  onChange: (() => void) | null = null;
  onClientLeft: ((name: string) => void) | null = null;

  private constructor(
    private peer: Peer,
    code: string,
    mode: ModeId,
    difficulty: Difficulty,
    hostName: string,
    hostColor: number
  ) {
    this.code = code;
    this.lobby = { mode, difficulty, hostName, hostColor };
    peer.on('connection', (conn) => this.accept(conn));
  }

  static async create(mode: ModeId, difficulty: Difficulty, hostName: string, hostColor: number): Promise<HostSession> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode();
      try {
        const peer = await openPeer(PEER_PREFIX + code);
        return new HostSession(peer, code, mode, difficulty, hostName, hostColor);
      } catch (e) {
        if ((e as { type?: string }).type !== 'unavailable-id') throw e;
      }
    }
    throw new Error('Could not create a room. Try again.');
  }

  get players(): LobbyPlayer[] {
    return [
      { name: this.lobby.hostName, color: this.lobby.hostColor, host: true },
      ...this.clients.filter((c) => c.profile).map((c) => ({ name: c.profile!.name, color: c.profile!.color, host: false }))
    ];
  }

  get maxPlayers(): number {
    const def = modeDef(this.lobby.mode);
    return def.humansOnly ? 8 : Math.max(2, Math.min(8, def.id === 'survival' ? 4 : def.players));
  }

  setLobby(mode: ModeId, difficulty: Difficulty): void {
    this.lobby.mode = mode;
    this.lobby.difficulty = difficulty;
    this.broadcastLobby();
  }

  private accept(conn: DataConnection): void {
    const client: RemoteClient = { conn, profile: null, agentId: -1, input: blankInput(), state: null };
    conn.on('data', (raw) => this.receive(client, raw as ClientMsg));
    conn.on('close', () => this.drop(client));
    conn.on('error', () => this.drop(client));
    this.clients.push(client);
  }

  private drop(client: RemoteClient): void {
    const i = this.clients.indexOf(client);
    if (i < 0) return;
    this.clients.splice(i, 1);
    // A player who leaves mid-match is handed back to the computer.
    if (this.match && client.agentId >= 0) {
      const a = this.match.sim.agents[client.agentId];
      if (a) a.control = 'learned' in this.match.sim.brains ? 'learned' : 'heuristic';
      this.match.sim.remoteInputs.delete(client.agentId);
    }
    if (client.profile) this.onClientLeft?.(client.profile.name);
    this.broadcastLobby();
    this.onChange?.();
  }

  private receive(client: RemoteClient, msg: ClientMsg): void {
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) {
        client.conn.send({ t: 'reject', reason: 'Game version mismatch. Refresh the page.' } satisfies HostMsg);
        return;
      }
      if (this.match) {
        client.conn.send({ t: 'reject', reason: 'That match has already started.' } satisfies HostMsg);
        return;
      }
      if (this.players.length >= this.maxPlayers) {
        client.conn.send({ t: 'reject', reason: 'That lobby is full.' } satisfies HostMsg);
        return;
      }
      client.profile = { ...msg.profile, name: msg.profile.name.slice(0, 16) || 'Player' };
      this.broadcastLobby();
      this.onChange?.();
    } else if (msg.t === 'in') {
      const b = msg.b;
      const inp = client.input;
      inp.fire = b.fire;
      inp.aim = b.aim;
      inp.sprint = b.sprint;
      inp.crouch = b.crouch;
      inp.yaw = msg.s[6];
      inp.pitch = msg.s[7];
      // One-shot actions stay latched until the host has stepped once.
      inp.reload ||= b.reload;
      inp.melee ||= b.melee;
      inp.grenade ||= b.grenade;
      if (b.switchSlot >= 0) inp.switchSlot = b.switchSlot;
      client.state = { life: msg.life, s: msg.s, f: msg.f, slide: msg.slide };
    } else if (msg.t === 'ping') {
      client.conn.send({ t: 'pong', at: msg.at } satisfies HostMsg);
    } else if (msg.t === 'bye') {
      client.conn.close();
      this.drop(client);
    }
  }

  private broadcastLobby(): void {
    const msg: HostMsg = { t: 'lobby', mode: this.lobby.mode, difficulty: this.lobby.difficulty, players: this.players, max: this.maxPlayers };
    for (const c of this.clients) if (c.profile) c.conn.send(msg);
  }

  /**
   * Puts every lobby player into the match: each takes over a computer
   * player's slot (on alternating teams, so a 1v1 is you against your friend).
   */
  begin(match: Match, seed: number, names: string[], colors: number[], teamColors: [number, number] | null): void {
    this.match = match;
    const sim = match.sim;
    const def = match.def;
    const forced = match.mode === 'gungame' || match.mode === 'snipers';
    const taken = new Set<number>([match.player.id]);
    let k = 0;
    for (const c of this.clients) {
      if (!c.profile) continue;
      k++;
      const wantTeam = !def.teams ? null : match.mode === 'survival' || match.mode === 'zombies' || match.mode === 'infected' || match.mode === 'hideseek' ? 0 : k % 2 === 1 ? 1 : 0;
      const free = (team: number | null) =>
        sim.agents.find((a) => !taken.has(a.id) && a.control !== 'player' && a.control !== 'remote' && (team === null || a.team === team) && !(match.mode === 'infected' && a.team === 1));
      let a: Agent | undefined = free(wantTeam) ?? free(null);
      if (!a) {
        const p = match.player;
        a = sim.spawn(wantTeam ?? sim.agents.length, 'remote', p.x + 1.5 * k, p.z);
        setLoadout(a, ['rifle', 'pistol']);
      }
      taken.add(a.id);
      a.control = 'remote';
      a.style = 'soldier';
      if (!forced && a.weapons[0] !== 'knife') setLoadout(a, [c.profile.primary, 'pistol']);
      c.agentId = a.id;
      names[a.id] = c.profile.name;
      if (!teamColors) colors[a.id] = c.profile.color;
    }
    const humans = [match.player.id, ...this.clients.filter((c) => c.agentId >= 0).map((c) => c.agentId)];
    for (const c of this.clients) {
      if (c.agentId < 0) continue;
      const start: StartMsg = { t: 'start', mode: match.mode, difficulty: match.opts.difficulty, seed, you: c.agentId, names, colors, teamColors, humans };
      c.conn.send(start);
    }
  }

  /** Feeds the latest client inputs and positions into the simulation. Call before each host tick. */
  applyInputs(): void {
    const m = this.match;
    if (!m) return;
    for (const c of this.clients) {
      if (c.agentId < 0) continue;
      const a = m.sim.agents[c.agentId];
      if (!a) continue;
      const st = c.state;
      // Trust the client's own movement (it is simulated with the same rules), but only for its current life.
      if (st && a.alive && st.life === a.life) {
        const [x, y, z, vx, vy, vz] = st.s;
        if (Math.hypot(x - a.x, z - a.z) < 6) {
          a.x = x;
          a.y = y;
          a.z = z;
          a.vx = vx;
          a.vy = vy;
          a.vz = vz;
          a.onGround = (st.f & 1) === 1;
          a.crouching = (st.f & 2) === 2;
          a.slideT = st.slide;
        }
      }
      m.sim.remoteInputs.set(c.agentId, c.input);
    }
  }

  /** After a host tick: one-shot actions have been consumed. */
  clearOneShots(): void {
    for (const c of this.clients) {
      c.input.reload = false;
      c.input.melee = false;
      c.input.grenade = false;
      c.input.switchSlot = -1;
    }
  }

  queueEvents(ev: SimEvent[]): void {
    if (this.clients.length) this.events.push(...ev);
  }

  queueNotices(no: MatchNotice[]): void {
    if (this.clients.length) this.notices.push(...no);
  }

  /** Sends a snapshot if one is due. */
  tick(now: number): void {
    if (!this.match || now - this.lastSnap < 1000 / SNAPSHOT_HZ) return;
    this.lastSnap = now;
    const snap: Snapshot = buildSnapshot(this.match, this.events, this.notices);
    this.events = [];
    this.notices = [];
    const msg: HostMsg = { t: 'snap', snap };
    for (const c of this.clients) if (c.agentId >= 0 && c.conn.open) c.conn.send(msg);
  }

  close(reason = 'The host left the match.'): void {
    for (const c of this.clients) {
      try {
        c.conn.send({ t: 'end', reason } satisfies HostMsg);
      } catch {
        /* already gone */
      }
    }
    setTimeout(() => this.peer.destroy(), 300);
    this.match = null;
  }
}

/** A client: joins a room code, waits in the lobby, then plays from the host's snapshots. */
export class ClientSession {
  onLobby: ((msg: Extract<HostMsg, { t: 'lobby' }>) => void) | null = null;
  onStart: ((msg: StartMsg) => void) | null = null;
  onSnap: ((snap: Snapshot) => void) | null = null;
  onEnd: ((reason: string) => void) | null = null;
  private ended = false;
  /** Smoothed round-trip time to the host, in milliseconds. */
  ping = 0;
  private pinger: number;
  private buttons: NetButtons = { fire: false, aim: false, sprint: false, crouch: false, reload: false, melee: false, grenade: false, switchSlot: -1 };

  private constructor(
    private peer: Peer,
    private conn: DataConnection
  ) {
    conn.on('data', (raw) => this.receive(raw as HostMsg));
    conn.on('close', () => this.end('Lost connection to the host.'));
    conn.on('error', () => this.end('Lost connection to the host.'));
    this.pinger = window.setInterval(() => {
      if (this.conn.open) this.conn.send({ t: 'ping', at: performance.now() } satisfies ClientMsg);
    }, 2000);
  }

  static async connect(code: string, profile: PlayerProfile): Promise<ClientSession> {
    const peer = await openPeer();
    const conn = peer.connect(PEER_PREFIX + code.trim().toUpperCase(), { reliable: true });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No game found with that code (or the host could not be reached).')), 12000);
      conn.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      peer.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error((e as { type?: string }).type === 'peer-unavailable' ? 'No game found with that code.' : 'Could not connect to the host.'));
      });
    }).catch((e) => {
      peer.destroy();
      throw e;
    });
    const s = new ClientSession(peer, conn);
    conn.send({ t: 'hello', v: PROTOCOL_VERSION, profile } satisfies ClientMsg);
    return s;
  }

  private receive(msg: HostMsg): void {
    if (msg.t === 'lobby') this.onLobby?.(msg);
    else if (msg.t === 'start') this.onStart?.(msg);
    else if (msg.t === 'snap') this.onSnap?.(msg.snap);
    else if (msg.t === 'pong') {
      const rtt = performance.now() - msg.at;
      this.ping = this.ping ? this.ping * 0.7 + rtt * 0.3 : rtt;
    } else if (msg.t === 'reject' || msg.t === 'end') this.end(msg.reason);
  }

  private end(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    window.clearInterval(this.pinger);
    this.onEnd?.(reason);
    setTimeout(() => this.peer.destroy(), 300);
  }

  /** Latches one-shot actions so a quick key press between packets is not lost. */
  press(input: PlayerInput): void {
    const b = this.buttons;
    b.reload ||= input.reload;
    b.melee ||= input.melee;
    b.grenade ||= input.grenade;
    if (input.switchSlot >= 0) b.switchSlot = input.switchSlot;
    // A quick semi-auto click between packets still counts as a shot.
    b.fire ||= input.fire;
  }

  sendInput(a: Agent, input: PlayerInput): void {
    if (this.ended || !this.conn.open) return;
    const b = this.buttons;
    const msg: ClientMsg = {
      t: 'in',
      life: a.life,
      // Raw aim: the host runs the same recoil pattern on its copy of this player.
      s: [a.x, a.y, a.z, a.vx, a.vy, a.vz, input.yaw, input.pitch],
      f: (a.onGround ? 1 : 0) | (a.crouching ? 2 : 0) | (a.sprinting ? 4 : 0),
      slide: a.slideT,
      b: { ...b, fire: b.fire || input.fire, aim: input.aim, sprint: input.sprint, crouch: input.crouch }
    };
    this.conn.send(msg);
    this.buttons = { fire: false, aim: false, sprint: false, crouch: false, reload: false, melee: false, grenade: false, switchSlot: -1 };
  }

  leave(): void {
    if (!this.ended && this.conn.open) this.conn.send({ t: 'bye' } satisfies ClientMsg);
    this.ended = true;
    window.clearInterval(this.pinger);
    setTimeout(() => this.peer.destroy(), 300);
  }
}
