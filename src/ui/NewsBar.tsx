import { useEffect, useState } from 'react';
import { account, dismissNotice, subscribeAccount, type AccountState } from '../net/account';

const EVENT_NAMES: Record<string, string> = { doubleXp: 'Double XP', bigHeads: 'Big Heads', lowGravity: 'Low Gravity' };
const DISMISSED = 'fps-news-seen-v1';

const seen = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) ?? '[]');
  } catch {
    return [];
  }
};

/** Announcements from the admin, live events and maintenance notices, under the menu's top bar. */
export const NewsBar = () => {
  const [st, setSt] = useState<AccountState>(account);
  const [hidden, setHidden] = useState<number[]>(seen);
  useEffect(() => subscribeAccount(setSt), []);
  const now = Date.now();
  const events = Object.entries(st.events).filter(([, until]) => until > now);
  const news = st.news.filter((n) => !hidden.includes(n.id));
  if (!st.maintenance && !events.length && !news.length) return null;
  const hide = (id: number) => {
    const next = [...hidden, id].slice(-50);
    setHidden(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="news-bar" role="region" aria-label="News">
      {st.maintenance && <p className="news warning">{st.maintenance}</p>}
      {events.map(([k, until]) => (
        <p key={k} className="news event">
          <b>{EVENT_NAMES[k] ?? k}</b> is on until {new Date(until).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
      ))}
      {news.map((n) => (
        <p key={n.id} className={`news ${n.kind}`}>
          {n.kind === 'celebrate' && <span className="confetti" aria-hidden="true" />}
          <span>{n.text}</span>
          <button className="news-x" onClick={() => hide(n.id)} aria-label="Dismiss">
            Dismiss
          </button>
        </p>
      ))}
    </div>
  );
};

/** One-time messages: a warning from a moderator, a gift, a rename, being signed out. */
export const NoticeBox = () => {
  const [st, setSt] = useState<AccountState>(account);
  useEffect(() => subscribeAccount(setSt), []);
  const n = st.notices[0];
  if (!n) return null;
  return (
    <div className="overlay notice-overlay" role="alertdialog" aria-modal="true" aria-label="Message">
      <div className="menu-card small">
        <p className="notice-text">{n}</p>
        <div className="row">
          <button className="play" onClick={dismissNotice} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
