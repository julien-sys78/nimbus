/* =========================================================
   Navigateur — pages internes + sites intégrés (iframe)
   ========================================================= */
(() => {
  const { h, sym, esc } = OS;
  const HOME = 'nimbus://accueil';

  const FAVORITES = [
    { title: 'Horizon', sub: 'Site vitrine (démo)', url: 'https://julien-sys78.github.io/horizon/', color: 'linear-gradient(135deg,#ffd29d,#ff9d6c 50%,#c86dd7)', letter: 'H' },
    { title: 'À propos', sub: 'Découvrir Nimbus', url: 'nimbus://apropos', color: 'linear-gradient(135deg,#6d5dfc,#ff7a9c)', letter: 'N' },
    { title: 'Guide', sub: 'Toutes les applis', url: 'nimbus://guide', color: 'linear-gradient(135deg,#4ee6c8,#0a7cff)', letter: 'G' },
    { title: 'Nouveautés', sub: 'Version 1.0', url: 'nimbus://nouveautes', color: 'linear-gradient(135deg,#ffd166,#ef476f)', letter: '★' },
  ];

  const PAGES = {
    accueil: () => {
      const hour = new Date().getHours();
      const hello = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
      return {
        title: 'Accueil',
        html: `<div class="web web--home">
          <h1>${hello}.</h1>
          <form class="web__search" data-search><input name="q" placeholder="Rechercher ou saisir une adresse" autocomplete="off"></form>
          <h2>Favoris</h2>
          <div class="web__favs">${FAVORITES.map((f) => `<a class="web__fav" data-href="${esc(f.url)}"><span style="background:${f.color}">${f.letter}</span><strong>${esc(f.title)}</strong><small>${esc(f.sub)}</small></a>`).join('')}</div>
          <h2>Rapport de confidentialité</h2>
          <div class="web__card"><strong>0 traqueur</strong> bloqué ces 7 derniers jours. Nimbus ne collecte aucune donnée : tout reste dans votre navigateur.</div>
        </div>`,
      };
    },
    apropos: () => ({
      title: 'À propos de Nimbus',
      html: `<article class="web web--article">
        <p class="web__kicker">Nimbus · Présentation</p>
        <h1>Un système d'exploitation, dans une page web.</h1>
        <p class="web__lead">Nimbus reproduit l'expérience d'un ordinateur de bureau : fenêtres, Dock, fichiers, applications. Le tout en HTML, CSS et JavaScript, sans installation.</p>
        <img src="${OS.img('1519681393784-d120267933ba', 1400)}" alt="Ciel étoilé au-dessus de montagnes">
        <h2>Ce qui fonctionne vraiment</h2>
        <ul>
          <li>Un système de fichiers complet : créer, renommer, déplacer, glisser-déposer, corbeille.</li>
          <li>Un terminal qui manipule ces mêmes fichiers : <code>ls</code>, <code>cd</code>, <code>echo</code>, <code>mkdir</code>, <code>open</code>…</li>
          <li>Des notes enregistrées automatiquement, une messagerie, un calendrier.</li>
          <li>Un lecteur de musique dont les morceaux sont composés en direct.</li>
        </ul>
        <h2>Vos données</h2>
        <p>Tout est stocké localement dans votre navigateur. Rien n'est envoyé sur un serveur. Pour repartir de zéro : Réglages › Général › Réinitialiser.</p>
        <p><a data-href="nimbus://guide">Voir le guide des applications →</a></p>
      </article>`,
    }),
    guide: () => ({
      title: 'Guide des applications',
      html: `<article class="web web--article">
        <p class="web__kicker">Guide</p>
        <h1>Les applications de Nimbus</h1>
        <div class="web__apps">${OS.DOCK_APPS.map((id) => {
          const a = OS.apps[id];
          return `<div class="web__app"><span class="web__appicon">${a.icon()}</span><div><strong>${esc(a.name)}</strong><p>${esc(a.about || '')}</p></div><button data-app="${id}">Ouvrir</button></div>`;
        }).join('')}</div>
      </article>`,
    }),
    nouveautes: () => ({
      title: 'Nouveautés de Nimbus 1.0',
      html: `<article class="web web--article">
        <p class="web__kicker">Notes de version</p>
        <h1>Nimbus 1.0</h1>
        <p class="web__lead">La première version publique de Nimbus.</p>
        <h2>Nouveau</h2>
        <ul>
          <li>Recherche universelle avec ⌘K : applis, fichiers et calculs.</li>
          <li>Centre de contrôle : mode sombre, luminosité, volume, lecture en cours.</li>
          <li>Glisser-déposer entre le bureau, Fichiers et la corbeille.</li>
          <li>Dix applications intégrées.</li>
        </ul>
        <h2>Améliorations</h2>
        <ul>
          <li>Fenêtres redimensionnables par tous les bords.</li>
          <li>Thème automatique selon les préférences de l'appareil.</li>
        </ul>
      </article>`,
    }),
    recherche: (q) => {
      const s = (q || '').toLowerCase();
      const pages = [
        { url: 'nimbus://apropos', title: 'À propos de Nimbus', text: 'système exploitation navigateur fichiers terminal données' },
        { url: 'nimbus://guide', title: 'Guide des applications', text: OS.DOCK_APPS.map((id) => OS.apps[id].name + ' ' + (OS.apps[id].about || '')).join(' ') },
        ...FAVORITES.filter((f) => f.url.startsWith('http')).map((f) => ({ url: f.url, title: f.title, text: f.sub })),
      ].filter((p) => (p.title + ' ' + p.text).toLowerCase().includes(s));
      const files = OS.fs.find(q || '').slice(0, 5);
      return {
        title: `${q} — Recherche`,
        html: `<div class="web web--article">
          <p class="web__kicker">Résultats pour « ${esc(q)} »</p>
          ${pages.length ? pages.map((p) => `<a class="web__result" data-href="${esc(p.url)}"><small>${esc(p.url)}</small><strong>${esc(p.title)}</strong></a>`).join('') : '<p>Aucune page ne correspond.</p>'}
          ${files.length ? `<h2>Dans vos fichiers</h2>${files.map((f) => `<a class="web__result" data-open="${esc(f.path)}"><small>${esc(f.path)}</small><strong>${esc(f.name)}</strong></a>`).join('')}` : ''}
        </div>`,
      };
    },
  };

  function normalize(input) {
    const v = input.trim();
    if (!v) return HOME;
    if (/^nimbus:\/\//i.test(v)) return v;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) && !v.includes(' ')) return 'https://' + v;
    return 'nimbus://recherche?q=' + encodeURIComponent(v);
  }

  function launch(args = {}) {
    const win = OS.wm.open({ app: 'browser', title: 'Navigateur', width: 940, height: 600, minW: 420, minH: 300 });
    let history = [];
    let hpos = -1;

    const back = h('button', { class: 'tb-btn', 'aria-label': 'Précédent', html: sym.back, onclick: () => go(history[--hpos], false) });
    const fwd = h('button', { class: 'tb-btn', 'aria-label': 'Suivant', html: sym.fwd, onclick: () => go(history[++hpos], false) });
    const reload = h('button', { class: 'tb-btn', 'aria-label': 'Actualiser', html: sym.reload, onclick: () => go(history[hpos], false) });
    const home = h('button', { class: 'tb-btn', 'aria-label': 'Accueil', html: sym.home, onclick: () => go(HOME) });
    const address = h('input', { class: 'field br__address', spellcheck: 'false', 'aria-label': 'Adresse', placeholder: 'Rechercher ou saisir une adresse' });
    const lock = h('span', { class: 'br__lock' });
    win.toolbar.append(h('div', { class: 'tb-group' }, back, fwd), reload, h('div', { class: 'br__addrwrap' }, lock, address), home);
    win.titleEl.hidden = true;

    const view = h('div', { class: 'br__view' });
    const progress = h('div', { class: 'br__progress' });
    win.body.append(progress, view);

    address.addEventListener('keydown', (e) => { if (e.key === 'Enter') { go(normalize(address.value)); address.blur(); } });
    address.addEventListener('focus', () => address.select());

    function loading() {
      progress.classList.remove('is-loading');
      void progress.offsetWidth;
      progress.classList.add('is-loading');
    }

    function go(url, push = true) {
      if (!url) return;
      if (push) { history = history.slice(0, hpos + 1); history.push(url); hpos = history.length - 1; }
      back.disabled = hpos <= 0;
      fwd.disabled = hpos >= history.length - 1;
      address.value = url === HOME ? '' : url;
      lock.textContent = url.startsWith('https://') ? '🔒' : '';
      loading();

      if (OS.wifi === false && url.startsWith('http')) {
        render('Pas de connexion', `<div class="web web--error"><h1>Vous n'êtes pas connecté à Internet.</h1><p>Le Wi-Fi est désactivé. Réactivez-le depuis la barre de menus.</p></div>`);
        return;
      }

      if (url.startsWith('nimbus://')) {
        const [name, query] = url.slice(9).split('?q=');
        const page = (PAGES[name] || (() => ({ title: 'Page introuvable', html: '<div class="web web--error"><h1>Page introuvable</h1><p>Cette adresse n\'existe pas sur Nimbus.</p></div>' })))(query ? decodeURIComponent(query) : '');
        render(page.title, page.html);
        return;
      }

      const frame = h('iframe', {
        class: 'br__frame', src: url, title: url,
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        referrerpolicy: 'no-referrer',
      });
      const note = h('div', { class: 'br__note' },
        h('span', {}, 'Certains sites refusent de s\'afficher dans une autre page.'),
        h('a', { href: url, target: '_blank', rel: 'noopener' }, 'Ouvrir dans un nouvel onglet ↗'));
      view.replaceChildren(note, frame);
      win.setTitle(new URL(url).hostname);
    }

    function render(title, html) {
      const page = h('div', { class: 'br__page', html });
      view.replaceChildren(page);
      win.setTitle(title);
      page.addEventListener('click', (e) => {
        const a = e.target.closest('[data-href]');
        const app = e.target.closest('[data-app]');
        const open = e.target.closest('[data-open]');
        if (a) { e.preventDefault(); go(a.dataset.href); }
        if (app) OS.launch(app.dataset.app);
        if (open) OS.openPath(open.dataset.open);
      });
      page.querySelector('[data-search]')?.addEventListener('submit', (e) => {
        e.preventDefault();
        go(normalize(e.target.q.value));
      });
    }

    const unsubWifi = OS.on('wifi', () => { if (history[hpos]?.startsWith('http')) go(history[hpos], false); });
    win.cleanup.push(unsubWifi);
    win.go = (u) => go(normalize(u));
    go(args.url ? normalize(args.url) : HOME);
    return win;
  }

  OS.registerApp({
    id: 'browser',
    name: 'Navigateur',
    keywords: ['web', 'internet', 'site'],
    about: 'Naviguez entre les pages de Nimbus et quelques sites qui acceptent l\'intégration.',
    icon: OS.icons.browser,
    launch,
  });
})();
