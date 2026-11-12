(() => {
/**
 * auth.js — Autentikasi Supabase (login, daftar, sesi, guard)
 */

const Auth = (() => {
  let _client = null;
  let _refreshPromise = null;

  function config() {
    return window.SPPD_CONFIG || {};
  }

  function isConfigured() {
    const c = config();
    return !!(c.supabaseUrl && c.supabaseAnonKey);
  }

  function client() {
    if (!isConfigured()) return null;
    if (!_client) {
      _client = supabase.createClient(config().supabaseUrl, config().supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
    return _client;
  }

  function isJwtExpired(err) {
    if (!err) return false;
    const code = String(err.code || err.statusCode || err.status || '');
    const msg = String(err.message || err.error || err || '');
    return code === 'PGRST303' || /jwt expired|token is expired|invalid jwt/i.test(msg);
  }

  async function refreshSession() {
    const sb = client();
    if (!sb) return null;
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
      try {
        const { data, error } = await sb.auth.refreshSession();
        if (error || !data?.session) return null;
        return data.session;
      } catch {
        return null;
      } finally {
        _refreshPromise = null;
      }
    })();
    return _refreshPromise;
  }

  function friendlyError(err) {
    const msg = err?.message || String(err);
    const map = {
      'Invalid login credentials': 'Email atau kata sandi salah.',
      'Email not confirmed': 'Email belum dikonfirmasi. Periksa kotak masuk Anda.',
      'User already registered': 'Email sudah terdaftar. Silakan masuk.',
      'Password should be at least 6 characters': 'Kata sandi minimal 6 karakter.',
    };
    return map[msg] || msg;
  }

  async function getSession() {
    const sb = client();
    if (!sb) return null;
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) {
      if (isJwtExpired(error)) {
        const refreshed = await refreshSession();
        if (refreshed) return refreshed;
      }
      throw new Error(friendlyError(error));
    }
    return session;
  }

  async function getUser() {
    const session = await getSession();
    return session?.user ?? null;
  }

  async function signIn(email, password) {
    const sb = client();
    if (!sb) throw new Error('Supabase belum dikonfigurasi. Hubungi administrator.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyError(error));
    return data;
  }

  async function signUp(email, password, fullName) {
    const sb = client();
    if (!sb) throw new Error('Supabase belum dikonfigurasi. Hubungi administrator.');
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login.html`,
      },
    });
    if (error) throw new Error(friendlyError(error));
    const needsConfirmation = !data.session && data.user && !data.user.confirmed_at;
    return { ...data, needsConfirmation };
  }

  async function signOut() {
    const sb = client();
    if (!sb) {
      window.location.href = 'login.html';
      return;
    }
    await sb.auth.signOut();
    window.location.href = 'login.html';
  }

  async function resetPassword(email) {
    const sb = client();
    if (!sb) throw new Error('Supabase belum dikonfigurasi.');
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html`,
    });
    if (error) throw new Error(friendlyError(error));
  }

  /** Host lokal (dev) — di luar ini, config kosong berarti diblokir, bukan mode dev. */
  function isLocalHost() {
    const h = (window.location.hostname || '').toLowerCase();
    if (h === '' || h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  }

  /** Blokir akses ke index.html jika belum login */
  async function requireAuth() {
    if (!isConfigured()) {
      if (!isLocalHost()) {
        document.body.innerHTML =
          '<div style="max-width:520px;margin:15vh auto;padding:32px;text-align:center;font-family:system-ui,sans-serif">' +
          '<div>' + ic('lock', 40) + '</div>' +
          '<h2>Aplikasi belum dikonfigurasi</h2>' +
          '<p style="color:#666">SUPABASE_URL / SUPABASE_ANON_KEY belum diset di environment deploy. Hubungi administrator.</p></div>';
        throw new Error('Supabase belum dikonfigurasi.');
      }
      console.warn('[SPPD] Supabase tidak dikonfigurasi — akses tanpa login (mode dev).');
      return null;
    }
    const session = await getSession();
    if (!session) {
      window.location.replace('login.html');
      return null;
    }
    return session;
  }

  function displayName(user) {
    return user?.user_metadata?.full_name
      || user?.email?.split('@')[0]
      || 'Pengguna';
  }

  return {
    isConfigured,
    isLocalHost,
    isJwtExpired,
    getSession,
    refreshSession,
    getUser,
    signIn,
    signUp,
    signOut,
    resetPassword,
    requireAuth,
    displayName,
    client,
  };
})();

// Toast ringan (login.html & index.html)
function toast(msg, type = 'default', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: `${ic('check', 14)}`, error: `${ic('x', 14)}`, warning: `${ic('alert', 14)}`, default: `${ic('info', 14)}` };
  el.innerHTML = `<span>${icons[type] || icons.default}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ___ PUBLIC API (sengaja global; sisanya privat file ini) ___
Object.assign(globalThis, { Auth, toast });
})();
