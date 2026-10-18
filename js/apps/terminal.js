/* =========================================================
   Terminal — shell minimal sur le système de fichiers virtuel
   ========================================================= */
(() => {
  const { h, fs, esc } = OS;
  const USER = 'invité';
  const HOST = 'nimbus';

  /* Découpe une ligne en arguments (gère les guillemets) */
  const tokenize = (line) => {
    const out = [];
    let cur = '';
    let quote = null;
    let has = false;
    for (const c of line) {
      if (quote) { if (c === quote) quote = null; else cur += c; continue; }
      if (c === '"' || c === "'") { quote = c; has = true; continue; }
      if (/\s/.test(c)) { if (cur || has) { out.push(cur); cur = ''; has = false; } continue; }
      if (c === '>') { if (cur || has) { out.push(cur); cur = ''; has = false; } out.push(out[out.length - 1] === '>' ? (out.pop(), '>>') : '>'); continue; }
      cur += c;
    }
    if (cur || has) out.push(cur);
    return out;
  };

  const LOGO = [
    '      .--.      ',
    '   .-(    ).    ',
    '  (___.__)__)   ',
    '                ',
  ];

  function launch(args = {}) {
    const win = OS.wm.open({ app: 'terminal', title: `${USER} — zsh`, width: 680, height: 420, minW: 360, minH: 200, className: 'win--terminal' });
    let cwd = args.cwd && fs.isDir(args.cwd) ? fs.norm(args.cwd) : '/';
    const history = OS.store.get('term-history', []);
    let hpos = history.length;

    const out = h('div', { class: 'term__out' });
    const promptEl = h('span', { class: 'term__prompt' });
    const input = h('input', { class: 'term__input', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Commande' });
    const line = h('div', { class: 'term__line' }, promptEl, input);
    const term = h('div', { class: 'term' }, out, line);
    win.body.append(term);

    const short = (p) => (p === '/' ? '~' : '~' + p);
    const renderPrompt = () => {
      promptEl.innerHTML = `<span class="t-green">${USER}@${HOST}</span> <span class="t-blue">${esc(short(cwd))}</span> % `;
      win.setTitle(`${USER} — ${short(cwd)} — zsh`);
    };
    const print = (html = '', cls = '') => { out.append(h('div', { class: 't-row ' + cls, html })); };
    const printText = (text, cls = '') => print(esc(text), cls);
    const scroll = () => { term.scrollTop = term.scrollHeight; };

    const colorName = (item) => {
      if (item.kind === 'folder') return `<span class="t-blue t-bold">${esc(item.name)}/</span>`;
      if (item.kind === 'app') return `<span class="t-green">${esc(item.name)}</span>`;
      if (item.kind === 'image') return `<span class="t-magenta">${esc(item.name)}</span>`;
      if (item.kind === 'audio') return `<span class="t-yellow">${esc(item.name)}</span>`;
      return esc(item.name);
    };

    const need = (a, n, usage) => { if (a.length < n) throw new Error(`usage : ${usage}`); };
    const path = (p) => fs.resolve(cwd, p);

    /* ---------- Commandes ---------- */
    const COMMANDS = {
      help: { d: 'Affiche cette aide', run: () => {
        print('<span class="t-bold">Commandes disponibles</span>');
        Object.entries(COMMANDS).forEach(([k, c]) => print(`  <span class="t-green">${k.padEnd(10)}</span>${esc(c.d)}`));
        print('');
        print('Astuces : <span class="t-yellow">Tab</span> complète, <span class="t-yellow">↑ ↓</span> parcourent l\'historique, <span class="t-yellow">echo texte > fichier.txt</span> écrit un fichier.');
      } },
      ls: { d: 'Liste un dossier (-l pour le détail)', run: (a) => {
        const long = a.includes('-l');
        const target = path(a.find((x) => !x.startsWith('-')) || '.');
        const node = fs.get(target);
        if (!node) throw new Error(`ls : ${a.find((x) => !x.startsWith('-'))} : aucun fichier ou dossier de ce nom`);
        if (node.type !== 'dir') { print(esc(fs.base(target))); return; }
        const items = fs.list(target);
        if (!items.length) return;
        if (long) {
          print(`total ${items.length}`);
          items.forEach((i) => print(`${i.kind === 'folder' ? 'd' : '-'}rw-r--r--  ${USER}  ${String(fs.size(i.node)).padStart(8)}  ${esc(i.node.mtime ? OS.fmtDate(i.node.mtime, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—').padEnd(16)}  ${colorName(i)}`));
        } else {
          print(items.map((i) => `<span class="t-cell">${colorName(i)}</span>`).join(''), 't-grid');
        }
      } },
      cd: { d: 'Change de dossier', run: (a) => {
        const target = path(a[0] || '~');
        if (!fs.get(target)) throw new Error(`cd : ${a[0]} : aucun dossier de ce nom`);
        if (!fs.isDir(target)) throw new Error(`cd : ${a[0]} : n'est pas un dossier`);
        cwd = target;
      } },
      pwd: { d: 'Affiche le dossier courant', run: () => printText(cwd) },
      cat: { d: 'Affiche le contenu d\'un fichier', run: (a, ctx) => {
        need(a, 1, 'cat fichier');
        return a.map((f) => {
          const n = fs.get(path(f));
          if (!n) throw new Error(`cat : ${f} : aucun fichier de ce nom`);
          if (n.type === 'dir') throw new Error(`cat : ${f} : est un dossier`);
          if (n.content == null) throw new Error(`cat : ${f} : fichier binaire (utilisez « open »)`);
          return n.content.replace(/\n$/, '');
        }).join('\n');
      } },
      echo: { d: 'Affiche du texte', run: (a) => a.join(' ') },
      touch: { d: 'Crée un fichier vide', run: (a) => { need(a, 1, 'touch fichier'); a.forEach((f) => { if (!fs.get(path(f))) fs.writeFile(path(f), ''); }); } },
      mkdir: { d: 'Crée un dossier', run: (a) => { need(a, 1, 'mkdir dossier'); a.filter((x) => x !== '-p').forEach((d) => fs.mkdir(path(d))); } },
      rm: { d: 'Place dans la corbeille (-f : définitif)', run: (a) => {
        const files = a.filter((x) => !x.startsWith('-'));
        need(files, 1, 'rm [-r] [-f] fichier');
        const permanent = a.some((x) => x.startsWith('-') && x.includes('f'));
        files.forEach((f) => {
          const p = path(f);
          const n = fs.get(p);
          if (!n) throw new Error(`rm : ${f} : aucun fichier de ce nom`);
          if (n.type === 'dir' && !a.some((x) => x.startsWith('-') && x.includes('r'))) throw new Error(`rm : ${f} : est un dossier (utilisez -r)`);
          fs.remove(p, { permanent });
        });
      } },
      mv: { d: 'Déplace ou renomme', run: (a) => {
        need(a, 2, 'mv source destination');
        const src = path(a[0]);
        const dst = path(a[1]);
        if (!fs.get(src)) throw new Error(`mv : ${a[0]} : introuvable`);
        if (fs.isDir(dst)) fs.move(src, dst, { unique: false });
        else if (fs.parent(dst) === fs.parent(src)) fs.rename(src, fs.base(dst));
        else { const moved = fs.move(src, fs.parent(dst), { unique: false }); fs.rename(moved, fs.base(dst)); }
      } },
      cp: { d: 'Copie un fichier ou dossier', run: (a) => {
        const files = a.filter((x) => !x.startsWith('-'));
        need(files, 2, 'cp source destination');
        const dst = path(files[1]);
        if (fs.isDir(dst)) fs.copy(path(files[0]), dst);
        else { const p = fs.copy(path(files[0]), fs.parent(dst)); fs.rename(p, fs.base(dst)); }
      } },
      open: { d: 'Ouvre un fichier, un dossier ou une app', run: (a) => {
        need(a, 1, 'open fichier | open -a App');
        if (a[0] === '-a') {
          const name = a.slice(1).join(' ').toLowerCase();
          const app = Object.values(OS.apps).find((x) => x.name.toLowerCase() === name || x.id === name);
          if (!app) throw new Error(`open : application introuvable : ${a.slice(1).join(' ')}`);
          OS.launch(app.id);
          return;
        }
        const p = path(a[0]);
        if (!fs.get(p)) throw new Error(`open : ${a[0]} : introuvable`);
        OS.openPath(p);
      } },
      tree: { d: 'Arborescence d\'un dossier', run: (a) => {
        const root = path(a[0] || '.');
        if (!fs.isDir(root)) throw new Error(`tree : ${a[0]} : n'est pas un dossier`);
        let dirs = 0;
        let files = 0;
        print(`<span class="t-blue t-bold">${esc(short(root))}</span>`);
        const walk = (p, prefix) => {
          const items = fs.list(p);
          items.forEach((it, i) => {
            const last = i === items.length - 1;
            print(`${prefix}${last ? '└── ' : '├── '}${colorName(it)}`);
            if (it.kind === 'folder') { dirs++; walk(it.path, prefix + (last ? '    ' : '│   ')); } else files++;
          });
        };
        walk(root, '');
        print(`\n${dirs} dossier(s), ${files} fichier(s)`);
      } },
      find: { d: 'Cherche des fichiers par nom', run: (a) => {
        need(a, 1, 'find nom');
        const res = fs.find(a.join(' '));
        if (!res.length) return 'Aucun résultat';
        res.forEach((r) => printText(short(r.path)));
      } },
      clear: { d: 'Efface l\'écran', run: () => { out.replaceChildren(); } },
      date: { d: 'Affiche la date et l\'heure', run: () => new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' }) },
      cal: { d: 'Affiche le calendrier du mois', run: () => {
        const d = new Date();
        const first = new Date(d.getFullYear(), d.getMonth(), 1);
        const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const title = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        print(`<span class="t-bold">${esc(title.padStart(Math.floor((20 + title.length) / 2)))}</span>`);
        print('lu ma me je ve sa di');
        let row = '   '.repeat((first.getDay() + 6) % 7);
        for (let i = 1; i <= days; i++) {
          const cell = String(i).padStart(2);
          row += i === d.getDate() ? `<span class="t-inv">${cell}</span> ` : cell + ' ';
          if ((first.getDay() + 6 + i) % 7 === 0) { print(row); row = ''; }
        }
        if (row) print(row);
      } },
      whoami: { d: 'Affiche l\'utilisateur', run: () => USER },
      uname: { d: 'Informations système', run: (a) => (a.includes('-a') ? `Nimbus ${HOST} 1.0.0 navigateur-web ${navigator.language}` : 'Nimbus') },
      sysinfo: { d: 'Résumé du système', run: () => {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'sombre' : 'clair';
        const info = [
          `<span class="t-green t-bold">${USER}@${HOST}</span>`,
          '─'.repeat(18),
          `<span class="t-blue">Système</span>   Nimbus 1.0 (démo)`,
          `<span class="t-blue">Shell</span>     zsh (simulé)`,
          `<span class="t-blue">Écran</span>     ${window.innerWidth} × ${window.innerHeight}`,
          `<span class="t-blue">Thème</span>     ${theme}`,
          `<span class="t-blue">Fenêtres</span>  ${OS.wm.list().length}`,
          `<span class="t-blue">Stockage</span>  ${esc(OS.fmtSize(OS.store.size()))}`,
          '',
          ['#ff5f57', '#febc2e', '#28c840', '#0a84ff', '#a259ff', '#ff4f9a'].map((c) => `<span style="color:${c}">███</span>`).join(''),
        ];
        const logo = [...LOGO, ...Array(Math.max(0, info.length - LOGO.length)).fill(' '.repeat(16))];
        info.forEach((l, i) => print(`<span class="t-magenta">${esc(logo[i] || ''.padEnd(16))}</span>  ${l}`));
      } },
      history: { d: 'Historique des commandes', run: () => history.forEach((c, i) => printText(`${String(i + 1).padStart(4)}  ${c}`)) },
      calc: { d: 'Calcule une expression', run: (a) => {
        const expr = a.join(' ');
        if (!/^[\d\s.,+\-*/()%^]+$/.test(expr)) throw new Error('calc : expression invalide');
        const v = Function(`"use strict"; return (${expr.replace(/,/g, '.').replace(/\^/g, '**')})`)();
        return String(Math.round(v * 1e10) / 1e10);
      } },
      theme: { d: 'theme clair | sombre | auto', run: (a) => {
        const map = { clair: 'light', sombre: 'dark', auto: 'auto', light: 'light', dark: 'dark' };
        if (!map[a[0]]) throw new Error('usage : theme clair | sombre | auto');
        OS.setSetting('theme', map[a[0]]);
        return `Thème : ${a[0]}`;
      } },
      wallpaper: { d: 'Passe au fond d\'écran suivant', run: () => { OS.nextWallpaper(); return `Fond d'écran : ${OS.WALLPAPERS.find((w) => w.id === OS.settings.wallpaper).name}`; } },
      notify: { d: 'Envoie une notification', run: (a) => { OS.notify({ title: 'Terminal', body: a.join(' ') || 'Bonjour !', app: 'terminal' }); } },
      say: { d: 'Lit un texte à voix haute', run: (a) => {
        if (!('speechSynthesis' in window)) throw new Error('say : synthèse vocale indisponible');
        const u = new SpeechSynthesisUtterance(a.join(' ') || 'Bonjour');
        u.lang = 'fr-FR';
        speechSynthesis.speak(u);
      } },
      matrix: { d: 'Pluie de caractères (touche pour quitter)', run: () => matrix() },
      exit: { d: 'Ferme le terminal', run: () => { setTimeout(() => win.close(), 50); } },
    };

    /* ---------- Exécution ---------- */
    function exec(raw) {
      const lineText = raw.trim();
      print(`${promptEl.innerHTML}${esc(raw)}`, 't-cmd');
      if (!lineText) return;
      if (history[history.length - 1] !== lineText) { history.push(lineText); if (history.length > 200) history.shift(); OS.store.set('term-history', history); }
      hpos = history.length;

      const tokens = tokenize(lineText);
      let redirect = null;
      const ri = tokens.findIndex((t) => t === '>' || t === '>>');
      if (ri >= 0) {
        if (!tokens[ri + 1]) { print('zsh : erreur de syntaxe près de « > »', 't-red'); return; }
        redirect = { append: tokens[ri] === '>>', file: tokens[ri + 1] };
        tokens.splice(ri, 2);
      }
      if (tokens.includes('|')) { print('zsh : les pipes « | » ne sont pas pris en charge dans cette démo', 't-red'); renderPrompt(); return; }
      const [cmd, ...a] = tokens;
      const c = COMMANDS[cmd];
      if (!c) {
        print(`zsh : commande introuvable : ${esc(cmd)}`, 't-red');
        if (cmd === 'sudo') print('Bien essayé 😉 Nimbus n\'a pas de mot de passe administrateur.');
        else print('Tapez <span class="t-green">help</span> pour la liste des commandes.');
        return;
      }
      try {
        const result = c.run(a);
        if (redirect) {
          fs.writeFile(path(redirect.file), (result ?? '') + '\n', { append: redirect.append });
        } else if (typeof result === 'string') {
          result.split('\n').forEach((l) => printText(l));
        }
      } catch (err) {
        print(esc(err.message), 't-red');
      }
      renderPrompt();
    }

    /* ---------- Complétion ---------- */
    function complete() {
      const value = input.value;
      const tokens = value.split(/\s+/);
      const last = tokens[tokens.length - 1];
      let candidates;
      if (tokens.length === 1) {
        candidates = Object.keys(COMMANDS).filter((k) => k.startsWith(last));
      } else {
        const slash = last.lastIndexOf('/');
        const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
        const namePart = slash >= 0 ? last.slice(slash + 1) : last;
        const items = fs.list(path(dirPart || '.')) || [];
        candidates = items.filter((i) => i.name.toLowerCase().startsWith(namePart.toLowerCase()))
          .map((i) => dirPart + (i.name.includes(' ') ? i.name.replace(/ /g, '\\ ') : i.name) + (i.kind === 'folder' ? '/' : ''));
      }
      if (candidates.length === 1) {
        tokens[tokens.length - 1] = candidates[0].replace(/\\ /g, ' ');
        const needsQuote = tokens.length > 1 && tokens[tokens.length - 1].includes(' ');
        if (needsQuote) tokens[tokens.length - 1] = `"${tokens[tokens.length - 1]}"`;
        input.value = tokens.join(' ') + (tokens.length === 1 ? ' ' : '');
      } else if (candidates.length > 1) {
        print(`${promptEl.innerHTML}${esc(value)}`, 't-cmd');
        print(candidates.map((c) => `<span class="t-cell">${esc(c.replace(/\\ /g, ' '))}</span>`).join(''), 't-grid');
        let prefix = candidates[0];
        candidates.forEach((c) => { while (!c.startsWith(prefix)) prefix = prefix.slice(0, -1); });
        if (prefix.length > last.length && !prefix.includes('\\')) { tokens[tokens.length - 1] = prefix; input.value = tokens.join(' '); }
        scroll();
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { exec(input.value); input.value = ''; scroll(); }
      else if (e.key === 'Tab') { e.preventDefault(); complete(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hpos > 0) { input.value = history[--hpos]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hpos < history.length - 1) input.value = history[++hpos]; else { hpos = history.length; input.value = ''; } }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.replaceChildren(); }
      else if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); print(`${promptEl.innerHTML}${esc(input.value)}^C`, 't-cmd'); input.value = ''; scroll(); }
    });
    term.addEventListener('pointerup', () => { if (!window.getSelection().toString()) input.focus(); });
    win.onFocus = () => setTimeout(() => input.focus(), 0);

    /* ---------- Easter egg : matrix ---------- */
    function matrix() {
      const canvas = h('canvas', { class: 'term__matrix' });
      win.body.append(canvas);
      const ctx = canvas.getContext('2d');
      const resize = () => { canvas.width = win.body.clientWidth; canvas.height = win.body.clientHeight; };
      resize();
      const size = 14;
      let drops = Array(Math.ceil(canvas.width / size)).fill(0).map(() => Math.random() * -40);
      const chars = 'アイウエオカキクケコサシスセソ0123456789NIMBUS';
      let raf;
      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, .08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#3ce07f';
        ctx.font = `${size}px monospace`;
        drops.forEach((y, i) => {
          ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
          drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
        });
        raf = requestAnimationFrame(draw);
      };
      draw();
      const stop = () => { cancelAnimationFrame(raf); canvas.remove(); input.removeEventListener('keydown', stop); canvas.removeEventListener('pointerdown', stop); input.focus(); };
      setTimeout(() => { input.addEventListener('keydown', stop, { once: true }); canvas.addEventListener('pointerdown', stop); }, 100);
      win.cleanup.push(() => cancelAnimationFrame(raf));
      drops = drops.map(() => Math.random() * -40);
    }

    print(`Dernière connexion : ${new Date().toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} sur ttys001`, 't-dim');
    print('Bienvenue dans le Terminal de Nimbus. Tapez <span class="t-green">help</span> pour commencer.');
    renderPrompt();
    setTimeout(() => input.focus(), 60);
    return win;
  }

  OS.registerApp({
    id: 'terminal',
    name: 'Terminal',
    keywords: ['console', 'shell', 'ligne de commande'],
    about: 'Un shell simulé : ls, cd, cat, echo, mkdir, open… Tapez « help ».',
    icon: OS.icons.terminal,
    launch,
  });
})();
