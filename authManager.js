/**
 * authManager.js — Citizen Science Species Log
 * ==============================================
 * Handles user registration, login, sessions, roles,
 * and the admin control panel.
 *
 * DESIGN RULES:
 *  - Does NOT modify any existing function in script.js
 *  - Uses its own localStorage keys (no collision)
 *  - Exposes window.Auth for script.js to call
 *  - Injects auth UI into the existing authGate div
 *
 * Roles: user | admin | super_admin
 * Super-admin "samadhan/samadhan" is auto-seeded on first load.
 */

(function () {
  'use strict';

  /* ── Storage keys (MUST match script.js auth constants) ──── */
  // These MUST stay in sync with AUTH_USERS_KEY, AUTH_SESSION_KEY in script.js
  const USERS_KEY   = 'biodiversity_users';          // matches AUTH_USERS_KEY
  const SESSION_KEY = 'biodiversity_current_user';   // matches AUTH_SESSION_KEY
  const SIGHTINGS_KEY = 'biodiversity_all_sightings'; // matches AUTH_ALL_SIGHTINGS_KEY

  /* ── Helpers ──────────────────────────────── */
  function uid() {
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escH(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── User store ───────────────────────────── */
  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
    catch { return []; }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  /* ── Session ──────────────────────────────── */
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function saveSession(user) {
    if (user) {
      const safe = { id: user.id, username: user.username, role: user.role };
      localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  /* ── Bootstrap super-admin ────────────────── */
  function ensureSuperAdmin() {
    const users = loadUsers();
    if (!users.find(u => u.username === 'samadhan')) {
      users.unshift({
        id: 'samadhan-root',
        username: 'samadhan',
        password: 'samadhan',
        role: 'super_admin',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isActive: true
      });
      saveUsers(users);
    }
  }

  /* ── Role utilities ───────────────────────── */
  function isAdmin(user) {
    return user && (user.role === 'admin' || user.role === 'super_admin');
  }

  function roleBadge(role) {
    const map = {
      super_admin: { label: 'Super Admin', cls: 'role-super' },
      admin:       { label: 'Admin',       cls: 'role-admin'  },
      user:        { label: 'User',        cls: 'role-user'   }
    };
    const r = map[role] || map.user;
    return `<span class="role-badge ${r.cls}">${r.label}</span>`;
  }

  /* ── Auth operations ──────────────────────── */
  function register(username, password) {
    if (!username || !password) return { ok: false, msg: 'Username and password are required.' };
    if (username.length < 3)   return { ok: false, msg: 'Username must be at least 3 characters.' };
    if (password.length < 4)   return { ok: false, msg: 'Password must be at least 4 characters.' };
    if (username.toLowerCase() === 'samadhan') return { ok: false, msg: 'This username is reserved.' };

    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, msg: 'Username already taken. Please choose another.' };
    }

    const newUser = {
      id: uid(),
      username,
      password,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      isActive: true
    };
    users.push(newUser);
    saveUsers(users);
    saveSession(newUser);
    return { ok: true, user: newUser };
  }

  function login(username, password) {
    if (!username || !password) return { ok: false, msg: 'Enter your username and password.' };
    // Hard-coded super-admin bypass (matches script.js AUTH_ADMIN)
    if (username.toLowerCase() === 'samadhan' && (password === 'samadhan' || password === 'Samadhan@123')) {
      const adminUser = { id: 'samadhan-root', username: 'samadhan', role: 'super_admin',
        createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(), isActive: true };
      saveSession(adminUser);
      return { ok: true, user: adminUser };
    }
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return { ok: false, msg: 'Incorrect username or password.' };
    if (user.isActive === false) return { ok: false, msg: 'Account disabled. Contact admin.' };
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    saveSession(user);
    return { ok: true, user };
  }

  function logout() {
    saveSession(null);
  }

  /* ── Sighting ownership helpers ───────────── */
  /**
   * Returns only the sightings the current user is allowed to see.
   * Admins see everything. Regular users see only their own.
   * Old sightings with no userId are assigned to samadhan-root.
   */
  function filterSightings(allSightings, currentUser) {
    if (!currentUser) return [];
    if (isAdmin(currentUser)) return allSightings;
    return allSightings.filter(s => {
      // Treat legacy (no userId) as belonging to samadhan-root
      const owner = s.userId || 'samadhan-root';
      return owner === currentUser.id;
    });
  }

  /**
   * Attach ownership fields to a new sighting before saving.
   */
  function stampSighting(sighting, currentUser) {
    return {
      ...sighting,
      userId:   currentUser.id,
      username: currentUser.username,
      userRole: currentUser.role
    };
  }

  /* ────────────────────────────────────────────
     AUTH GATE UI
     Rendered inside the existing #authGate div.
  ─────────────────────────────────────────────── */
  function renderAuthGate(mode = 'login') {
    const gate = document.getElementById('authGate');
    if (!gate) return;

    gate.innerHTML = `
      <form id="authForm" class="auth-card" autocomplete="off">
        <div class="auth-brand">
          <span class="auth-sdg-pill">SDG 15</span>
          <h1 class="auth-title">BioDiversity Log</h1>
          <p class="auth-sub">Secure citizen science platform</p>
        </div>

        <div class="auth-tabs" role="tablist">
          <button type="button" id="authLoginTab"
            class="${mode === 'login' ? 'active' : ''}"
            role="tab" aria-selected="${mode === 'login'}">Login</button>
          <button type="button" id="authRegisterTab"
            class="${mode === 'register' ? 'active' : ''}"
            role="tab" aria-selected="${mode === 'register'}">Register</button>
        </div>

        <div class="auth-field">
          <label for="authUsername">Username</label>
          <input id="authUsername" type="text" autocomplete="username"
            placeholder="Enter username" required />
        </div>
        <div class="auth-field">
          <label for="authPassword">Password</label>
          <input id="authPassword" type="password" autocomplete="current-password"
            placeholder="Enter password" required />
        </div>

        <p id="authError" class="auth-error" role="alert"></p>

        <button id="authSubmit" class="btn auth-primary" type="submit">
          ${mode === 'login' ? '🔐 Login' : '📝 Create Account'}
        </button>

        <p class="auth-hint">
          ${mode === 'login'
            ? 'New here? <button type="button" id="switchToRegister" class="auth-link">Create account</button>'
            : 'Already have one? <button type="button" id="switchToLogin" class="auth-link">Login</button>'}
        </p>
      </form>
    `;

    /* Wire tab switches */
    document.getElementById('authLoginTab')?.addEventListener('click', () => renderAuthGate('login'));
    document.getElementById('authRegisterTab')?.addEventListener('click', () => renderAuthGate('register'));
    document.getElementById('switchToRegister')?.addEventListener('click', () => renderAuthGate('register'));
    document.getElementById('switchToLogin')?.addEventListener('click', () => renderAuthGate('login'));

    /* Wire form submit */
    document.getElementById('authForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('authUsername').value.trim();
      const password = document.getElementById('authPassword').value;
      const errorEl  = document.getElementById('authError');
      const result   = (mode === 'register') ? register(username, password) : login(username, password);
      if (!result.ok) {
        errorEl.textContent = result.msg;
        return;
      }
      errorEl.textContent = '';
      hideAuthGate();
      initSessionBar(result.user);
      if (typeof window.__onAuthSuccess === 'function') window.__onAuthSuccess(result.user);
    });
  }

  function hideAuthGate() {
    const gate = document.getElementById('authGate');
    if (gate) gate.style.display = 'none';
  }

  function showAuthGate(mode = 'login') {
    const gate = document.getElementById('authGate');
    if (gate) gate.style.display = '';
    renderAuthGate(mode);
  }

  /* ────────────────────────────────────────────
     SESSION BAR — floating badge (bottom-right)
  ─────────────────────────────────────────────── */
  function initSessionBar(user) {
    const bar = document.getElementById('authSessionBar');
    if (!bar) return;

    bar.style.display = 'flex';

    const nameEl = document.getElementById('authSessionName');
    if (nameEl) {
      nameEl.innerHTML = `${escH(user.username)} ${roleBadge(user.role)}`;
    }

    /* Admin: show user count + filter select */
    const countEl = document.getElementById('authUserCount');
    const filterEl = document.getElementById('adminUserFilter');
    if (isAdmin(user)) {
      const users = loadUsers();
      if (countEl) {
        countEl.hidden = false;
        countEl.textContent = `${users.length} users`;
      }
      if (filterEl) {
        filterEl.hidden = false;
        filterEl.innerHTML = '<option value="">All Users</option>' +
          users.map(u => `<option value="${escH(u.id)}">${escH(u.username)}</option>`).join('');
        filterEl.addEventListener('change', () => {
          if (typeof window.__onAdminFilterChange === 'function') {
            window.__onAdminFilterChange(filterEl.value);
          }
        });
      }
      /* Show admin panel nav tab */
      const adminTab = document.getElementById('adminNavTab');
      if (adminTab) adminTab.style.display = '';
    } else {
      if (countEl) countEl.hidden = true;
      if (filterEl) filterEl.hidden = true;
      const adminTab = document.getElementById('adminNavTab');
      if (adminTab) adminTab.style.display = 'none';
    }

    /* Logout button */
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        logout();
        bar.style.display = 'none';
        const adminTab = document.getElementById('adminNavTab');
        if (adminTab) adminTab.style.display = 'none';
        showAuthGate('login');
      };
    }
  }

  /* ────────────────────────────────────────────
     ADMIN PANEL RENDERING
  ─────────────────────────────────────────────── */
  function renderAdminPanel() {
    const panel = document.getElementById('adminPanelContent');
    if (!panel) return;

    const currentUser = loadSession();
    if (!currentUser || !isAdmin(currentUser)) {
      panel.innerHTML = '<p class="admin-denied">Access denied. Admins only.</p>';
      return;
    }

    const users = loadUsers();
    // Read all sightings from the key used by script.js auth layer
    const allSightings = (function () {
      try {
        const raw = localStorage.getItem(SIGHTINGS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.data) ? parsed.data : []);
      } catch { return []; }
    })();

    const sightingCountByUser = allSightings.reduce((acc, s) => {
      const owner = s.userId || 'samadhan-root';
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {});

    panel.innerHTML = `
      <div class="admin-panel-inner">
        <h2 class="admin-title">👑 Admin Control Panel</h2>
        <p class="admin-subtitle">
          Logged in as <strong>${escH(currentUser.username)}</strong> (${escH(currentUser.role)})
          &nbsp;·&nbsp; ${users.length} registered users
          &nbsp;·&nbsp; ${allSightings.length} total sightings
        </p>

        <div class="admin-search-row">
          <input id="adminUserSearch" class="admin-search-input"
            type="text" placeholder="Search users by name..." />
        </div>

        <div class="table-wrapper">
          <table class="admin-table" id="adminUserTable">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Sightings</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="adminUserTableBody">
              ${users.map(u => renderAdminUserRow(u, sightingCountByUser, currentUser)).join('')}
            </tbody>
          </table>
        </div>

        <h3 class="admin-subtitle" style="margin-top:1.5rem">📋 Sightings Ownership Log</h3>
        <div class="table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Species</th>
                <th>Location</th>
                <th>Date</th>
                <th>Added By</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              ${allSightings.slice(0, 50).map(s => `
                <tr>
                  <td>${escH(s.species)}</td>
                  <td>${escH(s.location)}</td>
                  <td>${escH(s.date)}</td>
                  <td>${escH(s.username || 'samadhan')}</td>
                  <td>${roleBadge(s.userRole || 'super_admin')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    /* Search/filter user table */
    document.getElementById('adminUserSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#adminUserTableBody tr').forEach(row => {
        row.style.display = row.dataset.username?.includes(q) ? '' : 'none';
      });
    });

    /* Action buttons (promote / demote / delete) */
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-admin-action]');
      if (!btn) return;
      const action = btn.dataset.adminAction;
      const targetId = btn.dataset.userId;
      handleAdminAction(action, targetId);
    });
  }

  function renderAdminUserRow(u, counts, currentUser) {
    const count = counts[u.id] || 0;
    const isSelf = u.id === currentUser.id;
    const isSuperTarget = u.role === 'super_admin';
    return `
      <tr data-username="${escH(u.username.toLowerCase())}">
        <td><strong>${escH(u.username)}</strong></td>
        <td>${roleBadge(u.role)}</td>
        <td>${count}</td>
        <td>${u.createdAt ? u.createdAt.slice(0, 10) : '—'}</td>
        <td>${u.lastLogin ? u.lastLogin.slice(0, 10) : 'Never'}</td>
        <td>${u.isActive !== false ? '<span class="status-active">Active</span>' : '<span class="status-inactive">Disabled</span>'}</td>
        <td class="admin-actions">
          ${!isSelf && !isSuperTarget && u.role === 'user'
            ? `<button class="btn btn-secondary small" data-admin-action="promote" data-user-id="${escH(u.id)}">Make Admin</button>`
            : ''}
          ${!isSelf && !isSuperTarget && u.role === 'admin'
            ? `<button class="btn btn-secondary small" data-admin-action="demote" data-user-id="${escH(u.id)}">Remove Admin</button>`
            : ''}
          ${!isSelf && !isSuperTarget
            ? `<button class="btn btn-danger small" data-admin-action="delete" data-user-id="${escH(u.id)}">Delete</button>`
            : '<em style="opacity:.5">—</em>'}
        </td>
      </tr>
    `;
  }

  function handleAdminAction(action, targetId) {
    const users = loadUsers();
    const idx = users.findIndex(u => u.id === targetId);
    if (idx === -1) return;
    const target = users[idx];

    if (action === 'promote') {
      target.role = 'admin';
      saveUsers(users);
      renderAdminPanel();
    } else if (action === 'demote') {
      target.role = 'user';
      saveUsers(users);
      renderAdminPanel();
    } else if (action === 'delete') {
      if (!confirm(`Delete user "${target.username}"? Their sightings will remain.`)) return;
      users.splice(idx, 1);
      saveUsers(users);
      renderAdminPanel();
    }
  }

  /* ── Public API ───────────────────────────── */
  window.Auth = {
    /* Called by script.js on page load */
    boot() {
      ensureSuperAdmin();
      const session = loadSession();
      if (session) {
        hideAuthGate();
        initSessionBar(session);
        return session;           // already logged in
      }
      showAuthGate('login');
      return null;
    },

    currentUser()      { return loadSession(); },
    isAdmin(u)         { return isAdmin(u || loadSession()); },
    filterSightings,
    stampSighting,
    renderAdminPanel,
    roleBadge,
    loadUsers,
    saveUsers,
    logout() {
      logout();
      const bar = document.getElementById('authSessionBar');
      if (bar) bar.style.display = 'none';
      showAuthGate('login');
    }
  };

})();
