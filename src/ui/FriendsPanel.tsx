import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addBotFriend, botFriendByName, botFriends, isTyping, markRead, modeName, removeBotFriend, resolveMode, sendToBot, statusOf, subscribeBotFriends, type BotFriend } from '../game/botFriends';
import { DEFAULT_COSMETICS } from '../game/cosmetics';
import { setRealFriendCount, type PlayerCardData } from '../game/Game';
import { bumpStat } from '../game/progression';
import { account, api, subscribeAccount } from '../net/account';
import type { CardSubject } from './PlayerCard';

interface RealFriend {
  id: number;
  name: string;
  title: string | null;
  online: boolean;
  lastSeen: number;
  status: { state: string; mode: string | null; room: string | null } | null;
  unread: number;
}
interface Msg {
  id: number;
  mine: boolean;
  text: string;
  at: number;
  invite?: { mode: string };
}

/** One row in the list, whoever the friend is. */
interface Row {
  key: string;
  name: string;
  online: boolean;
  state: string;
  mode: string | null;
  room: string | null;
  lastSeenMin?: number;
  unread: number;
  bot?: BotFriend;
  real?: RealFriend;
}

const statusLine = (r: Row) =>
  !r.online
    ? r.lastSeenMin !== undefined
      ? `Offline · on ${r.lastSeenMin < 60 ? `${Math.max(1, r.lastSeenMin)} min` : r.lastSeenMin < 60 * 24 ? `${Math.round(r.lastSeenMin / 60)} h` : `${Math.round(r.lastSeenMin / 1440)} d`} ago`
      : 'Offline'
    : r.state === 'match' && r.mode
      ? `In a match · ${modeName(r.mode)}`
      : r.state === 'lobby'
        ? 'In a lobby'
        : 'Online';

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Friends: who's on and what they're doing, requests, and chat. */
export const FriendsPanel = ({
  playerName,
  open,
  onOpen,
  recentPlayer,
  onCard,
  onJoinRoom,
  onPlayWith,
  onWatch,
  onSignIn
}: {
  playerName: string;
  /** The friend whose chat is open (key: "u:<id>" or "bot:<seed>"). */
  open: string | null;
  onOpen: (key: string | null) => void;
  /** Someone you played with recently, by name (lets you add people you met in a match). */
  recentPlayer: (name: string) => PlayerCardData | null;
  onCard: (s: CardSubject) => void;
  onJoinRoom: (code: string, spectate: boolean) => void;
  onPlayWith: (friend: BotFriend, mode: string) => void;
  onWatch: (friend: BotFriend, mode: string) => void;
  onSignIn: () => void;
}) => {
  const [user, setUser] = useState(account().user);
  const [real, setReal] = useState<{ friends: RealFriend[]; incoming: RealFriend[]; outgoing: RealFriend[] }>({ friends: [], incoming: [], outgoing: [] });
  const [, bump] = useState(0);
  const [add, setAdd] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeAccount((s) => setUser(s.user)), []);
  useEffect(() => subscribeBotFriends(() => bump((n) => n + 1)), []);
  // Ticks the "last seen" times and bot statuses.
  useEffect(() => {
    const t = window.setInterval(() => bump((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const loadReal = async () => {
    if (!account().user) return;
    const r = await api<typeof real>('friends');
    if (r.ok) {
      setReal(r.data);
      setRealFriendCount(r.data.friends.length);
    }
  };
  useEffect(() => {
    void loadReal();
    const t = window.setInterval(() => void loadReal(), 20_000);
    return () => window.clearInterval(t);
  }, [user?.id]);

  const rows: Row[] = [
    ...real.friends.map((f): Row => ({ key: `u:${f.id}`, name: f.name, online: f.online, state: f.status?.state ?? 'menu', mode: f.status?.mode ?? null, room: f.status?.room ?? null, lastSeenMin: f.lastSeen ? Math.round((Date.now() - f.lastSeen) / 60_000) : undefined, unread: f.unread, real: f })),
    ...botFriends()
      .filter((b) => b.state === 'friends')
      .map((b): Row => {
        const s = statusOf(b);
        return { key: b.key, name: b.name, online: s.online, state: s.state, mode: s.mode ?? null, room: null, lastSeenMin: s.lastSeenMin, unread: b.unread, bot: b };
      })
  ].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const outgoing = [...real.outgoing.map((f) => ({ key: `u:${f.id}`, name: f.name })), ...botFriends().filter((b) => b.state === 'pending').map((b) => ({ key: b.key, name: b.name }))];
  const sel = rows.find((r) => r.key === open) ?? null;

  // Real chat: poll while it's open.
  useEffect(() => {
    if (!sel?.real) return;
    let alive = true;
    const load = async () => {
      const r = await api<{ messages: Msg[] }>(`messages?with=${sel.real!.id}`);
      if (alive && r.ok) setMsgs(r.data.messages);
    };
    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [sel?.real?.id]);
  useEffect(() => {
    if (sel?.bot && sel.bot.unread) markRead(sel.bot.key);
  });
  const lines: Msg[] = sel?.bot ? sel.bot.chat.map((l, i) => ({ id: i, mine: l.mine, text: l.text, at: l.at, invite: l.invite })) : sel?.real ? msgs : [];
  // Braces matter: newer browsers return a Promise from scrollIntoView, which React would try to call as a cleanup.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [lines.length, open]);

  const addFriend = async (e: FormEvent) => {
    e.preventDefault();
    const name = add.trim();
    if (!name) return;
    setNote(null);
    // Someone from a recent match who isn't signed in to an account here: they still get your request.
    const recent = recentPlayer(name);
    if (recent && (recent.kind === 'bot' || !user)) {
      if (recent.kind !== 'bot') return setNote('Sign in to add friends by username');
      addBotFriend({ name: recent.name, color: recent.color, level: recent.level, prestige: recent.prestige, cosmetics: recent.cosmetics ?? botFriendByName(recent.name)?.cosmetics ?? { ...DEFAULT_COSMETICS }, favorite: recent.favorite });
      setNote(`Friend request sent to ${recent.name}`);
      setAdd('');
      return;
    }
    if (!user) return setNote('Sign in to add friends by username');
    const r = await api<{ accepted?: boolean }>('friends/request', { body: { name } });
    setNote(r.ok ? (r.data.accepted ? `You and ${name} are now friends` : `Friend request sent to ${name}`) : (r.data.error ?? 'Could not send'));
    if (r.ok) {
      setAdd('');
      void loadReal();
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !sel) return;
    setText('');
    bumpStat('messages');
    if (sel.bot) sendToBot(sel.bot.key, t, playerName);
    else if (sel.real) {
      const r = await api('messages', { body: { to: sel.real.id, text: t } });
      if (!r.ok) setNote(r.data.error ?? 'Not sent');
      const m = await api<{ messages: Msg[] }>(`messages?with=${sel.real.id}`);
      if (m.ok) setMsgs(m.data.messages);
    }
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Remove ${r.name} from your friends?`)) return;
    if (r.bot) removeBotFriend(r.bot.key);
    else if (r.real) {
      await api('friends/remove', { body: { id: r.real.id } });
      void loadReal();
    }
    onOpen(null);
  };

  return (
    <div className="friends-panel">
      <aside className="fr-list">
        <form className="acc-row" onSubmit={addFriend}>
          <input className="field" placeholder="Add a friend by username" value={add} onChange={(e) => setAdd(e.target.value)} maxLength={16} aria-label="Username to add" />
          <button className="chip">Add</button>
        </form>
        {note && (
          <p className="set-hint" role="status">
            {note}
          </p>
        )}
        {!user && (
          <p className="set-hint fr-signin">
            <button className="chip" onClick={onSignIn}>
              Sign in
            </button>{' '}
            to add friends by username and keep them on every computer.
          </p>
        )}

        {real.incoming.length > 0 && (
          <section>
            <h3 className="mode-group">Requests</h3>
            {real.incoming.map((f) => (
              <div key={f.id} className="fr-row req">
                <button className="fr-name" onClick={() => onCard({ from: 'account', name: f.name })}>
                  {f.name}
                </button>
                <span className="fr-acts">
                  <button
                    className="chip on"
                    onClick={async () => {
                      await api('friends/accept', { body: { id: f.id } });
                      void loadReal();
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="chip"
                    onClick={async () => {
                      await api('friends/remove', { body: { id: f.id } });
                      void loadReal();
                    }}
                  >
                    Decline
                  </button>
                </span>
              </div>
            ))}
          </section>
        )}

        <section>
          <h3 className="mode-group">
            Friends <small>{rows.filter((r) => r.online).length} online</small>
          </h3>
          {rows.length === 0 && <p className="set-hint">No friends yet. Click someone on a scoreboard to add them, or type a username above.</p>}
          {rows.map((r) => (
            <button key={r.key} className={`fr-row ${open === r.key ? 'on' : ''} ${r.online ? 'online' : ''}`} onClick={() => onOpen(r.key)}>
              <i className={`fr-dot ${r.online ? (r.state === 'match' ? 'busy' : 'on') : ''}`} aria-hidden="true" />
              <span className="fr-text">
                <b>{r.name}</b>
                <small>{statusLine(r)}</small>
              </span>
              {r.unread > 0 && <em className="fr-unread">{r.unread}</em>}
            </button>
          ))}
        </section>

        {outgoing.length > 0 && (
          <section>
            <h3 className="mode-group">Sent requests</h3>
            {outgoing.map((o) => (
              <div key={o.key} className="fr-row req">
                <span className="fr-text">
                  <b>{o.name}</b>
                  <small>Waiting for them to accept</small>
                </span>
              </div>
            ))}
          </section>
        )}
      </aside>

      <section className="fr-chat" aria-label="Chat">
        {!sel ? (
          <p className="set-hint fr-empty">Pick a friend to chat, see what they’re doing, or play together.</p>
        ) : (
          <>
            <header className="fr-chat-head">
              <span className="fr-text">
                <b>{sel.name}</b>
                <small>{statusLine(sel)}</small>
              </span>
              <span className="fr-acts">
                {sel.bot && sel.online && sel.state !== 'match' && (
                  <button className="chip on" onClick={() => onPlayWith(sel.bot!, 'tdm')}>
                    Play together
                  </button>
                )}
                {sel.bot && sel.online && sel.state === 'match' && sel.mode && (
                  <button className="chip on" onClick={() => onWatch(sel.bot!, sel.mode!)}>
                    Watch
                  </button>
                )}
                {sel.real && sel.online && sel.room && (
                  <>
                    <button className="chip on" onClick={() => onJoinRoom(sel.room!, false)}>
                      Join
                    </button>
                    <button className="chip" onClick={() => onJoinRoom(sel.room!, true)}>
                      Watch
                    </button>
                  </>
                )}
                <button className="chip" onClick={() => onCard(sel.bot ? { from: 'bot', friend: sel.bot } : { from: 'account', name: sel.name })}>
                  Profile
                </button>
                <button className="chip" onClick={() => void remove(sel)}>
                  Remove
                </button>
              </span>
            </header>
            <div className="fr-msgs">
              {lines.length === 0 && <p className="set-hint">Say hi to {sel.name}.</p>}
              {lines.map((m) => (
                <div key={m.id} className={`fr-msg ${m.mine ? 'mine' : ''}`}>
                  <p>{m.text}</p>
                  {m.invite && sel.bot && (
                    <button className="chip on" disabled={!statusOf(sel.bot).online} onClick={() => onPlayWith(sel.bot!, m.invite!.mode)}>
                      Join · {modeName(resolveMode(m.invite.mode))}
                    </button>
                  )}
                  <small>{time(m.at)}</small>
                </div>
              ))}
              {sel.bot && isTyping(sel.bot.key) && <p className="fr-typing">{sel.name} is typing…</p>}
              <div ref={listEnd} />
            </div>
            <form className="acc-row fr-send" onSubmit={send}>
              <input className="field" placeholder={`Message ${sel.name}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-label="Message" />
              <button className="chip" disabled={!text.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};
