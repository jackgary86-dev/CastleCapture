// sim.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Map generation, battle state, army stats and powers, the AI lords, coins and map units, and the simulation step. No DOM access: it reports through emit() and the headless balance runner loads it.

// ---------- terrain: rivers, bridges and forests ----------
const RIVER_W = 16;                        // river width, world units
const FOREST_SLOW = 0.6;                   // marching speed inside a forest
const FOREST_COST = 1 / FOREST_SLOW - 1;   // extra path cost per unit of forest crossed
const cross3 = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const segsCross = (a, b, c, d) =>
  (cross3(c, d, a) > 0) !== (cross3(c, d, b) > 0) && (cross3(a, b, c) > 0) !== (cross3(a, b, d) > 0);
function segDist(a, b, p) {
  const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
  return Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y);
}
function polyDist(pts, p) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segDist(pts[i], pts[i + 1], p));
  return m;
}
// Distance from a point to the nearest water (rivers or the central lake).
const waterDist = (T, p) => Math.min(...T.rivers.map(r => polyDist(r, p)), T.lake ? Math.hypot(p.x - T.lake.x, p.y - T.lake.y) - T.lake.r : Infinity);
const inForest = (T, p) => T.forests.some(f => Math.hypot(p.x - f.x, p.y - f.y) < f.r);
// Closest approach between two segments.
const segSegDist = (a, b, c, d) => segsCross(a, b, c, d) ? 0 : Math.min(segDist(a, b, c), segDist(a, b, d), segDist(c, d, a), segDist(c, d, b));
// True if a straight march would cross or wade along the water, rather than keep to the bank.
const BANK = RIVER_W / 2 + 4;
// River segments with their bounding boxes (grown by a bank's width), built once per map.
function riverSegs(T) {
  if (!T.segs) {
    T.segs = [];
    for (const r of T.rivers) for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      T.segs.push({ a, b, x0: Math.min(a.x, b.x) - BANK, x1: Math.max(a.x, b.x) + BANK, y0: Math.min(a.y, b.y) - BANK, y1: Math.max(a.y, b.y) + BANK });
    }
  }
  return T.segs;
}
function crossesWater(T, a, b) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  for (const g of riverSegs(T)) {
    // Skip river segments nowhere near this leg before doing the exact distance test.
    if (g.x1 < x0 || g.x0 > x1 || g.y1 < y0 || g.y0 > y1) continue;
    if (segSegDist(a, b, g.a, g.b) < BANK) return true;
  }
  return !!T.lake && segDist(a, b, T.lake) < T.lake.r + 6;
}
// Cost of marching one straight leg: its length, plus extra for the stretch through forest.
function legCost(T, a, b) {
  const len = dist(a, b);
  // Only forests the leg actually passes through matter.
  const near = T.forests.filter(f => segDist(a, b, f) < f.r);
  if (!near.length) return len;
  const n = Math.max(1, Math.ceil(len / 8));
  let wood = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (near.some(f => Math.hypot(x - f.x, y - f.y) < f.r)) wood++;
  }
  return len + FOREST_COST * len * wood / n;
}

// Rivers run from a central lake out to the map edge between every pair of neighbouring kingdoms,
// each crossed by two bridges. Forests sit in matching spots for every kingdom, so maps stay fair.
function makeTerrain(rnd, theme, W, H, RX, RY, playerAngles, starts) {
  const T = { rivers: [], lake: null, bridges: [], forests: [] };
  const cx = W / 2, cy = H / 2;
  if (theme.river) {
    T.lake = { x: cx, y: cy, r: 40 };
    const phase = rnd() * Math.PI * 2, amp = 12 + rnd() * 10;
    const sorted = [...playerAngles].sort((a, b) => a - b);
    const arms = sorted.map((a, i) => (a + (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2)) / 2);
    for (const a of arms) {
      let dx = Math.cos(a) * RX, dy = Math.sin(a) * RY;
      const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
      const px = -dy, py = dx;
      const at = s => {
        const w = amp * Math.sin(phase + s / 34) * Math.min(1, Math.max(0, (s - T.lake.r) / 70));
        return { x: cx + dx * s + px * w, y: cy + dy * s + py * w };
      };
      let edge = T.lake.r;
      while (cx + dx * edge > 0 && cx + dx * edge < W && cy + dy * edge > 0 && cy + dy * edge < H) edge += 4;
      const river = [];
      for (let s = T.lake.r * 0.6; s < edge + 40; s += 12) river.push(at(s));
      T.rivers.push(river);
      // Bridges sit at the same distances from the centre on every river, however long it runs to the map edge.
      const reach = Math.min(edge, Math.hypot(dx * RX, dy * RY));
      for (const f of [0.38, 0.76]) {
        const s = T.lake.r + (reach - T.lake.r) * f, c = at(s), a1 = at(s - 3), a2 = at(s + 3);
        let tx = a2.x - a1.x, ty = a2.y - a1.y;
        const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
        const half = RIVER_W / 2 + 7;
        T.bridges.push({ x: c.x, y: c.y, tx, ty, e1: { x: c.x - ty * half, y: c.y + tx * half }, e2: { x: c.x + ty * half, y: c.y - tx * half } });
      }
    }
  }
  if (theme.forest) {
    // Rotate a point around the map centre in the same squashed space the castles are laid out in.
    const rotE = (p, ang) => {
      const u = (p.x - cx) / RX, v = (p.y - cy) / RY, c = Math.cos(ang), s = Math.sin(ang);
      return { x: cx + (u * c - v * s) * RX, y: cy + (u * s + v * c) * RY };
    };
    const groups = playerAngles.length === 2 ? 3 : 2;
    for (let g = 0, tries = 0; g < groups && tries < 500; tries++) {
      const r = 38 + rnd() * 20, a = rnd() * Math.PI * 2, rr = 0.3 + rnd() * 0.62;
      const base = { x: cx + Math.cos(a) * RX * rr, y: cy + Math.sin(a) * RY * rr };
      const group = playerAngles.length === 2
        ? [base, { x: W - base.x, y: H - base.y }]
        : playerAngles.map((_, k) => rotE(base, k * 2 * Math.PI / playerAngles.length));
      const ok = group.every((p, i) =>
        p.x > r * 0.6 && p.x < W - r * 0.6 && p.y > r * 0.6 && p.y < H - r * 0.6 &&
        waterDist(T, p) > 12 &&
        starts.every(s => Math.hypot(s.x - p.x, s.y - p.y) > r + 70) &&
        T.forests.every(f => Math.hypot(f.x - p.x, f.y - p.y) > f.r + r + 20) &&
        group.every((q, j) => i === j || Math.hypot(q.x - p.x, q.y - p.y) > 2 * r + 20));
      if (!ok) continue;
      group.forEach(p => T.forests.push({ x: p.x, y: p.y, r }));
      g++;
    }
  }
  return T;
}

// Shortest march between every pair of castles: straight where possible, otherwise over bridges,
// and around forests when going round is quicker than pushing through.
function buildPaths(T, planets) {
  // Route nodes: both ends of every bridge, a step back from each end (so marches can leave the bank
  // where the river bends), and a ring around the lake. Only a bridge's own two ends may cross water.
  const ends = [];
  T.bridges.forEach((b, bi) => ends.push({ x: b.e1.x, y: b.e1.y, bi }, { x: b.e2.x, y: b.e2.y, bi }));
  const extra = [];
  for (const e of ends.slice()) {
    const b = T.bridges[e.bi], ux = (e.x - b.x) / dist(e, b), uy = (e.y - b.y) / dist(e, b);
    for (const out of [30, 60]) extra.push({ x: e.x + ux * out, y: e.y + uy * out });
  }
  if (T.lake) for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    extra.push({ x: T.lake.x + Math.cos(a) * (T.lake.r + 26), y: T.lake.y + Math.sin(a) * (T.lake.r + 26) });
  }
  extra.forEach((q, k) => { if (waterDist(T, q) > BANK + 2) ends.push({ x: q.x, y: q.y, bi: -1 - k }); });
  const E = ends.length, N = planets.length;
  const ee = ends.map(() => new Array(E).fill(0));
  for (let i = 0; i < E; i++) for (let j = i + 1; j < E; j++) {
    const a = ends[i], b = ends[j];
    ee[i][j] = ee[j][i] = a.bi === b.bi ? dist(a, b) : crossesWater(T, a, b) ? Infinity : legCost(T, a, b);
  }
  const ce = planets.map(p => ends.map(e => crossesWater(T, p, e) ? Infinity : legCost(T, p, e)));
  const paths = new Array(N * N);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const S = planets[i], D = planets[j];
    const direct = crossesWater(T, S, D) ? Infinity : legCost(T, S, D);
    // Nodes: 0 = start, 1 = destination, 2.. = bridge ends.
    const cost = (u, v) => {
      if (u === 0) return v === 1 ? direct : ce[i][v - 2];
      if (v === 1) return ce[j][u - 2];
      return ee[u - 2][v - 2];
    };
    const V = E + 2, best = new Array(V).fill(Infinity), prev = new Array(V).fill(-1), done = new Array(V).fill(false);
    best[0] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < V; k++) if (!done[k] && best[k] < Infinity && (u < 0 || best[k] < best[u])) u = k;
      if (u < 0 || u === 1) break;
      done[u] = true;
      for (let v = 1; v < V; v++) {
        if (done[v]) continue;
        const c = best[u] + cost(u, v);
        if (c < best[v]) { best[v] = c; prev[v] = u; }
      }
    }
    let pts, len;
    if (best[1] === Infinity) { pts = [{ x: D.x, y: D.y }]; len = dist(S, D); }
    else {
      pts = [];
      for (let v = 1; v > 0; v = prev[v]) pts.unshift(v === 1 ? { x: D.x, y: D.y } : { x: ends[v - 2].x, y: ends[v - 2].y });
      len = best[1];
    }
    paths[i * N + j] = { pts, len };
    paths[j * N + i] = { pts: [...pts.slice(0, -1).reverse(), { x: S.x, y: S.y }], len };
  }
  return paths;
}

// Marching routes, roads and the theme's scenery for a finished set of castles and terrain.
// Shared by the battle maps and the Grand Campaign map. With scaleCounts, scenery counts grow with
// the map's area; battle maps leave it off so they come out exactly as before.
function buildScenery(planets, T, theme, rnd, w, h, scaleCounts = false) {
  const area = scaleCounts ? Math.max(1, (w * h) / (1000 * 640)) : 1, meadowCount = Math.round(9 * area);
  if (scaleCounts) theme = { ...theme, pools: Math.round(theme.pools * area), trees: Math.round(theme.trees * area), rocks: Math.round(theme.rocks * area) };
  const clear = (x, y, pad) => planets.every(p => Math.hypot(p.x - x, p.y - y) > p.r + pad);
  const paths = buildPaths(T, planets);
  const N = planets.length;

  // Roads follow the marching routes between neighbouring castles, so they cross rivers at the bridges.
  const roads = [], seen = new Set();
  for (const a of planets) {
    planets.filter(b => b !== a).sort((b, c) => paths[a.id * N + b.id].len - paths[a.id * N + c.id].len).slice(0, 2).forEach(b => {
      const key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id);
      if (seen.has(key)) return;
      seen.add(key);
      const mid = paths[a.id * N + b.id].pts.slice(0, -1);
      roads.push({ a, b, pts: [{ x: a.x, y: a.y + a.r * 0.5 }, ...mid, { x: b.x, y: b.y + b.r * 0.5 }] });
    });
  }
  const meadows = Array.from({ length: meadowCount }, () => ({ x: rnd() * w, y: rnd() * h, rx: 80 + rnd() * 140, ry: 50 + rnd() * 90 }));
  const dry = (x, y, pad) => waterDist(T, { x, y }) > pad;
  const pools = [];
  for (let i = 0; i < 300 * area && pools.length < theme.pools; i++) {
    const x = 40 + rnd() * (w - 80), y = 40 + rnd() * (h - 80), rx = 18 + rnd() * 26;
    if (clear(x, y, rx + 24) && dry(x, y, rx + 14) && !inForest(T, { x, y })) pools.push({ x, y, rx, ry: rx * (0.45 + rnd() * 0.2) });
  }
  const trees = [];
  const plant = (x, y) => {
    if (x < 8 || y < 8 || x > w - 8 || y > h - 8 || !clear(x, y, 30) || !dry(x, y, 10)) return;
    if (theme.tree !== 'palm' && pools.some(o => Math.hypot((o.x - x) / o.rx, (o.y - y) / o.ry) < 1.2)) return;
    trees.push({ x, y, s: 5 + rnd() * 4, shade: rnd() });
  };
  // Forests are thick with trees; a few more grow scattered elsewhere.
  for (const f of T.forests) {
    for (let i = 0; i < Math.round(f.r * f.r / 70); i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (f.r - 4);
      plant(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d);
    }
  }
  const scattered = theme.forest ? Math.round(theme.trees * 0.3) : theme.trees;
  for (let i = 0, placed = trees.length; i < 600 * area && trees.length - placed < scattered; i++) {
    let x, y;
    if (theme.tree === 'palm' && pools.length) {
      // Palms grow around the oases.
      const o = pools[Math.floor(rnd() * pools.length)], a = rnd() * Math.PI * 2;
      x = o.x + Math.cos(a) * (o.rx + 6 + rnd() * 14); y = o.y + Math.sin(a) * (o.ry + 5 + rnd() * 10);
    } else {
      const base = trees.length > placed && rnd() < theme.clump ? trees[placed + Math.floor(rnd() * (trees.length - placed))] : { x: rnd() * w, y: rnd() * h };
      x = base.x + (rnd() - 0.5) * 60; y = base.y + (rnd() - 0.5) * 60;
      if (inForest(T, { x, y })) continue;
    }
    plant(x, y);
  }
  trees.sort((a, b) => a.y - b.y);
  const rocks = [];
  for (let i = 0; i < 300 * area && rocks.length < theme.rocks; i++) {
    const x = rnd() * w, y = rnd() * h;
    if (clear(x, y, 22) && dry(x, y, 8)) rocks.push({ x, y, s: 2 + rnd() * 3.5 });
  }
  return { roads, meadows, trees, pools, rocks, terrain: T, paths };
}

// ---------- map generation ----------
// opts: scale (map size multiplier), start (starting troops), neutral (unclaimed keep garrison multiplier).
function genMap(seed, n, players, portrait, theme, aiBonus = 0, opts = {}) {
  const rnd = mulberry(seed);
  const S = opts.scale ?? 1, START = opts.start ?? 40, NM = opts.neutral ?? 1;
  const [W, H] = (players >= 5 ? [1240, 900] : [1000, 640]).map(v => Math.round(v * S)), cx = W / 2, cy = H / 2;
  // Three or more kingdoms sit round a true circle: rotating around a squashed oval would leave one
  // kingdom further from everything.
  const [RX, RY] = (players === 2 ? [460, 320] : players >= 5 ? [400, 400] : [290, 290]).map(v => v * S);
  const playerAngles = players === 2 ? [Math.PI, 0] : Array.from({ length: players }, (_, k) => Math.PI + k * 2 * Math.PI / players);
  const starts = players === 2
    ? [{ x: 130, y: cy }, { x: W - 130, y: cy }]
    : playerAngles.map(a => ({ x: cx + Math.cos(a) * RX * 0.92, y: cy + Math.sin(a) * RY * 0.92 }));
  const T = makeTerrain(rnd, theme, W, H, RX, RY, playerAngles, starts);
  const pts = [];
  const fits = (x, y, r) => x - r > 40 && x + r < W - 40 && y - r * 1.3 > 30 && y + r * 1.3 < H - 30 &&
    pts.every(p => Math.hypot(p.x - x, p.y - y) > p.r + r + 34) &&
    waterDist(T, { x, y }) > r + 22 &&
    T.forests.every(f => Math.hypot(f.x - x, f.y - y) > f.r * 0.55 + r);
  const garrison = r => Math.round((r * 0.45 + rnd() * r * 0.7) * NM);
  const wet = T.rivers.length > 0;

  if (players === 2) {
    pts.push({ ...starts[0], r: 28, owner: 1, units: START });
    pts.push({ ...starts[1], r: 28, owner: 2, units: START + aiBonus });
    if (n % 2 === 1 && !wet) pts.push({ x: cx, y: cy, r: 32, owner: 0, units: Math.round(45 * NM) });
    let tries = 0;
    while (pts.length < n && tries++ < 4000) {
      const r = 13 + rnd() * 19, x = 60 + rnd() * (cx - 60), y = 50 + rnd() * (H - 100);
      const mx = W - x, my = H - y;
      if (Math.hypot(mx - x, my - y) < 2 * r + 34) continue;
      if (!fits(x, y, r) || !fits(mx, my, r)) continue;
      const u = garrison(r);
      pts.push({ x, y, r, owner: 0, units: u }, { x: mx, y: my, r, owner: 0, units: u });
    }
  } else {
    starts.forEach((s, k) => pts.push({ ...s, r: 26, owner: k + 1, units: k ? START + aiBonus : START }));
    if (!wet) pts.push({ x: cx, y: cy, r: 33, owner: 0, units: Math.round(60 * NM) });
    // Unclaimed castles are placed in matching sets, one per kingdom, rotated round the centre.
    const step = 2 * Math.PI / players;
    let tries = 0;
    while (pts.length < n && tries++ < 6000) {
      const r = 13 + rnd() * 17, a0 = rnd() * step, rr = 0.28 + rnd() * 0.7;
      const set = playerAngles.map((_, k) => { const a = a0 + k * step; return { x: cx + Math.cos(a) * RX * rr, y: cy + Math.sin(a) * RY * rr }; });
      const ok = set.every((p, i) => fits(p.x, p.y, r) && set.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 2 * r + 34));
      if (!ok) continue;
      const u = garrison(r);
      set.forEach(p => pts.push({ ...p, r, owner: 0, units: u }));
    }
  }
  // Portrait screens: rotate the map so the player starts at the bottom.
  const rot = p => portrait ? { x: p.y, y: W - p.x } : { x: p.x, y: p.y };
  const rotV = (vx, vy) => portrait ? [vy, -vx] : [vx, vy];
  const planets = pts.map((p, id) => ({ id, ...rot(p), r: p.r, owner: p.owner, units: p.units }));
  T.rivers = T.rivers.map(r => r.map(rot));
  if (T.lake) T.lake = { ...rot(T.lake), r: T.lake.r };
  T.bridges = T.bridges.map(b => { const [tx, ty] = rotV(b.tx, b.ty); return { ...rot(b), tx, ty, e1: rot(b.e1), e2: rot(b.e2) }; });
  T.forests = T.forests.map(f => ({ ...rot(f), r: f.r }));
  const w = portrait ? H : W, h = portrait ? W : H;
  return { planets, w, h, ...buildScenery(planets, T, theme, rnd, w, h) };
}

// ---------- game state ----------
let G = null;

// Builds a fresh battle from `cfg`. `portrait` rotates the map for tall screens; the UI decides it.
// Give about a quarter of the unclaimed keeps a special kind. genMap gives every mirrored copy of a keep the same
// size and garrison, so copies are grouped by those and always get the same kind, keeping the map fair.
function assignKinds(planets, seed) {
  const rnd = mulberry((seed ^ 0x5bd1e995) >>> 0);
  const groups = new Map();
  for (const p of planets) {
    if (p.owner) continue;
    const key = `${p.r.toFixed(3)}|${p.units}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const list = [...groups.values()];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const kinds = Object.keys(CASTLE_KINDS);
  const want = Math.round(planets.filter(p => !p.owner).length * KIND_SHARE);
  let given = 0, k = Math.floor(rnd() * kinds.length);
  for (const g of list) {
    if (given >= want) break;
    const kind = kinds[k++ % kinds.length];
    for (const p of g) p.kind = kind;
    given += g.length;
  }
}

function newGame(cfg, portrait = false) {
  const players = cfg.armies.length;
  const grand = cfg.mode === 'grand';
  const theme = grand ? THEMES[(GRAND_MAPS[cfg.grandMap] || GRAND_MAPS.realm).theme] : THEMES[ARMIES[cfg.map].map];
  const map = grand ? genGrandMap(cfg.seed, cfg)
    : genMap(cfg.seed, cfg.n, players, portrait, theme, cfg.aiBonus || 0, { scale: cfg.mapScale, start: cfg.start, neutral: cfg.neutral });
  assignKinds(map.planets, cfg.seed);
  // Story campaign setups (#27): a chosen starting garrison and castle kind for the player.
  for (const p of map.planets) if (p.owner === 1) {
    if (cfg.playerUnits != null) p.units = cfg.playerUnits;
    if (cfg.playerKind) p.kind = cfg.playerKind;
  }
  const owners = Array.from({ length: players }, (_, i) => i + 1);
  const aiIds = cfg.demo ? [1, 2] : owners.slice(1);
  G = {
    cfg, ...map, theme, packets: [], fx: [], time: 0, over: false, paused: false, owners,
    fac: Object.fromEntries(owners.map((o, i) => [o, cfg.armies[i]])),
    pw: Object.fromEntries(owners.map(o => [o, { ready: FIRST_CHARGE, until: -1 }])),
    ais: aiIds.map((id, i) => ({ id, diff: cfg.demo ? 'medium' : cfg.diff, timer: 1.4 + i * 0.35, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() })),
    caps: 0, peak: 0, hintDone: !!cfg.demo, portrait,
    intro: false, lastTaunt: -99, tauntAt: {}, nearDefeat: new Set(), maxCastles: {}, weakSince: {}, surrendered: new Set(),
    coins: Object.fromEntries(owners.map(o => [o, 0])), units: [], shots: [], bought: new Set(), placing: null,
    roadPts: roadSamples(map.roads), np: map.planets.length, rallyClock: 0, sight: {}, sightClock: 0,
    weather: { kind: 'clear', prev: 'clear', since: -WEATHER_FADE, until: WEATHER_FIRST },
    pacts: [], pactCool: {}, lastOffer: {}, offer: null, diploClock: 0,
    seen: Object.fromEntries(owners.map(o => [o, map.planets.map(p => ({ owner: p.owner, units: p.units }))])),
    history: [], events: [], nextSample: 0, stats: { sent: 0, roadLost: 0, castlesLost: 0, powerUses: 0 },
  };
  // Story objective (#27): the one enemy castle whose capture wins the chapter.
  G.mustTake = cfg.mustTake ? mustTakeCastle(cfg.mustTake) : null;
  emit('newGame', G);
}

function demoCfg() {
  const pair = shuffle(ARMY_IDS).slice(0, 2);
  return { demo: true, seed: Math.floor(Math.random() * 1e9), n: 18, diff: 'medium', armies: pair, map: pick(pair) };
}

// ---------- army stats and powers ----------
const army = o => ARMIES[G.fac[o]];
const pathOf = (a, b) => G.paths[a.id * G.np + b.id];
// Marching distance between two castles, counting bridges and the slow going through forests.
const travel = (a, b) => a === b ? 0 : pathOf(a, b).len;
const col = o => o ? army(o).color : NEUTRAL;
const powerOn = (o, id) => o && army(o).power.id === id && G.time < G.pw[o].until;
const atkOf = o => army(o).stats.atk * (powerOn(o, 'bloodMoon') ? 1.5 : 1);
const defOf = o => o ? army(o).stats.def * (powerOn(o, 'stoneOath') ? 2 : 1) : 1;
const speedOf = o => SPEED * (G.cfg.speedMul ?? 1) * army(o).stats.speed * (powerOn(o, 'bloodMoon') ? 2 : 1) * weatherMul(o, 'speed');
const rechargeTime = () => G.cfg.recharge ?? RECHARGE;
const roadOf = o => atkOf(o) * army(o).stats.road;
// Amaru, as an AI rival, bribes the garrisons of unclaimed keeps in his first minute: they count 1.6×.
const bribes = (o, t) => t.owner === 0 && G.fac[o] === 'solmara' && G.time < 60 && G.ais.some(a => a.id === o) ? 1.6 : 1;
const strikeOf = (o, t) => atkOf(o) * (t.owner === 0 ? army(o).stats.neutral : 1) * bribes(o, t);
const tierOf = p => p.r < 18 ? 1 : p.r < 26 ? 2 : 3;
// The Custom battle setting scales the cap (capMul); Walls add to it.
const capOf = p => GARRISON_CAP[tierOf(p)] * (G.cfg.capMul ?? 1) + WALL_CAP * lvl(p, 'walls');
const kindOf = p => p.kind ? CASTLE_KINDS[p.kind] : null;
// Villages speed up their owner's other castles within reach: +25% for each, up to +50%.
function villageBoost(p) {
  if (!p.owner || p.kind === 'village') return 1;
  const V = CASTLE_KINDS.village;
  let n = 0;
  for (const v of G.planets) if (v.kind === 'village' && v.owner === p.owner && dist(v, p) <= V.aura) n++;
  return Math.min(1.5, 1 + V.auraBoost * n);
}
const wardOver = (p, o) => G.units.some(u => u.type === 'ward' && u.owner === o && dist(u, p) <= MAP_UNITS.ward.range);
// Upkeep: a castle feeding a big garrison trains slower, which stops one castle hoarding an army forever.
const upkeepOf = p => p.units > p.r * UPKEEP_AT * 2 ? 0.25 : p.units > p.r * UPKEEP_AT ? 0.5 : 1;
// The treasury is capped in skirmishes and campaigns; the Grand Campaign has no cap.
const coinCap = () => G.mode === 'grand' ? Infinity : (G.cfg.coinCap ?? COIN_CAP);
// Harvest map event (#35): one kingdom trains faster for a while, shaped like a power.
const harvestMul = o => G.ev && G.ev.harvest && G.ev.harvest.o === o && G.time < G.ev.harvest.until ? 1.5 : 1;
const rate = p => p.owner ? p.r * PROD * army(p.owner).stats.prod * (powerOn(p.owner, 'goldenTithe') ? 2 : 1) * harvestMul(p.owner) * (wardOver(p, p.owner) ? 2 : 1) * upkeepOf(p) * barracksTrainMul(p) * (kindOf(p) ? kindOf(p).prod : 1) * villageBoost(p) * weatherMul(p.owner, 'prod') * nightProd() : 0;
// Wall strength of one castle: its owner's defence plus a Great Ward over it.
const defAt = p => defOf(p.owner) * (p.owner && wardOver(p, p.owner) ? 1.5 : 1) * (p.owner ? wallsMul(p) : 1) * (kindOf(p) ? kindOf(p).def : 1);
// Enemy Great Wards halve marching speed inside them.
const slowedAt = k => G.units.some(u => u.type === 'ward' && u.owner !== k.owner && dist(u, k) <= MAP_UNITS.ward.range);
const incomeOf = o => G.planets.reduce((a, p) => a + (p.owner === o ? COIN_PER_MIN[tierOf(p)] : 0), 0);
const frozen = o => G.owners.some(q => q !== o && powerOn(q, 'wintersGrip'));

// ---------- castle upgrades and archers ----------
const lvl = (p, kind) => (p.up && p.up[kind]) || 0;
// Bigger castles train more, so their upgrades cost more: 0.8x for small, 1x medium, 1.2x large.
const upgradeCost = (p, kind) => lvl(p, kind) < UPGRADE.max ? Math.round(UPGRADE.cost[lvl(p, kind)] * (0.6 + 0.2 * tierOf(p))) : null;
const canUpgrade = (p, kind) => !!p.owner && upgradeCost(p, kind) !== null && p.units >= upgradeCost(p, kind) + 1;
const wallsMul = p => 1 + UPGRADE.wallDef * lvl(p, 'walls');
const barracksTrainMul = p => 1 + UPGRADE.barracksTrain * lvl(p, 'barracks');
const soldierStr = c => 1 + UPGRADE.barracksStr * lvl(c, 'barracks');
const archerStats = p => {
  const L = lvl(p, 'walls'), A = UPGRADE.archer;
  return { range: p.r + A.reach[L], every: A.every[L], kill: A.kill[L] * (0.7 + 0.15 * tierOf(p)) };
};

function upgrade(p, kind) {
  if (!canUpgrade(p, kind)) return false;
  p.units -= upgradeCost(p, kind);
  p.up = { walls: lvl(p, 'walls'), barracks: lvl(p, 'barracks') };
  p.up[kind]++;
  G.fx.push({ kind: 'upgrade', x: p.x, y: p.y, r: p.r, col: col(p.owner), age: 0 });
  emit('upgrade', { castle: p, kind });
  return true;
}

// Archers: every castle a kingdom holds shoots at enemy columns marching within range.
function archersTick(dt) {
  let hit = false;
  for (const p of G.planets) {
    if (!p.owner) continue;
    p.arrowT = (p.arrowT ?? 0) - dt;
    if (p.arrowT > 0) continue;
    const a = archerStats(p);
    let target = null, best = a.range;
    for (const k of G.packets) {
      if (k.owner === p.owner || k.delay > 0 || k.n <= 0.05 || allied(k.owner, p.owner)) continue;
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d < best) { best = d; target = k; }
    }
    if (!target) { p.arrowT = 0.25; continue; }
    p.arrowT = a.every;
    const kill = Math.min(target.n, a.kill);
    target.n -= kill; hit = true;
    if (target.owner === 1) G.stats.roadLost += kill;
    G.fx.push({ kind: 'arrow', x: p.x, y: p.y - p.r * 1.1, x1: target.x, y1: target.y - 4, age: 0 });
  }
  if (hit) G.packets = G.packets.filter(k => k.n > 0.05);
}

// Troops an attacker should expect to lose to a castle's archers on the way in.
function archerLoss(t, me) {
  if (!t.owner || t.owner === me) return 0;
  const a = archerStats(t);
  return (a.range - t.r) / speedOf(me) / a.every * a.kill;
}

// AI upgrades: defensive armies build Walls on their front line (and sink garrisons upkeep is already slowing),
// aggressive ones build Barracks in the rear, balanced ones a mix. At most one upgrade every 20 seconds.
function aiUpgrade(ai, mine, enemyCastles, inc, pz) {
  if (!enemyCastles.length || G.time - (ai.upgradedAt ?? -99) < 20 || Math.random() > 0.25) return false;
  const danger = p => Math.min(...enemyCastles.map(e => dist(p, e)));
  const kind = pz.front ? 'walls' : pz.enemyBias >= 1.5 ? 'barracks' : (Math.random() < 0.5 ? 'walls' : 'barracks');
  const pool = [...mine].sort((a, b) => kind === 'walls' ? danger(a) - danger(b) : danger(b) - danger(a)).slice(0, 2);
  for (const p of pool) {
    const cost = upgradeCost(p, kind);
    if (cost === null || threatOn(p, ai.id, inc) > 0) continue;
    const surplus = pz.front ? (p.units > p.r * UPKEEP_AT || p.units >= cost * 1.3 + 6) : p.units >= cost * 2 + Math.max(pz.keep, 8);
    if (surplus && p.units >= cost + 4 && upgrade(p, kind)) { ai.upgradedAt = G.time; return true; }
  }
  return false;
}

function usePower(o) {
  const pw = G.pw[o], A = army(o);
  if (pw.ready > 0 || G.over) return false;
  if (G.mode === 'grand' && G.phase === 'plan') {
    if (pw.queued) return false;
    pw.queued = true;
    const order = { kind: 'power', owner: o };
    G.orders.push(order);
    emit('order', { order });
    return true;
  }
  pw.ready = rechargeTime();
  pw.until = G.time + A.power.dur;
  if (A.power.id === 'crows') {
    const targets = G.planets.filter(p => p.owner && p.owner !== o).sort((a, b) => b.units - a.units).slice(0, 3);
    for (const t of targets) { t.units *= 0.6; G.fx.push({ kind: 'crows', x: t.x, y: t.y, r: t.r, age: 0 }); }
  }
  emit('power', { o, army: A });
  const ai = G.ais.find(a => a.id === o);
  if (ai) ai.readyAt = null;
  G.events.push({ t: G.time, kind: 'power', owner: o });
  if (o === 1) G.stats.powerUses++;
  return true;
}

// A lord has something to say. The UI decides whether and how to show it.
const lordOf = o => LORDS[G.fac[o]];
const lordSays = (o, kind, force = false) => emit('taunt', { o, kind, force });

function send(owner, sources, target, frac = 0.5) {
  let launched = false;
  for (const s of sources) {
    if (s === target || s.owner !== owner || allied(owner, target.owner)) continue;
    const n = Math.floor(s.units * frac);
    if (n < 1) continue;
    s.units -= n;
    launched = true;
    if (G.mode === 'grand' && G.phase === 'plan') {
      const order = { kind: 'send', owner, from: s, to: target, n };
      G.orders.push(order);
      emit('order', { order });
      continue;
    }
    launch(owner, s, target, n);
  }
  return launched;
}

// ---------- alliances and truces ----------
// In battles of three or more kingdoms, two kingdoms can agree a truce: for PACT_TIME seconds neither
// can attack the other, their columns pass on the road, and their archers and map units hold fire.
// The lords' personalities decide who offers and who accepts; Veyra accepts and then betrays.
const PACT_TIME = 90, OFFER_TIME = 15, PACT_COOLDOWN = 60, DIPLO_EVERY = 3, AMARU_PRICE = 15;
const pactKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const pactOf = (a, b) => G.pacts && G.pacts.find(p => ((p.a === a && p.b === b) || (p.a === b && p.b === a)) && G.time < p.until);
const allied = (a, b) => !!(a && b && a !== b && G.pacts && pactOf(a, b));
const aliveOwners = () => G.owners.filter(o => G.planets.some(p => p.owner === o));
const leaderOf = () => aliveOwners().sort((a, b) => totalOf(b) - totalOf(a))[0];
function canPact(a, b) {
  if (!G.pacts || a === b || allied(a, b) || aliveOwners().length < 3) return false;
  if (![a, b].every(o => aliveOwners().includes(o))) return false;
  return G.time >= (G.pactCool[pactKey(a, b)] ?? -1);
}
function makePact(a, b) {
  const p = { a, b, since: G.time, until: G.time + PACT_TIME, betrayAt: null, betrayer: null };
  // Veyra smiles, shakes hands, and counts the seconds.
  const nyx = [a, b].find(o => G.fac[o] === 'nyx' && G.ais.some(ai => ai.id === o));
  if (nyx) { p.betrayer = nyx; p.betrayAt = G.time + 45 + Math.random() * 25; }
  G.pacts.push(p);
  emit('pact', { a, b });
}
function endPact(p, by) {
  p.until = G.time;
  G.pactCool[pactKey(p.a, p.b)] = G.time + PACT_COOLDOWN;
  emit('pactEnd', { a: p.a, b: p.b, by });
}
// Does lord o take a truce offered by `from`?
function lordAccepts(o, from) {
  switch (G.fac[o]) {
    case 'kharzul': return false;                                   // Torvek never stops
    case 'nyx': return true;                                        // Veyra always says yes
    case 'aldmere': return leaderOf() !== o;                        // Isolde only when she isn't winning
    case 'frostmark': return totalOf(from) > totalOf(o);            // Sigrun only with someone stronger
    case 'solmara': return leaderOf() !== o && (from !== 1 || G.coins[1] >= AMARU_PRICE);   // Amaru, for a price
    default: return false;
  }
}
// A kingdom offers kingdom `to` a truce. The player answers with a card; AI lords answer at once.
function proposeTruce(from, to) {
  if (!canPact(from, to)) return 'unavailable';
  if (to === 1) {
    if (G.offer) return 'unavailable';
    G.offer = { from, to, until: G.time + OFFER_TIME };
    emit('offer', { from });
    return 'pending';
  }
  const yes = lordAccepts(to, from);
  if (yes && from === 1 && G.fac[to] === 'solmara') G.coins[1] -= AMARU_PRICE;
  if (yes) makePact(from, to);
  else G.pactCool[pactKey(from, to)] = G.time + PACT_COOLDOWN;
  if (from === 1) lordSays(to, yes ? 'accept' : 'refuse', true);
  return yes ? 'accepted' : 'refused';
}
function answerOffer(yes) {
  const o = G.offer;
  if (!o) return;
  G.offer = null;
  if (yes && canPact(o.from, o.to)) makePact(o.from, o.to);
  else G.pactCool[pactKey(o.from, o.to)] = G.time + PACT_COOLDOWN;
  emit('offerAnswered', { from: o.from, yes });
}
// The player breaks a truce. The other lord takes it badly.
function breakPact(o) {
  const p = pactOf(1, o);
  if (!p) return;
  endPact(p, 1);
  lordSays(o, 'betrayed', true);
}
function diplomacyTick() {
  if (!G.pacts || G.cfg.demo) return;
  if (G.offer && G.time >= G.offer.until) answerOffer(false);
  for (const p of G.pacts) {
    if (G.time >= p.until) continue;
    if (p.betrayAt && G.time >= p.betrayAt) {
      endPact(p, p.betrayer);
      if (p.a === 1 || p.b === 1) lordSays(p.betrayer, 'betray', true);
    } else if (![p.a, p.b].every(o => aliveOwners().includes(o))) endPact(p, null);
  }
  // Expired truces cool down before they can be renewed.
  for (const p of G.pacts) if (G.time >= p.until && !p.done) { p.done = true; G.pactCool[pactKey(p.a, p.b)] ??= G.time + PACT_COOLDOWN; emit('pactEnd', { a: p.a, b: p.b, by: null, expired: true }); }
  G.pacts = G.pacts.filter(p => G.time < p.until || !p.done || G.time - p.until < 5);
  // Isolde and Amaru, when second, offer a truce so they can turn on the leader.
  const alive = aliveOwners();
  if (alive.length < 3) return;
  const ranked = [...alive].sort((a, b) => totalOf(b) - totalOf(a));
  const second = ranked[1];
  if (!G.ais.some(ai => ai.id === second) || !['aldmere', 'solmara'].includes(G.fac[second])) return;
  if (G.time - (G.lastOffer[second] ?? -99) < 45) return;
  const partner = ranked.find(o => o !== second && o !== ranked[0] && canPact(second, o));
  if (!partner) return;
  G.lastOffer[second] = G.time;
  proposeTruce(second, partner);
}

// ---------- fog of war ----------
// With cfg.fog on, a kingdom sees only near its own castles and its own marching columns. Everywhere
// else it knows what it last saw: G.seen[o][castleId] = { owner, units }. The AI plans from the same
// knowledge as the player.
const SIGHT_CASTLE = 200, SIGHT_COLUMN = 85, SIGHT_EVERY = 0.2;
function updateSight() {
  for (const o of G.owners) {
    const src = [];
    const far = weatherMul(o, 'sight');
    for (const p of G.planets) if (p.owner === o) src.push({ x: p.x, y: p.y, r: (SIGHT_CASTLE + p.r) * far });
    for (const k of G.packets) if (k.owner === o && k.delay <= 0) src.push({ x: k.x, y: k.y, r: SIGHT_COLUMN * far });
    G.sight[o] = src;
    const mem = G.seen[o];
    for (const p of G.planets) if (seesAt(o, p.x, p.y)) mem[p.id] = { owner: p.owner, units: p.units };
  }
}
const seesAt = (o, x, y) => !G.cfg.fog || !G.sight || !G.sight[o] || G.sight[o].some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < s.r * s.r);
// What kingdom o believes about castle p: the castle itself when o can see it, otherwise o's memory of it.
// You always know which of your own castles you hold, and which ones you have lost.
function knownOf(o, p) {
  if (!G.cfg.fog || p.owner === o || seesAt(o, p.x, p.y)) return p;
  const m = G.seen[o][p.id];
  if (!m || m.owner === o) return p;
  return { ...p, owner: m.owner, units: m.units, ghostOf: p };
}
// Troops o believes kingdom q has: remembered garrisons plus columns o can see.
const knownTotal = (o, q) =>
  G.planets.reduce((a, p) => { const k = knownOf(o, p); return a + (k.owner === q ? k.units : 0); }, 0) +
  G.packets.reduce((a, k) => a + (k.owner === q && seesAt(o, k.x, k.y) ? k.n : 0), 0);
// incomingTable as kingdom o can see it: its own columns, and others only where o has sight.
function incomingFor(o) {
  if (!G.cfg.fog) return incomingTable();
  const inc = G.planets.map(() => new Array(G.owners.length + 2).fill(0));   // + the bandit column (owner id owners.length + 1)
  for (const k of G.packets) if (k.owner === o || seesAt(o, k.x, k.y)) inc[k.to.id][k.owner] += k.n;
  return inc;
}

// March n troops (already taken from s) to target as columns along the path.
function launch(owner, s, target, n) {
  if (allied(owner, target.owner)) { s.units += n; return; }
  if (owner === 1) G.stats.sent += n;
  const k = Math.min(30, n, Math.max(3, Math.ceil(n / 2)));
  // Set off towards the first waypoint (a bridge, or the target itself).
  const path = pathOf(s, target).pts, first = path[0];
  const ang = Math.atan2(first.y - s.y, first.x - s.x);
  for (let i = 0; i < k; i++) {
    const cnt = Math.floor(n / k) + (i < n % k ? 1 : 0);
    const jx = (Math.random() - 0.5) * 4, jy = (Math.random() - 0.5) * 4;
    const at = off => ({ x: s.x + Math.cos(ang) * s.r * 0.8 - Math.sin(ang) * off, y: s.y + Math.sin(ang) * s.r * 0.8 + Math.cos(ang) * off });
    // Columns spread across the castle front, unless that would put the outer files in the water.
    let start = at((Math.random() - 0.5) * s.r * 1.1);
    if (crossesWater(G.terrain, start, path.length > 1 ? { x: first.x + jx, y: first.y + jy } : first)) start = at(0);
    G.packets.push({
      owner, from: s, to: target, n: cnt, str: soldierStr(s), delay: i * 0.06, phase: Math.random() * 6.28,
      path, wp: 0, jx, jy, x: start.x, y: start.y,
    });
  }
}

// ---------- weather and day/night ----------
// G.weather alternates between a spell of the homeland's weather and a spell of clear skies.
function updateWeather() {
  const W = G.weather;
  if (G.mode === 'grand' || G.time < W.until) return;
  const pool = G.theme.weather || [];
  if (G.cfg.tutorial || !pool.length) { W.until = 1e9; return; }
  W.prev = W.kind;
  W.kind = W.kind === 'clear' ? pick(pool) : 'clear';
  W.since = G.time;
  W.until = G.time + WEATHER_SPELL[0] + Math.random() * (WEATHER_SPELL[1] - WEATHER_SPELL[0]);
  emit('weather', { kind: W.kind, prev: W.prev });
}
// In the Grand Campaign the weather turns over between waves: each spell lasts one or two waves.
on('wave', ({ phase }) => {
  if (!G || G.mode !== 'grand' || !G.weather || phase !== 'plan') return;
  const W = G.weather;
  W.wavesLeft = (W.wavesLeft ?? 1) - 1;
  if (W.wavesLeft > 0) return;
  const pool = G.theme.weather || [];
  if (!pool.length) return;
  W.prev = W.kind;
  W.kind = W.kind === 'clear' ? pick(pool) : 'clear';
  W.since = G.time;
  W.wavesLeft = 1 + Math.floor(Math.random() * 2);
  emit('weather', { kind: W.kind, prev: W.prev });
});
// How far the current weather has set in, 0 to 1.
const weatherAmt = () => G.weather ? Math.min(1, (G.time - G.weather.since) / WEATHER_FADE) : 1;
// A weather multiplier for kingdom o, blending out of the last weather as the new one sets in.
function weatherMul(o, key) {
  const W = G.weather;
  if (!W) return 1;
  const at = k => o && WEATHER[k].native === G.fac[o] ? 1 : WEATHER[k][key];
  const a = weatherAmt();
  return at(W.kind) * a + at(W.prev) * (1 - a);
}
// Night, 0 at day to 1 at the darkest hour. A battle starts at dawn; the first night peaks at DAY_LENGTH / 2.
function nightAmt() {
  const glow = (1 - Math.cos((G.time / DAY_LENGTH) * Math.PI * 2)) / 2;
  return Math.max(0, Math.min(1, (glow - 0.5) * 2));
}
const nightProd = () => 1 - (1 - NIGHT_PROD) * nightAmt();

function incomingTable() {
  const inc = G.planets.map(() => new Array(G.owners.length + 2).fill(0));   // + the bandit column (owner id owners.length + 1)
  for (const k of G.packets) inc[k.to.id][k.owner] += k.n;
  return inc;
}
// A marching column's punch against its target: its troops times its army's strike and its Barracks strength.
const packetPower = k => k.n * strikeOf(k.owner, k.to) * (k.str || 1);
// Like incomingFor, but counting each column's punch rather than its head count.
function incomingPowerFor(o) {
  const inc = G.planets.map(() => new Array(G.owners.length + 2).fill(0));
  for (const k of G.packets) {
    if (G.planets[k.to.id] !== k.to) continue;
    if (k.owner === o || !G.cfg.fog || seesAt(o, k.x, k.y)) inc[k.to.id][k.owner] += packetPower(k);
  }
  return inc;
}

// ---------- AI: each army's personality shapes how it plays ----------
// Troops `me` must send to take `t`, after travel time, reinforcements and army strengths.
function needAt(t, far, inc, me, src) {
  const route = src ? routeHazard(src, t, me) : { slow: 0, loss: 0 };
  let def = t.units;
  if (t.owner !== 0) def += rate(t) * ((far + route.slow) / speedOf(me)) + inc[t.id][t.owner];
  def = def * defAt(t) / strikeOf(me, t) + archerLoss(t, me) + route.loss;
  def -= inc[t.id][me];
  return Math.ceil(def + 2);
}

// What lies on the road from src to t for kingdom me: extra distance from enemy Great Wards (half speed inside)
// and troops expected to fall to enemy Ballista Towers along the way.
function routeHazard(src, t, me) {
  const out = { slow: 0, loss: 0 };
  const foes = G.units.filter(u => u.owner !== me && (u.type === 'ward' || u.type === 'ballista'));
  if (!foes.length) return out;
  const pts = [src, ...pathOf(src, t).pts], STEP = 10;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(dist(a, b) / STEP)), len = dist(a, b) / n;
    for (let j = 0; j < n; j++) {
      const x = a.x + (b.x - a.x) * (j + 0.5) / n, y = a.y + (b.y - a.y) * (j + 0.5) / n;
      for (const u of foes) {
        const d = Math.hypot(u.x - x, u.y - y);
        if (u.type === 'ward' && d <= MAP_UNITS.ward.range) out.slow += len;
        if (u.type === 'ballista' && d <= MAP_UNITS.ballista.range) out.loss += len / speedOf(me) * 3;
      }
    }
  }
  return out;
}

const threatOn = (p, me, inc) => inc[p.id].reduce((a, v, o) => o !== me ? a + v : a, 0);

// When each AI fires its power. Named lords override their army's default timing.
function aiPower(ai, inc, mine) {
  const me = ai.id, id = G.fac[me], pow = incomingPowerFor(me);
  if (G.pw[me].ready > 0) return;
  if (ai.readyAt == null) ai.readyAt = G.time;
  const waited = G.time - ai.readyAt;
  if (ai.diff === 'easy' && Math.random() < 0.6) return;
  const falling = mine.filter(p => threatOn(p, me, pow) >= p.r * 0.4 && threatOn(p, me, pow) > (p.units + inc[p.id][me]) * defAt(p));
  const incoming = mine.reduce((a, p) => a + threatOn(p, me, inc), 0);
  let use = false;
  switch (id) {
    case 'aldmere':
      // Isolde saves the Oath until two castles are under attack at once.
      use = ai.diff === 'easy' ? falling.length >= 1 : falling.length >= 2;
      break;
    case 'kharzul':
      // Torvek opens his big attacks with the charge (see aiThink); never as a defence.
      use = ai.diff === 'easy' && G.packets.some(k => k.owner === me && k.to.owner && k.to.owner !== me);
      break;
    case 'frostmark':
      // Sigrun freezes a big attack, then remembers where it came from.
      use = incoming >= 25 || falling.length >= 1;
      if (use) ai.counter = new Set(G.packets.filter(k => k.owner !== me && k.to.owner === me && k.from).map(k => k.from.id));
      break;
    case 'solmara':
      // Amaru opens the treasury right after a wave of captures.
      ai.recentCaps = ai.recentCaps.filter(t => G.time - t < 15);
      use = ai.recentCaps.length >= 2 || (waited > 60 && mine.length >= 3);
      break;
    case 'nyx':
      // Veyra looses the crows just before her main attack (see aiThink); this is a fallback.
      use = waited > 60 && G.planets.some(p => { const k = knownOf(me, p); return k.owner && k.owner !== me && k.units >= k.r * 1.5; });
      break;
  }
  if (use) usePower(me);
}

// With three or more kingdoms, the AI lords spend the opening claiming unclaimed keeps rather than
// knocking a neighbour out in the first seconds, which on a crowded map is otherwise common.
const MUSTER_TIME = 25;
const mustering = () => G.owners.length > 2 && G.time < MUSTER_TIME;

function aiThink(ai) {
  const me = ai.id, id = G.fac[me], d = ai.diff;
  // Under fog of war, castles out of sight are stand-ins carrying this lord's memory of them;
  // orders always go to the real castle (t.ghostOf).
  const P = G.cfg.fog ? G.planets.map(p => knownOf(me, p)) : G.planets;
  const real = t => t.ghostOf || t;
  const pz = { ...army(me).ai };
  const mine = P.filter(p => p.owner === me);
  if (!mine.length) return;
  const inc = incomingFor(me), pow = incomingPowerFor(me);
  const enemyCastles = P.filter(p => p.owner && p.owner !== me);
  // Marching distance to the nearest castle in a list: rivers and forests count, not just the crow's flight.
  const nearestOf = (p, list) => list.length ? Math.min(...list.map(q => travel(p, q))) : Infinity;
  aiPower(ai, inc, mine);
  aiBuyUnit(ai, mine);

  // Sigrun: the moment her blizzard lifts, strike the castles that attacked her.
  if (id === 'frostmark' && ai.counter && G.time >= G.pw[me].until) {
    const targets = P.filter(p => ai.counter.has(p.id) && p.owner && p.owner !== me).sort((a, b) => a.units - b.units);
    ai.counter = null;
    if (targets.length) {
      const t = targets[0];
      const srcs = mine.filter(s => s.units > s.r * 0.4).sort((a, b) => travel(a, t) - travel(b, t)).slice(0, 4);
      if (send(me, srcs, real(t), 0.6)) { lordSays(me, 'counter', true); return; }
    }
  }

  if (d === 'easy') {
    if (Math.random() < 0.45) return;
    const srcs = mine.filter(p => p.units >= Math.max(14, pz.keep));
    if (!srcs.length) return;
    const s = pick(srcs);
    let ts = P.filter(p => p.owner !== me && (p.owner === 0 || !mustering())).sort((a, b) => travel(s, a) - travel(s, b)).slice(0, 5);
    // Aggressive armies prefer enemy castles even on easy; defensive ones prefer quiet expansion.
    const enemies = ts.filter(t => t.owner), neutrals = ts.filter(t => !t.owner);
    if (pz.enemyBias > 1.5 && enemies.length) ts = enemies;
    else if (pz.enemyBias < 1 && neutrals.length) ts = neutrals;
    if (ts.length) send(me, [s], real(pick(ts)), pz.sendFrac);
    return;
  }

  // Amaru expands faster than anyone in the first minute.
  const amaruRush = id === 'solmara' && G.time < 60;
  if (amaruRush) { pz.neutralBias *= 3; pz.sendFrac = 0.55; }

  // Defend castles about to fall. Defensive armies react earlier; Torvek never does.
  if (id !== 'kharzul') {
    for (const p of mine) {
      const threat = threatOn(p, me, pow);
      const hold = (p.units + inc[p.id][me]) * defAt(p) + rate(p) * 1.5;
      if (threat > 0 && threat > hold * pz.defendAt) {
        // The first enemy column to arrive sets the deadline; help that would come later only goes if it outnumbers them.
        const eta = Math.min(...G.packets.filter(k => k.to === real(p) && k.owner !== me && (!G.cfg.fog || seesAt(me, k.x, k.y)))
          .map(k => Math.hypot(k.x - p.x, k.y - p.y) / speedOf(k.owner)), Infinity);
        const helpers = mine.filter(q => q !== p && q.units > q.r * 0.4).sort((a, b) => travel(a, p) - travel(b, p));
        const inTime = helpers.filter(q => travel(q, p) / speedOf(me) <= eta);
        const pool = inTime.length ? inTime : helpers.filter(q => q.units * 0.5 * defAt(p) > threat);
        if (pool.length) send(me, d === 'hard' ? pool.slice(0, 2) : [pool[0]], real(p), 0.5);
      }
    }
  }

  // Isolde keeps her front-line castles topped up before she attacks anywhere.
  if (id === 'aldmere' && enemyCastles.length && mine.length > 1 && Math.random() < 0.5) {
    const byDanger = [...mine].sort((a, b) => nearestOf(a, enemyCastles) - nearestOf(b, enemyCastles));
    const frontLine = byDanger.filter(p => nearestOf(p, enemyCastles) < nearestOf(byDanger[0], enemyCastles) * 1.3);
    const weak = frontLine.find(p => p.units < p.r * 1.2);
    const rear = byDanger.slice().reverse().find(p => !frontLine.includes(p) && p.units > p.r * 1.4);
    if (weak && rear) { send(me, [rear], weak, 0.5); return; }
  }

  // Sigrun intercepts columns marching on unclaimed keeps near her lands when her shieldwall would win.
  if (id === 'frostmark' && Math.random() < 0.6) {
    for (const nt of P.filter(p => p.owner === 0 && nearestOf(p, mine) < 220)) {
      const enemyIn = G.packets.filter(k => k.to === real(nt) && k.owner !== me && seesAt(me, k.x, k.y));
      if (!enemyIn.length || inc[nt.id][me] > 0) continue;
      const strength = enemyIn.reduce((a, k) => a + k.n * roadOf(k.owner), 0);
      const h = mine.filter(s => s.units > s.r * 0.5).sort((a, b) => travel(a, nt) - travel(b, nt))[0];
      if (h && Math.floor(h.units * 0.5) * roadOf(me) > strength) { send(me, [h], real(nt), 0.5); return; }
    }
  }

  // Defensive armies turn bold once they clearly outnumber everyone.
  const myTotal = totalOf(me);
  const theirTotal = o => G.cfg.fog ? knownTotal(me, o) : totalOf(o);
  const enemyTotal = Math.max(1, ...G.owners.filter(o => o !== me).map(theirTotal));
  const bold = myTotal > enemyTotal * pz.boldAt ? 2 : 1;

  // Torvek fixes on the strongest rival's biggest castle and keeps hammering it.
  const stale = id === 'kharzul' && ai.focus && G.time - (ai.focusSince ?? G.time) > 60;
  if (id === 'kharzul' && (!ai.focus || stale || knownOf(me, ai.focus).owner === me || knownOf(me, ai.focus).owner === 0)) {
    // Strongest rival first; on a tie (as at the start), the nearest one, rather than always the player.
    const near = o => Math.min(...P.filter(p => p.owner === o).map(p => nearestOf(p, mine)), Infinity);
    const rivals = G.owners.filter(o => o !== me && P.some(p => p.owner === o)).sort((a, b) => (theirTotal(b) - theirTotal(a)) || (near(a) - near(b)));
    const prev = stale ? ai.focus : null;
    const f = P.filter(p => p.owner === rivals[0] && real(p) !== prev).sort((a, b) => b.units - a.units)[0];
    ai.focus = f ? real(f) : null;
    ai.focusSince = G.time;
  }

  // An upgrade no longer costs the lord his attack this think.
  aiUpgrade(ai, mine, enemyCastles, pow, pz);

  let candidates = P.filter(t => t.owner !== me && (t.owner === 0 || !mustering()) && !allied(me, t.owner));
  // Sigrun holds her army home early, taking only neutrals and near-empty castles.
  if (id === 'frostmark' && G.time < 100 && bold === 1) candidates = candidates.filter(t => t.owner === 0 || t.units < t.r * 0.3);
  // Amaru's first minute: claim every keep on his side of the map, and nothing that brings him close to a rival.
  if (amaruRush) candidates = candidates.filter(t => (t.owner === 0 && nearestOf(t, mine) <= nearestOf(t, enemyCastles)) || (t.owner && t.units < t.r * 0.3));
  // Isolde advances one castle at a time once she outnumbers you two to one.
  if (id === 'aldmere' && myTotal > enemyTotal * 2) candidates = candidates.sort((a, b) => nearestOf(a, mine) - nearestOf(b, mine)).slice(0, 3);

  let best = null;
  // In the Grand Campaign, lords mass sieges from more castles, since walled castles at their cap are hard to crack.
  const maxSrc = G.mode === 'grand' ? GRAND.siegeSources[d] || 4 : d === 'hard' ? 4 : 3;
  // A castle at its cap trains nothing more, and a bold lord commits; either way the AI sends most of it.
  const fracOf = s => s.units >= capOf(s) - 1 || bold > 1 ? Math.max(pz.sendFrac, 0.8) : pz.sendFrac;
  // While rushing, Amaru's castles within reach of a rival keep 40% of their size home.
  const exposed = s => amaruRush && nearestOf(s, enemyCastles) < 300;
  // Stalemate breaker: while no castle has changed hands for 90 seconds, caution drains away towards an even fight.
  const ease = Math.min(1, Math.max(0, (G.time - (G.lastCapAt ?? 0) - 90) / 90));
  for (const t of candidates) {
    const srcs = mine.filter(s => s.units >= pz.keep / 20 * s.r && (!exposed(s) || s.units * (1 - pz.sendFrac) >= s.r * 0.4)).sort((a, b) => travel(a, t) - travel(b, t));
    const chosen = [];
    let sum = 0, sumAll = 0, far = 0, need = Infinity;
    // Amaru avoids even fights against other kingdoms.
    const margin0 = pz.margin * (id === 'solmara' && t.owner && bold === 1 ? 1.15 : 1);
    const margin = margin0 - Math.max(0, margin0 - 1) * ease;
    for (const s of srcs) {
      if (chosen.length >= maxSrc) break;
      chosen.push(s);
      // Barracks make each soldier count for more, so fewer need to go.
      sum += Math.floor(s.units * fracOf(s)) * soldierStr(s);
      sumAll += Math.floor(s.units * 0.8) * soldierStr(s);
      far = Math.max(far, travel(s, t));
      need = needAt(t, far, inc, me, s) * margin;
      if (sum >= need) break;
    }
    if (!chosen.length || need <= 2) continue;
    // Within 20% of affordable: commit 80% of each chosen garrison rather than give up.
    let frac = null;
    if (sum < need) { if (sum >= need * 0.8 && sumAll >= need) frac = 0.8; else continue; }
    let worth = (t.r * PROD + 0.4) * (t.owner === 0 ? pz.neutralBias : pz.enemyBias * bold);
    // Special kinds: war camps and villages are prizes; a village is worth more the more of our castles it would speed up.
    if (t.kind) {
      worth *= CASTLE_KINDS[t.kind].worth;
      if (t.kind === 'village') worth *= 1 + 0.3 * mine.filter(m => dist(m, t) <= CASTLE_KINDS.village.aura).length;
    }
    if (t.owner && t.units < t.r * 0.6) worth *= pz.opportunist;
    if (id === 'kharzul' && real(t) === ai.focus) worth *= 2.5;
    // Grand Campaign: lords turn on whichever rival has fallen well behind them, so a dying realm gets finished off.
    if (G.mode === 'grand' && t.owner && totalOf(t.owner) < myTotal * 0.5) worth *= GRAND.finishBias;
    if (id === 'nyx') {
      // Veyra pounces on castles that were just emptied, and boxes rivals in with nearby keeps.
      const prev = ai.snap.get(t.id);
      if (t.owner && prev >= t.r * 0.5 && t.units < prev * 0.55) worth *= 4;
      if (!t.owner && nearestOf(t, enemyCastles) < 200) worth *= 1.6;
    }
    const score = worth / (need + far * 0.06);
    if (!best || score > best.score) best = { score, chosen, t, sum, frac };
  }
  if (id === 'nyx') ai.snap = new Map(P.map(p => [p.id, p.units]));

  if (best) {
    const big = best.t.owner && (best.sum >= best.t.r || (id === 'kharzul' && best.sum >= best.t.r * 0.5));
    // Veyra drops the crows before her main attack lands; Torvek charges alongside his.
    if (id === 'nyx' && big && G.pw[me].ready === 0) usePower(me);
    for (const s of best.chosen) send(me, [s], real(best.t), best.frac ?? fracOf(s));
    if (id === 'kharzul' && big && G.pw[me].ready === 0) usePower(me);
    return;
  }

  // Nothing worth attacking: defensive armies move troops from safe castles to the front.
  if (pz.front && Math.random() < 0.5 && mine.length > 1 && enemyCastles.length) {
    const byDanger = [...mine].sort((a, b) => nearestOf(a, enemyCastles) - nearestOf(b, enemyCastles));
    const front = byDanger[0], rear = byDanger[byDanger.length - 1];
    if (rear !== front && rear.units > rear.r * 1.2 && front.units < capOf(front) * 0.8) send(me, [rear], front, 0.5);
  }
}

// ---------- coins and map units ----------
// Points along each drawn road, so map units aren't placed on top of one.
function roadSamples(roads) {
  const pts = [];
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) {
    const p = r.pts[i], q = r.pts[i + 1], n = Math.max(1, Math.ceil(dist(p, q) / 8));
    for (let k = 0; k <= n; k++) pts.push({ x: p.x + (q.x - p.x) * k / n, y: p.y + (q.y - p.y) * k / n });
  }
  return pts;
}

// Why a spot can't take a map unit, or null if it can.
function placeProblem(o, x, y) {
  if (x < 24 || y < 30 || x > G.w - 24 || y > G.h - 14) return 'Too close to the edge of the map';
  if (!G.planets.some(p => p.owner === o && Math.hypot(p.x - x, p.y - y) <= PLACE_REACH)) return 'Too far from your castles';
  if (G.planets.some(p => Math.hypot(p.x - x, p.y - (y - 6)) < p.r * 1.25 + 14)) return 'Too close to a castle';
  if (G.roadPts.some(q => Math.hypot(q.x - x, q.y - y) < 12)) return 'Can\'t build on a road';
  if (waterDist(G.terrain, { x, y }) < 14) return 'Can\'t build in water';
  if (G.units.some(u => Math.hypot(u.x - x, u.y - y) < 36)) return 'Too close to another map unit';
  return null;
}

function buyUnit(o, type, x, y) {
  const U = MAP_UNITS[type];
  if (G.bought.has(o) || G.coins[o] < U.price || placeProblem(o, x, y)) return false;
  G.coins[o] -= U.price;
  G.bought.add(o);
  if (G.mode === 'grand' && G.phase === 'plan') {
    const order = { kind: 'unit', owner: o, type, x, y };
    G.orders.push(order);
    emit('order', { order });
    return true;
  }
  placeUnit(o, type, x, y);
  return true;
}

function placeUnit(o, type, x, y) {
  G.units.push({ owner: o, type, x, y, cd: 1, fired: -9, aim: 0 });
  G.fx.push({ kind: 'capture', x, y: y - 8, r: 10, col: col(o), age: 0 });
  emit('build', { o, unit: MAP_UNITS[type] });
}

// Each placed unit acts on its area.
function mapUnits(dt) {
  // A map unit falls silent once its kingdom has surrendered or lost every castle.
  G.units = G.units.filter(u => !G.surrendered.has(u.owner) && G.planets.some(p => p.owner === u.owner));
  G.shots = G.shots.filter(sh => G.units.includes(sh.u));
  let bolted = false;
  for (const u of G.units) {
    u.cd -= dt;
    if (u.cd > 0) continue;
    if (u.type === 'ballista') {
      let target = null, bd = MAP_UNITS.ballista.range;
      for (const k of G.packets) {
        if (k.owner === u.owner || k.delay > 0 || k.n <= 0.05 || allied(k.owner, u.owner)) continue;
        const d = dist(u, k);
        if (d <= bd) { bd = d; target = k; }
      }
      if (!target) { u.cd = 0.1; continue; }
      target.n -= 1;
      bolted = true;
      u.cd = 0.33;
      u.aim = Math.atan2(target.y - (u.y - 14), target.x - u.x);
      G.fx.push({ kind: 'bolt', x: u.x, y: u.y - 14, x1: target.x, y1: target.y - 3, age: 0 });
    } else if (u.type === 'trebuchet') {
      const target = G.planets.filter(p => p.owner && p.owner !== u.owner && !allied(p.owner, u.owner) && dist(u, p) <= MAP_UNITS.trebuchet.range).sort((a, b) => b.units - a.units)[0];
      if (!target) { u.cd = 0.5; continue; }
      G.shots.push({ u, t: target, age: 0, dur: 1.1, dmg: Math.max(4, target.units * 0.15) });
      u.fired = G.time;
      u.cd = 5;
    } else {
      u.cd = 1e9; // The Great Ward works through wardOver and slowedAt.
    }
  }
  if (bolted) G.packets = G.packets.filter(k => k.n > 0.05);
  for (const sh of G.shots) {
    sh.age += dt;
    if (sh.age >= sh.dur && !sh.done) {
      sh.done = true;
      if (sh.t.owner && sh.t.owner !== sh.u.owner) {
        sh.t.units = Math.max(0, sh.t.units - sh.dmg);
        G.fx.push({ kind: 'impact', x: sh.t.x, y: sh.t.y, r: sh.t.r, age: 0 });
        emit('clash', { attacker: sh.u.owner, defender: sh.t.owner });
      }
    }
  }
  G.shots = G.shots.filter(sh => !sh.done);
}

// AI lords save for the unit that suits them, then place it where it matters.
function aiBuyUnit(ai, mine) {
  const me = ai.id;
  if (G.bought.has(me)) return;
  const type = AI_UNIT[G.fac[me]], U = MAP_UNITS[type];
  if (G.coins[me] < U.price) return;
  if (ai.diff === 'easy' && Math.random() < 0.5) return;
  const enemies = G.planets.filter(p => p.owner && p.owner !== me);
  if (!enemies.length) return;
  const nearestEnemy = p => enemies.reduce((b, e) => !b || dist(p, e) < dist(p, b) ? e : b, null);
  let anchors = [];
  if (type === 'ballista') {
    // On the front line, between the most exposed castle and its nearest enemy.
    const front = [...mine].sort((a, b) => dist(a, nearestEnemy(a)) - dist(b, nearestEnemy(b)))[0];
    const e = nearestEnemy(front), d = dist(front, e);
    anchors = [0.35, 0.25, 0.45].map(f => ({ x: front.x + (e.x - front.x) * Math.min(f, 110 / d), y: front.y + (e.y - front.y) * Math.min(f, 110 / d) }));
  } else if (type === 'trebuchet') {
    // Within range of the biggest enemy castle it can reach.
    const reachable = enemies.filter(e => mine.some(m => dist(m, e) < PLACE_REACH + MAP_UNITS.trebuchet.range - 20)).sort((a, b) => b.units - a.units);
    for (const e of reachable.slice(0, 3)) {
      const m = [...mine].sort((a, b) => dist(a, e) - dist(b, e))[0], d = dist(m, e);
      const f = Math.max(0, (d - MAP_UNITS.trebuchet.range + 30) / d);
      anchors.push({ x: m.x + (e.x - m.x) * f, y: m.y + (e.y - m.y) * f });
    }
  } else {
    // In the middle of the biggest cluster of its own castles near the front.
    const scored = mine.map(p => {
      const near = mine.filter(q => dist(p, q) <= MAP_UNITS.ward.range);
      return { near, score: near.length * 100 - dist(p, nearestEnemy(p)) * 0.2 };
    }).sort((a, b) => b.score - a.score);
    for (const s of scored.slice(0, 3)) anchors.push({ x: s.near.reduce((a, q) => a + q.x, 0) / s.near.length, y: s.near.reduce((a, q) => a + q.y, 0) / s.near.length + 20 });
  }
  for (const a of anchors) {
    for (let i = 0; i < 24; i++) {
      const r = i === 0 ? 0 : 10 + i * 4, ang = i * 2.4;
      const x = a.x + Math.cos(ang) * r, y = a.y + Math.sin(ang) * r;
      if (!placeProblem(me, x, y)) { buyUnit(me, type, x, y); return; }
    }
  }
}

// ---------- simulation ----------
function update(dt) {
  G.time += dt;
  if (G.weather) updateWeather();
  if (G.pacts && (G.diploClock += dt) >= DIPLO_EVERY) { G.diploClock = 0; diplomacyTick(); }
  if (G.cfg.fog && (G.sightClock += dt) >= SIGHT_EVERY) { G.sightClock = 0; updateSight(); }
  for (const p of G.planets) {
    const cap = capOf(p);
    if (p.units < cap) p.units = Math.min(cap, p.units + rate(p) * dt);
    // Troops piled in beyond the cap drift away, so a castle can stage an attack but not hold a doomstack.
    else if (p.units > cap && p.owner) p.units -= (p.units - cap) * DESERT_RATE * dt;
  }
  for (const o of G.owners) {
    const pw = G.pw[o], was = pw.ready;
    pw.ready = Math.max(0, pw.ready - dt);
    if (was > 0 && pw.ready === 0) emit('powerReady', { o });
  }

  for (let i = G.packets.length - 1; i >= 0; i--) {
    const k = G.packets[i];
    if (frozen(k.owner)) continue;
    if (k.delay > 0) { k.delay -= dt; continue; }
    // March towards the next waypoint on the route (bridge ends), then the castle itself.
    const t = k.to, last = k.wp >= k.path.length - 1, wpt = k.path[k.wp];
    const gx = last ? t.x : wpt.x + k.jx, gy = last ? t.y : wpt.y + k.jy;
    const dx = gx - k.x, dy = gy - k.y, dd = Math.hypot(dx, dy);
    if (last && dd <= t.r * 0.8) {
      G.packets.splice(i, 1);
      arrive(k, t);
      continue;
    }
    if (!last && dd < 3) { k.wp++; continue; }
    const step = Math.min(dd, speedOf(k.owner) * (slowedAt(k) ? 0.5 : 1) * (inForest(G.terrain, k) ? (army(k.owner).stats.forest ?? FOREST_SLOW) : 1) * dt);
    k.x += dx / dd * step; k.y += dy / dd * step;
    k.dir = dx < 0 ? -1 : 1;
  }

  roadBattles();
  G.rallyClock += dt;
  if (G.rallyClock >= RALLY_EVERY) {
    G.rallyClock = 0;
    for (const p of G.planets) {
      if (!p.rally) continue;
      if (p.owner !== 1 || p.rally.owner !== 1) { p.rally = null; continue; }
      const surplus = Math.floor(p.units - RALLY_KEEP);
      if (surplus >= 3) send(1, [p], p.rally, surplus / p.units);
    }
  }
  for (const o of G.owners) G.coins[o] = Math.min(coinCap(), G.coins[o] + incomeOf(o) / 60 * dt);
  mapUnits(dt);
  archersTick(dt);

  for (const f of G.fx) f.age += dt;
  for (const f of G.fx) if (f.kind === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; }
  G.fx = G.fx.filter(f => f.age < ({ capture: 0.9, crows: 2.6, dust: 0.9, impact: 0.6, bolt: 0.2, arrow: 0.3, upgrade: 0.8 }[f.kind] || 0.35));

  const intervals = { easy: 2.2, medium: 1.3, hard: 0.7 };
  if (G.mode === 'grand') grandTick(dt);
  else for (const ai of G.ais) {
    ai.timer -= dt;
    if (ai.timer <= 0) {
      // Amaru moves quickly while there are keeps to claim.
      const hurry = G.fac[ai.id] === 'solmara' && G.time < 60 ? 0.6 : 1;
      ai.timer = intervals[ai.diff] * army(ai.id).ai.thinkMul * hurry * (0.8 + Math.random() * 0.4);
      aiThink(ai);
    }
  }

  const alive = o => G.planets.some(p => p.owner === o) || G.packets.some(k => k.owner === o);
  G.ais = G.ais.filter(ai => alive(ai.id));
  G.peak = Math.max(G.peak, totalOf(1));
  if (G.time >= G.nextSample) { G.history.push({ t: G.time, v: G.owners.map(totalOf) }); G.nextSample = G.time + 2; }
  // A lord on the brink says so, once.
  if (!G.cfg.demo) for (const o of G.owners.slice(1)) {
    if (G.nearDefeat.has(o) || !alive(o)) continue;
    const castles = G.planets.filter(p => p.owner === o).length;
    G.maxCastles[o] = Math.max(G.maxCastles[o] || 0, castles);
    const brink = (G.maxCastles[o] >= 3 && castles <= 1) || (G.time > 30 && totalOf(o) < totalOf(1) * 0.2);
    if (brink) { G.nearDefeat.add(o); lordSays(o, 'nearDefeat', true); }
  }
  checkSurrender();

  if (G.cfg.demo) {
    if (!alive(1) || !alive(2) || G.time > 150) newGame(demoCfg(), G.portrait);
    return;
  }
  if (!alive(1)) endBattle(false);
  // Story chapters (#27) can be won by surviving for holdFor seconds, or by taking one castle.
  else if (G.cfg.holdFor && G.time >= G.cfg.holdFor) endBattle(true);
  else if (G.mustTake != null && G.planets[G.mustTake] && G.planets[G.mustTake].owner === 1) endBattle(true);
  else if (G.owners.slice(1).every(o => !alive(o))) endBattle(true);
}

// 'largest': the biggest enemy castle (most troops breaks ties); 'nearest': the enemy castle
// closest to the player's start.
function mustTakeCastle(rule) {
  const enemy = G.planets.filter(p => p.owner > 1);
  if (!enemy.length) return null;
  const home = G.planets.find(p => p.owner === 1);
  const pick = rule === 'nearest' && home
    ? enemy.sort((a, b) => dist(a, home) - dist(b, home))[0]
    : enemy.sort((a, b) => (b.r - a.r) || (b.units - a.units))[0];
  return pick.id;
}

// The battle is decided. The UI listens for 'end' to show the result screen.
function endBattle(win) { G.over = true; G.won = win; emit('end', { win }); }

// A rival far behind with no realistic comeback gives up instead of making you hunt down its last castle.
const SURRENDER_SHARE = 0.10, SURRENDER_HOLD = 8;
function checkSurrender() {
  if (G.time < 60) return;
  const sum = G.owners.reduce((a, o) => a + totalOf(o), 0) || 1;
  for (const o of G.owners.slice(1)) {
    if (G.surrendered.has(o)) continue;
    const castles = G.planets.filter(p => p.owner === o);
    if (!castles.length) continue;
    // In the Grand Campaign a realm gives up once it has fallen far behind the strongest realm, however
    // many castles it still holds, so a decided war doesn't drag on for dozens of waves. (A share of all
    // troops doesn't work with five realms: everyone starts at about a fifth.)
    const leader = Math.max(...G.owners.filter(q => q !== o).map(totalOf));
    const weak = G.mode === 'grand'
      ? G.wave >= GRAND.surrenderFromWave && totalOf(o) < leader * GRAND.surrenderShare
      : totalOf(o) / sum < SURRENDER_SHARE && castles.length <= 2;
    if (!weak) { delete G.weakSince[o]; continue; }
    G.weakSince[o] ??= G.time;
    if (G.time - G.weakSince[o] < SURRENDER_HOLD) continue;
    surrender(o, castles);
  }
}
function surrender(o, castles) {
  G.surrendered.add(o);
  const rivalsLeft = G.owners.slice(1).filter(q => q !== o && !G.surrendered.has(q) && G.planets.some(p => p.owner === q));
  // Against a single rival the castles open their gates to the player; otherwise they fall back to neutral.
  const heir = rivalsLeft.length ? 0 : 1;
  for (const p of castles) {
    p.prevOwner = o; p.capturedAt = G.time; p.owner = heir;
    p.units = heir ? p.units : Math.round(p.units * 0.5);
    if (heir === 1) G.caps++;
  }
  G.packets = G.packets.filter(k => k.owner !== o);
  // A surrendering kingdom's map unit leaves the field with it.
  G.units = G.units.filter(u => u.owner !== o);
  G.shots = G.shots.filter(sh => sh.u.owner !== o);
  emit('surrender', { o, heir });
}

// Attackers deal damage scaled by their strike strength against the defender's wall strength.
function arrive(k, t) {
  if (t.owner === k.owner) { t.units += k.n; return; }
  // A truce agreed while they marched: the column turns back home.
  if (allied(k.owner, t.owner)) { if (k.from && k.from.owner === k.owner) k.from.units += k.n; return; }
  const A = strikeOf(k.owner, t) * (k.str || 1), D = defAt(t);
  t.units -= k.n * A / D;
  G.fx.push({ kind: 'clash', x: k.x, y: k.y, age: 0 });
  emit('clash', { attacker: k.owner, defender: t.owner });
  if (t.units < 0) {
    const was = t.owner;
    t.owner = k.owner; t.units = -t.units * D / A;
    if (k.owner === 1) G.caps++;
    const capturer = G.ais.find(a => a.id === k.owner);
    if (capturer) capturer.recentCaps.push(G.time);
    if (was === 1) lordSays(k.owner, 'capture');
    else if (k.owner === 1 && was) lordSays(was, 'lose');
    emit('capture', { o: k.owner, was, castle: t });
    G.fx.push({ kind: 'capture', x: t.x, y: t.y, r: t.r, col: col(k.owner), age: 0 });
    t.capturedAt = G.time; t.prevOwner = was; G.lastCapAt = G.time;
    // A captured castle loses one level of each upgrade.
    if (t.up) t.up = { walls: Math.max(0, lvl(t, 'walls') - 1), barracks: Math.max(0, lvl(t, 'barracks') - 1) };
    if (was === 1) { G.stats.castlesLost++; G.events.push({ t: G.time, kind: 'lost', owner: k.owner }); }
    else if (k.owner === 1) G.events.push({ t: G.time, kind: 'took', owner: 1 });
    if (!reduceMotion) {
      // A cloud of dust kicked up around the castle's base.
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4, sp = 14 + Math.random() * 22;
        G.fx.push({ kind: 'dust', x: t.x + Math.cos(a) * t.r * 0.6, y: t.y + t.r * 0.45 + Math.sin(a) * t.r * 0.25,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4 - 6, s: 4 + Math.random() * 4, age: 0 });
      }
      // A brief shake when the player wins or loses a castle.
      if (!G.cfg.demo && (k.owner === 1 || was === 1)) G.shake = { until: G.time + 0.35, mag: was === 1 ? 6 : 4 };
    }
  }
}

// Columns from different kingdoms that meet on the road fight. Each side's
// road strength decides how many of the other it takes down.
function roadBattles() {
  const R = 9;
  const act = G.packets.filter(k => k.delay <= 0).sort((a, b) => a.x - b.x);
  let fought = false;
  for (let i = 0; i < act.length; i++) {
    const a = act[i];
    for (let j = i + 1; a.n > 0.05 && j < act.length && act[j].x - a.x < R; j++) {
      const b = act[j];
      if (b.n <= 0.05 || b.owner === a.owner || Math.abs(b.y - a.y) >= R || allied(a.owner, b.owner)) continue;
      const sa = roadOf(a.owner) * (a.str || 1), sb = roadOf(b.owner) * (b.str || 1);
      const m = Math.min(a.n * sa, b.n * sb);
      a.n -= m / sa; b.n -= m / sb;
      if (a.owner === 1) G.stats.roadLost += m / sa; else if (b.owner === 1) G.stats.roadLost += m / sb;
      fought = true;
      G.fx.push({ kind: 'clash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, age: 0 });
      emit('clash', { attacker: a.owner, defender: b.owner, road: true, lost: { [a.owner]: m / sa, [b.owner]: m / sb } });
    }
  }
  if (fought) G.packets = G.packets.filter(k => k.n > 0.05);
}

function totalOf(o) {
  let s = 0;
  for (const p of G.planets) if (p.owner === o) s += p.units;
  for (const k of G.packets) if (k.owner === o) s += k.n;
  return s;
}
