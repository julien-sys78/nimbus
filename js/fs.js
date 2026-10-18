/* =========================================================
   NIMBUS — système de fichiers virtuel (sauvegardé dans le navigateur)
   Les chemins partent de la racine « / » qui est le dossier personnel.
   ========================================================= */
OS.fs = (() => {
  const bus = OS.emitter();
  const now = () => Date.now();
  const dir = (children = {}) => ({ type: 'dir', mtime: now(), children });
  const file = (props) => ({ type: 'file', mtime: now(), ...props });
  const PROTECTED = ['/Applications', '/Bureau', '/Documents', '/Images', '/Musique', '/Corbeille'];

  const seed = () => dir({
    Applications: dir(),
    Bureau: dir({
      'Lisez-moi.txt': file({ content: 'Bienvenue sur Nimbus !\n\nCe bureau est une démo interactive : tout fonctionne vraiment.\n\n• Double-cliquez sur une icône pour l\'ouvrir.\n• Glissez les fenêtres par leur barre de titre, redimensionnez-les par les bords.\n• Clic droit sur le bureau ou dans Fichiers pour créer des dossiers et des documents.\n• Ouvrez la recherche avec ⌘K (ou Ctrl+K).\n• Tapez « help » dans le Terminal pour voir les commandes.\n\nVos modifications sont enregistrées dans ce navigateur. Réglages › Général permet de tout remettre à zéro.' }),
      'Captures': dir({}),
      'Sommets.jpg': file({ src: OS.img('1506905925346-21bda4d32df4') }),
    }),
    Documents: dir({
      'Bienvenue.txt': file({ content: 'Nimbus est un mini système d\'exploitation qui tourne entièrement dans le navigateur.\n\nIl comprend un gestionnaire de fichiers, un bloc-notes, un terminal, des réglages, une galerie photo, un lecteur de musique, une calculatrice, un calendrier, un navigateur et une messagerie.\n\nAucune donnée ne quitte votre appareil.' }),
      'Idées.txt': file({ content: 'Idées pour la semaine\n\n- Ranger le dossier Images\n- Tester le mode sombre dans Réglages\n- Écouter la playlist « Néon »\n- Essayer la commande « matrix » dans le Terminal' }),
      'Liste de courses.txt': file({ content: 'Courses\n\n☐ Pain\n☐ Café\n☐ Tomates\n☐ Fromage\n☐ Fleurs' }),
      Projets: dir({
        'Feuille de route.txt': file({ content: 'Feuille de route\n\nT1 — Maquettes\nT2 — Développement\nT3 — Tests utilisateurs\nT4 — Lancement' }),
      }),
    }),
    Images: dir({
      'Sommets.jpg': file({ src: OS.img('1506905925346-21bda4d32df4') }),
      'Lac émeraude.jpg': file({ src: OS.img('1501785888041-af3ef285b470') }),
      'Aurore.jpg': file({ src: OS.img('1483347756197-71ef80e95f73') }),
      'Désert.jpg': file({ src: OS.img('1509316785289-025f5b846b35') }),
      'Forêt.jpg': file({ src: OS.img('1441974231531-c6227db76b6e') }),
      'Plage.jpg': file({ src: OS.img('1507525428034-b723cf961d3e') }),
      'Voie lactée.jpg': file({ src: OS.img('1519681393784-d120267933ba') }),
      'Cascade.jpg': file({ src: OS.img('1433086966358-54859d0ed716') }),
      'Vallée.jpg': file({ src: OS.img('1470071459604-3b5ec3a7fe05') }),
    }),
    Musique: dir({
      'Aube.mp3': file({ track: 0 }),
      'Dérive.mp3': file({ track: 1 }),
      'Néon.mp3': file({ track: 2 }),
      'Pluie.mp3': file({ track: 3 }),
    }),
    Corbeille: dir({}),
  });

  let root = OS.store.get('fs', null) || seed();

  /* ---------- Chemins ---------- */
  const parts = (p) => p.split('/').filter(Boolean);
  const norm = (p) => {
    const out = [];
    for (const s of parts(p)) {
      if (s === '.') continue;
      if (s === '..') out.pop(); else out.push(s);
    }
    return '/' + out.join('/');
  };
  const resolve = (cwd, p) => {
    if (!p || p === '~') return '/';
    if (p.startsWith('~/')) p = p.slice(1);
    return norm(p.startsWith('/') ? p : cwd + '/' + p);
  };
  const join = (a, b) => norm(a + '/' + b);
  const parent = (p) => norm(p + '/..');
  const base = (p) => parts(p).pop() || '/';
  const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
  const stem = (name) => (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name);

  /* ---------- Lecture ---------- */
  const appNode = (name) => {
    const app = Object.values(OS.apps || {}).find((a) => a.name === name);
    return app ? { type: 'file', app: app.id, mtime: 0 } : null;
  };
  const get = (p) => {
    const ps = parts(norm(p));
    if (ps[0] === 'Applications' && ps.length === 2) return appNode(ps[1]);
    let n = root;
    for (const s of ps) {
      if (!n || n.type !== 'dir') return null;
      n = n.children[s];
    }
    return n || null;
  };
  const isDir = (p) => get(p)?.type === 'dir';

  const kind = (name, node) => {
    if (!node) return 'file';
    if (node.type === 'dir') return 'folder';
    if (node.app) return 'app';
    const e = ext(name);
    if (['txt', 'md', 'log', 'js', 'css', 'html', 'json'].includes(e)) return 'text';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e) || node.src) return 'image';
    if (['mp3', 'wav', 'ogg'].includes(e) || node.track != null) return 'audio';
    return 'file';
  };
  const KIND_LABEL = { folder: 'Dossier', app: 'Application', text: 'Document texte', image: 'Image', audio: 'Audio', file: 'Document' };

  const list = (p) => {
    p = norm(p);
    if (p === '/Applications') {
      return Object.values(OS.apps || {}).map((a) => ({ name: a.name, path: '/Applications/' + a.name, node: appNode(a.name), kind: 'app' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    const n = get(p);
    if (!n || n.type !== 'dir') return null;
    return Object.entries(n.children)
      .map(([name, node]) => ({ name, path: join(p, name), node, kind: kind(name, node) }))
      .sort((a, b) => (a.node.type === b.node.type ? a.name.localeCompare(b.name, 'fr', { numeric: true }) : a.node.type === 'dir' ? -1 : 1));
  };

  const size = (node) => {
    if (!node) return 0;
    if (node.type === 'dir') return Object.values(node.children).reduce((s, c) => s + size(c), 0);
    if (node.content != null) return new Blob([node.content]).size;
    if (node.src) return 2400000;
    if (node.track != null) return 3600000;
    return 0;
  };

  const walk = (p, fn) => {
    (list(p) || []).forEach((item) => {
      fn(item);
      if (item.node.type === 'dir') walk(item.path, fn);
    });
  };
  const find = (query, { kind: k, includeTrash = false } = {}) => {
    const q = (query || '').toLowerCase();
    const out = [];
    walk('/', (item) => {
      if (!includeTrash && item.path.startsWith('/Corbeille')) return;
      if (item.path.startsWith('/Applications')) return;
      if (k && item.kind !== k) return;
      if (!q || item.name.toLowerCase().includes(q)) out.push(item);
    });
    return out;
  };

  /* ---------- Écriture ---------- */
  const persist = OS.debounce(() => OS.store.set('fs', root), 150);
  const changed = () => { persist(); bus.emit('change'); };
  const fail = (msg) => { throw new Error(msg); };

  const uniqueName = (dirPath, name) => {
    const d = get(dirPath);
    if (!d || !d.children[name]) return name;
    const e = ext(name);
    const s = e ? stem(name) : name;
    let i = 2;
    while (d.children[`${s} ${i}${e ? '.' + e : ''}`]) i++;
    return `${s} ${i}${e ? '.' + e : ''}`;
  };

  const writable = (dirPath) => {
    const d = get(dirPath);
    if (!d) fail(`${dirPath} : dossier introuvable`);
    if (d.type !== 'dir') fail(`${dirPath} : n'est pas un dossier`);
    if (norm(dirPath) === '/Applications') fail('Applications est en lecture seule');
    return d;
  };

  const create = (p, node, { unique = false } = {}) => {
    p = norm(p);
    const d = writable(parent(p));
    let name = base(p);
    if (!name || name.includes('/')) fail('Nom invalide');
    if (d.children[name]) {
      if (!unique) fail(`${name} existe déjà`);
      name = uniqueName(parent(p), name);
    }
    d.children[name] = node;
    d.mtime = now();
    changed();
    return join(parent(p), name);
  };

  const mkdir = (p, opts) => create(p, dir(), opts);

  const writeFile = (p, content, { append = false } = {}) => {
    p = norm(p);
    const n = get(p);
    if (n && n.type === 'dir') fail(`${base(p)} est un dossier`);
    if (n) {
      n.content = append ? (n.content || '') + content : content;
      n.mtime = now();
      changed();
      return p;
    }
    return create(p, file({ content }));
  };

  const isProtected = (p) => PROTECTED.includes(norm(p)) || norm(p) === '/' || norm(p).startsWith('/Applications');

  const detach = (p) => {
    const d = get(parent(p));
    const n = d && d.children[base(p)];
    if (!n) fail(`${base(p)} : introuvable`);
    delete d.children[base(p)];
    d.mtime = now();
    return n;
  };

  const remove = (p, { permanent = false } = {}) => {
    p = norm(p);
    if (isProtected(p)) fail(`${base(p)} ne peut pas être supprimé`);
    if (permanent || p.startsWith('/Corbeille/')) {
      detach(p);
      changed();
      return null;
    }
    const n = detach(p);
    n.origin = parent(p);
    const name = uniqueName('/Corbeille', base(p));
    get('/Corbeille').children[name] = n;
    changed();
    return '/Corbeille/' + name;
  };

  const restore = (p) => {
    const n = get(p);
    if (!n) fail('Introuvable');
    const dest = n.origin && isDir(n.origin) ? n.origin : '/Bureau';
    return move(p, dest);
  };

  const emptyTrash = () => { get('/Corbeille').children = {}; changed(); };

  const rename = (p, newName) => {
    p = norm(p);
    newName = (newName || '').trim();
    if (isProtected(p)) fail(`${base(p)} ne peut pas être renommé`);
    if (!newName || newName.includes('/')) fail('Nom invalide');
    if (newName === base(p)) return p;
    const d = get(parent(p));
    if (d.children[newName]) fail(`${newName} existe déjà`);
    d.children[newName] = d.children[base(p)];
    delete d.children[base(p)];
    d.children[newName].mtime = now();
    changed();
    return join(parent(p), newName);
  };

  const move = (src, destDir, { unique = true } = {}) => {
    src = norm(src);
    destDir = norm(destDir);
    if (isProtected(src)) fail(`${base(src)} ne peut pas être déplacé`);
    if (destDir === parent(src)) return src;
    if ((destDir + '/').startsWith(src + '/')) fail('Impossible de déplacer un dossier dans lui-même');
    const d = writable(destDir);
    let name = base(src);
    if (d.children[name]) {
      if (!unique) fail(`${name} existe déjà dans ${base(destDir)}`);
      name = uniqueName(destDir, name);
    }
    const n = detach(src);
    if (destDir !== '/Corbeille') delete n.origin;
    d.children[name] = n;
    d.mtime = now();
    changed();
    return join(destDir, name);
  };

  const copy = (src, destDir) => {
    const n = get(src);
    if (!n) fail(`${base(src)} : introuvable`);
    const clone = JSON.parse(JSON.stringify(n));
    clone.mtime = now();
    return create(join(destDir, base(src)), clone, { unique: true });
  };

  const reset = () => { root = seed(); changed(); };

  return {
    on: bus.on, get, list, isDir, kind, KIND_LABEL, size, find, walk,
    resolve, norm, join, parent, base, ext, stem, uniqueName, isProtected,
    mkdir, writeFile, create, remove, restore, emptyTrash, rename, move, copy, reset,
    file, dir,
  };
})();
