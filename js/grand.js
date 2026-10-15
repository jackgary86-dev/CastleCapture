// grand.js
//
// The Grand Campaign's rules: the five-realm map and the wave loop. Like sim.js it has no DOM access,
// so the headless tools can load it; the planning screen, camera and save slots live in grand-ui.js.
//
// A wave has two phases. In the plan phase nothing moves: send(), usePower() and buyUnit() queue
// orders instead of acting (troops and coins are set aside as each order is queued, so garrisons
// show what is left). march() lets the AI lords plan, launches every order at once, and runs the
// simulation for GRAND.waveSeconds; then the next plan phase begins.

// ---------- the realm map ----------
// Five starting regions in a pentagon. Every neutral keep is placed once in a 72-degree sector and
// copied into the other four, so all five realms get the same map. Keeps are spread evenly by distance
// from the centre, which packs more of them into the middle than the rim. Rivers, bridges, forests,
// roads and scenery come from the same makeTerrain() and buildScenery() as the battle maps.
function genGrandMap(seed, cfg = {}) {
  const rnd = mulberry(seed);
  const R = GRAND.radius, W = R * 2 + 200, H = W, cx = W / 2, cy = H / 2;
  const n = cfg.n || GRAND.castles, NM = cfg.neutral ?? 1, START = cfg.start ?? GRAND.start;
  const theme = THEMES[(GRAND_MAPS[cfg.grandMap] || GRAND_MAPS.realm).theme];
  const SECTOR = Math.PI * 2 / 5, BASE = -Math.PI / 2;
  const playerAngles = [0, 1, 2, 3, 4].map(k => BASE + k * SECTOR);
  const starts = playerAngles.map(a => ({ x: cx + Math.cos(a) * R * 0.8, y: cy + Math.sin(a) * R * 0.8 }));
  const T = makeTerrain(rnd, theme, W, H, R, R, playerAngles, starts);
  const pts = [];
  const fits = (x, y, r) => Math.hypot(x - cx, y - cy) < R - r - 20 &&
    pts.every(p => Math.hypot(p.x - x, p.y - y) > p.r + r + 40) &&
    waterDist(T, { x, y }) > r + 22 &&
    T.forests.every(f => Math.hypot(f.x - x, f.y - y) > f.r * 0.55 + r);
  const garrison = r => Math.round((r * 0.45 + rnd() * r * 0.7) * NM);

  starts.forEach((st, k) => pts.push({ ...st, r: 28, owner: k + 1, units: START }));
  // A big central keep, unless the map's rivers meet in a lake there.
  if (!T.lake) pts.push({ x: cx, y: cy, r: 36, owner: 0, units: Math.round(90 * NM) });
  const perSector = Math.max(1, Math.round((n - pts.length) / 5));
  let placed = 0, tries = 0;
  while (placed < perSector && tries++ < 8000) {
    const r = 13 + rnd() * 19, rr = 0.14 + rnd() * 0.82, a0 = rnd() * SECTOR;
    const copies = [0, 1, 2, 3, 4].map(k => {
      const a = BASE + a0 + k * SECTOR;
      return { x: cx + Math.cos(a) * R * rr, y: cy + Math.sin(a) * R * rr };
    });
    if (!copies.every(c => fits(c.x, c.y, r))) continue;
    if (!copies.every((c, i) => copies.every((d, j) => i === j || Math.hypot(c.x - d.x, c.y - d.y) > 2 * r + 40))) continue;
    const u = garrison(r);
    for (const c of copies) pts.push({ ...c, r, owner: 0, units: u });
    placed++;
  }
  const planets = pts.map((p, id) => ({ id, x: p.x, y: p.y, r: p.r, owner: p.owner, units: p.units }));
  return { planets, w: W, h: H, ...buildScenery(planets, T, theme, rnd, W, H, true) };
}

// ---------- the wave loop ----------
const isGrand = () => !!G && G.mode === 'grand';
const planning = () => isGrand() && G.phase === 'plan';

on('newGame', g => {
  if (g.cfg.mode !== 'grand') return;
  g.mode = 'grand';
  g.wave = 1;
  g.phase = 'plan';
  g.marchLeft = 0;
  g.orders = [];
});

// Each AI lord makes a few decisions per wave with its usual logic. Its orders are queued like the
// player's, and troops set aside by earlier orders aren't available to later ones, so a lord can't
// commit the same garrison twice.
// A lord's tempo carries over from battles: a quick thinker (thinkMul below 1, like Torvek) makes more
// decisions per wave, a slow one fewer, with the fraction settled by a dice roll so it averages out.
function planWave(ai) {
  const n = (GRAND.actionsPerWave[ai.diff] || 2) / lordAi(ai.id).thinkMul;
  const actions = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  for (let i = 0; i < actions; i++) aiThink(ai);
}

// Submit the wave: AI lords plan, every queued order launches, and the march window starts.
function march() {
  if (!planning() || G.over) return false;
  if (depthOn() && G.depth.offer) grantBoon(1, G.depth.offer.options[0]);   // an unanswered milestone card takes its first boon
  for (const ai of shuffle(G.ais)) planWave(ai);   // a new order each wave, so no lord always plans last
  const orders = G.orders;
  G.orders = [];
  G.phase = 'march';
  G.marchLeft = GRAND.waveSeconds;
  for (const o of orders) {
    if (o.kind === 'send') launch(o.owner, o.from, o.to, o.n, o.type, o.escort);
    else if (o.kind === 'power') { G.pw[o.owner].queued = false; usePower(o.owner); }
    else if (o.kind === 'unit') placeUnit(o.owner, o.type, o.x, o.y);
  }
  emit('wave', { wave: G.wave, phase: 'march', orders: orders.length });
  return true;
}

// Called from update() while marching; ends the window and opens the next plan phase.
function grandTick(dt) {
  if (G.phase !== 'march') return;
  G.marchLeft -= dt;
  if (G.marchLeft > 0 || G.over) return;
  G.phase = 'plan';
  G.wave++;
  if (typeof monstersWave === 'function') monstersWave();
  depthWave();
  emit('wave', { wave: G.wave, phase: 'plan' });
}

// ---------- depth (#95): regions, events, milestones, the chronicle ----------
// All of it lives in G.depth (plain ids and numbers, so it saves) and runs only when cfg.grandDepth is on.
const depthOn = () => isGrand() && G.cfg.grandDepth === true && G.depth;
const D = () => GRAND.depth;
// The five regions are the map's five sectors, one per starting realm; a castle's region is the sector it
// stands in. The central keep belongs to no region.
function regionOf(p) {
  const cx = G.w / 2, cy = G.h / 2;
  if (Math.hypot(p.x - cx, p.y - cy) < 60) return -1;
  const SECTOR = Math.PI * 2 / 5, BASE = -Math.PI / 2;
  let a = Math.atan2(p.y - cy, p.x - cx) - BASE;
  a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor((a + SECTOR / 2) / SECTOR) % 5;
}
const regionName = k => THEMES[ARMIES[G.fac[k + 1]].map].name;   // the homeland that starts there
const regionHolder = k => {
  const mine = G.planets.filter(p => regionOf(p) === k);
  if (!mine.length) return 0;
  const o = mine[0].owner;
  return o && mine.every(p => p.owner === o) ? o : 0;
};
// Training multiplier for castle p: a held region trains faster; a plagued one slower.
function depthRateMul(p) {
  if (!depthOn()) return 1;
  const k = regionOf(p), d = G.depth;
  let m = 1;
  if (k >= 0 && d.regions[k] && d.regions[k] === p.owner) m *= D().regionTrain;
  if (d.plague && d.plague.k === k && G.wave < d.plague.until) m *= D().plagueTrain;
  return m;
}
// Strike multiplier for realm o: a recruited champion rides with its columns for a while.
const depthStrikeMul = o => depthOn() && G.depth.champion && G.depth.champion.o === o && G.wave < G.depth.champion.until ? D().championStrike : 1;
function chron(text) { if (G.depth) G.depth.log.push({ wave: G.wave, text }); }
const realmName = o => o === 1 ? 'You' : lordOf(o).short;
on('newGame', g => {
  if (g.cfg.mode !== 'grand' || g.cfg.grandDepth !== true) return;
  g.depth = { regions: [0, 0, 0, 0, 0], log: [], plague: null, champKeep: null, champion: null, offer: null, boons: {}, lastEvent: 0, seen: {} };
});
// At the start of every plan phase: regions, then maybe an event, then a milestone.
function depthWave() {
  if (!depthOn()) return;
  const d = G.depth;
  for (let k = 0; k < 5; k++) {
    const h = regionHolder(k);
    if (h !== d.regions[k]) {
      const was = d.regions[k]; d.regions[k] = h;
      if (h) { chron(`${realmName(h)} took all of ${regionName(k)}.`); emit('region', { k, owner: h, was }); }
      else if (was) { chron(`${regionName(k)} slipped from ${realmName(was)}.`); emit('region', { k, owner: 0, was }); }
    }
  }
  if (d.plague && G.wave >= d.plague.until) { chron(`The plague in ${regionName(d.plague.k)} has passed.`); d.plague = null; }
  if (d.champion && G.wave >= d.champion.until) { chron(`${realmName(d.champion.o)}'s champion rode home.`); d.champion = null; }
  // Events: seeded by the map and the wave, one plan phase in eventEvery, never two waves running.
  const roll = mulberry(((G.cfg.seed | 0) * 131 + G.wave) | 0)();
  if (G.wave > 2 && G.wave - d.lastEvent >= 2 && roll < 1 / D().eventEvery) depthEvent(['plague', 'harvest', 'champion', 'migration'][Math.floor(roll * D().eventEvery * 4) % 4]);
  // Milestones: every surviving realm picks a boon; the lords at once, the player with a card.
  if (D().milestones.includes(G.wave) && !d.boons[G.wave]) {
    d.boons[G.wave] = {};
    const alive = G.owners.filter(o => G.planets.some(p => p.owner === o) && !G.surrendered.has(o));
    for (const o of alive) {
      if (human(o)) { d.offer = { wave: G.wave, options: boonOptions(o) }; emit('milestone', { wave: G.wave, options: d.offer.options }); continue; }
      const pick = { aldmere: 'walls', kharzul: 'power', frostmark: 'coins', solmara: 'truce', nyx: 'power' }[lordStyle(o)] || 'coins';
      grantBoon(o, pick);
    }
  }
}
function depthEvent(kind) {
  const d = G.depth; d.lastEvent = G.wave;
  if (kind === 'plague') {
    const held = [0, 1, 2, 3, 4].filter(k => d.regions[k]);
    const k = held.length ? held[Math.floor(mulberry((G.cfg.seed | 0) + G.wave * 7)() * held.length)] : Math.floor(mulberry((G.cfg.seed | 0) + G.wave * 7)() * 5);
    d.plague = { k, until: G.wave + D().plagueWaves };
    chron(`Plague in ${regionName(k)}: its castles train at half for ${D().plagueWaves} waves.`);
  } else if (kind === 'harvest') {
    // The harvest feeds the hungry: realms at or below the median strength.
    const alive = G.owners.filter(o => G.planets.some(p => p.owner === o)), tot = alive.map(totalOf).sort((a, b) => a - b), med = tot[tot.length >> 1] ?? 0;
    for (const o of alive) if (totalOf(o) <= med) G.coins[o] += D().harvestCoins;
    chron(`A good harvest: the lesser realms gain ${D().harvestCoins} coins.`);
  } else if (kind === 'champion') {
    const keeps = G.planets.filter(p => !p.owner && regionOf(p) >= 0);
    if (!keeps.length) return depthEvent('harvest');
    const keep = keeps[Math.floor(mulberry((G.cfg.seed | 0) + G.wave * 11)() * keeps.length)];
    d.champKeep = keep.id;
    chron(`A wandering champion waits at a keep in ${regionName(regionOf(keep))}: the first realm to take it gains their sword.`);
  } else if (kind === 'migration') {
    if (!G.monster || typeof spawnMonster !== 'function' || !G.monster.creatures.some(c => !c.dead)) return depthEvent('harvest');
    spawnMonster(mulberry((G.cfg.seed | 0) + G.wave * 13));
    chron(`${MONSTERS[G.monster.id].name.replace(/^the /, 'The ')} has moved to new hunting grounds.`);
  }
  emit('grandEvent', { kind, wave: G.wave });
}
// The champion joins whoever takes the marked keep (from arrive(), via the 'capture' event).
on('capture', ({ o, castle }) => {
  if (!depthOn() || G.depth.champKeep == null || castle.id !== G.depth.champKeep) return;
  G.depth.champKeep = null;
  G.depth.champion = { o, until: G.wave + D().championWaves };
  chron(`${realmName(o)} recruited the wandering champion: their columns strike harder for ${D().championWaves} waves.`);
  emit('champion', { o });
});
// Two boons a realm may choose at a milestone, from what would help it most.
function boonOptions(o) {
  const all = ['walls', 'coins', 'truce', 'power'];
  const strongest = G.owners.filter(q => q !== o && G.planets.some(p => p.owner === q)).sort((a, b) => totalOf(b) - totalOf(a))[0];
  const list = all.filter(b => b !== 'truce' || (strongest && typeof canPact === 'function' && canPact(o, strongest)));
  const roll = mulberry((G.cfg.seed | 0) + G.wave * 17 + o)();
  const i = Math.floor(roll * list.length);
  return [list[i], list[(i + 1) % list.length]];
}
const BOON_TEXT = { walls: 'Stone: a level of walls on every castle you hold', coins: `Gold: ${GRAND.depth.boonCoins} coins`, truce: `Peace: a truce with your strongest rival for ${GRAND.depth.boonTruceWaves} waves`, power: 'Fire: your special power, ready now' };
function grantBoon(o, kind) {
  const d = G.depth; if (!d) return false;
  d.boons[G.wave] = d.boons[G.wave] || {};
  if (d.boons[G.wave][o]) return false;
  d.boons[G.wave][o] = kind;
  if (kind === 'walls') { for (const p of G.planets) if (p.owner === o) { p.up = p.up || {}; if ((p.up.walls || 0) < UPGRADE.max) p.up.walls = (p.up.walls || 0) + 1; } }
  else if (kind === 'coins') G.coins[o] += D().boonCoins;
  else if (kind === 'truce') {
    const strongest = G.owners.filter(q => q !== o && G.planets.some(p => p.owner === q)).sort((a, b) => totalOf(b) - totalOf(a))[0];
    if (strongest && typeof makePact === 'function' && canPact(o, strongest)) { makePact(o, strongest); const p = pactOf(o, strongest); if (p) { p.until = G.time + D().boonTruceWaves * GRAND.waveSeconds; p.betrayAt = null; } }
  } else if (kind === 'power') G.pw[o].ready = 0;
  chron(`Wave ${G.wave} boon: ${realmName(o)} chose ${BOON_TEXT[kind].split(':')[0].toLowerCase()}.`);
  if (d.offer && d.offer.wave === G.wave && human(o)) d.offer = null;
  emit('boon', { o, kind, wave: G.wave });
  return true;
}
// Surrenders, betrayals and monster kills go in the chronicle too.
on('surrender', ({ o, heir }) => { if (depthOn()) chron(`${realmName(o)} surrendered${heir ? ` to ${realmName(heir)}` : ''}.`); });
on('pactEnd', ({ a, b, by }) => { if (depthOn() && by) chron(`${realmName(by)} broke the truce with ${realmName(by === a ? b : a)}.`); });
on('monster', e => { if (depthOn() && e.kind === 'slain') chron(`${realmName(e.o)} slew ${e.monster.name}${e.last ? '' : "'s creature"}.`); });
// The chronicle as plain text, for the end screen's export.
const chronicleText = () => !G.depth ? '' : G.depth.log.map(e => `Wave ${e.wave}: ${e.text}`).join('\n');

// Take back a queued order, returning the troops or coins it had set aside.
function cancelOrder(order) {
  const i = G.orders.indexOf(order);
  if (i < 0) return false;
  G.orders.splice(i, 1);
  if (order.kind === 'send' && order.from.owner === order.owner) order.from.units += order.n;
  else if (order.kind === 'power') G.pw[order.owner].queued = false;
  else if (order.kind === 'unit') { G.coins[order.owner] += MAP_UNITS[order.type].price; G.bought.delete(order.owner); }
  emit('order', { order, cancelled: true });
  return true;
}
