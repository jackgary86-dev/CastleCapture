// defense.js
//
// Siege Defense (#65): a solo survival mode. The player holds a fortress of five castles on the west
// edge; up to three rival lords muster at siege camps on the east edge and attack in timed waves, each
// bigger than the last and with a new trick: catapults from wave 4, a cavalry flank from wave 6 and a
// siege beast from wave 10. Between waves come a 20-second break and a coin payout. Score = waves
// survived + castles held when the last wave was beaten. It ends when the player's last castle falls.
//
// Like sim.js and grand.js this file has no DOM access, so tools/balance.js loads it (--mode defense).
// The menu card, HUD line, coin upgrades and end screen live in js/defense-ui.js. sim.js calls
// genDefenseMap() from newGame() and defenseTick() from update().

const DEFENSE = {
  start: 30,                   // starting troops in each fortress castle
  keeps: 6,                    // unclaimed keeps on the field
  firstBreak: 20,              // seconds before the first wave
  breakSeconds: 20,            // seconds between waves
  lordsAt: [1, 4, 7],          // the wave on which the first, second and third lord join the siege
  // Troops in a wave, before the difficulty multiplier: base * growth^(w - 1) + lin * (w - 1).
  base: 50, growth: 1.5, lin: 20,
  diffMul: { easy: 0.7, medium: 0.85, hard: 1 },
  siegeFrom: 4, siegeShare: 0.3,   // share of each lord's force that rolls as catapults (with a foot escort)
  flankFrom: 6, flankShare: 0.25,  // share that rides as cavalry against a castle away from the main blow
  // The siege beast: one huge column whose every "troop" hits beastStr times as hard, on castles and on the road.
  beastFrom: 10, beastBase: 30, beastPer: 4, beastStr: 3,
  columns: 10,                 // most columns one order of a wave marches in
  focus: 0.6,                  // chance each later lord joins the first lord's target
  capturedSend: 0.7,
  maxUnits: 2,                 // map units a defender may have standing at once (one more may be built each break)           // share of each castle a lord has taken that joins the next wave
  payout: 25, payoutPerWave: 3, payoutPerKeep: 5,   // coins at the end of each wave
  coinPerTroop: 1,             // coin price of a Walls or Barracks level, per troop it would cost
  aiSpendShare: 0.5,           // share of its coins an AI defender spends on upgrades at each break
  waveCap: 120,                // headless runs stop here
};

// The lords' siege camps can't be taken: a castle kind that is not enumerable, so assignKinds() never
// hands it out, the codex never lists it, and the AI never thinks a camp worth attacking.
Object.defineProperty(CASTLE_KINDS, 'siegecamp', {
  enumerable: false,
  value: { name: 'Siege camp', def: 1e6, prod: 0, worth: 0, desc: 'A rival lord musters each wave here. It cannot be taken.' },
});

// ---------- the daily siege ----------
// Today as YYYY-MM-DD in local time; the daily seed is that date as a number (2026-10-09 -> 20261009).
const defenseDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const defenseDailySeed = day => day.split('-').reduce((a, v) => a * 100 + (+v || 0), 0);

// A game's setup. The lords are three of the four other armies, drawn from the seed; a daily siege is
// fought on a homeland drawn from the seed too, at Knight, so everyone plays the same day.
function defenseCfg(armyId, diff = 'medium', day = null, seed = null) {
  if (seed == null) seed = day ? defenseDailySeed(day) : Math.floor(Math.random() * 1e9);
  const rnd = mulberry((seed ^ 0x51e6e) >>> 0);
  const lords = ARMY_IDS.filter(id => id !== armyId).map(id => [rnd(), id]).sort((a, b) => a[0] - b[0]).map(v => v[1]).slice(0, 3);
  return {
    mode: 'defense', seed, daily: day || null, fixedSeed: !!day, diff: day ? 'medium' : diff,
    armies: [armyId, ...lords], map: day ? ARMY_IDS[seed % ARMY_IDS.length] : armyId, events: false, n: 0,
  };
}

// ---------- the map ----------
// The same 1000 x 640 field as a two-kingdom battle, with its rivers and forests, but laid out for a
// siege: the fortress on the west edge, the camps on the east edge, unclaimed keeps in between (turned a quarter
// on portrait screens: fortress at the bottom, camps at the top).
const DEFENSE_FORT = [[0, 0, 30], [-15, -150, 22], [-15, 150, 22], [110, -75, 24], [110, 75, 24]];
// On a portrait phone the thumb bar (Power, Send, All) covers the lower left of the map and the power panel the
// top left (#78), so there the fortress draws in (its spread across the bottom shrinks to this share) and the
// siege camps stand this far in from the top edge rather than on it.
const DEFENSE_PORTRAIT = { spread: 0.7, campInset: 140 };
// portrait: turn the map a quarter so the fortress sits at the bottom of a tall screen and the camps at the
// top (#75), exactly as genMap() does for skirmishes; the map is otherwise the same as the landscape one.
function genDefenseMap(seed, theme, portrait = false) {
  const rnd = mulberry(seed);
  const W = 1000, H = 640, cx = W / 2, cy = H / 2;
  const starts = [{ x: 130, y: cy }, { x: W - 130, y: cy }];
  const T = makeTerrain(rnd, theme, W, H, 460, 320, [Math.PI, 0], starts);
  const pts = [];
  const fits = (x, y, r) => x - r > 40 && x + r < W - 40 && y - r * 1.3 > 30 && y + r * 1.3 < H - 30 &&
    pts.every(p => Math.hypot(p.x - x, p.y - y) > p.r + r + 34) &&
    waterDist(T, { x, y }) > r + 22 &&
    T.forests.every(f => Math.hypot(f.x - x, f.y - y) > f.r * 0.55 + r);
  // The fortress: a big keep and four towers round it, each nudged a little by the seed where it fits.
  for (const [dx, dy, r] of DEFENSE_FORT) {
    let x = 125 + dx, y = cy + dy * (portrait ? DEFENSE_PORTRAIT.spread : 1);
    for (let i = 0; i < 30; i++) {
      const jx = x + (rnd() - 0.5) * 30, jy = y + (rnd() - 0.5) * 30;
      if (fits(jx, jy, r)) { x = jx; y = jy; break; }
    }
    pts.push({ x, y, r, owner: 1, units: DEFENSE.start, home: true });
  }
  // A camp for each of the three lords, spread down the east edge.
  [-200, 0, 200].forEach((dy, i) => pts.push({ x: W - (portrait ? DEFENSE_PORTRAIT.campInset : 75), y: cy + dy, r: 24, owner: i + 2, units: 1, kind: 'siegecamp', camp: true }));
  for (let tries = 0, placed = 0; placed < DEFENSE.keeps && tries < 4000; tries++) {
    const r = 13 + rnd() * 15, x = 280 + rnd() * (W - 480), y = 50 + rnd() * (H - 100);
    if (!fits(x, y, r)) continue;
    pts.push({ x, y, r, owner: 0, units: Math.round(r * 0.45 + rnd() * r * 0.7) });
    placed++;
  }
  const rot = p => portrait ? { x: p.y, y: W - p.x } : { x: p.x, y: p.y };
  const rotV = (vx, vy) => portrait ? [vy, -vx] : [vx, vy];
  const planets = pts.map((p, id) => ({ id, ...p, ...rot(p) }));
  if (portrait) {
    T.rivers = T.rivers.map(r => r.map(rot));
    if (T.lake) T.lake = { ...rot(T.lake), r: T.lake.r };
    T.bridges = T.bridges.map(b => { const [tx, ty] = rotV(b.tx, b.ty); return { ...rot(b), tx, ty, e1: rot(b.e1), e2: rot(b.e2) }; });
    T.forests = T.forests.map(f => ({ ...rot(f), r: f.r }));
  }
  const w = portrait ? H : W, h = portrait ? W : H;
  return { planets, w, h, ...buildScenery(planets, T, theme, rnd, w, h) };
}

// ---------- the wave loop ----------
const isDefense = () => !!G && G.mode === 'defense';
const defenseHeld = (o = 1) => G.planets.filter(p => p.owner === o).length;

on('newGame', g => {
  if (g.cfg.mode !== 'defense') return;
  g.mode = 'defense';
  g.ais = [];          // the lords don't think for themselves: the waves below are their orders
  // The lords besiege you together: a standing pact between every pair of them, so their columns pass
  // each other on the road, and none will ever agree a truce with you.
  const lords = g.owners.slice(1), FOREVER = 1e12;   // finite, so it survives a save as JSON
  g.pacts = [];
  lords.forEach((a, i) => lords.slice(i + 1).forEach(b => g.pacts.push({ a, b, since: 0, until: FOREVER, betrayAt: null, betrayer: null })));
  for (const o of lords) g.pactCool[pactKey(1, o)] = FOREVER;
  // phase: 'break' (counting down to the next wave) or 'wave' (attackers on the field).
  // held: waves beaten; score: held + castles held when the last of them was beaten.
  g.def = { wave: 0, phase: 'break', left: DEFENSE.firstBreak, held: 0, score: 0, plan: null, lastPay: 0 };
});

// Who attacks in wave w, and with what. Plain numbers and owner ids, so it saves with the battle.
function defensePlan(w) {
  const m = DEFENSE.diffMul[G.cfg.diff] ?? 1;
  const total = Math.round((DEFENSE.base * DEFENSE.growth ** (w - 1) + DEFENSE.lin * (w - 1)) * m);
  const lords = G.owners.slice(1).filter((o, i) => w >= (DEFENSE.lordsAt[i] ?? Infinity));
  const each = total / Math.max(1, lords.length);
  const forces = lords.map((o, i) => {
    const n = Math.round(each);
    const siege = w >= DEFENSE.siegeFrom ? Math.round(n * DEFENSE.siegeShare) : 0;
    const flank = w >= DEFENSE.flankFrom ? Math.round(n * DEFENSE.flankShare) : 0;
    const beast = i === 0 && w >= DEFENSE.beastFrom ? Math.round((DEFENSE.beastBase + DEFENSE.beastPer * (w - DEFENSE.beastFrom)) * m) : 0;
    return { o, n, siege, flank, foot: Math.max(1, n - siege - flank), beast };
  });
  return { wave: w, total, forces, joins: lords.filter((o, i) => w === DEFENSE.lordsAt[i]) };
}

// The castle a lord's main blow falls on: the weakest walls within a fair march, with a little chance.
function defenseTarget(from, list, rnd) {
  const score = t => (t.units * defAt(t) + 10) * (1 + travel(from, t) / 600);
  const ranked = [...list].sort((a, b) => score(a) - score(b));
  return ranked.length > 1 && rnd() < 0.3 ? ranked[1] : ranked[0];
}

// launch(), with a wave's columns merged into at most `cols` bigger ones: a wave of hundreds marches as a
// few thick columns rather than dozens of thin ones, which keeps big waves readable and the step cheap.
function defenseMarch(o, from, to, n, type = 'foot', escort = false, cols = DEFENSE.columns) {
  if (n < 1) return [];
  const before = G.packets.length;
  launch(o, from, to, n, type, escort);
  const made = G.packets.splice(before), out = [];
  const per = Math.ceil(made.length / cols);
  for (let i = 0; i < made.length; i += per) {
    const group = made.slice(i, i + per), k = group[0];
    k.n = group.reduce((a, x) => a + x.n, 0);
    out.push(k);
  }
  G.packets.push(...out);
  return out;
}

function defenseLaunch() {
  const D = G.def, w = ++D.wave, plan = D.plan && D.plan.wave === w ? D.plan : defensePlan(w);
  D.phase = 'wave'; D.plan = null; D.startedAt = G.time;
  const rnd = mulberry((G.cfg.seed ^ Math.imul(w, 0x9e3779b1)) >>> 0);
  const mine = () => G.planets.filter(p => p.owner === 1);
  let focus = null;
  for (const f of plan.forces) {
    const camp = G.planets.find(p => p.camp && p.owner === f.o), list = mine();
    if (!camp || !list.length) break;
    camp.units = 1;
    // The lords mostly strike together: each joins the first lord's target unless it sees a weaker one.
    const main = focus && focus.owner === 1 && rnd() < DEFENSE.focus ? focus : defenseTarget(camp, list, rnd);
    focus = focus || main;
    if (f.siege) {
      const cat = Math.max(1, Math.round(f.siege * (1 - SIEGE_ESCORT)));
      defenseMarch(f.o, camp, main, cat, 'siege');
      defenseMarch(f.o, camp, main, f.siege - cat, 'foot', true);
    }
    // The flank rides for the castle furthest from the main blow, so help can't serve both.
    if (f.flank) defenseMarch(f.o, camp, [...list].sort((a, b) => travel(main, b) - travel(main, a))[0], f.flank, 'horse');
    defenseMarch(f.o, camp, main, f.foot, 'foot');
    // The siege beast goes for the biggest garrison, as one column.
    if (f.beast) {
      const at = [...list].sort((a, b) => b.units - a.units)[0];
      for (const b of defenseMarch(f.o, camp, at, f.beast, 'foot', false, 1)) { b.beast = true; b.str = DEFENSE.beastStr; b.delay = 0.4; }
    }
  }
  // Castles the lords have already taken send most of their garrisons at the nearest of yours.
  for (const p of G.planets) {
    if (p.owner < 2 || p.camp || p.units < 4) continue;
    const list = mine();
    if (!list.length) break;
    const t = list.sort((a, b) => travel(p, a) - travel(p, b))[0], n = Math.floor(p.units * DEFENSE.capturedSend);
    p.units -= n;
    defenseMarch(p.owner, p, t, n, 'foot');
  }
  emit('defense', { kind: 'wave', wave: w, plan });
}

function defenseClear() {
  const D = G.def;
  D.held = D.wave;
  D.score = D.held + defenseHeld(1);
  const keeps = G.planets.filter(p => p.owner === 1 && !p.home).length;
  const pay = DEFENSE.payout + DEFENSE.payoutPerWave * D.wave + DEFENSE.payoutPerKeep * keeps;
  G.coins[1] = Math.min(coinCap(), G.coins[1] + pay);
  D.lastPay = pay;
  // One more map unit may be built each break, up to DEFENSE.maxUnits standing.
  if (G.units.filter(u => u.owner === 1).length < DEFENSE.maxUnits) G.bought.delete(1);
  D.phase = 'break'; D.left = DEFENSE.breakSeconds;
  D.plan = defensePlan(D.wave + 1);
  emit('defense', { kind: 'cleared', wave: D.wave, coins: pay, score: D.score, keeps });
  if (G.ais.some(a => a.id === 1)) defenseAiSpend(1);
}

// Called from update() in place of the battle's own end checks.
function defenseTick(dt) {
  const D = G.def;
  if (!D || G.over) return;
  if (!G.planets.some(p => p.owner === 1)) {
    D.over = true;
    emit('defense', { kind: 'fallen', wave: D.wave, held: D.held, score: D.score });
    endBattle(false);
    return;
  }
  // During a break each camp shows the troops mustering there for the next wave.
  if (D.phase === 'break' && !D.plan) D.plan = defensePlan(D.wave + 1);
  for (const p of G.planets) {
    if (!p.camp) continue;
    const f = D.phase === 'break' && D.plan ? D.plan.forces.find(x => x.o === p.owner) : null;
    p.units = f ? f.n + f.beast : 1;
  }
  if (D.phase === 'break') {
    D.left -= dt;
    if (D.left <= 0) defenseLaunch();
  } else if (!G.packets.some(k => k.owner !== 1)) defenseClear();
}

// Start the next wave now rather than wait out the break.
function defenseCallWave() {
  if (!isDefense() || G.over || G.def.phase !== 'break') return false;
  G.def.left = 0;
  return true;
}

// ---------- spending coins on walls and barracks ----------
const defenseUpgradePrice = (p, kind) => { const c = upgradeCost(p, kind); return c === null ? null : Math.round(c * DEFENSE.coinPerTroop); };
function defenseBuyUpgrade(o, p, kind) {
  if (!isDefense() || G.over || p.owner !== o) return false;
  const price = defenseUpgradePrice(p, kind);
  if (price === null || G.coins[o] < price) return false;
  G.coins[o] -= price;
  p.up = { walls: lvl(p, 'walls'), barracks: lvl(p, 'barracks') };
  p.up[kind]++;
  G.fx.push({ kind: 'upgrade', x: p.x, y: p.y, r: p.r, col: col(p.owner), age: 0 });
  emit('upgrade', { castle: p, kind, coins: price });
  return true;
}
// An AI defender (headless runs) spends part of each payout on walls, then barracks, nearest the camps
// first; the rest is left for the map unit it saves for (aiBuyUnit, once a break).
function defenseAiSpend(o) {
  let budget = G.coins[o] * DEFENSE.aiSpendShare;
  const camps = G.planets.filter(p => p.camp);
  const danger = p => Math.min(...camps.map(c => travel(p, c)));
  const mine = G.planets.filter(p => p.owner === o).sort((a, b) => danger(a) - danger(b));
  for (const kind of ['walls', 'barracks']) {
    for (const p of mine) {
      const price = defenseUpgradePrice(p, kind);
      if (price === null || price > budget) continue;
      if (defenseBuyUpgrade(o, p, kind)) budget -= price;
    }
  }
}
