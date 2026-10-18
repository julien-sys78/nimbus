/* =========================================================
   Réglages — apparence, fond d'écran, Dock, général
   ========================================================= */
(() => {
  const { h, sym } = OS;

  const SECTIONS = [
    { id: 'appearance', label: 'Apparence', color: '#1d1d1f', icon: sym.moon },
    { id: 'wallpaper', label: 'Fond d\'écran', color: '#32ade6', icon: sym.photo },
    { id: 'dock', label: 'Bureau et Dock', color: '#5e5ce6', icon: sym.desktop },
    { id: 'sound', label: 'Son et luminosité', color: '#ff375f', icon: sym.volume },
    { id: 'general', label: 'Général', color: '#8e8e93', icon: OS.sym.toggles },
  ];

  function launch(args = {}) {
    const win = OS.wm.open({ app: 'settings', title: 'Réglages', width: 720, height: 500, minW: 520, minH: 340 });
    let section = args.section || 'appearance';

    const nav = h('aside', { class: 'set__side' });
    const pane = h('div', { class: 'set__pane' });
    win.body.append(h('div', { class: 'set' }, nav, pane));

    const row = (label, control, hint) => h('div', { class: 'set__row' },
      h('div', { class: 'set__rlabel' }, h('span', {}, label), hint ? h('small', {}, hint) : null), control);
    const toggle = (on, onChange) => h('button', {
      class: `switch${on ? ' is-on' : ''}`, role: 'switch', 'aria-checked': String(on),
      onclick: (e) => { const v = !e.currentTarget.classList.contains('is-on'); onChange(v); },
    });
    const group = (...rows) => h('div', { class: 'set__group' }, ...rows);

    const PANES = {
      appearance: () => [
        h('div', { class: 'set__themes' }, ['light', 'dark', 'auto'].map((t) => h('button', {
          class: `set__theme set__theme--${t}${OS.settings.theme === t ? ' is-on' : ''}`,
          onclick: () => OS.setSetting('theme', t),
        }, h('span', { class: 'set__themeprev' }), h('span', {}, { light: 'Clair', dark: 'Sombre', auto: 'Automatique' }[t])))),
        group(
          row('Couleur d\'accentuation', h('div', { class: 'set__accents' }, Object.entries(OS.ACCENTS).map(([k, c]) => h('button', {
            class: `set__accent${OS.settings.accent === k ? ' is-on' : ''}`,
            style: { background: c },
            'aria-label': k,
            onclick: () => OS.setSetting('accent', k),
          })))),
        ),
      ],
      wallpaper: () => [
        h('div', { class: 'set__wpcurrent', style: { background: OS.wallpaperCSS(OS.settings.wallpaper) } },
          h('span', {}, (OS.WALLPAPERS.find((w) => w.id === OS.settings.wallpaper) || OS.WALLPAPERS[0]).name)),
        h('h3', { class: 'set__h3' }, 'Dégradés'),
        h('div', { class: 'set__wps' }, OS.WALLPAPERS.filter((w) => !w.photo).map(wpButton)),
        h('h3', { class: 'set__h3' }, 'Photos'),
        h('div', { class: 'set__wps' }, OS.WALLPAPERS.filter((w) => w.photo).map(wpButton)),
        h('p', { class: 'set__note' }, 'Astuce : clic droit sur une image dans Fichiers ou Photos › « Utiliser comme fond d\'écran ».'),
      ],
      dock: () => [
        group(
          row('Taille du Dock', h('input', { type: 'range', min: '38', max: '72', value: String(OS.settings.dockSize), oninput: (e) => OS.setSetting('dockSize', +e.target.value) })),
          row('Agrandissement', toggle(OS.settings.magnify, (v) => OS.setSetting('magnify', v)), 'Les icônes grossissent au survol'),
        ),
        group(
          row('Icônes du bureau', h('button', { class: 'btn', onclick: () => OS.setSetting('iconPos', {}) }, 'Ranger')),
        ),
      ],
      sound: () => [
        group(
          row('Volume', h('input', { type: 'range', min: '0', max: '100', value: String(OS.settings.volume), oninput: (e) => OS.setSetting('volume', +e.target.value) })),
          row('Luminosité', h('input', { type: 'range', min: '25', max: '100', value: String(OS.settings.brightness), oninput: (e) => OS.setSetting('brightness', +e.target.value) })),
        ),
      ],
      general: () => [
        h('div', { class: 'set__hero' },
          h('div', { class: 'about__logo', html: OS.icons.logo() }),
          h('div', {}, h('strong', {}, 'Nimbus'), h('span', {}, 'Version 1.0 · édition démo'))),
        group(
          row('Nom de l\'appareil', h('span', { class: 'set__val' }, 'Nimbus de l\'invité')),
          row('Langue', h('span', { class: 'set__val' }, 'Français')),
          row('Stockage utilisé', h('span', { class: 'set__val' }, OS.fmtSize(OS.store.size()))),
        ),
        group(
          row('Mentions légales', h('button', { class: 'set__link', onclick: () => OS.openPage('mentions-legales.html') }, 'Ouvrir')),
          row('Politique de confidentialité', h('button', { class: 'set__link', onclick: () => OS.openPage('confidentialite.html') }, 'Ouvrir'), 'Aucun cookie, données stockées uniquement sur cet appareil'),
          row('Crédits', h('button', { class: 'set__link', onclick: () => OS.openPage('credits.html') }, 'Ouvrir')),
        ),
        group(
          row('Réinitialiser la démo', h('button', { class: 'btn btn--danger', style: { color: '#fff' }, onclick: reset }, 'Réinitialiser…'), 'Restaure les fichiers, réglages et messages d\'origine'),
        ),
      ],
    };

    function wpButton(w) {
      return h('button', {
        class: `set__wp${OS.settings.wallpaper === w.id ? ' is-on' : ''}`,
        onclick: () => OS.setSetting('wallpaper', w.id),
      }, h('span', { class: 'set__wpimg', style: { background: OS.wallpaperCSS(w.id, true) } }), h('span', {}, w.name));
    }

    async function reset() {
      const ok = await OS.dialog({
        title: 'Réinitialiser Nimbus ?',
        message: 'Tous vos fichiers, notes, messages et réglages seront remplacés par ceux d\'origine.',
        buttons: [{ label: 'Annuler', value: false }, { label: 'Réinitialiser', value: true, primary: true, danger: true }],
      });
      if (!ok) return;
      OS.store.clear();
      location.reload();
    }

    function render() {
      nav.replaceChildren(h('div', { class: 'set__user' },
        h('div', { class: 'lock__avatar set__avatar' }, 'I'),
        h('div', {}, h('strong', {}, 'Invité'), h('span', {}, 'Compte local'))));
      SECTIONS.forEach((s) => nav.append(h('button', {
        class: `set__nav${s.id === section ? ' is-active' : ''}`,
        onclick: () => { section = s.id; render(); },
      }, h('span', { class: 'set__navicon', style: { background: s.color }, html: s.icon }), s.label)));
      const s = SECTIONS.find((x) => x.id === section);
      win.setTitle(s.label);
      pane.replaceChildren(h('h2', { class: 'set__title' }, s.label), ...PANES[section]());
    }

    const unsub = OS.on('settings', (k) => {
      if (['volume', 'brightness', 'dockSize'].includes(k)) return; // ne pas casser le glisser des curseurs
      render();
    });
    win.cleanup.push(unsub);
    win.show = (sec) => { section = sec; render(); };
    render();
    return win;
  }

  OS.registerApp({
    id: 'settings',
    name: 'Réglages',
    single: true,
    keywords: ['preferences', 'paramètres', 'fond', 'theme', 'sombre'],
    about: 'Personnalisez l\'apparence, le fond d\'écran et le Dock.',
    icon: OS.icons.settings,
    launch,
    handle(win, args) { if (args.section) win.show(args.section); },
  });
})();
