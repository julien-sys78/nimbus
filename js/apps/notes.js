/* =========================================================
   Notes — bloc-notes relié au système de fichiers
   ========================================================= */
(() => {
  const { h, fs, sym } = OS;

  function launch(args = {}) {
    const win = OS.wm.open({ app: 'notes', title: 'Notes', width: 760, height: 480, minW: 420, minH: 260 });
    let current = null;
    let extra = new Set(); // fichiers ouverts hors du dossier Documents

    const newBtn = h('button', { class: 'tb-btn', 'aria-label': 'Nouvelle note', title: 'Nouvelle note', html: sym.compose, onclick: newNote });
    const delBtn = h('button', { class: 'tb-btn', 'aria-label': 'Supprimer la note', title: 'Placer dans la corbeille', html: sym.trash, onclick: deleteNote });
    const sizeBtn = h('button', { class: 'tb-btn', title: 'Taille du texte', onclick: () => { big = !big; OS.store.set('notes-big', big); editor.classList.toggle('is-big', big); } }, 'Aa');
    const search = h('input', { class: 'field field--search', placeholder: 'Rechercher', style: { width: '150px' }, 'aria-label': 'Rechercher dans les notes' });
    win.toolbar.append(h('div', { class: 'tb-spacer' }), sizeBtn, delBtn, newBtn, search);
    win.titleEl.hidden = true;

    const list = h('div', { class: 'notes__list' });
    const editor = h('textarea', { class: 'notes__editor', spellcheck: 'true', placeholder: 'Commencez à écrire…', 'aria-label': 'Contenu de la note' });
    const meta = h('div', { class: 'notes__meta' });
    const empty = h('div', { class: 'notes__empty' }, h('p', {}, 'Aucune note sélectionnée'), h('button', { class: 'btn btn--primary', onclick: newNote }, 'Nouvelle note'));
    let big = OS.store.get('notes-big', false);
    editor.classList.toggle('is-big', big);
    win.body.append(h('div', { class: 'notes' }, h('aside', { class: 'notes__side' }, list), h('div', { class: 'notes__pane' }, meta, editor, empty)));

    const allNotes = () => {
      const q = search.value.trim().toLowerCase();
      const docs = fs.find('', { kind: 'text' }).filter((i) => i.path.startsWith('/Documents') || i.path.startsWith('/Bureau') || extra.has(i.path));
      return docs
        .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.node.content || '').toLowerCase().includes(q))
        .sort((a, b) => b.node.mtime - a.node.mtime);
    };

    function renderList() {
      const notes = allNotes();
      list.replaceChildren();
      let lastGroup = '';
      notes.forEach((n) => {
        const group = groupOf(n.node.mtime);
        if (group !== lastGroup) { lastGroup = group; list.append(h('div', { class: 'notes__group' }, group)); }
        const text = (n.node.content || '').split('\n').map((l) => l.trim()).filter(Boolean);
        list.append(h('button', {
          class: `notes__item${n.path === current ? ' is-active' : ''}`,
          onclick: () => select(n.path),
          oncontextmenu: (e) => {
            e.preventDefault();
            OS.menu.open([
              { label: 'Afficher dans Fichiers', action: () => OS.launch('files', { path: fs.parent(n.path) }) },
              { sep: true },
              { label: 'Placer dans la corbeille', action: () => { if (n.path === current) current = null; OS.trashItems([n.path]); } },
            ], { x: e.clientX, y: e.clientY });
          },
        },
        h('strong', {}, fs.stem(n.name)),
        h('span', {}, h('em', {}, OS.fmtDate(n.node.mtime, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })), ' ', text[1] || text[0] || 'Pas de texte')));
      });
      if (!notes.length) list.append(h('p', { class: 'notes__none' }, search.value ? 'Aucun résultat' : 'Aucune note'));
    }

    const groupOf = (ts) => {
      const d = new Date(ts);
      const today = new Date();
      const diff = (new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000;
      if (diff <= 0) return 'Aujourd\'hui';
      if (diff === 1) return 'Hier';
      if (diff < 7) return '7 derniers jours';
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    };

    function renderEditor() {
      const node = current && fs.get(current);
      const has = !!node;
      editor.hidden = !has;
      meta.hidden = !has;
      empty.hidden = has;
      delBtn.disabled = !has;
      if (!has) { win.setTitle('Notes'); return; }
      if (document.activeElement !== editor || editor.value !== node.content) {
        if (editor.value !== (node.content || '')) editor.value = node.content || '';
      }
      win.setTitle(fs.stem(fs.base(current)));
      updateMeta('Enregistré');
    }

    const updateMeta = (state) => {
      const words = (editor.value.match(/\S+/g) || []).length;
      const node = current && fs.get(current);
      meta.textContent = `${node ? OS.fmtDate(node.mtime, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} · ${words} mot${words > 1 ? 's' : ''} · ${state}`;
    };

    function select(path) {
      current = path;
      if (!path.startsWith('/Documents') && !path.startsWith('/Bureau')) extra.add(path);
      renderList();
      renderEditor();
      editor.focus();
    }

    function newNote() {
      const dir = '/Documents';
      const p = fs.writeFile(fs.join(dir, fs.uniqueName(dir, 'Nouvelle note.txt')), '');
      select(p);
    }

    function deleteNote() {
      if (!current) return;
      const p = current;
      current = null;
      OS.trashItems([p]);
      const next = allNotes()[0];
      if (next) select(next.path); else { renderList(); renderEditor(); }
    }

    const save = OS.debounce(() => {
      if (!current || !fs.get(current)) return;
      fs.writeFile(current, editor.value);
      updateMeta('Enregistré');
    }, 400);
    editor.addEventListener('input', () => { updateMeta('Modification…'); save(); });
    editor.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); }
    });
    search.addEventListener('input', renderList);

    const unsub = fs.on('change', OS.debounce(() => {
      if (current && !fs.get(current)) current = null;
      renderList();
      if (document.activeElement !== editor) renderEditor();
    }, 60));
    win.cleanup.push(unsub);
    win.openFile = (path) => select(path);

    const first = args.path && fs.get(args.path) ? args.path : allNotes()[0]?.path;
    if (first) select(first); else { renderList(); renderEditor(); }
    return win;
  }

  OS.registerApp({
    id: 'notes',
    name: 'Notes',
    single: true,
    keywords: ['bloc-notes', 'texte', 'editeur'],
    about: 'Prenez des notes, elles sont enregistrées automatiquement dans Documents.',
    icon: OS.icons.notes,
    launch,
    handle(win, args) { if (args.path) win.openFile(args.path); },
  });
})();
