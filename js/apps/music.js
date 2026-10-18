/* =========================================================
   Musique — morceaux générés en direct avec la Web Audio API
   (aucun fichier audio, aucun droit d'auteur)
   ========================================================= */
(() => {
  const { h, fs, sym } = OS;

  /* ---------- Moteur audio ---------- */
  OS.music = (() => {
    const bus = OS.emitter();
    const TRACKS = [
      { title: 'Aube', artist: 'Nimbus Sound', style: 'ambient', bpm: 70, root: 57, bars: 24,
        chords: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [2, 5, 9, 12]], art: 'linear-gradient(135deg, #ffd29d, #ff9d6c 50%, #c86dd7)' },
      { title: 'Dérive', artist: 'Nimbus Sound', style: 'lofi', bpm: 78, root: 50, bars: 32,
        chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], art: 'linear-gradient(135deg, #5ee7df, #3a7bd5)' },
      { title: 'Néon', artist: 'Nimbus Sound', style: 'synth', bpm: 104, root: 45, bars: 32,
        chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [-9, -5, -2, 3], [-2, 2, 5, 10]], art: 'linear-gradient(135deg, #ff4f9a, #6d5dfc 60%, #1b1464)' },
      { title: 'Pluie', artist: 'Nimbus Sound', style: 'rain', bpm: 64, root: 52, bars: 20,
        chords: [[0, 4, 7, 11], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]], art: 'linear-gradient(135deg, #8e9eab, #3b5268)' },
    ];
    TRACKS.forEach((t) => { t.step = 60 / t.bpm / 4; t.duration = t.bars * 16 * t.step; });

    let ctx = null;
    let master;
    let mix;
    let reverb;
    let analyser;
    let noise;
    let session = null;
    let idx = 0;
    let playing = false;
    let pausedAt = 0;
    let timer = null;
    let startStep = 0;
    let startTime = 0;
    let nextStep = 0;
    let nextTime = 0;
    let rainSrc = null;

    const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      master.connect(analyser).connect(ctx.destination);
      mix = ctx.createGain();
      mix.connect(master);
      // Réverbération : réponse impulsionnelle générée
      reverb = ctx.createConvolver();
      const len = ctx.sampleRate * 2.8;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
      }
      reverb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      mix.connect(reverb).connect(wet).connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      setVolume(OS.settings.volume);
    }

    const setVolume = (v) => { if (master) master.gain.setTargetAtTime((v / 100) ** 2 * 0.9, ctx.currentTime, 0.05); };
    OS.on('settings', (k, v) => { if (k === 'volume') setVolume(v); });

    /* ---------- Instruments ---------- */
    const env = (g, t, a, peak, d) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };
    const osc = (type, f, t, end, dest, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(dest);
      o.start(t);
      o.stop(end);
      return o;
    };
    function pad(notes, t, dur, type, level) {
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = type === 'sawtooth' ? 1400 : 2200;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + Math.min(1, dur * 0.4));
      g.gain.setValueAtTime(level, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
      f.connect(g).connect(session);
      notes.forEach((n) => {
        osc(type, mtof(n), t, t + dur + 1.3, f, -7);
        osc(type, mtof(n), t, t + dur + 1.3, f, 7);
      });
    }
    function pluck(n, t, type, level, decay) {
      const g = ctx.createGain();
      env(g, t, 0.005, level, decay);
      g.connect(session);
      osc(type, mtof(n), t, t + decay + 0.05, g);
    }
    function bass(n, t, dur, type, level) {
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      env(g, t, 0.01, level, dur);
      f.connect(g).connect(session);
      osc(type, mtof(n), t, t + dur + 0.05, f);
    }
    function noiseHit(t, { hp = 0, bp = 0, level = 0.2, decay = 0.1 }) {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      const g = ctx.createGain();
      env(g, t, 0.001, level, decay);
      let node = s;
      if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
      if (bp) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; node.connect(f); node = f; }
      node.connect(g).connect(session);
      s.start(t, Math.random());
      s.stop(t + decay + 0.05);
    }
    function kick(t, level = 0.9) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      env(g, t, 0.002, level, 0.38);
      o.connect(g).connect(session);
      o.start(t);
      o.stop(t + 0.45);
    }
    const snare = (t, level = 0.32) => { noiseHit(t, { hp: 1200, level, decay: 0.18 }); pluck(55, t, 'triangle', level * 0.4, 0.08); };
    const hat = (t, open = false, level = 0.08) => noiseHit(t, { hp: 7500, level, decay: open ? 0.22 : 0.045 });

    /* ---------- Séquenceur ---------- */
    function scheduleStep(s, t) {
      const tr = TRACKS[idx];
      const pos = s % 16;
      const bar = Math.floor(s / 16);
      const chord = tr.chords[bar % tr.chords.length].map((n) => n + tr.root);
      const barDur = tr.step * 16;
      const r = Math.random;

      if (tr.style === 'ambient') {
        if (pos === 0) { pad(chord, t, barDur, 'triangle', 0.045); bass(chord[0] - 12, t, barDur * 0.9, 'sine', 0.16); }
        if (pos % 4 === 2 && r() < 0.7) pluck(chord[Math.floor(r() * chord.length)] + 12, t, 'sine', 0.07, 1.6);
      }
      if (tr.style === 'lofi') {
        if (pos === 0) pad(chord, t, barDur, 'triangle', 0.04);
        if (pos % 2 === 0 && r() < 0.55) pluck(chord[(s / 2) % chord.length] + 12, t, 'triangle', 0.06, 0.5);
        if (pos === 0 || pos === 10) bass(chord[0] - 12, t, tr.step * 5, 'sine', 0.22);
        if (pos === 0 || pos === 7 || pos === 10) kick(t, 0.75);
        if (pos === 4 || pos === 12) snare(t, 0.22);
        if (pos % 2 === 0) hat(t, false, 0.05);
      }
      if (tr.style === 'synth') {
        if (pos === 0) pad(chord, t, barDur, 'sawtooth', 0.028);
        if (pos % 2 === 0) bass(chord[0] - 12 + (pos % 4 === 2 ? 12 : 0), t, tr.step * 1.6, 'sawtooth', 0.12);
        pluck(chord[s % chord.length] + 12 + (pos >= 8 ? 12 : 0), t, 'square', 0.025, 0.18);
        if (pos % 4 === 0) kick(t, 0.85);
        if (pos === 4 || pos === 12) snare(t, 0.3);
        if (pos % 4 === 2) hat(t, true, 0.06);
      }
      if (tr.style === 'rain') {
        if (pos === 0) pad(chord, t, barDur, 'sine', 0.06);
        if (pos % 2 === 0 && r() < 0.32) pluck(chord[Math.floor(r() * chord.length)] + 24, t, 'sine', 0.06, 2.2);
        if (pos === 0) bass(chord[0] - 12, t, barDur, 'sine', 0.12);
      }
    }

    function startRain() {
      stopRain();
      rainSrc = ctx.createBufferSource();
      rainSrc.buffer = noise;
      rainSrc.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      rainSrc.connect(f).connect(g).connect(session);
      rainSrc.start();
    }
    function stopRain() { try { rainSrc?.stop(); } catch { /* déjà arrêté */ } rainSrc = null; }

    function newSession() {
      if (session) {
        const old = session;
        old.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
        setTimeout(() => old.disconnect(), 400);
      }
      session = ctx.createGain();
      session.connect(mix);
    }

    function startAt(posSec) {
      init();
      ctx.resume();
      const tr = TRACKS[idx];
      newSession();
      startStep = Math.floor(posSec / tr.step);
      nextStep = startStep;
      startTime = ctx.currentTime + 0.06;
      nextTime = startTime;
      if (tr.style === 'rain') startRain(); else stopRain();
      clearInterval(timer);
      timer = setInterval(tick, 25);
      tick();
      playing = true;
      bus.emit('state');
    }

    function tick() {
      const tr = TRACKS[idx];
      const total = tr.bars * 16;
      while (nextTime < ctx.currentTime + 0.15) {
        if (nextStep >= total) {
          clearInterval(timer);
          const token = session;
          setTimeout(() => { if (playing && session === token) next(); }, Math.max(0, (nextTime - ctx.currentTime) * 1000));
          return;
        }
        const swing = tr.style === 'lofi' && nextStep % 2 ? tr.step * 0.18 : 0;
        scheduleStep(nextStep, nextTime + swing);
        nextStep++;
        nextTime += tr.step;
      }
    }

    const position = () => {
      if (!playing) return pausedAt;
      const tr = TRACKS[idx];
      return Math.min(tr.duration, startStep * tr.step + Math.max(0, ctx.currentTime - startTime));
    };

    function play(i) {
      if (i != null && i !== idx) { idx = (i + TRACKS.length) % TRACKS.length; pausedAt = 0; }
      startAt(pausedAt);
    }
    function pause() {
      if (!playing) return;
      pausedAt = position();
      playing = false;
      clearInterval(timer);
      stopRain();
      newSession();
      bus.emit('state');
    }
    function next() { idx = (idx + 1) % TRACKS.length; pausedAt = 0; startAt(0); }
    function prev() {
      if (position() > 3) { pausedAt = 0; if (playing) startAt(0); else bus.emit('state'); return; }
      idx = (idx - 1 + TRACKS.length) % TRACKS.length;
      pausedAt = 0;
      if (playing) startAt(0); else bus.emit('state');
    }
    function seek(sec) {
      pausedAt = OS.clamp(sec, 0, TRACKS[idx].duration - 0.1);
      if (playing) startAt(pausedAt); else bus.emit('state');
    }
    function select(i) { idx = i; pausedAt = 0; startAt(0); }

    return {
      TRACKS, on: bus.on, play, pause, next, prev, seek, select, position,
      toggle: () => (playing ? pause() : play()),
      playing: () => playing,
      index: () => idx,
      current: () => (ctx || playing || pausedAt ? TRACKS[idx] : null),
      analyser: () => analyser,
      stop: () => { pause(); pausedAt = 0; bus.emit('state'); },
    };
  })();

  /* ---------- Fenêtre ---------- */
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function launch(args = {}) {
    const M = OS.music;
    const win = OS.wm.open({ app: 'music', title: 'Musique', width: 760, height: 480, minW: 520, minH: 380, className: 'win--music' });

    const list = h('div', { class: 'music__list' });
    const art = h('div', { class: 'music__art' });
    const canvas = h('canvas', { class: 'music__viz' });
    const title = h('h2', { class: 'music__title' });
    const artist = h('p', { class: 'music__artist' });
    const progress = h('input', { type: 'range', class: 'music__progress', min: '0', max: '1000', value: '0', 'aria-label': 'Position' });
    const tCur = h('span', {});
    const tDur = h('span', {});
    const playBtn = h('button', { class: 'music__play', 'aria-label': 'Lecture', onclick: () => M.toggle() });
    const vol = h('input', { type: 'range', min: '0', max: '100', value: String(OS.settings.volume), 'aria-label': 'Volume', oninput: (e) => OS.setSetting('volume', +e.target.value) });

    win.body.append(h('div', { class: 'music' },
      h('aside', { class: 'music__side' }, h('div', { class: 'music__sidehead' }, 'Playlist · Nimbus Sound'), list),
      h('div', { class: 'music__main' },
        h('div', { class: 'music__artwrap' }, art, canvas),
        title, artist,
        h('div', { class: 'music__bar' }, progress, h('div', { class: 'music__times' }, tCur, tDur)),
        h('div', { class: 'music__controls' },
          h('button', { class: 'music__ctl', 'aria-label': 'Précédent', html: sym.prev, onclick: () => M.prev() }),
          playBtn,
          h('button', { class: 'music__ctl', 'aria-label': 'Suivant', html: sym.next, onclick: () => M.next() })),
        h('div', { class: 'music__vol' }, h('span', { html: sym.volume }), vol))));

    let dragging = false;
    progress.addEventListener('input', () => { dragging = true; tCur.textContent = fmt(progress.value / 1000 * M.TRACKS[M.index()].duration); });
    progress.addEventListener('change', () => { dragging = false; M.seek(progress.value / 1000 * M.TRACKS[M.index()].duration); });

    function render() {
      const tr = M.TRACKS[M.index()];
      art.style.background = tr.art;
      title.textContent = tr.title;
      artist.textContent = tr.artist;
      tDur.textContent = fmt(tr.duration);
      playBtn.innerHTML = M.playing() ? sym.pause : sym.play;
      playBtn.setAttribute('aria-label', M.playing() ? 'Pause' : 'Lecture');
      win.el.classList.toggle('is-playing', M.playing());
      win.setTitle(M.playing() ? `${tr.title} — ${tr.artist}` : 'Musique');
      list.replaceChildren(...M.TRACKS.map((t, i) => h('button', {
        class: `music__item${i === M.index() ? ' is-active' : ''}`,
        ondblclick: () => M.select(i),
        onclick: () => M.select(i),
      },
      h('span', { class: 'music__num' }, i === M.index() && M.playing() ? h('span', { class: 'music__eq' }, h('i'), h('i'), h('i')) : String(i + 1)),
      h('span', { class: 'music__thumb', style: { background: t.art } }),
      h('span', { class: 'music__name' }, h('strong', {}, t.title), h('small', {}, t.artist)),
      h('span', { class: 'music__len' }, fmt(t.duration)))));
    }

    /* Visualiseur et progression */
    const g = canvas.getContext('2d');
    let raf;
    const loop = () => {
      const tr = M.TRACKS[M.index()];
      const pos = M.position();
      if (!dragging) { progress.value = String(Math.round(pos / tr.duration * 1000)); tCur.textContent = fmt(pos); }
      progress.style.setProperty('--p', `${progress.value / 10}%`);
      const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
      const hh = (canvas.height = canvas.clientHeight * devicePixelRatio);
      const an = M.analyser();
      if (an && M.playing()) {
        const data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const bars = 32;
        const bw = w / bars;
        g.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 0; i < bars; i++) {
          const v = data[Math.floor(i * data.length * 0.7 / bars)] / 255;
          const bh = Math.max(2 * devicePixelRatio, v * hh * 0.9);
          g.beginPath();
          if (g.roundRect) g.roundRect(i * bw + bw * 0.2, hh - bh, bw * 0.6, bh, bw * 0.3);
          else g.rect(i * bw + bw * 0.2, hh - bh, bw * 0.6, bh);
          g.fill();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    const unsub = M.on('state', render);
    const unsubVol = OS.on('settings', (k, v) => { if (k === 'volume') vol.value = String(v); });
    win.cleanup.push(unsub, unsubVol, () => cancelAnimationFrame(raf), () => M.stop());
    win.openFile = (path) => {
      const n = fs.get(path);
      if (n?.track != null) M.select(n.track % M.TRACKS.length);
    };
    render();
    if (args.path) win.openFile(args.path);
    return win;
  }

  OS.registerApp({
    id: 'music',
    name: 'Musique',
    single: true,
    keywords: ['audio', 'lecteur', 'playlist', 'son'],
    about: 'Des morceaux composés en direct par le navigateur, sans aucun fichier audio.',
    icon: OS.icons.music,
    launch,
    handle(win, args) { if (args.path) win.openFile(args.path); },
  });
})();
