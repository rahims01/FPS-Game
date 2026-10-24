import { useEffect, useRef, useState } from 'react';
import type { ChatLine } from '../net/chat';
import { CHAT_MAX } from '../net/chat';
import { cssColor, isDark } from '../game/identity';

/**
 * Room chat. In the lobby the input is always there; in a match the log fades
 * after a while and the input only opens with the chat key.
 */
export const ChatBox = ({
  lines,
  onSend,
  inGame,
  open,
  onClose,
  now
}: {
  lines: ChatLine[];
  onSend: (text: string) => void;
  inGame: boolean;
  open: boolean;
  onClose?: () => void;
  now: number;
}) => {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines.length]);

  // In a match, only recent lines show unless the box is open.
  const shown = inGame && !open ? lines.filter((l) => now - l.at < 9000).slice(-6) : lines.slice(-50);

  const send = () => {
    if (text.trim()) onSend(text);
    setText('');
    if (inGame) onClose?.();
  };

  return (
    <div className={`chat ${inGame ? 'in-game' : ''} ${open ? 'open' : ''}`}>
      <div className="chat-log" ref={log}>
        {shown.map((l) =>
          l.system ? (
            <div key={l.id} className="chat-line system">
              {l.text}
            </div>
          ) : (
            <div key={l.id} className="chat-line">
              <b className={isDark(cssColor(l.color)) ? 'dark' : ''} style={{ color: cssColor(l.color) }}>
                {l.name}:
              </b>{' '}
              {l.text}
            </div>
          )
        )}
        {!inGame && !lines.length && <div className="chat-line system">Say hi to your squad. Chat is filtered.</div>}
      </div>
      {(open || !inGame) && (
        <input
          ref={input}
          className="chat-input"
          value={text}
          maxLength={CHAT_MAX}
          placeholder={inGame ? 'Say something… (Enter to send, Esc to cancel)' : 'Type a message…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') send();
            if (e.key === 'Escape') {
              setText('');
              onClose?.();
            }
          }}
        />
      )}
    </div>
  );
};
