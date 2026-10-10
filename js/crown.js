// crown.js
//
// Capture the Crown (#66): a scouting and bluffing mode, fought under fog of war. The rules and the
// lords' tactics live here; like sim.js and hill.js this file has no DOM access, so tools/balance.js loads
// it. The menu card, the crown bar, the Move crown button, the Scouts troop button, the crown marks on
// the map and the end screen live in js/crown-ui.js.
//
// Every realm's crown starts in its seat. In the first CROWN.hideTime seconds, while the realms claim
// keeps, each secretly hides its crown in one of the castles it holds, for free and at once (the lords
// choose just before the time runs out). Taking the castle that holds a rival's crown knocks that realm
// out at once: all its castles go neutral and its columns leave the field. The last realm with its
// crown wins.
//
//   - Fog hides garrisons and crowns. Capturing a castle tells you whether a crown was there; Scouts (a
//     cheap troop type, UNIT_TYPES.scout) look inside a castle without attacking it, then are spent.
//   - Moving a crown costs CROWN.moveCost coins and takes CROWN.moveTime seconds, whatever the distance:
//     it rides in a column with an escort from its castle, exposed to archers, map units and road battles.
//     If that column is destroyed, whoever destroyed it seizes the crown. Every realm starts with
//     CROWN.startCoins, enough for one move.
//   - From CROWN.revealAt seconds the heralds betray every crown, so a cagey game can't run forever.
//   - The lords guess where crowns are from how heavily castles are held (decoy garrisons fool them),
//     each in character (CROWN_LORDS below), and plan from what they know under fog, never the truth.
//
// sim.js calls crownTick() from update(), crownAi(), crownWorthMul() and crownSpare() from aiThink(),
// crownScout() from send() and crownArrive() from arrive(), only while G.mode === 'crown'.

const CROWN = {
  castles: 30,             // castles on the map: a duel, you against one lord, on a large map
  mapScale: 1.6,           // map size against a standard battle (1.25 is the Long preset)
  startCoins: 15,          // coins each realm starts with: enough for one move
  hideTime: 30,            // seconds at the start when a crown may be re-hidden for free, at once
  moveCost: 15,            // coins to move a crown afterwards
  moveTime: 20,            // seconds a crown spends on the road, however far it goes
  moveEscort: 0.5,         // share of the crown castle's garrison that rides with it (the player's send % instead)
  scoutTroops: 2,          // troops a band of scouts costs
  intelFresh: 90,          // seconds a scout's or a capture's report counts as fresh
  revealAt: 600,           // from here every realm knows where every crown is
  rivalWorth: 0.55,        // how much a lord wants a rival castle that surely holds no crown, next to a battle
  huntWorth: 3.2,          // ...and how much more for a castle in proportion to the odds it holds one
};

// Scouts, chosen with the Scouts button in Capture the Crown only (UNIT_IDS, which T cycles through,
// is built before this file loads and leaves them out). Fast riders who never fight a castle.
UNIT_TYPES.scout = {
  name: 'Scouts', speed: 2.2, siege: 0, road: 0.3,
  desc: `Capture the Crown only. ${CROWN.scoutTroops} riders from your nearest castle look inside a castle without attacking it, to learn whether a crown is hidden there; they are spent once they report.`,
};

// How each lord plays it, from their army's personality (ARMIES[id].ai) and their lines (LORDS):
//   pick: where the crown is hidden at the start. guard: the garrison (per unit of castle size) the
//   crown castle keeps before it joins attacks; a light guard bluffs, a heavy one gives the crown away.
//   sharp: how firmly the lord reads the heaviest garrison as the crown. hunt: how hard they go for it.
//   scout / scoutGap: chance per think and seconds between scouting parties. moveOnScout: moves the crown
//   once rival scouts have seen it. flee: moves it out of a castle about to fall. every: moves it on a
//   habit, this often. decoy: stacks troops in another castle to draw the hunt. walls: walls the crown castle.
const CROWN_LORDS = {
  // Isolde, the Mason Queen: the crown sits in her biggest castle behind her best walls, and stays there.
  aldmere: { pick: 'strong', guard: 1.2, sharp: 1.6, hunt: 1.3, scout: 0.8, scoutGap: 20, moveOnScout: false, flee: false, every: 0, decoy: false, walls: true },
  // Torvek, the Red Wind: the crown stays in his own hall and never runs. He sends no scouts; he hits the
  // fattest castle he can see, every time.
  kharzul: { pick: 'home', guard: 0.9, sharp: 1.8, hunt: 1.0, scout: 0, scoutGap: 0, moveOnScout: false, flee: false, every: 0, decoy: false, walls: false },
  // Sigrun, the White Wall: hidden in the castle farthest from every rival, guarded well; moved deeper
  // the moment she is found out.
  frostmark: { pick: 'home', guard: 1.0, sharp: 1.0, hunt: 0.85, scout: 0.4, scoutGap: 22, moveOnScout: true, flee: false, every: 0, decoy: false, walls: false },
  // Amaru, the Golden Hand: hides it anywhere but his seat, buys information (scouts often) and pays to
  // keep his crown moving.
  solmara: { pick: 'random', guard: 1.0, sharp: 1.1, hunt: 0.85, scout: 0.5, scoutGap: 22, moveOnScout: true, flee: true, every: 240, decoy: false, walls: false },
  // Veyra, Mother of Crows: the crown hides in a quiet castle away from her seat, kept thinly held while
  // a fat decoy draws the hunt; found out, she slips it away.
  nyx: { pick: 'quiet', guard: 0.8, sharp: 1.1, hunt: 1.15, scout: 0.6, scoutGap: 18, moveOnScout: true, flee: false, every: 0, decoy: true, walls: false },
};
const crownLord = o => CROWN_LORDS[lordStyle(o)] || CROWN_LORDS.solmara;

// Where realm o's crown is: its castle, or null while it is on the road (or the realm is out).
const crownAt = o => G.crown && G.crown.at[o] != null ? G.planets[G.crown.at[o]] : null;
// The column carrying realm o's crown, if it is on the move.
const crownCarrier = o => G.packets.find(k => k.crown && k.owner === o) || null;
const crownOut = o => !!(G.crown && G.crown.out[o]);

on('newGame', g => {
  if (g.cfg.mode !== 'crown') return;
  g.mode = 'crown';
  const C = g.crown = {
    at: {}, home: {}, picked: {}, out: {}, intel: {}, exposed: {}, moves: {}, scouts: {}, seized: {}, last: {},
    order: [], hidden: false, revealed: false, winner: null, ended: false,
  };
  for (const o of g.owners) {
    C.at[o] = C.home[o] = g.planets.find(p => p.owner === o).id;
    C.intel[o] = {}; C.moves[o] = 0; C.scouts[o] = 0; C.seized[o] = 0;
    g.coins[o] = CROWN.startCoins;
  }
});

// ---------- hiding and moving a crown ----------
// A lord picks its hiding place in character, just before the hiding time runs out, among the castles
// it holds by then. None of them hides it on the front line: only the half of its castles farthest from
// any rival is considered.
function crownPick(o) {
  const C = G.crown, L = crownLord(o), mine = G.planets.filter(p => p.owner === o);
  C.picked[o] = true;
  if (!mine.length) return;
  const rivals = G.planets.filter(p => p.owner && p.owner !== o);
  const front = p => rivals.length ? Math.min(...rivals.map(q => travel(p, q))) : 0;
  const rear = mine.slice().sort((a, b) => front(b) - front(a)).slice(0, Math.max(1, Math.ceil(mine.length / 2)));
  const seat = G.planets[C.home[o]], away = rear.filter(p => p !== seat);
  let c = null;
  if (L.pick === 'home') c = seat.owner === o ? seat : rear[0];
  else if (L.pick === 'strong') c = rear.slice().sort((a, b) => (b.r - a.r) || (b.units - a.units))[0];
  else if (L.pick === 'quiet') c = (away.length ? away : rear)[0];
  else c = pick(away.length ? away : rear);   // anywhere but the obvious seat
  if (c && c.owner === o) C.at[o] = c.id;
}

// Realm o moves its crown to castle `to`, with `frac` of the crown castle's garrison as its escort.
// In the first CROWN.hideTime seconds it is hidden again at once, for free. Returns true if it moved.
function crownMove(o, to, frac = CROWN.moveEscort) {
  const C = G.crown;
  if (!C || G.over || C.out[o] || !to) return false;
  const from = crownAt(o);
  if (!from || to === from || to.owner !== o || from.owner !== o) return false;
  if (G.time < CROWN.hideTime) {
    C.at[o] = to.id;
    C.picked[o] = true;
    emit('crown', { kind: 'hid', o, castle: to });
    return true;
  }
  const n = Math.floor(from.units * frac);
  if (G.coins[o] < CROWN.moveCost || n < 1) return false;
  G.coins[o] -= CROWN.moveCost;
  from.units -= n;
  const route = pathOf(from, to).pts;
  // The column is moved by crownTick (hold keeps update() from marching it), so the trip takes
  // CROWN.moveTime seconds whatever the distance; it fights on the road like any other column.
  G.packets.push({
    owner: o, from, to, n, str: soldierStr(from), type: 'foot', escort: false, delay: 0, phase: Math.random() * 6.28,
    path: route, wp: 0, jx: 0, jy: 0, x: from.x, y: from.y, hold: true,
    crown: { t: 0, dur: CROWN.moveTime, pts: [{ x: from.x, y: from.y }, ...route.map(q => ({ x: q.x, y: q.y }))] },
  });
  C.at[o] = null;
  C.moves[o]++;
  C.last[o] = { x: from.x, y: from.y };
  emit('crown', { kind: 'move', o, from, castle: to });
  return true;
}

// Where along its route a crown column is, a fraction f of the way.
function crownPathAt(pts, f) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let left = total * f;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (left <= d || i === pts.length - 1) {
      const t = d ? Math.min(1, left / d) : 1;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, dx: pts[i].x - pts[i - 1].x };
    }
    left -= d;
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, dx: 0 };
}

// ---------- scouts ----------
// Called from send(): a band of CROWN.scoutTroops scouts rides from the nearest source that can spare
// them, as one column. Scouts ride through truces: looking is not attacking.
function crownScout(owner, sources, target) {
  if (!G.crown || target.owner === owner || target.monster) return false;
  const s = sources.filter(q => q !== target && q.owner === owner && q.units >= CROWN.scoutTroops + 1)
    .sort((a, b) => travel(a, target) - travel(b, target))[0];
  if (!s) return false;
  s.units -= CROWN.scoutTroops;
  if (owner === 1) G.stats.sent += CROWN.scoutTroops;
  const path = pathOf(s, target).pts, ang = Math.atan2(path[0].y - s.y, path[0].x - s.x);
  G.packets.push({
    owner, from: s, to: target, n: CROWN.scoutTroops, str: 1, type: 'scout', escort: false, delay: 0, phase: Math.random() * 6.28,
    path, wp: 0, jx: 0, jy: 0, x: s.x + Math.cos(ang) * s.r * 0.8, y: s.y + Math.sin(ang) * s.r * 0.8,
  });
  return true;
}

// Called from arrive(): scouts look and report instead of attacking. Returns true when handled.
function crownArrive(k, t) {
  if (k.type !== 'scout' || t.owner === k.owner) return false;
  crownReveal(k.owner, t, 'scout');
  return true;
}

// Realm o learns what castle t holds: its garrison, and whether a crown is hidden there.
function crownReveal(o, t, how) {
  const C = G.crown, q = t.owner;
  if (!C || !C.intel[o]) return;
  const found = q && C.at[q] === t.id ? q : 0;
  const prev = C.intel[o][t.id];
  C.intel[o][t.id] = { crown: found, t: G.time };
  if (G.seen[o]) G.seen[o][t.id] = { owner: t.owner, units: t.units };
  if (how === 'scout') {
    // The realm whose crown it is sees the scouts at its gate, and knows it has been found out.
    if (found) C.exposed[found] = G.time;
    if (!prev || G.time - prev.t > 1.5) C.scouts[o]++;
  }
  if (!prev || G.time - prev.t > 1.5 || prev.crown !== found) emit('crown', { kind: how === 'scout' ? 'scouted' : 'empty', o, castle: t, found, owner: q });
}

// A captured castle shows whether a crown was there (a crown's own castle is settled in crownTick).
on('capture', ({ o, was, castle }) => {
  if (!G || G.mode !== 'crown' || !G.crown || !was || !G.owners.includes(o)) return;
  if (G.crown.at[was] === castle.id) return;
  crownReveal(o, castle, 'capture');
});

// ---------- knockouts ----------
// Realm o is out: `by` took its crown (0 if nobody did). Its castles go neutral, its columns and map units leave.
function crownKnockout(o, by, castle = null, road = false) {
  const C = G.crown;
  if (C.out[o]) return;
  C.out[o] = { by: by || 0, t: G.time, road, at: castle ? castle.id : null };
  C.at[o] = null;
  C.order.push(o);
  if (by) C.seized[by]++;
  for (const p of G.planets) if (p.owner === o) { p.prevOwner = o; p.capturedAt = G.time; p.owner = 0; p.units = Math.round(p.units * 0.5); p.rally = null; }
  G.packets = G.packets.filter(k => k.owner !== o);
  G.units = G.units.filter(u => u.owner !== o);
  G.shots = G.shots.filter(sh => sh.u.owner !== o);
  if (by) lordSays(by, 'crown', true);
  if (by !== 1) lordSays(o, 'crownLost', true);
  emit('crown', { kind: 'out', o, by: by || 0, castle, road });
}

// A crown column was destroyed: whoever destroyed it (the nearest hostile column, castle archers or
// Ballista Tower to where it fell) seizes the crown.
function crownSeized(o) {
  const at = G.crown.last[o] || { x: 0, y: 0 };
  let by = 0, bd = Infinity;
  const near = (who, d, reach) => { if (who && who !== o && G.owners.includes(who) && !crownOut(who) && d <= reach && d < bd) { bd = d; by = who; } };
  for (const k of G.packets) near(k.owner, Math.hypot(k.x - at.x, k.y - at.y), 30);
  if (!by) for (const p of G.planets) if (p.owner) near(p.owner, Math.hypot(p.x - at.x, p.y - at.y), archerStats(p).range + 12);
  if (!by) for (const u of G.units) if (u.type === 'ballista') near(u.owner, dist(u, at), MAP_UNITS.ballista.range + 12);
  crownKnockout(o, by, null, true);
}

// ---------- the step ----------
// Called every step from update(). Returns true once the battle is decided for the player (it has
// ended), so the usual conquest checks are skipped.
function crownTick(dt) {
  const C = G.crown;
  if (!C) return false;
  if (C.winner != null) return true;
  // The lords hide their crowns in character (the player's crown stays in the seat until moved).
  if (G.time >= CROWN.hideTime - 2) for (const ai of G.ais) if (!C.picked[ai.id] && !C.out[ai.id]) crownPick(ai.id);
  // The hiding time is over: reports from before it no longer say where a crown is.
  if (!C.hidden && G.time >= CROWN.hideTime) {
    C.hidden = true;
    for (const o of G.owners) for (const id of Object.keys(C.intel[o] || {})) if (C.intel[o][id].t < CROWN.hideTime) delete C.intel[o][id];
    emit('crown', { kind: 'hidden' });
  }

  // Crowns on the road.
  for (const o of G.owners) {
    if (C.out[o] || C.at[o] != null) continue;
    const k = crownCarrier(o);
    if (!k) { crownSeized(o); continue; }
    if (!frozen(o)) k.crown.t += dt;
    const f = Math.min(1, k.crown.t / k.crown.dur), pos = crownPathAt(k.crown.pts, f);
    k.x = pos.x; k.y = pos.y;
    if (pos.dx) k.dir = pos.dx < 0 ? -1 : 1;
    C.last[o] = { x: k.x, y: k.y };
    if (f < 1) continue;
    G.packets.splice(G.packets.indexOf(k), 1);
    delete k.hold;
    const t = k.to;
    // The escort fights its way in if the castle fell while the crown was on the road.
    if (t.owner === o) t.units += k.n; else arrive(k, t);
    if (t.owner === o) { C.at[o] = t.id; emit('crown', { kind: 'landed', o, castle: t }); }
    else crownKnockout(o, t.owner, t);
  }

  // A crown's castle has fallen: its realm is out.
  for (const o of G.owners) {
    if (C.out[o] || C.at[o] == null) continue;
    const c = G.planets[C.at[o]];
    if (c.owner !== o) crownKnockout(o, c.owner, c);
  }

  // Anyone who sees a crown column knows where it is going (and that it has left).
  for (const k of G.packets) {
    if (!k.crown) continue;
    for (const ob of G.owners) {
      if (ob === k.owner || C.out[ob] || !seesAt(ob, k.x, k.y)) continue;
      const i = C.intel[ob][k.to.id], fresh = !i || i.crown !== k.owner;
      C.intel[ob][k.to.id] = { crown: k.owner, t: G.time };
      C.intel[ob][k.from.id] = { crown: 0, t: G.time };
      if (fresh) emit('crown', { kind: 'sighted', o: k.owner, by: ob, castle: k.to });
    }
  }

  if (!C.revealed && G.time >= CROWN.revealAt) { C.revealed = true; emit('crown', { kind: 'reveal' }); }

  // The last realm with its crown wins. The player losing theirs ends the battle for them at once.
  const alive = G.owners.filter(o => !C.out[o]);
  if (alive.length <= 1) {
    C.winner = alive.length ? alive[0] : 0;
    emit('crown', { kind: 'win', o: C.winner });
    if (!G.cfg.demo && !C.ended) { C.ended = true; endBattle(C.winner === 1); }
    return true;
  }
  if (C.out[1] && !G.cfg.demo) {
    if (!C.ended) { C.ended = true; endBattle(false); }
    return true;
  }
  return false;
}

// ---------- the lords: reading the fog ----------
// The odds, as lord `me` sees it, that each castle of realm q holds q's crown: a castle it knows holds
// the crown (scouted, or a crown column seen heading there) is a certainty; otherwise the heavier the
// garrison it remembers, against what the castle could hold, the likelier, and a castle scouted or
// taken without a crown is unlikely while the report is fresh. Built from P (what me knows under fog).
let crownGuessMemo = null;   // per think: { me, at, by: { q: Map } }
function crownGuess(me, q, P) {
  if (crownGuessMemo && crownGuessMemo.me === me && crownGuessMemo.at === G.time && crownGuessMemo.by[q]) return crownGuessMemo.by[q];
  if (!crownGuessMemo || crownGuessMemo.me !== me || crownGuessMemo.at !== G.time) crownGuessMemo = { me, at: G.time, by: {} };
  const C = G.crown, out = new Map();
  crownGuessMemo.by[q] = out;
  if (C.out[q]) return out;
  if (C.revealed) {
    const c = crownAt(q) || (crownCarrier(q) || {}).to;
    if (c) out.set(c.id, 1);
    return out;
  }
  const intel = C.intel[me] || {}, L = crownLord(me);
  const theirs = P.filter(p => p.owner === q);
  for (const p of theirs) {
    const i = intel[p.id];
    if (i && i.crown === q && G.time - i.t < CROWN.intelFresh * 2) { out.set(p.id, 1); return out; }
  }
  let sum = 0;
  for (const p of theirs) {
    let w = (0.15 + Math.max(0, p.units) / capOf(p)) ** L.sharp;
    const i = intel[p.id];
    if (i && i.crown !== q) w *= G.time - i.t < CROWN.intelFresh ? 0.03 : 0.35;
    out.set(p.id, w);
    sum += w;
  }
  for (const [id, w] of out) out.set(id, w / (sum || 1));
  return out;
}

// How much more (or less) lord `ai` wants castle t, by the odds it holds a rival's crown.
function crownWorthMul(ai, t, P) {
  const q = t.owner, me = ai.id;
  if (!q || q === me || !G.owners.includes(q) || crownOut(q)) return 1;
  const prob = crownGuess(me, q, P).get(t.id) || 0;
  return CROWN.rivalWorth + CROWN.huntWorth * crownLord(me).hunt * prob;
}

// May castle s join an attack? Once the crowns are hidden, the crown's castle keeps its guard home.
function crownSpare(me, s) {
  const c = crownAt(me);
  return !c || G.time < CROWN.hideTime || (s.ghostOf || s) !== c || s.units >= s.r * crownLord(me).guard * 2;
}

// Would a crown column from `from` to `to` ride past danger lord `me` can see: enemy columns in sight
// near the route, or the archers of castles it believes are hostile?
function crownRouteSafe(me, from, to, P) {
  const pts = [from, ...pathOf(from, to).pts], foes = G.packets.filter(k => k.owner !== me && seesAt(me, k.x, k.y));
  const walls = P.filter(p => p.owner && p.owner !== me && p !== to);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(dist(a, b) / 20));
    for (let j = 0; j <= n; j++) {
      const x = a.x + (b.x - a.x) * j / n, y = a.y + (b.y - a.y) * j / n;
      if (foes.some(k => Math.hypot(k.x - x, k.y - y) < 70)) return false;
      if (walls.some(p => Math.hypot(p.x - x, p.y - y) < archerStats(p.ghostOf || p).range + 15)) return false;
    }
  }
  return true;
}

// The safest other castle for lord `me` to move its crown to: far from rivals, not under attack, a short
// ride that passes no danger in sight. Veyra prefers a thinly held one.
function crownRefuge(me, mine, from, P, inc) {
  const enemies = P.filter(p => p.owner && p.owner !== me);
  const front = p => enemies.length ? Math.min(...enemies.map(e => travel(p, e))) : 0;
  const L = crownLord(me);
  return mine.filter(p => p !== from && threatOn(p, me, inc) === 0 && p.units >= p.r * 0.3)
    .map(p => ({ p, s: front(p) - travel(from, p) * 0.35 + (L.decoy ? -p.units : 0) }))
    .sort((a, b) => b.s - a.s).map(x => x.p).find(p => crownRouteSafe(me, from, p, P)) || null;
}

function crownMoveAi(ai, mine, c, P, inc) {
  // A lord won't send its crown out with a handful of guards: archers alone would take it.
  if (G.coins[ai.id] < CROWN.moveCost || G.time - (ai.crownMovedAt ?? -99) < 45 || c.units * 0.6 < 10) return false;
  const to = crownRefuge(ai.id, mine, c, P, inc);
  if (!to || !crownMove(ai.id, to, 0.6)) return false;
  ai.crownMovedAt = G.time;
  return true;
}

// Each lord's play for the crowns, before their usual plan. Returns true when the lord has acted.
function crownAi(ai, P, inc, pow) {
  const C = G.crown, me = ai.id, L = crownLord(me), d = ai.diff;
  if (!C || C.out[me]) return false;
  const mine = P.filter(p => p.owner === me), c = crownAt(me);
  if (!c) return crownScoutAi(ai, P, mine);   // the crown is on the road: nothing to guard at home
  const threat = threatOn(c, me, pow), hold = (c.units + inc[c.id][me]) * defAt(c) + rate(c) * 1.5;
  // The crown's castle is under attack: those who would, move the crown out while the attackers are still
  // far off (a crown riding out into them is lost); everyone rushes help (cavalry, except on easy).
  if (threat > 0 && threat > hold * 0.7) {
    const far = !G.packets.some(k => k.to === c && k.owner !== me && seesAt(me, k.x, k.y) && Math.hypot(k.x - c.x, k.y - c.y) < 300);
    if (L.flee && d !== 'easy' && far && threat > hold * 1.05 && crownMoveAi(ai, mine, c, P, inc)) return true;
    const helpers = mine.filter(q => q !== c && q.units > q.r * 0.5).sort((a, b) => travel(a, c) - travel(b, c)).slice(0, d === 'hard' ? 2 : 1);
    if (helpers.length && send(me, helpers, c, 0.6, d === 'easy' ? 'foot' : 'horse')) return true;
  }
  // Found out by a rival's scouts: some lords move the crown on.
  if (L.moveOnScout && d !== 'easy' && C.exposed[me] != null && G.time - C.exposed[me] < 30 && C.exposed[me] > (ai.crownMovedAt ?? -99) && crownMoveAi(ai, mine, c, P, inc)) return true;
  // Amaru keeps his crown moving, when he can afford it.
  if (L.every && d !== 'easy' && G.time - Math.max(ai.crownMovedAt ?? 0, CROWN.hideTime) > L.every && G.coins[me] >= CROWN.moveCost + 20 && crownMoveAi(ai, mine, c, P, inc)) return true;
  // Isolde walls the crown's castle.
  if (L.walls && d !== 'easy' && threat === 0 && G.time >= CROWN.hideTime && G.time - (ai.upgradedAt ?? -99) >= 20 && upgradeCost(c, 'walls') !== null && c.units >= upgradeCost(c, 'walls') + c.r * L.guard && upgrade(c, 'walls')) { ai.upgradedAt = G.time; return true; }
  // Keep the crown's guard up from castles with troops to spare.
  if (G.time >= CROWN.hideTime && c.units < c.r * L.guard && Math.random() < 0.4) {
    const rear = mine.filter(q => q !== c && q.units > q.r * 1.2 && threatOn(q, me, inc) === 0).sort((a, b) => travel(a, c) - travel(b, c))[0];
    if (rear && send(me, [rear], c, 0.4, d === 'easy' ? 'foot' : 'horse')) return true;
  }
  // Veyra fattens a decoy: her biggest other castle, fed from the rest (the crown's own castle included).
  if (L.decoy && d !== 'easy' && Math.random() < 0.3) {
    const decoy = mine.filter(p => p !== c).sort((a, b) => (b.r - a.r) || (b.units - a.units))[0];
    if (decoy && decoy.units < capOf(decoy) * 0.8) {
      const src = mine.filter(p => p !== decoy && p.units > p.r * (p === c ? L.guard * 1.4 : 1.1) && threatOn(p, me, inc) === 0)
        .sort((a, b) => b.units - a.units)[0];
      if (src && send(me, [src], decoy, 0.4, 'foot')) return true;
    }
  }
  return crownScoutAi(ai, P, mine);
}

// Scouting: the most likely crown castle the lord has no fresh report on, from the nearest castle.
// It doesn't use up the lord's turn.
function crownScoutAi(ai, P, mine) {
  const C = G.crown, me = ai.id, L = crownLord(me);
  if (!L.scout || ai.diff === 'easy' || C.revealed || G.time < CROWN.hideTime) return false;
  if (G.time - (ai.scoutAt ?? -99) < L.scoutGap || Math.random() > L.scout) return false;
  const intel = C.intel[me] || {}, ready = mine.filter(s => s.units >= CROWN.scoutTroops + 6);
  if (!ready.length) return false;
  let best = null;
  for (const q of G.owners) {
    if (q === me || C.out[q]) continue;
    const g = crownGuess(me, q, P);
    if ([...g.values()].some(v => v >= 0.999)) continue;   // already known
    for (const [id, pr] of g) {
      const i = intel[id];
      if (i && G.time - i.t < CROWN.intelFresh) continue;
      const t = G.planets[id], s = ready.slice().sort((a, b) => travel(a, t) - travel(b, t))[0];
      const score = pr / (1 + travel(s, t) / 400);
      if (!best || score > best.score) best = { score, s, t };
    }
  }
  if (!best) return false;
  ai.scoutAt = G.time;
  crownScout(me, [best.s], best.t);
  return false;
}

// The cfg for a Capture the Crown battle: the player's army against `rivals` (army ids), on the homeland
// of the first rival, always under fog of war.
// Always a duel: the first of `rivals` is the lord faced (the rest are ignored).
function crownCfg(armyId, rivals, diff, seed = Math.floor(Math.random() * 1e9)) {
  const armies = [armyId, rivals[0]];
  return { mode: 'crown', seed, n: CROWN.castles, mapScale: CROWN.mapScale, diff, armies, map: rivals[0], fog: true };
}
