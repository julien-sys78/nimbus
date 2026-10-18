/* =========================================================
   NIMBUS — interface système : applis, menus, Dock, bureau,
   recherche, notifications, centre de contrôle, verrouillage.
   ========================================================= */
(() => {
  const { h, fs, sym } = OS;
  const $ = (s, c = document) => c.querySelector(s);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const MOD = isMac ? '⌘' : 'Ctrl+';

  /* =========================================================
     APPLICATIONS
     ========================================================= */
  OS.apps = {};
  OS.DOCK_APPS = ['files', 'browser', 'mail', 'photos', 'music', 'notes', 'calendar', 'calculator', 'terminal', 'settings'];
  OS.registerApp = (app) => { OS.apps[app.id] = app; };

  OS.launch = (id, args = {}) => {
    const app = OS.apps[id];
    if (!app) return null;
    const running = OS.wm.byApp(id);
    if (app.single && running.length) {
      OS.wm.focus(running[0]);
      app.handle?.(running[0], args);
      return running[0];
    }
    if (!running.length) bounce(id);
    return app.launch(args);
  };

  OS.openPath = (path) => {
    const node = fs.get(path);
    if (!node) { OS.notify({ title: 'Élément introuvable', body: path }); return; }
    const k = fs.kind(fs.base(path), node);
    if (k === 'folder') OS.launch('files', { path });
    else if (k === 'app') OS.launch(node.app);
    else if (k === 'text') OS.launch('notes', { path });
    else if (k === 'image') OS.launch('photos', { path });
    else if (k === 'audio') OS.launch('music', { path });
    else OS.dialog({ title: 'Impossible d\'ouvrir', message: `Aucune application ne sait ouvrir « ${fs.base(path)} ».` });
  };

  /* Icône d'un élément (vignette pour les images) */
  OS.thumb = (src, w = 320) => src.replace(/w=\d+/, 'w=' + w);
  OS.itemIcon = (item) => {
    if (item.kind === 'app') return OS.icons[item.node.app]?.() || OS.icons.file();
    if (item.kind === 'image' && item.node.src) return `<span class="thumb"><img src="${OS.esc(OS.thumb(item.node.src))}" alt="" loading="lazy" draggable="false"></span>`;
    if (item.kind === 'folder') return OS.icons.folder();
    return (OS.icons[item.kind] || OS.icons.file)();
  };

  /* Renommage en place d'une étiquette */
  OS.inlineRename = (label, path, onDone) => {
    const old = fs.base(path);
    const input = h('input', { class: 'rename', value: old, spellcheck: 'false', 'aria-label': 'Nouveau nom' });
    label.replaceWith(input);
    input.focus();
    const dot = old.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 && fs.get(path)?.type !== 'dir' ? dot : old.length);
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      let np = path;
      if (commit && input.value.trim() && input.value.trim() !== old) {
        try { np = fs.rename(path, input.value); } catch (e) { OS.notify({ title: 'Renommage impossible', body: e.message }); }
      }
      if (input.isConnected) input.replaceWith(label);
      onDone?.(np);
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    ['pointerdown', 'dblclick', 'click'].forEach((t) => input.addEventListener(t, (e) => e.stopPropagation()));
    input.addEventListener('blur', () => finish(true));
  };

  /* Pages du site (légales, crédits) : nouvel onglet du vrai navigateur */
  OS.openPage = (page) => window.open(page, '_blank', 'noopener');

  OS.trashItems = (paths) => {
    paths.forEach((p) => {
      try { fs.remove(p); } catch (e) { OS.notify({ title: 'Suppression impossible', body: e.message }); }
    });
  };

  /* =========================================================
     MENUS (barre de menus et menus contextuels)
     ========================================================= */
  const menuLayer = $('#menus');
  let openMenu = null;

  OS.menu = {
    open(items, { x, y, anchor, owner, minWidth } = {}) {
      OS.menu.close();
      const el = h('div', { class: 'menu', role: 'menu', style: minWidth ? { minWidth: minWidth + 'px' } : null });
      items.filter(Boolean).forEach((it) => {
        if (it.sep) { el.append(h('div', { class: 'menu__sep', role: 'separator' })); return; }
        if (it.header) { el.append(h('div', { class: 'menu__header' }, it.header)); return; }
        const btn = h('button', {
          class: `menu__item${it.danger ? ' is-danger' : ''}${it.bold ? ' is-bold' : ''}`,
          role: 'menuitem',
          disabled: it.disabled,
          onclick: () => { OS.menu.close(); it.action?.(); },
        },
        h('span', { class: 'menu__check' }, it.checked ? '✓' : ''),
        h('span', { class: 'menu__label' }, it.label),
        it.shortcut ? h('span', { class: 'menu__key' }, it.shortcut) : null);
        el.append(btn);
      });
      menuLayer.append(el);
      const r = el.getBoundingClientRect();
      let left = anchor ? anchor.left : x;
      let top = anchor ? anchor.bottom + 2 : y;
      left = Math.min(left, window.innerWidth - r.width - 6);
      if (top + r.height > window.innerHeight - 6) top = Math.max(32, (anchor ? anchor.top : y) - r.height);
      Object.assign(el.style, { left: Math.max(6, left) + 'px', top: top + 'px' });
      openMenu = { el, owner };
      el.addEventListener('keydown', (e) => {
        const btns = [...el.querySelectorAll('.menu__item:not(:disabled)')];
        const i = btns.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
      });
      return el;
    },
    close() {
      if (!openMenu) return;
      openMenu.el.remove();
      openMenu.owner?.classList.remove('is-open');
      openMenu = null;
    },
    get current() { return openMenu; },
  };
  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !openMenu.el.contains(e.target) && !openMenu.owner?.contains(e.target)) OS.menu.close();
  }, true);
  window.addEventListener('blur', () => OS.menu.close());

  /* =========================================================
     BOÎTES DE DIALOGUE
     ========================================================= */
  OS.dialog = ({ title, message, input, buttons = [{ label: 'OK', value: true, primary: true }], icon } = {}) =>
    new Promise((resolve) => {
      const win = OS.wm.open({ app: 'system', title: '', width: 340, height: input != null ? 250 : 210, resizable: false, minimizable: false, className: 'win--dialog' });
      let result = null;
      const field = input != null ? h('input', { class: 'field', value: input, spellcheck: 'false' }) : null;
      const finish = (val) => { result = val; win.close(); };
      win.onClose = () => resolve(result);
      win.body.append(h('div', { class: 'dialog' },
        h('div', { class: 'dialog__icon', html: icon || OS.icons.logo() }),
        h('h2', { class: 'dialog__title' }, title || ''),
        message ? h('p', { class: 'dialog__msg' }, message) : null,
        field,
        h('div', { class: 'dialog__btns' }, buttons.map((b) => h('button', {
          class: `btn${b.primary ? ' btn--primary' : ''}${b.danger ? ' btn--danger' : ''}`,
          onclick: () => finish(field && b.value === true ? field.value : b.value),
        }, b.label)))));
      win.body.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const p = buttons.find((b) => b.primary); if (p) finish(field && p.value === true ? field.value : p.value); }
        if (e.key === 'Escape') finish(null);
      });
      setTimeout(() => (field || win.body.querySelector('.btn--primary'))?.focus(), 50);
      if (field) setTimeout(() => field.select(), 60);
    });

  /* =========================================================
     NOTIFICATIONS
     ========================================================= */
  const notifLayer = $('#notifications');
  OS.notify = ({ title, body, app, onClick, timeout = 5000 } = {}) => {
    const icon = app && OS.icons[app] ? OS.icons[app]() : OS.icons.logo();
    const card = h('div', { class: 'notif', role: 'status' },
      h('div', { class: 'notif__icon', html: icon }),
      h('div', { class: 'notif__text' },
        h('div', { class: 'notif__top' }, h('strong', {}, title || ''), h('span', {}, 'maintenant')),
        body ? h('p', {}, body) : null),
      h('button', { class: 'notif__close', 'aria-label': 'Fermer', html: '×' }));
    const dismiss = () => {
      if (!card.isConnected) return;
      card.classList.add('is-leaving');
      setTimeout(() => card.remove(), 300);
    };
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.notif__close')) onClick?.();
      dismiss();
    });
    notifLayer.prepend(card);
    if (timeout) setTimeout(dismiss, timeout);
    return dismiss;
  };

  /* =========================================================
     THÈME, FOND D'ÉCRAN, LUMINOSITÉ
     ========================================================= */
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const applySettings = () => {
    const s = OS.settings;
    const theme = s.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : s.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--accent', OS.ACCENTS[s.accent] || OS.ACCENTS.blue);
    document.documentElement.style.setProperty('--dock-size', s.dockSize + 'px');
    $('#wallpaper').style.background = OS.wallpaperCSS(s.wallpaper);
    $('#lock-bg').style.background = OS.wallpaperCSS(s.wallpaper);
    $('#dimmer').style.opacity = String((100 - s.brightness) / 100 * 0.85);
  };
  OS.on('settings', applySettings);
  darkQuery.addEventListener('change', applySettings);
  applySettings();

  OS.toggleDark = () => OS.setSetting('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  OS.nextWallpaper = () => {
    const i = OS.WALLPAPERS.findIndex((w) => w.id === OS.settings.wallpaper);
    OS.setSetting('wallpaper', OS.WALLPAPERS[(i + 1) % OS.WALLPAPERS.length].id);
  };

  /* =========================================================
     BARRE DE MENUS
     ========================================================= */
  const menubar = $('#menubar');
  const appNameBtn = h('button', { class: 'mb__btn mb__app' }, 'Bureau');
  const focusedApp = () => OS.apps[OS.wm.focused()?.app];

  const editCmd = (cmd) => () => { document.execCommand(cmd); };
  const MENUS = [
    {
      el: h('button', { class: 'mb__btn mb__logo', 'aria-label': 'Menu Nimbus', html: OS.icons.logo() }),
      items: () => [
        { label: 'À propos de ce Nimbus', action: about },
        { sep: true },
        { label: 'Réglages système…', action: () => OS.launch('settings') },
        { sep: true },
        { label: 'Verrouiller l\'écran', shortcut: isMac ? '⌃⌘Q' : '', action: () => OS.lock() },
        { label: 'Redémarrer…', action: async () => { if (await OS.dialog({ title: 'Redémarrer Nimbus ?', message: 'Les fenêtres ouvertes seront fermées. Vos fichiers sont conservés.', buttons: [{ label: 'Annuler', value: false }, { label: 'Redémarrer', value: true, primary: true }] })) location.reload(); } },
      ],
    },
    {
      el: appNameBtn,
      items: () => {
        const app = focusedApp();
        if (!app) return [{ label: 'À propos de ce Nimbus', action: about }, { sep: true }, { label: 'Réglages système…', action: () => OS.launch('settings') }];
        return [
          { label: `À propos de ${app.name}`, action: () => OS.dialog({ title: app.name, message: app.about || 'Application Nimbus.', icon: OS.icons[app.id]() }) },
          { sep: true },
          { label: `Masquer ${app.name}`, action: () => OS.wm.byApp(app.id).forEach((w) => OS.wm.minimize(w)) },
          { label: `Quitter ${app.name}`, shortcut: `${MOD}Q`, action: () => OS.wm.byApp(app.id).forEach((w) => w.close()) },
        ];
      },
    },
    {
      el: h('button', { class: 'mb__btn' }, 'Fichier'),
      items: () => {
        const win = OS.wm.focused();
        const app = focusedApp();
        return [
          { label: 'Nouvelle fenêtre', shortcut: `${MOD}N`, action: () => (app && !app.single ? app.launch({}) : OS.launch(app?.id || 'files')) },
          { label: 'Nouveau dossier sur le bureau', action: () => fs.mkdir('/Bureau/Nouveau dossier', { unique: true }) },
          { label: 'Nouveau document texte', action: () => OS.openPath(fs.writeFile('/Documents/' + fs.uniqueName('/Documents', 'Sans titre.txt'), '')) },
          { sep: true },
          { label: 'Fermer la fenêtre', shortcut: isMac ? '⌥W' : 'Alt+W', disabled: !win, action: () => win?.close() },
        ];
      },
    },
    {
      el: h('button', { class: 'mb__btn' }, 'Édition'),
      items: () => [
        { label: 'Annuler', shortcut: `${MOD}Z`, action: editCmd('undo') },
        { label: 'Rétablir', shortcut: `${MOD}⇧Z`, action: editCmd('redo') },
        { sep: true },
        { label: 'Couper', shortcut: `${MOD}X`, action: editCmd('cut') },
        { label: 'Copier', shortcut: `${MOD}C`, action: editCmd('copy') },
        { label: 'Tout sélectionner', shortcut: `${MOD}A`, action: editCmd('selectAll') },
      ],
    },
    {
      el: h('button', { class: 'mb__btn' }, 'Présentation'),
      items: () => [
        { label: document.documentElement.dataset.theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre', action: OS.toggleDark },
        { label: 'Fond d\'écran suivant', action: OS.nextWallpaper },
        { sep: true },
        { label: 'Rechercher…', shortcut: `${MOD}K`, action: () => OS.spotlight.open() },
      ],
    },
    {
      el: h('button', { class: 'mb__btn' }, 'Fenêtre'),
      items: () => {
        const win = OS.wm.focused();
        const all = OS.wm.list();
        return [
          { label: 'Réduire', shortcut: isMac ? '⌥M' : 'Alt+M', disabled: !win, action: () => win && OS.wm.minimize(win) },
          { label: win?.maximized ? 'Quitter le plein écran' : 'Plein écran', disabled: !win, action: () => win && OS.wm.toggleMax(win) },
          { sep: true },
          { label: 'Tout ramener au premier plan', disabled: !all.length, action: () => all.forEach((w) => OS.wm.focus(w)) },
          all.length ? { sep: true } : null,
          ...all.map((w) => ({ label: w.title || OS.apps[w.app]?.name || 'Fenêtre', checked: w === win, action: () => OS.wm.focus(w) })),
        ];
      },
    },
    {
      el: h('button', { class: 'mb__btn' }, 'Aide'),
      items: () => [
        { label: 'Raccourcis clavier', action: shortcuts },
        { label: 'Lisez-moi', action: () => OS.openPath('/Bureau/Lisez-moi.txt') },
        { sep: true },
        { label: 'Mentions légales', action: () => OS.openPage('mentions-legales.html') },
        { label: 'Confidentialité', action: () => OS.openPage('confidentialite.html') },
        { label: 'Crédits', action: () => OS.openPage('credits.html') },
      ],
    },
  ];

  const openMenubarMenu = (m) => {
    const el = OS.menu.open(m.items(), { anchor: m.el.getBoundingClientRect(), owner: m.el, minWidth: 220 });
    m.el.classList.add('is-open');
    return el;
  };
  const left = h('div', { class: 'mb__left' });
  MENUS.forEach((m) => {
    m.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (OS.menu.current?.owner === m.el) OS.menu.close(); else openMenubarMenu(m);
    });
    m.el.addEventListener('pointerenter', () => {
      if (OS.menu.current?.owner && OS.menu.current.owner !== m.el && OS.menu.current.owner.closest('.mb__left')) openMenubarMenu(m);
    });
    left.append(m.el);
  });

  /* Partie droite : batterie, Wi-Fi, recherche, centre de contrôle, horloge */
  const battery = h('span', { class: 'mb__status mb__battery', title: 'Batterie' });
  const drawBattery = (level = 1, charging = false) => {
    battery.innerHTML = `<span>${Math.round(level * 100)} %</span><svg viewBox="0 0 28 14" aria-hidden="true"><rect x=".75" y=".75" width="23" height="12.5" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.5"/><rect x="2.6" y="2.6" width="${Math.max(1, 19.3 * level)}" height="8.8" rx="2" fill="currentColor"/><path d="M25.6 5v4" stroke="currentColor" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>${charging ? '<path d="M13 3 9.5 7.5h3L11 11l4-5h-3Z" fill="var(--menubar-bg-solid)"/>' : ''}</svg>`;
  };
  drawBattery(1);
  navigator.getBattery?.().then((b) => {
    const upd = () => drawBattery(b.level, b.charging);
    upd();
    b.addEventListener('levelchange', upd);
    b.addEventListener('chargingchange', upd);
  }).catch(() => {});

  const wifiBtn = h('button', { class: 'mb__btn mb__icon', 'aria-label': 'Wi-Fi', html: sym.wifi });
  const searchBtn = h('button', { class: 'mb__btn mb__icon', 'aria-label': 'Rechercher', html: sym.search, onclick: () => OS.spotlight.toggle() });
  const ccBtn = h('button', { class: 'mb__btn mb__icon', 'aria-label': 'Centre de contrôle', html: sym.toggles });
  const clock = h('button', { class: 'mb__btn mb__clock', onclick: () => OS.launch('calendar') });
  wifiBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (OS.menu.current?.owner === wifiBtn) return OS.menu.close();
    OS.menu.open([
      { header: 'Wi-Fi' },
      { label: OS.wifi === false ? 'Activer le Wi-Fi' : 'Désactiver le Wi-Fi', action: toggleWifi },
      { sep: true },
      { header: 'Réseaux connus' },
      { label: 'Maison', checked: OS.wifi !== false, disabled: OS.wifi === false },
      { label: 'Atelier 5G', disabled: OS.wifi === false },
      { label: 'Café du coin', disabled: OS.wifi === false },
    ], { anchor: wifiBtn.getBoundingClientRect(), owner: wifiBtn, minWidth: 220 });
    wifiBtn.classList.add('is-open');
  });
  const toggleWifi = () => { OS.wifi = OS.wifi === false; wifiBtn.classList.toggle('is-off', OS.wifi === false); OS.emit('wifi'); };

  let lastDate = new Date().toDateString();
  const tick = () => {
    const d = new Date();
    const date = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    clock.textContent = `${date}  ${time}`;
    $('#lock-time').textContent = time;
    $('#lock-date').textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (d.toDateString() !== lastDate) { lastDate = d.toDateString(); renderDock(); }
  };
  tick();
  setInterval(tick, 1000);

  menubar.append(left, h('div', { class: 'mb__right' }, battery, wifiBtn, searchBtn, ccBtn, clock));

  OS.wm.on('focus', (win) => {
    appNameBtn.textContent = win ? (OS.apps[win.app]?.name || 'Nimbus') : 'Bureau';
  });

  /* =========================================================
     CENTRE DE CONTRÔLE
     ========================================================= */
  ccBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (OS.menu.current?.owner === ccBtn) return OS.menu.close();
    const el = OS.menu.open([], { anchor: ccBtn.getBoundingClientRect(), owner: ccBtn });
    ccBtn.classList.add('is-open');
    el.classList.add('cc');
    const tile = (icon, label, on, onClick) => h('button', { class: `cc__tile${on ? ' is-on' : ''}`, onclick: onClick },
      h('span', { class: 'cc__dot', html: icon }), h('span', {}, label));
    const slider = (icon, label, value, onInput) => h('label', { class: 'cc__slider' },
      h('span', { class: 'cc__slabel' }, label),
      h('span', { class: 'cc__srow' }, h('span', { html: icon }),
        h('input', { type: 'range', min: '0', max: '100', value: String(value), oninput: (ev) => onInput(+ev.target.value) })));
    const music = OS.music;
    const now = music?.current();
    const render = () => {
      el.replaceChildren(
        h('div', { class: 'cc__grid' },
          tile(sym.wifi, OS.wifi === false ? 'Wi-Fi désactivé' : 'Wi-Fi', OS.wifi !== false, () => { toggleWifi(); render(); }),
          tile(sym.moon, 'Mode sombre', document.documentElement.dataset.theme === 'dark', () => { OS.toggleDark(); render(); }),
          tile(sym.bluetooth, 'Bluetooth', OS.bt !== false, () => { OS.bt = OS.bt === false; render(); }),
          tile(sym.search, 'Recherche', false, () => { OS.menu.close(); OS.spotlight.open(); })),
        slider(sym.sun, 'Luminosité', OS.settings.brightness, (v) => OS.setSetting('brightness', Math.max(25, v))),
        slider(sym.volume, 'Son', OS.settings.volume, (v) => OS.setSetting('volume', v)),
        h('div', { class: 'cc__now' },
          h('div', { class: 'cc__art', style: { background: now?.art || 'var(--fill)' } }),
          h('div', { class: 'cc__nowtext' }, h('strong', {}, now?.title || 'Aucune lecture'), h('span', {}, now?.artist || 'Musique')),
          h('button', {
            class: 'cc__play',
            'aria-label': music?.playing() ? 'Pause' : 'Lecture',
            html: music?.playing() ? sym.pause : sym.play,
            onclick: () => { if (!music) return; music.toggle(); setTimeout(render, 50); },
          })),
      );
    };
    render();
    const r = el.getBoundingClientRect();
    el.style.left = Math.min(r.left, window.innerWidth - r.width - 8) + 'px';
  });

  /* =========================================================
     DOCK
     ========================================================= */
  const dock = $('#dock');
  const dockInner = h('div', { class: 'dock__inner' });
  dock.append(dockInner);
  const badges = {};

  OS.setBadge = (appId, n) => { badges[appId] = n; renderDock(); };

  function dockItem(id, icon, label, onClick) {
    const btn = h('button', { class: 'dock__item', 'data-app': id, 'aria-label': label, onclick: onClick },
      h('span', { class: 'dock__icon', html: icon }),
      h('span', { class: 'dock__label' }, label),
      h('span', { class: 'dock__dot' }),
      badges[id] ? h('span', { class: 'dock__badge' }, String(badges[id])) : null);
    return btn;
  }

  function renderDock() {
    dockInner.replaceChildren();
    OS.DOCK_APPS.forEach((id) => {
      const app = OS.apps[id];
      if (!app) return;
      const btn = dockItem(id, app.icon(), app.name, () => {
        const wins = OS.wm.byApp(id);
        if (!wins.length) return OS.launch(id);
        const min = wins.filter((w) => w.minimized);
        if (min.length && wins.every((w) => w.minimized)) return OS.wm.restore(min[0]);
        const top = wins.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
        OS.wm.focus(top || wins[0]);
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const wins = OS.wm.byApp(id);
        OS.menu.open([
          ...wins.map((w) => ({ label: w.title || app.name, action: () => OS.wm.focus(w) })),
          wins.length ? { sep: true } : null,
          !app.single || !wins.length ? { label: wins.length ? 'Nouvelle fenêtre' : 'Ouvrir', action: () => (wins.length ? app.launch({}) : OS.launch(id)) } : null,
          wins.length ? { label: 'Quitter', action: () => wins.forEach((w) => w.close()) } : null,
        ], { x: e.clientX, y: e.clientY });
      });
      dockInner.append(btn);
    });
    dockInner.append(h('div', { class: 'dock__sep' }));
    const trashFull = Object.keys(fs.get('/Corbeille')?.children || {}).length > 0;
    const trash = dockItem('trash', OS.icons.trash(trashFull), 'Corbeille', () => OS.launch('files', { path: '/Corbeille' }));
    trash.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/nimbus-path')) { e.preventDefault(); trash.classList.add('is-drop'); } });
    trash.addEventListener('dragleave', () => trash.classList.remove('is-drop'));
    trash.addEventListener('drop', (e) => {
      e.preventDefault();
      trash.classList.remove('is-drop');
      OS.trashItems(e.dataTransfer.getData('text/nimbus-path').split('\n').filter(Boolean));
    });
    trash.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      OS.menu.open([{ label: 'Ouvrir', action: () => OS.launch('files', { path: '/Corbeille' }) }, { label: 'Vider la corbeille', disabled: !trashFull, action: emptyTrash }], { x: e.clientX, y: e.clientY });
    });
    dockInner.append(trash);
    updateRunning();
  }

  const updateRunning = () => {
    dockInner.querySelectorAll('.dock__item').forEach((btn) => btn.classList.toggle('is-running', OS.wm.byApp(btn.dataset.app).length > 0));
  };

  function bounce(id) {
    const btn = dockInner.querySelector(`.dock__item[data-app="${id}"]`);
    if (!btn) return;
    btn.classList.remove('is-bouncing');
    void btn.offsetWidth;
    btn.classList.add('is-bouncing');
    setTimeout(() => btn.classList.remove('is-bouncing'), 1000);
  }

  /* Effet loupe */
  dockInner.addEventListener('pointermove', (e) => {
    if (!OS.settings.magnify || e.pointerType === 'touch') return;
    dockInner.querySelectorAll('.dock__item').forEach((btn) => {
      const r = btn.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const s = 1 + 0.55 * Math.max(0, 1 - d / 150) ** 1.6;
      btn.style.setProperty('--s', s.toFixed(3));
    });
  });
  dockInner.addEventListener('pointerleave', () => dockInner.querySelectorAll('.dock__item').forEach((b) => b.style.setProperty('--s', 1)));

  OS.wm.on('change', updateRunning);
  fs.on('change', OS.debounce(() => {
    const full = Object.keys(fs.get('/Corbeille')?.children || {}).length > 0;
    const icon = dockInner.querySelector('.dock__item[data-app="trash"] .dock__icon');
    if (icon) icon.innerHTML = OS.icons.trash(full);
  }, 50));

  async function emptyTrash() {
    const n = Object.keys(fs.get('/Corbeille').children).length;
    if (!n) return;
    const ok = await OS.dialog({
      title: 'Vider la corbeille ?',
      message: `${n} élément${n > 1 ? 's seront supprimés' : ' sera supprimé'} définitivement.`,
      buttons: [{ label: 'Annuler', value: false }, { label: 'Vider', value: true, primary: true, danger: true }],
    });
    if (ok) fs.emptyTrash();
  }
  OS.emptyTrash = emptyTrash;

  /* =========================================================
     BUREAU (icônes)
     ========================================================= */
  const iconsLayer = $('#desktop-icons');
  let selected = new Set();
  const GRID_X = 96;
  const GRID_Y = 102;

  const defaultPos = (i) => {
    const rows = Math.max(1, Math.floor((window.innerHeight - 28 - 110) / GRID_Y));
    const col = Math.floor(i / rows);
    const row = i % rows;
    return { x: window.innerWidth - 112 - col * GRID_X, y: 14 + row * GRID_Y };
  };

  function renderDesktop() {
    iconsLayer.replaceChildren();
    const items = fs.list('/Bureau') || [];
    let auto = 0;
    items.forEach((item) => {
      const pos = OS.settings.iconPos[item.name] || defaultPos(auto++);
      const label = h('span', { class: 'dicon__label' }, item.name);
      const el = h('div', {
        class: `dicon${selected.has(item.path) ? ' is-selected' : ''}`,
        tabindex: '0',
        draggable: 'true',
        dataset: { path: item.path, kind: item.kind },
        style: { left: OS.clamp(pos.x, 0, window.innerWidth - 90) + 'px', top: OS.clamp(pos.y, 0, window.innerHeight - 160) + 'px' },
      }, h('span', { class: 'dicon__img', html: OS.itemIcon(item) }), label);

      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        OS.wm.focus(null);
        if (e.shiftKey || e.metaKey || e.ctrlKey) { selected.has(item.path) ? selected.delete(item.path) : selected.add(item.path); }
        else if (!selected.has(item.path)) selected = new Set([item.path]);
        syncSelection();
      });
      el.addEventListener('dblclick', () => OS.openPath(item.path));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') OS.openPath(item.path);
        if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) OS.trashItems([...selected]);
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selected.has(item.path)) { selected = new Set([item.path]); syncSelection(); }
        OS.menu.open([
          { label: 'Ouvrir', bold: true, action: () => OS.openPath(item.path) },
          { sep: true },
          { label: 'Renommer', action: () => OS.inlineRename(label, item.path, (np) => moveIconPos(item.name, fs.base(np))) },
          { label: 'Dupliquer', action: () => fs.copy(item.path, '/Bureau') },
          item.kind === 'image' ? { label: 'Utiliser comme fond d\'écran', action: () => setPhotoWallpaper(item.node.src) } : null,
          { sep: true },
          { label: 'Placer dans la corbeille', action: () => OS.trashItems([...selected]) },
        ], { x: e.clientX, y: e.clientY });
      });
      el.addEventListener('dragstart', (e) => {
        const r = el.getBoundingClientRect();
        e.dataTransfer.setData('text/nimbus-path', [...(selected.has(item.path) ? selected : [item.path])].join('\n'));
        e.dataTransfer.setData('text/nimbus-offset', `${e.clientX - r.left},${e.clientY - r.top}`);
        e.dataTransfer.effectAllowed = 'move';
      });
      if (item.kind === 'folder') {
        el.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/nimbus-path')) { e.preventDefault(); e.stopPropagation(); el.classList.add('is-drop'); } });
        el.addEventListener('dragleave', () => el.classList.remove('is-drop'));
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          el.classList.remove('is-drop');
          e.dataTransfer.getData('text/nimbus-path').split('\n').filter((p) => p && p !== item.path).forEach((p) => {
            try { fs.move(p, item.path); } catch (err) { OS.notify({ title: 'Déplacement impossible', body: err.message }); }
          });
        });
      }
      iconsLayer.append(el);
    });
  }

  const syncSelection = () => iconsLayer.querySelectorAll('.dicon').forEach((el) => el.classList.toggle('is-selected', selected.has(el.dataset.path)));
  const moveIconPos = (oldName, newName) => {
    const pos = { ...OS.settings.iconPos };
    if (pos[oldName]) { pos[newName] = pos[oldName]; delete pos[oldName]; OS.setSetting('iconPos', pos); }
  };
  const setPhotoWallpaper = (src) => {
    const m = src.match(/photo-([\w-]+)/);
    let wp = m && OS.WALLPAPERS.find((w) => w.photo === m[1]);
    if (!wp && m) { wp = { id: 'photo-' + m[1], name: 'Photo', photo: m[1] }; OS.WALLPAPERS.push(wp); }
    if (wp) OS.setSetting('wallpaper', wp.id);
  };
  OS.setPhotoWallpaper = setPhotoWallpaper;

  const desktop = $('#desktop');
  desktop.addEventListener('pointerdown', (e) => {
    if (e.target !== desktop && e.target !== iconsLayer) return;
    selected.clear();
    syncSelection();
    OS.wm.focus(null);
  });
  desktop.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/nimbus-path')) e.preventDefault(); });
  desktop.addEventListener('drop', (e) => {
    e.preventDefault();
    const paths = e.dataTransfer.getData('text/nimbus-path').split('\n').filter(Boolean);
    const [ox, oy] = (e.dataTransfer.getData('text/nimbus-offset') || '40,30').split(',').map(Number);
    const pos = { ...OS.settings.iconPos };
    paths.forEach((p, i) => {
      let np = p;
      if (fs.parent(p) !== '/Bureau') {
        try { np = fs.move(p, '/Bureau'); } catch (err) { OS.notify({ title: 'Déplacement impossible', body: err.message }); return; }
      }
      pos[fs.base(np)] = { x: Math.round(e.clientX - ox + i * 16), y: Math.round(e.clientY - 28 - oy + i * 16) };
    });
    OS.setSetting('iconPos', pos);
    renderDesktop();
  });
  desktop.addEventListener('contextmenu', (e) => {
    if (e.target !== desktop && e.target !== iconsLayer) return;
    e.preventDefault();
    OS.menu.open([
      { label: 'Nouveau dossier', action: () => newOnDesktop(() => fs.mkdir('/Bureau/Nouveau dossier', { unique: true }), e) },
      { label: 'Nouveau document texte', action: () => newOnDesktop(() => fs.writeFile('/Bureau/' + fs.uniqueName('/Bureau', 'Sans titre.txt'), ''), e) },
      { sep: true },
      { label: 'Changer le fond d\'écran…', action: () => OS.launch('settings', { section: 'wallpaper' }) },
      { label: 'Ranger les icônes', action: () => OS.setSetting('iconPos', {}) },
      { sep: true },
      { label: 'Ouvrir le Terminal', action: () => OS.launch('terminal') },
    ], { x: e.clientX, y: e.clientY });
  });
  const newOnDesktop = (create, e) => {
    const p = create();
    OS.setSetting('iconPos', { ...OS.settings.iconPos, [fs.base(p)]: { x: e.clientX - 45, y: e.clientY - 28 - 30 } });
    renderDesktop();
    const label = iconsLayer.querySelector(`.dicon[data-path="${CSS.escape(p)}"] .dicon__label`);
    if (label) OS.inlineRename(label, p, (np) => moveIconPos(fs.base(p), fs.base(np)));
  };

  fs.on('change', OS.debounce(renderDesktop, 30));
  OS.on('settings', (k) => { if (k === 'iconPos') renderDesktop(); });
  window.addEventListener('resize', OS.debounce(renderDesktop, 150));

  /* =========================================================
     RECHERCHE (⌘K)
     ========================================================= */
  const spot = $('#spotlight');
  const spotInput = h('input', { class: 'spot__input', placeholder: 'Rechercher une app, un fichier ou calculer…', spellcheck: 'false', 'aria-label': 'Rechercher' });
  const spotList = h('div', { class: 'spot__results', role: 'listbox' });
  spot.append(h('div', { class: 'spot__box' }, h('div', { class: 'spot__bar' }, h('span', { html: sym.search }), spotInput), spotList));
  let results = [];
  let sel = 0;
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const calc = (q) => {
    if (!/^[\d\s.,+\-*/()%^]+$/.test(q) || !/[+\-*/%^]/.test(q) || !/\d/.test(q)) return null;
    try {
      const v = Function(`"use strict"; return (${q.replace(/,/g, '.').replace(/\^/g, '**')})`)();
      return Number.isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
    } catch { return null; }
  };

  const searchAll = (q) => {
    const out = [];
    if (!q.trim()) {
      ['files', 'notes', 'terminal', 'settings'].forEach((id) => out.push({ group: 'Suggestions', title: OS.apps[id].name, sub: 'Application', icon: OS.apps[id].icon(), run: () => OS.launch(id) }));
      return out;
    }
    const v = calc(q);
    if (v != null) out.push({ group: 'Calcul', title: `= ${v.toLocaleString('fr-FR')}`, sub: 'Entrée pour copier', icon: OS.icons.calculator(), run: () => { navigator.clipboard?.writeText(String(v)); OS.notify({ title: 'Résultat copié', body: String(v), app: 'calculator' }); } });
    const sq = strip(q);
    Object.values(OS.apps).filter((a) => strip(a.name).includes(sq) || (a.keywords || []).some((k) => strip(k).includes(sq)))
      .forEach((a) => out.push({ group: 'Applications', title: a.name, sub: 'Application', icon: a.icon(), run: () => OS.launch(a.id) }));
    fs.find(q).slice(0, 8).forEach((it) => out.push({ group: 'Fichiers', title: it.name, sub: it.path, icon: OS.itemIcon(it), run: () => OS.openPath(it.path) }));
    [
      { k: ['sombre', 'dark', 'clair', 'theme', 'thème'], title: 'Basculer mode clair / sombre', run: OS.toggleDark },
      { k: ['fond', 'wallpaper', 'écran'], title: 'Fond d\'écran suivant', run: OS.nextWallpaper },
      { k: ['verrou', 'lock'], title: 'Verrouiller l\'écran', run: () => OS.lock() },
      { k: ['corbeille', 'vider'], title: 'Vider la corbeille', run: () => OS.emptyTrash() },
    ].filter((a) => a.k.some((k) => strip(k).startsWith(sq) || sq.startsWith(strip(k)))).forEach((a) => out.push({ group: 'Actions', title: a.title, sub: 'Action', icon: OS.icons.settings(), run: a.run }));
    out.push({ group: 'Web', title: `Rechercher « ${q} »`, sub: 'Navigateur', icon: OS.icons.browser(), run: () => OS.launch('browser', { url: q }) });
    return out;
  };

  const renderSpot = () => {
    results = searchAll(spotInput.value);
    sel = Math.min(sel, results.length - 1);
    spotList.replaceChildren();
    let group = '';
    results.forEach((r, i) => {
      if (r.group !== group) { group = r.group; spotList.append(h('div', { class: 'spot__group' }, group)); }
      spotList.append(h('button', {
        class: `spot__item${i === sel ? ' is-sel' : ''}`,
        role: 'option',
        onpointermove: () => { if (sel !== i) { sel = i; renderSpot(); } },
        onclick: () => run(i),
      }, h('span', { class: 'spot__icon', html: r.icon }), h('span', { class: 'spot__t' }, h('strong', {}, r.title), h('small', {}, r.sub))));
    });
  };
  const run = (i) => { const r = results[i]; OS.spotlight.close(); r?.run(); };

  OS.spotlight = {
    open() { spot.hidden = false; spotInput.value = ''; sel = 0; renderSpot(); requestAnimationFrame(() => spotInput.focus()); },
    close() { spot.hidden = true; },
    toggle() { spot.hidden ? OS.spotlight.open() : OS.spotlight.close(); },
  };
  spotInput.addEventListener('input', () => { sel = 0; renderSpot(); });
  spotInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % results.length; renderSpot(); spotList.querySelector('.is-sel')?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + results.length) % results.length; renderSpot(); spotList.querySelector('.is-sel')?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') run(sel);
    if (e.key === 'Escape') OS.spotlight.close();
  });
  spot.addEventListener('pointerdown', (e) => { if (e.target === spot) OS.spotlight.close(); });

  /* =========================================================
     RACCOURCIS CLAVIER GLOBAUX
     ========================================================= */
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'k' || e.key === 'K' || e.code === 'Space')) { e.preventDefault(); OS.spotlight.toggle(); return; }
    if (e.key === 'Escape') { OS.menu.close(); if (!spot.hidden) OS.spotlight.close(); }
    const win = OS.wm.focused();
    if (e.altKey && e.code === 'KeyW' && win) { e.preventDefault(); win.close(); }
    if (e.altKey && e.code === 'KeyM' && win) { e.preventDefault(); OS.wm.minimize(win); }
    if (e.ctrlKey && e.metaKey && e.code === 'KeyQ') { e.preventDefault(); OS.lock(); }
  });

  /* =========================================================
     FENÊTRES SYSTÈME : À propos, raccourcis
     ========================================================= */
  function about() {
    const existing = OS.wm.list().find((w) => w.el.classList.contains('win--about'));
    if (existing) return OS.wm.focus(existing);
    const win = OS.wm.open({ app: 'system', title: '', width: 300, height: 410, resizable: false, className: 'win--about' });
    const mem = navigator.deviceMemory ? `${navigator.deviceMemory} Go` : 'Partagée avec le navigateur';
    win.body.append(h('div', { class: 'about' },
      h('div', { class: 'about__logo', html: OS.icons.logo() }),
      h('h2', {}, 'Nimbus'),
      h('p', { class: 'about__ver' }, 'Version 1.0 · édition démo'),
      h('dl', {},
        h('dt', {}, 'Moteur'), h('dd', {}, 'Navigateur web'),
        h('dt', {}, 'Mémoire'), h('dd', {}, mem),
        h('dt', {}, 'Écran'), h('dd', {}, `${window.screen.width} × ${window.screen.height}`),
        h('dt', {}, 'Stockage'), h('dd', {}, OS.fmtSize(OS.store.size()) + ' utilisés')),
      h('button', { class: 'btn', onclick: () => { win.close(); OS.launch('settings', { section: 'general' }); } }, 'Plus d\'infos…'),
      h('p', { class: 'about__legal' },
        h('a', { href: 'mentions-legales.html', target: '_blank', rel: 'noopener' }, 'Mentions légales'), ' · ',
        h('a', { href: 'confidentialite.html', target: '_blank', rel: 'noopener' }, 'Confidentialité'), ' · ',
        h('a', { href: 'credits.html', target: '_blank', rel: 'noopener' }, 'Crédits'))));
  }

  function shortcuts() {
    const win = OS.wm.open({ app: 'system', title: 'Raccourcis clavier', width: 380, height: 330, resizable: false });
    const rows = [
      [`${MOD}K`, 'Ouvrir la recherche'],
      [isMac ? '⌥W' : 'Alt+W', 'Fermer la fenêtre active'],
      [isMac ? '⌥M' : 'Alt+M', 'Réduire la fenêtre active'],
      [isMac ? '⌃⌘Q' : '—', 'Verrouiller l\'écran'],
      ['Double-clic', 'Plein écran (barre de titre)'],
      ['Entrée', 'Ouvrir l\'élément sélectionné'],
      ['Suppr', 'Placer dans la corbeille'],
      ['Tab', 'Compléter dans le Terminal'],
    ];
    win.body.append(h('div', { class: 'shortcuts' }, rows.map(([k, l]) => h('div', { class: 'shortcuts__row' }, h('kbd', {}, k), h('span', {}, l)))));
  }

  /* =========================================================
     VERROUILLAGE ET DÉMARRAGE
     ========================================================= */
  const lock = $('#lock');
  OS.lock = () => {
    OS.menu.close();
    OS.spotlight.close();
    lock.hidden = false;
    requestAnimationFrame(() => lock.classList.add('is-on'));
    setTimeout(() => $('#lock-enter').focus(), 300);
  };
  const unlock = () => {
    lock.classList.remove('is-on');
    setTimeout(() => { lock.hidden = true; }, 500);
  };
  $('#lock-enter').addEventListener('click', unlock);
  lock.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') unlock(); });

  OS.boot = (done) => {
    const boot = $('#boot');
    const bar = $('#boot-bar');
    let p = 0;
    const step = () => {
      p = document.hidden ? 1 : Math.min(1, p + 0.04 + Math.random() * 0.07); // onglet caché : inutile d'animer
      bar.style.transform = `scaleX(${p})`;
      if (p < 1) setTimeout(step, 30 + Math.random() * 40);
      else setTimeout(() => {
        boot.classList.add('is-done');
        setTimeout(() => { boot.remove(); done?.(); }, 500);
      }, 150);
    };
    setTimeout(step, 150);
  };

  OS.about = about;
  OS.renderDock = renderDock;
  OS.renderDesktop = renderDesktop;
})();
