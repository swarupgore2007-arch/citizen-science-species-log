/**
 * dataManager.js — Citizen Science Species Log
 * =============================================
 * Handles ALL data persistence for the platform.
 * Now uses REST API instead of localStorage for persistence.
 *
 * Beginner-friendly comments explain each function below.
 * Import this file BEFORE script.js in index.html.
 *
 * SDG 15 — Life on Land | Biodiversity Intelligence Platform
 */

// ============================================================
//  DATA MANAGER OBJECT
//  All data functions are namespaced under `DM` to avoid
//  conflicts with other scripts.
// ============================================================
const DM = {

  // API base URL
  apiBase: 'http://localhost:3001/api',

  // Data version — bump this if the schema changes in future
  version: '3.0',

  // ──────────────────────────────────────────────────────────
  //  GET AUTH TOKEN
  //  Retrieves JWT token from localStorage for API calls
  // ──────────────────────────────────────────────────────────
  getToken() {
    return localStorage.getItem('authToken');
  },

  // ──────────────────────────────────────────────────────────
  //  API REQUEST HELPER
  //  Makes authenticated API requests with error handling
  // ──────────────────────────────────────────────────────────
  async apiRequest(endpoint, options = {}) {
    const token = this.getToken();
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
      const response = await fetch(`${this.apiBase}${endpoint}`, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[DM] API request failed:`, error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  GENERATE UNIQUE ID
  //  Every sighting needs a unique ID so we can edit/delete
  //  the right record. We combine species name + timestamp.
  // ──────────────────────────────────────────────────────────
  generateId(speciesName = 'species') {
    // Sanitize species name and combine with high-res timestamp
    const safe = speciesName.replace(/\s+/g, '-').toLowerCase();
    return `${safe}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },

  // ──────────────────────────────────────────────────────────
  //  LOAD SIGHTINGS
  //  Fetches user's sightings from the API
  // ──────────────────────────────────────────────────────────
  async load() {
    try {
      const response = await this.apiRequest('/my-sightings');
      return response.sightings || [];
    } catch (error) {
      console.error('[DM] Load failed:', error);
      return [];
    }
  },

  // ──────────────────────────────────────────────────────────
  //  SAVE SIGHTING
  //  Saves a new sighting to the API
  // ──────────────────────────────────────────────────────────
  async saveSighting(sightingData) {
    try {
      const response = await this.apiRequest('/sightings', {
        method: 'POST',
        body: sightingData
      });
      return response.sighting;
    } catch (error) {
      console.error('[DM] Save sighting failed:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  UPDATE SIGHTING
  //  Updates an existing sighting via API
  // ──────────────────────────────────────────────────────────
  async updateSighting(id, updateData) {
    try {
      const response = await this.apiRequest(`/sightings/${id}`, {
        method: 'PUT',
        body: updateData
      });
      return response.sighting;
    } catch (error) {
      console.error('[DM] Update sighting failed:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  DELETE SIGHTING
  //  Deletes a sighting via API
  // ──────────────────────────────────────────────────────────
  async deleteSighting(id) {
    try {
      await this.apiRequest(`/sightings/${id}`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      console.error('[DM] Delete sighting failed:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  LOAD ALL SIGHTINGS (ADMIN)
  //  Fetches all users' sightings for admin view
  // ──────────────────────────────────────────────────────────
  async loadAllSightings() {
    try {
      const response = await this.apiRequest('/all-sightings');
      return response.sightings || [];
    } catch (error) {
      console.error('[DM] Load all sightings failed:', error);
      return [];
    }
  },

  // ──────────────────────────────────────────────────────────
  //  LEGACY SAVE (DEPRECATED)
  //  Kept for backward compatibility but now does nothing
  // ──────────────────────────────────────────────────────────
  save(sightings) {
    // Data is now saved to database via API
    // This method is kept for compatibility but does nothing
    console.warn('[DM] Legacy save() called - data is now saved via API');
    return true;
  },

  // ──────────────────────────────────────────────────────────
  //  MERGE (DEPRECATED)
  //  Kept for backward compatibility
  // ──────────────────────────────────────────────────────────
  merge(existing, incoming) {
    console.warn('[DM] merge() is deprecated - use API methods instead');
    return [...existing, ...incoming];
  }
};

// Expose the manager for script.js while keeping all methods namespaced.
window.DM = DM;
