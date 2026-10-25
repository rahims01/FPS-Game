import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, type LoadedAssets } from './assets/AssetRegistry';
import { GameAudio } from './game/Audio';
import { Game, type GameSettings, type HudState, type NetRole } from './game/Game';
import { ClientSession, HostSession, type ChatMsg } from './net/Session';
import type { LobbyMsg, LobbyPlayer } from './net/protocol';
import type { ChatLine } from './net/chat';
import { basePingFor, COLORS, cssColor, isDark, levelFor, prepareLobby } from './game/identity';
import { loadPolicy } from './rl/PolicyBrain';
import type { Brain } from './sim/FpsSim';
import { DEFAULT_RULES, MODES, PRACTICE_MODES, modeDef, type Difficulty, type LobbyRules, type ModeId } from './sim/Match';
import { streakDef } from './sim/killstreaks';
import { perkDef, THROWABLES } from './sim/gear';
import { PRIMARIES, WEAPONS, type WeaponId } from './sim/weapons';
import { divisionOf, levelOf, loadProfile, rankedDifficulty, RANKED_MODES, rankOf, recordRanked, type Division, type Profile } from './game/progression';
import { Hud } from './ui/Hud';
import { SettingsPanel } from './ui/SettingsPanel';
import { LoadoutPanel } from './ui/LoadoutPanel';
import { ProfilePanel } from './ui/ProfilePanel';
import { TouchControls } from './ui/TouchControls';
import { ChatBox } from './ui/ChatBox';
import { EndScreen } from './ui/EndScreen';
import { keyLabel, loadSettings, QUALITY_PRESETS, saveSettings, suggestQuality } from './game/settings';
import { PadMenus } from './game/gamepad';

type Screen = { kind: 'menu' } | { kind: 'finding' } | { kind: 'playing' } | { kind: 'host-lobby' } | { kind: 'join-lobby' };
type MenuTab = 'play' | 'loadout' | 'profile' | 'settings';

interface LobbyView {
  mode: ModeId;
  difficulty: Difficulty;
  players: LobbyPlayer[];
  max: number;
  slots: number;
  rules: LobbyRules;
  party: boolean;
}

const defaultName = () => `Player${Math.floor(1000 + Math.random() * 9000)}`;

/** Saved settings, or (first visit) defaults with a quality preset suited to this device. */
const initialSettings = (): GameSettings => {
  let fresh = true;
  try {
    fresh = !localStorage.getItem('fps-settings-v3') && !localStorage.getItem('fps-settings-v2');
  } catch {
    /* no storage */
  }
  const s = loadSettings(defaultName(), COLORS[Math.floor(Math.random() * COLORS.length)].hex);
  if (fresh) {
    const q = suggestQuality();
    s.quality = q;
    s.graphics = { ...QUALITY_PRESETS[q] };
  }
  return s;
};

/** Developer switch: ?ai=heuristic runs the hand-written opponents instead of the trained policy. */
const forceHeuristic = new URLSearchParams(location.search).get('ai') === 'heuristic';
/** Developer switch: ?night=1 makes every eligible match a night map. */
const forceNight = new URLSearchParams(location.search).get('night') === '1';

const LOBBY: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Casual' },
  { id: 'normal', label: 'Standard' },
  { id: 'hard', label: 'Pro' }
];

const audio = new GameAudio();

const MODE_GROUPS = ['Practice', 'Team', 'Objective', 'Free-for-all', 'Party', 'Special', 'Online only'] as const;

/** Modes played on generated maps, which can come up at night. */
const NIGHT_CHANCE = 0.18;
const NO_NIGHT: ModeId[] = ['1v1', '2v2', '3v3', 'gunfight', 'training', 'aimtrainer', 'survival', 'zombies'];

let chatId = 0;

/** Players online right now: a daily rhythm (busy evenings, quiet mornings) plus noise. */
const playersOnline = (): number => {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  const wave = 0.55 + 0.45 * Math.sin(((h - 13) / 24) * Math.PI * 2);
  const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.25 : 1;
  return Math.round((6000 + 15000 * wave) * weekend + (Math.random() - 0.5) * 400);
};

export const App = () => {
  const [assets, setAssets] = useState<LoadedAssets | null>(null);
  const [loadMsg, setLoadMsg] = useState('Loading…');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [tab, setTab] = useState<MenuTab>('play');
  const [mode, setMode] = useState<ModeId>('1v1');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [round, setRound] = useState(0);
  // Ranked.
  const [ranked, setRanked] = useState(false);
  const [rankedResult, setRankedResult] = useState<{ delta: number; division: Division; sr: number } | null>(null);
  const rankedDone = useRef(false);
  // Online play.
  const netRef = useRef<NetRole | null>(null);
  const hostRef = useRef<HostSession | null>(null);
  const clientRef = useRef<ClientSession | null>(null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [netBusy, setNetBusy] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [joined, setJoined] = useState(1);
  const [lobbyNames, setLobbyNames] = useState<string[]>([]);
  const [online, setOnline] = useState(playersOnline);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const mount = useRef<HTMLDivElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);

  useEffect(() => {
    loadAssets(setLoadMsg)
      .then(setAssets)
      .catch((e: Error) => setLoadError(e.message));
    void loadPolicy().then((p) => setBrain(() => p.brain));
  }, []);

  useEffect(() => {
    saveSettings(settings);
    game.current?.applySettings(settings);
    // Accessibility: text size, colourblind palettes and high contrast are page-wide styles.
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.access.uiScale));
    root.dataset.cb = settings.access.colorblind;
    root.classList.toggle('hc', settings.access.highContrast);
  }, [settings]);

  // Controller navigation in menus (in a match the game reads the controller itself).
  useEffect(() => {
    const nav = new PadMenus();
    nav.onBack = () => {
      setShowSettings(false);
      if (game.current?.paused) game.current.requestLock();
    };
    nav.start();
    return () => nav.stop();
  }, []);

  // The online counter drifts.
  useEffect(() => {
    const t = window.setInterval(() => setOnline((n) => Math.max(1000, Math.round(n * 0.9 + playersOnline() * 0.1 + (Math.random() - 0.5) * 60))), 4000);
    return () => window.clearInterval(t);
  }, []);

  // Matchmaking screen: named players trickle into the lobby (the same people you then play with).
  useEffect(() => {
    if (screen.kind !== 'finding') return;
    const total = modeDef(mode).players;
    setLobbyNames(prepareLobby(total - 1));
    setJoined(1);
    let n = 1;
    let timer = 0;
    // Uneven arrivals: sometimes a party of three, sometimes a short wait.
    const tick = () => {
      n = Math.min(total, n + 1 + (Math.random() < 0.25 ? Math.floor(Math.random() * 3) : 0));
      setJoined(n);
      if (n < total) timer = window.setTimeout(tick, Math.max(80, (2400 / total) * (0.4 + Math.random() * 1.4)));
    };
    timer = window.setTimeout(tick, 500 + Math.random() * 600);
    return () => window.clearTimeout(timer);
  }, [screen, mode, round]);

  // Create the game when entering the playing screen.
  useEffect(() => {
    if (screen.kind !== 'playing' || !assets || !mount.current) return;
    audio.setVolume(settings.volume);
    const name = settings.playerName.trim() || defaultName();
    const host = netRef.current?.role === 'host' ? netRef.current.session : null;
    rankedDone.current = false;
    setRankedResult(null);
    // Night maps: the host decides online; otherwise now and then on generated maps.
    const time = host ? host.lobby.rules.time : 'random';
    const night = !NO_NIGHT.includes(mode) && (forceNight || time === 'night' || (time === 'random' && Math.random() < NIGHT_CHANCE));
    const g = new Game(
      mount.current,
      assets,
      {
        mode,
        difficulty,
        botControl: brain && !forceHeuristic ? 'learned' : 'heuristic',
        primary: settings.primary,
        secondary: settings.secondary,
        streaks: settings.streaks,
        lethal: settings.lethal,
        tactical: settings.tactical,
        perks: settings.perks,
        night,
        humans: host ? host.playingCount : 1,
        ...(host && !host.party ? { rules: host.lobby.rules } : {}),
        ...(ranked && !netRef.current ? { skill: rankedDifficulty(loadProfile().sr) } : {})
      },
      brain,
      { ...settings, playerName: name },
      audio,
      netRef.current
    );
    game.current = g;
    // Dev hook for scripts/shot.mjs (headless browsers cannot take pointer lock).
    if (import.meta.env.DEV) (window as unknown as { __fps: Game }).__fps = g;
    g.requestLock();
    const timer = window.setInterval(() => {
      setHud(g.hud());
      const c = minimap.current;
      if (c) g.drawMinimap(c.getContext('2d')!, c.width);
    }, 50);
    return () => {
      window.clearInterval(timer);
      g.dispose();
      game.current = null;
      setHud(null);
    };
    // Settings changes are applied live via applySettings; don't rebuild the match for them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, assets, round]);

  // Ranked: the result counts once the match is over.
  useEffect(() => {
    if (!ranked || !hud || hud.phase !== 'over' || rankedDone.current || hud.online) return;
    rankedDone.current = true;
    const delta = recordRanked(hud.result === 'win', hud.kills, hud.deaths);
    const p = loadProfile();
    setProfile(p);
    setRankedResult({ delta, division: divisionOf(p), sr: p.sr });
  }, [hud, ranked]);

  const addChat = useCallback((m: ChatMsg) => {
    setChat((c) => [...c.slice(-80), { id: chatId++, name: m.name, color: m.color, text: m.text, system: m.system, at: Date.now() }]);
  }, []);

  const sendChat = (text: string) => {
    if (hostRef.current) hostRef.current.sendChat(text);
    else clientRef.current?.sendChat(text);
  };

  const findMatch = () => {
    audio.unlock();
    setRanked(false);
    // Practice needs no lobby: straight in.
    setScreen({ kind: PRACTICE_MODES.includes(mode) ? 'playing' : 'finding' });
    setRound((r) => r + 1);
  };
  const playRanked = () => {
    audio.unlock();
    setRanked(true);
    setMode(RANKED_MODES[Math.floor(Math.random() * RANKED_MODES.length)]);
    setScreen({ kind: 'finding' });
    setRound((r) => r + 1);
  };
  const deploy = () => {
    audio.unlock();
    setScreen({ kind: 'playing' });
  };
  const toMenu = useCallback(() => {
    // Quitting a ranked match early counts as a loss.
    const g = game.current;
    if (ranked && g && !rankedDone.current && !g.net && g.match.phase !== 'over') {
      rankedDone.current = true;
      recordRanked(false, g.match.player.kills, g.match.player.deaths);
    }
    setProfile(loadProfile());
    // Leaving a lobby (a match's sessions are closed when its Game is disposed).
    if (screen.kind !== 'playing') {
      hostRef.current?.close('The host closed the lobby.');
      clientRef.current?.leave();
    }
    hostRef.current = null;
    clientRef.current = null;
    netRef.current = null;
    setLobby(null);
    setChat([]);
    setScreen({ kind: 'menu' });
  }, [screen.kind, ranked]);

  const profileForNet = () => ({
    name: settings.playerName.trim() || defaultName(),
    color: settings.playerColor,
    primary: settings.primary,
    secondary: settings.secondary,
    skins: settings.skins,
    streaks: settings.streaks,
    perks: settings.perks,
    lethal: settings.lethal,
    tactical: settings.tactical,
    cosmetics: settings.cosmetics
  });

  const lobbyFrom = (s: HostSession): LobbyView => ({ mode: s.lobby.mode, difficulty: s.lobby.difficulty, players: s.players, max: s.maxPlayers, slots: s.slots, rules: s.lobby.rules, party: s.party });

  const hostGame = async (party: boolean) => {
    audio.unlock();
    setNetError(null);
    setNetBusy(true);
    try {
      const p = profileForNet();
      // A party starts on a normal mode (online-only modes need a friends room).
      const start = party && (modeDef(mode).humansOnly || PRACTICE_MODES.includes(mode)) ? 'tdm' : mode;
      const session = await HostSession.create(start, difficulty, p.name, p.color, party);
      hostRef.current = session;
      const refresh = () => setLobby(lobbyFrom(session));
      session.onChange = refresh;
      session.onChat = addChat;
      refresh();
      setMode(start);
      setChat([]);
      setRoomCode(session.code);
      setRanked(false);
      setScreen({ kind: 'host-lobby' });
    } catch (e) {
      setNetError((e as Error).message);
    } finally {
      setNetBusy(false);
    }
  };

  const refreshHostLobby = () => {
    const s = hostRef.current;
    if (s) setLobby(lobbyFrom(s));
  };

  const changeLobbyMode = (m: ModeId) => {
    setMode(m);
    hostRef.current?.setLobby(m, difficulty);
    refreshHostLobby();
  };

  const changeRules = (patch: Partial<LobbyRules>) => {
    const s = hostRef.current;
    if (!s) return;
    s.setRules({ ...s.lobby.rules, ...patch });
    refreshHostLobby();
  };

  const startOnline = () => {
    const session = hostRef.current;
    if (!session) return;
    audio.unlock();
    netRef.current = { role: 'host', session, seed: (Math.random() * 1e9) | 0 };
    setMode(session.lobby.mode);
    setScreen({ kind: 'playing' });
    setRound((r) => r + 1);
  };

  /** After an online match: everyone goes back to the room instead of leaving. */
  const backToLobby = () => {
    const s = hostRef.current;
    if (!s) return;
    if (game.current) game.current.keepNet = true;
    netRef.current = null;
    s.returnToLobby();
    refreshHostLobby();
    setScreen({ kind: 'host-lobby' });
  };

  /** Hooks a client session up to the menus (again after each match, since the game takes some hooks over). */
  const bindClient = (session: ClientSession) => {
    session.onChat = addChat;
    session.onLobby = (msg: LobbyMsg) => setLobby({ mode: msg.mode, difficulty: msg.difficulty, players: msg.players, max: msg.max, slots: msg.slots, rules: msg.rules, party: msg.party });
    session.onStart = (start) => {
      netRef.current = { role: 'client', session, start };
      setMode(start.mode);
      setScreen({ kind: 'playing' });
      setRound((r) => r + 1);
    };
    session.onEnd = (reason) => {
      setNetError(reason);
      clientRef.current = null;
      netRef.current = null;
      setLobby(null);
      setScreen({ kind: 'menu' });
    };
    session.onToLobby = () => {
      if (game.current) game.current.keepNet = true;
      netRef.current = null;
      bindClient(session);
      setScreen({ kind: 'join-lobby' });
    };
  };

  const joinGame = async () => {
    audio.unlock();
    setNetError(null);
    if (joinCode.trim().length < 5) {
      setNetError('Enter the 5-letter room code from the host.');
      return;
    }
    setNetBusy(true);
    try {
      const session = await ClientSession.connect(joinCode, profileForNet());
      clientRef.current = session;
      setChat([]);
      bindClient(session);
      setRoomCode(joinCode.trim().toUpperCase());
      setRanked(false);
      setScreen({ kind: 'join-lobby' });
    } catch (e) {
      setNetError((e as Error).message);
    } finally {
      setNetBusy(false);
    }
  };
  const resume = () => {
    setShowSettings(false);
    game.current?.requestLock();
  };
  const def = modeDef(mode);
  const lobbyFull = joined >= def.players;
  const division = divisionOf(profile);

  if (loadError) {
    return (
      <div className="menu">
        <h1>Failed to load assets</h1>
        <p>{loadError}</p>
      </div>
    );
  }

  const isHostLobby = screen.kind === 'host-lobby';
  const playingCount = lobby ? lobby.players.filter((p) => p.playing).length : 0;
  const minNeeded = lobby ? Math.max(1, modeDef(lobby.mode).minPlayers ?? 1) : 1;
  const level = levelOf(profile.xp).level;

  return (
    <>
      <div ref={mount} className="viewport" />
      {screen.kind === 'menu' && (
        <div className="menu">
          <div className="menu-card main-menu">
            <header className="menu-head">
              <h1>FPS SHOOTER</h1>
              <span className="online-count">● {online.toLocaleString()} players online</span>
            </header>
            <div className="profile-row">
              <ProfileBar profile={profile} />
              <div className="ranked-card" style={{ borderColor: division.color }}>
                <small>Ranked</small>
                <b style={{ color: division.color }}>{division.name}</b>
                {division.placed && (
                  <div className="xpbar">
                    <div style={{ width: `${division.progress * 100}%`, background: division.color }} />
                  </div>
                )}
                <small>
                  {division.placed ? `${profile.sr} SR · ` : ''}
                  {profile.rankedWins}W {profile.rankedMatches - profile.rankedWins}L
                </small>
                <button className="play ranked-btn" disabled={!assets} onClick={playRanked}>
                  PLAY RANKED
                </button>
              </div>
            </div>
            <nav className="menu-tabs">
              {(
                [
                  ['play', 'Play'],
                  ['loadout', 'Loadout'],
                  ['profile', 'Profile'],
                  ['settings', 'Settings']
                ] as [MenuTab, string][]
              ).map(([id, label]) => (
                <button key={id} className={`menu-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'play' && (
              <>
                <div className="profile">
                  <label className="name-field">
                    Username
                    <input
                      value={settings.playerName}
                      maxLength={16}
                      spellCheck={false}
                      onChange={(e) => setSettings({ ...settings, playerName: e.target.value.replace(/\s+/g, '_') })}
                    />
                  </label>
                  <div className="color-field">
                    <span>
                      Colour <small>(free-for-all modes; team modes use your team's colour)</small>
                    </span>
                    <div className="swatches">
                      {COLORS.map((c) => (
                        <button
                          key={c.hex}
                          title={c.name}
                          className={`swatch ${settings.playerColor === c.hex ? 'on' : ''}`}
                          style={{ background: cssColor(c.hex) }}
                          onClick={() => setSettings({ ...settings, playerColor: c.hex })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button className="loadout-strip" onClick={() => setTab('loadout')}>
                  <span>
                    <b>{WEAPONS[settings.primary].name}</b> + {WEAPONS[settings.secondary].name}
                  </span>
                  <span>
                    {THROWABLES[settings.lethal].name} · {THROWABLES[settings.tactical].name}
                  </span>
                  <span>{settings.perks.map((p) => perkDef(p).name).join(' · ')}</span>
                  <span>{settings.streaks.map((s) => streakDef(s).name).join(' / ')}</span>
                  <em>Edit loadout ›</em>
                </button>
                {MODE_GROUPS.map((group) => (
                  <div key={group}>
                    <div className="mode-group">{group}</div>
                    <div className="modes">
                      {MODES.filter((m) => m.group === group).map((m) => (
                        <button key={m.id} className={`mode ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
                          <strong>
                            {m.name}
                            {m.humansOnly && <em className="tag-online">FRIENDS</em>}
                          </strong>
                          <span>{m.blurb}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="row">
                  <label>Lobby</label>
                  {LOBBY.map((d) => (
                    <button key={d.id} className={`chip ${difficulty === d.id ? 'on' : ''}`} onClick={() => setDifficulty(d.id)}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="online">
                  <div className="online-head">
                    <b>Play with friends</b>
                    <span>
                      <b>Create party</b>: queue into normal games together (the host picks the mode). <b>Host game</b>: a private room with custom rules and friends-only modes.
                    </span>
                  </div>
                  <div className="row">
                    <button className="chip" disabled={!assets || netBusy} onClick={() => hostGame(true)}>
                      Create party
                    </button>
                    <button className="chip" disabled={!assets || netBusy} onClick={() => hostGame(false)}>
                      Host game
                    </button>
                    <input
                      className="code-input"
                      placeholder="CODE"
                      maxLength={5}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    />
                    <button className="chip" disabled={!assets || netBusy} onClick={joinGame}>
                      Join
                    </button>
                    {netBusy && <span className="policy-note">Connecting…</span>}
                  </div>
                  {netError && <div className="net-error">{netError}</div>}
                </div>
                <button className="play" disabled={!assets || !!modeDef(mode).humansOnly} onClick={findMatch}>
                  {!assets ? loadMsg : modeDef(mode).humansOnly ? 'FRIENDS ONLY — HOST A GAME ABOVE' : PRACTICE_MODES.includes(mode) ? 'START PRACTICE' : 'FIND MATCH'}
                </button>
                <div className="controls">
                  <span>
                    {keyLabel(settings.keys.forward)}
                    {keyLabel(settings.keys.left)}
                    {keyLabel(settings.keys.back)}
                    {keyLabel(settings.keys.right)} move
                  </span>
                  <span>LMB fire · RMB aim</span>
                  <span>{keyLabel(settings.keys.sprint)} sprint</span>
                  <span>{keyLabel(settings.keys.jump)} jump</span>
                  <span>{keyLabel(settings.keys.crouch)} crouch/slide</span>
                  <span>{keyLabel(settings.keys.reload)} reload</span>
                  <span>{keyLabel(settings.keys.melee)} knife</span>
                  <span>
                    {keyLabel(settings.keys.grenade)} lethal · {keyLabel(settings.keys.tactical)} tactical
                  </span>
                  <span>
                    {keyLabel(settings.keys.weapon1)}/{keyLabel(settings.keys.weapon2)}/{keyLabel(settings.keys.swap)}/wheel switch
                  </span>
                  <span>{keyLabel(settings.keys.scores)} scores</span>
                  <span>{keyLabel(settings.keys.chat)} chat (online)</span>
                  <span>Esc pause · controllers supported</span>
                </div>
              </>
            )}
            {tab === 'loadout' && <LoadoutPanel settings={settings} onChange={setSettings} profile={profile} assets={assets} />}
            {tab === 'profile' && <ProfilePanel settings={settings} onChange={setSettings} profile={profile} />}
            {tab === 'settings' && <SettingsPanel settings={settings} onChange={setSettings} />}
          </div>
        </div>
      )}
      {(screen.kind === 'host-lobby' || screen.kind === 'join-lobby') && lobby && (
        <div className="menu">
          <div className="menu-card lobby-card">
            <div className="lobby-main">
              <h2>{lobby.party ? (isHostLobby ? 'Your party' : 'Joined party') : isHostLobby ? 'Your room' : 'Joined room'}</h2>
              <div className="room-code">{roomCode}</div>
              <p className="sub">
                {lobby.party
                  ? 'Your party queues into a normal matchmade game together, on the same team. Send friends the code.'
                  : isHostLobby
                    ? 'Send this code to your friends. They enter it under "Play with friends".'
                    : 'Waiting for the host to start…'}
              </p>
              {isHostLobby ? (
                <select className="mode-select" value={lobby.mode} onChange={(e) => changeLobbyMode(e.target.value as ModeId)}>
                  {MODES.filter((m) => !lobby.party || (!m.humansOnly && !PRACTICE_MODES.includes(m.id))).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p>
                  <b>{modeDef(lobby.mode).name}</b>
                </p>
              )}
              <div className="lobby-players">
                {lobby.players.map((p, i) => (
                  <div key={p.id} className="lb-row">
                    <span className="rank">{i + 1}</span>
                    <span className={`name ${isDark(cssColor(p.color)) ? 'dark' : ''}`} style={{ color: cssColor(p.color) }}>
                      {p.name}
                      {p.host && <small className="host-tag">{lobby.party ? 'leader' : 'host'}</small>}
                    </span>
                    {isHostLobby ? (
                      <button
                        className={`chip play-toggle ${p.playing ? 'on' : ''}`}
                        disabled={!p.playing && playingCount >= lobby.slots}
                        title={p.playing ? 'Playing: click to make them spectate' : 'Spectating: click to put them in'}
                        onClick={() => {
                          hostRef.current?.togglePlaying(p.id);
                          refreshHostLobby();
                        }}
                      >
                        {p.playing ? 'Playing' : 'Spectating'}
                      </button>
                    ) : (
                      <span className={`k ${p.playing ? '' : 'spec'}`}>{p.playing ? 'playing' : 'spectating'}</span>
                    )}
                  </div>
                ))}
                <small>
                  {playingCount} / {lobby.slots} playing{lobby.players.length > playingCount ? ` · ${lobby.players.length - playingCount} spectating` : ''}
                  {lobby.party ? ' · the rest of the lobby is matchmade' : lobby.rules.bots && !modeDef(lobby.mode).humansOnly ? ' · empty slots get bots' : ''}
                  {isHostLobby && lobby.players.length > lobby.slots ? ' · more people than slots: pick who plays' : ''}
                </small>
              </div>
              {!lobby.party && <RulesPanel rules={lobby.rules} editable={isHostLobby} onChange={changeRules} humansOnly={!!modeDef(lobby.mode).humansOnly} />}
              <div className="row">
                {isHostLobby && (
                  <button className="play" disabled={playingCount < minNeeded} onClick={startOnline}>
                    {playingCount < minNeeded ? `NEEDS ${minNeeded} PLAYERS` : lobby.party ? 'FIND MATCH' : 'START'}
                  </button>
                )}
                <button className="chip" onClick={toMenu}>
                  Leave
                </button>
              </div>
            </div>
            <div className="lobby-chat">
              <h3>{lobby.party ? 'Party chat' : 'Chat'}</h3>
              <ChatBox lines={chat} onSend={sendChat} inGame={false} open now={Date.now()} />
            </div>
          </div>
        </div>
      )}
      {showSettings && screen.kind !== 'playing' && (
        <div className="overlay">
          <div className="menu-card settings-card">
            <h2>Settings</h2>
            <SettingsPanel settings={settings} onChange={setSettings} />
            <button className="play" onClick={() => setShowSettings(false)}>
              DONE
            </button>
          </div>
        </div>
      )}
      {screen.kind === 'finding' && (
        <div className="menu">
          <div className="menu-card small">
            <h2>{lobbyFull ? 'Match found' : ranked ? 'Finding ranked match…' : 'Finding match…'}</h2>
            <p className="sub">
              {def.name} · {ranked ? <b style={{ color: division.color }}>Ranked · {division.name}</b> : `${LOBBY.find((d) => d.id === difficulty)!.label} lobby`}
            </p>
            <div className="lobby-bar">
              <div style={{ width: `${(joined / def.players) * 100}%` }} />
            </div>
            <p>
              {joined} / {def.players} players
            </p>
            <div className="joining">
              {[settings.playerName.trim() || 'You', ...lobbyNames.slice(0, joined - 1)].slice(-8).map((n, i, arr) => (
                <div key={n} className={`joining-row ${i === arr.length - 1 && joined > 1 && !lobbyFull ? 'new' : ''}`}>
                  <i className="lvl">{n === (settings.playerName.trim() || 'You') ? level : levelFor(n)}</i>
                  <span>{n}</span>
                  <small className="ping">{basePingFor(n)} ms</small>
                </div>
              ))}
              {joined > 9 && <small className="set-hint">and {joined - 8} more</small>}
            </div>
            {ranked && <p className="set-hint">Leaving a ranked match early counts as a loss.</p>}
            <div className="row">
              <button className="play" disabled={!lobbyFull} onClick={deploy}>
                {lobbyFull ? 'DEPLOY' : 'WAITING…'}
              </button>
              <button className="chip" onClick={toMenu}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {screen.kind === 'playing' && hud && (
        <>
          <Hud hud={hud} minimap={minimap} settings={settings} />
          {hud.online && (
            <ChatBox lines={chat} onSend={sendChat} inGame open={hud.chatOpen} onClose={() => game.current?.closeChat()} now={Date.now()} />
          )}
          {hud.touch && game.current && !hud.paused && hud.phase !== 'over' && (
            <TouchControls
              game={game.current}
              onPause={() => game.current?.pause()}
              onScores={(v) => {
                if (game.current) game.current.showScores = v;
              }}
            />
          )}
          {hud.paused && hud.phase !== 'over' && !showSettings && (
            <div className="overlay">
              <div className="menu-card small pause-card">
                <h2>Paused</h2>
                <button className="play" onClick={resume}>
                  RESUME
                </button>
                <button className="pause-btn" onClick={() => setShowSettings(true)}>
                  ⚙ Settings
                </button>
                <button className="pause-btn" onClick={toMenu}>
                  {ranked && !hud.online ? 'Leave match (counts as a loss)' : 'Leave match'}
                </button>
                {hud.online && <p className="set-hint">Online matches keep running while you're paused.</p>}
              </div>
            </div>
          )}
          {hud.paused && showSettings && (
            <div className="overlay">
              <div className="menu-card settings-card">
                <h2>Settings</h2>
                <SettingsPanel settings={settings} onChange={setSettings} />
                <button className="play" onClick={() => setShowSettings(false)}>
                  BACK
                </button>
              </div>
            </div>
          )}
          {hud.netMessage && (
            <div className="overlay end">
              <div className="menu-card small">
                <h2>Match ended</h2>
                <p>{hud.netMessage}</p>
                <button className="play" onClick={toMenu}>
                  MAIN MENU
                </button>
              </div>
            </div>
          )}
          {hud.phase === 'over' && !hud.netMessage && !hud.killcam && !hud.killcamPending && (
            <EndScreen
              hud={hud}
              ranked={ranked && !hud.online ? rankedResult : null}
              onAgain={hud.online ? null : ranked ? playRanked : findMatch}
              onLobby={hud.online && hostRef.current ? backToLobby : null}
              waitingForHost={hud.online && !hostRef.current}
              onMenu={toMenu}
              mine={{ card: settings.cosmetics.card, emblem: settings.cosmetics.emblem, name: settings.playerName, level }}
            />
          )}
        </>
      )}
    </>
  );
};

const ProfileBar = ({ profile }: { profile: Profile }) => {
  const { level, into, need } = levelOf(profile.xp);
  return (
    <div className="profile-bar">
      <div className="level">{level}</div>
      <div className="rank">
        <b>{rankOf(level)}</b>
        <div className="xpbar">
          <div style={{ width: `${(into / need) * 100}%` }} />
        </div>
        <small>
          {into} / {need} XP · {profile.matches} matches · {profile.wins} wins · {profile.kills} kills
        </small>
      </div>
    </div>
  );
};

/** Private-lobby rules: the host edits them, everyone else sees them. */
const RulesPanel = ({ rules, editable, onChange, humansOnly }: { rules: LobbyRules; editable: boolean; onChange: (p: Partial<LobbyRules>) => void; humansOnly: boolean }) => {
  const opt = <T extends string | number | boolean>(label: string, value: T, options: [T, string][], set: (v: T) => void) => (
    <div className="rule">
      <span>{label}</span>
      {editable ? (
        <div className="set-choices">
          {options.map(([v, l]) => (
            <button key={String(v)} className={`chip ${value === v ? 'on' : ''}`} onClick={() => set(v)}>
              {l}
            </button>
          ))}
        </div>
      ) : (
        <b>{options.find(([v]) => v === value)?.[1] ?? String(value)}</b>
      )}
    </div>
  );
  const changed = JSON.stringify(rules) !== JSON.stringify(DEFAULT_RULES);
  return (
    <details className="rules" open={editable || changed}>
      <summary>Match rules{changed ? ' (custom)' : ''}</summary>
      {opt(
        'Health',
        rules.health,
        [
          [0.5, 'Half'],
          [1, 'Normal'],
          [2, 'Double']
        ],
        (v) => onChange({ health: v })
      )}
      {opt(
        'Gravity',
        rules.gravity,
        [
          ['low', 'Low'],
          ['normal', 'Normal'],
          ['high', 'High']
        ],
        (v) => onChange({ gravity: v })
      )}
      {opt(
        'Time of day',
        rules.time,
        [
          ['day', 'Day'],
          ['night', 'Night'],
          ['random', 'Random']
        ],
        (v) => onChange({ time: v })
      )}
      {opt(
        'Score to win',
        rules.score,
        [
          [0.5, 'Short'],
          [1, 'Normal'],
          [2, 'Long']
        ],
        (v) => onChange({ score: v })
      )}
      <div className="rule">
        <span>Weapons</span>
        {editable ? (
          <select className="rule-select" value={rules.weapon} onChange={(e) => onChange({ weapon: e.target.value as WeaponId | 'any' })}>
            <option value="any">Everyone's own picks</option>
            {PRIMARIES.map((w) => (
              <option key={w} value={w}>
                {WEAPONS[w].name} only
              </option>
            ))}
          </select>
        ) : (
          <b>{rules.weapon === 'any' ? "Everyone's own picks" : `${WEAPONS[rules.weapon].name} only`}</b>
        )}
      </div>
      {opt(
        'Health regen',
        rules.regen,
        [
          [true, 'On'],
          [false, 'Off']
        ],
        (v) => onChange({ regen: v })
      )}
      {!humansOnly &&
        opt(
          'Fill with bots',
          rules.bots,
          [
            [true, 'On'],
            [false, 'Off']
          ],
          (v) => onChange({ bots: v })
        )}
    </details>
  );
};

