/* ========================================================
   Cookie Editor Pro — popup.js
   Full cookie management: CRUD, import/export, search, bulk
   ======================================================== */

'use strict';

// ─── State ───────────────────────────────────────────────
let allCookies = [];
let filteredCookies = [];
let selectedNames = new Set();
let currentTab = null;
let editingCookie = null; // null = new, object = existing
let currentExportFormat = 'json';
let currentImportFormat = 'json';
let exportCookieSubset = null; // null = all
let confirmCallback = null;

// ─── DOM Refs ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const domainText      = $('domain-text');
const cookieCount     = $('cookie-count');
const cookieList      = $('cookie-list');
const emptyState      = $('empty-state');
const searchInput     = $('search-input');
const btnClearSearch  = $('btn-clear-search');
const bulkBar         = $('bulk-bar');
const bulkText        = $('bulk-text');
const selectAllCb     = $('select-all-cb');
const selectAllFooter = $('select-all-footer');
const footerStatus    = $('footer-status');

// Panels
const panelOverlay    = $('panel-overlay');
const editPanel       = $('edit-panel');
const importPanel     = $('import-panel');
const exportPanel     = $('export-panel');
const confirmOverlay  = $('confirm-overlay');

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  bindEvents();
  await loadCurrentTab();
  await loadCookies();
});

// ─── Tab helpers ─────────────────────────────────────────
async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      domainText.textContent = url.hostname || tab.url;
    } catch {
      domainText.textContent = tab.url;
    }
  } else {
    domainText.textContent = 'No active tab';
  }
}

// ─── Load Cookies ─────────────────────────────────────────
async function loadCookies() {
  if (!currentTab || !currentTab.url) {
    renderCookies([]);
    return;
  }
  try {
    const url = new URL(currentTab.url);
    const domain = url.hostname;
    const cookies = await chrome.cookies.getAll({ url: currentTab.url });
    // Also get cookies for the bare domain
    const domainCookies = await chrome.cookies.getAll({ domain });
    // Merge & deduplicate by name+domain+path
    const map = new Map();
    [...cookies, ...domainCookies].forEach(c => {
      map.set(`${c.name}::${c.domain}::${c.path}`, c);
    });
    allCookies = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    filterAndRender();
    cookieCount.textContent = allCookies.length;
  } catch (e) {
    showToast('Failed to load cookies', 'error');
  }
}

// ─── Filter & Render ──────────────────────────────────────
function filterAndRender() {
  const query = searchInput.value.toLowerCase().trim();
  filteredCookies = query
    ? allCookies.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.value.toLowerCase().includes(query) ||
        c.domain.toLowerCase().includes(query)
      )
    : [...allCookies];
  renderCookies(filteredCookies);
}

function renderCookies(list) {
  // Remove old items (keep emptyState)
  Array.from(cookieList.querySelectorAll('.cookie-item')).forEach(el => el.remove());

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    footerStatus.textContent = searchInput.value ? 'No matches' : 'No cookies';
    return;
  }
  emptyState.classList.add('hidden');
  footerStatus.textContent = `${list.length} cookie${list.length !== 1 ? 's' : ''}`;

  list.forEach((cookie, i) => {
    const item = buildCookieItem(cookie, i);
    cookieList.appendChild(item);
  });

  updateBulkBar();
}

function buildCookieItem(cookie, idx) {
  const isSelected = selectedNames.has(cookieKey(cookie));
  const isSession = !cookie.expirationDate;

  const item = document.createElement('div');
  item.className = 'cookie-item' + (isSelected ? ' selected' : '');
  item.dataset.key = cookieKey(cookie);
  item.style.animationDelay = `${idx * 18}ms`;

  // Flags
  const flags = [];
  if (cookie.secure)   flags.push('<span class="flag-badge flag-secure">Secure</span>');
  if (cookie.httpOnly) flags.push('<span class="flag-badge flag-httponly">HttpOnly</span>');
  if (isSession)       flags.push('<span class="flag-badge flag-session">Session</span>');
  if (cookie.sameSite && cookie.sameSite !== 'no_restriction' && cookie.sameSite !== 'unspecified')
    flags.push(`<span class="flag-badge flag-samesite">${capitalize(cookie.sameSite)}</span>`);

  item.innerHTML = `
    <label class="checkbox-wrap item-check" onclick="event.stopPropagation()">
      <input type="checkbox" class="item-checkbox" ${isSelected ? 'checked' : ''} />
      <span class="checkmark"></span>
    </label>
    <div class="item-body">
      <div class="item-top">
        <div class="item-name">${escHtml(cookie.name || '(empty name)')}</div>
        ${flags.length ? `<div class="item-flags">${flags.join('')}</div>` : ''}
      </div>
      <div class="item-value">${escHtml(cookie.value || '—')}</div>
    </div>
    <div class="item-actions">
      <button class="item-btn edit-btn" title="Edit cookie">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="item-btn delete-btn" title="Delete cookie">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>
  `;

  // Click on body -> edit
  item.querySelector('.item-body').addEventListener('click', () => openEditPanel(cookie));
  item.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); openEditPanel(cookie); });
  item.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); confirmDeleteCookie(cookie); });
  item.querySelector('.item-checkbox').addEventListener('change', e => {
    e.stopPropagation();
    const key = cookieKey(cookie);
    if (e.target.checked) selectedNames.add(key);
    else selectedNames.delete(key);
    item.classList.toggle('selected', e.target.checked);
    syncSelectAllCheckbox();
    updateBulkBar();
  });

  return item;
}

// ─── Edit Panel ──────────────────────────────────────────
function openEditPanel(cookie = null) {
  editingCookie = cookie;
  $('panel-title').textContent = cookie ? 'Edit Cookie' : 'New Cookie';

  $('edit-name').value    = cookie ? cookie.name : '';
  $('edit-value').value   = cookie ? cookie.value : '';
  $('edit-domain').value  = cookie ? cookie.domain : (currentTab ? new URL(currentTab.url).hostname : '');
  $('edit-path').value    = cookie ? cookie.path : '/';

  const isSession = cookie ? !cookie.expirationDate : false;
  $('edit-session').checked  = isSession;
  $('edit-expires').disabled = isSession;
  if (cookie && cookie.expirationDate) {
    const d = new Date(cookie.expirationDate * 1000);
    $('edit-expires').value = toDatetimeLocal(d);
  } else {
    $('edit-expires').value = '';
  }

  $('edit-secure').checked   = cookie ? cookie.secure : false;
  $('edit-httponly').checked = cookie ? cookie.httpOnly : false;
  $('edit-hostonly').checked = cookie ? cookie.hostOnly : false;
  $('edit-samesite').value   = cookie ? (cookie.sameSite || 'no_restriction') : 'no_restriction';

  openPanel(editPanel);
}

$('edit-session').addEventListener('change', e => {
  $('edit-expires').disabled = e.target.checked;
  if (e.target.checked) $('edit-expires').value = '';
});

$('btn-panel-save').addEventListener('click', saveCookie);
$('btn-panel-close').addEventListener('click', () => closePanel(editPanel));
$('btn-panel-cancel').addEventListener('click', () => closePanel(editPanel));
panelOverlay.addEventListener('click', () => closeAllPanels());

async function saveCookie() {
  const name    = $('edit-name').value.trim();
  const value   = $('edit-value').value;
  const domain  = $('edit-domain').value.trim();
  const path    = $('edit-path').value.trim() || '/';
  const secure  = $('edit-secure').checked;
  const httpOnly= $('edit-httponly').checked;
  const sameSite= $('edit-samesite').value;
  const session = $('edit-session').checked;
  const expiresVal = $('edit-expires').value;

  if (!name) { showToast('Cookie name is required', 'error'); return; }

  const details = {
    url: currentTab.url,
    name,
    value,
    domain: domain || undefined,
    path,
    secure,
    httpOnly,
    sameSite: sameSite === 'unspecified' ? undefined : sameSite,
  };

  if (!session && expiresVal) {
    details.expirationDate = Math.floor(new Date(expiresVal).getTime() / 1000);
  }

  // If editing, remove old cookie first (name/domain/path may change)
  if (editingCookie) {
    await removeCookie(editingCookie);
  }

  try {
    await chrome.cookies.set(details);
    showToast(editingCookie ? 'Cookie updated' : 'Cookie created', 'success');
    closePanel(editPanel);
    await loadCookies();
  } catch (e) {
    showToast('Failed to save cookie: ' + e.message, 'error');
  }
}

// ─── Delete ──────────────────────────────────────────────
function confirmDeleteCookie(cookie) {
  showConfirm(
    `Delete cookie "${cookie.name}"?`,
    async () => {
      await removeCookie(cookie);
      showToast('Cookie deleted', 'success');
      await loadCookies();
    }
  );
}

async function removeCookie(cookie) {
  const protocol = cookie.secure ? 'https' : 'http';
  const url = `${protocol}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
  await chrome.cookies.remove({ url, name: cookie.name });
}

$('btn-delete-all').addEventListener('click', () => {
  showConfirm(
    `Delete all ${allCookies.length} cookies for this site?`,
    async () => {
      await Promise.all(allCookies.map(removeCookie));
      showToast(`Deleted ${allCookies.length} cookies`, 'success');
      selectedNames.clear();
      await loadCookies();
    }
  );
});

// ─── Bulk ────────────────────────────────────────────────
function updateBulkBar() {
  const count = selectedNames.size;
  if (count > 0) {
    bulkBar.classList.remove('hidden');
    bulkText.textContent = `${count} selected`;
  } else {
    bulkBar.classList.add('hidden');
  }
  syncSelectAllCheckbox();
}

function syncSelectAllCheckbox() {
  const all = filteredCookies.length > 0 && filteredCookies.every(c => selectedNames.has(cookieKey(c)));
  const some = filteredCookies.some(c => selectedNames.has(cookieKey(c)));
  selectAllCb.checked = all;
  selectAllCb.indeterminate = some && !all;
  selectAllFooter.checked = all;
  selectAllFooter.indeterminate = some && !all;
}

selectAllCb.addEventListener('change', toggleSelectAll);
selectAllFooter.addEventListener('change', toggleSelectAll);

function toggleSelectAll(e) {
  const checked = e.target.checked;
  filteredCookies.forEach(c => {
    if (checked) selectedNames.add(cookieKey(c));
    else selectedNames.delete(cookieKey(c));
  });
  selectAllCb.checked = checked;
  selectAllFooter.checked = checked;
  filterAndRender();
}

$('btn-bulk-delete').addEventListener('click', () => {
  showConfirm(
    `Delete ${selectedNames.size} selected cookies?`,
    async () => {
      const toDelete = allCookies.filter(c => selectedNames.has(cookieKey(c)));
      await Promise.all(toDelete.map(removeCookie));
      showToast(`Deleted ${toDelete.length} cookies`, 'success');
      selectedNames.clear();
      await loadCookies();
    }
  );
});

$('btn-bulk-export').addEventListener('click', () => {
  exportCookieSubset = allCookies.filter(c => selectedNames.has(cookieKey(c)));
  openExportPanel();
});

// ─── Search ──────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  btnClearSearch.classList.toggle('hidden', !searchInput.value);
  filterAndRender();
});
btnClearSearch.addEventListener('click', () => {
  searchInput.value = '';
  btnClearSearch.classList.add('hidden');
  filterAndRender();
  searchInput.focus();
});

// ─── Refresh ─────────────────────────────────────────────
$('btn-refresh').addEventListener('click', async () => {
  await loadCurrentTab();
  await loadCookies();
  showToast('Refreshed', 'info');
});

// ─── Add ─────────────────────────────────────────────────
$('btn-add').addEventListener('click', () => openEditPanel(null));

// ─── Import ──────────────────────────────────────────────
$('btn-import').addEventListener('click', () => {
  $('import-data').value = '';
  openPanel(importPanel);
});
$('btn-import-close').addEventListener('click', () => closePanel(importPanel));
$('btn-import-cancel').addEventListener('click', () => closePanel(importPanel));

$('btn-import-confirm').addEventListener('click', async () => {
  const raw = $('import-data').value.trim();
  if (!raw) { showToast('Paste some cookie data first', 'error'); return; }

  let cookies = [];
  try {
    cookies = parseCookies(raw, currentImportFormat);
  } catch(e) {
    showToast('Invalid format: ' + e.message, 'error');
    return;
  }

  const overwrite = $('import-overwrite').checked;
  let count = 0;
  for (const c of cookies) {
    try {
      if (!overwrite) {
        const existing = await chrome.cookies.get({ url: currentTab.url, name: c.name });
        if (existing) continue;
      }
      const details = {
        url: currentTab.url,
        name: c.name,
        value: c.value,
        path: c.path || '/',
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
        sameSite: c.sameSite || 'no_restriction',
      };
      if (c.domain) details.domain = c.domain;
      if (c.expirationDate) details.expirationDate = c.expirationDate;
      await chrome.cookies.set(details);
      count++;
    } catch {}
  }

  showToast(`Imported ${count} cookie${count !== 1 ? 's' : ''}`, 'success');
  closePanel(importPanel);
  await loadCookies();
});

// Import format tabs
importPanel.querySelectorAll('.format-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    importPanel.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentImportFormat = tab.dataset.fmt;
    updateImportPlaceholder();
  });
});

function updateImportPlaceholder() {
  const ta = $('import-data');
  const placeholders = {
    json: '[{"name":"session","value":"abc123","domain":".example.com","path":"/","secure":true}]',
    header: 'session=abc123; theme=dark; lang=en',
    netscape: '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tsession\tabc123',
  };
  ta.placeholder = placeholders[currentImportFormat];
}

// ─── Export ──────────────────────────────────────────────
$('btn-export').addEventListener('click', () => {
  exportCookieSubset = null;
  openExportPanel();
});

function openExportPanel() {
  currentExportFormat = 'json';
  exportPanel.querySelectorAll('.format-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  updateExportData();
  openPanel(exportPanel);
}

$('btn-export-close').addEventListener('click', () => closePanel(exportPanel));
$('btn-export-cancel').addEventListener('click', () => closePanel(exportPanel));

$('btn-copy-export').addEventListener('click', async () => {
  const text = $('export-data').value;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  } catch {
    // fallback
    const ta = $('export-data');
    ta.select();
    document.execCommand('copy');
    showToast('Copied!', 'success');
  }
});

exportPanel.querySelectorAll('.format-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    exportPanel.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentExportFormat = tab.dataset.fmt;
    updateExportData();
  });
});

function updateExportData() {
  const cookies = exportCookieSubset || allCookies;
  $('export-data').value = serializeCookies(cookies, currentExportFormat);
}

// ─── Serialize / Parse ───────────────────────────────────

function serializeCookies(cookies, format) {
  switch (format) {
    case 'json':
      return JSON.stringify(cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        hostOnly: c.hostOnly,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        session: !c.expirationDate,
        ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
        storeId: c.storeId,
      })), null, 2);

    case 'header':
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');

    case 'netscape': {
      const lines = ['# Netscape HTTP Cookie File', '# Generated by Cookie Editor Pro', ''];
      cookies.forEach(c => {
        const domain  = c.domain || '';
        const flag    = domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const path    = c.path || '/';
        const secure  = c.secure ? 'TRUE' : 'FALSE';
        const expires = c.expirationDate ? Math.floor(c.expirationDate) : 0;
        lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expires}\t${c.name}\t${c.value}`);
      });
      return lines.join('\n');
    }

    default: return '';
  }
}

function parseCookies(raw, format) {
  switch (format) {
    case 'json': {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
      return parsed;
    }

    case 'header': {
      return raw.split(';').map(pair => {
        const idx = pair.indexOf('=');
        if (idx === -1) return null;
        return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
      }).filter(Boolean);
    }

    case 'netscape': {
      return raw.split('\n')
        .filter(l => l && !l.startsWith('#'))
        .map(line => {
          const parts = line.split('\t');
          if (parts.length < 7) return null;
          const [domain, , path, secure, expires, name, ...valueParts] = parts;
          return {
            domain,
            path,
            secure: secure === 'TRUE',
            expirationDate: parseInt(expires) || undefined,
            name,
            value: valueParts.join('\t'),
          };
        }).filter(Boolean);
    }

    default: throw new Error('Unknown format');
  }
}

// ─── Theme ───────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('ce-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.body.className = `theme-${theme}`;
  const moonIcon = document.querySelector('.icon-moon');
  const sunIcon  = document.querySelector('.icon-sun');
  if (theme === 'dark') {
    moonIcon.classList.remove('hidden');
    sunIcon.classList.add('hidden');
  } else {
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
  }
  localStorage.setItem('ce-theme', theme);
}

$('btn-theme').addEventListener('click', () => {
  const isDark = document.body.classList.contains('theme-dark');
  applyTheme(isDark ? 'light' : 'dark');
});

// ─── Panel helpers ───────────────────────────────────────
let activePanel = null;
let panelCloseTimer = null;

function openPanel(panel) {
  // Cancel any in-flight close timer so it can't hide our new panel
  if (panelCloseTimer) { clearTimeout(panelCloseTimer); panelCloseTimer = null; }

  // Immediately hide whichever panel was open (no animation needed for the swap)
  if (activePanel && activePanel !== panel) {
    activePanel.classList.remove('panel-open');
    activePanel.classList.add('hidden');
  }

  activePanel = panel;
  panelOverlay.classList.remove('hidden');
  panel.classList.remove('hidden');

  // Double rAF so the browser registers the display:block before adding the transition class
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('panel-open')));
}

function closePanel(panel) {
  panel.classList.remove('panel-open');
  panelCloseTimer = setTimeout(() => {
    panel.classList.add('hidden');
    panelOverlay.classList.add('hidden');
    if (activePanel === panel) activePanel = null;
    panelCloseTimer = null;
  }, 300);
}

function closeAllPanels() {
  if (panelCloseTimer) { clearTimeout(panelCloseTimer); panelCloseTimer = null; }
  [editPanel, importPanel, exportPanel].forEach(p => {
    p.classList.remove('panel-open');
    p.classList.add('hidden');
  });
  panelOverlay.classList.add('hidden');
  activePanel = null;
}

// ─── Confirm Dialog ──────────────────────────────────────
function showConfirm(message, onYes) {
  $('confirm-text').textContent = message;
  confirmCallback = onYes;
  confirmOverlay.classList.remove('hidden');
}

$('btn-confirm-yes').addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});
$('btn-confirm-no').addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
  confirmCallback = null;
});

// ─── Toast ───────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-dot"></span>${escHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// ─── Bind misc events ────────────────────────────────────
function bindEvents() {
  updateImportPlaceholder();
  // Background tab updates
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'TAB_UPDATED' || msg.type === 'TAB_ACTIVATED') {
      loadCurrentTab().then(loadCookies);
    }
  });
}

// ─── Utils ───────────────────────────────────────────────
function cookieKey(c) { return `${c.name}::${c.domain}::${c.path}`; }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }
function toDatetimeLocal(date) {
  const pad = n => String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
