/**
 * dataManager.js — Citizen Science Species Log
 * =============================================
 * Handles ALL data persistence for the platform.
 * Uses localStorage for offline-friendly, permanent storage.
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

  // The key used to store sightings in localStorage
  storageKey: 'citizenScienceSightings',
  storageKey: 'sightings',

  // Separate cache for internet species thumbnails.
  imageCacheKey: 'citizenScienceSpeciesImageCache',

  // Data version — bump this if the schema changes in future
  version: '2.0',

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
  //  SAVE
  //  Converts the sightings array to JSON and writes it to
  //  localStorage. Called every time data changes.
  // ──────────────────────────────────────────────────────────
  save(sightings) {
    try {
      const payload = {
        version: this.version,
        savedAt: new Date().toISOString(),
        data: sightings
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('[DM] Save failed:', err);
      return false;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  LOAD
  //  Reads sightings from localStorage and returns them as an
  //  array. Returns [] if nothing is stored yet.
  // ──────────────────────────────────────────────────────────
  load() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);

      // Handle both old format (plain array) and new versioned format
      if (Array.isArray(parsed)) {
        // Legacy format — plain array
        return parsed;
      }
      if (parsed && Array.isArray(parsed.data)) {
        // New versioned format
        return parsed.data;
      }
      return [];
    } catch (err) {
      console.error('[DM] Load failed:', err);
      return [];
    }
  },

  // ──────────────────────────────────────────────────────────
  //  MERGE
  //  Combines existing sightings with incoming ones.
  //  Prevents duplicates by checking IDs.
  //  Used when importing a backup JSON.
  // ──────────────────────────────────────────────────────────
  merge(existing, incoming) {
    const normalizedExisting = Array.isArray(existing) ? existing.filter(Boolean) : [];
    const normalizedIncoming = Array.isArray(incoming) ? incoming.filter(Boolean).map(s => ({
      ...s,
      id: s.id || this.generateId(s.species || 'imported-species')
    })) : [];

    const seen = new Set();
    return [...normalizedExisting, ...normalizedIncoming].filter((s) => {
      const fingerprint = s.id || `${s.species}|${s.location}|${s.date}|${s.time || ''}`;
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  },

  // ──────────────────────────────────────────────────────────
  //  CLEAR ALL
  //  Removes all sightings from localStorage after confirming.
  //  Returns true if cleared, false if cancelled.
  // ──────────────────────────────────────────────────────────
  clearAll() {
    // Show confirmation before wiping data
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to clear ALL sighting records?\n\nThis action cannot be undone.'
    );
    if (confirmed) {
      window.localStorage.removeItem(this.storageKey);
      return true;
    }
    return false;
  },

  // ──────────────────────────────────────────────────────────
  //  EXPORT AS JSON
  //  Downloads all sightings as a .json file the user can
  //  save as a backup or share with other researchers.
  // ──────────────────────────────────────────────────────────
  exportJSON(sightings) {
    try {
      const payload = {
        exportedBy: 'Citizen Science Species Log',
        exportedAt: new Date().toISOString(),
        version: this.version,
        totalRecords: sightings.length,
        data: sightings
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      this._triggerDownload(blob, `species_sightings_${this._dateStamp()}.json`);
      return true;
    } catch (err) {
      console.error('[DM] JSON export failed:', err);
      return false;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  EXPORT AS CSV
  //  Downloads all sightings as a .csv file for use in
  //  Excel, Google Sheets, or other analysis tools.
  // ──────────────────────────────────────────────────────────
  exportCSV(sightings) {
    try {
      if (!sightings.length) {
        alert('No sightings to export.');
        return false;
      }

      // Define the CSV column headers
      const headers = [
        'ID', 'Species', 'Category', 'Location',
        'Latitude', 'Longitude', 'Date', 'Time',
        'Notes', 'Rarity Label', 'Rarity Index',
        'Conservation Status', 'Favorite'
      ];

      // Convert each sighting to a CSV row
      const rows = sightings.map(s => [
        this._csvEscape(s.id || ''),
        this._csvEscape(s.species || ''),
        this._csvEscape(s.category || ''),
        this._csvEscape(s.location || ''),
        s.lat != null ? s.lat : '',
        s.lon != null ? s.lon : '',
        this._csvEscape(s.date || ''),
        this._csvEscape(s.time || ''),
        this._csvEscape(s.notes || ''),
        this._csvEscape(s.rarityLabel || ''),
        s.rarityIndex != null ? s.rarityIndex.toFixed(3) : '',
        this._csvEscape(s.conservationStatus || ''),
        s.favorite ? 'Yes' : 'No'
      ]);

      // Join headers + rows into CSV string
      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      this._triggerDownload(blob, `species_sightings_${this._dateStamp()}.csv`);
      return true;
    } catch (err) {
      console.error('[DM] CSV export failed:', err);
      return false;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  EXPORT PRINT REPORT
  //  Opens a formatted print window with sighting table.
  // ──────────────────────────────────────────────────────────
  exportPrintReport(sightings) {
    const rows = sightings.map(s => `
      <tr>
        <td>${s.species}</td>
        <td>${s.category}</td>
        <td>${s.location}</td>
        <td>${s.date}</td>
        <td>${s.rarityLabel || 'N/A'}</td>
        <td>${s.notes || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Species Sightings Report — ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1f2937; }
          h1 { color: #0f4c75; font-size: 22px; }
          .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #0f4c75; color: white; padding: 8px 12px; text-align: left; }
          td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <h1>🌿 Citizen Science Species Log — Sightings Report</h1>
        <p class="meta">Generated: ${new Date().toLocaleString()} | Total Records: ${sightings.length} | SDG 15 — Life on Land</p>
        <table>
          <thead><tr>
            <th>Species</th><th>Category</th><th>Location</th>
            <th>Date</th><th>Rarity</th><th>Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Citizen Science Species Log © ${new Date().getFullYear()} | Biodiversity Intelligence Platform</div>
        <script>window.onload = function(){ window.print(); }<\/script>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  },

  // ──────────────────────────────────────────────────────────
  //  IMPORT JSON
  //  Reads a .json backup file chosen by the user and calls
  //  the provided callback with the parsed sightings array.
  // ──────────────────────────────────────────────────────────
  importJSON(file, callback) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        // Support both plain array and versioned export format
        const incoming = Array.isArray(parsed) ? parsed
          : Array.isArray(parsed.data) ? parsed.data
          : null;

        if (!incoming) {
          alert('❌ Invalid backup file format. Please use a JSON file exported from this platform.');
          return;
        }

        callback(incoming);
      } catch (err) {
        alert('❌ Failed to parse JSON file. Please check the file and try again.');
        console.error('[DM] Import error:', err);
      }
    };
    reader.readAsText(file);
  },

  // ──────────────────────────────────────────────────────────
  //  BACKUP
  //  Creates a timestamped backup download of all sightings.
  //  Same as exportJSON but labelled as "backup".
  // ──────────────────────────────────────────────────────────
  backup(sightings) {
    try {
      const payload = {
        type: 'backup',
        platform: 'Citizen Science Species Log',
        backedUpAt: new Date().toISOString(),
        version: this.version,
        data: sightings
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      this._triggerDownload(blob, `species_backup_${this._dateStamp()}.json`);
    } catch (err) {
      console.error('[DM] Backup failed:', err);
    }
  },

  // ──────────────────────────────────────────────────────────
  //  VALIDATE SIGHTING
  //  Checks if a sighting object has the required fields.
  //  Returns an array of error messages (empty = valid).
  // ──────────────────────────────────────────────────────────
  validate(sighting) {
    const errors = [];
    if (!sighting.species) errors.push('Species is required.');
    if (!sighting.location) errors.push('Location is required.');
    if (typeof sighting.lat !== 'number') errors.push('Valid latitude is required.');
    if (typeof sighting.lon !== 'number') errors.push('Valid longitude is required.');
    if (!sighting.date) errors.push('Date is required.');
    return errors;
  },

  getImageCache() {
    try {
      return JSON.parse(window.localStorage.getItem(this.imageCacheKey) || '{}');
    } catch (err) {
      console.error('[DM] Image cache load failed:', err);
      return {};
    }
  },

  getCachedImage(speciesName) {
    const entry = this.getImageCache()[speciesName];
    return entry && entry.url ? entry.url : '';
  },

  setCachedImage(speciesName, url, source = 'external') {
    if (!speciesName || !url) return false;
    try {
      const cache = this.getImageCache();
      cache[speciesName] = {
        url,
        source,
        cachedAt: new Date().toISOString()
      };
      window.localStorage.setItem(this.imageCacheKey, JSON.stringify(cache));
      return true;
    } catch (err) {
      console.error('[DM] Image cache save failed:', err);
      return false;
    }
  },

  // ──────────────────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────

  // Escape a value for safe CSV inclusion (wrap in quotes if needed)
  _csvEscape(val) {
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str}"`
      : str;
  },

  // Returns a date stamp string like "2026-05-04" for filenames
  _dateStamp() {
    return new Date().toISOString().slice(0, 10);
  },

  // Creates a temporary download link and clicks it
  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Expose the manager for script.js while keeping all methods namespaced.
window.DM = DM;
