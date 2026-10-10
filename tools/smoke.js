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
// ---------- 3a. progression (#70): the win paid renown; buy a banner, a roof and a starting unit ----------
if (run('progression check', `typeof buyUnlock === 'function'`)) run('progression', `{
  if (!lastRenown || !(lastRenown.total > 0)) throw new Error('winning a battle paid no renown');
  if (!document.getElementById('endRenown') || document.getElementById('endRenown').hidden) throw new Error('the end screen does not show the renown');
  const before = career.renown;
  career.renown += 400;
  for (const id of ['banner-pennant', 'roof-gilded', 'unit-ballista']) if (!buyUnlock(id)) throw new Error('could not buy ' + id);
  if (career.renown !== before + 400 - 40 - 60 - 150) throw new Error('buying did not charge the right renown');
  if (buyUnlock('roof-gilded')) throw new Error('bought the same unlock twice');
  if (playerBannerShape() !== 'pennant' || playerRoofCol('#000') !== '#d4a537') throw new Error('the skins are not in use');
  // A fresh skirmish starts with the Ballista Tower beside home, as the battle's one map unit.
  play({ diff: 'medium', n: 12, map: 'aldmere', armies: ['aldmere', 'kharzul'], seed: 7 });
  if (typeof startBattle === 'function') startBattle();
  if (!G.units.some(u => u.owner === 1 && u.type === 'ballista') || !G.bought.has(1)) throw new Error('no starting map unit');
  for (let i = 0; i < 30; i++) update(1 / 30);
  hud(); draw(${clock});
  // Switched off, the next skirmish starts without it; the realm bonus follows a claimed region.
  career.useUnit = false;
  play({ diff: 'medium', n: 12, map: 'aldmere', armies: ['aldmere', 'kharzul'], seed: 8 });
  if (G.units.some(u => u.owner === 1)) throw new Error('the starting unit ignored its switch');
  career.useUnit = true;
  career.regions.realm = { army: 'aldmere', diff: 'hard', at: Date.now() };
  if (realmBonus() !== REALM_BONUS.perRegion) throw new Error('a claimed region gave no realm bonus');
  newSeason();
  if (Object.keys(career.regions).length || !career.hall.length) throw new Error('a new season did not move the map to the hall of fame');
  if (importProfile('{"v":1}') === '' || importProfile(JSON.stringify(career)) !== '') throw new Error('profile import accepted a bad file or refused a good one');
  document.getElementById('btnProfile').click();
  if (document.getElementById('profileOv').hidden) throw new Error('the profile page did not open');
  document.getElementById('profClose').click();
  toMenu();
}`);
// ---------- 3a2. smarter lords (#68): a coalition against a runaway leader, and a grudge said aloud ----------
if (run('smarter lords check', `typeof mindTick === 'function'`)) run('smarter lords', `{
  play({ diff: 'hard', n: 15, map: 'aldmere', armies: ['aldmere', 'kharzul', 'solmara'], seed: 21 });
  if (typeof startBattle === 'function') startBattle();
  G.intro = false; G.paused = false;
  for (let i = 0; i < 30; i++) update(1 / 30);
  // The player snowballs past 40% of every troop on the map.
  G.time = AI_MIND.coalitionAfter + 1;
  for (const p of G.planets) if (p.owner === 1) p.units += 400;
  mindTick(0.1);
  const C = G.mind.coalition;
  if (!C || C.against !== 1 || !allied(2, 3)) throw new Error('no coalition formed against a 40%+ leader');
  if (!G.pacts.some(p => p.coalition)) throw new Error('the coalition truce is missing');
  hud(); draw(${clock});
  // A save and resume keeps the coalition and its grudges.
  for (let i = 0; i < 3; i++) emit('capture', { o: 1, was: 2, castle: G.planets[0] });
  const said = [];
  on('taunt', e => { if (e.kind === 'grudge') said.push(e.o); });
  mindTick(0.1);
  if (!said.includes(2)) throw new Error('a lord with a grudge against the player said nothing');
  if (typeof saveBattle === 'function') {
    saveBattle(); resumeBattle(); setPaused(false);
    if (!G.mind.coalition || !(G.mind.grudges[2][1] >= AI_MIND.grudgeSay - 0.1)) throw new Error('grudges or the coalition were lost on resume');
  }
  // Once the leader is cut down, the coalition breaks up.
  for (const p of G.planets) if (p.owner === 1) p.units = 1;
  mindTick(0.1);
  if (G.mind.coalition || allied(2, 3)) throw new Error('the coalition outlived the threat');
  // With the smarter lords switched off, nothing forms.
  G.cfg.aiMind = false; G.mind.coalCool = 0;
  for (const p of G.planets) if (p.owner === 1) p.units += 400;
  mindTick(0.1);
  if (G.mind.coalition) throw new Error('cfg.aiMind = false did not switch the coalition off');
  toMenu();
}`);
// ---------- 3a3. alternate lords (#71): buy one, pick it on the army card, and play a battle with it ----------
if (run('alternate lords check', `typeof LORDS_ALT === 'object' && typeof pickLordAlts === 'function'`)) run('alternate lords', `{
  career.renown += 500;
  if (!buyUnlock('lord-aldmere') || !buyUnlock('lord-kharzul')) throw new Error('could not buy an alternate lord');
  if (!ownsLord('aldmere') || career.lordPick.aldmere !== 'alt') throw new Error('a bought lord did not take the seat');
  // The army card offers the choice once the lord is owned.
  myArmy = 'aldmere'; renderArmies();
  if (!document.getElementById('dossier').innerHTML.includes('data-lordpick')) throw new Error('the army card has no lord choice');
  setLordPick('aldmere', false);
  if (pickLordAlts({ armies: ['aldmere', 'kharzul'] })[0]) throw new Error('picking the base lord did not stick');
  setLordPick('aldmere', true);
  play({ diff: 'medium', n: 12, map: 'aldmere', armies: ['aldmere', 'kharzul'], seed: 31, lordAlt: [true, true] });
  if (typeof startBattle === 'function') startBattle();
  if (lordOf(1).short !== 'Corwin' || lordOf(2).short !== 'Ilkai' || lordStyle(2) !== 'nyx') throw new Error('the alternate lords are not seated');
  if (lordAi(2) !== LORDS_ALT.kharzul.ai) throw new Error('the alternate lord does not think with its own personality');
  // The rival speaks the alternate's lines, with the alternate's portrait.
  emit('taunt', { o: 2, kind: 'capture', force: true });
  const said = document.getElementById('taunt') ? document.getElementById('taunt').textContent : '';
  if (said && !LORDS_ALT.kharzul.lines.capture.some(l => said.includes(l))) throw new Error('the rival did not speak the alternate lord lines');
  for (let i = 0; i < 300; i++) update(1 / 30);
  hud(); draw(${clock});
  // Its power twist: Ilkai's Blood Moon lasts 1.4 times as long.
  G.pw[2].ready = 0; usePower(2);
  if (Math.abs((G.pw[2].until - G.time) - ARMIES.kharzul.power.dur * 1.4) > 1e-6) throw new Error('the power twist did not apply');
  if (typeof saveBattle === 'function') { saveBattle(); resumeBattle(); setPaused(false); if (lordOf(2).short !== 'Ilkai') throw new Error('the alternate lord was lost on resume'); }
  toMenu();
}`);
// ---------- 3b. King of the Hill (#64): a short race, saved and resumed, then won and lost by points ----------
const hasHill = run('king of the hill check', `typeof startHill === 'function'`);
if (hasHill) {
  run('king of the hill race', `{
    Math.random = mulberry(${(+process.env.SMOKE_SEED || 1) * 7 + 3});
    startHill('aldmere', 2, 'hard');
    if (typeof startBattle === 'function') startBattle();
    if (G.mode !== 'hill' || !G.hill) throw new Error('King of the Hill did not start in its own mode');
    const keep = G.planets[G.hill.id];
    if (!keep || !keep.hill || keep.owner !== 0) throw new Error('no unclaimed crowned keep on the map');
    if (Math.hypot(keep.x - G.w / 2, keep.y - G.h / 2) > 1) throw new Error('the crowned keep is not at the centre of the map');
    if (upgradeCost(keep, 'walls') !== null) throw new Error('the crowned keep can be upgraded');
    if (G.planets.filter(p => p.seat).length !== G.owners.length) throw new Error('every kingdom should have one seat');
    G.ais.unshift({ id: 1, diff: 'hard', timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    for (let s = 0; s < 4; s++) { for (let i = 0; i < 30 * 25 && !G.over; i++) update(1 / 30); hud(); draw(${clock}); }
    if (G.over) throw new Error('the race ended within its first 100 seconds');
    if (G.owners.some(o => !G.planets.some(p => p.seat && p.owner === o))) throw new Error('a seat was taken');
    const scored = G.owners.reduce((a, o) => a + G.hill.score[o], 0);
    if (scored > G.time + 1e-6) throw new Error('more points were scored than seconds have passed');
    // Save and resume keep the race.
    const before = JSON.stringify(G.hill);
    saveBattle(); resumeBattle(); setPaused(false);
    if (G.mode !== 'hill' || JSON.stringify(G.hill) !== before) throw new Error('the race did not survive a save and resume');
    if (!G.planets[G.hill.id].hill || !G.planets.some(p => p.seat)) throw new Error('the keep or the seats were lost on resume');
    // A rival on the hill one breath from the goal wins it, and the player loses.
    const rival = G.owners[1], k2 = G.planets[G.hill.id];
    k2.owner = rival; k2.units = 200; G.hill.score[rival] = HILL.goal - 0.5;
    for (let i = 0; i < 60 && !G.over; i++) update(1 / 30);
    if (!G.over || G.hill.winner !== rival || G.won !== false) throw new Error('a rival reaching the goal did not end the race with a defeat');
    if (G.hill.reachedAt == null) throw new Error('the goal time was not recorded');
    hud(); draw(${clock});
  }`);
  run('king of the hill win and time cap', `{
    startHill('kharzul', 1, 'medium');
    if (typeof startBattle === 'function') startBattle();
    const keep = G.planets[G.hill.id];
    keep.owner = 1; keep.units = 200; G.hill.score[1] = HILL.goal - 0.2;
    for (let i = 0; i < 30 && !G.over; i++) update(1 / 30);
    if (!G.over || G.hill.winner !== 1 || G.won !== true) throw new Error('reaching the goal did not win the race');
    if (!(ach.rec.hillBest.kharzul > 0)) throw new Error('no best time to the goal recorded for the army');
    hud(); draw(${clock});
    // Nobody at the goal when the clock runs out: the most points wins.
    startHill('nyx', 2, 'easy');
    if (typeof startBattle === 'function') startBattle();
    G.hill.score[1] = 40; G.hill.score[2] = 120; G.hill.score[3] = 80;
    G.time = HILL.cap - 0.05;
    for (let i = 0; i < 10 && !G.over; i++) update(1 / 30);
    if (!G.over || G.hill.winner !== 2 || G.won !== false) throw new Error('the time cap did not hand the race to the most points');
    hud(); draw(${clock});
  }`);
}
// ---------- 4. a few waves of a Grand Campaign, if the mode is in the build ----------
// Grand Campaigns start on a random seed and the AI lords roll dice, so seed Math.random first (as
// tools/balance.js does) to make every run play the same campaign. SMOKE_SEED picks another one.
const SEED = +process.env.SMOKE_SEED || 1;
const hasGrand = run('grand campaign check', `typeof startGrand === 'function'`);
if (hasGrand) {
  run('grand campaign start', `
    Math.random = mulberry(${SEED});
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
// ---------- 5. the map monsters (#48, #50): a wave on every map, then a save and load with the monster hurt ----------
// and troops marching on it, so its health, the damage tally and the columns' targets survive a load.
if (hasGrand) {
  const maps = run('grand maps', `Object.keys(GRAND_MAPS)`);
  // Braces keep each script's consts out of the shared context.
  maps.forEach((map, m) => run(`Grand Campaign on ${map}`, `{
    Math.random = mulberry(${SEED * 100 + m});
    startGrand('${map}', 'aldmere', 'hard');
    if (typeof startBattle === 'function') startBattle();
    G.ais.unshift({ id: 1, diff: 'hard', timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    for (let w = 0; w < 2; w++) { march(); for (let i = 0; i < 600; i++) update(1 / 30); hud(); draw(${clock}); }
    if (!G.monster) throw new Error('map ${map} has no monster');
    const c = G.monster.creatures[0];
    c.hp = Math.round(c.maxHp * 0.2); c.dmg = { 2: c.maxHp * 0.5, 3: c.maxHp * 0.3 };
    send(1, G.planets.filter(p => p.owner === 1), c, 0.5);
    march();
    for (let i = 0; i < 30; i++) update(1 / 30);
    const marching = G.packets.filter(k => k.to === c).length, hpAt = c.hp;
    if (!saveGrandSlot(4)) throw new Error('saving the campaign failed');
    for (let i = 0; i < 60; i++) update(1 / 30);
    if (!loadGrandSlot(4)) throw new Error('loading the campaign failed');
    setPaused(false);
    const r = G.monster.creatures[0];
    if (!r || Math.abs(r.hp - hpAt) > 0.01 || !r.dmg[2]) throw new Error('monster health or damage tally lost on load');
    if (G.phase === 'plan') march();
    for (let i = 0; i < 5; i++) update(1 / 30);
    if (marching && !G.packets.some(k => k.to === r)) throw new Error('columns lost their monster target on load');
    // A few more waves: the lords swarm a monster this low, and the kill schedules its return.
    // The player's seat sent half of every garrison at the monster and can fall to the rival lords meanwhile;
    // as in tools/balance.js, the other lords play on rather than the campaign ending.
    for (let w = 0; w < 6 && !r.dead; w++) {
      G.over = false;
      if (G.phase === 'plan') march();
      for (let i = 0; i < 700 && !r.dead; i++) { G.over = false; update(1 / 30); }
    }
    if (!r.dead) throw new Error('a monster at a fifth of its health was not finished off within six waves');
    if (G.monster.creatures.every(x => x.dead) && G.monster.respawnWave === null) throw new Error('no respawn scheduled after the kill');
    deleteGrandSlot(4);
    hud(); draw(${clock});
  }`));
}
// ---------- 6. Siege Defense (#65): three waves through the menu path, a save and resume, then the fall ----------
const hasDefense = run('siege defense check', `typeof startDefense === 'function'`);
if (hasDefense) {
  run('siege defense start', `{
    Math.random = mulberry(${SEED});
    startDefense(false);
    startBattle();
    if (G.mode !== 'defense' || G.def.phase !== 'break') throw new Error('Siege Defense did not open in a break before wave 1');
    if (G.planets.filter(p => p.owner === 1).length !== 5) throw new Error('the fortress is not five castles');
    if (G.planets.filter(p => p.camp).length !== 3) throw new Error('there are not three siege camps');
    hud(); draw(${clock});
  }`);
  run('siege defense waves', `{
    // The player's seat is played by the hard AI so the fortress is defended; the first three waves must be beaten.
    G.ais.unshift({ id: 1, diff: 'hard', timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    let saved = false;
    for (let i = 0; i < 30 * 400 && G.def.held < 3 && !G.over; i++) {
      update(1 / 30);
      if (i % 150 === 0) { hud(); renderTreasury(); draw(${clock}); }
      // Mid-wave 2: save, resume and play on, so the wave state survives a reload.
      if (!saved && G.def.wave === 2 && G.def.phase === 'wave') {
        saved = true;
        const wave = G.def.wave, attackers = G.packets.filter(k => k.owner !== 1).length;
        saveBattle(); resumeBattle(); setPaused(false);
        if (G.mode !== 'defense' || G.def.wave !== wave || G.def.phase !== 'wave') throw new Error('the wave did not survive a save and resume');
        if (G.packets.filter(k => k.owner !== 1).length !== attackers) throw new Error('attacking columns lost on resume');
        G.ais.unshift({ id: 1, diff: 'hard', timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
      }
    }
    if (G.over || G.def.held < 3) throw new Error('the fortress did not hold three waves (held ' + G.def.held + ')');
    if (G.def.score !== G.def.held + G.planets.filter(p => p.owner === 1).length) throw new Error('score is not waves held + castles held');
    if (!G.def.plan || G.def.plan.wave !== G.def.wave + 1) throw new Error('no plan for the next wave during the break');
    // Coins buy walls between waves, and the Next wave button's call starts the wave early.
    const p = G.planets.find(q => q.owner === 1), w0 = lvl(p, 'walls');
    G.coins[1] = 500;
    if (!defenseBuyUpgrade(1, p, 'walls') || lvl(p, 'walls') !== w0 + 1) throw new Error('coins did not buy a Walls level');
    sel.clear(); sel.add(p); hud();
    if (!defenseCallWave()) throw new Error('could not call the next wave early');
    update(1 / 30);
    if (G.def.phase !== 'wave' || G.def.wave !== 4) throw new Error('calling the wave did not start wave 4');
    if (!G.packets.some(k => k.owner !== 1 && k.type === 'siege')) throw new Error('wave 4 brought no catapults');
    sel.clear(); hud(); draw(${clock});
  }`);
  run('siege defense end', `{
    // Every lord hurls an overwhelming column at each castle: the last one falls and the game ends with a score.
    G.ais = [];
    const locked = G.def.score, camps = G.planets.filter(p => p.camp);
    for (const p of G.planets.filter(q => q.owner === 1)) launch(camps[0].owner, camps[0], p, 2000, 'foot');
    for (let i = 0; i < 30 * 120 && !G.over; i++) { update(1 / 30); if (i % 300 === 0) { hud(); draw(${clock}); } }
    if (!G.over) throw new Error('the game did not end when the last castle fell');
    if (G.planets.some(p => p.owner === 1)) throw new Error('the game ended with castles still held');
    if (G.def.score !== locked || G.def.score < 3) throw new Error('the final score is not the score after the last wave beaten');
    if (document.getElementById('endTitle').textContent !== 'The fortress has fallen') throw new Error('no Siege Defense end screen');
    hud(); draw(${clock});
  }`);
  run('siege defense daily', `{
    startDefense(true);
    startBattle();
    const day = defenseDay();
    if (!G.cfg.daily || G.cfg.seed !== defenseDailySeed(day)) throw new Error('the daily siege is not on the seed of the day');
    const lords = G.cfg.armies.join();
    startDefense(true);
    if (G.cfg.armies.join() !== lords) throw new Error('the daily siege drew different lords on a replay');
    startBattle();
    G.planets.forEach(p => { if (p.owner === 1) p.owner = 0; });
    update(1 / 30);
    if (!G.over) throw new Error('the daily siege did not end');
    const rec = store.get('cs-defense-daily', {})[day];
    if (!rec || rec.score !== 0) throw new Error('the daily score was not stored');
  }`);
}
// ---------- 7. Capture the Crown (#66): hide, scout, move (saved and resumed mid-move), seize and win; then lose a crown on the road ----------
const hasCrown = run('capture the crown check', `typeof startCrown === 'function'`);
if (hasCrown) {
  run('capture the crown start, hide and scout', `{
    Math.random = mulberry(${SEED * 13 + 5});
    startCrown('aldmere', 1, 'hard');
    startBattle();
    if (G.mode !== 'crown' || !G.crown || !G.cfg.fog) throw new Error('Capture the Crown did not start in its own mode under fog');
    if (UNIT_IDS.includes('scout') || !UNIT_TYPES.scout) throw new Error('scouts should be a troop type outside the T cycle');
    for (const o of G.owners) if (G.crown.at[o] !== G.planets.find(p => p.owner === o).id) throw new Error('a crown did not start in its seat');
    // The lords stand aside so the test controls the board; each rival's crown stays in its seat.
    G.ais = [];
    for (const o of G.owners) G.crown.picked[o] = true;
    const seat = G.planets[G.crown.at[1]];
    seat.units = 120;
    // Hiding is free and instant in the opening.
    const keep = G.planets.filter(p => p.owner === 0).sort((a, b) => dist(a, seat) - dist(b, seat))[0];
    keep.owner = 1; keep.units = 30;
    const coins = G.coins[1];
    if (!crownMove(1, keep) || G.crown.at[1] !== keep.id || G.coins[1] !== coins || crownCarrier(1)) throw new Error('hiding the crown in the opening was not free and instant');
    if (!crownMove(1, seat) || G.crown.at[1] !== seat.id) throw new Error('could not hide the crown back in the seat');
    hud(); draw(${clock});
    // When the hiding time runs out, reports from the opening are dropped (crowns may have moved since).
    G.crown.intel[1][G.crown.at[2]] = { crown: 2, t: 1 };
    G.time = CROWN.hideTime - 0.01;
    for (let i = 0; i < 3; i++) update(1 / 30);
    if (!G.crown.hidden || G.crown.intel[1][G.crown.at[2]]) throw new Error('a report from the opening outlived the hiding time');
    // Scouts look inside a rival castle and report, without attacking it.
    const rival = G.planets[G.crown.at[2]], before = rival.owner;
    setUnitType('scout');
    sel.clear(); sel.add(seat);
    playerSend(rival);
    setUnitType('foot');
    const sc = G.packets.filter(k => k.owner === 1 && k.type === 'scout');
    if (sc.length !== 1 || sc[0].n !== CROWN.scoutTroops) throw new Error('scouts did not ride out as one small band');
    for (let i = 0; i < 30 * 30 && G.packets.some(k => k.type === 'scout'); i++) update(1 / 30);
    const rep = G.crown.intel[1][rival.id];
    if (!rep || rep.crown !== 2) throw new Error('the scouts did not report the crown they found');
    if (rival.owner !== before) throw new Error('scouts attacked the castle');
    if (G.crown.exposed[2] == null) throw new Error('the rival did not notice the scouts at its crown');
    hud(); draw(${clock});
  }`);
  run('capture the crown move, save and resume', `{
    const seat = G.planets[G.crown.at[1]], keep = G.planets.find(p => p.owner === 1 && p !== seat);
    G.time = Math.max(G.time, CROWN.hideTime + 1);
    G.coins[1] = 40; seat.units = 100;
    if (!crownMove(1, keep, 0.5)) throw new Error('could not move the crown');
    const k = crownCarrier(1);
    if (!k || G.crown.at[1] !== null || G.coins[1] !== 40 - CROWN.moveCost) throw new Error('the crown did not take the road for its price');
    for (let i = 0; i < 30 * 6; i++) update(1 / 30);
    hud(); draw(${clock});
    const t = crownCarrier(1).crown.t, n = crownCarrier(1).n;
    saveBattle(); resumeBattle(); setPaused(false);
    G.ais = [];
    const r = crownCarrier(1);
    if (G.mode !== 'crown' || !r || !r.hold || Math.abs(r.crown.t - t) > 1e-6 || r.n !== n || r.to !== G.planets[keep.id] || G.crown.at[1] !== null) throw new Error('the crown on the road did not survive a save and resume');
    if (G.crown.intel[1][G.crown.at[2]] == null) throw new Error('scout reports were lost on resume');
    for (let i = 0; i < 30 * (CROWN.moveTime + 1) && crownCarrier(1); i++) update(1 / 30);
    if (crownCarrier(1) || G.crown.at[1] !== keep.id) throw new Error('the crown did not reach its new castle after ' + CROWN.moveTime + ' seconds');
    hud(); updateCastlePanel(); draw(${clock});
  }`);
  run('capture the crown knockout and win', `{
    const home = G.planets[G.crown.at[1]];
    for (const o of [2]) {
      const c = G.planets[G.crown.at[o]], theirs = G.planets.filter(p => p.owner === o).length;
      launch(1, home, c, 3000, 'foot');
      for (let i = 0; i < 30 * 60 && !G.crown.out[o]; i++) update(1 / 30);
      if (!G.crown.out[o] || G.crown.out[o].by !== 1) throw new Error('taking the crown castle of ' + o + ' did not knock it out');
      if (G.planets.some(p => p.owner === o) || G.packets.some(k => k.owner === o)) throw new Error('a knocked-out realm kept castles or columns');
      if (theirs > 1 && !G.planets.some(p => p.prevOwner === o && p.owner === 0)) throw new Error('the castles of the knocked-out realm did not go neutral');
      hud(); draw(${clock});
    }
    if (!G.over || G.won !== true || G.crown.winner !== 1) throw new Error('the last crown standing did not win');
    if (document.getElementById('endTitle').textContent !== 'The last crown') throw new Error('no Capture the Crown end screen');
    if (!(ach.rec.crownWon >= 1) || !(ach.rec.crownsTaken >= 1)) throw new Error('the raid was not recorded');
  }`);
  run('capture the crown seized on the road', `{
    startCrown('kharzul', 1, 'medium');
    startBattle();
    G.ais = []; G.crown.picked[2] = true;
    const seat = G.planets[G.crown.at[1]], keep = G.planets.filter(p => p.owner === 0).sort((a, b) => dist(a, seat) - dist(b, seat))[0];
    keep.owner = 1; seat.units = 60;
    G.time = CROWN.hideTime + 1;
    if (!crownMove(1, keep, 0.25)) throw new Error('could not move the crown');
    const k = crownCarrier(1);
    for (let i = 0; i < 30 * 3; i++) update(1 / 30);
    // A rival column meets it on the road and wins.
    const foe = G.planets.find(p => p.owner === 2);
    G.packets.push({ owner: 2, from: foe, to: foe, n: 200, str: 1, type: 'foot', escort: false, delay: 0, phase: 0, path: [{ x: foe.x, y: foe.y }], wp: 0, jx: 0, jy: 0, x: k.x + 1, y: k.y + 1 });
    for (let i = 0; i < 30 && !G.over; i++) update(1 / 30);
    if (!G.crown.out[1] || G.crown.out[1].by !== 2 || !G.crown.out[1].road) throw new Error('destroying the crown column did not hand the crown to the rival');
    if (!G.over || G.won !== false) throw new Error('losing the crown did not end the raid in defeat');
    if (document.getElementById('endTitle').textContent !== 'Your crown is taken') throw new Error('no defeat screen for a lost crown');
    hud(); draw(${clock});
  }`);
}
// ---------- deeper strategy (#67): a branch, a cut-off castle, a hill, and a champion who falls and returns ----------
const hasStrategy = run('strategy check', `typeof strategyTick === 'function' && typeof specialise === 'function'`);
if (hasStrategy) {
  run('deeper strategy', `{
    play({ seed: 4242, n: 18, diff: 'medium', armies: ['aldmere', 'kharzul'], map: 'aldmere', strategy: { ...STRATEGY_ALL } });
    if (typeof startBattle === 'function') startBattle();
    G.intro = false; setPaused(false);
    for (let i = 0; i < 30; i++) update(1 / 30);
    if (!G.strat) throw new Error('a strategy battle has no G.strat');
    // Terrain: hills exist and defend 25% better.
    const hill = G.planets.find(p => p.high);
    if (!hill) throw new Error('no castle stands on a hill');
    G.cfg.strategy.terrain = false; const flat = defAt(hill); G.cfg.strategy.terrain = true;
    if (Math.abs(defAt(hill) / flat - STRATEGY.hillDef) > 1e-9) throw new Error('a hill does not add its defence');
    // A branch: two upgrade levels, enough troops, then Barracks trains 30% faster.
    const cap = G.planets[G.strat.capital[1]];
    cap.up = { walls: 1, barracks: 1 }; cap.units = 120; G.coins[1] = 100;
    if (!specialise(cap, 'barracks') || cap.spec !== 'barracks') throw new Error('the capital could not become a Barracks');
    if (specialise(cap, 'market')) throw new Error('a castle took a second branch');
    G.cfg.strategy.spec = false; const r0 = rate(cap); G.cfg.strategy.spec = true;
    if (Math.abs(rate(cap) / r0 - STRATEGY.spec.barracks.rate) > 1e-9) throw new Error('the Barracks branch does not speed training');
    // Supply: a castle far from the capital's chain trains at half speed.
    const hops = new Map([[cap.id, 0]]), q = [cap.id];
    while (q.length) { const id = q.shift(); for (const n of G.roadNext[id]) if (!hops.has(n)) { hops.set(n, hops.get(id) + 1); q.push(n); } }
    const far = G.planets.filter(p => !p.owner && hops.get(p.id) > STRATEGY.supplyHops).sort((a, b) => hops.get(b.id) - hops.get(a.id))[0];
    if (!far) throw new Error('no castle lies beyond the supply hops');
    far.owner = 1; far.units = 20; refreshSupply();
    if (suppliedAt(far)) throw new Error('a far castle with no chain behind it is still supplied');
    G.cfg.strategy.supply = false; const fed = rate(far); G.cfg.strategy.supply = true;
    if (Math.abs(rate(far) / fed - STRATEGY.cutOff) > 1e-9) throw new Error('a cut-off castle does not train at half speed');
    // Saved and resumed, the branch and the champion's whereabouts survive.
    saveBattle(); resumeBattle(); setPaused(false);
    const capR = G.planets[cap.id];
    if (capR.spec !== 'barracks' || !G.strat || G.strat.heroes[1].at !== cap.id) throw new Error('branch or champion lost on resume');
    // The champion rides with a big attack on a castle that holds, falls, and comes back.
    const foe = G.planets.filter(p => p.owner === 2).sort((a, b) => travel(capR, a) - travel(capR, b))[0];
    foe.units = 900; capR.units = 120;
    send(1, [capR], foe, 0.5);
    if (!G.packets.some(k => k.hero === 1) || G.strat.heroes[1].at !== null) throw new Error('the champion did not ride out');
    if (!G.packets.filter(k => k.owner === 1 && k.from === capR).every(k => k.str >= STRATEGY.heroStr - 1e-9)) throw new Error('the champion did not strengthen the attack');
    for (let i = 0; i < 30 * 120 && G.packets.some(k => k.hero === 1); i++) { foe.units = 900; update(1 / 30); }
    for (let i = 0; i < 5; i++) update(1 / 30);
    const H = G.strat.heroes[1];
    if (H.at !== null || H.back === null) throw new Error('the champion did not fall when the attack failed');
    G.time = H.back; update(1 / 30);
    if (H.at === null) throw new Error('the champion did not return');
    hud(); draw(${clock});
  }`);
}
run('back to menu', `toMenu(); for (let i = 0; i < 30; i++) update(1 / 30); hud(); draw(${clock});`);

console.log(`Smoke test passed: ${scripts.length} scripts loaded (${scripts.join(', ')}), two battles played, saved, resumed and finished${hasHill ? ', a King of the Hill race played, saved, resumed, lost, won and timed out' : ''}${hasGrand ? ', four Grand Campaign waves planned, marched, saved and loaded, with a monster hunted on every map' : ''}${hasDefense ? ', a Siege Defense played through three waves, a save and resume, and the fall of the last castle' : ''}${hasCrown ? ', a Capture the Crown raid hidden, scouted, moved through a save and resume, won by knockouts and lost on the road' : ''}${hasStrategy ? ', and a deeper-strategy battle with a branch, a cut-off castle, a hill and a champion who fell and returned' : ''}.`);
