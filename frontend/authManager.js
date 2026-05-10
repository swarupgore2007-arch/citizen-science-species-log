/**
 * authManager.js — Citizen Science Species Log
 * ==============================================
 * Manages user authentication via REST API backend.
 * Handles registration, login, logout, and session management.
 */

(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ──────────────────────────────────────────────────────────
  //  CONFIGURATION
  // ──────────────────────────────────────────────────────────
  const TOKEN_KEY = 'token';
  const USER_KEY = 'currentUser';

  // ──────────────────────────────────────────────────────────
  //  UTILITIES
  // ──────────────────────────────────────────────────────────
  function isAdmin(user) {
    return user && (user.role === 'admin' || user.role === 'super_admin');
  }

  // ──────────────────────────────────────────────────────────
  //  API REQUEST HELPER
  // ──────────────────────────────────────────────────────────
  async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    };

    const config = { ...defaultOptions, ...options };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${window.API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));
    console.log("API response:", data);

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  }

  // ──────────────────────────────────────────────────────────
  //  SESSION MANAGEMENT
  // ──────────────────────────────────────────────────────────
  function saveSession(token, user) {
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  function getSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    return {
      token,
      user: user ? JSON.parse(user) : null
    };
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ──────────────────────────────────────────────────────────
  //  AUTH OPERATIONS
  // ──────────────────────────────────────────────────────────
  async function register(username, password, fullName) {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: { username, password, fullName }
    });
    saveSession(response.token, response.user);
    return response;
  }

  async function login(username, password) {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    saveSession(response.token, response.user);
    return response;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    // We keep USER_KEY as requested, but the app will treat the user as logged out
    window.location.reload();
  }

  // ──────────────────────────────────────────────────────────
  //  INITIALIZATION
  // ──────────────────────────────────────────────────────────
  // Expose public API
  window.Auth = {
    register,
    login,
    logout,
    isLoggedIn: () => !!localStorage.getItem('token'),
    getCurrentUser: () => {
      const user = localStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    },
    isAdmin: () => {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
      return isAdmin(user);
    }
  };
})();