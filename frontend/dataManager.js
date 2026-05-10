/**
 * dataManager.js — Citizen Science Species Log
 * =============================================
 * Manages all data operations via REST API backend.
 */
window.DM = {
  // ──────────────────────────────────────────────────────────
  //  API CONFIGURATION
  // ──────────────────────────────────────────────────────────
  tokenKey: 'token',

  // ──────────────────────────────────────────────────────────
  //  GET AUTH TOKEN
  //  Retrieves JWT token from localStorage
  // ──────────────────────────────────────────────────────────
  getToken() {
    return localStorage.getItem('token') || '';
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
        'Authorization': 'Bearer ' + this.getToken()
      }
    };

    const config = { ...defaultOptions, ...options };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${window.API_BASE}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));
      console.log("API response:", data);

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[DM] API request failed:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  LOAD USER'S SIGHTINGS
  //  Fetches all sightings for current user from database
  // ──────────────────────────────────────────────────────────
  async load() {
    const response = await this.apiRequest('/my-sightings');
    return response.sightings || [];
  },

  // ──────────────────────────────────────────────────────────
  //  GENERATE ID (Fallback for unsaved records)
  // ──────────────────────────────────────────────────────────
  generateId(speciesName = 'species') {
    const safe = speciesName.replace(/\s+/g, '-').toLowerCase();
    return `${safe}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },

  // ──────────────────────────────────────────────────────────
  //  ADD NEW SIGHTING
  //  Creates a new sighting record in database
  // ──────────────────────────────────────────────────────────
  async addSighting(sightingData) {
   const response = await this.apiRequest('/sightings', {
      method: 'POST',
      body: sightingData
   });

   return response.sighting;
  },

  // ──────────────────────────────────────────────────────────
  //  UPDATE SIGHTING
  //  Modifies an existing sighting in database
  // ──────────────────────────────────────────────────────────
  async updateSighting(id, updateData) {
     const response = await this.apiRequest(`/sightings/${id}`, {
      method: 'PUT',
      body: updateData
   });

   return response.sighting;
  },

  // ──────────────────────────────────────────────────────────
  //  DELETE SIGHTING
  //  Removes a sighting from database
  // ──────────────────────────────────────────────────────────
  async deleteSighting(id) {
    await this.apiRequest(`/sightings/${id}`, {
      method: 'DELETE'
   });

   return true;
  },

  // ──────────────────────────────────────────────────────────
  //  IMAGE CACHE MANAGEMENT (Local only)
  // ──────────────────────────────────────────────────────────
  getImageCache() {
    try {
      return JSON.parse(localStorage.getItem('speciesImageCache') || '{}');
    } catch { return {}; }
  },

  getCachedImage(speciesName) {
    const cache = this.getImageCache();
    return cache[speciesName]?.url || '';
  },

  setCachedImage(speciesName, url, source = 'external') {
    const cache = this.getImageCache();
    cache[speciesName] = { url, source, cachedAt: new Date().toISOString() };
    localStorage.setItem('speciesImageCache', JSON.stringify(cache));
  },

  // ──────────────────────────────────────────────────────────
  //  GET ALL SIGHTINGS (ADMIN ONLY)
  //  Fetches all users' sightings for admin panel
  // ──────────────────────────────────────────────────────────
  async getAllSightings() {
    const response = await this.apiRequest('/all-sightings');
    return response.sightings || [];
  },

  // ──────────────────────────────────────────────────────────
  //  EXPORT JSON
  //  Downloads sightings as JSON file
  // ──────────────────────────────────────────────────────────
  exportJSON(sightings) {
    const dataStr = JSON.stringify(sightings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sightings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // ──────────────────────────────────────────────────────────
  //  EXPORT CSV
  //  Downloads sightings as CSV file
  // ──────────────────────────────────────────────────────────
  exportCSV(sightings) {
    if (!sightings.length) {
      alert('No sightings to export');
      return;
    }

    const headers = ['Species', 'Category', 'Location', 'Date', 'Time', 'Notes', 'Favorite'];
    const rows = sightings.map(s => [
      s.species,
      s.category,
      s.locationName,
      s.date,
      s.time || '',
      s.notes || '',
      s.favorite ? 'Yes' : 'No'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sightings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // ──────────────────────────────────────────────────────────
  //  GET ENDANGERED ALERTS (SUPER ADMIN ONLY)
  // ──────────────────────────────────────────────────────────
  async getEndangeredAlerts() {
    const response = await this.apiRequest('/admin/endangered-alerts');
    return response.alerts || [];
  },

  async getPendingSightings() {
    const response = await this.apiRequest('/admin/endangered-alerts');
    return response.alerts || [];
  },

  async verifySighting(id) {
    const response = await this.apiRequest(`/admin/verify/${id}`, {
      method: 'PATCH'
    });
    return response.sighting;
  },

  async rejectSighting(id) {
    const response = await this.apiRequest(`/admin/reject/${id}`, {
      method: 'PATCH'
    });
    return response.sighting;
  }
};