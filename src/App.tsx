import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadAssets, type LoadedAssets } from './assets/AssetRegistry';
import { GameAudio } from './game/Audio';
import { Game, type GameSettings, type HudState, type NetRole } from './game/Game';
import { ClientSession, HostSession, type ChatMsg } from './net/Session';
import type { LobbyMsg, LobbyPlayer } from './net/protocol';
import type { ChatLine } from './net/chat';
import { basePingFor, COLORS, cssColor, isDark, levelFor, prepareLobby, presetLobby } from './game/identity';
import { loadPolicy } from './rl/PolicyBrain';
import type { Brain } from './sim/FpsSim';
import { DEFAULT_RULES, MODES, PRACTICE_MODES, modeDef, type Difficulty, type LobbyRules, type ModeDef, type ModeId } from './sim/Match';
import { streakDef } from './sim/killstreaks';
import { perkDef, THROWABLES } from './sim/gear';
import { PRIMARIES, WEAPONS, type WeaponId } from './sim/weapons';
import { divisionOf, levelOf, loadProfile, prestigeUp, queueStats, rankedDifficulty, RANKED_MODES, rankOf, recordRanked, saveProfile, type Division, type Profile, type RankedQueue } from './game/progression';
import { Hud } from './ui/Hud';
import { SettingsPanel } from './ui/SettingsPanel';
import { LoadoutPanel } from './ui/LoadoutPanel';
import { CallingCard, LevelBadge, ProfilePanel } from './ui/ProfilePanel';
import { ArmoryPanel } from './ui/ArmoryPanel';
import { newTourney, opponent, recordMatch, roundDifficulty, ROUND_NAMES, tourneyXp, type Tourney } from './game/tournament';
import { canMatchmake, seekPlayers, type MatchmakingResult } from './net/matchmaker';
import { playersOnline, startPresence } from './net/presence';
import { TouchControls } from './ui/TouchControls';
import { ChatBox } from './ui/ChatBox';
import { EndScreen } from './ui/EndScreen';
import { ControlsList } from './ui/ControlsList';
import { account, isStaff, setPresenceSource, startAccount, subscribeAccount, type AccountState, type PresenceStatus } from './net/account';
import { botFriendByName, matchEndedWith, resolveMode, subscribeBotFriends, tickBotFriends, unreadBotMessages, type BotFriend } from './game/botFriends';
import { bringFriends } from './game/identity';
import { setClassroom } from './game/words';
import type { PlayerCardData } from './game/Game';
import { Scoreboard } from './ui/Hud';
import { AccountPanel } from './ui/AccountPanel';
import { FriendsPanel } from './ui/FriendsPanel';
import { PlayerCard, type CardSubject } from './ui/PlayerCard';
import { AdminPanel } from './ui/AdminPanel';
import { NewsBar, NoticeBox } from './ui/NewsBar';
import { ArrowIcon, ExitFullscreenIcon, FullscreenIcon, GearIcon, TrophyIcon } from './ui/icons';
import { setTourDone, Tour, tourDone, type TourStep } from './ui/Tour';
import { resetHints } from './game/hints';
import { loadSettings, QUALITY_PRESETS, saveSettings, suggestQuality } from './game/settings';
import { PadMenus } from './game/gamepad';

type Screen = { kind: 'menu' } | { kind: 'finding' } | { kind: 'playing' } | { kind: 'host-lobby' } | { kind: 'join-lobby' } | { kind: 'tourney' };
type MenuTab = 'play' | 'loadout' | 'armory' | 'profile' | 'friends' | 'settings' | 'admin';

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

/** The first-visit menu tour: the five things new players couldn't find on their own. */
const TOUR: TourStep[] = [
  { target: '.mode-block', title: 'Pick a mode', body: 'Each bar is a game mode. Click one to pick it; your pick turns yellow.' },
  { target: '.play.go', title: 'Find a match', body: 'Drops you into a full lobby in a few seconds.' },
  { target: '.loadout-strip', title: 'Guns and gear', body: 'Your guns, camos, charm, grenades, perks and killstreaks. Click here or the Loadout tab to change them.' },
  { target: '.bug-tabs .menu-tab:nth-child(3)', title: 'Your look', body: 'Colour, style, name tag, tracers and muzzle flash for your soldier.' },
  { target: '.bug-tabs .menu-tab:nth-child(5)', title: 'Controls', body: 'Keys, mouse sensitivity, controller and graphics. In a match, press Esc for the full controls list.' }
];

/** The tag on a mode's bar: team size, player count or how it is played. */
const modeTag = (m: ModeDef): string => {
  if (m.humansOnly) return 'FRIENDS';
  if (m.group === 'Practice') return 'SOLO';
  if (m.id === 'br_duos') return 'DUOS';
  if (m.id === 'br_trios') return 'TRIOS';
  if (m.players === 1) return 'CO-OP';
  if (m.teams) return `${m.players / 2}V${m.players / 2}`;
  return `${m.players} FFA`;
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
  const [showTour, setShowTour] = useState(false);
  // Full screen (mostly for phones, where the browser's bars eat the menu). iPhones have no page full screen, so no button there.
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
  const canFullscreen = !!(document.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const [fullscreen, setFullscreen] = useState(() => !!(document.fullscreenElement || doc.webkitFullscreenElement));
  useEffect(() => {
    const onChange = () => setFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [doc]);
  const toggleFullscreen = () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
        else doc.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      else el.webkitRequestFullscreen?.();
    } catch {
      /* refused (some browsers in frames): the button just does nothing */
    }
  };
  const [hud, setHud] = useState<HudState | null>(null);
  const [round, setRound] = useState(0);
  // Ranked.
  const [ranked, setRanked] = useState(false);
  const [rankedQueue, setRankedQueue] = useState<RankedQueue>('team');
  // Gunfight tournament.
  const [tourney, setTourney] = useState<Tourney | null>(null);
  const tourneyMatch = useRef(false);
  // Real-player matchmaking (peer to peer).
  const mmRef = useRef<MatchmakingResult>(null);
  const mmCancel = useRef(false);
  const [mmState, setMmState] = useState<'none' | 'host' | 'client'>('none');
  const [mmGuests, setMmGuests] = useState<string[]>([]);
  const [mmWaitTimedOut, setMmWaitTimedOut] = useState(false);
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
  const [online, setOnline] = useState(() => playersOnline());
  const [profile, setProfile] = useState<Profile>(loadProfile);
  // Accounts, friends and player cards.
  const [acct, setAcct] = useState<AccountState>(account);
  const [showAccount, setShowAccount] = useState(false);
  const [card, setCard] = useState<CardSubject | null>(null);
  const [friendOpen, setFriendOpen] = useState<string | null>(null);
  const [, setBotTick] = useState(0);
  /** People from recent matches, by name (so you can add someone you just played with). */
  const recent = useRef(new Map<string, PlayerCardData>());
  /** Watch this bot friend in the next match instead of playing. */
  const watchRef = useRef<string | null>(null);
  const endHandled = useRef(-1);
  const presence = useRef<PresenceStatus>({ state: 'menu' });
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
    setClassroom(settings.classroom);
    game.current?.applySettings(settings);
    // Accessibility: text size, colourblind palettes and high contrast are page-wide styles.
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.access.uiScale));
    root.dataset.cb = settings.access.colorblind;
    root.classList.toggle('hc', settings.access.highContrast);
    root.classList.toggle('reduce-motion', settings.access.reduceMotion);
  }, [settings]);

  // Accounts: resume the session (or fetch the news), and reload when a cloud save replaces local progress.
  useEffect(() => {
    startAccount();
    setPresenceSource(() => presence.current);
    const off = subscribeAccount(setAcct);
    const replaced = () => {
      setProfile(loadProfile());
      setSettings((prev) => loadSettings(prev.playerName, prev.playerColor));
    };
    window.addEventListener('fps-save-replaced', replaced);
    return () => {
      off();
      window.removeEventListener('fps-save-replaced', replaced);
    };
  }, []);

  // Bot friends keep their own hours and answer messages.
  useEffect(() => {
    const off = subscribeBotFriends(() => setBotTick((n) => n + 1));
    const t = window.setInterval(() => tickBotFriends(settings.playerName.trim() || 'you'), 2500);
    return () => {
      off();
      window.clearInterval(t);
    };
  }, [settings.playerName]);

  // First visit: the menu tour, once the menu (and its targets) are on screen.
  useEffect(() => {
    if (screen.kind !== 'menu' || !assets || showTour || tourDone()) return;
    setTab('play');
    const t = window.setTimeout(() => setShowTour(true), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.kind, assets]);

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
    // Same for everyone: the shared estimate plus real people online (no per-device randomness).
    startPresence();
    const t = window.setInterval(() => setOnline(playersOnline()), 4000);
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
        ...(watchRef.current && !host ? { watch: watchRef.current } : {}),
        ...(host && !host.party && !host.public ? { rules: host.lobby.rules } : {}),
        ...(ranked && !netRef.current ? { skill: rankedDifficulty(queueStats(loadProfile(), rankedQueue).sr) } : {}),
        // Tournament matches: first to 3 rounds, sharper every round.
        ...(tourneyMatch.current && tourney ? { skill: roundDifficulty(tourney.round), rules: { ...DEFAULT_RULES, score: 0.6 } } : {})
      },
      brain,
      { ...settings, playerName: name },
      audio,
      netRef.current
    );
    game.current = g;
    watchRef.current = null;
    // Auto quality: the match lowered the graphics on a slow device; keep that.
    g.onSettings = (changed) => setSettings((prev) => ({ ...prev, quality: changed.quality, graphics: changed.graphics }));
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
    const delta = recordRanked(hud.result === 'win', hud.kills, hud.deaths, rankedQueue);
    const p = loadProfile();
    setProfile(p);
    setRankedResult({ delta, division: divisionOf(p, rankedQueue), sr: queueStats(p, rankedQueue).sr });
  }, [hud, ranked, rankedQueue]);

  useEffect(() => {
    const g = game.current;
    if (!hud || hud.phase !== 'over' || !g || endHandled.current === round) return;
    endHandled.current = round;
    const names = g.names();
    const friends: string[] = [];
    names.forEach((n, id) => {
      const c = g.cardOf(id);
      if (!c || c.kind === 'me') return;
      recent.current.set(n.toLowerCase(), c);
      const f = botFriendByName(n);
      if (f?.state === 'friends') friends.push(f.key);
    });
    // Keep the most recent 200 people.
    while (recent.current.size > 200) recent.current.delete(recent.current.keys().next().value!);
    if (friends.length && !hud.spectator) matchEndedWith(friends, hud.result === 'win', settings.playerName);
  }, [hud, round, settings.playerName]);

  // Friends see where you are; hosted rooms show up for them (and the admin).
  presence.current =
    screen.kind === 'playing'
      ? { state: 'match', mode, ...(hostRef.current && lobby ? { room: { code: roomCode, mode: lobby.mode, players: lobby.players.length, max: lobby.max, open: !lobby.party } } : {}) }
      : screen.kind === 'host-lobby' && hostRef.current && lobby
        ? { state: 'lobby', mode: lobby.mode, room: { code: roomCode, mode: lobby.mode, players: lobby.players.length, max: lobby.max, open: !lobby.party } }
        : screen.kind === 'join-lobby'
          ? { state: 'lobby' }
          : { state: 'menu' };

  const openCardFor = (id: number) => {
    const c = game.current?.cardOf(id);
    if (c) setCard({ from: 'match', data: c });
  };

  const addChat = useCallback((m: ChatMsg) => {
    setChat((c) => [...c.slice(-80), { id: chatId++, name: m.name, color: m.color, text: m.text, system: m.system, at: Date.now() }]);
  }, []);

  const sendChat = (text: string) => {
    if (hostRef.current) hostRef.current.sendChat(text);
    else clientRef.current?.sendChat(text);
  };

  /** Ends any real-player search (and its session, unless we're playing in it). */
  const stopSeeking = (keep = false) => {
    mmCancel.current = true;
    const mm = mmRef.current;
    if (mm && !keep) {
      if (mm.role === 'host') mm.session.close('The match was cancelled.');
      else mm.session.leave();
    }
    mmRef.current = null;
    setMmState('none');
    setMmGuests([]);
    setMmWaitTimedOut(false);
  };

  /** Looks for other real players searching for the same mode right now. */
  const seek = (m: ModeId) => {
    stopSeeking();
    mmCancel.current = false;
    if (!canMatchmake(m)) return;
    void seekPlayers(m, difficulty, profileForNet(), () => mmCancel.current).then((res) => {
      if (!res || mmCancel.current) return;
      mmRef.current = res;
      if (res.role === 'host') {
        setMmState('host');
        res.session.onChange = () => setMmGuests(res.session.players.slice(1).map((p) => p.name));
      } else {
        setMmState('client');
        const s = res.session;
        // Show who else is in this lobby (the host and any other real players).
        const me = profileForNet().name;
        s.onLobby = (msg) => setMmGuests(msg.players.map((p) => p.name).filter((n) => n !== me));
        s.onStart = (start) => {
          netRef.current = { role: 'client', session: s, start };
          setMode(start.mode);
          setScreen({ kind: 'playing' });
          setRound((r) => r + 1);
        };
        // The host left before starting: carry on with a normal match.
        s.onEnd = () => {
          mmRef.current = null;
          setMmState('none');
        };
      }
    });
  };

  const findMatch = () => {
    audio.unlock();
    setRanked(false);
    tourneyMatch.current = false;
    // Practice needs no lobby: straight in.
    setScreen({ kind: PRACTICE_MODES.includes(mode) ? 'playing' : 'finding' });
    setRound((r) => r + 1);
    if (!PRACTICE_MODES.includes(mode)) seek(mode);
  };
  /** A bot friend joins you (they take the first seat on your side). */
  const playWithFriend = (f: BotFriend, modeText: string) => {
    const m = resolveMode(modeText);
    audio.unlock();
    stopSeeking();
    bringFriends([f.name]);
    setRanked(false);
    tourneyMatch.current = false;
    setMode(m);
    setTab('play');
    setScreen({ kind: PRACTICE_MODES.includes(m) ? 'playing' : 'finding' });
    setRound((n) => n + 1);
  };
  /** Watch a bot friend's match as a spectator. */
  const watchFriend = (f: BotFriend, modeText: string) => {
    audio.unlock();
    stopSeeking();
    bringFriends([f.name]);
    watchRef.current = f.name;
    setRanked(false);
    tourneyMatch.current = false;
    setMode(resolveMode(modeText));
    setScreen({ kind: 'playing' });
    setRound((n) => n + 1);
  };

  const playRanked = (q: RankedQueue) => {
    audio.unlock();
    stopSeeking();
    setRanked(true);
    setRankedQueue(q);
    tourneyMatch.current = false;
    setMode(q === 'duel' ? '1v1' : RANKED_MODES[Math.floor(Math.random() * RANKED_MODES.length)]);
    setScreen({ kind: 'finding' });
    setRound((r) => r + 1);
  };
  const deploy = () => {
    audio.unlock();
    const mm = mmRef.current;
    if (mm?.role === 'host' && mm.session.players.length > 1) {
      // Real players found us: host the match for them (everyone else is filled in as usual).
      netRef.current = { role: 'host', session: mm.session, seed: (Math.random() * 1e9) | 0 };
      stopSeeking(true);
    } else stopSeeking();
    setScreen({ kind: 'playing' });
  };

  // A guest waits for the host to start; if it never does, play a normal match instead.
  useEffect(() => {
    if (screen.kind !== 'finding' || mmState !== 'client') return;
    const t = window.setTimeout(() => setMmWaitTimedOut(true), 15000);
    return () => window.clearTimeout(t);
  }, [screen, mmState]);

  // ---- Gunfight tournament
  const startTourney = () => {
    audio.unlock();
    stopSeeking();
    setTourney(newTourney(settings.playerName.trim() || 'You'));
    setScreen({ kind: 'tourney' });
  };
  const playTourneyMatch = () => {
    if (!tourney) return;
    const opp = opponent(tourney);
    if (opp === null) return;
    const me = tourney.teams.find((t) => t.you)!;
    // You, your teammate, then the two opponents.
    presetLobby([me.players[1], ...tourney.teams[opp].players]);
    tourneyMatch.current = true;
    setRanked(false);
    setMode('gunfight');
    setScreen({ kind: 'playing' });
    setRound((r) => r + 1);
  };
  const finishTourneyMatch = () => {
    if (!tourney || !hud) return;
    const next = recordMatch(tourney, hud.result === 'win');
    // Bracket rewards when it ends for you.
    if (next.outIn !== null || next.champion !== null) {
      const p = loadProfile();
      p.xp += tourneyXp(next);
      if (next.champion !== null && next.teams[next.champion].you) p.tourneyWins++;
      saveProfile(p);
      setProfile(p);
    }
    tourneyMatch.current = false;
    setTourney(next);
    setScreen({ kind: 'tourney' });
  };
  const toMenu = useCallback(() => {
    // Quitting a ranked match early counts as a loss.
    const g = game.current;
    if (ranked && g && !rankedDone.current && !g.net && g.match.phase !== 'over') {
      rankedDone.current = true;
      recordRanked(false, g.match.player.kills, g.match.player.deaths);
    }
    setProfile(loadProfile());
    stopSeeking();
    tourneyMatch.current = false;
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
    cosmetics: { ...settings.cosmetics, prestige: profile.prestige },
    account: account().user?.name ?? null
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

  const joinGame = () => joinRoom(joinCode);
  /** Joins a room by code: from the code box, a friend's Join button, or Watch (as a spectator). */
  const joinRoom = async (code: string, spectate = false) => {
    audio.unlock();
    setNetError(null);
    if (code.trim().length < 5) {
      setNetError('Enter the 5-letter room code from the host.');
      return;
    }
    setNetBusy(true);
    setTab('play');
    try {
      const session = await ClientSession.connect(code, { ...profileForNet(), spectate });
      clientRef.current = session;
      setChat([]);
      bindClient(session);
      setRoomCode(code.trim().toUpperCase());
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
  const division = divisionOf(profile, rankedQueue);
  const teamDiv = divisionOf(profile, 'team');
  const duelDiv = divisionOf(profile, 'duel');

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
          <div className="shell">
            <header className="bug">
              <h1 className="bug-net">FPS SHOOTER</h1>
              <nav className="bug-tabs" aria-label="Menu">
                {(
                  [
                    ['play', 'Play'],
                    ['loadout', 'Loadout'],
                    ['armory', 'Armory'],
                    ['profile', 'Profile'],
                    ['friends', 'Friends'],
                    ['settings', 'Settings'],
                    ...(isStaff() ? ([['admin', 'Admin']] as [MenuTab, string][]) : [])
                  ] as [MenuTab, string][]
                ).map(([id, label]) => {
                  const badge = id === 'friends' ? unreadBotMessages() + acct.unread + acct.requests : 0;
                  return (
                    <button key={id} className={`menu-tab ${tab === id ? 'on' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                      {label}
                      {badge > 0 && <em aria-label={`${badge} new`}>{badge}</em>}
                    </button>
                  );
                })}
              </nav>
              <button className="bug-account" onClick={() => setShowAccount(true)} title={acct.user ? 'Your account' : 'Sign in or create an account'}>
                {acct.user ? acct.user.name : 'Sign in'}
              </button>
              {canFullscreen && (
                <button className="bug-full" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreen ? 'Exit full screen' : 'Full screen'}>
                  {fullscreen ? <ExitFullscreenIcon size={20} /> : <FullscreenIcon size={20} />}
                </button>
              )}
              <div className="bug-live">
                <b>LIVE</b>
                <span className="live-full">
                  <em key={online}>{online.toLocaleString()}</em> players online
                </span>
                <span className="live-short">{(online / 1000).toFixed(1)}K online</span>
              </div>
            </header>
            <NewsBar />

            {tab === 'play' ? (
              <div className="desk" key="play">
                <div className="desk-main">
                  {MODE_GROUPS.map((group) => (
                    <section key={group} className="mode-block">
                      <h2 className="mode-group">{group}</h2>
                      <div className="modes">
                        {MODES.filter((m) => m.group === group).map((m, i) => (
                          <button
                            key={m.id}
                            className={`mode g-${group.toLowerCase().replace(/[^a-z]/g, '')} ${mode === m.id ? 'on' : ''}`}
                            style={{ ['--i' as string]: i }}
                            aria-pressed={mode === m.id}
                            title={m.blurb}
                            onClick={() => setMode(m.id)}
                          >
                            <span className="mode-tag">{modeTag(m)}</span>
                            <span className="mode-bar">
                              <strong>{m.name}</strong>
                              <span>{m.blurb}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                  <section className="controls" aria-label="Controls">
                    <h2 className="mode-group">Controls</h2>
                    <ControlsList settings={settings} />
                  </section>
                </div>

                <aside className="desk-rail">
                  <ProfileBar profile={profile} frame={settings.cosmetics.frame}>
                    <div className="name-field">
                      <label htmlFor="player-name">Name</label>
                      <div className="name-row">
                        <input
                          id="player-name"
                          value={settings.playerName}
                          maxLength={16}
                          spellCheck={false}
                          onChange={(e) => setSettings({ ...settings, playerName: e.target.value.replace(/\s+/g, '_') })}
                        />
                        <button className="color-chip" style={{ background: cssColor(settings.playerColor) }} title="Your colour: change it in the Armory" aria-label="Change your colour in the Armory" onClick={() => setTab('armory')} />
                      </div>
                    </div>
                  </ProfileBar>

                  <div className="seg" role="group" aria-label="Lobby">
                    {LOBBY.map((d) => (
                      <button key={d.id} className={difficulty === d.id ? 'on' : ''} aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
                        {d.label}
                      </button>
                    ))}
                  </div>

                  <button className="play go" disabled={!assets || !!modeDef(mode).humansOnly} onClick={findMatch}>
                    {!assets ? loadMsg : modeDef(mode).humansOnly ? 'FRIENDS ONLY' : PRACTICE_MODES.includes(mode) ? 'START PRACTICE' : 'FIND MATCH'}
                    <small>{modeDef(mode).humansOnly ? 'Host a game below to play this mode' : `${modeDef(mode).name} · ${LOBBY.find((d) => d.id === difficulty)!.label} lobby`}</small>
                  </button>

                  <section className="rail-card online">
                    <h2 className="rail-head">Play with friends</h2>
                    <div className="online-actions">
                      <button className="chip" disabled={!assets || netBusy} onClick={() => hostGame(true)} title="Queue into normal games together; you pick the mode">
                        Create party
                      </button>
                      <button className="chip" disabled={!assets || netBusy} onClick={() => hostGame(false)} title="A private room with custom rules and friends-only modes">
                        Host game
                      </button>
                    </div>
                    <div className="join-row">
                      <input
                        className="code-input"
                        placeholder="CODE"
                        aria-label="Room code"
                        maxLength={5}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      />
                      <button className="chip" disabled={!assets || netBusy || joinCode.length === 0} onClick={joinGame}>
                        Join
                      </button>
                    </div>
                    {netBusy && <p className="set-hint">Connecting…</p>}
                    {netError && <p className="net-error">{netError}</p>}
                  </section>

                  <section className="rail-card ranked-card">
                    <h2 className="rail-head">Ranked</h2>
                    {(
                      [
                        ['team', 'Team', teamDiv],
                        ['duel', '1v1', duelDiv]
                      ] as [RankedQueue, string, Division][]
                    ).map(([q, label, d]) => {
                      const qs = queueStats(profile, q);
                      return (
                        <div key={q} className={`rank-queue ${d.placed ? '' : 'pending'}`}>
                          <em>{label}</em>
                          <span>
                            <b style={d.placed ? { color: d.color } : undefined}>{d.name}</b>
                            <small>
                              {d.placed ? `${qs.sr} SR · ` : ''}
                              {qs.wins}W {qs.matches - qs.wins}L
                            </small>
                          </span>
                          <button className="chip" disabled={!assets} onClick={() => playRanked(q)}>
                            Play
                          </button>
                        </div>
                      );
                    })}
                    <button className="chip tourney-btn" disabled={!assets} onClick={startTourney}>
                      <TrophyIcon /> Gunfight tournament
                    </button>
                  </section>

                  <button className="rail-card loadout-strip" onClick={() => setTab('loadout')}>
                    <span className="rail-head">
                      Loadout
                      <span>
                        Edit <ArrowIcon size={14} />
                      </span>
                    </span>
                    <dl>
                      <dt>Guns</dt>
                      <dd>
                        {WEAPONS[settings.primary].name} · {WEAPONS[settings.secondary].name}
                      </dd>
                      <dt>Gear</dt>
                      <dd>
                        {THROWABLES[settings.lethal].name} · {THROWABLES[settings.tactical].name}
                      </dd>
                      <dt>Perks</dt>
                      <dd>{settings.perks.map((p) => perkDef(p).name).join(' · ')}</dd>
                      <dt>Streaks</dt>
                      <dd>{settings.streaks.map((st) => streakDef(st).name).join(' · ')}</dd>
                    </dl>
                  </button>

                </aside>
              </div>
            ) : (
              <div className="desk single" key={tab}>
                {tab === 'loadout' && <LoadoutPanel settings={settings} onChange={setSettings} profile={profile} assets={assets} />}
                {tab === 'armory' && <ArmoryPanel settings={settings} onChange={setSettings} profile={profile} assets={assets} onOpenLoadout={() => setTab('loadout')} />}
                {tab === 'profile' && (
                  <ProfilePanel
                    settings={settings}
                    onChange={setSettings}
                    profile={profile}
                    onPrestige={() => {
                      if (window.confirm('Prestige now? You go back to level 1 and keep all your unlocks.')) setProfile(prestigeUp());
                    }}
                  />
                )}
                {tab === 'friends' && (
                  <FriendsPanel
                    playerName={settings.playerName.trim() || 'you'}
                    open={friendOpen}
                    onOpen={setFriendOpen}
                    recentPlayer={(n) => recent.current.get(n.toLowerCase()) ?? null}
                    onCard={setCard}
                    onJoinRoom={(code, spectate) => void joinRoom(code, spectate)}
                    onPlayWith={playWithFriend}
                    onWatch={watchFriend}
                    onSignIn={() => setShowAccount(true)}
                  />
                )}
                {tab === 'admin' && isStaff() && <AdminPanel onWatchRoom={(code) => void joinRoom(code, true)} />}
                {tab === 'settings' && (
                  <SettingsPanel
                    settings={settings}
                    onChange={setSettings}
                    onReplayTour={() => {
                      resetHints();
                      setTourDone(false);
                      setTab('play');
                      setShowTour(true);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {showTour && screen.kind === 'menu' && tab === 'play' && <Tour steps={TOUR} onClose={() => setShowTour(false)} />}
      {showAccount && <AccountPanel onClose={() => setShowAccount(false)} />}
      {card && (
        <PlayerCard
          subject={card}
          myProfile={profile}
          onClose={() => setCard(null)}
          onMessage={
            screen.kind === 'menu'
              ? (key) => {
                  setCard(null);
                  setTab('friends');
                  setFriendOpen(key);
                }
              : undefined
          }
        />
      )}
      <NoticeBox />
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
      {screen.kind === 'tourney' && tourney && <TourneyScreen t={tourney} onPlay={playTourneyMatch} onMenu={() => { setTourney(null); toMenu(); }} onAgain={startTourney} />}
      {screen.kind === 'finding' && (
        <div className="menu">
          <div className="menu-card small pregame">
            <header className={`pg-head ${lobbyFull ? 'found' : ''}`}>
              <h2>{lobbyFull ? 'Match found' : ranked ? 'Finding ranked match' : 'Finding match'}</h2>
              <span>
                {def.name} · {ranked ? <b style={{ color: division.color }}>Ranked · {division.name}</b> : `${LOBBY.find((d) => d.id === difficulty)!.label} lobby`}
              </span>
            </header>
            <div className="pg-count">
              <b key={joined}>{joined}</b>
              <span>/ {def.players} players</span>
            </div>
            <div className="lobby-bar" role="progressbar" aria-label="Players joined" aria-valuenow={joined} aria-valuemax={def.players}>
              <div style={{ width: `${(joined / def.players) * 100}%` }} />
            </div>
            <div className="joining">
              {/* You and any real players stay pinned at the top; the rest scroll in as they join. */}
              {[settings.playerName.trim() || 'You', ...mmGuests, ...lobbyNames.slice(0, Math.max(0, joined - 1 - mmGuests.length)).slice(-Math.max(1, 7 - mmGuests.length))].map((n, i, arr) => (
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
              {mmState === 'client' && !mmWaitTimedOut ? (
                <button className="play" disabled>
                  {lobbyFull ? 'CONNECTING TO SERVER…' : 'WAITING…'}
                </button>
              ) : (
                <button
                  className="play"
                  disabled={!lobbyFull}
                  onClick={() => {
                    if (mmState === 'client') stopSeeking();
                    deploy();
                  }}
                >
                  {lobbyFull ? 'DEPLOY' : 'WAITING…'}
                </button>
              )}
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
          {hud.online && !hud.publicMatch && (
            <ChatBox lines={chat} onSend={sendChat} inGame open={hud.chatOpen} onClose={() => game.current?.closeChat()} now={Date.now()} />
          )}
          {hud.intro !== null && hud.phase !== 'over' && <Lineup hud={hud} onSkip={() => game.current?.skipIntro()} />}
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
              <div className="menu-card pause-card">
                <div className="pause-actions">
                  <h2>Paused</h2>
                  <button className="play" onClick={resume}>
                    RESUME
                  </button>
                  <button className="pause-btn" onClick={() => setShowSettings(true)}>
                    <GearIcon /> Settings
                  </button>
                  <button className="pause-btn" onClick={toMenu}>
                    {ranked && !hud.online ? 'Leave match (counts as a loss)' : 'Leave match'}
                  </button>
                  {hud.online && <p className="set-hint">Online matches keep running while you're paused.</p>}
                </div>
                <section className="pause-controls" aria-label="Controls">
                  <h3>Controls</h3>
                  <ControlsList settings={settings} touch={hud.touch} />
                </section>
                <section className="pause-players" aria-label="Players">
                  <h3>Players</h3>
                  <p className="set-hint">Click someone to see their card, add them as a friend or report them.</p>
                  <Scoreboard hud={hud} onPick={openCardFor} />
                </section>
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
              onAgain={tourneyMatch.current ? finishTourneyMatch : hud.online && !hud.publicMatch ? null : ranked ? () => playRanked(rankedQueue) : findMatch}
              againLabel={tourneyMatch.current ? 'CONTINUE' : undefined}
              onLobby={hud.online && hostRef.current ? backToLobby : null}
              waitingForHost={hud.online && !hostRef.current}
              onMenu={toMenu}
              mine={{ card: settings.cosmetics.card, emblem: settings.cosmetics.emblem, name: settings.playerName, level, title: settings.cosmetics.title, frame: settings.cosmetics.frame, prestige: profile.prestige }}
              onPick={openCardFor}
            />
          )}
        </>
      )}
    </>
  );
};

const ProfileBar = ({ profile, frame, children }: { profile: Profile; frame: string; children?: ReactNode }) => {
  const { level, into, need } = levelOf(profile.xp);
  const maxed = level >= 55 && profile.prestige < 10;
  return (
    <section className="rail-card profile-bar">
      <div className="pb-top">
        <LevelBadge level={level} prestige={profile.prestige} frame={frame} />
        <div className="rank">
          <b>
            {rankOf(level)}
            {profile.prestige > 0 && <em className="prestige-tag"> · Prestige {profile.prestige}</em>}
          </b>
          <small>
            {profile.matches} matches · {profile.wins} wins · {profile.kills} kills
          </small>
        </div>
      </div>
      <div className="xpbar" role="progressbar" aria-label="Level progress" aria-valuenow={maxed ? need : into} aria-valuemax={need}>
        <div style={{ width: `${maxed ? 100 : (into / need) * 100}%` }} />
      </div>
      <small className="xp-line">{maxed ? 'Max level: prestige from your Profile' : `${into.toLocaleString()} / ${need.toLocaleString()} XP to level ${level + 1}`}</small>
      {children}
    </section>
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


/** The bracket: three rounds of four, two and one matches; your path highlighted. */
const TourneyScreen = ({ t, onPlay, onMenu, onAgain }: { t: Tourney; onPlay: () => void; onMenu: () => void; onAgain: () => void }) => {
  const opp = opponent(t);
  const me = t.teams.findIndex((x) => x.you);
  const won = t.champion !== null && t.teams[t.champion].you;
  const rounds = [0, 1, 2].map((r) => t.rounds[r] ?? []);
  const winners = (r: number) => new Set(t.rounds[r + 1] ?? []);
  return (
    <div className="menu">
      <div className="menu-card tourney-card">
        <h2>
          <TrophyIcon size={26} /> Gunfight Tournament
        </h2>
        <p className="sub">8 teams, 2v2 Gunfight Roulette, first to 3 rounds. Lose once and you're out.</p>
        <div className="bracket">
          {rounds.map((teams, r) => (
            <div key={r} className="bracket-col">
              <small>{ROUND_NAMES[r]}</small>
              {Array.from({ length: [4, 2, 1][r] }, (_, k) => {
                const a = teams[k * 2];
                const b = teams[k * 2 + 1];
                const w = winners(r);
                const row = (i: number | undefined) =>
                  i === undefined ? (
                    <div className="b-team tbd">TBD</div>
                  ) : (
                    <div className={`b-team ${i === me ? 'you' : ''} ${w.size ? (w.has(i) ? 'won' : 'lost') : ''}`}>
                      <b>{t.teams[i].name}</b>
                      <small>{t.teams[i].players.join(' & ')}</small>
                    </div>
                  );
                return (
                  <div key={k} className="b-match">
                    {row(a)}
                    {row(b)}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="bracket-col">
            <small>Champion</small>
            <div className="b-match">{t.champion !== null ? <div className={`b-team champ ${won ? 'you' : ''}`}><b>{t.teams[t.champion].name}</b></div> : <div className="b-team tbd">?</div>}</div>
          </div>
        </div>
        {opp !== null ? (
          <div className="row">
            <button className="play" onClick={onPlay}>
              PLAY {ROUND_NAMES[t.round].toUpperCase()} vs {t.teams[opp].name.toUpperCase()}
            </button>
            <button className="chip" onClick={onMenu}>
              Forfeit
            </button>
          </div>
        ) : (
          <>
            <p className={`tourney-result ${won ? 'win' : 'lose'}`}>
              {won ? 'Champions! +3000 XP, and tournament rewards in your Profile, Armory and Loadout.' : `Knocked out in the ${ROUND_NAMES[t.outIn ?? 0].toLowerCase()} · +${tourneyXp(t)} XP`}
            </p>
            <div className="row">
              <button className="play" onClick={onAgain}>
                NEW TOURNAMENT
              </button>
              <button className="chip" onClick={onMenu}>
                Main menu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** Pre-match lineup: both sides' calling cards before the match starts. */
const Lineup = ({ hud, onSkip }: { hud: HudState; onSkip: () => void }) => {
  const card = (p: HudState['players'][number]) => (
    <CallingCard key={p.id} card={p.card} emblem={p.emblemId} name={p.name} level={p.level} title={p.title} frame={p.frame} prestige={p.prestige} sub={p.bot ? 'BOT' : undefined} />
  );
  const teams = hud.showTeams ? [hud.players.filter((p) => p.ally), hud.players.filter((p) => !p.ally)] : [hud.players];
  return (
    <div className="lineup" onClick={onSkip}>
      <h2>
        <span>{hud.modeName}</span>
      </h2>
      <div className={`lineup-teams ${teams.length === 2 ? 'versus' : ''}`}>
        {teams.map((list, i) => (
          <div key={i} className={`lineup-col ${i === 1 ? 'away' : ''}`}>
            {teams.length === 2 && (
              <div className="lu-team" style={{ background: hud.teamColors?.[i] }}>
                {i === 0 ? 'Your team' : 'Enemy team'}
              </div>
            )}
            {list.slice(0, 12).map((p, k) => (
              <div key={p.id} className="lu-row" style={{ ['--i' as string]: k }}>
                {card(p)}
              </div>
            ))}
          </div>
        ))}
        {teams.length === 2 && <div className="lineup-vs">VS</div>}
      </div>
      <small className="lineup-skip">Starting in {Math.ceil(hud.intro ?? 0)} · click or press Space to skip</small>
    </div>
  );
};
