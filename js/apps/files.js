/* =========================================================
   Fichiers — gestionnaire de fichiers
   ========================================================= */
(() => {
  const { h, fs, sym } = OS;

  const PLACES = [
    { header: 'Favoris' },
    { path: '/Bureau', label: 'Bureau', icon: sym.desktop },
    { path: '/Documents', label: 'Documents', icon: sym.doc },
    { path: '/Images', label: 'Images', icon: sym.photo },
    { path: '/Musique', label: 'Musique', icon: sym.music },
    { path: '/Applications', label: 'Applications', icon: sym.apps },
    { header: 'Emplacements' },
    { path: '/Corbeille', label: 'Corbeille', icon: sym.trash },
  ];

  function launch(args = {}) {
    const win = OS.wm.open({ app: 'files', title: 'Fichiers', width: 820, height: 500, minW: 460, minH: 280 });
    let cwd = args.path && fs.isDir(args.path) ? fs.norm(args.path) : '/Documents';
    let history = [cwd];
    let hpos = 0;
    let view = OS.store.get('files-view', 'grid');
    let selected = new Set();
    let query = '';

    /* ---------- Barre d'outils ---------- */
    const back = h('button', { class: 'tb-btn', 'aria-label': 'Précédent', html: sym.back, onclick: () => go(history[--hpos], false) });
    const fwd = h('button', { class: 'tb-btn', 'aria-label': 'Suivant', html: sym.fwd, onclick: () => go(history[++hpos], false) });
    const title = h('span', { class: 'tb-title' });
    const gridBtn = h('button', { class: 'tb-btn', 'aria-label': 'Icônes', html: sym.grid, onclick: () => setView('grid') });
    const listBtn = h('button', { class: 'tb-btn', 'aria-label': 'Liste', html: sym.list, onclick: () => setView('list') });
    const newBtn = h('button', { class: 'tb-btn', 'aria-label': 'Nouveau dossier', title: 'Nouveau dossier', html: sym.newFolder, onclick: () => createIn('folder') });
    const search = h('input', { class: 'field field--search', placeholder: 'Rechercher', style: { width: '160px' }, 'aria-label': 'Rechercher des fichiers' });
    search.addEventListener('input', () => { query = search.value.trim(); render(); });
    win.toolbar.append(h('div', { class: 'tb-group' }, back, fwd), title, h('div', { class: 'tb-spacer' }), h('div', { class: 'tb-group' }, gridBtn, listBtn), newBtn, search);
    win.titleEl.hidden = true;

    /* ---------- Structure ---------- */
    const sidebar = h('aside', { class: 'files__side' });
    const main = h('div', { class: 'files__main', tabindex: '0' });
    const banner = h('div', { class: 'files__banner' });
    const status = h('div', { class: 'files__status' });
    win.body.append(h('div', { class: 'files' }, sidebar, h('div', { class: 'files__content' }, banner, main, status)));

    PLACES.forEach((p) => {
      if (p.header) { sidebar.append(h('div', { class: 'side__header' }, p.header)); return; }
      const item = h('button', { class: 'side__item', dataset: { path: p.path }, onclick: () => go(p.path) }, h('span', { html: p.icon }), p.label);
      dropTarget(item, () => p.path);
      sidebar.append(item);
    });

    /* ---------- Navigation ---------- */
    function go(path, push = true) {
      if (!fs.isDir(path)) return;
      cwd = fs.norm(path);
      if (push) { history = history.slice(0, hpos + 1); history.push(cwd); hpos = history.length - 1; }
      selected.clear();
      query = '';
      search.value = '';
      render();
    }
    function setView(v) { view = v; OS.store.set('files-view', v); render(); }

    /* ---------- Glisser-déposer ---------- */
    function dropTarget(el, getDest) {
      el.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('text/nimbus-path')) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('is-drop');
      });
      el.addEventListener('dragleave', () => el.classList.remove('is-drop'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('is-drop');
        const dest = getDest();
        e.dataTransfer.getData('text/nimbus-path').split('\n').filter((p) => p && p !== dest).forEach((p) => {
          try { dest === '/Corbeille' ? fs.remove(p) : fs.move(p, dest); } catch (err) { OS.notify({ title: 'Déplacement impossible', body: err.message }); }
        });
      });
    }
    dropTarget(main, () => cwd);

    /* ---------- Actions ---------- */
    function createIn(kind) {
      if (cwd === '/Applications' || cwd === '/Corbeille') return;
      const p = kind === 'folder'
        ? fs.mkdir(fs.join(cwd, 'Nouveau dossier'), { unique: true })
        : fs.writeFile(fs.join(cwd, fs.uniqueName(cwd, 'Sans titre.txt')), '');
      selected = new Set([p]);
      render();
      const label = main.querySelector(`[data-path="${CSS.escape(p)}"] .fitem__name`);
      if (label) OS.inlineRename(label, p, (np) => { selected = new Set([np]); render(); });
    }

    const inTrash = () => cwd === '/Corbeille';

    function itemMenu(item, e) {
      const paths = [...selected];
      const many = paths.length > 1;
      const items = inTrash()
        ? [
          { label: 'Remettre en place', action: () => paths.forEach((p) => fs.restore(p)) },
          { label: 'Supprimer définitivement', danger: true, action: () => paths.forEach((p) => fs.remove(p, { permanent: true })) },
        ]
        : [
          { label: 'Ouvrir', bold: true, action: () => paths.forEach(OS.openPath) },
          item.kind === 'folder' && !many ? { label: 'Ouvrir dans une nouvelle fenêtre', action: () => launch({ path: item.path }) } : null,
          { sep: true },
          !many && item.kind !== 'app' ? { label: 'Renommer', action: () => rename(item.path) } : null,
          item.kind !== 'app' ? { label: 'Dupliquer', action: () => paths.forEach((p) => fs.copy(p, fs.parent(p))) } : null,
          item.kind === 'image' && !many ? { label: 'Utiliser comme fond d\'écran', action: () => OS.setPhotoWallpaper(item.node.src) } : null,
          { label: 'Lire les informations', disabled: many, action: () => info(item) },
          item.kind !== 'app' ? { sep: true } : null,
          item.kind !== 'app' ? { label: 'Placer dans la corbeille', action: () => OS.trashItems(paths) } : null,
        ];
      OS.menu.open(items, { x: e.clientX, y: e.clientY });
    }

    function rename(path) {
      const label = main.querySelector(`[data-path="${CSS.escape(path)}"] .fitem__name`);
      if (label) OS.inlineRename(label, path, (np) => { selected = new Set([np]); render(); });
    }

    function info(item) {
      const node = item.node;
      const rows = [
        ['Type', fs.KIND_LABEL[item.kind]],
        ['Emplacement', fs.parent(item.path)],
        ['Taille', item.kind === 'folder' ? `${Object.keys(node.children).length} élément(s) · ${OS.fmtSize(fs.size(node))}` : OS.fmtSize(fs.size(node))],
        ['Modifié', node.mtime ? OS.fmtDate(node.mtime) : '—'],
      ];
      const w = OS.wm.open({ app: 'files', title: `Infos sur ${item.name}`, width: 320, height: 300, resizable: false });
      w.body.append(h('div', { class: 'finfo' },
        h('div', { class: 'finfo__icon', html: OS.itemIcon(item) }),
        h('strong', {}, item.name),
        h('dl', {}, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))));
    }

    main.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.fitem')) return;
      e.preventDefault();
      selected.clear();
      render();
      const ro = cwd === '/Applications';
      OS.menu.open(inTrash()
        ? [{ label: 'Vider la corbeille', danger: true, action: () => OS.emptyTrash() }]
        : [
          { label: 'Nouveau dossier', disabled: ro, action: () => createIn('folder') },
          { label: 'Nouveau document texte', disabled: ro, action: () => createIn('text') },
          { sep: true },
          { label: 'Affichage en icônes', checked: view === 'grid', action: () => setView('grid') },
          { label: 'Affichage en liste', checked: view === 'list', action: () => setView('list') },
          { sep: true },
          { label: 'Ouvrir dans le Terminal', action: () => OS.launch('terminal', { cwd }) },
        ], { x: e.clientX, y: e.clientY });
    });
    main.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.fitem')) { selected.clear(); syncSel(); }
    });
    main.addEventListener('keydown', (e) => {
      if (e.target !== main) return;
      const items = currentItems();
      if ((e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) && selected.size && cwd !== '/Applications') {
        inTrash() ? [...selected].forEach((p) => fs.remove(p, { permanent: true })) : OS.trashItems([...selected]);
      }
      if (e.key === 'Enter' && selected.size === 1) { e.preventDefault(); rename([...selected][0]); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') [...selected].forEach(open);
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp' && cwd !== '/') go(fs.parent(cwd));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selected = new Set(items.map((i) => i.path)); syncSel(); }
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key) && !e.metaKey && !e.ctrlKey && items.length) {
        e.preventDefault();
        const cur = items.findIndex((i) => selected.has(i.path));
        const cols = view === 'grid' ? Math.max(1, Math.floor(main.clientWidth / 104)) : 1;
        const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
        const next = OS.clamp(cur < 0 ? 0 : cur + delta, 0, items.length - 1);
        selected = new Set([items[next].path]);
        syncSel();
        main.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
      }
    });

    const open = (path) => (fs.isDir(path) ? go(path) : OS.openPath(path));

    /* ---------- Rendu ---------- */
    let rendered = [];
    const currentItems = () => rendered;
    const syncSel = () => main.querySelectorAll('.fitem').forEach((el) => el.classList.toggle('is-selected', selected.has(el.dataset.path)));

    function render() {
      if (!fs.isDir(cwd)) cwd = '/Documents';
      const items = query ? fs.find(query) : (fs.list(cwd) || []);
      rendered = items;
      const name = query ? `Résultats pour « ${query} »` : (cwd === '/' ? 'Dossier personnel' : fs.base(cwd));
      title.textContent = name;
      win.setTitle(name);
      back.disabled = hpos <= 0;
      fwd.disabled = hpos >= history.length - 1;
      gridBtn.classList.toggle('is-on', view === 'grid');
      listBtn.classList.toggle('is-on', view === 'list');
      newBtn.disabled = cwd === '/Applications' || inTrash();
      sidebar.querySelectorAll('.side__item').forEach((el) => el.classList.toggle('is-active', !query && el.dataset.path === cwd));

      banner.replaceChildren();
      if (inTrash() && !query) {
        banner.append(h('span', {}, 'Corbeille'), h('button', { class: 'btn', disabled: !items.length, onclick: () => OS.emptyTrash() }, 'Vider'));
      }
      banner.hidden = !banner.children.length;

      main.className = `files__main files__main--${view}`;
      main.replaceChildren();
      if (view === 'list') {
        main.append(h('div', { class: 'flist__head' }, h('span', {}, 'Nom'), h('span', {}, 'Modifié le'), h('span', {}, 'Taille'), h('span', {}, 'Type')));
      }
      if (!items.length) main.append(h('div', { class: 'files__empty' }, query ? 'Aucun résultat' : 'Dossier vide'));

      items.forEach((item) => {
        const label = h('span', { class: 'fitem__name' }, item.name);
        const el = h('div', {
          class: `fitem${selected.has(item.path) ? ' is-selected' : ''}`,
          draggable: item.kind !== 'app' ? 'true' : 'false',
          dataset: { path: item.path },
        },
        h('span', { class: 'fitem__icon', html: OS.itemIcon(item) }),
        label,
        view === 'list' ? [
          h('span', { class: 'fitem__meta' }, item.node.mtime ? OS.fmtDate(item.node.mtime) : '—'),
          h('span', { class: 'fitem__meta' }, item.kind === 'folder' ? '—' : item.kind === 'app' ? '—' : OS.fmtSize(fs.size(item.node))),
          h('span', { class: 'fitem__meta' }, fs.KIND_LABEL[item.kind]),
        ] : null);

        el.addEventListener('pointerdown', (e) => {
          if (e.button === 2 && selected.has(item.path)) return;
          if (e.metaKey || e.ctrlKey) selected.has(item.path) ? selected.delete(item.path) : selected.add(item.path);
          else if (e.shiftKey && selected.size) {
            const idx = items.findIndex((i) => selected.has(i.path));
            const cur = items.indexOf(item);
            const [a, b] = [Math.min(idx, cur), Math.max(idx, cur)];
            selected = new Set(items.slice(a, b + 1).map((i) => i.path));
          } else if (!selected.has(item.path)) selected = new Set([item.path]);
          syncSel();
        });
        el.addEventListener('dblclick', () => open(item.path));
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); itemMenu(item, e); });
        el.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/nimbus-path', [...(selected.has(item.path) ? selected : [item.path])].join('\n'));
          e.dataTransfer.effectAllowed = 'move';
        });
        if (item.kind === 'folder') dropTarget(el, () => item.path);
        main.append(el);
      });

      const n = items.length;
      const free = Math.max(0, 5 * 1048576 - OS.store.size());
      status.textContent = `${n} élément${n > 1 ? 's' : ''}${selected.size ? ` · ${selected.size} sélectionné${selected.size > 1 ? 's' : ''}` : ''} · ${OS.fmtSize(free)} disponibles`;
    }

    const unsub = fs.on('change', OS.debounce(() => {
      if (main.querySelector('.rename')) return; // ne pas interrompre un renommage
      render();
    }, 20));
    win.cleanup.push(unsub);
    win.onFocus = () => main.focus({ preventScroll: true });
    win.navigate = go;
    render();
    setTimeout(() => main.focus({ preventScroll: true }), 50);
    return win;
  }

  OS.registerApp({
    id: 'files',
    name: 'Fichiers',
    keywords: ['dossier', 'explorateur', 'gestionnaire'],
    about: 'Parcourez, organisez et ouvrez vos documents.',
    icon: OS.icons.files,
    launch,
    handle(win, args) { if (args.path) win.navigate(args.path); },
  });
})();
