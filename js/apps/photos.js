/* =========================================================
   Photos — galerie et visionneuse
   ========================================================= */
(() => {
  const { h, fs, sym } = OS;

  function launch(args = {}) {
    const win = OS.wm.open({ app: 'photos', title: 'Photos', width: 860, height: 560, minW: 420, minH: 300, className: 'win--photos' });
    let photos = [];
    let index = -1;
    let slideshow = null;

    const backBtn = h('button', { class: 'tb-btn', html: sym.back, 'aria-label': 'Retour à la galerie', onclick: () => closeViewer() });
    const counter = h('span', { class: 'tb-title' });
    const slideBtn = h('button', { class: 'tb-btn', onclick: () => toggleSlideshow() }, h('span', { html: sym.play }), 'Diaporama');
    const wpBtn = h('button', { class: 'tb-btn', onclick: () => { if (photos[index]) { OS.setPhotoWallpaper(photos[index].node.src); OS.notify({ title: 'Fond d\'écran modifié', body: photos[index].name, app: 'photos' }); } } }, 'Fond d\'écran');
    win.toolbar.append(backBtn, counter, h('div', { class: 'tb-spacer' }), wpBtn, slideBtn);

    const grid = h('div', { class: 'photos__grid' });
    const viewerImg = h('img', { class: 'photos__img', alt: '' });
    const prev = h('button', { class: 'photos__nav photos__nav--prev', 'aria-label': 'Précédente', html: sym.back, onclick: () => show(index - 1) });
    const next = h('button', { class: 'photos__nav photos__nav--next', 'aria-label': 'Suivante', html: sym.fwd, onclick: () => show(index + 1) });
    const caption = h('div', { class: 'photos__caption' });
    const viewer = h('div', { class: 'photos__viewer', tabindex: '0' }, viewerImg, prev, next, caption);
    win.body.append(grid, viewer);

    function load() {
      photos = fs.find('', { kind: 'image' }).filter((p) => p.node.src);
      const seen = new Set();
      photos = photos.filter((p) => (seen.has(p.node.src + p.name) ? false : seen.add(p.node.src + p.name)));
    }

    function renderGrid() {
      load();
      grid.replaceChildren();
      const byFolder = {};
      photos.forEach((p, i) => { (byFolder[fs.parent(p.path)] ||= []).push([p, i]); });
      Object.entries(byFolder).forEach(([folder, list]) => {
        grid.append(h('h3', { class: 'photos__h' }, folder === '/' ? 'Photos' : fs.base(folder), h('span', {}, `${list.length} photo${list.length > 1 ? 's' : ''}`)));
        grid.append(h('div', { class: 'photos__tiles' }, list.map(([p, i]) => h('button', {
          class: 'photos__tile',
          'aria-label': p.name,
          onclick: () => show(i),
          oncontextmenu: (e) => {
            e.preventDefault();
            OS.menu.open([
              { label: 'Ouvrir', action: () => show(i) },
              { label: 'Utiliser comme fond d\'écran', action: () => OS.setPhotoWallpaper(p.node.src) },
              { label: 'Afficher dans Fichiers', action: () => OS.launch('files', { path: fs.parent(p.path) }) },
              { sep: true },
              { label: 'Placer dans la corbeille', action: () => OS.trashItems([p.path]) },
            ], { x: e.clientX, y: e.clientY });
          },
        }, h('img', { src: OS.thumb(p.node.src, 500), alt: p.name, loading: 'lazy', draggable: 'false' })))));
      });
      if (!photos.length) grid.append(h('p', { class: 'photos__empty' }, 'Aucune photo. Ajoutez des images dans le dossier Images.'));
    }

    function show(i) {
      if (!photos.length) return;
      index = (i + photos.length) % photos.length;
      const p = photos[index];
      win.el.classList.add('is-viewing');
      viewerImg.classList.remove('is-in');
      viewerImg.onload = () => viewerImg.classList.add('is-in');
      viewerImg.src = OS.thumb(p.node.src, 1800);
      viewerImg.alt = p.name;
      caption.textContent = fs.stem(p.name);
      counter.textContent = `${index + 1} sur ${photos.length}`;
      win.setTitle(p.name);
      viewer.focus({ preventScroll: true });
    }

    function closeViewer() {
      stopSlideshow();
      win.el.classList.remove('is-viewing');
      index = -1;
      counter.textContent = '';
      win.setTitle('Photos');
    }

    function toggleSlideshow() { slideshow ? stopSlideshow() : startSlideshow(); }
    function startSlideshow() {
      if (index < 0) show(0);
      slideBtn.firstChild.innerHTML = sym.pause;
      slideshow = setInterval(() => show(index + 1), 3000);
    }
    function stopSlideshow() {
      clearInterval(slideshow);
      slideshow = null;
      slideBtn.firstChild.innerHTML = sym.play;
    }

    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'Escape') closeViewer();
    });

    const unsub = fs.on('change', OS.debounce(() => { if (index < 0) renderGrid(); else load(); }, 80));
    win.cleanup.push(unsub, stopSlideshow);
    win.openFile = (path) => {
      load();
      const i = photos.findIndex((p) => p.path === path);
      if (i >= 0) show(i);
    };

    renderGrid();
    if (args.path) win.openFile(args.path);
    return win;
  }

  OS.registerApp({
    id: 'photos',
    name: 'Photos',
    single: true,
    keywords: ['images', 'galerie', 'diaporama'],
    about: 'Parcourez les images de votre dossier personnel.',
    icon: OS.icons.photos,
    launch,
    handle(win, args) { if (args.path) win.openFile(args.path); },
  });
})();
