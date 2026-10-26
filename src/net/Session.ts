import Peer, { type DataConnection } from 'peerjs';
import { setLoadout, type Agent } from '../sim/Agent';
import type { PlayerInput, SimEvent } from '../sim/FpsSim';
import { DEFAULT_RULES, PRACTICE_MODES, modeDef, type Difficulty, type LobbyRules, type Match, type MatchNotice, type ModeId } from '../sim/Match';
import { normalizeStreaks } from '../sim/killstreaks';
import { normalizePerks, THROWABLES } from '../sim/gear';
import type { Cosmetics } from '../game/cosmetics';
import type { SkinChoice } from '../assets/skins';
import { cleanChat } from './chat';
import {
  PEER_PREFIX,
  PROTOCOL_VERSION,
  SNAPSHOT_HZ,
  type ClientMsg,
  type HostMsg,
  type LobbyMsg,
  type LobbyPlayer,
  type NetButtons,
  type PlayerProfile,
  type Snapshot,
  type StartMsg
} from './protocol';
import { buildSnapshot } from './snapshot';
import { iceConfig } from './ice';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** People in a room, players and spectators together. */
const ROOM_MAX = 8;
/** A client that has been silent this long has gone (closed tab, lost connection, app switched away). */
const SILENT_MS = 15000;

/**
 * Opens a PeerJS peer (free public signalling server; the game traffic itself
 * is peer-to-peer, relayed through TURN when the two networks can't connect directly).
 */
const openPeer = async (id?: string): Promise<Peer> => {
  const { iceServers } = await iceConfig();
  return new Promise((resolve, reject) => {
    const opts = { debug: 0 as const, config: { iceServers } };
    const peer = id ? new Peer(id, opts) : new Peer(opts);
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
};

/** A chat line as the host relays it. */
export type ChatMsg = Extract<HostMsg, { t: 'chat' }>;

interface RemoteClient {
  conn: DataConnection;
  profile: PlayerProfile | null;
  /** Chosen to play (otherwise spectates). */
  playing: boolean;
  agentId: number;
  /** In the running match (as a player or a spectator). */
  started: boolean;
  input: PlayerInput;
  /** Latest reported body state, applied once per host tick. */
  state: { life: number; s: number[]; f: number; slide: number } | null;
  /** When we last heard anything from them (clients ping every 2 s). */
  lastSeen: number;
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
  tactical: false,
  switchSlot: -1
});

/** How many people a mode can field; anyone beyond that spectates. */
export const modeSlots = (mode: ModeId): number => {
  const def = modeDef(mode);
  if (def.humansOnly || PRACTICE_MODES.includes(mode)) return ROOM_MAX;
  if (mode === 'survival' || mode === 'zombies') return 4;
  return Math.min(ROOM_MAX, def.players);
};

/**
 * The host: owns the room code, the lobby (mode, rules, who plays) and the
 * chat, and during a match receives client inputs and broadcasts snapshots.
 */
export class HostSession {
  readonly code: string;
  private clients: RemoteClient[] = [];
  private match: Match | null = null;
  private events: SimEvent[] = [];
  private notices: MatchNotice[] = [];
  private lastSnap = 0;
  lobby: { mode: ModeId; difficulty: Difficulty; hostName: string; hostColor: number; rules: LobbyRules };
  /** The host plays (or only watches). */
  hostPlaying = true;
  /** A party: friends queue into a normal matchmade game together (bots look like real players). */
  party = false;
  /** Public matchmaking: strangers who found each other through Find Match. */
  public = false;
  onChange: (() => void) | null = null;
  /** A player left: `newName` is the bot that took over their soldier (if a match is running). */
  onClientLeft: ((name: string, agentId: number, newName: string | null) => void) | null = null;
  /** The match's names (shared with the game), and how many "Bot N" names are in use. */
  private names: string[] = [];
  private botCount = 0;
  onChat: ((msg: ChatMsg) => void) | null = null;

  private constructor(
    private peer: Peer,
    code: string,
    mode: ModeId,
    difficulty: Difficulty,
    hostName: string,
    hostColor: number
  ) {
    this.code = code;
    this.lobby = { mode, difficulty, hostName, hostColor, rules: { ...DEFAULT_RULES } };
    peer.on('connection', (conn) => this.accept(conn));
    // WebRTC can take a long time to report a closed tab; drop anyone who goes quiet.
    this.watchdog = window.setInterval(() => {
      const now = performance.now();
      // In the lobby browsers may throttle a hidden tab's pings, so allow longer there.
      for (const c of this.clients.slice()) {
        if (now - c.lastSeen < (c.started ? this.silentMs : this.silentMs * 2)) continue;
        try {
          c.conn.send({ t: 'end', reason: 'Disconnected: no response from your game for a while.' } satisfies HostMsg);
        } catch {
          /* already gone */
        }
        this.drop(c);
      }
    }, 1000);
  }

  private watchdog: number;
  /** How long a client may be silent before it is dropped (tests raise it for throttled tabs). */
  silentMs = SILENT_MS;

  /** Hosts at a fixed address (a matchmaking bucket). Throws if someone already holds it. */
  static async createAt(peerId: string, mode: ModeId, difficulty: Difficulty, hostName: string, hostColor: number): Promise<HostSession> {
    const peer = await openPeer(peerId);
    const s = new HostSession(peer, peerId.slice(-5), mode, difficulty, hostName, hostColor);
    s.public = true;
    return s;
  }

  static async create(mode: ModeId, difficulty: Difficulty, hostName: string, hostColor: number, party = false): Promise<HostSession> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode();
      try {
        const peer = await openPeer(PEER_PREFIX + code);
        const s = new HostSession(peer, code, mode, difficulty, hostName, hostColor);
        s.party = party;
        return s;
      } catch (e) {
        if ((e as { type?: string }).type !== 'unavailable-id') throw e;
      }
    }
    throw new Error('Could not create a room. Try again.');
  }

  get players(): LobbyPlayer[] {
    return [
      { id: 'host', name: this.lobby.hostName, color: this.lobby.hostColor, host: true, playing: this.hostPlaying },
      ...this.clients.filter((c) => c.profile).map((c) => ({ id: c.conn.peer, name: c.profile!.name, color: c.profile!.color, host: false, playing: c.playing }))
    ];
  }

  /** Everyone in the room, players and spectators. */
  get maxPlayers(): number {
    return ROOM_MAX;
  }

  get slots(): number {
    return modeSlots(this.lobby.mode);
  }

  /** People picked to play. */
  get playingCount(): number {
    return this.players.filter((p) => p.playing).length;
  }

  setLobby(mode: ModeId, difficulty: Difficulty): void {
    this.lobby.mode = mode;
    this.lobby.difficulty = difficulty;
    this.fitSlots();
    this.broadcastLobby();
  }

  setRules(rules: LobbyRules): void {
    this.lobby.rules = { ...rules };
    this.broadcastLobby();
  }

  /** The host picks who plays: flips one person between playing and spectating. */
  togglePlaying(id: string): void {
    const want = !this.players.find((p) => p.id === id)?.playing;
    if (want && this.playingCount >= this.slots) return;
    if (id === 'host') this.hostPlaying = want;
    else {
      const c = this.clients.find((x) => x.conn.peer === id);
      if (c) c.playing = want;
    }
    this.broadcastLobby();
    this.onChange?.();
  }

  /** After a mode change: bench the latest joiners if there are too many players now. */
  private fitSlots(): void {
    let over = this.playingCount - this.slots;
    for (let i = this.clients.length - 1; i >= 0 && over > 0; i--) {
      if (this.clients[i].playing) {
        this.clients[i].playing = false;
        over--;
      }
    }
    if (over > 0) this.hostPlaying = false;
  }

  private accept(conn: DataConnection): void {
    const client: RemoteClient = { conn, profile: null, playing: false, agentId: -1, started: false, input: blankInput(), state: null, lastSeen: performance.now() };
    conn.on('data', (raw) => this.receive(client, raw as ClientMsg));
    conn.on('close', () => this.drop(client));
    conn.on('error', () => this.drop(client));
    this.clients.push(client);
  }

  private drop(client: RemoteClient): void {
    const i = this.clients.indexOf(client);
    if (i < 0) return;
    this.clients.splice(i, 1);
    // A player who leaves mid-match is replaced by a labelled, robotic bot.
    let botName: string | null = null;
    if (this.match && client.agentId >= 0) {
      const a = this.match.sim.agents[client.agentId];
      if (a) {
        a.control = 'learned' in this.match.sim.brains ? 'learned' : 'heuristic';
        a.robotic = true;
        botName = `Bot ${++this.botCount}`;
        this.names[a.id] = botName;
        for (const c of this.clients) if (c.started && c.conn.open) c.conn.send({ t: 'rename', id: a.id, name: botName } satisfies HostMsg);
      }
      this.match.sim.remoteInputs.delete(client.agentId);
    }
    if (client.profile) {
      this.onClientLeft?.(client.profile.name, client.agentId, botName);
      this.system(botName ? `${client.profile.name} left · ${botName} took over` : `${client.profile.name} left`);
    }
    this.broadcastLobby();
    this.onChange?.();
  }

  private receive(client: RemoteClient, msg: ClientMsg): void {
    client.lastSeen = performance.now();
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
        client.conn.send({ t: 'reject', reason: 'That room is full.' } satisfies HostMsg);
        return;
      }
      client.profile = { ...msg.profile, name: cleanChat(msg.profile.name.slice(0, 16)) || 'Player', streaks: normalizeStreaks(msg.profile.streaks), perks: normalizePerks(msg.profile.perks) };
      // Late joiners spectate once the mode is full; the host can swap people around.
      client.playing = this.playingCount < this.slots;
      this.system(`${client.profile.name} joined`);
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
      inp.tactical ||= b.tactical;
      if (b.switchSlot >= 0) inp.switchSlot = b.switchSlot;
      client.state = { life: msg.life, s: msg.s, f: msg.f, slide: msg.slide };
    } else if (msg.t === 'chat') {
      if (client.profile) this.relayChat(client.profile.name, client.profile.color, msg.text);
    } else if (msg.t === 'ping') {
      client.conn.send({ t: 'pong', at: msg.at } satisfies HostMsg);
    } else if (msg.t === 'bye') {
      client.conn.close();
      this.drop(client);
    }
  }

  /** The host's own chat message. */
  sendChat(text: string): void {
    this.relayChat(this.lobby.hostName, this.lobby.hostColor, text);
  }

  private relayChat(name: string, color: number, raw: string): void {
    const text = cleanChat(String(raw));
    if (!text) return;
    this.broadcast({ t: 'chat', name, color, text });
  }

  private system(text: string): void {
    this.broadcast({ t: 'chat', name: '', color: 0xaaaaaa, text, system: true });
  }

  private broadcast(msg: ChatMsg): void {
    for (const c of this.clients) if (c.profile && c.conn.open) c.conn.send(msg);
    this.onChat?.(msg);
  }

  private lobbyMsg(): LobbyMsg {
    return { t: 'lobby', mode: this.lobby.mode, difficulty: this.lobby.difficulty, players: this.players, max: this.maxPlayers, slots: this.slots, rules: this.lobby.rules, party: this.party };
  }

  private broadcastLobby(): void {
    const msg = this.lobbyMsg();
    for (const c of this.clients) if (c.profile) c.conn.send(msg);
  }

  /**
   * Puts the chosen players into the match: each takes over a computer
   * player's slot (on alternating teams, so a 1v1 is you against your friend).
   * If the host only watches, the first player takes the host's soldier.
   * Everyone else spectates. The remaining computer players are labelled as
   * bots ("Bot 1", "Bot 2"...) and move like machines.
   */
  begin(match: Match, seed: number, names: string[], colors: number[], teamColors: [number, number] | null, skins: (SkinChoice | null)[], cosmetics: (Cosmetics | null)[] = []): void {
    this.match = match;
    this.names = names;
    const sim = match.sim;
    const def = match.def;
    const forced = match.mode === 'gungame' || match.mode === 'snipers' || match.mode === 'roulette' || match.mode === 'marksman' || match.mode === 'gunfight' || match.lobbyWeapon !== 'any';
    const taken = new Set<number>();
    if (this.hostPlaying) taken.add(match.player.id);
    else {
      // Nobody steers the host's soldier until a client takes it below.
      match.player.control = 'remote';
    }
    // Slot index: 0 is the host's seat (team 0); clients alternate teams after it.
    let slot = this.hostPlaying ? 1 : 0;
    for (const c of this.clients) {
      if (!c.profile || !c.playing) continue;
      const sameSide = ['survival', 'zombies', 'infected', 'hideseek', 'boss', ...PRACTICE_MODES].includes(match.mode);
      // A party sticks together on the host's team (overflow goes to the other side).
      const partyTeam = this.party && def.teams ? (sim.agents.some((b) => b.team === 0 && !taken.has(b.id) && !b.dummy && b.control !== 'player' && b.control !== 'remote') ? 0 : 1) : null;
      // Battle-royale squads: friends share the host's squad while it has room.
      const squadTeam = match.player.squad >= 0 ? match.player.team : null;
      const wantTeam = squadTeam !== null && sim.agents.some((b) => b.team === squadTeam && !taken.has(b.id) && b.control !== 'player' && b.control !== 'remote') ? squadTeam : partyTeam !== null ? partyTeam : !def.teams ? null : sameSide ? 0 : slot % 2;
      const free = (team: number | null) =>
        sim.agents.find((a) => !taken.has(a.id) && !a.dummy && a.control !== 'player' && a.control !== 'remote' && (team === null || a.team === team) && !(match.mode === 'infected' && a.team === 1));
      let a: Agent | undefined = slot === 0 ? match.player : (free(wantTeam) ?? free(null));
      if (!a) {
        const p = match.player;
        a = sim.spawn(wantTeam ?? sim.agents.length, 'remote', p.x + 1.5 * slot, p.z);
        setLoadout(a, ['rifle', 'pistol']);
      }
      slot++;
      taken.add(a.id);
      a.control = 'remote';
      a.style = 'soldier';
      if (!forced && a.weapons[0] !== 'knife') setLoadout(a, [c.profile.primary, c.profile.secondary ?? 'pistol']);
      match.streakChoices[a.id] = c.profile.streaks;
      a.perks = c.profile.perks ?? a.perks;
      a.lethal = c.profile.lethal ?? a.lethal;
      a.tactical = c.profile.tactical ?? a.tactical;
      if (a.grenades > 0) a.grenades = THROWABLES[a.lethal].count;
      if (a.tacticals > 0) a.tacticals = THROWABLES[a.tactical].count;
      cosmetics[a.id] = c.profile.cosmetics ?? null;
      c.agentId = a.id;
      names[a.id] = c.profile.name;
      skins[a.id] = c.profile.skins ?? {};
      if (!teamColors) colors[a.id] = c.profile.color;
    }
    // Rooms with friends: fillers are openly bots. Parties and public matches look like any matchmade game.
    if (!this.party && !this.public) {
      sim.roboticBots = true;
      for (const a of sim.agents) {
        if (a.control === 'player' || a.control === 'remote') continue;
        names[a.id] = a.dummy ? 'Target' : `Bot ${++this.botCount}`;
        skins[a.id] = null;
        cosmetics[a.id] = null;
      }
    }
    const humans = [...(this.hostPlaying ? [match.player.id] : []), ...this.clients.filter((c) => c.agentId >= 0).map((c) => c.agentId)];
    for (const c of this.clients) {
      if (!c.profile) continue;
      c.started = true;
      const start: StartMsg = {
        t: 'start',
        mode: match.mode,
        difficulty: match.opts.difficulty,
        seed,
        you: c.agentId,
        names,
        colors,
        teamColors,
        humans,
        spectate: c.agentId < 0,
        skins,
        rules: this.lobby.rules,
        cosmetics,
        party: this.party,
        night: !!match.opts.night,
        public: this.public
      };
      c.conn.send(start);
    }
  }

  /** After a match: everyone goes back to the room for another game. */
  returnToLobby(): void {
    this.match = null;
    this.events = [];
    this.notices = [];
    this.botCount = 0;
    for (const c of this.clients) {
      c.agentId = -1;
      c.started = false;
      c.state = null;
      c.input = blankInput();
      if (c.conn.open) c.conn.send({ t: 'toLobby' } satisfies HostMsg);
    }
    this.broadcastLobby();
    this.onChange?.();
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
      c.input.tactical = false;
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
    for (const c of this.clients) if (c.started && c.conn.open) c.conn.send(msg);
  }

  close(reason = 'The host left the match.'): void {
    for (const c of this.clients) {
      try {
        c.conn.send({ t: 'end', reason } satisfies HostMsg);
      } catch {
        /* already gone */
      }
    }
    window.clearInterval(this.watchdog);
    setTimeout(() => this.peer.destroy(), 300);
    this.match = null;
  }
}

/** A client: joins a room code, waits in the lobby, then plays (or watches) from the host's snapshots. */
export class ClientSession {
  onLobby: ((msg: LobbyMsg) => void) | null = null;
  onStart: ((msg: StartMsg) => void) | null = null;
  onSnap: ((snap: Snapshot) => void) | null = null;
  onEnd: ((reason: string) => void) | null = null;
  onChat: ((msg: ChatMsg) => void) | null = null;
  onRename: ((id: number, name: string) => void) | null = null;
  onToLobby: (() => void) | null = null;
  private ended = false;
  /** Smoothed round-trip time to the host, in milliseconds. */
  ping = 0;
  private pinger: number;
  private buttons: NetButtons = { fire: false, aim: false, sprint: false, crouch: false, reload: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };

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
    // Closing the tab says goodbye, so the host swaps in a bot right away.
    window.addEventListener('pagehide', this.onPageHide);
  }

  private onPageHide = () => this.leave();

  static async connect(code: string, profile: PlayerProfile, fullId?: string, timeoutMs = 20000): Promise<ClientSession> {
    const peer = await openPeer();
    const { relay } = await iceConfig();
    const conn = peer.connect(fullId ?? PEER_PREFIX + code.trim().toUpperCase(), { reliable: true });
    await new Promise<void>((resolve, reject) => {
      // A missing room fails fast ('peer-unavailable'); getting here means the room exists but no route to it was found.
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              relay
                ? 'Found the room but could not connect to the host. Check both connections and try again.'
                : "Found the room but couldn't connect: one of your networks blocks direct connections (common on school Wi-Fi and mobile data)."
            )
          ),
        timeoutMs
      );
      conn.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      peer.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error((e as { type?: string }).type === 'peer-unavailable' ? 'No game found with that code. Check it and that the host is still in the room.' : 'Could not connect to the host.'));
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
    else if (msg.t === 'chat') this.onChat?.(msg);
    else if (msg.t === 'rename') this.onRename?.(msg.id, msg.name);
    else if (msg.t === 'toLobby') this.onToLobby?.();
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

  sendChat(text: string): void {
    const t = text.trim();
    if (t && !this.ended && this.conn.open) this.conn.send({ t: 'chat', text: t.slice(0, 200) } satisfies ClientMsg);
  }

  /** Latches one-shot actions so a quick key press between packets is not lost. */
  press(input: PlayerInput): void {
    const b = this.buttons;
    b.reload ||= input.reload;
    b.melee ||= input.melee;
    b.grenade ||= input.grenade;
    b.tactical ||= input.tactical;
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
    this.buttons = { fire: false, aim: false, sprint: false, crouch: false, reload: false, melee: false, grenade: false, tactical: false, switchSlot: -1 };
  }

  leave(): void {
    window.removeEventListener('pagehide', this.onPageHide);
    if (!this.ended && this.conn.open) this.conn.send({ t: 'bye' } satisfies ClientMsg);
    this.ended = true;
    window.clearInterval(this.pinger);
    setTimeout(() => this.peer.destroy(), 300);
  }
}
