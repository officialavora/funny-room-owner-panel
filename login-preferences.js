// Store the auth session, never the password. Keep the existing SDK storage key.
export function createRememberStorage(host = globalThis) {
  const preferenceKey = 'funny-room-owner-remember';
  const memory = new Map();
  const read = (kind, key) => { try { return host[kind].getItem(key); } catch { return null; } };
  const remove = (kind, key) => { try { host[kind].removeItem(key); } catch {} };
  let remember = read('localStorage', preferenceKey) !== 'false';
  const storage = {
    getItem(key) { return read(remember ? 'localStorage' : 'sessionStorage', key) ?? memory.get(key) ?? null; },
    setItem(key, value) {
      remove(remember ? 'sessionStorage' : 'localStorage', key);
      try { host[remember ? 'localStorage' : 'sessionStorage'].setItem(key, value); memory.delete(key); }
      catch { memory.set(key, value); }
    },
    removeItem(key) { remove('localStorage', key); remove('sessionStorage', key); memory.delete(key); }
  };
  return {
    storage,
    get remember() { return remember; },
    setRemember(value) {
      remember = value === true;
      try { host.localStorage.setItem(preferenceKey, String(remember)); } catch {}
    }
  };
}

export function setupLoginControls(preferences, doc = document) {
  const password = doc.querySelector('#password');
  const toggle = doc.querySelector('#togglePassword');
  const remember = doc.querySelector('#rememberMe');
  const hide = () => { password.type = 'password'; toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-label', 'Show password'); };
  toggle.onclick = () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    password.focus({preventScroll:true});
  };
  remember.checked = preferences.remember;
  remember.onchange = () => preferences.setRemember(remember.checked);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) hide(); });
  return hide;
}
