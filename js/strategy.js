// strategy.js
//
// Deeper strategy (#67): castle specialisations, supply lines, terrain and heroes. Like sim.js it has no
// DOM access, so tools/balance.js loads it; the badges, the branch buttons, the hero standard and the
// Custom battle toggles live in js/strategy-ui.js.
//
// Every feature is off unless the battle's cfg.strategy turns it on ({ spec, supply, terrain, heroes },
// each true or false), so battles without it play exactly as before. sim.js asks this file through small
// gated hooks: stratRateMul() in rate(), stratDefMul() in defAt(), stratCapMul() in capOf(),
// stratCoinMul() in incomeOf(), stratSpeedMul() when a column steps, stratLaunch() when one sets off,
// and strategyTick() from update(). strategyWorthMul(t, me) is for the AI lords' target choice.

const STRATEGY = {
  // Specialisation: a castle at level 2 (one upgrade, of its Walls or Barracks, above a plain castle) picks
  // one branch for good.
  spec: {
    minLevels: 1,
    cost: [10, 15, 20],                                              // coins, for a small, medium and large castle
    keep:     { name: 'Keep',     def: 1.25, cap: 1.4, desc: 'Walls and a bigger garrison: defenders count 25% more and it holds 40% more.' },
    barracks: { name: 'Barracks', rate: 1.3, desc: 'Trains 30% faster.' },
    market:   { name: 'Market',   coins: 2.5, rate: 0.9, desc: 'Earns 2.5x the coins, but trains 10% slower.' },
  },
  supplyHops: 3,        // a castle more than this many hops (castle to neighbouring castle) from your supplied castles is cut off
  cutOff: 0.5,          // ...and trains at this speed
  supplyEvery: 1,       // seconds between supply checks
  hillDef: 1.25,        // defenders of a castle on a hill count this much more
  hillShare: 0.25,      // share of unclaimed keeps that stand on hills (in matching sets, so maps stay fair)
  fordSlow: 0.6,        // columns wading a river crossing march at this speed
  fordReach: 22,        // ...within this distance of the crossing
  roadFast: 1.2,        // columns on a road march this much faster
  heroStr: 1.3,         // a column led by its lord's champion strikes this much harder
  heroDef: 1.2,         // ...and the castle the champion waits in defends this much better
  heroMin: 6,           // the champion only rides out with a column of at least this many troops
  heroBack: 90,         // seconds before a fallen champion returns
};
const SPEC_IDS = ['keep', 'barracks', 'market'];
const stratOn = f => !!(G && G.cfg.strategy && G.cfg.strategy[f]);
// Every feature on: what tools/balance.js --strategy on and the Custom battle defaults use.
const STRATEGY_ALL = { spec: true, supply: true, terrain: true, heroes: true };

on('newGame', g => {
  const S = g.cfg.strategy;
  if (!S) return;
  // Hills: whole matching sets of unclaimed keeps, chosen from the map's seed, so every kingdom gets the same.
  if (S.terrain) {
    const rnd = mulberry((g.cfg.seed ^ 0x27d4eb2d) >>> 0), groups = new Map();
    for (const p of g.planets) {
      if (p.owner || p.hill) continue;
      const key = `${p.r.toFixed(3)}|${p.units}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const want = Math.round(g.planets.filter(p => !p.owner).length * STRATEGY.hillShare);
    let given = 0;
    // A seeded Fisher-Yates shuffle, as assignKinds uses, so every browser picks the same hills for a seed (#89);
    // sorting with a random comparator left the order to each browser's sort.
    const sets = [...groups.values()];
    for (let i = sets.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sets[i], sets[j]] = [sets[j], sets[i]]; }
    for (const set of sets) {
      if (given >= want) break;
      for (const p of set) p.high = true;
      given += set.length;
    }
    // A coarse grid of the road, for the road speed bonus.
    g.roadCells = new Set((g.roadPts || []).map(q => `${Math.floor(q.x / 14)},${Math.floor(q.y / 14)}`));
  }
  g.roadNext = supplyGraph(g);
  g.strat = {
    supplied: {}, supplyClock: 0,
    // capital: the castle supply flows from; heroes: where each lord's champion is.
    capital: Object.fromEntries(g.owners.map(o => [o, (g.planets.find(p => p.owner === o) || {}).id ?? null])),
    heroes: S.heroes ? Object.fromEntries(g.owners.map(o => [o, { at: (g.planets.find(p => p.owner === o) || {}).id ?? null, back: null }])) : {},
  };
  refreshSupply(g);
});

// ---------- specialisation ----------
const specOf = p => (stratOn('spec') && p.spec && STRATEGY.spec[p.spec]) || null;
const specCost = p => STRATEGY.spec.cost[tierOf(p) - 1];
const canSpecialise = p => stratOn('spec') && !!p.owner && !p.spec && !p.hill
  && lvl(p, 'walls') + lvl(p, 'barracks') >= STRATEGY.spec.minLevels;
// Pick a branch for castle p, paid for in coins (the player's castle panel, or a lord in strategyTick).
// True if it took.
function specialise(p, branch) {
  if (!SPEC_IDS.includes(branch) || !canSpecialise(p) || G.coins[p.owner] < specCost(p)) return false;
  G.coins[p.owner] -= specCost(p);
  p.spec = branch;
  G.fx.push({ kind: 'upgrade', x: p.x, y: p.y, r: p.r, col: col(p.owner), age: 0 });
  emit('specialise', { castle: p, branch });
  return true;
}

// ---------- supply lines ----------
// The hop graph supply runs along: every road, each castle's three nearest neighbours by marching distance,
// and, wherever that still leaves the map in separate pieces, a link between the closest castles of two
// pieces, so a chain of castles can always carry supply anywhere. Distances come from g.paths, built
// before 'newGame' fires.
function supplyGraph(g) {
  const P = g.planets, N = P.length, next = P.map(() => new Set());
  const len = (a, b) => g.paths[a * N + b].len;
  const link = (a, b) => { if (a !== b) { next[a].add(b); next[b].add(a); } };
  for (const r of g.roads || []) link(r.a.id, r.b.id);
  for (const p of P) P.filter(q => q !== p).sort((a, b) => len(p.id, a.id) - len(p.id, b.id)).slice(0, 3).forEach(q => link(p.id, q.id));
  // Join the pieces: grow from castle 0, always adding the shortest link out of the reached set.
  const reached = new Set();
  const spread = from => { const q = [from]; reached.add(from); while (q.length) for (const n of next[q.shift()]) if (!reached.has(n)) { reached.add(n); q.push(n); } };
  spread(0);
  while (reached.size < N) {
    let best = null;
    for (const a of reached) for (let b = 0; b < N; b++) if (!reached.has(b) && (!best || len(a, b) < best[2])) best = [a, b, len(a, b)];
    link(best[0], best[1]);
    spread(best[1]);
  }
  return next.map(set => [...set].sort((a, b) => a - b));
}
// Supply flows out from each kingdom's capital (its starting castle, or its biggest castle once that has
// fallen) from castle to neighbouring castle (supplyGraph), through its own castles: a castle is supplied
// if a supplied castle of its owner is within STRATEGY.supplyHops hops.
function refreshSupply(g = G) {
  const S = g.strat;
  if (!S) return;
  for (const o of g.owners) {
    let cap = g.planets[S.capital[o]];
    if (!cap || cap.owner !== o) {
      cap = g.planets.filter(p => p.owner === o).sort((a, b) => b.units - a.units)[0];
      S.capital[o] = cap ? cap.id : null;
    }
    const ok = new Set();
    if (cap) {
      // Breadth-first over roads; hops reset at every castle of ours, so a chain carries supply on.
      const best = new Map([[cap.id, 0]]), queue = [cap.id];
      ok.add(cap.id);
      while (queue.length) {
        const id = queue.shift(), d = best.get(id);
        for (const n of g.roadNext[id] || []) {
          const own = g.planets[n].owner === o, nd = own ? 0 : d + 1;
          if (!own && nd >= STRATEGY.supplyHops) continue;
          if (own && d + 1 > STRATEGY.supplyHops) continue;
          if (best.has(n) && best.get(n) <= nd) continue;
          best.set(n, nd); queue.push(n);
          if (own) ok.add(n);
        }
      }
    }
    S.supplied[o] = [...ok];
  }
}
const suppliedAt = p => !stratOn('supply') || !p.owner || !G.strat || !G.strat.supplied[p.owner] || G.strat.supplied[p.owner].includes(p.id);

// ---------- the hooks sim.js calls (only when cfg.strategy is set) ----------
const stratRateMul = p => {
  const S = specOf(p);
  return (S && S.rate ? S.rate : 1) * (suppliedAt(p) ? 1 : STRATEGY.cutOff);
};
const stratDefMul = p => {
  const S = specOf(p);
  return (S && S.def ? S.def : 1) * (stratOn('terrain') && p.high ? STRATEGY.hillDef : 1) * (heroAt(p) ? STRATEGY.heroDef : 1);
};
const stratCapMul = p => { const S = specOf(p); return S && S.cap ? S.cap : 1; };
const stratCoinMul = p => { const S = specOf(p); return S && S.coins ? S.coins : 1; };
const nearCrossing = k => (G.terrain.bridges || []).some(b => Math.hypot(b.x - k.x, b.y - k.y) < STRATEGY.fordReach);
const onRoad = k => !!G.roadCells && G.roadCells.has(`${Math.floor(k.x / 14)},${Math.floor(k.y / 14)}`);
const stratSpeedMul = k => {
  if (!stratOn('terrain')) return 1;
  if (nearCrossing(k)) return STRATEGY.fordSlow;
  return onRoad(k) ? STRATEGY.roadFast : 1;
};

// ---------- heroes ----------
// Each kingdom's champion waits in a castle and rides out with the first column of at least
// STRATEGY.heroMin troops sent from it: every column of that send strikes STRATEGY.heroStr harder, and
// the first carries the champion's standard (k.hero). Once every column of that send (k.heroGroup) has
// arrived or been cut down, the champion holds the target if it is now theirs; otherwise the attack failed,
// and the champion falls and
// returns STRATEGY.heroBack seconds later at its kingdom's strongest castle. A castle taken with the
// champion inside kills it too.
const heroOf = o => (stratOn('heroes') && G.strat && G.strat.heroes[o]) || null;
const heroAt = p => !!p.owner && heroOf(p.owner) && heroOf(p.owner).at === p.id;
function stratLaunch(owner, s, columns) {
  const H = heroOf(owner);
  if (!H || H.at !== s.id || !columns.length) return;
  if (columns.reduce((a, k) => a + k.n, 0) < STRATEGY.heroMin) return;
  for (const k of columns) { k.str = (k.str || 1) * STRATEGY.heroStr; k.heroGroup = owner; }
  columns[0].hero = owner;
  H.at = null;
  emit('hero', { o: owner, kind: 'rides', from: s });
}
function heroFalls(o, H, where) {
  H.at = null; H.back = G.time + STRATEGY.heroBack;
  emit('hero', { o, kind: 'falls', where });
}
// Settles each champion's fate after columns moved and arrived. sim.js calls it from update().
function heroesTick() {
  for (const o of G.owners) {
    const H = heroOf(o);
    if (!H) continue;
    if (H.at !== null) {
      // Lost with the castle.
      const p = G.planets[H.at];
      if (!p || p.owner !== o) heroFalls(o, H, p);
      continue;
    }
    if (H.back !== null) {
      if (G.time < H.back) continue;
      const home = G.planets.filter(p => p.owner === o).sort((a, b) => b.units - a.units)[0];
      if (!home) continue;
      H.at = home.id; H.back = null;
      emit('hero', { o, kind: 'returns', castle: home });
      continue;
    }
    // Riding: while any column of the champion's send is still on the road, nothing is settled yet; the
    // standard passes to another of them if its own column got there first.
    const group = G.packets.filter(k => k.heroGroup === o);
    if (group.length) { if (!group.some(k => k.hero === o)) group[0].hero = o; continue; }
    // The whole send has arrived or been cut down. Its target is ours now: the champion holds it.
    const last = H.riding && G.planets[H.riding];
    if (last && last.owner === o) { H.at = last.id; emit('hero', { o, kind: 'holds', castle: last }); }
    else heroFalls(o, H, last);
    H.riding = null;
  }
  // Remember where each standard is headed, for when it leaves the road.
  for (const k of G.packets) if (k.heroGroup && !k.to.monster) { const H = heroOf(k.heroGroup); if (H) H.riding = k.to.id; }
}

// ---------- the lords ----------
// Lords specialise their castles on their own: castles facing an enemy become Keeps, the rest alternate
// between Barracks and Markets.
// (Which castles they attack is aiThink's business; strategyWorthMul helps.)
function lordsSpecialise() {
  for (const ai of G.ais) {
    for (const p of G.planets) {
      if (p.owner !== ai.id || p.spec || p.hill) continue;
      // Never while enemy columns are marching on it.
      if (G.packets.some(k => k.to === p && k.owner !== ai.id)) continue;
      const front = (G.roadNext[p.id] || []).some(n => G.planets[n].owner && G.planets[n].owner !== ai.id);
      // Lords never spend troops working a castle up to a branch (every lord who did lost ground for it);
      // they specialise castles their own upgrades have readied, paying in coins.
      if (canSpecialise(p)) specialise(p, front ? 'keep' : p.id % 2 ? 'barracks' : 'market');
    }
  }
}

// Called every step from update() while cfg.strategy is set.
function strategyTick(dt) {
  const S = G.strat;
  if (!S) return;
  S.supplyClock += dt;
  if (S.supplyClock >= STRATEGY.supplyEvery) {
    S.supplyClock = 0;
    if (stratOn('supply')) refreshSupply();
    if (stratOn('spec')) lordsSpecialise();
  }
  if (stratOn('heroes')) heroesTick();
}

// How much more (or less) lord `me` wants castle t: hills are hard going, a cut-off castle is ripe, a
// Market is rich, and a rival's champion is worth killing. For aiThink's worth loop.
function strategyWorthMul(t, me) {
  if (!G || !G.cfg.strategy) return 1;
  let m = 1;
  if (stratOn('terrain') && t.high) m *= 0.85;
  if (t.owner && t.owner !== me) {
    if (!suppliedAt(t)) m *= 1.15;
    if (specOf(t) && t.spec === 'market') m *= 1.15;
    if (heroAt(t)) m *= 1.25;
  }
  return m;
}
