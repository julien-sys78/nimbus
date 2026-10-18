/* =========================================================
   Mail — messagerie de démonstration (envoi simulé)
   ========================================================= */
(() => {
  const { h, sym } = OS;
  const ME = 'invite@nimbus.local';

  const seed = () => {
    const t = Date.now();
    const H = 3600000;
    return {
      inbox: [
        { id: 'm1', from: 'bonjour@nimbus.local', fromName: 'Équipe Nimbus', to: ME, date: t - 0.4 * H, read: false, subject: 'Bienvenue sur Nimbus 👋',
          body: 'Bonjour,\n\nMerci d\'essayer Nimbus ! Cette messagerie est une démo : vous pouvez écrire un message avec le bouton « Nouveau message », il arrivera dans la boîte « Envoyés » et vous recevrez une réponse automatique quelques secondes plus tard.\n\nQuelques idées pour commencer :\n• Ouvrez le Terminal et tapez « sysinfo ».\n• Changez de fond d\'écran dans Réglages.\n• Lancez la playlist dans Musique.\n\nBonne découverte,\nL\'équipe Nimbus' },
        { id: 'm2', from: 'camille@exemple.fr', fromName: 'Camille Martin', to: ME, date: t - 5 * H, read: false, subject: 'Photos du week-end',
          body: 'Salut !\n\nJ\'ai mis les photos de la rando dans le dossier Images. La vue sur le lac émeraude est incroyable, tu devrais l\'utiliser comme fond d\'écran 😄\n\nÀ bientôt,\nCamille' },
        { id: 'm3', from: 'agenda@nimbus.local', fromName: 'Calendrier', to: ME, date: t - 26 * H, read: true, subject: 'Rappel : présentation de la démo aujourd\'hui à 10:00',
          body: 'Ceci est un rappel automatique pour l\'évènement « Présentation de la démo ».\n\nOuvrez l\'application Calendrier pour voir les détails.' },
        { id: 'm4', from: 'studio@exemple.fr', fromName: 'Studio Lumen', to: ME, date: t - 72 * H, read: true, subject: 'Maquettes v2',
          body: 'Bonjour,\n\nVoici la deuxième version des maquettes. Nous avons simplifié la navigation et revu les couleurs selon vos retours.\n\nDites-nous ce que vous en pensez.\n\nCordialement,\nLe Studio' },
      ],
      sent: [],
      trash: [],
    };
  };

  let data = OS.store.get('mail', null) || seed();
  const bus = OS.emitter();
  const save = () => { OS.store.set('mail', data); bus.emit('change'); updateBadge(); };
  const updateBadge = () => OS.setBadge?.('mail', data.inbox.filter((m) => !m.read).length);

  const BOXES = [
    { id: 'inbox', label: 'Réception', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 13l2.5-7h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/></svg>' },
    { id: 'sent', label: 'Envoyés', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4Z"/></svg>' },
    { id: 'trash', label: 'Corbeille', icon: sym.trash },
  ];

  const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarColor = (s) => `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 55%)`;
  const shortDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if ((today - d) < 6 * 86400000) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  /* ---------- Fenêtre de rédaction ---------- */
  function compose(prefill = {}) {
    const win = OS.wm.open({ app: 'mail', title: 'Nouveau message', width: 520, height: 440, minW: 360, minH: 300 });
    const to = h('input', { class: 'mail__field', type: 'email', value: prefill.to || '', placeholder: 'destinataire@exemple.fr', 'aria-label': 'À' });
    const subject = h('input', { class: 'mail__field', value: prefill.subject || '', placeholder: 'Objet', 'aria-label': 'Objet' });
    const body = h('textarea', { class: 'mail__compose', placeholder: 'Votre message…', 'aria-label': 'Message' });
    body.value = prefill.body || '';
    const send = h('button', { class: 'btn btn--primary', onclick: doSend }, 'Envoyer');
    win.toolbar.append(h('div', { class: 'tb-spacer' }), send);
    win.body.append(h('div', { class: 'mail__form' },
      h('label', { class: 'mail__row' }, h('span', {}, 'À :'), to),
      h('label', { class: 'mail__row' }, h('span', {}, 'Objet :'), subject),
      body));
    win.beforeClose = () => {
      if (win.sent || (!body.value.trim() && !subject.value.trim())) return true;
      OS.dialog({
        title: 'Supprimer ce brouillon ?', message: 'Le message n\'a pas été envoyé.',
        buttons: [{ label: 'Annuler', value: false }, { label: 'Supprimer', value: true, primary: true, danger: true }],
      }).then((ok) => { if (ok) { win.sent = true; win.close(); } });
      return false;
    };

    function doSend() {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.value.trim())) {
        to.classList.add('is-error');
        to.focus();
        OS.notify({ title: 'Adresse invalide', body: 'Saisissez une adresse e-mail valide.', app: 'mail' });
        return;
      }
      const msg = { id: 'm' + Date.now(), from: ME, fromName: 'Moi', to: to.value.trim(), date: Date.now(), read: true, subject: subject.value.trim() || '(Sans objet)', body: body.value };
      data.sent.unshift(msg);
      save();
      win.sent = true;
      win.close();
      OS.notify({ title: 'Message envoyé', body: `À ${msg.to}`, app: 'mail' });
      setTimeout(() => {
        const reply = {
          id: 'm' + Date.now(), from: msg.to, fromName: msg.to.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          to: ME, date: Date.now(), read: false, subject: 'Re: ' + msg.subject,
          body: `Bonjour,\n\nMerci pour votre message, il a bien été reçu.\n(Ceci est une réponse automatique de démonstration.)\n\n> ${msg.body.split('\n').join('\n> ')}`,
        };
        data.inbox.unshift(reply);
        save();
        OS.notify({ title: reply.fromName, body: reply.subject, app: 'mail', onClick: () => OS.launch('mail', { open: reply.id }) });
      }, 4500);
    }
    to.addEventListener('input', () => to.classList.remove('is-error'));
    setTimeout(() => (prefill.to ? body : to).focus(), 60);
    return win;
  }

  /* ---------- Fenêtre principale ---------- */
  function launch(args = {}) {
    const win = OS.wm.open({ app: 'mail', title: 'Mail', width: 940, height: 560, minW: 600, minH: 340 });
    let box = 'inbox';
    let current = null;

    const delBtn = h('button', { class: 'tb-btn', 'aria-label': 'Supprimer', title: 'Supprimer', html: sym.trash, onclick: () => remove() });
    const replyBtn = h('button', { class: 'tb-btn', 'aria-label': 'Répondre', title: 'Répondre', html: sym.reply, onclick: () => reply() });
    const newBtn = h('button', { class: 'tb-btn', 'aria-label': 'Nouveau message', title: 'Nouveau message', html: sym.compose, onclick: () => compose() });
    const search = h('input', { class: 'field field--search', placeholder: 'Rechercher', style: { width: '170px' }, 'aria-label': 'Rechercher dans les messages' });
    const heading = h('span', { class: 'tb-title' });
    win.toolbar.append(heading, h('div', { class: 'tb-spacer' }), newBtn, replyBtn, delBtn, search);
    win.titleEl.hidden = true;

    const side = h('aside', { class: 'mail__side' });
    const list = h('div', { class: 'mail__list' });
    const reader = h('div', { class: 'mail__reader' });
    win.body.append(h('div', { class: 'mail' }, side, list, reader));
    search.addEventListener('input', renderList);

    function renderSide() {
      side.replaceChildren(h('div', { class: 'side__header' }, 'Boîtes'), ...BOXES.map((b) => {
        const unread = data[b.id].filter((m) => !m.read).length;
        return h('button', { class: `side__item${b.id === box ? ' is-active' : ''}`, onclick: () => { box = b.id; current = null; render(); } },
          h('span', { html: b.icon }), b.label, unread ? h('span', { class: 'side__count' }, String(unread)) : null);
      }));
    }

    function renderList() {
      const q = search.value.trim().toLowerCase();
      const msgs = data[box].filter((m) => !q || `${m.fromName} ${m.subject} ${m.body}`.toLowerCase().includes(q));
      const b = BOXES.find((x) => x.id === box);
      heading.innerHTML = `${b.label} <small>${data[box].length} message${data[box].length > 1 ? 's' : ''}</small>`;
      win.setTitle(`${b.label} — Mail`);
      list.replaceChildren(...msgs.map((m) => h('button', {
        class: `mail__item${m.id === current ? ' is-active' : ''}${m.read ? '' : ' is-unread'}`,
        onclick: () => open(m.id),
      },
      h('div', { class: 'mail__itop' }, h('strong', {}, box === 'sent' ? `À : ${m.to}` : m.fromName), h('span', {}, shortDate(m.date))),
      h('div', { class: 'mail__isub' }, m.subject),
      h('div', { class: 'mail__iprev' }, m.body.replace(/\s+/g, ' ').slice(0, 110)))));
      if (!msgs.length) list.append(h('p', { class: 'mail__none' }, q ? 'Aucun résultat' : 'Aucun message'));
    }

    function renderReader() {
      const m = data[box].find((x) => x.id === current);
      delBtn.disabled = !m;
      replyBtn.disabled = !m || box === 'sent';
      if (!m) { reader.replaceChildren(h('div', { class: 'mail__empty' }, 'Aucun message sélectionné')); return; }
      const who = box === 'sent' ? m.to : m.fromName;
      reader.replaceChildren(h('div', { class: 'mail__head' },
        h('span', { class: 'mail__avatar', style: { background: avatarColor(who) } }, initials(who)),
        h('div', { class: 'mail__hinfo' },
          h('strong', {}, box === 'sent' ? 'Moi' : m.fromName),
          h('span', {}, `De : ${m.from}`),
          h('span', {}, `À : ${m.to}`)),
        h('span', { class: 'mail__hdate' }, OS.fmtDate(m.date))),
      h('h2', { class: 'mail__subject' }, m.subject),
      h('div', { class: 'mail__body' }, m.body));
    }

    function render() { renderSide(); renderList(); renderReader(); }

    function open(id) {
      current = id;
      const m = data[box].find((x) => x.id === id);
      if (m && !m.read) { m.read = true; save(); } else render();
    }

    function remove() {
      const i = data[box].findIndex((x) => x.id === current);
      if (i < 0) return;
      const [m] = data[box].splice(i, 1);
      if (box !== 'trash') data.trash.unshift(m);
      current = data[box][i]?.id || data[box][i - 1]?.id || null;
      save();
    }

    function reply() {
      const m = data[box].find((x) => x.id === current);
      if (!m) return;
      compose({ to: m.from, subject: m.subject.startsWith('Re:') ? m.subject : 'Re: ' + m.subject, body: `\n\nLe ${OS.fmtDate(m.date)}, ${m.fromName} a écrit :\n> ${m.body.split('\n').join('\n> ')}` });
    }

    list.addEventListener('keydown', (e) => {
      const msgs = data[box];
      const i = msgs.findIndex((x) => x.id === current);
      if (e.key === 'ArrowDown' && msgs[i + 1]) { e.preventDefault(); open(msgs[i + 1].id); }
      if (e.key === 'ArrowUp' && msgs[i - 1]) { e.preventDefault(); open(msgs[i - 1].id); }
      if (e.key === 'Delete' || e.key === 'Backspace') remove();
    });

    const unsub = bus.on('change', render);
    win.cleanup.push(unsub);
    win.openMessage = (id) => { box = 'inbox'; open(id); };
    current = args.open || data.inbox[0]?.id || null;
    if (current) open(current); else render();
    return win;
  }

  OS.registerApp({
    id: 'mail',
    name: 'Mail',
    single: true,
    keywords: ['email', 'courriel', 'message', 'contact'],
    about: 'Une messagerie de démonstration : l\'envoi est simulé, rien ne quitte votre navigateur.',
    icon: OS.icons.mail,
    launch,
    handle(win, args) { if (args.open) win.openMessage(args.open); },
    compose,
  });

  OS.on('ready', updateBadge);
})();
