import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {getHours} from './api.js';
import {duration, logtimePeriod, shiftMonth, today} from './stats.js';
import Scene from './Scene';

export default function App() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [login, setLogin] = useState('');
  const [submittedLogin, setSubmittedLogin] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hours, setHours] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loginInput = useRef<HTMLInputElement>(null);
  const {startDate, endDate} = logtimePeriod(month);

  useEffect(() => {
    setHours(null);
    setError('');
    if (!submittedLogin) { setBusy(false); return; }
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    getHours(submittedLogin, startDate, endDate, controller.signal)
      .then(value => { if (active) setHours(value); })
      .catch(reason => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [submittedLogin, startDate, endDate, attempt]);

  const editLogin = useCallback((value: string) => {
    setLogin(value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40));
    setError('');
    setHours(null);
    setSubmittedLogin(null);
  }, []);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!login || busy) return;
    setError('');
    setSubmittedLogin(login);
    setAttempt(value => value + 1);
  }

  const changeMonth = useCallback((offset: number) => {
    setHours(null);
    setMonth(value => shiftMonth(value, offset));
  }, []);
  const focusLogin = useCallback(() => loginInput.current?.focus({preventScroll: true}), []);

  // Keep keyboard entry available after clicking the scene or a month arrow.
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.target === loginInput.current || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Enter') { event.preventDefault(); submit(); focusLogin(); }
      else if (event.key === 'Backspace') {
        event.preventDefault(); editLogin(error ? '' : login.slice(0, -1)); focusLogin();
      } else if (/^[a-zA-Z0-9_-]$/.test(event.key)) {
        event.preventDefault(); editLogin((error ? '' : login) + event.key); focusLogin();
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  return <main className="crt-app">
    <Scene hours={hours} readout={hours === null ? '—' : String(Math.floor(hours))}
      month={month} login={login} loginError={!!error} busy={busy}
      onMonthChange={changeMonth} onLoginFocus={focusLogin}/>
    <form className="sr-only" onSubmit={submit} aria-label="Logtime controls">
      <button type="button" onClick={() => changeMonth(-1)}>Previous month</button>
      <output aria-live="polite">{month}: {startDate} through {endDate}</output>
      <button type="button" onClick={() => changeMonth(1)}>Next month</button>
      <label htmlFor="login">School login. Type your login and press Enter.</label>
      <input ref={loginInput} id="login" autoFocus value={login} autoComplete="off"
        autoCapitalize="none" spellCheck={false} maxLength={40}
        onChange={event => editLogin(event.target.value)}
        onKeyDown={event => {
          if (!error || event.ctrlKey || event.metaKey || event.altKey) return;
          if (/^[a-zA-Z0-9_-]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            editLogin(event.key.length === 1 ? event.key : '');
          }
        }}
        onPaste={event => {
          if (!error) return;
          event.preventDefault(); editLogin(event.clipboardData.getData('text'));
        }}/>
      <button type="submit" disabled={busy || !login}>Display logtime</button>
    </form>
    <span className="sr-only" role="status" aria-live="polite">
      {error ? `ERR: ${error}` : busy ? 'Loading logtime' : hours !== null ? duration(hours) : 'Type your login and press Enter'}
    </span>
  </main>;
}
