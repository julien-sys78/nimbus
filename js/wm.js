/* =========================================================
   NIMBUS — gestionnaire de fenêtres
   Déplacement, redimensionnement, focus, réduction dans le Dock, plein écran.
   ========================================================= */
OS.wm = (() => {
  const { h } = OS;
  const bus = OS.emitter();
  const layer = document.getElementById('windows');
  const wins = new Map();
  let z = 10;
  let idc = 0;
  let focused = null;

  const MENU_H = 28;
  const small = () => window.innerWidth < 700;
  const dockGap = () => (document.getElementById('dock')?.offsetHeight || 70) + 14;
  const area = () => ({ x: 0, y: MENU_H, w: window.innerWidth, h: window.innerHeight - MENU_H - dockGap() });

  const apply = (win) => {
    const { x, y, w, h: hh } = win.rect;
    Object.assign(win.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
  };

  const topVisible = (except) =>
    [...wins.values()].filter((w) => w !== except && !w.minimized).sort((a, b) => b.z - a.z)[0] || null;

  function focus(win) {
    if (!win) {
      focused?.el.classList.remove('is-focused');
      focused = null;
      bus.emit('focus', null);
      return;
    }
    if (win.minimized) restore(win);
    if (focused && focused !== win) focused.el.classList.remove('is-focused');
    win.z = ++z;
    win.el.style.zIndex = win.z;
    win.el.classList.add('is-focused');
    if (focused !== win) {
      focused = win;
      bus.emit('focus', win);
      win.onFocus?.();
    }
  }

  function animateTo(win, rect) {
    win.el.classList.add('is-anim');
    win.rect = rect;
    apply(win);
    setTimeout(() => { win.el.classList.remove('is-anim'); win.onResize?.(); }, 260);
  }

  function toggleMax(win) {
    if (win.maximized) {
      win.maximized = false;
      win.el.classList.remove('is-max');
      animateTo(win, win.prevRect);
    } else {
      win.prevRect = { ...win.rect };
      win.maximized = true;
      win.el.classList.add('is-max');
      const a = area();
      animateTo(win, { x: a.x, y: a.y, w: a.w, h: a.h });
    }
    bus.emit('change');
  }

  function dockTarget(win) {
    const icon = document.querySelector(`.dock__item[data-app="${win.app}"]`);
    return icon ? icon.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight, width: 0, height: 0 };
  }

  function minimize(win) {
    if (win.minimized) return;
    const r = win.el.getBoundingClientRect();
    const t = dockTarget(win);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2);
    const dy = t.top + t.height / 2 - (r.top + r.height / 2);
    win.minimized = true;
    const anim = win.el.animate(
      [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.06)`, opacity: 0.2 }],
      { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' },
    );
    win.anim = anim;
    anim.onfinish = () => { if (win.minimized) win.el.hidden = true; };
    if (focused === win) focus(topVisible(win));
    bus.emit('change');
  }

  function restore(win) {
    if (!win.minimized) return;
    win.anim?.cancel();
    win.minimized = false;
    win.el.hidden = false;
    const r = win.el.getBoundingClientRect();
    const t = dockTarget(win);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2);
    const dy = t.top + t.height / 2 - (r.top + r.height / 2);
    win.el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(0.06)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
    focus(win);
    bus.emit('change');
  }

  function close(win) {
    if (win.closing) return;
    if (win.beforeClose && win.beforeClose() === false) return;
    win.closing = true;
    const anim = win.el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }], { duration: 150, easing: 'ease-in' });
    anim.onfinish = () => win.el.remove();
    wins.delete(win.id);
    win.cleanup.forEach((fn) => fn());
    win.onClose?.();
    if (focused === win) { focused = null; focus(topVisible()); }
    bus.emit('change');
  }

  /* ---------- Déplacement ---------- */
  function startDrag(win, e) {
    if (e.button !== 0 || e.target.closest('button, input, select, textarea, a, [data-nodrag]')) return;
    focus(win);
    const startX = e.clientX;
    const startY = e.clientY;
    let start = { ...win.rect };
    let moved = false;
    const bar = e.currentTarget;
    try { bar.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved && win.maximized) {
        // Sortie du plein écran en glissant : la fenêtre reprend sa taille sous le curseur
        win.maximized = false;
        win.el.classList.remove('is-max');
        const ratio = (startX - win.rect.x) / win.rect.w;
        start = { ...win.prevRect, x: startX - win.prevRect.w * ratio, y: MENU_H };
      }
      moved = true;
      win.el.classList.add('is-dragging');
      win.rect.x = OS.clamp(start.x + dx, -start.w + 80, window.innerWidth - 80);
      win.rect.y = OS.clamp(start.y + dy, MENU_H, window.innerHeight - 40);
      win.rect.w = start.w;
      win.rect.h = start.h;
      apply(win);
    };
    const onUp = () => {
      bar.removeEventListener('pointermove', onMove);
      bar.removeEventListener('pointerup', onUp);
      bar.removeEventListener('pointercancel', onUp);
      win.el.classList.remove('is-dragging');
      if (moved) win.onResize?.();
    };
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
    bar.addEventListener('pointercancel', onUp);
  }

  /* ---------- Redimensionnement ---------- */
  function startResize(win, dir, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    focus(win);
    const handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
    const sx = e.clientX;
    const sy = e.clientY;
    const s = { ...win.rect };
    if (win.maximized) { win.maximized = false; win.el.classList.remove('is-max'); }
    win.el.classList.add('is-dragging');

    const onMove = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const r = { ...s };
      if (dir.includes('e')) r.w = Math.max(win.minW, s.w + dx);
      if (dir.includes('s')) r.h = Math.max(win.minH, s.h + dy);
      if (dir.includes('w')) { r.w = Math.max(win.minW, s.w - dx); r.x = s.x + s.w - r.w; }
      if (dir.includes('n')) {
        r.h = Math.max(win.minH, s.h - dy);
        r.y = s.y + s.h - r.h;
        if (r.y < MENU_H) { r.h -= MENU_H - r.y; r.y = MENU_H; }
      }
      win.rect = r;
      apply(win);
      win.onResize?.();
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      win.el.classList.remove('is-dragging');
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  /* ---------- Ouverture ---------- */
  function open(opts) {
    const id = 'w' + (++idc);
    const a = area();
    const w = Math.min(opts.width || 640, a.w - 24);
    const hh = Math.min(opts.height || 420, a.h - 16);
    const count = [...wins.values()].filter((x) => !x.minimized).length % 6;
    const fit = (v, min, max) => (max < min ? (min + max) / 2 : OS.clamp(v, min, max));
    const x = opts.x ?? Math.round(fit((a.w - w) / 2 + (count - 1) * 26, 8, a.w - w - 8));
    const y = opts.y ?? Math.round(fit(a.y + (a.h - hh) / 2 - 20 + (count - 1) * 22, a.y + 6, a.y + a.h - hh));

    const traffic = h('div', { class: 'traffic', 'data-nodrag': '' },
      h('button', { class: 'traffic__btn traffic__close', 'aria-label': 'Fermer' }),
      h('button', { class: 'traffic__btn traffic__min', 'aria-label': 'Réduire', disabled: opts.minimizable === false }),
      h('button', { class: 'traffic__btn traffic__max', 'aria-label': 'Plein écran', disabled: opts.resizable === false }),
    );
    const title = h('div', { class: 'win__title' }, opts.title || '');
    const toolbar = h('div', { class: 'win__toolbar' });
    const bar = h('header', { class: 'win__bar' }, traffic, title, toolbar);
    const body = h('div', { class: 'win__body' });
    const el = h('section', { class: `win ${opts.className || ''}`, role: 'dialog', 'aria-label': opts.title || '', 'data-app': opts.app }, h('div', { class: 'win__frame' }, bar, body));

    const win = {
      id, app: opts.app, el, bar, body, toolbar, titleEl: title,
      rect: { x, y: OS.clamp(y, MENU_H, window.innerHeight - 80), w, h: hh },
      minW: opts.minW || 260, minH: opts.minH || 160,
      minimized: false, maximized: false, z: 0, cleanup: [],
      title: opts.title || '',
      setTitle(t) { win.title = t; title.textContent = t; el.setAttribute('aria-label', t); bus.emit('change'); },
      close: () => close(win), focus: () => focus(win), minimize: () => minimize(win), toggleMax: () => toggleMax(win),
      onClose: opts.onClose,
    };

    traffic.children[0].addEventListener('click', () => close(win));
    traffic.children[1].addEventListener('click', () => minimize(win));
    traffic.children[2].addEventListener('click', () => toggleMax(win));
    bar.addEventListener('pointerdown', (e) => startDrag(win, e));
    bar.addEventListener('dblclick', (e) => { if (opts.resizable !== false && !e.target.closest('button, input, [data-nodrag]')) toggleMax(win); });
    el.addEventListener('pointerdown', () => focus(win), true);

    if (opts.resizable !== false) {
      ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((d) => {
        const hd = h('div', { class: `win__rz win__rz--${d}` });
        hd.addEventListener('pointerdown', (e) => startResize(win, d, e));
        el.append(hd);
      });
    }

    wins.set(id, win);
    apply(win);
    layer.append(el);
    el.animate([{ transform: 'scale(.92)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
    focus(win);
    if (small() && opts.resizable !== false) {
      win.prevRect = { ...win.rect };
      win.maximized = true;
      el.classList.add('is-max');
      win.rect = { ...area() };
      apply(win);
    }
    bus.emit('change');
    return win;
  }

  /* Recalage des fenêtres quand l'écran change de taille */
  window.addEventListener('resize', OS.debounce(() => {
    const a = area();
    wins.forEach((win) => {
      if (win.maximized) win.rect = { ...a };
      else {
        win.rect.w = Math.min(win.rect.w, a.w);
        win.rect.h = Math.min(win.rect.h, a.h);
        win.rect.x = OS.clamp(win.rect.x, 0, Math.max(0, a.w - win.rect.w));
        win.rect.y = OS.clamp(win.rect.y, MENU_H, Math.max(MENU_H, MENU_H + a.h - win.rect.h));
      }
      apply(win);
      win.onResize?.();
    });
  }, 120));

  return {
    open, close, focus, minimize, restore, toggleMax, on: bus.on,
    list: () => [...wins.values()],
    byApp: (app) => [...wins.values()].filter((w) => w.app === app),
    focused: () => focused,
    area,
  };
})();
