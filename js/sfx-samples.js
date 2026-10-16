// sfx-samples.js
//
// Recorded samples (#94) in front of the synthesised voices in js/sfx.js. The files live in art/sfx/<army>/
// and art/sfx/shared/ (see art/sfx/CREDITS.md: Kenney, CC0). They load lazily on the first gesture and
// play through sfx's effects bus, so mute and the volume sliders apply. Anything missing, undecodable or
// blocked falls back to the synth call it replaces; 'Sound style: Synth' turns the samples off entirely.
// On file:// (the installer opens the game that way in Edge) fetch() is refused, so <audio> elements take
// over, and if those fail too, the synth plays.

(() => {
  const STYLE_KEY = 'cs-sound-style';
  let style = store.get(STYLE_KEY, 'recorded') === 'synth' ? 'synth' : 'recorded';
  const ROLES = { army: ['march', 'clash', 'capture', 'power', 'call'], shared: ['chime', 'drum', 'horn', 'menu', 'victory', 'defeat', 'roar', 'crown', 'wave'] };
  const VARIANTS = { march: 2, clash: 2 };   // roles with numbered files: march0.ogg, march1.ogg
  const files = {};                            // key -> ['art/sfx/x/y.ogg', ...]
  for (const id of ARMY_IDS) for (const r of ROLES.army) files[`${id}/${r}`] = VARIANTS[r] ? [0, 1].map(i => `art/sfx/${id}/${r}${i}.ogg`) : [`art/sfx/${id}/${r}.ogg`];
  for (const r of ROLES.shared) files[`shared/${r}`] = [`art/sfx/shared/${r}.ogg`];
  const buffers = {};   // path -> AudioBuffer | 'failed' | Audio element
  let loading = false, fetchOk = typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:');

  function loadAll() {
    if (loading || style !== 'recorded') return;
    loading = true;
    const ac = sfx.context();
    for (const list of Object.values(files)) for (const p of list) {
      if (buffers[p]) continue;
      if (fetchOk && ac) {
        fetch(p).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))
          .then(ab => ac.decodeAudioData(ab)).then(buf => { buffers[p] = buf; })
          .catch(() => { buffers[p] = elementFor(p); });
      } else buffers[p] = elementFor(p);
    }
  }
  // The <audio> fallback: an element that marks itself failed if the file can't load.
  function elementFor(p) {
    try {
      const a = new Audio(); a.preload = 'auto';
      a.addEventListener('error', () => { buffers[p] = 'failed'; });
      a.src = p;
      return a;
    } catch { return 'failed'; }
  }
  const gainNow = () => sfx.muted ? 0 : sfx.volume('all') * sfx.volume('effects');
  // Plays a role; false when the synth should play instead.
  function play(key, { vol = 1, rate = 1 } = {}) {
    if (style !== 'recorded') return false;
    const list = files[key]; if (!list) return false;
    const p = list[Math.floor(Math.random() * list.length)], b = buffers[p];
    if (!b || b === 'failed') return false;
    if (sfx.muted || gainNow() <= 0) return true;   // silent, but no synth either
    const ac = sfx.context();
    if (typeof AudioBuffer !== 'undefined' && b instanceof AudioBuffer && ac && sfx.effectsBus()) {
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = b; src.playbackRate.value = rate; g.gain.value = vol;
      src.connect(g); g.connect(sfx.effectsBus()); src.start();
      return true;
    }
    if (b.play) { try { const a = b.cloneNode(); a.volume = Math.min(1, 0.45 * vol * gainNow()); a.playbackRate = rate; a.play().catch(() => {}); return true; } catch { return false; } }
    return false;
  }

  // In front of the synth: each wrapped call tries its sample first.
  const base = { drum: sfx.drum, clash: sfx.clash, march: sfx.march, capture: sfx.capture, horn: sfx.horn, power: sfx.power, chime: sfx.chime, fanfare: sfx.fanfare, unlock: sfx.unlock };
  const armyKey = (id, r) => `${ARMIES[id] ? id : 'aldmere'}/${r}`;
  let lastClash = 0, lastMarch = 0;
  sfx.unlock = function () { base.unlock.call(sfx); loadAll(); };
  sfx.drum = function () { if (!play('shared/drum', { vol: 0.9 })) base.drum.call(sfx); };
  sfx.clash = function (id) {
    const now = performance.now(); if (now - lastClash < 80) return; lastClash = now;
    if (!play(armyKey(id, 'clash'), { vol: 0.5, rate: 0.95 + Math.random() * 0.1 })) base.clash.call(sfx, id);
  };
  sfx.march = function (id) {
    const now = performance.now(); if (now - lastMarch < 250) return; lastMarch = now;
    if (!play(armyKey(id, 'march'), { vol: 0.7 })) base.march.call(sfx, id);
  };
  sfx.capture = function (id, mine) { if (!play(armyKey(id, 'capture'), { vol: 0.8, rate: mine ? 1 : 0.85 })) base.capture.call(sfx, id, mine); };
  sfx.horn = function (won) { if (!play(won ? 'shared/victory' : 'shared/defeat', { vol: 0.9 })) base.horn.call(sfx, won); };
  sfx.power = function (mine) { const id = G && G.fac ? G.fac[1] : 'aldmere'; if (!play(armyKey(id, 'power'), { vol: 0.9 })) base.power.call(sfx, mine); };
  sfx.chime = function () { if (!play('shared/chime', { vol: 0.7 })) base.chime.call(sfx); };
  if (base.fanfare) sfx.fanfare = function (...a) { if (!play('shared/menu', { vol: 0.8 })) base.fanfare.apply(sfx, a); };
  // A lord speaks (the taunt card): a short sting in the army's voice.
  on('taunt', ({ o, force }) => { if (G && !G.cfg.demo && o !== 1 && force) play(armyKey(G.fac[o], 'call'), { vol: 0.5 }); });
  on('monster', e => { if (e.kind === 'spawn' || e.kind === 'warning') play('shared/roar', { vol: 0.9, rate: 0.7 }); });
  on('crownFound', () => play('shared/crown', { vol: 0.8 }));
  on('wave', ({ phase }) => { if (phase === 'march' && G && !G.cfg.demo) play('shared/wave', { vol: 0.6, rate: 0.8 }); });

  // The setting: Recorded or Synth, beside the volume sliders on the menu and the pause sheet.
  function styleRow() {
    const row = document.createElement('div');
    row.className = 'seg sound-style';
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Sound style');
    row.innerHTML = `<span class="sublabel" style="width:100%">Sound style</span>` + [['recorded', 'Recorded'], ['synth', 'Synth']].map(([k, n]) => `<button type="button" data-style="${k}" aria-pressed="${k === style}">${n}</button>`).join('');
    row.addEventListener('click', e => {
      const b = e.target.closest('button[data-style]'); if (!b) return;
      setStyle(b.dataset.style);
    });
    return row;
  }
  function setStyle(v) {
    style = v === 'synth' ? 'synth' : 'recorded';
    store.set(STYLE_KEY, style);
    document.querySelectorAll('.sound-style button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === style)));
    if (style === 'recorded' && sfx.context()) loadAll();
  }
  for (const box of document.querySelectorAll('.volume-box')) box.after(styleRow());
  // For the smoke test and the console.
  window.sfxSamples = { get style() { return style; }, setStyle, play, loaded: () => Object.values(buffers).filter(b => b && b !== 'failed' && !(b.play)).length, files };
})();
