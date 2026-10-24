import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, type LoadedAssets } from './assets/AssetRegistry';
import { GameAudio } from './game/Audio';
import { Game, type GameSettings, type HudState, type NetRole } from './game/Game';
import { ClientSession, HostSession } from './net/Session';
import type { LobbyPlayer } from './net/protocol';
import { COLORS, cssColor, isDark } from './game/identity';
import { loadPolicy } from './rl/PolicyBrain';
import type { Brain } from './sim/FpsSim';
import { MODES, modeDef, type Difficulty, type ModeId } from './sim/Match';
import { PRIMARIES, WEAPONS } from './sim/weapons';
import { levelOf, loadProfile, rankOf, type Profile } from './game/progression';
import { Hud } from './ui/Hud';
import { SettingsPanel } from './ui/SettingsPanel';
import { keyLabel, loadSettings, QUALITY_PRESETS, saveSettings, suggestQuality } from './game/settings';

type Screen = { kind: 'menu' } | { kind: 'finding' } | { kind: 'playing' } | { kind: 'host-lobby' } | { kind: 'join-lobby' };

interface LobbyView {
  mode: ModeId;
  difficulty: Difficulty;
  players: LobbyPlayer[];
  max: number;
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

const LOBBY: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Casual' },
  { id: 'normal', label: 'Standard' },
  { id: 'hard', label: 'Pro' }
];

const audio = new GameAudio();

const MODE_GROUPS = ['Team', 'Objective', 'Free-for-all', 'Party', 'Special', 'Online only'] as const;

export const App = () => {
  const [assets, setAssets] = useState<LoadedAssets | null>(null);
  const [loadMsg, setLoadMsg] = useState('Loading…');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [mode, setMode] = useState<ModeId>('1v1');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [round, setRound] = useState(0);
  // Online play.
  const netRef = useRef<NetRole | null>(null);
  const hostRef = useRef<HostSession | null>(null);
  const clientRef = useRef<ClientSession | null>(null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [netBusy, setNetBusy] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [joined, setJoined] = useState(1);
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
  }, [settings]);

  // Matchmaking screen: players trickle into the lobby.
  useEffect(() => {
    if (screen.kind !== 'finding') return;
    const total = modeDef(mode).players;
    setJoined(1);
    let n = 1;
    const timer = window.setInterval(
      () => {
        n = Math.min(total, n + 1 + Math.floor(Math.random() * Math.max(1, total / 6)));
        setJoined(n);
        if (n >= total) window.clearInterval(timer);
      },
      Math.max(90, 1600 / total)
    );
    return () => window.clearInterval(timer);
  }, [screen, mode, round]);

  // Create the game when entering the playing screen.
  useEffect(() => {
    if (screen.kind !== 'playing' || !assets || !mount.current) return;
    audio.setVolume(settings.volume);
    const name = settings.playerName.trim() || defaultName();
    const g = new Game(
      mount.current,
      assets,
      {
        mode,
        difficulty,
        botControl: brain && !forceHeuristic ? 'learned' : 'heuristic',
        primary: settings.primary,
        humans: netRef.current?.role === 'host' ? netRef.current.session.players.length : 1
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

  const findMatch = () => {
    audio.unlock();
    setScreen({ kind: 'finding' });
    setRound((r) => r + 1);
  };
  const deploy = () => {
    audio.unlock();
    setScreen({ kind: 'playing' });
  };
  const toMenu = useCallback(() => {
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
    setScreen({ kind: 'menu' });
  }, [screen.kind]);

  const profileForNet = () => ({ name: settings.playerName.trim() || defaultName(), color: settings.playerColor, primary: settings.primary });

  const hostGame = async () => {
    audio.unlock();
    setNetError(null);
    setNetBusy(true);
    try {
      const p = profileForNet();
      const session = await HostSession.create(mode, difficulty, p.name, p.color);
      hostRef.current = session;
      const refresh = () => setLobby({ mode: session.lobby.mode, difficulty: session.lobby.difficulty, players: session.players, max: session.maxPlayers });
      session.onChange = refresh;
      refresh();
      setRoomCode(session.code);
      setScreen({ kind: 'host-lobby' });
    } catch (e) {
      setNetError((e as Error).message);
    } finally {
      setNetBusy(false);
    }
  };

  const changeLobbyMode = (m: ModeId) => {
    setMode(m);
    const session = hostRef.current;
    if (!session) return;
    session.setLobby(m, difficulty);
    setLobby({ mode: m, difficulty, players: session.players, max: session.maxPlayers });
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
      session.onLobby = (msg) => setLobby({ mode: msg.mode, difficulty: msg.difficulty, players: msg.players, max: msg.max });
      session.onStart = (start) => {
        netRef.current = { role: 'client', session, start };
        setMode(start.mode);
        setScreen({ kind: 'playing' });
        setRound((r) => r + 1);
      };
      session.onEnd = (reason) => {
        setNetError(reason);
        clientRef.current = null;
        setLobby(null);
        setScreen({ kind: 'menu' });
      };
      setRoomCode(joinCode.trim().toUpperCase());
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

  if (loadError) {
    return (
      <div className="menu">
        <h1>Failed to load assets</h1>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={mount} className="viewport" />
      {screen.kind === 'menu' && (
        <div className="menu">
          <div className="menu-card">
            <h1>FPS SHOOTER</h1>
            <p className="sub">Pick a mode and jump into a lobby.</p>
            <ProfileBar profile={profile} />
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
            {MODE_GROUPS.map((group) => (
              <div key={group}>
                <div className="mode-group">{group}</div>
                <div className="modes">
                  {MODES.filter((m) => m.group === group).map((m) => (
                    <button key={m.id} className={`mode ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
                      <strong>
                        {m.name}
                        {m.humansOnly && <em className="tag-online">ONLINE</em>}
                      </strong>
                      <span>{m.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="row">
              <label>Primary</label>
              {PRIMARIES.map((w) => (
                <button key={w} title={WEAPONS[w].name} className={`chip ${settings.primary === w ? 'on' : ''}`} onClick={() => setSettings({ ...settings, primary: w })}>
                  {WEAPONS[w].tag}
                </button>
              ))}
              <span className="policy-note">{WEAPONS[settings.primary].name} + pistol, knife and 2 frag grenades. Some modes hand out their own guns.</span>
            </div>
            <div className="row">
              <label>Lobby</label>
              {LOBBY.map((d) => (
                <button key={d.id} className={`chip ${difficulty === d.id ? 'on' : ''}`} onClick={() => setDifficulty(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="row">
              <label>Options</label>
              <button className="chip" onClick={() => setShowSettings(true)}>
                ⚙ Settings
              </button>
              <span className="policy-note">Graphics quality, controls &amp; key bindings, crosshair, sensitivity and more.</span>
            </div>
            <div className="online">
              <div className="online-head">
                <b>Play online with friends</b>
                <span>Host a room and share the code. Works on any static host (peer-to-peer).</span>
              </div>
              <div className="row">
                <button className="chip" disabled={!assets || netBusy} onClick={hostGame}>
                  Host game
                </button>
                <input
                  className="code-input"
                  placeholder="ROOM CODE"
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
              {!assets ? loadMsg : modeDef(mode).humansOnly ? 'ONLINE ONLY — HOST A GAME ABOVE' : 'FIND MATCH'}
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
              <span>{keyLabel(settings.keys.grenade)} grenade</span>
              <span>
                {keyLabel(settings.keys.weapon1)}/{keyLabel(settings.keys.weapon2)}/{keyLabel(settings.keys.swap)}/wheel switch
              </span>
              <span>{keyLabel(settings.keys.scores)} scores</span>
              <span>Esc pause</span>
            </div>
          </div>
        </div>
      )}
      {(screen.kind === 'host-lobby' || screen.kind === 'join-lobby') && lobby && (
        <div className="menu">
          <div className="menu-card small">
            <h2>{screen.kind === 'host-lobby' ? 'Your room' : 'Joined room'}</h2>
            <div className="room-code">{roomCode}</div>
            <p className="sub">{screen.kind === 'host-lobby' ? 'Send this code to your friends. They enter it under "Play online".' : 'Waiting for the host to start…'}</p>
            {screen.kind === 'host-lobby' ? (
              <select className="mode-select" value={lobby.mode} onChange={(e) => changeLobbyMode(e.target.value as ModeId)}>
                {MODES.map((m) => (
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
                <div key={i} className="lb-row">
                  <span className="rank">{i + 1}</span>
                  <span className={`name ${isDark(cssColor(p.color)) ? 'dark' : ''}`} style={{ color: cssColor(p.color) }}>
                    {p.name}
                  </span>
                  <span className="k">{p.host ? 'host' : ''}</span>
                </div>
              ))}
              <small>
                {lobby.players.length} / {lobby.max} players · empty slots are filled automatically
              </small>
            </div>
            <div className="row">
              {screen.kind === 'host-lobby' && (
                <button className="play" disabled={lobby.players.length < (modeDef(lobby.mode).minPlayers ?? 1)} onClick={startOnline}>
                  {lobby.players.length < (modeDef(lobby.mode).minPlayers ?? 1) ? `NEEDS ${modeDef(lobby.mode).minPlayers} PLAYERS` : 'START'}
                </button>
              )}
              <button className="chip" onClick={toMenu}>
                Leave
              </button>
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
            <h2>{lobbyFull ? 'Match found' : 'Finding match…'}</h2>
            <p className="sub">
              {def.name} · {LOBBY.find((d) => d.id === difficulty)!.label} lobby
            </p>
            <div className="lobby-bar">
              <div style={{ width: `${(joined / def.players) * 100}%` }} />
            </div>
            <p>
              {joined} / {def.players} players
            </p>
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
                  Leave match
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
            <div className="overlay end">
              <div className="menu-card small">
                <h2 className={hud.result === 'win' ? 'win' : 'lose'}>{hud.banner || (hud.result === 'win' ? 'Victory' : 'Defeat')}</h2>
                <p className="xp-earned">+{hud.xp} XP</p>
                <p>
                  {hud.kills} kills · {hud.deaths} deaths
                  {hud.showTeams && ` · ${Math.floor(hud.scores[0])}–${Math.floor(hud.scores[1])}`}
                </p>
                <div className="final-board">
                  {hud.players.slice(0, 8).map((p, i) => (
                    <div key={p.id} className={`lb-row ${p.isPlayer ? 'mine' : ''}`}>
                      <span className="rank">{i + 1}</span>
                      <span className={`name ${isDark(p.color) ? 'dark' : ''}`} style={{ color: p.color }}>
                        {p.name}
                      </span>
                      <span className="k">
                        {p.kills} / {p.deaths}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="row">
                  {!hud.online && (
                    <button className="play" onClick={findMatch}>
                      PLAY AGAIN
                    </button>
                  )}
                  <button className="chip" onClick={toMenu}>
                    Main menu
                  </button>
                </div>
              </div>
            </div>
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
