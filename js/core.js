/* =========================================================
   NIMBUS — noyau : utilitaires, bus d'événements, réglages, icônes
   ========================================================= */
window.OS = (() => {
  const OS = {};

  /* ---------- Création d'éléments ---------- */
  OS.h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  OS.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  OS.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  OS.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Bus d'événements ---------- */
  OS.emitter = () => {
    const map = {};
    return {
      on(evt, fn) { (map[evt] ||= []).push(fn); return () => { map[evt] = map[evt].filter((f) => f !== fn); }; },
      emit(evt, ...args) { (map[evt] || []).slice().forEach((f) => f(...args)); },
    };
  };
  Object.assign(OS, OS.emitter());

  /* ---------- Stockage local (tolérant aux erreurs) ---------- */
  OS.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('nimbus:' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem('nimbus:' + key, JSON.stringify(value)); } catch { /* stockage indisponible */ } },
    clear() {
      try { Object.keys(localStorage).filter((k) => k.startsWith('nimbus:')).forEach((k) => localStorage.removeItem(k)); } catch { /* idem */ }
    },
    size() {
      try { return Object.keys(localStorage).filter((k) => k.startsWith('nimbus:')).reduce((n, k) => n + k.length + localStorage.getItem(k).length, 0) * 2; } catch { return 0; }
    },
  };

  /* ---------- Réglages ---------- */
  const DEFAULTS = { theme: 'auto', accent: 'blue', wallpaper: 'nimbus', dockSize: 54, magnify: true, brightness: 100, volume: 70, iconPos: {} };
  OS.settings = { ...DEFAULTS, ...OS.store.get('settings', {}) };
  OS.setSetting = (key, value) => {
    OS.settings[key] = value;
    OS.store.set('settings', OS.settings);
    OS.emit('settings', key, value);
  };

  OS.ACCENTS = {
    blue: '#0a84ff', purple: '#a259ff', pink: '#ff4f9a', red: '#ff453a',
    orange: '#ff9f0a', yellow: '#ffcc00', green: '#30d158', graphite: '#8e8e93',
  };

  const IMG = (id, w = 2400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
  OS.img = IMG;
  OS.WALLPAPERS = [
    { id: 'nimbus', name: 'Nimbus', css: 'radial-gradient(ellipse 80% 70% at 15% 20%, #6d5dfc 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 85% 30%, #ff7a9c 0%, transparent 60%), radial-gradient(ellipse 90% 70% at 50% 100%, #ffb86b 0%, transparent 65%), linear-gradient(160deg, #2b2d77, #8a3f8f 55%, #f08a5d)' },
    { id: 'lagon', name: 'Lagon', css: 'radial-gradient(ellipse 80% 70% at 20% 10%, #5ee7df 0%, transparent 60%), radial-gradient(ellipse 70% 70% at 90% 80%, #3a7bd5 0%, transparent 60%), linear-gradient(135deg, #0f4c75, #1fa2a6 50%, #b4f8c8)' },
    { id: 'braise', name: 'Braise', css: 'radial-gradient(ellipse 70% 60% at 80% 20%, #ffd166 0%, transparent 60%), radial-gradient(ellipse 80% 70% at 10% 90%, #ef476f 0%, transparent 60%), linear-gradient(200deg, #f78c35, #c4314b 55%, #3d0f3a)' },
    { id: 'minuit', name: 'Minuit', css: 'radial-gradient(ellipse 60% 50% at 70% 25%, #3b3f9e 0%, transparent 65%), radial-gradient(ellipse 70% 60% at 20% 80%, #1d6f8f 0%, transparent 60%), linear-gradient(180deg, #05060f, #10142e 60%, #1a1240)' },
    { id: 'sommets', name: 'Sommets', photo: '1506905925346-21bda4d32df4' },
    { id: 'aurore', name: 'Aurore', photo: '1483347756197-71ef80e95f73' },
    { id: 'lac', name: 'Lac', photo: '1501785888041-af3ef285b470' },
    { id: 'voie-lactee', name: 'Voie lactée', photo: '1519681393784-d120267933ba' },
  ];
  OS.wallpaperCSS = (id, thumb = false) => {
    const wp = OS.WALLPAPERS.find((w) => w.id === id) || OS.WALLPAPERS[0];
    return wp.photo ? `center / cover no-repeat url("${IMG(wp.photo, thumb ? 400 : 2400)}"), #222` : wp.css;
  };

  /* ---------- Formatage ---------- */
  OS.fmtDate = (ts, opts = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) =>
    new Date(ts).toLocaleString('fr-FR', opts);
  OS.fmtSize = (bytes) => (bytes < 1024 ? `${bytes} octets` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} Ko` : `${(bytes / 1048576).toFixed(1)} Mo`);

  /* =========================================================
     ICÔNES (SVG originaux, aucune marque réelle)
     ========================================================= */
  let gid = 0;
  const squircle = (a, b, inner) => {
    const id = 'g' + (++gid);
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="13" fill="url(#${id})"/><rect x="4.5" y="4.5" width="55" height="55" rx="12.5" fill="none" stroke="rgba(255,255,255,.28)"/>${inner}</svg>`;
  };

  OS.icons = {
    files: () => squircle('#62d0ff', '#0a6cff',
      '<path d="M15 23a3 3 0 0 1 3-3h9.5l3.5 3.5h15a3 3 0 0 1 3 3V44a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3Z" fill="#fff"/><path d="M15 28h34" stroke="#0a6cff" stroke-opacity=".25" stroke-width="2"/>'),
    notes: () => squircle('#fff1a8', '#ffc93c',
      '<path d="M18 26h28M18 34h28M18 42h18" stroke="#8a6500" stroke-opacity=".55" stroke-width="3.2" stroke-linecap="round"/><path d="M4 17a13 13 0 0 1 13-13h30a13 13 0 0 1 13 13v1H4Z" fill="#ffffff" fill-opacity=".55"/>'),
    terminal: () => squircle('#48484c', '#111113',
      '<path d="M18 24l9 8-9 8" stroke="#3ce07f" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 41h15" stroke="#e8e8e8" stroke-width="4" stroke-linecap="round"/>'),
    settings: () => squircle('#c9ccd3', '#6b7079',
      '<circle cx="32" cy="32" r="16" fill="none" stroke="#2d3036" stroke-width="7" stroke-dasharray="4.6 3.78"/><circle cx="32" cy="32" r="12.5" fill="#eef0f3"/><circle cx="32" cy="32" r="5" fill="#6b7079"/>'),
    photos: () => squircle('#5fd3ff', '#7a5cff',
      '<circle cx="42" cy="24" r="5.5" fill="#fff6c9"/><path d="M12 47l12.5-15 8 9 6.5-6.5L52 47Z" fill="#fff" fill-opacity=".95"/>'),
    music: () => squircle('#ff7aa8', '#b43cff',
      '<path d="M27 43V22.5l18-4.5V39" stroke="#fff" stroke-width="3.6" fill="none" stroke-linejoin="round"/><ellipse cx="22.5" cy="43" rx="5.5" ry="4.6" fill="#fff"/><ellipse cx="40.5" cy="39" rx="5.5" ry="4.6" fill="#fff"/>'),
    calculator: () => {
      let keys = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        keys += `<rect x="${15 + c * 12}" y="${24 + r * 10}" width="9" height="7" rx="2.5" fill="${c === 2 ? '#ff9f0a' : '#d4d4d2'}"/>`;
      }
      return squircle('#4a4a4e', '#1b1b1d', `<rect x="15" y="13" width="33" height="7" rx="2" fill="#2f2f33"/>${keys}`);
    },
    calendar: () => {
      const d = new Date();
      const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase();
      return squircle('#ffffff', '#ececef',
        `<text x="32" y="22" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Inter,sans-serif" font-size="9.5" font-weight="700" fill="#ff453a">${wd}</text><text x="32" y="48" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Inter,sans-serif" font-size="27" font-weight="500" fill="#1d1d1f">${d.getDate()}</text>`);
    },
    browser: () => squircle('#4ee6c8', '#0a7cff',
      '<circle cx="32" cy="32" r="15" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="32" cy="32" rx="6.5" ry="15" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M17.5 27h29M17.5 37h29" stroke="#fff" stroke-width="2.6"/>'),
    mail: () => squircle('#74c9ff', '#1463ff',
      '<rect x="15" y="21" width="34" height="23" rx="4" fill="#fff"/><path d="M16.5 23.5 32 35l15.5-11.5" fill="none" stroke="#1463ff" stroke-opacity=".55" stroke-width="2.6" stroke-linejoin="round"/>'),
    trash: (full) => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 18h30l-2.6 36.2a4 4 0 0 1-4 3.8H23.6a4 4 0 0 1-4-3.8Z" fill="rgba(235,235,240,.55)" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/>${full ? '<path d="M21 18c2-6 7-9 11-7 3-4 9-2 11 2 2 0 4 2 4 5" fill="#f7f7f7" stroke="#cfcfd4" stroke-width="1.2"/>' : ''}<path d="M25 25v26M32 25v26M39 25v26" stroke="rgba(80,80,90,.45)" stroke-width="2" stroke-linecap="round"/><rect x="14" y="15" width="36" height="5" rx="2.5" fill="rgba(245,245,248,.9)"/></svg>`,
    folder: () => '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 17a4 4 0 0 1 4-4h14.5l5 5H54a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="#4aa8ee"/><path d="M6 24a3 3 0 0 1 3-3h46a3 3 0 0 1 3 3v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="#74c0fb"/></svg>',
    text: () => '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill="#fff" stroke="#d6d6db"/><path d="M40 6v9a3 3 0 0 0 3 3h9" fill="#ececf0" stroke="#d6d6db"/><path d="M18 27h28M18 34h28M18 41h28M18 48h18" stroke="#a7a7b0" stroke-width="2.2" stroke-linecap="round"/></svg>',
    image: () => '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="12" width="48" height="40" rx="4" fill="#fff" stroke="#d6d6db"/><rect x="12" y="16" width="40" height="32" rx="2" fill="#7cc4fa"/><circle cx="42" cy="25" r="4" fill="#fff6c9"/><path d="M12 48l12-14 8 8 6-5 14 11Z" fill="#3c9d5d"/></svg>',
    audio: () => '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill="#fff" stroke="#d6d6db"/><path d="M28 44V28l12-3v15" stroke="#c13cff" stroke-width="2.8" fill="none"/><circle cx="25" cy="44" r="4" fill="#c13cff"/><circle cx="37" cy="40" r="4" fill="#c13cff"/></svg>',
    file: () => '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill="#fff" stroke="#d6d6db"/><path d="M40 6v9a3 3 0 0 0 3 3h9" fill="#ececf0" stroke="#d6d6db"/></svg>',
    logo: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 18.5a4.7 4.7 0 0 1-.6-9.36 6 6 0 0 1 11.3 1.6 3.9 3.9 0 0 1-.4 7.76Z" fill="currentColor"/></svg>',
  };

  /* Petites icônes « symboles » pour les barres latérales et la barre de menus */
  const sym = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
  OS.sym = {
    desktop: sym('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    doc: sym('<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/>'),
    photo: sym('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="15.5" cy="9.5" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>'),
    music: sym('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
    apps: sym('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
    trash: sym('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    folder: sym('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    back: sym('<path d="m15 18-6-6 6-6"/>'),
    fwd: sym('<path d="m9 18 6-6-6-6"/>'),
    grid: sym('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'),
    list: sym('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6" fill="currentColor"/><circle cx="4.5" cy="12" r=".6" fill="currentColor"/><circle cx="4.5" cy="18" r=".6" fill="currentColor"/>'),
    newFolder: sym('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 10v6M9 13h6"/>'),
    plus: sym('<path d="M12 5v14M5 12h14"/>'),
    compose: sym('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>'),
    reply: sym('<path d="M10 8 4 13l6 5"/><path d="M4 13h10a6 6 0 0 1 6 6"/>'),
    search: sym('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
    wifi: sym('<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 15.9a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r=".9" fill="currentColor"/>'),
    toggles: sym('<rect x="3" y="5" width="18" height="6" rx="3"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><rect x="3" y="13" width="18" height="6" rx="3"/><circle cx="8" cy="16" r="1.6" fill="currentColor"/>'),
    reload: sym('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    home: sym('<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4.2" height="16" rx="1.2" fill="currentColor"/><rect x="13.8" y="4" width="4.2" height="16" rx="1.2" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6.5v11a.8.8 0 0 1-1.25.66L2.5 12.66a.8.8 0 0 1 0-1.32l7.25-5.5A.8.8 0 0 1 11 6.5Zm10 0v11a.8.8 0 0 1-1.25.66l-7.25-5.5a.8.8 0 0 1 0-1.32l7.25-5.5A.8.8 0 0 1 21 6.5Z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 6.5v11a.8.8 0 0 0 1.25.66l7.25-5.5a.8.8 0 0 0 0-1.32l-7.25-5.5A.8.8 0 0 0 13 6.5Zm-10 0v11a.8.8 0 0 0 1.25.66l7.25-5.5a.8.8 0 0 0 0-1.32L4.25 5.84A.8.8 0 0 0 3 6.5Z" fill="currentColor"/></svg>',
    sun: sym('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: sym('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
    volume: sym('<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
    bluetooth: sym('<path d="m7 7 10 10-5 4V3l5 4L7 17"/>'),
  };

  return OS;
})();
