(function () {
  'use strict';

  const SESSION_KEY = 'learnvault_focus_session_v2';
  const VIOLATIONS_KEY = 'learnvault_focus_violations_v2';
  const INTERNAL_NAV_KEY = 'learnvault_focus_internal_navigation_until';
  const isStudentPage = /\/student\//i.test(window.location.pathname);
  if (!isStudentPage) return;

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  };
  const getSession = () => readJSON(SESSION_KEY, null);
  const saveSession = (value) => {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (_) {}
  };
  const getViolations = () => readJSON(VIOLATIONS_KEY, []);
  const setInternalNavigationIntent = () => {
    try { sessionStorage.setItem(INTERNAL_NAV_KEY, String(Date.now() + 2500)); } catch (_) {}
  };
  const hasRecentInternalNavigation = () => {
    try {
      const until = Number(sessionStorage.getItem(INTERNAL_NAV_KEY) || 0);
      if (until >= Date.now()) return true;
      sessionStorage.removeItem(INTERNAL_NAV_KEY);
    } catch (_) {}
    return false;
  };

  let session = getSession();
  let timer = null;
  let toastTimer = null;
  let hiddenEpisodeHandled = false;
  let violationEmailSent = false;
  const MAX_VIOLATIONS = 3;

  function injectStyles() {
    if (document.getElementById('lvFocusStyles')) return;
    const style = document.createElement('style');
    style.id = 'lvFocusStyles';
    style.textContent = `
      #lvFocusSetup{position:fixed;inset:0;z-index:99990;background:rgba(7,10,24,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}
      #lvFocusSetup.hidden{display:none}
      .lv-focus-card{width:min(520px,100%);background:#11182f;color:#fff;border:1px solid rgba(130,145,255,.35);border-radius:20px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.45)}
      .lv-focus-card h2{margin:0 0 8px}.lv-focus-card p{color:#b9c2df;line-height:1.5}
      .lv-focus-duration{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
      .lv-focus-duration button{border:1px solid #5965a8;background:#1a2343;color:#fff;border-radius:10px;padding:10px 14px;cursor:pointer}
      .lv-focus-duration button.active{background:#625cff;border-color:#817dff}
      .lv-focus-custom{display:flex;gap:8px;align-items:center;margin:10px 0 18px;flex-wrap:wrap}
      .lv-focus-custom input{width:90px;padding:10px;border-radius:9px;border:1px solid #5965a8;background:#0c1227;color:#fff}
      .lv-focus-start{width:100%;padding:13px;border:0;border-radius:11px;background:#625cff;color:#fff;font-weight:800;cursor:pointer}
      .lv-focus-bar{position:fixed;top:0;left:0;right:0;z-index:100100;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;padding:8px 14px;background:#11182f;color:#fff;border-bottom:1px solid rgba(130,145,255,.35);font-size:13px;box-sizing:border-box;min-height:42px}
      body.lv-focus-active{padding-top:42px!important}
      body.lv-focus-active header.topbar,body.lv-focus-active .topbar,body.lv-focus-active .site-header,body.lv-focus-active .student-header{position:sticky!important;top:42px!important;z-index:100000!important;visibility:visible!important;display:flex!important}
      body.lv-focus-active .sidebar,body.lv-focus-active nav{scroll-margin-top:54px}
      body.lv-focus-active{--lv-focus-header-offset:42px}
      .lv-focus-bar strong{color:#aeb8ff}.lv-focus-end{border:0;border-radius:8px;padding:5px 9px;background:#2a345c;color:#fff;cursor:pointer}
      .lv-focus-toast{position:fixed;top:55px;right:18px;z-index:99999;background:#8b1e3f;color:#fff;padding:11px 15px;border-radius:10px;font-weight:700;display:none;box-shadow:0 8px 25px rgba(0,0,0,.35);max-width:min(420px,calc(100vw - 36px))}
      @media(max-width:520px){.lv-focus-bar{gap:7px;padding:7px;font-size:11px}.lv-focus-toast{left:12px;right:12px;top:52px}}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    let toast = document.getElementById('lvFocusToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lvFocusToast';
      toast.className = 'lv-focus-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2800);
  }

  async function recordViolation(message) {
    if (!session || session.violationCount >= MAX_VIOLATIONS) return;
    session.violationCount = (session.violationCount || 0) + 1;
    saveSession(session);
    const history = getViolations();
    const safeHistory = Array.isArray(history) ? history : [];
    safeHistory.push({ at: new Date().toISOString(), message });
    try { localStorage.setItem(VIOLATIONS_KEY, JSON.stringify(safeHistory.slice(-100))); } catch (_) {}
    updateBar();
    showToast(`Focus reminder (${session.violationCount}/${MAX_VIOLATIONS}): ` + message);
    if (session.violationCount >= MAX_VIOLATIONS && !violationEmailSent) {
      violationEmailSent = true;
      try {
        const response = await fetch('/api/focus/violation-alert', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ violationCount: session.violationCount, durationMinutes: session.durationMinutes })
        });
        if (!response.ok) throw new Error('Email alert could not be confirmed');
        showToast('Three Focus Mode violations reached. An email alert was sent. Focus Mode has ended.');
      } catch (error) {
        showToast('Three violations reached. Email alert could not be sent; check email settings.');
      }
      finish(false);
    }
  }

  function updateBar() {
    const bar = document.getElementById('lvFocusBar');
    if (!bar || !session) return;
    const secondsLeft = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const clock = bar.querySelector('#lvFocusClock');
    const count = bar.querySelector('#lvFocusViolationCount');
    if (clock) clock.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} remaining`;
    if (count) count.textContent = `Violations: ${session.violationCount || 0}`;
  }

  function finish(completed) {
    if (timer) clearInterval(timer);
    timer = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    document.getElementById('lvFocusBar')?.remove();
    document.body.classList.remove('lv-focus-active');
    session = null;
    if (completed) showToast('Focus session completed. Great work!');
  }

  function start(minutes) {
    const now = Date.now();
    session = { startedAt: now, endsAt: now + minutes * 60000, durationMinutes: minutes, violationCount: 0 };
    violationEmailSent = false;
    saveSession(session);
    document.body.classList.add('lv-focus-active');
    renderBar();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (!session) return;
      if (Date.now() >= session.endsAt) finish(true);
      else updateBar();
    }, 1000);
    // Prevent a refresh from reopening the login-only setup prompt.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('login');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function renderBar() {
    let bar = document.getElementById('lvFocusBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'lvFocusBar';
      bar.className = 'lv-focus-bar';
      bar.innerHTML = '<strong>🔒 Focus Mode</strong><span id="lvFocusClock"></span><span id="lvFocusViolationCount"></span><button type="button" class="lv-focus-end" id="lvFocusEnd">End Focus</button>';
      document.body.appendChild(bar);
      document.body.classList.add('lv-focus-active');
      bar.querySelector('#lvFocusEnd').addEventListener('click', () => finish(false));
    }
    updateBar();
  }

  function showSetup() {
    if (document.getElementById('lvFocusSetup')) return;
    const overlay = document.createElement('div');
    overlay.id = 'lvFocusSetup';
    overlay.innerHTML = '<div class="lv-focus-card"><h2>🎯 Start Focus Mode</h2><p>Choose a study duration. You can use all LearnVault pages during the session. Moving between LearnVault pages will not count as a violation.</p><div class="lv-focus-duration"><button type="button" data-min="15">15 min</button><button type="button" data-min="25" class="active">25 min</button><button type="button" data-min="45">45 min</button><button type="button" data-min="60">60 min</button></div><div class="lv-focus-custom"><span>Custom:</span><input id="lvFocusCustom" type="number" min="1" max="240" placeholder="minutes"><span>minutes</span></div><button type="button" class="lv-focus-start" id="lvFocusStart">Start Focus Mode</button></div>';
    document.body.appendChild(overlay);
    let selected = 25;
    overlay.querySelectorAll('[data-min]').forEach((button) => {
      button.addEventListener('click', () => {
        overlay.querySelectorAll('[data-min]').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        selected = Number(button.dataset.min);
        overlay.querySelector('#lvFocusCustom').value = '';
      });
    });
    overlay.querySelector('#lvFocusStart').addEventListener('click', () => {
      const custom = Number(overlay.querySelector('#lvFocusCustom').value);
      start(custom > 0 ? Math.min(custom, 240) : selected);
      overlay.remove();
    });
  }

  function isInternalNavigationLink(link) {
    if (!link || link.hasAttribute('download')) return false;
    if (link.target && link.target.toLowerCase() !== '_self') return false;
    const rawHref = link.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;
    try {
      const target = new URL(rawHref, window.location.href);
      if (target.origin !== window.location.origin) return false;
      return target.pathname !== window.location.pathname || target.search !== window.location.search;
    } catch (_) { return false; }
  }

  // Keep the site header visible and allow normal same-site navigation.
  // External links are blocked during Focus Mode and count as a violation.
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href]');
    if (!session || !link || link.hasAttribute('download')) return;
    let target;
    try { target = new URL(link.getAttribute('href'), window.location.href); } catch (_) { return; }
    if (target.origin !== window.location.origin) {
      event.preventDefault();
      event.stopImmediatePropagation();
      recordViolation('Attempted to open an external website during Focus Mode');
      return;
    }
    if (isInternalNavigationLink(link)) setInternalNavigationIntent();
  }, true);

  // Browsers do not allow websites to fully prevent tab/app switching. Warn on leaving the page.
  window.addEventListener('beforeunload', (event) => {
    if (!session || Date.now() >= session.endsAt || hasRecentInternalNavigation()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const action = form.getAttribute('action') || window.location.href;
    try {
      const target = new URL(action, window.location.href);
      if (target.origin === window.location.origin && (!form.target || form.target === '_self')) setInternalNavigationIntent();
    } catch (_) {}
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (!session || Date.now() >= session.endsAt) return;
    if (!document.hidden) {
      hiddenEpisodeHandled = false;
      return;
    }
    if (hiddenEpisodeHandled || hasRecentInternalNavigation()) return;
    hiddenEpisodeHandled = true;
    recordViolation('You switched away from the LearnVault tab');
  });

  function restore() {
    if (session && Date.now() >= session.endsAt) {
      finish(true);
      return;
    }
    if (session) {
      document.body.classList.add('lv-focus-active');
      renderBar();
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (!session) return;
        if (Date.now() >= session.endsAt) finish(true);
        else updateBar();
      }, 1000);
      return;
    }
    if (new URLSearchParams(window.location.search).get('login') === '1') showSetup();
  }

  injectStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, { once: true });
  else restore();
})();
