/**
 * authManager.js — Citizen Science Species Log
 * ==============================================
 * Handles user registration, login, sessions, roles,
 * and the admin control panel.
 *
 * Now uses REST API for authentication instead of localStorage.
 * DESIGN RULES:
 *  - Does NOT modify any existing function in script.js
 *  - Uses its own localStorage keys (no collision)
 *  - Exposes window.Auth for script.js to call
 *  - Injects auth UI into the existing authGate div
 *
 * Roles: user | admin | super_admin
 */

(function () {
  'use strict';

  /* ── API Configuration ───────────────────── */
  const API_BASE = 'http://localhost:3001/api/auth';

  /* ── Storage keys ─────────────────────────── */
  const TOKEN_KEY = 'authToken';
  const USER_KEY = 'currentUser';

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

  /* ── API Request Helper ───────────────────── */
  async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const config = { ...defaultOptions, ...options };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[Auth] API request failed:`, error);
      throw error;
    }
  }

  /* ── Session Management ───────────────────── */
  function loadSession() {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return { token, user };
    } catch {
      return { token: null, user: null };
    }
  }

  function saveSession(token, user) {
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
  async function register(username, password) {
    try {
      const response = await apiRequest('/register', {
        method: 'POST',
        body: { username, password }
      });

      saveSession(response.token, response.user);
      return { ok: true, msg: response.message, user: response.user };
    } catch (error) {
      return { ok: false, msg: error.message };
    }
  }

  async function login(username, password) {
    try {
      const response = await apiRequest('/login', {
        method: 'POST',
        body: { username, password }
      });

      saveSession(response.token, response.user);
      return { ok: true, msg: response.message, user: response.user };
    } catch (error) {
      return { ok: false, msg: error.message };
    }
  }

  async function logout() {
    clearSession();
    return { ok: true, msg: 'Logged out successfully' };
  }

  async function getProfile() {
    try {
      const response = await apiRequest('/profile');
      return { ok: true, user: response.user };
    } catch (error) {
      return { ok: false, msg: error.message };
    }
  }

  async function getAllUsers() {
    try {
      const response = await apiRequest('/users');
      return { ok: true, users: response.users };
    } catch (error) {
      return { ok: false, msg: error.message };
    }
  }

  /* ── UI Management ────────────────────────── */
  function showAuthUI() {
    const gate = document.getElementById('authGate');
    if (!gate) return;

    gate.innerHTML = `
      <div class="auth-container">
        <div class="auth-brand">
          <span class="auth-sdg-pill">SDG 15</span>
          <h1 class="auth-title">BioDiversity Log</h1>
          <p class="auth-sub">Secure citizen science platform</p>
        </div>

        <div class="auth-tabs">
          <button id="loginTab" class="auth-tab active">Login</button>
          <button id="registerTab" class="auth-tab">Register</button>
        </div>

        <div id="loginForm" class="auth-form active">
          <h2>Login to Citizen Science</h2>
          <form id="loginFormElement">
            <div class="form-group">
              <label for="loginUsername">Username:</label>
              <input type="text" id="loginUsername" required minlength="3">
            </div>
            <div class="form-group">
              <label for="loginPassword">Password:</label>
              <input type="password" id="loginPassword" required minlength="4">
            </div>
            <button type="submit" class="auth-submit">Login</button>
          </form>
        </div>

        <div id="registerForm" class="auth-form">
          <h2>Join Citizen Science</h2>
          <form id="registerFormElement">
            <div class="form-group">
              <label for="registerUsername">Username:</label>
              <input type="text" id="registerUsername" required minlength="3">
            </div>
            <div class="form-group">
              <label for="registerPassword">Password:</label>
              <input type="password" id="registerPassword" required minlength="4">
            </div>
            <button type="submit" class="auth-submit">Register</button>
          </form>
        </div>

        <div id="authMessage" class="auth-message"></div>
      </div>
    `;

    // Tab switching
    document.getElementById('loginTab').addEventListener('click', () => {
      document.getElementById('loginTab').classList.add('active');
      document.getElementById('registerTab').classList.remove('active');
      document.getElementById('loginForm').classList.add('active');
      document.getElementById('registerForm').classList.remove('active');
    });

    document.getElementById('registerTab').addEventListener('click', () => {
      document.getElementById('registerTab').classList.add('active');
      document.getElementById('loginTab').classList.remove('active');
      document.getElementById('registerForm').classList.add('active');
      document.getElementById('loginForm').classList.remove('active');
    });

    // Form submissions
    document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      const result = await login(username, password);
      showAuthMessage(result.msg, result.ok);

      if (result.ok) {
        setTimeout(() => window.location.reload(), 1000);
      }
    });

    document.getElementById('registerFormElement').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value;
      const password = document.getElementById('registerPassword').value;

      const result = await register(username, password);
      showAuthMessage(result.msg, result.ok);

      if (result.ok) {
        setTimeout(() => window.location.reload(), 1000);
      }
    });
  }

  function showAuthMessage(message, isSuccess = false) {
    const msgEl = document.getElementById('authMessage');
    if (msgEl) {
      msgEl.textContent = message;
      msgEl.className = `auth-message ${isSuccess ? 'success' : 'error'}`;
      msgEl.style.display = 'block';
      setTimeout(() => msgEl.style.display = 'none', 5000);
    }
  }

  function showUserUI(user) {
    const gate = document.getElementById('authGate');
    if (!gate) return;

    gate.innerHTML = `
      <div class="user-info">
        <div class="user-header">
          <span class="welcome">Welcome, ${escH(user.username)}!</span>
          ${roleBadge(user.role)}
          <button id="logoutBtn" class="logout-btn">Logout</button>
        </div>
        ${isAdmin(user) ? `
          <div class="admin-controls">
            <button id="adminPanelBtn" class="admin-btn">Admin Panel</button>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await logout();
      window.location.reload();
    });

    if (isAdmin(user)) {
      document.getElementById('adminPanelBtn').addEventListener('click', () => {
        showAdminPanel();
      });
    }
  }

  function showAdminPanel() {
    // Create modal for admin panel
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content admin-modal">
        <div class="modal-header">
          <h2>Admin Panel</h2>
          <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
          <div id="adminContent">
            <p>Loading admin data...</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Load admin data
    loadAdminData();

    // Close modal
    modal.querySelector('.modal-close').addEventListener('click', (e) => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  async function loadAdminData() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    try {
      const result = await getAllUsers();
      if (!result.ok) {
        content.innerHTML = `<p class="error">${result.msg}</p>`;
        return;
      }

      const users = result.users;
      content.innerHTML = `
        <div class="admin-stats">
          <h3>System Statistics</h3>
          <p>Total Users: ${users.length}</p>
          <p>Active Users: ${users.filter(u => u.isActive).length}</p>
        </div>

        <div class="admin-users">
          <h3>User Management</h3>
          <div class="user-list">
            ${users.map(user => `
              <div class="user-item">
                <span>${escH(user.username)}</span>
                ${roleBadge(user.role)}
                <span class="user-status ${user.isActive ? 'active' : 'inactive'}">
                  ${user.isActive ? 'Active' : 'Inactive'}
                </span>
                <span class="user-date">Joined: ${new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `<p class="error">Failed to load admin data</p>`;
    }
  }

  /* ── Initialization ───────────────────────── */
  function init() {
    const { token, user } = loadSession();

    if (token && user) {
      showUserUI(user);
    } else {
      showAuthUI();
    }
  }

  // Expose public API
  window.Auth = {
    init,
    login,
    register,
    logout,
    getProfile,
    getAllUsers,
    isLoggedIn: () => !!loadSession().token,
    getCurrentUser: () => loadSession().user,
    isAdmin: (user) => isAdmin(user || loadSession().user)
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();