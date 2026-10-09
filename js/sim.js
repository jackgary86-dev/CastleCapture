// sim.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Map generation, battle state, army stats and powers, the AI lords, coins and map units, and the simulation step. No DOM access: it reports through emit() and the headless balance runner loads it.

// ---------- map generation ----------
// opts: scale (map size multiplier), start (starting troops), neutral (unclaimed keep garrison multiplier).
function genMap(seed, n, players, portrait, theme, aiBonus = 0, opts = {}) {
  const rnd = mulberry(seed);
  const S = opts.scale ?? 1, START = opts.start ?? 40, NM = opts.neutral ?? 1;
  const W = Math.round(1000 * S), H = Math.round(640 * S), cx = W / 2, cy = H / 2;
  const pts = [];
  const fits = (x, y, r) => x - r > 40 && x + r < W - 40 && y - r * 1.3 > 30 && y + r * 1.3 < H - 30 &&
    pts.every(p => Math.hypot(p.x - x, p.y - y) > p.r + r + 34);
  const garrison = r => Math.round((r * 0.45 + rnd() * r * 0.7) * NM);

  if (players === 2) {
    pts.push({ x: 130, y: cy, r: 28, owner: 1, units: START });
    pts.push({ x: W - 130, y: cy, r: 28, owner: 2, units: START + aiBonus });
    if (n % 2 === 1) pts.push({ x: cx, y: cy, r: 32, owner: 0, units: Math.round(45 * NM) });
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
    const ax = 430 * S, ay = 260 * S;
    for (let k = 0; k < 3; k++) {
      const a = Math.PI + k * 2 * Math.PI / 3;
      pts.push({ x: cx + Math.cos(a) * ax * 0.92, y: cy + Math.sin(a) * ay * 0.92, r: 26, owner: k + 1, units: k ? START + aiBonus : START });
    }
    pts.push({ x: cx, y: cy, r: 33, owner: 0, units: Math.round(60 * NM) });
    let tries = 0;
    while (pts.length < n && tries++ < 4000) {
      const r = 13 + rnd() * 17, a0 = rnd() * 2 * Math.PI / 3, rr = 0.28 + rnd() * 0.7;
      const trio = [0, 1, 2].map(k => { const a = a0 + k * 2 * Math.PI / 3; return { x: cx + Math.cos(a) * ax * rr, y: cy + Math.sin(a) * ay * rr }; });
      const ok = trio.every((p, i) => fits(p.x, p.y, r) && trio.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 2 * r + 34));
      if (!ok) continue;
      const u = garrison(r);
      trio.forEach(p => pts.push({ ...p, r, owner: 0, units: u }));
    }
  }
  // Portrait screens: rotate the map so the player starts at the bottom.
  const rot = p => portrait ? { x: p.y, y: W - p.x } : { x: p.x, y: p.y };
  const planets = pts.map((p, id) => ({ id, ...rot(p), r: p.r, owner: p.owner, units: p.units }));
  const w = portrait ? H : W, h = portrait ? W : H;
  const clear = (x, y, pad) => planets.every(p => Math.hypot(p.x - x, p.y - y) > p.r + pad);

  // Scenery: roads between neighbouring castles, then the homeland's own features.
  const roads = [], seen = new Set();
  for (const a of planets) {
    planets.filter(b => b !== a).sort((b, c) => dist(a, b) - dist(a, c)).slice(0, 2).forEach(b => {
      const key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id);
      if (seen.has(key)) return;
      seen.add(key);
      const mx = (a.x + b.x) / 2 + (rnd() - 0.5) * 50, my = (a.y + b.y) / 2 + (rnd() - 0.5) * 50;
      roads.push({ a, b, mx, my });
    });
  }
  const meadows = Array.from({ length: 9 }, () => ({ x: rnd() * w, y: rnd() * h, rx: 80 + rnd() * 140, ry: 50 + rnd() * 90 }));
  const pools = [];
  for (let i = 0; i < 300 && pools.length < theme.pools; i++) {
    const x = 40 + rnd() * (w - 80), y = 40 + rnd() * (h - 80), rx = 18 + rnd() * 26;
    if (clear(x, y, rx + 24)) pools.push({ x, y, rx, ry: rx * (0.45 + rnd() * 0.2) });
  }
  const trees = [];
  for (let i = 0; i < 600 && trees.length < theme.trees; i++) {
    let x, y;
    if (theme.tree === 'palm' && pools.length) {
      // Palms grow around the oases.
      const o = pools[Math.floor(rnd() * pools.length)], a = rnd() * Math.PI * 2;
      x = o.x + Math.cos(a) * (o.rx + 6 + rnd() * 14); y = o.y + Math.sin(a) * (o.ry + 5 + rnd() * 10);
    } else {
      const base = trees.length && rnd() < theme.clump ? trees[Math.floor(rnd() * trees.length)] : { x: rnd() * w, y: rnd() * h };
      x = base.x + (rnd() - 0.5) * 60; y = base.y + (rnd() - 0.5) * 60;
    }
    if (x < 8 || y < 8 || x > w - 8 || y > h - 8 || !clear(x, y, 30)) continue;
    if (theme.tree !== 'palm' && pools.some(o => Math.hypot((o.x - x) / o.rx, (o.y - y) / o.ry) < 1.2)) continue;
    trees.push({ x, y, s: 5 + rnd() * 4, shade: rnd() });
  }
  trees.sort((a, b) => a.y - b.y);
  const rocks = [];
  for (let i = 0; i < 300 && rocks.length < theme.rocks; i++) {
    const x = rnd() * w, y = rnd() * h;
    if (clear(x, y, 22)) rocks.push({ x, y, s: 2 + rnd() * 3.5 });
  }
  return { planets, w, h, roads, meadows, trees, pools, rocks };
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
  const theme = THEMES[ARMIES[cfg.map].map];
  const map = genMap(cfg.seed, cfg.n, players, portrait, theme, cfg.aiBonus || 0, { scale: cfg.mapScale, start: cfg.start, neutral: cfg.neutral });
  assignKinds(map.planets, cfg.seed);
  const owners = players === 2 ? [1, 2] : [1, 2, 3];
  const aiIds = cfg.demo ? [1, 2] : owners.slice(1);
  G = {
    cfg, ...map, theme, packets: [], fx: [], time: 0, over: false, paused: false, owners,
    fac: Object.fromEntries(owners.map((o, i) => [o, cfg.armies[i]])),
    pw: Object.fromEntries(owners.map(o => [o, { ready: FIRST_CHARGE, until: -1 }])),
    ais: aiIds.map((id, i) => ({ id, diff: cfg.demo ? 'medium' : cfg.diff, timer: 1.4 + i * 0.35, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() })),
    caps: 0, peak: 0, hintDone: !!cfg.demo, portrait,
    intro: false, lastTaunt: -99, tauntAt: {}, nearDefeat: new Set(), maxCastles: {}, weakSince: {}, surrendered: new Set(),
    coins: Object.fromEntries(owners.map(o => [o, 0])), units: [], shots: [], bought: new Set(), placing: null,
    roadPts: roadSamples(map.roads), rallyClock: 0,
    history: [], events: [], nextSample: 0, stats: { sent: 0, roadLost: 0, castlesLost: 0, powerUses: 0 },
  };
  emit('newGame', G);
}

function demoCfg() {
  const pair = shuffle(ARMY_IDS).slice(0, 2);
  return { demo: true, seed: Math.floor(Math.random() * 1e9), n: 18, diff: 'medium', armies: pair, map: pick(pair) };
}

// ---------- army stats and powers ----------
const army = o => ARMIES[G.fac[o]];
const col = o => o ? army(o).color : NEUTRAL;
const powerOn = (o, id) => o && army(o).power.id === id && G.time < G.pw[o].until;
const atkOf = o => army(o).stats.atk * (powerOn(o, 'bloodMoon') ? 1.5 : 1);
const defOf = o => o ? army(o).stats.def * (powerOn(o, 'stoneOath') ? 2 : 1) : 1;
const speedOf = o => SPEED * (G.cfg.speedMul ?? 1) * army(o).stats.speed * (powerOn(o, 'bloodMoon') ? 2 : 1);
const rechargeTime = () => G.cfg.recharge ?? RECHARGE;
const roadOf = o => atkOf(o) * army(o).stats.road;
// Amaru, as an AI rival, bribes the garrisons of unclaimed keeps in his first minute: they count 1.6×.
const bribes = (o, t) => t.owner === 0 && G.fac[o] === 'solmara' && G.time < 60 && G.ais.some(a => a.id === o) ? 1.6 : 1;
const strikeOf = (o, t) => atkOf(o) * (t.owner === 0 ? army(o).stats.neutral : 1) * bribes(o, t);
const tierOf = p => p.r < 18 ? 1 : p.r < 26 ? 2 : 3;
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
const rate = p => p.owner ? p.r * PROD * army(p.owner).stats.prod * (powerOn(p.owner, 'goldenTithe') ? 2 : 1) * (wardOver(p, p.owner) ? 2 : 1) * upkeepOf(p) * barracksTrainMul(p) * (kindOf(p) ? kindOf(p).prod : 1) * villageBoost(p) : 0;
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
      if (k.owner === p.owner || k.delay > 0 || k.n <= 0.05) continue;
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
    if (s === target || s.owner !== owner) continue;
    const n = Math.floor(s.units * frac);
    if (n < 1) continue;
    s.units -= n;
    launched = true;
    if (owner === 1) G.stats.sent += n;
    const k = Math.min(30, n, Math.max(3, Math.ceil(n / 2)));
    const ang = Math.atan2(target.y - s.y, target.x - s.x);
    for (let i = 0; i < k; i++) {
      const cnt = Math.floor(n / k) + (i < n % k ? 1 : 0);
      const off = (Math.random() - 0.5) * s.r * 1.1;
      G.packets.push({
        owner, from: s, to: target, n: cnt, str: soldierStr(s), delay: i * 0.06, phase: Math.random() * 6.28,
        x: s.x + Math.cos(ang) * s.r * 0.8 - Math.sin(ang) * off,
        y: s.y + Math.sin(ang) * s.r * 0.8 + Math.cos(ang) * off,
      });
    }
  }
  return launched;
}

function incomingTable() {
  const inc = G.planets.map(() => [0, 0, 0, 0]);
  for (const k of G.packets) inc[k.to.id][k.owner] += k.n;
  return inc;
}

// ---------- AI: each army's personality shapes how it plays ----------
// Troops `me` must send to take `t`, after travel time, reinforcements and army strengths.
function needAt(t, far, inc, me) {
  let def = t.units;
  if (t.owner !== 0) def += rate(t) * (far / speedOf(me)) + inc[t.id][t.owner];
  def = def * defAt(t) / strikeOf(me, t) + archerLoss(t, me);
  def -= inc[t.id][me];
  return Math.ceil(def + 2);
}

const threatOn = (p, me, inc) => inc[p.id].reduce((a, v, o) => o !== me ? a + v : a, 0);

// When each AI fires its power. Named lords override their army's default timing.
function aiPower(ai, inc, mine) {
  const me = ai.id, id = G.fac[me];
  if (G.pw[me].ready > 0) return;
  if (ai.readyAt == null) ai.readyAt = G.time;
  const waited = G.time - ai.readyAt;
  if (ai.diff === 'easy' && Math.random() < 0.6) return;
  const falling = mine.filter(p => threatOn(p, me, inc) >= 8 && threatOn(p, me, inc) > (p.units + inc[p.id][me]) * defAt(p));
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
      use = waited > 60 && G.planets.some(p => p.owner && p.owner !== me && p.units >= 30);
      break;
  }
  if (use) usePower(me);
}

function aiThink(ai) {
  const me = ai.id, id = G.fac[me], P = G.planets, d = ai.diff;
  const pz = { ...army(me).ai };
  const mine = P.filter(p => p.owner === me);
  if (!mine.length) return;
  const inc = incomingTable();
  const enemyCastles = P.filter(p => p.owner && p.owner !== me);
  const nearestOf = (p, list) => list.length ? Math.min(...list.map(q => dist(p, q))) : Infinity;
  aiPower(ai, inc, mine);
  aiBuyUnit(ai, mine);

  // Sigrun: the moment her blizzard lifts, strike the castles that attacked her.
  if (id === 'frostmark' && ai.counter && G.time >= G.pw[me].until) {
    const targets = P.filter(p => ai.counter.has(p.id) && p.owner && p.owner !== me).sort((a, b) => a.units - b.units);
    ai.counter = null;
    if (targets.length) {
      const t = targets[0];
      const srcs = mine.filter(s => s.units > 8).sort((a, b) => dist(a, t) - dist(b, t)).slice(0, 4);
      if (send(me, srcs, t, 0.6)) { lordSays(me, 'counter', true); return; }
    }
  }

  if (d === 'easy') {
    if (Math.random() < 0.45) return;
    const srcs = mine.filter(p => p.units >= Math.max(14, pz.keep));
    if (!srcs.length) return;
    const s = pick(srcs);
    let ts = P.filter(p => p.owner !== me).sort((a, b) => dist(s, a) - dist(s, b)).slice(0, 5);
    // Aggressive armies prefer enemy castles even on easy; defensive ones prefer quiet expansion.
    const enemies = ts.filter(t => t.owner), neutrals = ts.filter(t => !t.owner);
    if (pz.enemyBias > 1.5 && enemies.length) ts = enemies;
    else if (pz.enemyBias < 1 && neutrals.length) ts = neutrals;
    if (ts.length) send(me, [s], pick(ts), pz.sendFrac);
    return;
  }

  // Amaru expands faster than anyone in the first minute.
  const amaruRush = id === 'solmara' && G.time < 60;
  if (amaruRush) { pz.neutralBias *= 3; pz.sendFrac = 0.55; }

  // Defend castles about to fall. Defensive armies react earlier; Torvek never does.
  if (id !== 'kharzul') {
    for (const p of mine) {
      const threat = threatOn(p, me, inc);
      const hold = (p.units + inc[p.id][me]) * defAt(p) + rate(p) * 1.5;
      if (threat > 0 && threat > hold * pz.defendAt) {
        const helpers = mine.filter(q => q !== p && q.units > 8).sort((a, b) => dist(a, p) - dist(b, p));
        if (helpers.length) {
          send(me, d === 'hard' ? helpers.slice(0, 2) : [helpers[0]], p, 0.5);
          if (d === 'medium') return;
        }
      }
    }
  }

  // Isolde keeps her front-line castles topped up before she attacks anywhere.
  if (id === 'aldmere' && enemyCastles.length && mine.length > 1 && Math.random() < 0.5) {
    const byDanger = [...mine].sort((a, b) => nearestOf(a, enemyCastles) - nearestOf(b, enemyCastles));
    const frontLine = byDanger.filter(p => nearestOf(p, enemyCastles) < nearestOf(byDanger[0], enemyCastles) * 1.3);
    const weak = frontLine.find(p => p.units < 18);
    const rear = byDanger.slice().reverse().find(p => !frontLine.includes(p) && p.units > 25);
    if (weak && rear) { send(me, [rear], weak, 0.5); return; }
  }

  // Sigrun intercepts columns marching on unclaimed keeps near her lands when her shieldwall would win.
  if (id === 'frostmark' && Math.random() < 0.6) {
    for (const nt of P.filter(p => p.owner === 0 && nearestOf(p, mine) < 220)) {
      const enemyIn = G.packets.filter(k => k.to === nt && k.owner !== me);
      if (!enemyIn.length || inc[nt.id][me] > 0) continue;
      const strength = enemyIn.reduce((a, k) => a + k.n * roadOf(k.owner), 0);
      const h = mine.filter(s => s.units > 10).sort((a, b) => dist(a, nt) - dist(b, nt))[0];
      if (h && Math.floor(h.units * 0.5) * roadOf(me) > strength) { send(me, [h], nt, 0.5); return; }
    }
  }

  // Defensive armies turn bold once they clearly outnumber everyone.
  const myTotal = totalOf(me);
  const enemyTotal = Math.max(1, ...G.owners.filter(o => o !== me).map(totalOf));
  const bold = myTotal > enemyTotal * pz.boldAt ? 2 : 1;

  // Torvek fixes on the strongest rival's biggest castle and keeps hammering it.
  if (id === 'kharzul' && (!ai.focus || ai.focus.owner === me || ai.focus.owner === 0)) {
    const rivals = G.owners.filter(o => o !== me).sort((a, b) => totalOf(b) - totalOf(a));
    ai.focus = P.filter(p => p.owner === rivals[0]).sort((a, b) => b.units - a.units)[0] || null;
  }

  if (aiUpgrade(ai, mine, enemyCastles, inc, pz)) return;

  let candidates = P.filter(t => t.owner !== me);
  // Sigrun holds her army home early, taking only neutrals and near-empty castles.
  if (id === 'frostmark' && G.time < 100 && bold === 1) candidates = candidates.filter(t => t.owner === 0 || t.units < 5);
  // Amaru's first minute: claim every keep on his side of the map, and nothing that brings him close to a rival.
  if (amaruRush) candidates = candidates.filter(t => (t.owner === 0 && nearestOf(t, mine) <= nearestOf(t, enemyCastles)) || (t.owner && t.units < 5));
  // Isolde advances one castle at a time once she outnumbers you two to one.
  if (id === 'aldmere' && myTotal > enemyTotal * 2) candidates = candidates.sort((a, b) => nearestOf(a, mine) - nearestOf(b, mine)).slice(0, 3);

  let best = null;
  const maxSrc = d === 'hard' ? 4 : amaruRush ? 2 : 1;
  // While rushing, Amaru's castles within reach of a rival keep at least 10 troops home.
  const exposed = s => amaruRush && nearestOf(s, enemyCastles) < 300;
  for (const t of candidates) {
    const srcs = mine.filter(s => s.units >= pz.keep && (!exposed(s) || s.units * (1 - pz.sendFrac) >= 10)).sort((a, b) => dist(a, t) - dist(b, t));
    const chosen = [];
    let sum = 0, far = 0, need = Infinity;
    // Amaru avoids even fights against other kingdoms.
    const margin = pz.margin * (id === 'solmara' && t.owner && bold === 1 ? 1.15 : 1);
    for (const s of srcs) {
      if (chosen.length >= maxSrc) break;
      chosen.push(s);
      sum += Math.floor(s.units * pz.sendFrac);
      far = Math.max(far, dist(s, t));
      need = needAt(t, far, inc, me) * margin;
      if (sum >= need) break;
    }
    if (!chosen.length || need <= 2 || sum < need) continue;
    let worth = (t.r * PROD + 0.4) * (t.owner === 0 ? pz.neutralBias : pz.enemyBias * bold);
    // Special kinds: war camps and villages are prizes; a village is worth more the more of our castles it would speed up.
    if (t.kind) {
      worth *= CASTLE_KINDS[t.kind].worth;
      if (t.kind === 'village') worth *= 1 + 0.3 * mine.filter(m => dist(m, t) <= CASTLE_KINDS.village.aura).length;
    }
    if (t.owner && t.units < t.r * 0.6) worth *= pz.opportunist;
    if (id === 'kharzul' && t === ai.focus) worth *= 2.5;
    if (id === 'nyx') {
      // Veyra pounces on castles that were just emptied, and boxes rivals in with nearby keeps.
      const prev = ai.snap.get(t.id);
      if (t.owner && prev >= 10 && t.units < prev * 0.55) worth *= 4;
      if (!t.owner && nearestOf(t, enemyCastles) < 200) worth *= 1.6;
    }
    const score = worth / (need + far * 0.06);
    if (!best || score > best.score) best = { score, chosen, t, sum };
  }
  if (id === 'nyx') ai.snap = new Map(P.map(p => [p.id, p.units]));

  if (best) {
    const big = best.t.owner && (best.sum >= 20 || (id === 'kharzul' && best.sum >= 10));
    // Veyra drops the crows before her main attack lands; Torvek charges alongside his.
    if (id === 'nyx' && big && G.pw[me].ready === 0) usePower(me);
    send(me, best.chosen, best.t, pz.sendFrac);
    if (id === 'kharzul' && big && G.pw[me].ready === 0) usePower(me);
    return;
  }

  // Nothing worth attacking: defensive armies move troops from safe castles to the front.
  if (pz.front && Math.random() < 0.5 && mine.length > 1 && enemyCastles.length) {
    const byDanger = [...mine].sort((a, b) => nearestOf(a, enemyCastles) - nearestOf(b, enemyCastles));
    const front = byDanger[0], rear = byDanger[byDanger.length - 1];
    if (rear !== front && rear.units > 20) send(me, [rear], front, 0.5);
  }
}

// ---------- coins and map units ----------
// Points along each drawn road, so map units aren't placed on top of one.
function roadSamples(roads) {
  const pts = [];
  for (const r of roads) {
    const x0 = r.a.x, y0 = r.a.y + r.a.r * 0.5, x1 = r.b.x, y1 = r.b.y + r.b.r * 0.5;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, u = 1 - t;
      pts.push({ x: u * u * x0 + 2 * u * t * r.mx + t * t * x1, y: u * u * y0 + 2 * u * t * r.my + t * t * y1 });
    }
  }
  return pts;
}

// Why a spot can't take a map unit, or null if it can.
function placeProblem(o, x, y) {
  if (x < 24 || y < 30 || x > G.w - 24 || y > G.h - 14) return 'Too close to the edge of the map';
  if (!G.planets.some(p => p.owner === o && Math.hypot(p.x - x, p.y - y) <= PLACE_REACH)) return 'Too far from your castles';
  if (G.planets.some(p => Math.hypot(p.x - x, p.y - (y - 6)) < p.r * 1.25 + 14)) return 'Too close to a castle';
  if (G.roadPts.some(q => Math.hypot(q.x - x, q.y - y) < 12)) return 'Can\'t build on a road';
  if (G.units.some(u => Math.hypot(u.x - x, u.y - y) < 36)) return 'Too close to another map unit';
  return null;
}

function buyUnit(o, type, x, y) {
  const U = MAP_UNITS[type];
  if (G.bought.has(o) || G.coins[o] < U.price || placeProblem(o, x, y)) return false;
  G.coins[o] -= U.price;
  G.bought.add(o);
  G.units.push({ owner: o, type, x, y, cd: 1, fired: -9, aim: 0 });
  G.fx.push({ kind: 'capture', x, y: y - 8, r: 10, col: col(o), age: 0 });
  emit('build', { o, unit: U });
  return true;
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
        if (k.owner === u.owner || k.delay > 0 || k.n <= 0.05) continue;
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
      const target = G.planets.filter(p => p.owner && p.owner !== u.owner && dist(u, p) <= MAP_UNITS.trebuchet.range).sort((a, b) => b.units - a.units)[0];
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
  for (const p of G.planets) p.units += rate(p) * dt;
  for (const o of G.owners) {
    const pw = G.pw[o], was = pw.ready;
    pw.ready = Math.max(0, pw.ready - dt);
    if (was > 0 && pw.ready === 0) emit('powerReady', { o });
  }

  for (let i = G.packets.length - 1; i >= 0; i--) {
    const k = G.packets[i];
    if (frozen(k.owner)) continue;
    if (k.delay > 0) { k.delay -= dt; continue; }
    const t = k.to, dx = t.x - k.x, dy = t.y - k.y, dd = Math.hypot(dx, dy);
    if (dd <= t.r * 0.8) {
      G.packets.splice(i, 1);
      arrive(k, t);
      continue;
    }
    const step = Math.min(dd, speedOf(k.owner) * (slowedAt(k) ? 0.5 : 1) * dt);
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
  for (const o of G.owners) G.coins[o] += incomeOf(o) / 60 * dt;
  mapUnits(dt);
  archersTick(dt);

  for (const f of G.fx) f.age += dt;
  for (const f of G.fx) if (f.kind === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; }
  G.fx = G.fx.filter(f => f.age < ({ capture: 0.9, crows: 2.6, dust: 0.9, impact: 0.6, bolt: 0.2, arrow: 0.3, upgrade: 0.8 }[f.kind] || 0.35));

  const intervals = { easy: 2.2, medium: 1.3, hard: 0.7 };
  for (const ai of G.ais) {
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
  else if (G.owners.slice(1).every(o => !alive(o))) endBattle(true);
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
    const weak = totalOf(o) / sum < SURRENDER_SHARE && castles.length <= 2;
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
    t.capturedAt = G.time; t.prevOwner = was;
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
      if (b.n <= 0.05 || b.owner === a.owner || Math.abs(b.y - a.y) >= R) continue;
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
