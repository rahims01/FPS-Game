import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, type LoadedAssets } from './assets/AssetRegistry';
import { GameAudio } from './game/Audio';
import { Game, type GameSettings, type HudState, type NetRole } from './game/Game';
import { ClientSession, HostSession, type ChatMsg } from './net/Session';
import type { LobbyPlayer } from './net/protocol';
import type { ChatLine } from './net/chat';
import { COLORS, cssColor, isDark } from './game/identity';
import { loadPolicy } from './rl/PolicyBrain';
import type { Brain } from './sim/FpsSim';
import { DEFAULT_RULES, MODES, modeDef, type Difficulty, type LobbyRules, type ModeId } from './sim/Match';
import { streakDef } from './sim/killstreaks';
import { PRIMARIES, WEAPONS, type WeaponId } from './sim/weapons';
import { divisionOf, levelOf, loadProfile, rankedDifficulty, RANKED_MODES, rankOf, recordRanked, type Division, type Profile } from './game/progression';
import { Hud } from './ui/Hud';
import { SettingsPanel } from './ui/SettingsPanel';
import { LoadoutPanel } from './ui/LoadoutPanel';
import { TouchControls } from './ui/TouchControls';
import { ChatBox } from './ui/ChatBox';
import { EndScreen } from './ui/EndScreen';
import { keyLabel, loadSettings, QUALITY_PRESETS, saveSettings, suggestQuality } from './game/settings';

type Screen = { kind: 'menu' } | { kind: 'finding' } | { kind: 'playing' } | { kind: 'host-lobby' } | { kind: 'join-lobby' };

interface LobbyView {
  mode: ModeId;
  difficulty: Difficulty;
  players: LobbyPlayer[];
  max: number;
  slots: number;
  rules: LobbyRules;
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

let chatId = 0;

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
  const [showLoadout, setShowLoadout] = useState(false);
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
    const host = netRef.current?.role === 'host' ? netRef.current.session : null;
    rankedDone.current = false;
    setRankedResult(null);
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
        humans: host ? host.playingCount : 1,
        ...(host ? { rules: host.lobby.rules } : {}),
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
    setScreen({ kind: 'finding' });
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
    streaks: settings.streaks
  });

  const hostGame = async () => {
    audio.unlock();
    setNetError(null);
    setNetBusy(true);
    try {
      const p = profileForNet();
      const session = await HostSession.create(mode, difficulty, p.name, p.color);
      hostRef.current = session;
      const refresh = () =>
        setLobby({ mode: session.lobby.mode, difficulty: session.lobby.difficulty, players: session.players, max: session.maxPlayers, slots: session.slots, rules: session.lobby.rules });
      session.onChange = refresh;
      session.onChat = addChat;
      refresh();
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
    if (s) setLobby({ mode: s.lobby.mode, difficulty: s.lobby.difficulty, players: s.players, max: s.maxPlayers, slots: s.slots, rules: s.lobby.rules });
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
      session.onChat = addChat;
      session.onLobby = (msg) => setLobby({ mode: msg.mode, difficulty: msg.difficulty, players: msg.players, max: msg.max, slots: msg.slots, rules: msg.rules });
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

  return (
    <>
      <div ref={mount} className="viewport" />
      {screen.kind === 'menu' && (
        <div className="menu">
          <div className="menu-card">
            <h1>FPS SHOOTER</h1>
            <p className="sub">Pick a mode and jump into a lobby.</p>
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
              <label>Loadout</label>
              <span className="loadout-summary">
                <b>{WEAPONS[settings.primary].name}</b> + {WEAPONS[settings.secondary].name} · {settings.streaks.map((s) => streakDef(s).name).join(' / ')}
              </span>
              <button className="chip" onClick={() => setShowLoadout(true)}>
                ✎ Edit loadout
              </button>
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
                <span>Host a room and share the code. Pick who plays, set the rules and chat in the lobby.</span>
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
              <span>{keyLabel(settings.keys.chat)} chat (online)</span>
              <span>Esc pause</span>
            </div>
          </div>
        </div>
      )}
      {(screen.kind === 'host-lobby' || screen.kind === 'join-lobby') && lobby && (
        <div className="menu">
          <div className="menu-card lobby-card">
            <div className="lobby-main">
              <h2>{isHostLobby ? 'Your room' : 'Joined room'}</h2>
              <div className="room-code">{roomCode}</div>
              <p className="sub">{isHostLobby ? 'Send this code to your friends. They enter it under "Play online".' : 'Waiting for the host to start…'}</p>
              {isHostLobby ? (
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
                  <div key={p.id} className="lb-row">
                    <span className="rank">{i + 1}</span>
                    <span className={`name ${isDark(cssColor(p.color)) ? 'dark' : ''}`} style={{ color: cssColor(p.color) }}>
                      {p.name}
                      {p.host && <small className="host-tag">host</small>}
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
                  {lobby.rules.bots && !modeDef(lobby.mode).humansOnly ? ' · empty slots get bots' : ''}
                  {isHostLobby && lobby.players.length > lobby.slots ? ' · more people than slots: pick who plays' : ''}
                </small>
              </div>
              <RulesPanel rules={lobby.rules} editable={isHostLobby} onChange={changeRules} humansOnly={!!modeDef(lobby.mode).humansOnly} />
              <div className="row">
                {isHostLobby && (
                  <button className="play" disabled={playingCount < minNeeded} onClick={startOnline}>
                    {playingCount < minNeeded ? `NEEDS ${minNeeded} PLAYERS` : 'START'}
                  </button>
                )}
                <button className="chip" onClick={toMenu}>
                  Leave
                </button>
              </div>
            </div>
            <div className="lobby-chat">
              <h3>Chat</h3>
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
      {showLoadout && screen.kind === 'menu' && (
        <div className="overlay">
          <div className="menu-card loadout-card">
            <h2>Loadout</h2>
            <LoadoutPanel settings={settings} onChange={setSettings} profile={profile} />
            <button className="play" onClick={() => setShowLoadout(false)}>
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
            <ChatBox
              lines={chat}
              onSend={sendChat}
              inGame
              open={hud.chatOpen}
              onClose={() => game.current?.closeChat()}
              now={Date.now()}
            />
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
            <EndScreen hud={hud} ranked={ranked && !hud.online ? rankedResult : null} onAgain={hud.online ? null : ranked ? playRanked : findMatch} onMenu={toMenu} />
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
        'Score to win',
        rules.score,
        [
          [0.5, 'Short'],
          [1, 'Normal'],
          [2, 'Long']
        ],
        (v) => onChange({ score: v })
      )}
      {opt('Weapons', rules.weapon, [['any', 'Own picks'] as [WeaponId | 'any', string], ...PRIMARIES.map((w): [WeaponId | 'any', string] => [w, `${WEAPONS[w].tag} only`])], (v) => onChange({ weapon: v }))}
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
