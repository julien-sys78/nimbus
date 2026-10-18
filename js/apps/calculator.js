/* =========================================================
   Calculatrice
   ========================================================= */
(() => {
  const { h } = OS;

  function launch() {
    const win = OS.wm.open({ app: 'calculator', title: '', width: 240, height: 372, resizable: false, className: 'win--calc' });
    let display = '0';
    let acc = null;
    let op = null;
    let fresh = true;
    let lastOp = null;

    const screen = h('div', { class: 'calc__screen', 'aria-live': 'polite' });
    const keys = h('div', { class: 'calc__keys' });
    win.body.append(h('div', { class: 'calc' }, screen, keys));

    const fmt = (n) => {
      if (!Number.isFinite(n)) return 'Erreur';
      const r = Math.round(n * 1e10) / 1e10;
      if (Math.abs(r) >= 1e12 || (Math.abs(r) < 1e-7 && r !== 0)) return r.toExponential(5).replace('.', ',');
      return r.toLocaleString('fr-FR', { maximumFractionDigits: 10 }).replace(/ /g, ' ');
    };
    const num = () => parseFloat(display.replace(/\s/g, '').replace(',', '.'));
    const compute = (a, b, o) => ({ '+': a + b, '−': a - b, '×': a * b, '÷': b === 0 ? NaN : a / b }[o]);

    const render = () => {
      const shown = display.includes(',') || display === '0' || display === 'Erreur' || display.endsWith(',') ? display : fmt(num());
      screen.textContent = shown;
      screen.style.fontSize = shown.length > 9 ? `${Math.max(24, 46 - (shown.length - 9) * 3.2)}px` : '';
      keys.querySelector('[data-k="ac"]').textContent = display !== '0' && !fresh ? 'C' : 'AC';
      keys.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('is-on', b.dataset.op === op && fresh));
    };

    const press = (k) => {
      if (display === 'Erreur' && k !== 'ac') { display = '0'; acc = null; op = null; }
      if (/^\d$/.test(k)) {
        if (fresh) { display = k; fresh = false; } else if (display.replace(/\D/g, '').length < 12) display = display === '0' ? k : display + k;
      } else if (k === ',') {
        if (fresh) { display = '0,'; fresh = false; } else if (!display.includes(',')) display += ',';
      } else if (k === 'ac') {
        if (display !== '0' && !fresh) { display = '0'; fresh = true; } else { display = '0'; acc = null; op = null; lastOp = null; fresh = true; }
      } else if (k === '±') {
        display = display.startsWith('-') ? display.slice(1) : display === '0' ? '0' : '-' + display;
      } else if (k === '%') {
        display = fmt(acc != null && (op === '+' || op === '−') ? acc * num() / 100 : num() / 100);
        fresh = true;
      } else if (['+', '−', '×', '÷'].includes(k)) {
        if (op && !fresh) { acc = compute(acc, num(), op); display = fmt(acc); } else if (!op || acc == null) acc = num();
        op = k;
        fresh = true;
        lastOp = null;
      } else if (k === '=') {
        if (op) { const b = num(); acc = compute(acc, b, op); lastOp = [op, b]; op = null; display = fmt(acc); }
        else if (lastOp) { acc = compute(num(), lastOp[1], lastOp[0]); display = fmt(acc); }
        fresh = true;
      }
      render();
    };

    [
      ['ac', 'AC', 'fn'], ['±', '±', 'fn'], ['%', '%', 'fn'], ['÷', '÷', 'op'],
      ['7', '7'], ['8', '8'], ['9', '9'], ['×', '×', 'op'],
      ['4', '4'], ['5', '5'], ['6', '6'], ['−', '−', 'op'],
      ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+', 'op'],
      ['0', '0', 'zero'], [',', ','], ['=', '=', 'op'],
    ].forEach(([k, label, type]) => keys.append(h('button', {
      class: `calc__key${type ? ' calc__key--' + type : ''}`,
      dataset: { k, ...(type === 'op' && k !== '=' ? { op: k } : {}) },
      onclick: () => press(k),
    }, label)));

    win.el.tabIndex = -1;
    win.el.addEventListener('keydown', (e) => {
      const map = { '/': '÷', '*': '×', x: '×', '-': '−', '+': '+', Enter: '=', '=': '=', '.': ',', ',': ',', Escape: 'ac', Delete: 'ac', '%': '%' };
      if (/^\d$/.test(e.key)) press(e.key);
      else if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
      else if (e.key === 'Backspace' && !fresh) { display = display.length > 1 ? display.slice(0, -1) : '0'; render(); }
      else return;
      const btn = keys.querySelector(`[data-k="${CSS.escape(/^\d$/.test(e.key) ? e.key : map[e.key] || '')}"]`);
      if (btn) { btn.classList.add('is-pressed'); setTimeout(() => btn.classList.remove('is-pressed'), 120); }
    });
    win.onFocus = () => win.el.focus({ preventScroll: true });
    setTimeout(() => win.el.focus({ preventScroll: true }), 50);
    render();
    return win;
  }

  OS.registerApp({
    id: 'calculator',
    name: 'Calculatrice',
    single: true,
    keywords: ['calcul', 'maths'],
    about: 'Calculs rapides, au clavier ou à la souris.',
    icon: OS.icons.calculator,
    launch,
  });
})();
