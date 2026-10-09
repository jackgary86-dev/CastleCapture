// sfx.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Synthesised sound effects (no audio files). Browser only.

// ---------- sound (synthesised, no audio files) ----------
const sfx = (() => {
  let ac = null, master = null, noise = null, lastClash = 0;
  let muted = store.get('cs-muted', false);
  function ensure() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.45; master.connect(ac.destination);
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
    mire:   { bpm: 58,  root: 123.47, scale: [0, 1, 3, 6, 7, 10], lead: { type: 'sine', vol: 0.055, dur: 1.2 }, drone: { type: 'sine', vol: 0.05, beat: 1.8 }, perc: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], drum: 'low' },
  };
  let musicOn = store.get('cs-music', true), musicBus = null, musicTheme = 'vale', musicLevel = 0, musicTarget = 0;
  let step = 0, nextAt = 0, timer = 0, phraseSeed = 0, degree = 3;
  const MUSIC_VOL = 0.5;
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
  }
  function schedule() {
    if (!ac || ac.state !== 'running' || !musicOn) return;
    // Ease towards the target intensity so the music swells and settles rather than jumping.
    musicLevel += (musicTarget - musicLevel) * 0.03;
    musicBus.gain.value = MUSIC_VOL * (0.75 + 0.25 * musicLevel);
    if (nextAt < ac.currentTime) nextAt = ac.currentTime + 0.05;
    while (nextAt < ac.currentTime + 0.1) {
      playStep(nextAt);
      nextAt += 60 / THEME_MUSIC[musicTheme].bpm / 4;
      step++;
    }
  }
  function startMusic() {
    if (!ac || timer) return;
    musicBus = ac.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(ac.destination);
    timer = setInterval(schedule, 25);
  }

  return {
    music: {
      get on() { return musicOn; },
      setOn(v) { musicOn = v; store.set('cs-music', v); if (musicBus) musicBus.gain.value = v ? MUSIC_VOL : 0; },
      setTheme(t) { if (THEME_MUSIC[t] && t !== musicTheme) { musicTheme = t; step = 0; nextAt = 0; } },
      setIntensity(x) { musicTarget = Math.max(0, Math.min(1, x)); },
    },
    unlock() { ensure(); if (ac && ac.state === 'suspended') ac.resume(); startMusic(); },
    get muted() { return muted; },
    setMuted(v) { muted = v; store.set('cs-muted', v); },
    drum() {
      if (!ready()) return;
      const t = ac.currentTime;
      [0, 0.13, 0.26].forEach((d, i) => {
        tone(i === 2 ? 95 : 120, t + d, 0.2, { vol: 0.55, to: 45 });
        burst(t + d, 0.07, { vol: 0.18, freq: 900 });
      });
    },
    clash() {
      if (!ready()) return;
      const t = ac.currentTime;
      if (t - lastClash < 0.08) return;
      lastClash = t;
      burst(t, 0.11, { vol: 0.12, type: 'bandpass', freq: 2600 + Math.random() * 2400, q: 7 });
      tone(1700 + Math.random() * 900, t, 0.14, { type: 'triangle', vol: 0.035 });
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
