// sfx.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Synthesised sound effects (no audio files). Browser only.

// ---------- sound (synthesised, no audio files) ----------
// How each army sounds (#69): the clang of its weapons, the beat of its march, and the call it sounds on
// taking a castle. Aldmere rings like tempered steel, Kharzul's horde clatters on hoof and horn, Frostmark
// thuds with shields and a deep horn, Solmara's brass is bright, and Nyxhollow's notes slide eerily.
const ARMY_VOICE = {
  aldmere:   { clash: { freq: 2800, q: 7, dur: 0.11, ring: 1900, type: 'triangle' }, march: [0, 0.18], step: 520, call: [294, 392, 440], horn: 'sawtooth' },
  kharzul:   { clash: { freq: 1500, q: 4, dur: 0.09, ring: 1100, type: 'sawtooth' }, march: [0, 0.07, 0.2, 0.27], step: 380, hoof: true, call: [220, 330, 294], horn: 'sawtooth' },
  frostmark: { clash: { freq: 900, q: 2, dur: 0.16, ring: 700, type: 'triangle' }, march: [0, 0.3], step: 260, call: [147, 220, 196], horn: 'sawtooth' },
  solmara:   { clash: { freq: 3400, q: 9, dur: 0.1, ring: 2400, type: 'square' }, march: [0, 0.12, 0.24], step: 640, call: [392, 494, 587], horn: 'square' },
  nyx:       { clash: { freq: 2000, q: 12, dur: 0.14, ring: 1300, type: 'sine' }, march: [0, 0.22], step: 300, call: [233, 277, 247], horn: 'sine' },
};
const sfx = (() => {
  let ac = null, out = null, master = null, noise = null, lastClash = 0, lastMarch = 0, lastCapture = 0;
  let muted = store.get('cs-muted', false);
  // Three volume channels (#69): everything, effects and music, each 0 to 1, saved between visits.
  const vol = { all: 1, effects: 1, music: 1, ...store.get('cs-volume', {}) };
  const SFX_VOL = 0.45;
  function ensure() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = vol.all; out.connect(ac.destination);
      master = ac.createGain(); master.gain.value = SFX_VOL * vol.effects; master.connect(out);
      noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  }
  const ready = () => ac && !muted && ac.state === 'running';
  function env(g, t0, vol, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function tone(freq, t0, dur, { type = 'sine', vol = 0.3, to = null, cutoff = null, out = master } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    let node = o;
    if (cutoff) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    node.connect(g); g.connect(out); env(g, t0, vol, dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function burst(t0, dur, { vol = 0.2, type = 'lowpass', freq = 1000, q = 1, out = master } = {}) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); f.connect(g); g.connect(out); env(g, t0, vol, dur);
    s.start(t0, Math.random() * 0.3); s.stop(t0 + dur + 0.05);
  }
  // ---- Music: a quiet step sequencer, one theme per homeland ----
  // Scales are semitone steps from the root. Melodies are generated from a seed per two-bar phrase,
  // so each theme repeats motifs with variation instead of wandering aimlessly.
  const THEME_MUSIC = {
    vale:   { bpm: 92,  root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], lead: { type: 'triangle', cutoff: 2600, vol: 0.06, dur: 0.38 }, drone: { type: 'triangle', vol: 0.03 }, perc: [1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 2, 0], drum: 'low' },
    steppe: { bpm: 112, root: 164.81, scale: [0, 1, 3, 5, 7, 8, 10], lead: { type: 'sawtooth', cutoff: 1300, vol: 0.04, dur: 0.22 }, drone: { type: 'sawtooth', cutoff: 420, vol: 0.03 }, perc: [1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 2, 0, 0], drum: 'low' },
    tundra: { bpm: 68,  root: 110,    scale: [0, 2, 3, 5, 7, 8, 10], lead: { type: 'sine', vol: 0.06, dur: 1.0, octave: 2 }, drone: { type: 'sine', vol: 0.045 }, perc: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], drum: 'low' },
    desert: { bpm: 100, root: 146.83, scale: [0, 1, 4, 5, 7, 8, 10], lead: { type: 'sawtooth', cutoff: 1700, vol: 0.04, dur: 0.26 }, drone: { type: 'triangle', vol: 0.03 }, perc: [1, 0, 2, 0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 2, 2, 0], drum: 'hand' },
    // The main menu's own theme: a slow processional in D, horns over a soft drum.
    menu:   { bpm: 76,  root: 146.83, scale: [0, 2, 4, 5, 7, 9, 11], lead: { type: 'triangle', cutoff: 2200, vol: 0.055, dur: 0.6 }, drone: { type: 'triangle', vol: 0.035 }, perc: [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], drum: 'low' },
    mire:   { bpm: 58,  root: 123.47, scale: [0, 1, 3, 6, 7, 10], lead: { type: 'sine', vol: 0.055, dur: 1.2 }, drone: { type: 'sine', vol: 0.05, beat: 1.8 }, perc: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], drum: 'low' },
  };
  let musicOn = store.get('cs-music', true), musicBus = null, musicTheme = 'vale', musicLevel = 0, musicTarget = 0;
  let step = 0, nextAt = 0, timer = 0, phraseSeed = 0, degree = 3;
  const MUSIC_VOL = 0.5;
  const musicGain = () => musicOn && !muted ? MUSIC_VOL * vol.music : 0;
  const hz = (T, deg, octave) => {
    const n = T.scale.length, oct = Math.floor(deg / n);
    return T.root * Math.pow(2, (T.scale[((deg % n) + n) % n] + 12 * (oct + octave)) / 12);
  };
  function seeded(seed) { let x = seed | 0; return () => { x = Math.imul(x ^ x >>> 15, 0x2c1b3c6d) + 0x9e3779b9 | 0; return ((x >>> 0) % 10000) / 10000; }; }
  function playStep(t) {
    const T = THEME_MUSIC[musicTheme], bar = Math.floor(step / 16), s16 = step % 16, len = 60 / T.bpm / 4;
    const out = musicBus;
    // Drone on each bar: the root, plus a fifth once things heat up.
    if (s16 === 0) {
      tone(T.root / 2, t, len * 16 * 1.02, { type: T.drone.type, vol: T.drone.vol, cutoff: T.drone.cutoff, out });
      if (T.drone.beat) tone(T.root / 2 + T.drone.beat, t, len * 16, { type: 'sine', vol: T.drone.vol * 0.6, out });
      if (musicLevel > 0.45) tone(T.root * 0.75, t, len * 16, { type: T.drone.type, vol: T.drone.vol * 0.6, cutoff: T.drone.cutoff, out });
      if (bar % 2 === 0) { phraseSeed = (bar >> 1) % 4 + T.bpm; degree = 3; }
    }
    // Lead: sparse when calm, every eighth note in a fight, every sixteenth in a big battle.
    const every = musicLevel > 0.7 ? 1 : musicLevel > 0.35 ? 2 : 4;
    const rnd = seeded(phraseSeed * 64 + (step % 32));
    if (s16 % every === 0 && rnd() < (every === 4 ? 0.7 : 0.6)) {
      degree = Math.max(0, Math.min(T.scale.length * 2, degree + Math.round(rnd() * 4 - 2)));
      tone(hz(T, degree, T.lead.octave ?? 1), t, T.lead.dur, { type: T.lead.type, vol: T.lead.vol, cutoff: T.lead.cutoff, out });
      if (musicLevel > 0.7 && rnd() < 0.3) tone(hz(T, degree + 2, (T.lead.octave ?? 1) + 1), t, T.lead.dur * 0.6, { type: 'triangle', vol: T.lead.vol * 0.5, out });
    }
    // Drums: the downbeat always; the rest of the pattern once there's action.
    const hit = T.perc[s16];
    if (hit === 1 || (hit === 2 && musicLevel > 0.3)) {
      const v = hit === 1 ? 0.22 : 0.1;
      if (T.drum === 'hand') { burst(t, 0.08, { vol: v * 0.8, type: 'bandpass', freq: hit === 1 ? 300 : 900, q: 4, out }); tone(hit === 1 ? 140 : 300, t, 0.1, { vol: v * 0.7, to: hit === 1 ? 90 : 220, out }); }
      else { tone(hit === 1 ? 85 : 120, t, 0.22, { vol: v * 1.6, to: 45, out }); burst(t, 0.05, { vol: v * 0.5, freq: 700, out }); }
    }
    if (musicLevel > 0.6 && s16 % 2 === 1) burst(t, 0.03, { vol: 0.03, type: 'highpass', freq: 6000, out });
    // War drums (#69): a snare on the backbeat once the fighting is real, and a tom roll into every fourth bar
    // when it is fiercest.
    if (musicLevel > 0.5 && (s16 === 4 || s16 === 12)) { burst(t, 0.09, { vol: 0.07, type: 'bandpass', freq: 1900, q: 1.2, out }); tone(190, t, 0.07, { vol: 0.04, to: 150, out }); }
    if (musicLevel > 0.8 && bar % 4 === 3 && s16 >= 12) tone(150 - (s16 - 12) * 18, t, 0.16, { vol: 0.09, to: 70, out });
  }
  function schedule() {
    if (!ac || ac.state !== 'running' || !musicOn || muted) return;
    // Ease towards the target intensity so the music swells and settles rather than jumping.
    musicLevel += (musicTarget - musicLevel) * 0.03;
    musicBus.gain.value = musicGain() * (0.75 + 0.25 * musicLevel);
    if (nextAt < ac.currentTime) nextAt = ac.currentTime + 0.05;
    while (nextAt < ac.currentTime + 0.1) {
      playStep(nextAt);
      nextAt += 60 / THEME_MUSIC[musicTheme].bpm / 4;
      step++;
    }
  }
  function startMusic() {
    if (!ac || timer) return;
    musicBus = ac.createGain(); musicBus.gain.value = musicGain(); musicBus.connect(out);
    timer = setInterval(schedule, 25);
  }

  return {
    music: {
      get on() { return musicOn; },
      setOn(v) { musicOn = v; store.set('cs-music', v); if (musicBus) musicBus.gain.value = musicGain(); },
      setTheme(t) { if (THEME_MUSIC[t] && t !== musicTheme) { musicTheme = t; step = 0; nextAt = 0; } },
      setIntensity(x) { musicTarget = Math.max(0, Math.min(1, x)); },
    },
    unlock() { ensure(); if (ac && ac.state === 'suspended') ac.resume(); startMusic(); },
    get muted() { return muted; },
    setMuted(v) { muted = v; store.set('cs-muted', v); if (musicBus) musicBus.gain.value = musicGain(); },   // mute covers the music too
    // Volume channels: 'all', 'effects' or 'music', 0 to 1.
    volume(ch) { return vol[ch]; },
    setVolume(ch, v) {
      if (!(ch in vol)) return;
      vol[ch] = Math.max(0, Math.min(1, +v || 0));
      store.set('cs-volume', vol);
      if (out) out.gain.value = vol.all;
      if (master) master.gain.value = SFX_VOL * vol.effects;
      if (musicBus) musicBus.gain.value = musicGain();
    },
    drum() {
      if (!ready()) return;
      const t = ac.currentTime;
      [0, 0.13, 0.26].forEach((d, i) => {
        tone(i === 2 ? 95 : 120, t + d, 0.2, { vol: 0.55, to: 45 });
        burst(t + d, 0.07, { vol: 0.18, freq: 900 });
      });
    },
    // Each army sounds like itself (#69): ARMY_VOICE below gives the ring of its steel, its march and its cheer.
    clash(id) {
      if (!ready()) return;
      const t = ac.currentTime;
      if (t - lastClash < 0.08) return;
      lastClash = t;
      const V = ARMY_VOICE[id] || ARMY_VOICE.aldmere;
      burst(t, V.clash.dur, { vol: 0.12, type: 'bandpass', freq: V.clash.freq * (1 + Math.random() * 0.8), q: V.clash.q });
      tone(V.clash.ring * (1 + Math.random() * 0.5), t, 0.14, { type: V.clash.type, vol: 0.035 });
    },
    // A column of the player's sets off.
    march(id) {
      if (!ready()) return;
      const t = ac.currentTime;
      if (t - lastMarch < 0.25) return;
      lastMarch = t;
      const V = ARMY_VOICE[id] || ARMY_VOICE.aldmere;
      V.march.forEach((d, i) => {
        burst(t + d, 0.05, { vol: 0.07, type: 'bandpass', freq: V.step + i * 40, q: 3 });
        if (V.hoof) tone(V.step * 0.4, t + d, 0.05, { vol: 0.04, to: V.step * 0.3 });
      });
    },
    // A castle taken: a short call in the taker's voice, rising when it is yours and falling when it is lost.
    capture(id, mine) {
      if (!ready()) return;
      const t = ac.currentTime;
      if (t - lastCapture < 0.3) return;
      lastCapture = t;
      const V = ARMY_VOICE[id] || ARMY_VOICE.aldmere, notes = mine ? V.call : [...V.call].reverse();
      notes.forEach((f, i) => {
        tone(f, t + i * 0.13, i === notes.length - 1 ? 0.42 : 0.16, { type: V.horn, vol: 0.12, cutoff: 1500 });
        tone(f * 2, t + i * 0.13, 0.14, { type: 'triangle', vol: 0.035 });
      });
      burst(t, 0.18, { vol: 0.08, freq: 500 });
    },
    horn(won) {
      if (!ready()) return;
      const t = ac.currentTime, notes = won ? [196, 294] : [196, 147];
      notes.forEach((f, i) => {
        const d = i * 0.28, dur = i ? 0.55 : 0.3;
        tone(f, t + d, dur, { type: 'sawtooth', vol: 0.16, cutoff: 1100 });
        tone(f * 2, t + d, dur, { type: 'triangle', vol: 0.05 });
      });
    },
    power(mine) {
      if (!ready()) return;
      const t = ac.currentTime;
      const chord = mine ? [147, 220, 294] : [110, 131, 165];
      chord.forEach(f => tone(f, t, 1.3, { type: 'sawtooth', vol: 0.09, cutoff: mine ? 1600 : 700 }));
      burst(t, 0.6, { vol: 0.15, freq: 300 });
    },
    chime() {
      if (!ready()) return;
      const t = ac.currentTime;
      [880, 1320].forEach((f, i) => tone(f, t + i * 0.12, 0.5, { type: 'triangle', vol: 0.08 }));
    },
    fanfare(won) {
      if (!ready()) return;
      const t = ac.currentTime;
      const notes = won ? [[262, 0], [330, 0.16], [392, 0.32], [523, 0.5]] : [[220, 0], [196, 0.32], [175, 0.64], [131, 0.96]];
      notes.forEach(([f, d], i) => {
        const dur = i === notes.length - 1 ? 0.9 : 0.3;
        tone(f, t + d, dur, { type: 'sawtooth', vol: 0.14, cutoff: won ? 1800 : 900 });
        tone(f / 2, t + d, dur, { type: 'triangle', vol: 0.08 });
      });
    },
  };
})();
addEventListener('pointerdown', () => sfx.unlock());
addEventListener('keydown', () => sfx.unlock());
