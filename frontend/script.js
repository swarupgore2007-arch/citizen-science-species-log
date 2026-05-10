// Citizen Science Species Log - professional SDG 15 app controller.
// The code keeps the original single-page architecture, but separates

const datasetUrl = 'species_baseline.json';
window.API_BASE = "https://citizen-science-species-log.onrender.com/api";
const themeKey = 'citizenScienceTheme';

const $ = (id) => document.getElementById(id);

const els = {
  speciesSelect: $('speciesSelect'),
  categoryDisplay: $('categoryDisplay'),
  dateInput: $('dateInput'),
  verifiedCount: $('verifiedCount'),
  pendingCount: $('pendingCount'),
  rejectedCount: $('rejectedCount'),
  highConfCount: $('highConfCount'),
  lowConfCount: $('lowConfCount'),
  verificationChart: $('verificationChart'),
  timeInput: $('timeInput'),
  notesInput: $('notesInput'),
  favoriteInput: $('favoriteInput'),
  sightingForm: $('sightingForm'),
  submitButton: $('submitButton'),
  imageUpload: $('imageUpload'),
  imagePreview: $('imagePreview'),
  imagePreviewWrapper: $('imagePreviewWrapper'),
  locationSearch: $('locationSearch'),
  locationSuggestions: $('locationSuggestions'),
  useCurrentLocation: $('useCurrentLocation'),
  searchInput: $('searchInput'),
  globalNavSearch: $('globalNavSearch'),
  filterSpecies: $('filterSpecies'),
  filterCategory: $('filterCategory'),
  filterLocation: $('filterLocation'),
  filterRarity: $('filterRarity'),
  sortSelect: $('sortSelect'),
  clearFilters: $('clearFilters'),
  bulkDelete: $('bulkDelete'),
  selectAllSightings: $('selectAllSightings'),
  tableBody: $('sightingsTableBody') || document.querySelector('#sightingsTable tbody'),
  totalSightings: $('totalSightings'),
  uniqueSpecies: $('uniqueSpecies'),
  commonLocation: $('commonLocation'),
  rareCount: $('rareCount'),
  endangeredCount: $('endangeredCount'),
  biodiversityScore: $('biodiversityScore'),
  previewTotal: $('previewTotal'),
  previewSpecies: $('previewSpecies'),
  previewLocation: $('previewLocation'),
  speciesGalleryGrid: $('speciesGalleryGrid'),
  exportJson: $('exportJson'),
  exportCsv: $('exportCsv'),
  exportPrint: $('exportPrint'),
  importJsonBtn: $('importJsonBtn'),
  importJsonFile: $('importJsonFile'),
  resetData: $('resetData'),
  themeToggle: $('themeToggle'),
  themeIcon: $('themeIcon'),
  themeLabel: $('themeLabel'),
  toastContainer: $('toastContainer'),
  rarityModal: $('rarityModal'),
  rarityInfoIcon: $('rarityInfoIcon'),
  modalClose: $('modalClose'),
  editModal: $('editModal'),
  editModalClose: $('editModalClose'),
  editModalCancel: $('editModalCancel'),
  editForm: $('editForm'),
  editSightingId: $('editSightingId'),
  editSpecies: $('editSpecies'),
  editCategory: $('editCategory'),
  editLocation: $('editLocation'),
  editDate: $('editDate'),
  editTime: $('editTime'),
  editNotes: $('editNotes'),
  editFavorite: $('editFavorite'),
  editImageUpload: $('editImageUpload'),
  editImagePreview: $('editImagePreview'),
  editImagePreviewWrapper: $('editImagePreviewWrapper'),
  deleteModal: $('deleteModal'),
  deleteModalClose: $('deleteModalClose'),
  cancelDeleteBtn: $('cancelDeleteBtn'),
  confirmDeleteBtn: $('confirmDeleteBtn'),
  deleteModalMessage: $('deleteModalMessage'),
  endangeredAlertsSection: $('endangeredAlertsSection'),
  endangeredAlertsGrid: $('endangeredAlertsGrid')
};

// Extend UI elements for Authentication
els.authGate = $('authGate');
els.authForm = $('authForm');
els.authLoginTab = $('authLoginTab');
els.authRegisterTab = $('authRegisterTab');
els.authFullNameField = $('authFullNameField');
els.authConfirmField = $('authConfirmField');
els.authUsername = $('authUsername');
els.authPassword = $('authPassword');
els.authFullName = $('authFullName');
els.authConfirmPassword = $('authConfirmPassword');
els.authError = $('authError');
els.authSubmit = $('authSubmit');
els.authSessionBar = $('authSessionBar');
els.authSessionName = $('authSessionName');
els.logoutBtn = $('logoutBtn');

const categoryColors = {
  Bird: '#2563eb',
  Mammal: '#16a34a',
  Reptile: '#dc2626',
  Amphibian: '#0ea5e9',
  Insect: '#d97706',
  Plant: '#14b8a6',
  Butterfly: '#f97316',
  Dragonfly: '#8b5cf6',
  Other: '#6b7280'
};

let speciesData = [];
let speciesMap = new Map();
let sightings = [];
let selectedLocation = null;
let pendingImageData = '';
let editPendingImageData = '';
let deleteQueue = [];
let realMap = null;
let markerLayer = null;
let hotspotLayer = null;
const memoryImageCache = new Map();
let speciesChart = null;
let verificationChart = null;
let locationChart = null;
let categoryChart = null;
let monthlyChart = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function showToast(message, type = 'success') {
  if (!els.toastContainer) {
    alert(message);
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function normalizeSpeciesEntry(item) {
  return {
    name: item.name || item.species || '',
    category: item.category || 'Other',
    expected_annual_frequency: Number(item.expected_annual_frequency) || 1,
    conservation_status: item.conservation_status || 'Unknown',
    fun_fact: item.fun_fact || '',
    areas: Array.isArray(item.areas) ? item.areas : []
  };
}

function getSpeciesInfo(speciesName) {
  return speciesMap.get(speciesName) || {
    name: speciesName,
    category: 'Other',
    expected_annual_frequency: 1,
    conservation_status: 'Unknown',
    areas: []
  };
}

function isEndangeredStatus(status = '') {
  return /endangered|vulnerable|near threatened|threatened/i.test(status);
}

function normalizeSighting(raw) {
  if (!raw || !raw.species || !raw.date) return null;
  const info = getSpeciesInfo(raw.species);

  // 1. Support old schema coordinates (lat/lon or longitude vs coordinates.lat/lng)
  const lat = Number(raw.coordinates?.lat ?? raw.lat);
  const lng = Number(raw.coordinates?.lng ?? raw.lon ?? raw.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // 2. Identify if this is a historical record (missing verificationStatus)
  const isOldRecord = !raw.verificationStatus;

  return {
    id: raw._id || raw.id,
    species: raw.species,
    category: raw.category || info.category,
    date: raw.date,
    time: raw.time || '',
    coordinates: { lat, lng },
    locationName: raw.locationName || raw.location || 'Historical Record',
    notes: raw.notes || '',
    speciesImage: raw.speciesImage || '',
    evidenceImage: raw.evidenceImage || raw.image || '',
    confidenceLevel: (raw.confidenceLevel || (isOldRecord ? 'medium' : 'low')).toUpperCase(),
    favorite: Boolean(raw.favorite),
    conservationStatus: raw.conservationStatus || info.conservation_status || 'Unknown',
    rarityIndex: Number(raw.rarityIndex) || 0,
    rarityLabel: raw.rarityLabel || 'Insufficient Data',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    verificationStatus: raw.verificationStatus || 'verified', // Default old records to verified
    isGPS: raw.isGPS ?? false,
    userId: raw.userId?._id || raw.userId || '',
    username: raw.username || '',
    roleAtCreation: raw.roleAtCreation || raw.role || ''
  };
}

function dedupeSightings(items) {
  const byId = new Map();
  items.forEach((item) => {
    const normalized = normalizeSighting(item);
    if (!normalized) return;
    byId.set(normalized.id, normalized);
  });
  return Array.from(byId.values());
}

async function loadStoredSightings() {
  try {
    const data = await DM.load();
    console.log("Fetched sightings:", data);
    sightings = dedupeSightings(data);
  } catch (err) {
    console.error('Failed to load sightings:', err);
  }
}

async function saveSightings() {
  // Data is now saved via API calls in addSighting and saveEdit
  // This function is kept for compatibility but does nothing
  console.log('saveSightings called - data saved via API');
}

function initializeFormOptions() {
  const categorySet = new Set(['Bird', 'Mammal', 'Reptile', 'Amphibian', 'Insect', 'Other']);
  const locationSet = new Set();

  [els.speciesSelect, els.filterSpecies, els.editSpecies].forEach((select) => {
    if (!select) return;
    const first = select.querySelector('option')?.outerHTML || '<option value="">All</option>';
    select.innerHTML = first;
  });

  speciesData.forEach((species) => {
    categorySet.add(species.category);
    species.areas.forEach((area) => locationSet.add(area));
    [els.speciesSelect, els.filterSpecies, els.editSpecies].forEach((select) => {
      if (!select) return;
      const option = document.createElement('option');
      option.value = species.name;
      option.textContent = species.name;
      select.appendChild(option);
    });
  });

  refreshSelect(els.filterCategory, Array.from(categorySet).sort(), 'All');
  refreshSelect(els.filterLocation, Array.from(locationSet).sort(), 'All');
}

function refreshSelect(select, values, defaultLabel = 'All') {
  if (!select) return;
  const previous = select.value;
  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  if (values.includes(previous)) select.value = previous;
}

function updateFilterOptions() {
  refreshSelect(els.filterSpecies, Array.from(new Set(sightings.map((s) => s.species))).sort(), 'All');
  refreshSelect(els.filterLocation, Array.from(new Set(sightings.map((s) => s.locationName))).sort(), 'All');
}

function computeRarity(speciesName) {
  const info = getSpeciesInfo(speciesName);
  const actual = sightings.filter((item) => item.species === speciesName).length;
  return actual / Math.max(info.expected_annual_frequency || 1, 1);
}

function getRarityInfo(speciesName) {
  // Scientific validation check
  const actual = sightings.filter((item) => item.species === speciesName && item.verificationStatus === 'verified').length;
  if (actual < 3) {
    return { rarityIndex: 0, label: 'Insufficient Data', className: 'badge-insufficient' };
  }
  const rarityIndex = computeRarity(speciesName);
  if (rarityIndex < 0.5) return { rarityIndex, label: 'Rare / Unexpected', className: 'badge-rare' };
  if (rarityIndex <= 1.5) return { rarityIndex, label: 'As Expected', className: 'badge-normal' };
  return { rarityIndex, label: 'Common', className: 'badge-common' };
}

function updateAllRarityProperties() {
  sightings = sightings.map((sighting) => {
    const info = getSpeciesInfo(sighting.species);
    const rarity = getRarityInfo(sighting.species);
    return {
      ...sighting,
      category: info.category || sighting.category || 'Other',
      conservationStatus: info.conservation_status || sighting.conservationStatus || 'Unknown',
      rarityIndex: rarity.rarityIndex,
      rarityLabel: rarity.label
    };
  });
}

function getSpeciesCounts() {
  return sightings.reduce((acc, sighting) => {
    acc[sighting.species] = (acc[sighting.species] || 0) + 1;
    return acc;
  }, {});
}

function getFilteredSightings() {
  const search = (els.searchInput?.value || '').trim().toLowerCase();
  const speciesFilter = els.filterSpecies?.value || '';
  const categoryFilter = els.filterCategory?.value || '';
  const locationFilter = els.filterLocation?.value || '';
  const rarityFilter = els.filterRarity?.value || '';
  const speciesCounts = getSpeciesCounts();

  const filtered = sightings.filter((sighting) => {
    const rarity = getRarityInfo(sighting.species).label;
    const searchable = `${sighting.species} ${sighting.category} ${sighting.locationName} ${sighting.notes}`.toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    const matchesSpecies = !speciesFilter || sighting.species === speciesFilter;
    const matchesCategory = !categoryFilter || sighting.category === categoryFilter;
    const matchesLocation = !locationFilter || sighting.locationName === locationFilter;
    const matchesRarity = !rarityFilter ||
      (rarityFilter === 'Endangered' ? isEndangeredStatus(sighting.conservationStatus) : rarity === rarityFilter);
    return matchesSearch && matchesSpecies && matchesCategory && matchesLocation && matchesRarity;
  });

  const sort = els.sortSelect?.value || 'latest';
  return filtered.sort((a, b) => {
    if (sort === 'oldest') return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    if (sort === 'az') return a.species.localeCompare(b.species);
    if (sort === 'za') return b.species.localeCompare(a.species);
    if (sort === 'rare') return (a.rarityIndex || 99) - (b.rarityIndex || 99);
    if (sort === 'common') return (speciesCounts[b.species] || 0) - (speciesCounts[a.species] || 0);
    return `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
  });
}

function placeholderFor(category) {
  const color = (categoryColors[category] || categoryColors.Other).replace('#', '');
  return `https://placehold.co/640x420/${color}/ffffff?text=${encodeURIComponent(category || 'Wildlife')}`;
}

function imageForSighting(sighting, type = 'priority') {
  if (type === 'evidence') {
    return sighting.evidenceImage || 'https://placehold.co/100x100/64748b/ffffff?text=No+Evidence';
  }
  // Priority logic: User evidence takes precedence over Wikipedia reference
  return sighting.evidenceImage || sighting.speciesImage || placeholderFor(sighting.category);
}

function imageVerificationBadge(sighting) {
  const styles = `
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: white;
    z-index: 5;
    pointer-events: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 4px;
    backdrop-filter: blur(4px);
  `;
  if (sighting.evidenceImage) {
    return `<div class="image-source-badge verified" style="${styles} background: rgba(34, 197, 94, 0.9);">📸 Image Verified</div>`;
  }
  return `<div class="image-source-badge reference" style="${styles} background: rgba(100, 116, 139, 0.8);">Reference Image</div>`;
}

function speciesSearchNames(speciesName) {
  const aliases = {
    Peacock: 'Indian Peafowl',
    'Indian Rolller': 'Indian Roller',
    'Tailor Bird': 'Common Tailorbird'
  };
  return Array.from(new Set([
    aliases[speciesName] || speciesName,
    speciesName,
    `${speciesName} bird`,
    `${speciesName} wildlife`,
    `${speciesName} animal`
  ]));
}

async function fetchWikipediaThumbnail(searchName) {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchName)}`);
  if (!response.ok) return '';
  const data = await response.json();
  return data.originalimage?.source || data.thumbnail?.source || '';
}

async function fetchWikimediaThumbnail(searchName) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${searchName} species`,
    gsrlimit: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '900',
    format: 'json',
    origin: '*'
  }).toString();
  const response = await fetch(url);
  if (!response.ok) return '';
  const data = await response.json();
  const page = data.query?.pages ? Object.values(data.query.pages)[0] : null;
  return page?.thumbnail?.source || '';
}

async function getSpeciesImageUrl(sighting) {
  // Requirement 5: If we already have a real URL (not a placeholder), use it
  if (sighting.speciesImage && !sighting.speciesImage.includes('placehold.co')) return sighting.speciesImage;
  
  // Check memory/local cache before fetching
  if (memoryImageCache.has(sighting.species)) return memoryImageCache.get(sighting.species);
  const cached = window.DM && DM.getCachedImage ? DM.getCachedImage(sighting.species) : '';
  if (cached) {
    memoryImageCache.set(sighting.species, cached);
    return cached;
  }

  for (const searchName of speciesSearchNames(sighting.species)) {
    try {
      const wiki = await fetchWikipediaThumbnail(searchName);
      if (wiki) {
        memoryImageCache.set(sighting.species, wiki);
        if (window.DM && DM.setCachedImage) DM.setCachedImage(sighting.species, wiki, 'wikipedia');
        return wiki;
      }
    } catch (error) {
      // Try the next provider.
    }
  }

  for (const searchName of speciesSearchNames(sighting.species)) {
    try {
      const commons = await fetchWikimediaThumbnail(searchName);
      if (commons) {
        memoryImageCache.set(sighting.species, commons);
        if (window.DM && DM.setCachedImage) DM.setCachedImage(sighting.species, commons, 'wikimedia');
        return commons;
      }
    } catch (error) {
      // Keep the fallback chain moving.
    }
  }

  const unsplash = `https://source.unsplash.com/900x600/?${encodeURIComponent(sighting.species)},wildlife`;
  memoryImageCache.set(sighting.species, unsplash);
  if (window.DM && DM.setCachedImage) DM.setCachedImage(sighting.species, unsplash, 'unsplash');
  return unsplash || placeholderFor(sighting.category);
}

async function hydrateSpeciesImages(root = document) {
  const images = Array.from(root.querySelectorAll('img[data-hydrate="true"]'));
  await Promise.all(images.map(async (img) => {
    const sightingId = img.dataset.sightingId;
    const sighting = sightings.find((item) => item.id === sightingId) || {
      species: img.dataset.species,
      category: img.dataset.category,
      speciesImage: '',
      evidenceImage: ''
    };

    if (sighting.evidenceImage) return; // Evidence image takes priority; skip Wikipedia hydration

    const url = await getSpeciesImageUrl(sighting);
    if (url && img.src !== url) img.src = url;
  }));
}

function renderSightingsTable() {
  const filtered = getFilteredSightings();
  els.tableBody.innerHTML = '';
  const currentUser = Auth.getCurrentUser();
  const isSuperAdmin = currentUser && currentUser.role === 'super_admin';

  if (!filtered.length) {
    els.tableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No sightings match the current filters.</td></tr>';
    return;
  }

  filtered.forEach((sighting) => {
    const rarity = getRarityInfo(sighting.species);
    const statusColor = { pending: '#eab308', verified: '#22c55e', rejected: '#ef4444' }[sighting.verificationStatus];
    const confColor = { HIGH: '#22c55e', MEDIUM: '#eab308', LOW: '#ef4444' }[sighting.confidenceLevel];
    
    const row = document.createElement('tr');
    row.className = sighting.favorite ? 'favorite-row' : '';
    row.innerHTML = `
      <td><input type="checkbox" class="row-select" data-id="${escapeHTML(sighting.id)}" aria-label="Select ${escapeHTML(sighting.species)}" /></td>
      <td>
        <div class="admin-image-review">
          <img class="table-thumb enlargeable" src="${escapeHTML(imageForSighting(sighting, 'evidence'))}" 
               alt="${escapeHTML(sighting.species)}" 
               data-hydrate="true" data-sighting-id="${escapeHTML(sighting.id)}" 
               data-species="${escapeHTML(sighting.species)}" data-category="${escapeHTML(sighting.category)}"
               onclick="window.open(this.src, '_blank')" 
               style="cursor:zoom-in" title="Click to enlarge" />
        </div>
      </td>
      <td>
        <strong>${escapeHTML(sighting.species)}</strong><br>
        <small>User: ${escapeHTML(sighting.username)} (ID: ${escapeHTML(sighting.userId.substring(0,8))}...)</small>
      </td>
      <td><span class="category-pill" style="--pill-color:${categoryColors[sighting.category] || categoryColors.Other}">${escapeHTML(sighting.category)}</span></td>
      <td>
        ${escapeHTML(sighting.locationName)}<br>
        <small style="color:var(--text-muted)">📍 ${sighting.coordinates.lat.toFixed(4)}, ${sighting.coordinates.lng.toFixed(4)}</small>
        ${!sighting.isGPS ? '<br><span class="badge badge-insufficient" style="font-size:10px">⚠️ Manual Location</span>' : '<br><span class="badge badge-normal" style="font-size:10px">✅ GPS Verified Location</span>'}
      </td>
      <td>
        <small>${escapeHTML(new Date(sighting.createdAt).toLocaleString())}</small>
      </td>
      <td>
        <div class="confidence-tag" style="border-left: 3px solid ${confColor}; padding-left:5px">
          <strong style="color:${confColor}">${sighting.confidenceLevel}</strong><br>
          <small>${escapeHTML(rarity.label)}</small>
        </div>
      </td>
      <td>
        <span class="status-badge" style="color:${statusColor}; font-weight:bold; font-size:0.75rem">● ${sighting.verificationStatus.toUpperCase()}</span>
      </td>
      <td class="table-actions">
        ${isSuperAdmin && sighting.verificationStatus === 'pending' ? `
          <button class="btn btn-secondary small verify-btn" data-action="verify" data-id="${escapeHTML(sighting.id)}">Verify</button>
          <button class="btn btn-danger small reject-btn" data-action="reject" data-id="${escapeHTML(sighting.id)}">Reject</button>
        ` : ''}
        <button class="btn btn-secondary small" data-action="favorite" data-id="${escapeHTML(sighting.id)}">${sighting.favorite ? 'Unfavorite' : 'Favorite'}</button>
        <button class="btn btn-secondary small" data-action="edit" data-id="${escapeHTML(sighting.id)}">Edit</button>
        <button class="btn btn-danger small" data-action="delete" data-id="${escapeHTML(sighting.id)}">Delete</button>
      </td>
    `;
    els.tableBody.appendChild(row);
  });
  hydrateSpeciesImages(els.tableBody);
}

function updateDashboard() {
  // Centralized Metrics Processing
  const adminVisible = sightings.filter(s => s.verificationStatus !== 'rejected');
  const verifiedOnly = sightings.filter(s => s.verificationStatus === 'verified');

  const stats = sightings.reduce((acc, s) => {
    acc.total++;
    acc[s.verificationStatus] = (acc[s.verificationStatus] || 0) + 1;
    if (s.confidenceLevel === 'HIGH') acc.highConf++;
    if (s.confidenceLevel === 'LOW') acc.lowConf++;
    return acc;
  }, { total: 0, pending: 0, verified: 0, rejected: 0, highConf: 0, lowConf: 0 });

  const unique = new Set(adminVisible.map((item) => item.species));
  const locationCounts = adminVisible.reduce((acc, s) => {
    acc[s.locationName] = (acc[s.locationName] || 0) + 1;
    return acc;
  }, {});
  
  const topLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const rareTotal = adminVisible.filter((s) => getRarityInfo(s.species).label === 'Rare / Unexpected').length;
  const endangeredTotal = adminVisible.filter((s) => isEndangeredStatus(s.conservationStatus)).length;
  
  const score = adminVisible.length
    ? Math.min(100, Math.round((unique.size / Math.max(adminVisible.length, 1)) * 55 + (endangeredTotal / adminVisible.length) * 25 + (rareTotal / adminVisible.length) * 20))
    : 0;

  els.totalSightings.textContent = adminVisible.length;
  if (els.verifiedCount) els.verifiedCount.textContent = stats.verified;
  if (els.pendingCount) els.pendingCount.textContent = stats.pending;
  if (els.rejectedCount) els.rejectedCount.textContent = stats.rejected;
  if (els.highConfCount) els.highConfCount.textContent = stats.highConf;
  if (els.lowConfCount) els.lowConfCount.textContent = stats.lowConf;
  els.uniqueSpecies.textContent = unique.size;
  els.commonLocation.textContent = topLocation;
  els.rareCount.textContent = rareTotal;
  if (els.endangeredCount) els.endangeredCount.textContent = endangeredTotal;
  if (els.biodiversityScore) els.biodiversityScore.textContent = `${score}%`;
  if (els.previewTotal) els.previewTotal.textContent = adminVisible.length;
  if (els.previewSpecies) els.previewSpecies.textContent = unique.size;
  if (els.previewLocation) els.previewLocation.textContent = topLocation;
}

function renderSpeciesGallery() {
  if (!els.speciesGalleryGrid) return;
  const recent = [...sightings]
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .slice(0, 8);

  if (!recent.length) {
    els.speciesGalleryGrid.innerHTML = '<div class="empty-gallery">Recent species cards will appear after you log sightings.</div>';
    return;
  }

  els.speciesGalleryGrid.innerHTML = recent.map((sighting) => {
    const rarity = getRarityInfo(sighting.species);
    return `
      <article class="species-card">
        <div class="card-image-wrapper" style="position: relative; overflow: hidden;">
          <img src="${escapeHTML(imageForSighting(sighting, 'priority'))}" alt="${escapeHTML(sighting.species)}" 
               data-hydrate="true" data-sighting-id="${escapeHTML(sighting.id)}" 
               data-species="${escapeHTML(sighting.species)}" data-category="${escapeHTML(sighting.category)}" 
               loading="lazy">
          ${imageVerificationBadge(sighting)}
        </div>
        <div class="species-card-body">
          <div class="species-card-top">
            <span class="category-pill" style="--pill-color:${categoryColors[sighting.category] || categoryColors.Other}">${escapeHTML(sighting.category)}</span>
            <span class="badge ${rarity.className}">${escapeHTML(rarity.label)}</span>
          </div>
          <h3>${escapeHTML(sighting.species)}</h3>
          <p>${escapeHTML(sighting.locationName)}</p>
          <div class="species-card-actions">
            <button class="btn btn-secondary small" data-action="edit" data-id="${escapeHTML(sighting.id)}">Edit</button>
            <button class="btn btn-secondary small" data-action="favorite" data-id="${escapeHTML(sighting.id)}">${sighting.favorite ? 'Unfavorite' : 'Favorite'}</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  hydrateSpeciesImages(els.speciesGalleryGrid);
}

function chartOptions() {
  const dark = document.documentElement.dataset.theme !== 'light';
  const text = dark ? '#dbeafe' : '#374151';
  const grid = dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: text } },
      tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#fff' }
    },
    scales: {
      x: { ticks: { color: text }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } }
    }
  };
}

function countBy(field, list) {
  return list.reduce((acc, item) => {
    const value = item[field] || 'Unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function monthlyStatusCounts(list) {
  const result = {};
  list.forEach(s => {
    const m = (s.date || '').slice(0, 7) || 'Unknown';
    if (!result[m]) result[m] = { total: 0, verified: 0, pending: 0, rejected: 0 };
    result[m].total++;
    result[m][s.verificationStatus]++;
  });
  return result;
}

function topEntries(counts, limit = 6) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function upsertChart(canvasId, existing, config) {
  const canvas = $(canvasId);
  if (!canvas || typeof Chart === 'undefined') return existing;
  if (existing) existing.destroy();
  return new Chart(canvas, config);
}

function updateCharts() {
  const verifiedData = sightings.filter(s => s.verificationStatus === 'verified');
  const adminVisible = sightings.filter(s => s.verificationStatus !== 'rejected');

  // 1. TOP SPECIES RANKING (Scientific wildlife analytics - Rule 1/9)
  const species = topEntries(countBy('species', verifiedData), 5);

  // 2. LOCATION DISTRIBUTION (Operational visibility - Rule 2)
  const locations = topEntries(countBy('locationName', adminVisible), 6);

  // 3. SIGHTINGS BY CATEGORY (Platform activity analytics - Rule 3)
  const categories = topEntries(countBy('category', adminVisible), 8);

  // 4. MONTHLY TREND GRAPH (Submission trend analytics - Rule 4/6)
  const monthlyData = Object.entries(monthlyStatusCounts(adminVisible)).sort((a, b) => a[0].localeCompare(b[0]));
  const months = monthlyData.map(i => i[0]);
  
  const colors = categories.map(([label]) => categoryColors[label] || categoryColors.Other);
  const statusStats = countBy('verificationStatus', sightings);

  // 5. Verification Status Pie Chart
  verificationChart = upsertChart('verificationChart', verificationChart, {
    type: 'pie',
    data: {
      labels: ['Verified', 'Pending', 'Rejected'],
      datasets: [{
        data: [statusStats.verified || 0, statusStats.pending || 0, statusStats.rejected || 0],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444']
      }]
    },
    options: { ...chartOptions(), plugins: { ...chartOptions().plugins, title: { display: true, text: 'Moderation Status', color: '#fff' } } }
  });

  // 1. Top Species (Scientific)
  speciesChart = upsertChart('speciesChart', speciesChart, {
    type: 'bar',
    data: { labels: species.map((i) => i[0]), datasets: [{ data: species.map((i) => i[1]), backgroundColor: '#22c55e', borderRadius: 8, label: 'Sightings' }] },
    options: { ...chartOptions(), plugins: { ...chartOptions().plugins, legend: { display: false } } }
  });

  // 2. Location Distribution (Operational)
  locationChart = upsertChart('locationChart', locationChart, {
    type: 'doughnut',
    data: { labels: locations.map((i) => i[0]), datasets: [{ data: locations.map((i) => i[1]), backgroundColor: ['#22c55e', '#38bdf8', '#f59e0b', '#a78bfa', '#ef4444', '#14b8a6'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: chartOptions().plugins }
  });

  // 3. Activity by Category (All)
  categoryChart = upsertChart('categoryChart', categoryChart, {
    type: 'bar',
    data: { labels: categories.map((i) => i[0]), datasets: [{ data: categories.map((i) => i[1]), backgroundColor: colors, borderRadius: 8, label: 'Sightings' }] },
    options: chartOptions()
  });

  // 4. Trend Logic
  monthlyChart = upsertChart('monthlyChart', monthlyChart, {
    type: 'line',
    data: { 
      labels: months, 
      datasets: [
        { data: monthlyData.map(i => i[1].total), label: 'Total', borderColor: '#38bdf8', tension: 0.35 },
        { data: monthlyData.map(i => i[1].verified), label: 'Verified', borderColor: '#22c55e', tension: 0.35 },
        { data: monthlyData.map(i => i[1].pending), label: 'Pending', borderColor: '#eab308', tension: 0.35 },
        { data: monthlyData.map(i => i[1].rejected), label: 'Rejected', borderColor: '#ef4444', tension: 0.35 }
      ]
    },
    options: chartOptions()
  });
}

function initializeRealMap() {
  if (!window.L) return;
  if (realMap) {
    realMap.invalidateSize();
    return;
  }
  realMap = L.map('realMap').setView([19.0760, 72.8777], 7);
  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 1
  }).addTo(realMap);
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors',
    maxZoom: 17
  });
  markerLayer = L.layerGroup().addTo(realMap);
  hotspotLayer = L.layerGroup().addTo(realMap);
  L.control.layers({ Streets: street, Terrain: topo }, { Sightings: markerLayer, Hotspots: hotspotLayer }).addTo(realMap);
  L.control.scale().addTo(realMap);
}

/** Checks if a sighting was created by an admin */
function isSightingFromAdmin(sighting) {
  const role = sighting.roleAtCreation || '';
  return role === 'admin' || role === 'super_admin';
}

function markerPopup(sighting) {
  const rarity = getRarityInfo(sighting.species);
  const score = Math.max(5, Math.min(100, Math.round((1 / Math.max(sighting.rarityIndex || 1, 0.1)) * 14)));
  const roleBadge = isSightingFromAdmin(sighting) ? `<span class="badge badge-normal" style="margin-left:5px">Admin</span>` : '';
  return `
    <div class="popup-card" id="popup-${escapeHTML(sighting.id)}">
      <div class="popup-image-wrapper" style="position: relative; overflow: hidden;">
        <img src="${escapeHTML(imageForSighting(sighting, 'priority'))}" alt="${escapeHTML(sighting.species)}" class="popup-image" 
             data-hydrate="true" data-sighting-id="${escapeHTML(sighting.id)}" 
             data-species="${escapeHTML(sighting.species)}" data-category="${escapeHTML(sighting.category)}">
        ${imageVerificationBadge(sighting)}
      </div>
      <div class="popup-main">
        <span class="popup-kicker">${escapeHTML(sighting.category)} observation</span>
        <h3>${escapeHTML(sighting.species)}</h3>
        <p class="popup-scientific">Citizen science field record</p>
      </div>
      <div class="popup-meta-grid">
        <span><strong>Location</strong>${escapeHTML(sighting.locationName)}</span>
        <span><strong>Date</strong>${escapeHTML(sighting.date)}${sighting.time ? `, ${escapeHTML(sighting.time)}` : ''}</span>
        <span><strong>User</strong>${escapeHTML(sighting.username)}</span>
        <span><strong>Moderation</strong>${escapeHTML(sighting.verificationStatus.toUpperCase())}</span>
        <span><strong>Confidence</strong>${escapeHTML(sighting.confidenceLevel)}</span>
        <span><strong>Status</strong>${escapeHTML(sighting.conservationStatus)}</span>
      </div>
      <p class="popup-notes">${escapeHTML(sighting.notes || 'No notes available')}</p>
      <div class="popup-footer">
        <small>ID: ${escapeHTML(sighting.id)}</small>
        <small>Quality Score: ${score}</small>
      </div>
    </div>
  `;
}

function renderMapMarkers() {
  if (!realMap || !markerLayer || !hotspotLayer) return;
  markerLayer.clearLayers();
  hotspotLayer.clearLayers();

  // Visibility Logic for Mapping
  const filtered = getFilteredSightings().filter(s => {
    if (!s.coordinates?.lat || !s.coordinates?.lng) return false;
    // Rule 7: Admin/Dashboard map view excludes rejected sightings
    return s.verificationStatus !== 'rejected';
  });

  const bounds = [];

  filtered.forEach((sighting) => {
    // Requirement 6: Marker colors based on verificationStatus
    const markerColor = {
      verified: '#22c55e', // green
      pending: '#eab308',  // yellow
      rejected: '#ef4444'  // red
    }[sighting.verificationStatus] || '#6b7280';

    const rare = getRarityInfo(sighting.species).label === 'Rare / Unexpected';

    // Requirement 1: Use sighting.coordinates structure
    const marker = L.circleMarker([sighting.coordinates.lat, sighting.coordinates.lng], {
      radius: rare ? 10 : 7,
      fillColor: markerColor,
      color: rare ? '#fbbf24' : '#ffffff',
      weight: rare ? 4 : 2,
      fillOpacity: 0.9
    }).bindPopup(markerPopup(sighting));
    marker.on('click touchstart', () => marker.openPopup());
    marker.on('popupopen', (event) => {
      const popupElement = event.popup && event.popup.getElement ? event.popup.getElement() : null;
      if (popupElement) hydrateSpeciesImages(popupElement);
    });
    markerLayer.addLayer(marker);
    hotspotLayer.addLayer(L.circle([sighting.coordinates.lat, sighting.coordinates.lng], {
      radius: rare ? 18000 : 10000,
      color: markerColor,
      fillColor: markerColor,
      fillOpacity: rare ? 0.16 : 0.08,
      weight: 1,
      interactive: false
    }));
    bounds.push([sighting.coordinates.lat, sighting.coordinates.lng]);
  });

  if (bounds.length) realMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
}

function refreshAll() {
  updateAllRarityProperties();
  updateFilterOptions();
  renderSightingsTable();
  updateDashboard();
  renderSpeciesGallery();
  updateCharts();
  renderMapMarkers();
  updateEndangeredAlerts();
}

function resetForm() {
  els.sightingForm.reset();
  els.categoryDisplay.value = '';
  els.locationSearch.value = '';
  selectedLocation = null;
  pendingImageData = '';
  if (els.imagePreview) els.imagePreview.src = '';
  if (els.imagePreviewWrapper) els.imagePreviewWrapper.style.display = 'none';
}

function updateCategory() {
  const info = getSpeciesInfo(els.speciesSelect.value);
  els.categoryDisplay.value = els.speciesSelect.value ? info.category : '';
}

function validateLocation() {
  if (selectedLocation) return true;
  const typed = els.locationSearch.value.trim();
  if (!typed) return false;
  selectedLocation = { name: typed, lat: 19.0760, lon: 72.8777 };
  showToast('Location saved with default map coordinates. Use autocomplete or GPS for precise mapping.', 'warning');
  return true;
}

async function addSighting(event) {
  event.preventDefault();
  const speciesName = els.speciesSelect.value;
  if (!speciesName || !els.dateInput.value || !validateLocation()) {
    showToast('Please complete species, date, and location.', 'error');
    return;
  }

  const info = getSpeciesInfo(speciesName);
  // Requirement: Pre-fetch educational image to store in the DB record
  const speciesImageUrl = await getSpeciesImageUrl({ species: speciesName, category: info.category });

  const sightingData = {
    species: speciesName,
    category: info.category,
    date: els.dateInput.value,
    time: els.timeInput?.value || '',
    locationName: selectedLocation.name,
    coordinates: {
      lat: selectedLocation.lat,
      lng: selectedLocation.lon
    },
    notes: els.notesInput.value.trim(),
    speciesImage: speciesImageUrl,
    evidenceImage: pendingImageData,
    favorite: Boolean(els.favoriteInput?.checked),
    conservationStatus: info.conservation_status,
    isGPS: !!selectedLocation.isGPS
  };

  console.log("Submitting isGPS:", sightingData.isGPS);

  try {
    await DM.addSighting(sightingData);

try {
   await loadStoredSightings();
   resetForm();
   refreshAll();
} catch (refreshError) {
   console.error("Refresh failed:", refreshError);
}

showToast('Sighting added successfully');
  } catch (error) {
    console.error("Save failed:", error);
    showToast('Failed to save sighting to server', 'error');
  }
}

function openEditModal(id) {
  const sighting = sightings.find((item) => item.id === id);
  if (!sighting) return;
  els.editSightingId.value = sighting.id;
  els.editSpecies.value = sighting.species;
  els.editCategory.value = sighting.category;
  els.editLocation.value = sighting.locationName;
  els.editDate.value = sighting.date;
  if (els.editTime) els.editTime.value = sighting.time || '';
  els.editNotes.value = sighting.notes || '';
  if (els.editFavorite) els.editFavorite.checked = Boolean(sighting.favorite);
  editPendingImageData = '';
  if (els.editImagePreview) els.editImagePreview.src = sighting.evidenceImage || sighting.speciesImage || '';
  if (els.editImagePreviewWrapper) els.editImagePreviewWrapper.style.display = (sighting.evidenceImage || sighting.speciesImage) ? 'block' : 'none';
  els.editModal.classList.add('show');
}

function closeEditModal() {
  els.editModal.classList.remove('show');
}

async function saveEdit(event) {
  event.preventDefault();
  const id = els.editSightingId.value;
  const current = sightings.find((item) => item.id === id);
  if (!current || !els.editSpecies.value || !els.editDate.value) {
    showToast('Edit form is missing required data.', 'error');
    return;
  }

  const info = getSpeciesInfo(els.editSpecies.value);
  const updateData = {
    species: els.editSpecies.value,
    category: info.category,
    conservationStatus: info.conservation_status,
    locationName: els.editLocation.value.trim() || current.locationName,
    date: els.editDate.value,
    time: els.editTime?.value || '',
    notes: els.editNotes.value.trim(),
    favorite: Boolean(els.editFavorite?.checked),
    speciesImage: current.speciesImage,
    evidenceImage: editPendingImageData || current.evidenceImage || ''
  };

  try {
    if (DM && DM.updateSighting) {
      const updatedSighting = await DM.updateSighting(id, updateData);
      const normalized = normalizeSighting(updatedSighting);
      sightings = sightings.map((item) =>
        item.id === id ? normalized : item
      );
      updateAllRarityProperties();
      closeEditModal();
      refreshAll();
      console.log("Operation succeeded");
      showToast('Sighting updated.');
    } else {
      showToast('Data manager not available', 'error');
    }
  } catch (error) {
    console.error("Save failed:", error); // Requirement 9
    showToast('Failed to update sighting on server', 'error');
  }
}

function openDeleteModal(ids) {
  deleteQueue = Array.isArray(ids) ? ids : [ids];
  if (!deleteQueue.length) return;
  els.deleteModalMessage.textContent = deleteQueue.length === 1
    ? 'Delete this sighting? This action cannot be undone.'
    : `Delete ${deleteQueue.length} selected sightings? This action cannot be undone.`;
  els.deleteModal.classList.add('show');
}

function closeDeleteModal() {
  deleteQueue = [];
  els.deleteModal.classList.remove('show');
}

async function confirmDelete() {
  try {
    if (DM && DM.deleteSighting) {
      for (const id of deleteQueue) {
   await DM.deleteSighting(id);
}

try {
   sightings = sightings.filter(
      (item) =>
         !deleteQueue.includes(item.id) &&
         !deleteQueue.includes(item._id)
   );

   updateAllRarityProperties();
   closeDeleteModal();
   refreshAll();
} catch (refreshError) {
   console.error("Refresh failed:", refreshError);
}

showToast('Sighting deleted successfully');
    } else {
      showToast('Data manager not available', 'error');
    }
  } catch (error) {
    console.error('Failed to delete sightings:', error);
    showToast('Failed to delete sightings from server', 'error');
  }
}

function handleTableClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === 'edit') openEditModal(id);
  if (button.dataset.action === 'delete') openDeleteModal(id);
  
  if (button.dataset.action === 'verify') {
    DM.verifySighting(id).then(() => {
      console.log("Operation succeeded");
      showToast('Sighting verified successfully');
      loadStoredSightings().then(refreshAll);
    }).catch(err => showToast(err.message, 'error'));
  }
  if (button.dataset.action === 'reject') {
    DM.rejectSighting(id).then(() => {
      console.log("Operation succeeded");
      showToast('Sighting rejected');
      loadStoredSightings().then(refreshAll);
    }).catch(err => showToast(err.message, 'error'));
  }

  if (button.dataset.action === 'favorite') {
    const sighting = sightings.find(item => item.id === id);
    if (sighting) {
      const updateData = { favorite: !sighting.favorite };
      if (DM && DM.updateSighting) {
        DM.updateSighting(id, updateData).then(updated => {
          const normalized = normalizeSighting(updated);
          sightings = sightings.map((item) =>
            item.id === id ? normalized : item
          );
          refreshAll();
        }).catch(error => {
          console.error('Failed to update favorite:', error);
          showToast('Failed to update favorite status', 'error');
        });
      }
    }
  }
}

function selectedIds() {
  return Array.from(document.querySelectorAll('.row-select:checked')).map((box) => box.dataset.id);
}

function clearFilters() {
  if (els.searchInput) els.searchInput.value = '';
  if (els.globalNavSearch) els.globalNavSearch.value = '';
  [els.filterSpecies, els.filterCategory, els.filterLocation, els.filterRarity].forEach((select) => { if (select) select.value = ''; });
  if (els.sortSelect) els.sortSelect.value = 'latest';
  refreshAll();
}

function resetAllData() {
  showToast('Please delete sightings individually from the interface.', 'info');
}

function importBackup(file) {
  if (!file || !window.DM) return;
  DM.importJSON(file, (incoming) => {
    const merged = DM.merge(sightings, dedupeSightings(incoming));
    sightings = dedupeSightings(merged);
    updateAllRarityProperties();
    saveSightings();
    refreshAll();
    showToast('Backup imported and merged safely.');
  });
}

function exportJSON() {
  if (DM) DM.exportJSON(sightings);
}

function exportCSV() {
  if (DM) DM.exportCSV(sightings);
}

function exportPrint() {
  if (DM) DM.exportPrintReport(sightings);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function searchLocations(query) {
  if (!query || query.length < 2) {
    els.locationSuggestions.classList.remove('show');
    return;
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
    if (!response.ok) throw new Error('Location search failed');
    const results = await response.json();
    renderLocationSuggestions(results);
  } catch (error) {
    renderLocationSuggestions([]);
  }
}

function renderLocationSuggestions(results) {
  els.locationSuggestions.innerHTML = '';
  if (!results.length) {
    els.locationSuggestions.innerHTML = '<div class="location-suggestion-item no-results">No results found</div>';
  }
  results.forEach((result) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'location-suggestion-item';
    item.textContent = result.display_name;
    item.addEventListener('click', () => selectLocation({
      name: result.display_name,
      lat: Number(result.lat),
      lon: Number(result.lon)
    }));
    els.locationSuggestions.appendChild(item);
  });
  els.locationSuggestions.classList.add('show');
}

function selectLocation(location) {
  selectedLocation = location;
  els.locationSearch.value = location.name;
  els.locationSuggestions.classList.remove('show');
  if (realMap && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    L.marker([location.lat, location.lon]).addTo(realMap).bindPopup(escapeHTML(location.name)).openPopup();
    realMap.setView([location.lat, location.lon], 11);
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by this browser.', 'error');
    return;
  }
  const original = els.useCurrentLocation.textContent;
  els.useCurrentLocation.textContent = 'Locating...';
  els.useCurrentLocation.disabled = true;
  navigator.geolocation.getCurrentPosition((position) => {
    selectLocation({
      name: 'Current Location',
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      isGPS: true
    });
    els.useCurrentLocation.textContent = original;
    els.useCurrentLocation.disabled = false;
  }, () => {
    showToast('Unable to retrieve location. Check browser permissions.', 'error');
    els.useCurrentLocation.textContent = original;
    els.useCurrentLocation.disabled = false;
  });
}

function optimizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 900;
        const ratio = Math.min(max / img.width, max / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    pendingImageData = await optimizeImage(file);
    els.imagePreview.src = pendingImageData;
    els.imagePreviewWrapper.style.display = 'block';
    showToast('Image optimized for local storage.');
  } catch (error) {
    pendingImageData = '';
    showToast('Image could not be loaded.', 'error');
  }
}

async function handleEditImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    editPendingImageData = await optimizeImage(file);
    els.editImagePreview.src = editPendingImageData;
    els.editImagePreviewWrapper.style.display = 'block';
    showToast('Replacement image optimized.');
  } catch (error) {
    editPendingImageData = '';
    showToast('Replacement image could not be loaded.', 'error');
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(themeKey, theme);
  if (els.themeIcon) els.themeIcon.textContent = theme === 'light' ? 'Moon' : 'Sun';
  if (els.themeLabel) els.themeLabel.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
  updateCharts();
}

function initTheme() {
  applyTheme(localStorage.getItem(themeKey) || 'dark');
}

function openModal(modal) {
  modal?.classList.add('show');
}

function closeModal(modal) {
  modal?.classList.remove('show');
}

async function loadSpeciesDataset() {
  try {
    const response = await fetch(datasetUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    speciesData = Array.isArray(data) ? data.map(normalizeSpeciesEntry) : [];
  } catch (error) {
    console.error('Failed to load JSON baseline:', error);
    showToast('Baseline JSON could not be loaded. Saved records will still be available.', 'error');
    speciesData = [];
  }

  speciesMap = new Map(speciesData.map((species) => [species.name, species]));
  initializeFormOptions();
  await loadStoredSightings();
  initializeRealMap();
  refreshAll();
}

function bindEvents() {
  els.speciesSelect?.addEventListener('change', updateCategory);
  els.editSpecies?.addEventListener('change', () => {
    els.editCategory.value = getSpeciesInfo(els.editSpecies.value).category || '';
  });
  els.sightingForm?.addEventListener('submit', addSighting);
  els.tableBody?.addEventListener('click', handleTableClick);
  els.speciesGalleryGrid?.addEventListener('click', handleTableClick);
  els.imageUpload?.addEventListener('change', handleImageUpload);
  els.editImageUpload?.addEventListener('change', handleEditImageUpload);

  [els.searchInput, els.filterSpecies, els.filterCategory, els.filterLocation, els.filterRarity, els.sortSelect]
    .forEach((control) => control?.addEventListener('input', refreshAll));
  [els.filterSpecies, els.filterCategory, els.filterLocation, els.filterRarity, els.sortSelect]
    .forEach((control) => control?.addEventListener('change', refreshAll));

  els.clearFilters?.addEventListener('click', clearFilters);
  els.bulkDelete?.addEventListener('click', () => openDeleteModal(selectedIds()));
  els.selectAllSightings?.addEventListener('change', (event) => {
    document.querySelectorAll('.row-select').forEach((box) => { box.checked = event.target.checked; });
  });

  els.exportJson?.addEventListener('click', exportJSON);
  els.exportCsv?.addEventListener('click', exportCSV);
  els.exportPrint?.addEventListener('click', exportPrint);
  els.importJsonBtn?.addEventListener('click', () => els.importJsonFile?.click());
  els.importJsonFile?.addEventListener('change', (event) => importBackup(event.target.files?.[0]));
  els.resetData?.addEventListener('click', resetAllData);
  els.themeToggle?.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

  const debouncedLocationSearch = debounce((event) => {
    selectedLocation = null;
    searchLocations(event.target.value.trim());
  }, 350);
  els.locationSearch?.addEventListener('input', debouncedLocationSearch);
  els.useCurrentLocation?.addEventListener('click', useCurrentLocation);
  document.addEventListener('click', (event) => {
    if (!els.locationSearch?.contains(event.target) && !els.locationSuggestions?.contains(event.target)) {
      els.locationSuggestions?.classList.remove('show');
    }
  });

  els.rarityInfoIcon?.addEventListener('click', () => openModal(els.rarityModal));
  els.modalClose?.addEventListener('click', () => closeModal(els.rarityModal));
  els.editModalClose?.addEventListener('click', closeEditModal);
  els.editModalCancel?.addEventListener('click', closeEditModal);
  els.editForm?.addEventListener('submit', saveEdit);
  els.deleteModalClose?.addEventListener('click', closeDeleteModal);
  els.cancelDeleteBtn?.addEventListener('click', closeDeleteModal);
  els.confirmDeleteBtn?.addEventListener('click', confirmDelete);
  [els.rarityModal, els.editModal, els.deleteModal].forEach((modal) => {
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  els.globalNavSearch?.addEventListener('input', (event) => {
    if (els.searchInput) els.searchInput.value = event.target.value;
    refreshAll();
  });

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((item) => item.classList.remove('is-active'));
      tab.classList.add('is-active');
    });
  });
}

let authMode = 'login';

function authShowGate(show) {
  const appNodes = [
    document.getElementById('mainNav'),
    document.querySelector('.hero-section'),
    document.getElementById('appSection'),
    document.querySelector('.page-footer')
  ];

  if (els.authGate) els.authGate.style.display = show ? 'grid' : 'none';
  appNodes.forEach((node) => {
    if (node) node.style.display = show ? 'none' : '';
  });
  if (els.authSessionBar) els.authSessionBar.style.display = show ? 'none' : 'flex';

  if (!show) {
    setTimeout(() => {
      if (realMap) realMap.invalidateSize();
      else initializeRealMap();
    }, 400);
  }
}

function authSetMode(mode) {
  authMode = mode;
  if (els.authLoginTab) { els.authLoginTab.classList.toggle('active', mode === 'login'); els.authLoginTab.setAttribute('aria-selected', mode === 'login'); }
  if (els.authRegisterTab) { els.authRegisterTab.classList.toggle('active', mode === 'register'); els.authRegisterTab.setAttribute('aria-selected', mode === 'register'); }
  if (els.authSubmit) els.authSubmit.textContent = mode === 'login' ? '🔐 Login' : '📝 Create Account';
  if (els.authFullNameField) els.authFullNameField.style.display = mode === 'register' ? 'grid' : 'none';
  if (els.authConfirmField) els.authConfirmField.style.display = mode === 'register' ? 'grid' : 'none';
  if (els.authError) els.authError.textContent = '';

  if (els.authHint) {
    els.authHint.innerHTML = mode === 'login' 
      ? 'New here? <button type="button" class="auth-link" id="authSwitchToRegister">Create account</button>'
      : 'Already have one? <button type="button" class="auth-link" id="authSwitchToRegister">Login</button>';
    $('authSwitchToRegister')?.addEventListener('click', () => authSetMode(mode === 'login' ? 'register' : 'login'));
  }
}

function authInit() {
  els.authLoginTab?.addEventListener('click', () => authSetMode('login'));
  els.authRegisterTab?.addEventListener('click', () => authSetMode('register'));
  els.logoutBtn?.addEventListener('click', () => Auth.logout());

  els.authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = els.authUsername.value.trim();
    const pass = els.authPassword.value;
    const full = els.authFullName?.value.trim();
    
    try {
      if (authMode === 'login') await Auth.login(user, pass);
      else await Auth.register(user, pass, full);
      
      // Immediately fetch data and show app
      authShowGate(false);
      if (els.authSessionName) els.authSessionName.textContent = `👤 ${user}`;
      await loadSpeciesDataset(); 
      showToast('Welcome back! Loading your sightings...');
    } catch (err) {
      els.authError.textContent = err.message;
    }
  });

  if (Auth.isLoggedIn()) {
    const user = Auth.getCurrentUser();
    if (els.authSessionName) els.authSessionName.textContent = `👤 ${user.username}`;
    authShowGate(false);
    loadSpeciesDataset();
  } else {
    authShowGate(true);
    authSetMode('login');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindEvents();
  authInit();
});
