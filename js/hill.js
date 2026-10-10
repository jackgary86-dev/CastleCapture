// hill.js
//
// King of the Hill (#64): the rules and the lords' tactics. Like sim.js and grand.js it has no DOM
// access, so tools/balance.js loads it; the score bar, banners, menu entry and the crown over the keep
// live in js/hill-ui.js.
//
// One crowned keep stands at the centre of the map (genMap marks it hill: true). It is large, its walls
// count HILL.def more, and it can't be upgraded. Each kingdom's starting castle is its seat, which can
// be emptied but never taken, so the race is never cut short by a knockout. Whoever holds it scores a point a second; the first to
// HILL.goal wins, and at HILL.cap seconds the most points wins. Knocking every rival out also wins.
// sim.js calls hillTick() from update(), hillAi() and hillWorthMul() from aiThink(), and hillBuyUnit()
// from aiBuyUnit(), only while G.mode === 'hill'.

on('newGame', g => {
  if (g.cfg.mode !== 'hill') return;
  g.mode = 'hill';
  const keep = g.planets.find(p => p.hill);
  // Each kingdom's starting castle is its seat: it can be emptied but never taken (see arrive() in
  // sim.js), so nobody is knocked out and every race runs to the goal or the time cap.
  for (const p of g.planets) if (p.owner) p.seat = true;
  g.hill = {
    id: keep ? keep.id : 0,
    score: Object.fromEntries(g.owners.map(o => [o, 0])),
    holder: 0, since: 0,           // who holds the keep, and since when
    leader: null, focus: null,     // the points leader, and the leader every lord has turned on (from HILL.focusAt)
    winner: null, reachedAt: null, // reachedAt: when the winner reached HILL.goal (null if the cap or a knockout decided it)
  };
});

const hillScore = o => (G.hill && G.hill.score[o]) || 0;
const hillAlive = o => G.planets.some(p => p.owner === o) || G.packets.some(k => k.owner === o);

// Called every step from update(). Returns true once the race is decided (and the battle ended).
function hillTick(dt) {
  const H = G.hill;
  if (!H) return false;
  if (H.winner != null) return true;
  const keep = G.planets[H.id], o = keep.owner;
  if (o !== H.holder) {
    const was = H.holder;
    H.holder = G.owners.includes(o) ? o : 0;
    H.since = G.time;
    emit('hill', { kind: H.holder ? 'take' : 'lost', o: H.holder, was });
    if (H.holder) lordSays(H.holder, 'hill');
  }
  if (H.holder) H.score[H.holder] = Math.min(HILL.goal, hillScore(H.holder) + dt);

  // The leader, called out when they change; from HILL.focusAt every lord turns on them.
  const ranked = G.owners.filter(q => hillScore(q) > 0).sort((a, b) => hillScore(b) - hillScore(a));
  const lead = ranked.length ? ranked[0] : null;
  if (lead != null && lead !== H.leader && hillScore(lead) >= 10 && (H.leader == null || hillScore(lead) > hillScore(H.leader))) {
    H.leader = lead;
    emit('hill', { kind: 'leader', o: lead });
  }
  const focus = H.leader != null && hillScore(H.leader) >= HILL.focusAt ? H.leader : null;
  if (focus !== H.focus) {
    H.focus = focus;
    if (focus != null) emit('hill', { kind: 'focus', o: focus });
  }

  // Decided: the goal reached, the last kingdom standing, or the time cap (most points; the holder breaks a tie).
  const alive = G.owners.filter(hillAlive);
  let winner = null;
  if (H.holder && hillScore(H.holder) >= HILL.goal) { winner = H.holder; H.reachedAt = G.time; }
  else if (alive.length === 1) winner = alive[0];
  else if (G.time >= HILL.cap) {
    const pool = alive.length ? alive : G.owners;
    winner = pool.slice().sort((a, b) => (hillScore(b) - hillScore(a)) || ((b === H.holder) - (a === H.holder)) || (totalOf(b) - totalOf(a)))[0];
  }
  if (winner == null) return false;
  H.winner = winner;
  emit('hill', { kind: 'win', o: winner, reached: H.reachedAt != null });
  if (!G.cfg.demo) endBattle(winner === 1);
  return true;
}

// ---------- the lords know the rule ----------
// Every lord wants the keep (ARMIES[id].ai.hill); on top of that each plays for it in character:
//   Torvek rushes it, the most of anyone; Isolde takes the keeps beside it and counter-takes the hill
//   right after someone else has paid to take it; Amaru builds a Ballista Tower next to it (hillBuyUnit);
//   Veyra waits until the holder has bled, then strikes; Sigrun freezes the holder with Winter's Grip
//   while her own columns close in (hillAi). From HILL.focusAt points every lord turns on the leader.
const hillBled = keep => keep.units < keep.r * 0.9;

function hillWorthMul(ai, t, P) {
  const H = G.hill, me = ai.id, id = lordStyle(me), keep = G.planets[H.id], real = t.ghostOf || t;
  const focus = H.focus != null && H.focus !== me ? H.focus : null;
  let m = 1;
  if (real.seat && t.owner !== me) return 0;   // a seat can't be taken: not worth a march
  if (real === keep) {
    m *= lordAi(me).hill || 1;
    const held = t.owner && t.owner !== me;
    if (id === 'aldmere') m *= held && G.time - H.since < 25 ? 2.2 : held ? 1 : 0.6;
    else if (id === 'nyx') m *= held ? (hillBled(t) ? 3.5 : 0.5) : 0.8;
    else if (id === 'frostmark' && held && (G.pw[me].ready === 0 || powerOn(me, 'wintersGrip'))) m *= 2;
    // The leader's lead grows a point a second while they sit on the hill.
    if (held && hillScore(t.owner) > hillScore(me)) m *= 1 + Math.min(1, (hillScore(t.owner) - hillScore(me)) / 120);
    if (focus != null && t.owner === focus) m *= 3;
  } else {
    // The race is for the hill, not for a rival's homeland: other castles of theirs matter less, unless
    // they are left nearly empty or belong to the leader everyone has turned on.
    if (t.owner && t.owner !== me && t.units >= t.r * 0.6) m *= HILL.rivalWorth;
    if (focus != null && t.owner === focus) m *= 2;
    // Keeps on the way to the hill are stepping stones; Isolde builds her walls round it.
    if (!t.owner && travel(real, keep) < 260) m *= id === 'aldmere' ? 1.8 : 1.2;
  }
  return m;
}

// Tactics that come before a lord's usual plan. Returns true when the lord has acted.
function hillAi(ai, P, inc, pow) {
  const H = G.hill, me = ai.id, id = lordStyle(me), keep = G.planets[H.id];
  const mine = P.filter(p => p.owner === me);
  // Sigrun: once her columns close on someone else's hill, or the holder's own columns ride in to
  // reinforce it, the blizzard freezes them in the field.
  if (id === 'frostmark' && keep.owner && keep.owner !== me && G.pw[me].ready === 0 && ai.diff !== 'easy') {
    const mineIn = G.packets.filter(k => k.owner === me && k.to === keep && k.delay <= 0);
    const near = mineIn.some(k => Math.hypot(k.x - keep.x, k.y - keep.y) < 220);
    const theirs = G.packets.filter(k => k.owner === keep.owner && k.to === keep).reduce((a, k) => a + k.n, 0);
    if ((near && mineIn.reduce((a, k) => a + k.n, 0) >= keep.units * 0.6) || theirs >= 15) { usePower(me); return true; }
  }
  // Whoever holds the hill keeps it topped up from the castles behind it.
  if (keep.owner === me && Math.random() < 0.6) {
    const threat = threatOn(keep, me, pow), hold = (keep.units + inc[keep.id][me]) * defAt(keep);
    if (hold < Math.max(keep.r * 1.4 * defAt(keep), threat * 1.3)) {
      const rear = mine.filter(q => q !== keep && q.units > q.r * 1.1).sort((a, b) => travel(a, keep) - travel(b, keep))[0];
      if (rear && send(me, [rear.ghostOf || rear], keep, 0.5, ai.diff === 'easy' ? 'foot' : 'horse')) return true;
    }
  }
  return false;
}

// Amaru builds a Ballista Tower beside the hill, as close as his castles let him, to shoot down anyone
// marching on it. He keeps saving until he has a castle within reach of the keep.
function hillBuyUnit(ai, mine) {
  const me = ai.id;
  if (lordStyle(me) !== 'solmara') return false;
  const U = MAP_UNITS.ballista, keep = G.planets[G.hill.id];
  if (G.coins[me] < U.price || (ai.diff === 'easy' && Math.random() < 0.5)) return true;
  // Towards each of his castles nearest the hill (the keep itself doesn't count: he may hold it).
  const bases = mine.filter(p => (p.ghostOf || p) !== keep).sort((a, b) => dist(a, keep) - dist(b, keep)).slice(0, 3);
  for (const off of [keep.r * 1.25 + 26, keep.r * 1.25 + 46, keep.r * 1.25 + 70, keep.r * 1.25 + 100]) {
    for (const base of bases) {
      const d = dist(base, keep);
      if (off >= d) continue;
      const f = off / d, ax = keep.x + (base.x - keep.x) * f, ay = keep.y + (base.y - keep.y) * f;
      for (let i = 0; i < 16; i++) {
        const r = i === 0 ? 0 : 6 + i * 3, ang = i * 2.4, x = ax + Math.cos(ang) * r, y = ay + Math.sin(ang) * r;
        if (!placeProblem(me, x, y)) { buyUnit(me, 'ballista', x, y); return true; }
      }
    }
  }
  return true;
}

// The cfg for a King of the Hill battle: the player's army against `rivals` (army ids), fought on the
// homeland of the first rival.
function hillCfg(armyId, rivals, diff, seed = Math.floor(Math.random() * 1e9)) {
  const armies = [armyId, ...rivals];
  return { mode: 'hill', seed, n: HILL.castles[armies.length] || HILL.castles[armies.length >= 5 ? 5 : 3], diff, armies, map: rivals[0] };
}
