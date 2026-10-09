#!/usr/bin/env node
// Smoke test: loads every script the page loads, in the same order, into one shared context with
// stand-in browser objects, then plays a short battle through the UI and draws a frame.
// It fails on any exception, which catches what the balance test can't: load-order mistakes in the
// UI files (using a name before it is defined), two files declaring the same top-level name, and
// render or HUD code that throws.
//
//   node tools/smoke.js            # exit 0 when every phase runs cleanly
//
// The stand-ins are deliberately permissive: any property you read on a DOM element, the canvas
// context or a browser object returns another stand-in, so the test checks the game's own logic
// rather than the browser's.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(m => m[1]);
if (!scripts.length) fail('setup', 'index.html', new Error('no <script src> tags found'));

// ---------- stand-ins ----------
// A callable, endlessly nestable object: reading any property gives another stand-in, calling one
// returns a stand-in, and it converts to 0 or '' when used as a number or string.
const NUMERIC = { clientWidth: 1000, clientHeight: 640, offsetWidth: 1000, offsetHeight: 640, width: 1000, height: 640,
  innerWidth: 1000, innerHeight: 640, devicePixelRatio: 1, length: 0, scrollTop: 0, scrollLeft: 0 };
function stub(name = 'stub') {
  const store = {};
  const target = function () {};
  return new Proxy(target, {
    get(_, prop) {
      if (prop in store) return store[prop];
      if (prop === Symbol.toPrimitive) return hint => (hint === 'string' ? '' : 0);
      if (prop === Symbol.iterator) return function* () {};
      if (prop === 'then') return undefined;              // never look like a promise
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      if (typeof prop === 'string' && prop in NUMERIC) return NUMERIC[prop];
      if (prop === 'hidden' || prop === 'checked' || prop === 'disabled' || prop === 'matches') return false;
      if (prop === 'value' || prop === 'textContent' || prop === 'innerHTML' || prop === 'innerText') return '';
      return (store[prop] = stub(`${name}.${String(prop)}`));
    },
    set(_, prop, value) { store[prop] = value; return true; },
    apply() { return stub(`${name}()`); },
    construct() { return stub(`new ${name}`); },
  });
}

// Elements keep the properties the game sets on them (hidden, textContent, values), so the UI's own
// reads see what it wrote.
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, stub(`#${id}`));
  return elements.get(id);
};
const memoryStorage = () => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
};

const document = new Proxy(stub('document'), {
  get(t, prop) {
    if (prop === 'getElementById') return id => element(id);
    if (prop === 'hidden') return false;
    if (prop === 'visibilityState') return 'visible';
    if (prop === 'querySelectorAll' || prop === 'getElementsByClassName' || prop === 'getElementsByTagName') return () => [];
    return t[prop];
  },
});

const frames = [];
const sandbox = {
  console,
  document,
  localStorage: memoryStorage(),
  sessionStorage: memoryStorage(),
  navigator: stub('navigator'),
  location: stub('location'),
  history: stub('history'),
  screen: stub('screen'),
  performance: { now: () => clock },
  requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
  cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  queueMicrotask: fn => fn(),
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} }),
  getComputedStyle: () => stub('computedStyle'),
  getSelection: () => stub('selection'),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  MutationObserver: class { observe() {} disconnect() {} },
  Image: class { constructor() { return stub('Image'); } },
  Event: class { constructor(type) { this.type = type; } },
  CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } },
  KeyboardEvent: class { constructor(type, o) { Object.assign(this, o, { type }); } },
  PointerEvent: class { constructor(type, o) { Object.assign(this, o, { type }); } },
  innerWidth: 1000, innerHeight: 640, devicePixelRatio: 1,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
let clock = 0;
const ctx = vm.createContext(sandbox);

function fail(phase, where, err) {
  console.error(`Smoke test FAILED during ${phase}${where ? ` (${where})` : ''}:`);
  console.error(err && err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : String(err));
  process.exit(1);
}
const run = (phase, code, where) => {
  try { return vm.runInContext(code, ctx, { filename: where || phase }); } catch (err) { fail(phase, where, err); }
};

// ---------- 1. load every script, in page order, sharing one global scope ----------
for (const src of scripts) {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) fail('load', src, new Error('file listed in index.html does not exist'));
  run('load', fs.readFileSync(file, 'utf8'), src);
}

// ---------- 2. play a short battle through the same path the menu uses ----------
const step = (n, label) => run(label, `
  for (let i = 0; i < ${n}; i++) { if (!G || G.over) break; update(1 / 30); }
  hud(); draw(${clock});
`);
const battle = (cfg, label) => {
  run(label, `
    play(${JSON.stringify(cfg)});
    if (typeof startBattle === 'function') startBattle();
    G.ais.unshift({ id: 1, diff: 'hard', timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
  `);
  for (let s = 0; s < 6; s++) { clock += 1000; step(300, `${label}, update and draw`); }
  // A few queued animation frames, as the browser would run them.
  for (const fn of frames.splice(0, 3)) {
    clock += 16;
    try { fn(clock); } catch (err) { fail(`${label}, animation frame`, fn.name || 'requestAnimationFrame callback', err); }
  }
};
battle({ seed: 7, n: 18, diff: 'hard', armies: ['aldmere', 'kharzul'], map: 'aldmere' }, 'two-kingdom battle');
battle({ seed: 5, n: 19, diff: 'hard', armies: ['frostmark', 'solmara', 'nyx'], map: 'nyx' }, 'three-kingdom battle');

// ---------- 3. save, resume and the end screen ----------
run('save and resume', `
  if (typeof saveBattle === 'function') { saveBattle(); resumeBattle(); setPaused(false); }
  for (let i = 0; i < 60; i++) update(1 / 30);
  hud(); draw(${clock});
`);
run('end screen', `
  G.planets.forEach(p => { if (p.owner && p.owner !== 1) p.owner = 1; });
  G.packets = G.packets.filter(k => k.owner === 1);
  update(1 / 30); hud(); draw(${clock});
  if (!G.over) throw new Error('battle did not end after the player took every castle');
`);
// ---------- 4. a few waves of a Grand Campaign, if the mode is in the build ----------
const hasGrand = run('grand campaign check', `typeof startGrand === 'function'`);
if (hasGrand) {
  run('grand campaign start', `
    startGrand('realm', 'aldmere', 'hard');
    if (typeof startBattle === 'function') startBattle();
    if (G.mode !== 'grand' || G.phase !== 'plan') throw new Error('Grand Campaign did not open in its plan phase');
  `);
  run('grand campaign plan, march and draw', `
    for (let w = 0; w < 4; w++) {
      const mine = G.planets.filter(p => p.owner === 1), target = G.planets.find(p => p.owner !== 1);
      if (mine.length && target) {
        const before = mine[0].units;
        send(1, [mine[0]], target, 0.5);
        if (!G.orders.length) throw new Error('a plan-phase send did not queue an order');
        if (G.packets.some(k => k.owner === 1 && k.from === mine[0] && k.to === target)) throw new Error('a plan-phase send marched straight away');
        // Cancel and requeue, to exercise the refund.
        cancelOrder(G.orders[G.orders.length - 1]);
        if (Math.abs(mine[0].units - before) > 1e-9) throw new Error('cancelling an order did not return its troops');
        send(1, [mine[0]], target, 0.5);
      }
      hud(); draw(${clock});
      march();
      if (G.phase !== 'march') throw new Error('march() did not start the march window');
      for (let i = 0; i < 30 * GRAND.waveSeconds + 2 && G.phase === 'march'; i++) update(1 / 30);
      hud(); draw(${clock});
      if (G.over) break;
      if (G.phase !== 'plan') throw new Error('the march window did not end in a new plan phase');
    }
  `);
  run('grand campaign save slots', `
    if (!G.over) {
      if (!localStorage.getItem('cs-grand-0')) throw new Error('no Continue autosave after a wave');
      const mine = G.planets.find(p => p.owner === 1), target = G.planets.find(p => p.owner !== 1);
      send(1, [mine], target, 0.5);
      const wave = G.wave, left = mine.units, n = G.orders.length;
      if (!saveGrandSlot(3)) throw new Error('saving to slot 3 failed');
      march();
      for (let i = 0; i < 90; i++) update(1 / 30);
      if (!loadGrandSlot(3)) throw new Error('loading slot 3 failed');
      if (G.mode !== 'grand' || G.phase !== 'plan' || G.wave !== wave) throw new Error('slot 3 did not restore the wave and phase');
      if (G.orders.length !== n || G.orders[n - 1].from !== G.planets[mine.id]) throw new Error('queued orders did not survive a save and load');
      if (Math.abs(G.planets[mine.id].units - left) > 1e-9) throw new Error('garrisons did not survive a save and load');
      const text = localStorage.getItem('cs-grand-3');
      if (importGrandSave(text) !== '') throw new Error('importing an exported save failed');
      if (importGrandSave('{"v":1}') === '') throw new Error('a bad file was imported');
      deleteGrandSlot(3);
      if (localStorage.getItem('cs-grand-3')) throw new Error('deleting slot 3 left it behind');
      setPaused(false);
      hud(); draw(${clock + 500});
    }
  `);
}
run('back to menu', `toMenu(); for (let i = 0; i < 30; i++) update(1 / 30); hud(); draw(${clock});`);

console.log(`Smoke test passed: ${scripts.length} scripts loaded (${scripts.join(', ')}), two battles played, saved, resumed and finished${hasGrand ? ', and four Grand Campaign waves planned, marched, saved and loaded' : ''}.`);
