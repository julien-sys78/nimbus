/* =========================================================
   Calendrier — vue mensuelle et évènements
   ========================================================= */
(() => {
  const { h, sym } = OS;
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#ff453a', '#a259ff'];

  const loadEvents = () => {
    const saved = OS.store.get('events', null);
    if (saved) return saved;
    const t = new Date();
    const seed = {
      [key(t)]: [{ time: '10:00', title: 'Présentation de la démo', color: 0 }, { time: '14:30', title: 'Café avec l\'équipe', color: 2 }],
      [key(addDays(t, 2))]: [{ time: '09:30', title: 'Atelier design', color: 4 }],
      [key(addDays(t, 5))]: [{ time: '19:00', title: 'Concert', color: 3 }],
      [key(addDays(t, -3))]: [{ time: '11:00', title: 'Point projet', color: 1 }],
      [key(addDays(t, 9))]: [{ time: '', title: 'Journée off', color: 2 }],
    };
    OS.store.set('events', seed);
    return seed;
  };

  function launch() {
    const win = OS.wm.open({ app: 'calendar', title: 'Calendrier', width: 820, height: 540, minW: 560, minH: 380 });
    const events = loadEvents();
    const today = new Date();
    let view = new Date(today.getFullYear(), today.getMonth(), 1);
    let selected = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const monthLabel = h('span', { class: 'tb-title cal__month' });
    win.toolbar.append(
      monthLabel,
      h('div', { class: 'tb-spacer' }),
      h('div', { class: 'tb-group' },
        h('button', { class: 'tb-btn', 'aria-label': 'Mois précédent', html: sym.back, onclick: () => shift(-1) }),
        h('button', { class: 'tb-btn', onclick: goToday }, 'Aujourd\'hui'),
        h('button', { class: 'tb-btn', 'aria-label': 'Mois suivant', html: sym.fwd, onclick: () => shift(1) })),
    );
    win.titleEl.hidden = true;

    const grid = h('div', { class: 'cal__grid' });
    const side = h('aside', { class: 'cal__side' });
    win.body.append(h('div', { class: 'cal' }, h('div', { class: 'cal__main' },
      h('div', { class: 'cal__dows' }, ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((d) => h('span', {}, d))),
      grid), side));

    function shift(n) { view = new Date(view.getFullYear(), view.getMonth() + n, 1); render(); }
    function goToday() { view = new Date(today.getFullYear(), today.getMonth(), 1); selected = new Date(today.getFullYear(), today.getMonth(), today.getDate()); render(); }
    const save = () => OS.store.set('events', events);

    function render() {
      const label = view.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      monthLabel.innerHTML = `<strong>${label.split(' ')[0]}</strong> ${label.split(' ')[1]}`;
      grid.replaceChildren();
      const start = addDays(view, -((view.getDay() + 6) % 7));
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const k = key(d);
        const evs = events[k] || [];
        const cell = h('button', {
          class: ['cal__day', d.getMonth() !== view.getMonth() && 'is-out', key(d) === key(today) && 'is-today', key(d) === key(selected) && 'is-sel'].filter(Boolean).join(' '),
          onclick: () => { selected = d; if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1); render(); },
          ondblclick: () => setTimeout(() => side.querySelector('.cal__new input[name="title"]')?.focus(), 0),
        },
        h('span', { class: 'cal__num' }, d.getDate() === 1 ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : String(d.getDate())),
        evs.slice(0, 3).map((e) => h('span', { class: 'cal__ev', style: { '--c': COLORS[e.color % COLORS.length] } }, e.time ? `${e.time} ` : '', e.title)),
        evs.length > 3 ? h('span', { class: 'cal__more' }, `+${evs.length - 3}`) : null);
        grid.append(cell);
      }
      renderSide();
    }

    function renderSide() {
      const k = key(selected);
      const evs = (events[k] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const title = h('input', { class: 'field', name: 'title', placeholder: 'Nouvel évènement', required: true });
      const time = h('input', { class: 'field', name: 'time', type: 'time', style: { width: '96px' } });
      let color = 0;
      const swatches = h('div', { class: 'cal__swatches' }, COLORS.map((c, i) => h('button', {
        type: 'button', class: `cal__sw${i === 0 ? ' is-on' : ''}`, style: { background: c }, 'aria-label': `Couleur ${i + 1}`,
        onclick: (e) => { color = i; swatches.querySelectorAll('.cal__sw').forEach((s) => s.classList.remove('is-on')); e.currentTarget.classList.add('is-on'); },
      })));
      const form = h('form', {
        class: 'cal__new',
        onsubmit: (e) => {
          e.preventDefault();
          if (!title.value.trim()) return;
          (events[k] ||= []).push({ time: time.value, title: title.value.trim(), color });
          save();
          render();
        },
      }, title, h('div', { class: 'cal__newrow' }, time, swatches), h('button', { class: 'btn btn--primary', type: 'submit' }, 'Ajouter'));

      side.replaceChildren(
        h('div', { class: 'cal__sidehead' },
          h('span', { class: 'cal__bigday' }, String(selected.getDate())),
          h('div', {}, h('strong', {}, selected.toLocaleDateString('fr-FR', { weekday: 'long' })), h('span', {}, selected.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })))),
        h('div', { class: 'cal__list' }, evs.length ? evs.map((e) => h('div', { class: 'cal__item', style: { '--c': COLORS[e.color % COLORS.length] } },
          h('div', {}, h('strong', {}, e.title), h('span', {}, e.time || 'Toute la journée')),
          h('button', {
            class: 'cal__del', 'aria-label': 'Supprimer', html: '×',
            onclick: () => { events[k] = events[k].filter((x) => x !== e); if (!events[k].length) delete events[k]; save(); render(); },
          }))) : h('p', { class: 'cal__none' }, 'Aucun évènement')),
        form,
      );
    }

    render();
    return win;
  }

  OS.registerApp({
    id: 'calendar',
    name: 'Calendrier',
    single: true,
    keywords: ['agenda', 'date', 'evenement'],
    about: 'Organisez vos journées. Les évènements sont enregistrés dans ce navigateur.',
    icon: OS.icons.calendar,
    launch,
  });
})();
