import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';

/** A password box with a Show / Hide button, so you can check what you typed. */
const PasswordInput = (props: InputHTMLAttributes<HTMLInputElement>) => {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-field">
      <input {...props} className="field" type={show ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} />
      <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  );
};
import { account, api, localBackup, redeemCode, renameAccount, restoreLocalBackup, signIn, signOut, signUp, subscribeAccount, type AccountState } from '../net/account';

/** Sign in or create an account; once signed in, your account details, password, email and gift codes. */
export const AccountPanel = ({ onClose }: { onClose: () => void }) => {
  const [st, setSt] = useState<AccountState>(account);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [code, setCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  useEffect(() => subscribeAccount(setSt), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === 'in' ? await signIn(login.trim(), password) : await signUp(login.trim(), password, email.trim());
    setBusy(false);
    if (err) setError(err);
    else setPassword('');
  };

  const u = st.user;
  const backup = localBackup();

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Account" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-card account-card">
        <div className="acc-head">
          <h2>{u ? u.name : mode === 'in' ? 'Sign in' : 'Create an account'}</h2>
          <button className="chip" onClick={onClose}>
            Close
          </button>
        </div>

        {!u && (
          <>
            <p className="set-hint">Save your progress online, play on any computer with it, and add friends by username.</p>
            <div className="set-tabs">
              <button className={`set-tab ${mode === 'in' ? 'on' : ''}`} onClick={() => setMode('in')}>
                Sign in
              </button>
              <button className={`set-tab ${mode === 'up' ? 'on' : ''}`} onClick={() => setMode('up')}>
                Create account
              </button>
            </div>
            <form className="acc-form" onSubmit={submit}>
              <label>
                <span>{mode === 'in' ? 'Username or email' : 'Username'}</span>
                <input className="field" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} maxLength={mode === 'up' ? 16 : 120} required />
              </label>
              <label>
                <span>Password</span>
                <PasswordInput autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'up' ? 6 : 1} required />
              </label>
              {mode === 'up' && (
                <label>
                  <span>
                    Email <small>(optional, for getting back into your account)</small>
                  </span>
                  <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
              )}
              {mode === 'up' && <p className="set-hint">3 to 16 letters, numbers or _. Everyone sees your username, so don’t use your real name.</p>}
              {error && (
                <p className="acc-error" role="alert">
                  {error}
                </p>
              )}
              <button className="play" disabled={busy}>
                {busy ? 'One moment…' : mode === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
              {mode === 'in' && <p className="set-hint">Forgot your password? Ask the admin to reset it for you.</p>}
              {mode === 'up' && <p className="set-hint">Your progress on this computer moves into the new account.</p>}
            </form>
          </>
        )}

        {u && (
          <div className="acc-body">
            <dl className="pc-facts">
              <div>
                <dt>Username</dt>
                <dd>{u.name}</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>{u.role === 'admin' ? 'Admin' : u.role === 'mod' ? 'Moderator' : 'Player'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{u.email ?? 'None'}</dd>
              </div>
              <div>
                <dt>Cloud save</dt>
                <dd>{st.savedAt ? `Saved ${new Date(st.savedAt).toLocaleTimeString()}` : 'Up to date'}</dd>
              </div>
            </dl>
            {u.mutedUntil > 0 && <p className="acc-error">Chat is muted until {new Date(u.mutedUntil).toLocaleString()}.</p>}

            <h3>Change username</h3>
            <form
              className="acc-row"
              onSubmit={async (e) => {
                e.preventDefault();
                const err = await renameAccount(newName.trim());
                setMsg(err ?? `Your username is now ${newName.trim()}`);
                if (!err) setNewName('');
              }}
            >
              <input className="field" placeholder={u.name} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={16} aria-label="New username" />
              <button className="chip" disabled={newName.trim().length < 3}>
                Change
              </button>
            </form>
            <p className="set-hint">3 to 16 letters, numbers or _. You can change it once a week.</p>

            <h3>Redeem a code</h3>
            <form
              className="acc-row"
              onSubmit={async (e) => {
                e.preventDefault();
                setMsg(await redeemCode(code));
                setCode('');
              }}
            >
              <input className="field" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={16} />
              <button className="chip" disabled={!code}>
                Redeem
              </button>
            </form>

            <h3>Email</h3>
            <form
              className="acc-row"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await api('account/email', { body: { email: newEmail } });
                setMsg(r.ok ? 'Email saved' : (r.data.error ?? 'Could not save'));
              }}
            >
              <input className="field" type="email" placeholder={u.email ?? 'you@example.com'} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <button className="chip">{newEmail ? 'Save' : 'Remove'}</button>
            </form>

            <h3>Change password</h3>
            <form
              className="acc-row"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await api('account/password', { body: { old: oldPw, password: newPw } });
                setMsg(r.ok ? 'Password changed' : (r.data.error ?? 'Could not change it'));
                if (r.ok) setOldPw(''), setNewPw('');
              }}
            >
              <PasswordInput autoComplete="current-password" placeholder="Current" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
              <PasswordInput autoComplete="new-password" placeholder="New (6+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <button className="chip" disabled={!oldPw || newPw.length < 6}>
                Change
              </button>
            </form>

            {backup && (
              <>
                <h3>This computer’s old progress</h3>
                <p className="set-hint">When you signed in, your account’s progress replaced what this computer had ({new Date(backup.at).toLocaleString()}). If that was the one you wanted, bring it back.</p>
                <button
                  className="chip"
                  onClick={() => {
                    if (window.confirm('Replace your account progress with what this computer had before you signed in?')) {
                      restoreLocalBackup();
                      setMsg('Restored');
                    }
                  }}
                >
                  Use this computer’s progress
                </button>
              </>
            )}

            {msg && (
              <p className="set-hint" role="status">
                {msg}
              </p>
            )}
            <div className="acc-foot">
              <button className="chip" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
