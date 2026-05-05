// Citizen Science Species Log - professional SDG 15 app controller.
// The code keeps the original single-page architecture, but separates
// persistence, rendering, filtering, charts, map, and modal behavior.

const datasetUrl = 'species_baseline.json';
const storageKey = 'citizenScienceSightings'; // primary localStorage key for sightings
const themeKey = 'citizenScienceTheme';

const $ = (id) => document.getElementById(id);

const els = {
  speciesSelect: $('speciesSelect'),
  categoryDisplay: $('categoryDisplay'),
  dateInput: $('dateInput'),
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
  deleteModalMessage: $('deleteModalMessage')
};

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
  if (!raw || !raw.species || !raw.location || !raw.date) return null;
  const info = getSpeciesInfo(raw.species);
  const lat = Number(raw.lat ?? raw.latitude);
  const lon = Number(raw.lon ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: raw.id || (window.DM ? DM.generateId(raw.species) : `${raw.species}-${Date.now()}`),
    species: raw.species,
    category: raw.category || info.category,
    date: raw.date,
    time: raw.time || '',
    lat,
    lon,
    location: raw.location,
    notes: raw.notes || '',
    image: raw.image || raw.imageData || '',
    favorite: Boolean(raw.favorite),
    conservationStatus: raw.conservationStatus || info.conservation_status || 'Unknown',
    rarityIndex: Number(raw.rarityIndex) || 0,
    rarityLabel: raw.rarityLabel || 'Insufficient Data',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    // ── Ownership fields ─ MUST be preserved for role-based filtering ──
    userId: raw.userId || '',
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

async function saveSightings() {
  // Data is now saved to database via API calls
  // This function is kept for backward compatibility only
}

async function saveSightingToAPI(sightingData) {
  try {
    if (!window.DM) throw new Error('Data manager not available');
    const saved = await DM.addSighting(sightingData);
    return saved;
  } catch (error) {
    console.error('Failed to save sighting:', error);
    throw error;
  }
}

async function loadStoredSightings() {
  try {
    if (!window.DM) {
      showToast('Data manager not available', 'error');
      sightings = [];
      return;
    }
    const loaded = await DM.load();
    sightings = dedupeSightings(Array.isArray(loaded) ? loaded : []);
    updateAllRarityProperties();
  } catch (error) {
    console.error('Failed to load sightings:', error);
    showToast('Failed to load sightings: ' + error.message, 'error');
    sightings = [];
  }
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
  refreshSelect(els.filterLocation, Array.from(new Set(sightings.map((s) => s.location))).sort(), 'All');
}

function computeRarity(speciesName) {
  const info = getSpeciesInfo(speciesName);
  const actual = sightings.filter((item) => item.species === speciesName).length;
  return actual / Math.max(info.expected_annual_frequency || 1, 1);
}

function getRarityInfo(speciesName) {
  const actual = sightings.filter((item) => item.species === speciesName).length;
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
    const searchable = `${sighting.species} ${sighting.category} ${sighting.location} ${sighting.notes}`.toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    const matchesSpecies = !speciesFilter || sighting.species === speciesFilter;
    const matchesCategory = !categoryFilter || sighting.category === categoryFilter;
    const matchesLocation = !locationFilter || sighting.location === locationFilter;
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

function imageForSighting(sighting) {
  if (sighting.image) return sighting.image;
  if (memoryImageCache.has(sighting.species)) return memoryImageCache.get(sighting.species);
  const cached = window.DM && DM.getCachedImage ? DM.getCachedImage(sighting.species) : '';
  if (cached) {
    memoryImageCache.set(sighting.species, cached);
    return cached;
  }
  return placeholderFor(sighting.category);
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
  if (sighting.image) return sighting.image;
  const cached = imageForSighting(sighting);
  if (cached && !cached.includes('placehold.co')) return cached;

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
  const images = Array.from(root.querySelectorAll('img[data-species-image="true"]'));
  await Promise.all(images.map(async (img) => {
    const sighting = sightings.find((item) => item.id === img.dataset.sightingId) || {
      species: img.dataset.species,
      category: img.dataset.category,
      image: ''
    };
    const url = await getSpeciesImageUrl(sighting);
    if (url && img.src !== url) img.src = url;
  }));
}

function renderSightingsTable() {
  const filtered = getFilteredSightings();
  els.tableBody.innerHTML = '';

  if (!filtered.length) {
    els.tableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No sightings match the current filters.</td></tr>';
    return;
  }

  filtered.forEach((sighting) => {
    const rarity = getRarityInfo(sighting.species);
    const row = document.createElement('tr');
    row.className = sighting.favorite ? 'favorite-row' : '';
    row.innerHTML = `
      <td><input type="checkbox" class="row-select" data-id="${escapeHTML(sighting.id)}" aria-label="Select ${escapeHTML(sighting.species)}" /></td>
      <td><img class="table-thumb" src="${escapeHTML(imageForSighting(sighting))}" alt="${escapeHTML(sighting.species)} photo" loading="lazy" data-species-image="true" data-sighting-id="${escapeHTML(sighting.id)}" data-species="${escapeHTML(sighting.species)}" data-category="${escapeHTML(sighting.category)}" /></td>
      <td><strong>${escapeHTML(sighting.species)}</strong>${sighting.favorite ? '<span class="favorite-mark">Favorite</span>' : ''}</td>
      <td><span class="category-pill" style="--pill-color:${categoryColors[sighting.category] || categoryColors.Other}">${escapeHTML(sighting.category)}</span></td>
      <td>${escapeHTML(sighting.location)}</td>
      <td>${escapeHTML(sighting.date)}${sighting.time ? `<br><small>${escapeHTML(sighting.time)}</small>` : ''}</td>
      <td><span class="badge ${rarity.className}">${escapeHTML(rarity.label)}</span><br><small>${escapeHTML(sighting.conservationStatus)}</small></td>
      <td>${escapeHTML(sighting.notes || '-')}</td>
      <td class="table-actions">
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
  const unique = new Set(sightings.map((item) => item.species));
  const locationCounts = sightings.reduce((acc, s) => {
    acc[s.location] = (acc[s.location] || 0) + 1;
    return acc;
  }, {});
  const speciesCounts = getSpeciesCounts();
  const topLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const rareTotal = sightings.filter((s) => getRarityInfo(s.species).label === 'Rare / Unexpected').length;
  const endangeredTotal = sightings.filter((s) => isEndangeredStatus(s.conservationStatus)).length;
  const topSpeciesCount = Math.max(...Object.values(speciesCounts), 0);
  const score = sightings.length
    ? Math.min(100, Math.round((unique.size / Math.max(sightings.length, 1)) * 55 + (endangeredTotal / sightings.length) * 25 + (rareTotal / sightings.length) * 20))
    : 0;

  els.totalSightings.textContent = sightings.length;
  els.uniqueSpecies.textContent = unique.size;
  els.commonLocation.textContent = topLocation;
  els.rareCount.textContent = rareTotal;
  if (els.endangeredCount) els.endangeredCount.textContent = endangeredTotal;
  if (els.biodiversityScore) els.biodiversityScore.textContent = `${score}%`;
  if (els.previewTotal) els.previewTotal.textContent = sightings.length;
  if (els.previewSpecies) els.previewSpecies.textContent = unique.size;
  if (els.previewLocation) els.previewLocation.textContent = topLocation;
  window.__topSpeciesCount = topSpeciesCount;
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
        <img src="${escapeHTML(imageForSighting(sighting))}" alt="${escapeHTML(sighting.species)}" data-species-image="true" data-sighting-id="${escapeHTML(sighting.id)}" data-species="${escapeHTML(sighting.species)}" data-category="${escapeHTML(sighting.category)}" loading="lazy">
        <div class="species-card-body">
          <div class="species-card-top">
            <span class="category-pill" style="--pill-color:${categoryColors[sighting.category] || categoryColors.Other}">${escapeHTML(sighting.category)}</span>
            <span class="badge ${rarity.className}">${escapeHTML(rarity.label)}</span>
          </div>
          <h3>${escapeHTML(sighting.species)}</h3>
          <p>${escapeHTML(sighting.location)}</p>
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

function countBy(field) {
  return sightings.reduce((acc, item) => {
    const value = item[field] || 'Unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function monthlyCounts() {
  const counts = {};
  sightings.forEach((s) => {
    const key = (s.date || '').slice(0, 7) || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
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
  const species = topEntries(countBy('species'), 5);
  const locations = topEntries(countBy('location'), 6);
  const categories = topEntries(countBy('category'), 8);
  const months = Object.entries(monthlyCounts()).sort((a, b) => a[0].localeCompare(b[0]));
  const colors = categories.map(([label]) => categoryColors[label] || categoryColors.Other);

  speciesChart = upsertChart('speciesChart', speciesChart, {
    type: 'bar',
    data: { labels: species.map((i) => i[0]), datasets: [{ data: species.map((i) => i[1]), backgroundColor: '#22c55e', borderRadius: 8, label: 'Sightings' }] },
    options: { ...chartOptions(), plugins: { ...chartOptions().plugins, legend: { display: false } } }
  });

  locationChart = upsertChart('locationChart', locationChart, {
    type: 'doughnut',
    data: { labels: locations.map((i) => i[0]), datasets: [{ data: locations.map((i) => i[1]), backgroundColor: ['#22c55e', '#38bdf8', '#f59e0b', '#a78bfa', '#ef4444', '#14b8a6'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: chartOptions().plugins }
  });

  categoryChart = upsertChart('categoryChart', categoryChart, {
    type: 'bar',
    data: { labels: categories.map((i) => i[0]), datasets: [{ data: categories.map((i) => i[1]), backgroundColor: colors, borderRadius: 8, label: 'Sightings' }] },
    options: chartOptions()
  });

  monthlyChart = upsertChart('monthlyChart', monthlyChart, {
    type: 'line',
    data: { labels: months.map((i) => i[0]), datasets: [{ data: months.map((i) => i[1]), label: 'Monthly sightings', borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.18)', fill: true, tension: 0.35 }] },
    options: chartOptions()
  });
}

function initializeRealMap() {
  if (!window.L || realMap) return;
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

/* ── Auth helper — resolves current user's role ─────────── */
function getAuthUserRole(userId) {
  // Get current user from Auth session
  if (window.Auth) {
    const currentUser = window.Auth.getCurrentUser();
    if (currentUser) return currentUser.role;
  }
  return 'user';
}

function markerPopup(sighting) {
  const rarity = getRarityInfo(sighting.species);
  const score = Math.max(5, Math.min(100, Math.round((1 / Math.max(sighting.rarityIndex || 1, 0.1)) * 14)));
  const uRole = getAuthUserRole(sighting.userId);
  const roleBadge = (uRole === 'admin' || uRole === 'super_admin') ? `<span class="badge badge-normal" style="margin-left:5px">Admin</span>` : '';
  return `
    <div class="popup-card" id="popup-${escapeHTML(sighting.id)}">
      <img src="${escapeHTML(imageForSighting(sighting))}" alt="${escapeHTML(sighting.species)}" class="popup-image" data-species-image="true" data-sighting-id="${escapeHTML(sighting.id)}" data-species="${escapeHTML(sighting.species)}" data-category="${escapeHTML(sighting.category)}">
      <div class="popup-main">
        <span class="popup-kicker">${escapeHTML(sighting.category)} observation</span>
        <h3>${escapeHTML(sighting.species)}</h3>
        <p class="popup-scientific">Citizen science field record</p>
      </div>
      <div class="popup-meta-grid">
        <span><strong>Location</strong>${escapeHTML(sighting.location)}</span>
        <span><strong>Date</strong>${escapeHTML(sighting.date)}${sighting.time ? `, ${escapeHTML(sighting.time)}` : ''}</span>
        <span><strong>Rarity</strong>${escapeHTML(rarity.label)}</span>
        <span><strong>Status</strong>${escapeHTML(sighting.conservationStatus)}</span>
      </div>
      <p class="popup-notes">${escapeHTML(sighting.notes || 'No notes available')}</p>
      <div class="popup-footer">
        <span>${sighting.favorite ? 'Favorite record' : 'Field record'}</span>
        <span>Logged by: ${escapeHTML(sighting.username || 'Unknown')} ${roleBadge}</span>
        <span>Biodiversity score ${score}</span>
      </div>
    </div>
  `;
}

function renderMapMarkers() {
  if (!realMap || !markerLayer || !hotspotLayer) return;
  markerLayer.clearLayers();
  hotspotLayer.clearLayers();
  const filtered = getFilteredSightings();
  const bounds = [];

  filtered.forEach((sighting) => {
    const color = categoryColors[sighting.category] || categoryColors.Other;
    const rare = getRarityInfo(sighting.species).label === 'Rare / Unexpected';
    const marker = L.circleMarker([sighting.lat, sighting.lon], {
      radius: rare ? 10 : 7,
      fillColor: color,
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
    hotspotLayer.addLayer(L.circle([sighting.lat, sighting.lon], {
      radius: rare ? 18000 : 10000,
      color,
      fillColor: color,
      fillOpacity: rare ? 0.16 : 0.08,
      weight: 1,
      interactive: false
    }));
    bounds.push([sighting.lat, sighting.lon]);
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
  const sightingData = {
    species: speciesName,
    category: info.category,
    date: els.dateInput.value,
    time: els.timeInput?.value || '',
    location: selectedLocation.name,
    lat: selectedLocation.lat,
    lon: selectedLocation.lon,
    notes: els.notesInput.value.trim(),
    image: pendingImageData,
    favorite: Boolean(els.favoriteInput?.checked),
    conservationStatus: info.conservation_status
  };

  try {
    const savedSighting = await saveSightingToAPI(sightingData);
    sightings.push(savedSighting);
    updateAllRarityProperties();
    resetForm();
    refreshAll();
    showToast('✓ Sighting added successfully!');
  } catch (error) {
    console.error('Failed to add sighting:', error);
    showToast('Failed to add sighting: ' + error.message, 'error');
  }
}

function openEditModal(id) {
  const sighting = sightings.find((item) => item.id === id);
  if (!sighting) return;
  els.editSightingId.value = sighting.id;
  els.editSpecies.value = sighting.species;
  els.editCategory.value = sighting.category;
  els.editLocation.value = sighting.location;
  els.editDate.value = sighting.date;
  if (els.editTime) els.editTime.value = sighting.time || '';
  els.editNotes.value = sighting.notes || '';
  if (els.editFavorite) els.editFavorite.checked = Boolean(sighting.favorite);
  editPendingImageData = '';
  if (els.editImagePreview) els.editImagePreview.src = sighting.image || '';
  if (els.editImagePreviewWrapper) els.editImagePreviewWrapper.style.display = sighting.image ? 'block' : 'none';
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
    location: els.editLocation.value.trim() || current.location,
    date: els.editDate.value,
    time: els.editTime?.value || '',
    notes: els.editNotes.value.trim(),
    favorite: Boolean(els.editFavorite?.checked),
    image: editPendingImageData || current.image || ''
  };

  try {
    if (!window.DM) throw new Error('Data manager not available');
    const updatedSighting = await DM.updateSighting(id, updateData);
    sightings = sightings.map((item) =>
      item._id === id || item.id === id ? { ...item, ...updatedSighting } : item
    );
    updateAllRarityProperties();
    closeEditModal();
    refreshAll();
    showToast('✓ Sighting updated successfully!');
  } catch (error) {
    console.error('Failed to update sighting:', error);
    showToast('Failed to update sighting: ' + error.message, 'error');
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
    if (!window.DM) throw new Error('Data manager not available');
    for (const id of deleteQueue) {
      await DM.deleteSighting(id);
    }
    sightings = sightings.filter((item) => !deleteQueue.includes(item.id) && !deleteQueue.includes(item._id));
    updateAllRarityProperties();
    closeDeleteModal();
    refreshAll();
    showToast('✓ Sighting(s) deleted successfully!');
  } catch (error) {
    console.error('Failed to delete sightings:', error);
    showToast('Failed to delete sightings: ' + error.message, 'error');
  }
}

function handleTableClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === 'edit') openEditModal(id);
  if (button.dataset.action === 'delete') openDeleteModal(id);
  if (button.dataset.action === 'favorite') {
    const sighting = sightings.find(item => item.id === id || item._id === id);
    if (sighting && window.DM) {
      const updateData = { favorite: !sighting.favorite };
      DM.updateSighting(id, updateData).then(updated => {
        sightings = sightings.map((item) =>
          (item.id === id || item._id === id) ? { ...item, ...updated } : item
        );
        refreshAll();
      }).catch(error => {
        console.error('Failed to update favorite:', error);
        showToast('Failed to update favorite status: ' + error.message, 'error');
      });
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
  if (!confirm('Are you sure you want to clear ALL your sightings from the database? This cannot be undone.')) {
    return;
  }
  
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
  if (window.DM) DM.exportJSON(sightings);
}

function exportCSV() {
  if (window.DM) DM.exportCSV(sightings);
}

function exportPrint() {
  if (window.DM) DM.exportPrintReport(sightings);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ── Species dataset loader ─────────────────────────────────────── */
async function loadSpeciesDataset() {
  try {
    const res = await fetch(datasetUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.data) ? raw.data : []);
    speciesData = arr.map(normalizeSpeciesEntry);
    speciesMap = new Map(speciesData.map((s) => [s.name, s]));
  } catch (err) {
    console.warn('[loadSpeciesDataset] Species baseline failed:', err);
    // Continue even if species file is missing
  }
  initializeFormOptions();
  await loadStoredSightings(); // migrate + apply visibility
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
      lon: position.coords.longitude
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

  loadStoredSightings(); 
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

// ===== Additive Auth + Role-Based Visibility Layer =====
// Storage keys — must stay in sync with authManager.js
const AUTH_ALL_SIGHTINGS_KEY = 'biodiversity_all_sightings';
const AUTH_USERS_KEY = 'biodiversity_users';
const AUTH_SESSION_KEY = 'biodiversity_current_user';

// Super-admin credentials: samadhan / samadhan
const AUTH_ADMIN = {
  userId: 'samadhan-root',
  username: 'samadhan',
  role: 'super_admin'
};
// Legacy owner for sightings created before auth was added
const AUTH_LEGACY_OWNER = {
  userId: 'samadhan-root',
  username: 'samadhan'
};

let authMode = 'login';
let currentAuthUser = null;

async function authHashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function authReadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function authWriteJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function authGetUsers() {
  return authReadJSON(AUTH_USERS_KEY, []);
}

function authSetUsers(users) {
  authWriteJSON(AUTH_USERS_KEY, users);
}

function authGetAllSightings() {
  return authReadJSON(AUTH_ALL_SIGHTINGS_KEY, []);
}

function authSetAllSightings(records) {
  authWriteJSON(AUTH_ALL_SIGHTINGS_KEY, records);
}

// ── MASTER ROLE CHECK ── super_admin and admin both have elevated access
function authIsAdmin() {
  return Boolean(
    currentAuthUser &&
    (currentAuthUser.role === 'admin' || currentAuthUser.role === 'super_admin')
  );
}

// Kept here as single authoritative definition (also defined near markerPopup for map use)
function getAuthUserRole(userId) {
  if (!userId) return 'user';
  if (userId === AUTH_ADMIN.userId) return 'super_admin';
  try {
    const users = authGetUsers();
    const found = users.find((u) => u.userId === userId);
    return found ? found.role : 'user';
  } catch { return 'user'; }
}

function authAttachOwner(record) {
  if (record.userId && record.username) return record;
  return {
    ...record,
    userId: AUTH_LEGACY_OWNER.userId,
    username: AUTH_LEGACY_OWNER.username
  };
}

function authVisibleRecords(records) {
  const owned = records.map(authAttachOwner);
  if (authIsAdmin()) return owned;
  return owned.filter((item) => item.userId === currentAuthUser.userId);
}

/*
 * ── MASTER DATABASE ARCHITECTURE ──────────────────────────────────────────
 * masterSightings  =  ALL sightings from ALL users  (single source of truth)
 * getVisibleSightings() = role-filtered VIEW of the master DB
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Public API: returns sightings the current user is allowed to see */
function getVisibleSightings() {
  if (!currentAuthUser) return [];
  const master = authGetAllSightings();
  if (authIsAdmin()) return master;
  return master.filter((s) => s.userId === currentAuthUser.userId);
}

const AUTH_MIGRATED_KEY = 'biodiversity_sightings_migrated_v2';

function authMigrateExistingSightingsOnce() {
  // Guard: only run once per device so old global data doesn't keep leaking in
  if (localStorage.getItem(AUTH_MIGRATED_KEY) === 'done') return;

  const existingAll = authGetAllSightings();
  // Read old shared storage (citizenScienceSightings)
  let legacyLoaded = [];
  try {
    const legacyRaw = window.DM && DM.load ? DM.load() : authReadJSON(storageKey, []);
    legacyLoaded = Array.isArray(legacyRaw) ? legacyRaw : [];
  } catch { legacyLoaded = []; }

  const mergedById = new Map();

  // Existing auth-aware sightings take priority
  existingAll.forEach((item) => {
    const patched = authAttachOwner(item);
    if (patched.id) mergedById.set(patched.id, patched);
  });

  // Legacy sightings: assign to samadhan-root (admin) if no owner
  legacyLoaded.forEach((item) => {
    const patched = authAttachOwner(item);
    if (patched.id && !mergedById.has(patched.id)) mergedById.set(patched.id, patched);
  });

  authSetAllSightings(Array.from(mergedById.values()));
  localStorage.setItem(AUTH_MIGRATED_KEY, 'done');
}

function authRefreshAdminTools() {
  const bar = document.getElementById('authSessionBar');
  const name = document.getElementById('authSessionName');
  const count = document.getElementById('authUserCount');
  const filter = document.getElementById('adminUserFilter');
  const adminNavTab = document.getElementById('adminNavTab');
  const adminPanel = document.getElementById('adminPanel');

  if (!bar || !name || !count || !filter || !currentAuthUser) return;

  bar.style.display = 'flex';
  name.textContent = authIsAdmin()
    ? `${currentAuthUser.role === 'super_admin' ? '👑 Super Admin' : '🛡️ Admin'}: ${currentAuthUser.username}`
    : `👤 ${currentAuthUser.username}`;

  const users = authGetUsers();
  count.hidden = !authIsAdmin();
  count.textContent = `Users: ${users.length}`;

  filter.hidden = !authIsAdmin();
  if (authIsAdmin()) {
    const previous = filter.value;
    const allRecords = authGetAllSightings();
    const userOptions = Array.from(new Map(
      allRecords.map((r) => [r.userId || AUTH_LEGACY_OWNER.userId, r.username || AUTH_LEGACY_OWNER.username])
    ).entries());

    filter.innerHTML = '<option value="">All Users</option>' + userOptions
      .map(([userId, username]) => `<option value="${escapeHTML(userId)}">${escapeHTML(username)}</option>`)
      .join('');

    filter.value = previous;
  }

  if (adminNavTab) adminNavTab.style.display = authIsAdmin() ? '' : 'none';
  // Render admin panel if it's currently visible
  if (adminPanel && adminPanel.style.display !== 'none' && authIsAdmin()) {
    if (window.Auth && Auth.renderAdminPanel) Auth.renderAdminPanel();
  }
}

/* Simple dedup that preserves ownership — does NOT call normalizeSighting */
function authSafeDedup(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    if (!item || !item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function authApplyVisibility() {
  const allRecords = authGetAllSightings();
  let visible = authVisibleRecords(allRecords);

  const adminFilter = document.getElementById('adminUserFilter');
  if (authIsAdmin() && adminFilter && adminFilter.value) {
    visible = visible.filter((item) => item.userId === adminFilter.value);
  }

  // Use authSafeDedup — NOT dedupeSightings — to avoid stripping ownership
  sightings = authSafeDedup(visible);
  updateAllRarityProperties();
  authRefreshAdminTools();
  refreshAll();
}

function authShowGate(show) {
  const gate = document.getElementById('authGate');
  const bar = document.getElementById('authSessionBar');
  const appNodes = [
    document.getElementById('mainNav'),
    document.querySelector('.hero-section'),
    document.getElementById('appSection'),
    document.querySelector('.page-footer')
  ];

  if (gate) gate.style.display = show ? 'grid' : 'none';
  appNodes.forEach((node) => {
    if (node) node.style.display = show ? 'none' : '';
  });
  if (bar) bar.style.display = show ? 'none' : 'flex';

  if (!show && realMap) {
    setTimeout(() => realMap.invalidateSize(), 300);
  }
}

function authSetMode(mode) {
  authMode = mode;
  const loginTab = document.getElementById('authLoginTab');
  const registerTab = document.getElementById('authRegisterTab');
  const submit = document.getElementById('authSubmit');
  const hint = document.getElementById('authHint');
  const switchBtn = document.getElementById('authSwitchToRegister');
  const fullNameField = document.getElementById('authFullNameField');
  const confirmField = document.getElementById('authConfirmField');
  const rememberRow = document.getElementById('authRememberRow');

  if (loginTab) { loginTab.classList.toggle('active', mode === 'login'); loginTab.setAttribute('aria-selected', mode === 'login'); }
  if (registerTab) { registerTab.classList.toggle('active', mode === 'register'); registerTab.setAttribute('aria-selected', mode === 'register'); }

  if (submit) submit.textContent = mode === 'login' ? '🔐 Login' : '📝 Create Account';
  if (fullNameField) fullNameField.style.display = mode === 'register' ? 'grid' : 'none';
  if (confirmField) confirmField.style.display = mode === 'register' ? 'grid' : 'none';
  if (rememberRow) rememberRow.style.display = mode === 'login' ? 'flex' : 'none';

  if (hint && switchBtn) {
    if (mode === 'login') {
      hint.innerHTML = 'New here? <button type="button" class="auth-link" id="authSwitchToRegister">Create account</button>';
    } else {
      hint.innerHTML = 'Already have one? <button type="button" class="auth-link" id="authSwitchToRegister">Login</button>';
    }
    document.getElementById('authSwitchToRegister')?.addEventListener('click', () => authSetMode(mode === 'login' ? 'register' : 'login'));
  }

  const error = document.getElementById('authError');
  if (error) error.textContent = '';
}

async function authRegister(username, password) {
  const cleanUsername = username.trim();
  const fullName = document.getElementById('authFullName')?.value.trim() || cleanUsername;
  const confirmPass = document.getElementById('authConfirmPassword')?.value || '';

  if (!cleanUsername || !password) throw new Error('Username and password are required.');
  if (cleanUsername.length < 3) throw new Error('Username must be at least 3 characters.');
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  if (confirmPass && confirmPass !== password) throw new Error('Passwords do not match.');
  if (cleanUsername.toLowerCase() === 'samadhan') throw new Error('This username is reserved.');

  const users = authGetUsers();
  if (users.some((user) => user.username.toLowerCase() === cleanUsername.toLowerCase())) {
    throw new Error('Username already taken. Choose another.');
  }

  const user = {
    userId: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName,
    username: cleanUsername,
    passwordHash: await authHashPassword(password),
    role: 'user',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    isActive: true
  };

  users.push(user);
  authSetUsers(users);

  currentAuthUser = { userId: user.userId, username: user.username, fullName: user.fullName, role: user.role };
  authWriteJSON(AUTH_SESSION_KEY, currentAuthUser);
}

async function authLogin(username, password) {
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) throw new Error('Username and password are required.');

  // Hard-coded super-admin bypass — samadhan / samadhan
  if (cleanUsername.toLowerCase() === 'samadhan' &&
      (password === 'samadhan' || password === 'Samadhan@123')) {
    currentAuthUser = { ...AUTH_ADMIN };
    authWriteJSON(AUTH_SESSION_KEY, currentAuthUser);
    return;
  }

  const users = authGetUsers();
  const user = users.find((item) => item.username.toLowerCase() === cleanUsername.toLowerCase());
  if (!user) throw new Error('User not found. Please register first.');
  if (user.isActive === false) throw new Error('Account disabled. Contact admin.');

  const passwordHash = await authHashPassword(password);
  if (passwordHash !== user.passwordHash) throw new Error('Incorrect password.');

  // Update lastLogin
  user.lastLogin = new Date().toISOString();
  authSetUsers(users);

  currentAuthUser = { userId: user.userId, username: user.username, fullName: user.fullName || user.username, role: user.role };
  authWriteJSON(AUTH_SESSION_KEY, currentAuthUser);
}

function authLogout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  currentAuthUser = null;
  sightings = [];
  authShowGate(true);
}

// Override normalizeSighting: stamp new/legacy sightings with owner; preserve existing ownership.
const authOriginalNormalizeSighting = normalizeSighting;
normalizeSighting = function authNormalizeSighting(raw) {
  const normalized = authOriginalNormalizeSighting(raw);
  if (!normalized) return null;

  // If the RAW record already has an owner, preserve it faithfully
  if (raw.userId) {
    return {
      ...normalized,
      userId: raw.userId,
      username: raw.username || '',
      roleAtCreation: raw.roleAtCreation || raw.role || ''
    };
  }

  // Brand-new sighting being created — stamp with the current logged-in user
  if (currentAuthUser) {
    return {
      ...normalized,
      userId: currentAuthUser.userId,
      username: currentAuthUser.username,
      roleAtCreation: currentAuthUser.role
    };
  }

  // Fallback for legacy/unowned — assign to super-admin
  return {
    ...normalized,
    userId: AUTH_LEGACY_OWNER.userId,
    username: AUTH_LEGACY_OWNER.username,
    roleAtCreation: 'super_admin'
  };
};

loadStoredSightings = function authLoadStoredSightings() {
  authMigrateExistingSightingsOnce();
  authApplyVisibility();
};

saveSightings = function authSaveSightings() {
  if (!currentAuthUser) return;
  const master = authGetAllSightings();

  let nextMaster;
  if (authIsAdmin()) {
    // Admin edited/deleted from their view — merge changes back into master
    const visibleIds = new Set(sightings.map((s) => s.id));
    const others = master.filter((s) => !visibleIds.has(s.id));
    nextMaster = [...others, ...sightings.map(authAttachOwner)];
  } else {
    // Normal user — replace only their slice of the master DB
    const others = master.filter((s) => s.userId !== currentAuthUser.userId);
    const mine = sightings.map((s) => ({
      ...s,
      userId: currentAuthUser.userId,
      username: currentAuthUser.username,
      roleAtCreation: currentAuthUser.role
    }));
    nextMaster = [...others, ...mine];
  }

  // authSafeDedup: never calls normalizeSighting, never strips ownership
  authSetAllSightings(authSafeDedup(nextMaster));
};

exportJSON = function authExportJSON() {
  if (window.DM) DM.exportJSON(sightings);
};

exportCSV = function authExportCSV() {
  if (window.DM) DM.exportCSV(sightings);
};

exportPrint = function authExportPrint() {
  if (window.DM) DM.exportPrintReport(sightings);
};

resetAllData = function authResetAllData() {
  if (!currentAuthUser) return;

  if (authIsAdmin()) {
    if (!confirm('Admin: clear ALL sightings from ALL users?')) return;
    authSetAllSightings([]);
  } else {
    if (!confirm('Clear only your sightings?')) return;
    const remaining = authGetAllSightings().filter((item) => item.userId !== currentAuthUser.userId);
    authSetAllSightings(remaining);
  }

  authApplyVisibility();
  showToast('Sightings cleared.');
};

window.authPromoteUser = function (userId) {
  const users = authGetUsers();
  const user = users.find((u) => u.userId === userId);
  if (user) {
    user.role = 'admin';
    authSetUsers(users);
    renderAdminDashboard();
    showToast(`✅ ${user.username} promoted to Admin.`);
  }
};

window.authDemoteUser = function (userId) {
  const users = authGetUsers();
  const user = users.find((u) => u.userId === userId);
  if (user && user.role !== 'super_admin') {
    user.role = 'user';
    authSetUsers(users);
    renderAdminDashboard();
    showToast(`↙️ ${user.username} demoted to User.`);
  }
};

window.authToggleDisable = function (userId) {
  const users = authGetUsers();
  const user = users.find((u) => u.userId === userId);
  if (user && user.userId !== AUTH_ADMIN.userId) {
    user.isActive = user.isActive === false ? true : false;
    authSetUsers(users);
    renderAdminDashboard();
    showToast(user.isActive ? `Account re-enabled.` : `Account disabled.`);
  }
};

window.authDeleteUser = function (userId) {
  if (userId === AUTH_ADMIN.userId) { showToast('Cannot delete super admin.', 'error'); return; }
  if (!confirm('Delete this user and all their sightings? This cannot be undone.')) return;
  authSetUsers(authGetUsers().filter((u) => u.userId !== userId));
  authSetAllSightings(authGetAllSightings().filter((s) => s.userId !== userId));
  renderAdminDashboard();
  authApplyVisibility();
  showToast('User deleted.');
};

function renderAdminDashboard() {
  const adminPanel = document.getElementById('adminPanel');
  if (!adminPanel || !authIsAdmin()) return;

  // Try the richer authManager.js panel first; fall back to inline table
  if (window.Auth && typeof Auth.renderAdminPanel === 'function') {
    Auth.renderAdminPanel();
    return;
  }

  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = authGetUsers();
  const master = authGetAllSightings();

  tbody.innerHTML = users.map((user) => {
    const isSelf = user.userId === currentAuthUser.userId;
    const count = master.filter((s) => s.userId === user.userId).length;
    const roleColor = user.role === 'super_admin' ? '#ef4444' : user.role === 'admin' ? '#f59e0b' : '#3b82f6';
    const statusBadge = user.isActive === false ? '<span style="color:#f87171;font-size:.75rem"> [disabled]</span>' : '';

    let actions = '';
    if (!isSelf && currentAuthUser.role === 'super_admin') {
      if (user.role === 'admin') {
        actions += `<button class="btn btn-secondary small" onclick="authDemoteUser('${user.userId}')">Demote</button> `;
      } else if (user.role === 'user') {
        actions += `<button class="btn btn-secondary small" onclick="authPromoteUser('${user.userId}')">Promote</button> `;
      }
      if (user.role !== 'super_admin') {
        const disabled = user.isActive === false;
        actions += `<button class="btn btn-secondary small" onclick="authToggleDisable('${user.userId}')">${disabled ? 'Enable' : 'Disable'}</button> `;
        actions += `<button class="btn btn-danger small" onclick="authDeleteUser('${user.userId}')">Delete</button>`;
      }
    } else if (!isSelf && currentAuthUser.role === 'admin' && user.role === 'user') {
      actions += `<button class="btn btn-danger small" onclick="authDeleteUser('${user.userId}')">Delete</button>`;
    }

    return `
      <tr>
        <td><strong>${escapeHTML(user.username)}</strong>${statusBadge}</td>
        <td><span class="category-pill" style="--pill-color:${roleColor}">${escapeHTML(user.role)}</span></td>
        <td>${count}</td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
        <td class="table-actions">${actions}</td>
      </tr>
    `;
  }).join('');
}

function authBindUI() {
  const form = document.getElementById('authForm');
  const loginTab = document.getElementById('authLoginTab');
  const registerTab = document.getElementById('authRegisterTab');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminFilter = document.getElementById('adminUserFilter');

  loginTab?.addEventListener('click', () => authSetMode('login'));
  registerTab?.addEventListener('click', () => authSetMode('register'));

  // Wire the initial switch link
  document.getElementById('authSwitchToRegister')?.addEventListener('click', () => authSetMode('register'));

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('authUsername')?.value || '';
    const password = document.getElementById('authPassword')?.value || '';
    const error = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Please wait...'; }
    if (error) error.textContent = '';

    try {
      if (authMode === 'login') await authLogin(username, password);
      else await authRegister(username, password);

      authShowGate(false);
      // Load species dataset first if not already loaded, then apply visibility
      if (!speciesData.length) {
        await loadSpeciesDataset();
      }
      authApplyVisibility();
      showToast(`Welcome, ${currentAuthUser.username}! 🌿`);
    } catch (err) {
      if (error) error.textContent = err.message;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = authMode === 'login' ? '🔐 Login' : '📝 Create Account';
      }
    }
  });

  logoutBtn?.addEventListener('click', authLogout);
  adminFilter?.addEventListener('change', authApplyVisibility);
}

// Auto-seeds samadhan / samadhan as super_admin on very first load
async function authInitBootstrap() {
  const users = authGetUsers();
  if (!users.some((u) => u.username === 'samadhan')) {
    const hash = await authHashPassword('samadhan');
    users.push({
      userId: AUTH_ADMIN.userId,
      username: AUTH_ADMIN.username,
      passwordHash: hash,
      role: 'super_admin',
      createdAt: new Date().toISOString()
    });
    authSetUsers(users);
  }
}

function authInit() {
  authBindUI();
  currentAuthUser = authReadJSON(AUTH_SESSION_KEY, null);
  if (!currentAuthUser) {
    authShowGate(true);
    return;
  }
  // Valid session found — show the app immediately, data loads in loadSpeciesDataset()
  authShowGate(false);
  // Quick render with whatever is already in master DB (before fetch completes)
  const quick = getVisibleSightings();
  sightings = authSafeDedup(quick);
  updateAllRarityProperties();
  authRefreshAdminTools();
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  bindEvents();
  await authInitBootstrap();
  authInit();
  // Only load species+sightings after session is validated
  if (!currentAuthUser) return;
  await loadSpeciesDataset(); // fetch species JSON → loadStoredSightings → authApplyVisibility
});
