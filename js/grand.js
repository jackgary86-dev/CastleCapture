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
function planWave(ai) {
  const actions = GRAND.actionsPerWave[ai.diff] || 2;
  for (let i = 0; i < actions; i++) aiThink(ai);
}

// Submit the wave: AI lords plan, every queued order launches, and the march window starts.
function march() {
  if (!planning() || G.over) return false;
  for (const ai of G.ais) planWave(ai);
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
  emit('wave', { wave: G.wave, phase: 'plan' });
}

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
