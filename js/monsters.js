// monsters.js
//
// Grand Campaign map monsters (#48, #50): a roaming creature (or a gang of them) that wanders the realm
// between the castles, attacks columns that come within its reach, and pays a coin bounty to whichever
// army lands the final blow. Everything is data-driven from MONSTERS and GRAND_MAPS in data.js; only the
// specials (fire breath, castle smash, bandit raids) are code, and each is a small hook below.
//
// The simulation half (state, movement, fighting, the AI lords' hooks) has no DOM access, so
// tools/balance.js can load it; the drawing and banner half is only reached from render.js and ui.js.
// Everything here is inert unless the battle is a Grand Campaign on a map with a monster.
//
// Hooks the rest of the game calls (each guarded with typeof so the game runs without this file):
//   monstersTick(dt)            from update() in sim.js, every step
//   monsterAi(ai)               from the top of aiThink(): true when the lord spent its turn on the monster
//   monsterWorthMul(t, me)      scales how much a lord wants a castle (lairs, the Cyclops's road)
//   monsterAvoidUpgrade(p)      true when a lord shouldn't sink troops into a castle the Cyclops is heading for
//   drawMonsterGround(now)      lair and camp scenery, from drawScenery()
//   drawMonster(c, now)         one creature, from the depth-sorted draw loop
//   drawMonsterBars(now)        health bars and labels, drawn over everything
//   drawMonsterFx(f, now)       effects whose kind is in MONSTER_FX
//   monsterAt(w)                the creature or camp under a pointer, for sending troops at it
// Reports through 'monster' events (slain, warning, spawn, fire, smash, raid); the banners at the end of this file listen.

const TROOP_DPS = 1;      // damage a troop deals per second while fighting a monster
const BITE_RATE = 4;      // troops a monster kills per second per point of `bite`
const CONSOLATION = 0.1;  // share of damage dealt paid back to the armies that didn't get the kill
const CREATURE_R = 20;    // a creature's footprint; troops stop this close and attack
const SWARM_AT = 0.25;    // health fraction below which the lords swarm it
const CAMP_R = 30;        // captains within this distance of the bandit camp are "at camp"

const monsterData = () => G && G.monster ? MONSTERS[G.monster.id] : null;
const liveCreatures = () => G && G.monster ? G.monster.creatures.filter(c => !c.dead) : [];
const monsterHp = () => liveCreatures().reduce((a, c) => a + c.hp, 0);
const monsterMaxHp = () => liveCreatures().reduce((a, c) => a + c.maxHp, 0);
// Troops a column needs to kill `hp` health: a column of n lasts n / kills-per-second and deals 1 per troop per second.
const troopsToKill = (c, hp = c.hp) => Math.ceil(Math.sqrt(2 * hp * MONSTERS[G.monster.id].bite * BITE_RATE / TROOP_DPS) * 1.15) + 2;

// ---------- the realm ----------
const realmCentre = () => ({ x: G.w / 2, y: G.h / 2 });
const realmRadius = () => Math.min(G.w, G.h) / 2 - 100;
const castleClear = (x, y, pad) => G.planets.every(p => Math.hypot(p.x - x, p.y - y) > p.r * 1.5 + pad);
const ownedClear = (x, y, d) => G.planets.every(p => !p.owner || dist(p, { x, y }) > d);
const clampRealm = (pt, pad = 40) => {
  const c = realmCentre(), R = realmRadius() - pad, d = Math.hypot(pt.x - c.x, pt.y - c.y);
  if (d <= R) return pt;
  return { x: c.x + (pt.x - c.x) / d * R, y: c.y + (pt.y - c.y) / d * R };
};
// A random spot biased towards the middle of the map and away from the edges, clear of castles.
function wanderSpot(rnd = Math.random, from = null, maxFrom = Infinity) {
  const c = realmCentre(), R = realmRadius();
  let best = null;
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 1.6) * R * 0.85;
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
    if (!castleClear(x, y, 30)) continue;
    if (from && Math.hypot(x - from.x, y - from.y) > maxFrom) continue;
    best = { x, y };
    break;
  }
  return best || { x: c.x, y: c.y };
}
// The spot farthest from every army's castles: where a new monster appears.
function farSpot(rnd = Math.random) {
  const c = realmCentre(), R = realmRadius();
  let best = null, bd = -1;
  for (let i = 0; i < 80; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.9;
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
    if (!castleClear(x, y, 30)) continue;
    const near = Math.min(...G.planets.filter(p => p.owner).map(p => Math.hypot(p.x - x, p.y - y)), Infinity);
    if (near > bd) { bd = near; best = { x, y }; }
  }
  return best || { x: c.x, y: c.y };
}

// Tree density on a coarse grid, so the bandits know where the woods are. Rebuilt per battle (and after a
// resume), never saved.
let forestGrid = { of: null, F: null };
function forestOf() {
  if (forestGrid.of !== G.trees) {
    const cell = 40, cols = Math.ceil(G.w / cell), rows = Math.ceil(G.h / cell), grid = new Uint16Array(cols * rows);
    for (const t of G.trees) grid[Math.floor(t.y / cell) * cols + Math.floor(t.x / cell)]++;
    forestGrid = { of: G.trees, F: { cell, cols, rows, grid } };
  }
  return forestGrid.F;
}
function treesNear(x, y) {
  const F = forestOf();
  const cx = Math.floor(x / F.cell), cy = Math.floor(y / F.cell);
  let n = 0;
  for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
    if (i >= 0 && j >= 0 && i < F.cols && j < F.rows) n += F.grid[j * F.cols + i];
  }
  return n;
}
// Inside the woods: a terrain forest, or anywhere the trees stand thick.
const inWoods = (x, y) => treesNear(x, y) >= 7 || (G.terrain && inForest(G.terrain, { x, y }));

// ---------- spawning ----------
on('newGame', g => {
  if (g.cfg.mode !== 'grand') return;
  g.monster = null;
  const map = GRAND_MAPS[g.cfg.grandMap] || GRAND_MAPS.realm;
  if (!map.monster || !MONSTERS[map.monster]) return;
  const M = MONSTERS[map.monster];
  const rnd = mulberry(((g.cfg.seed || 0) ^ 0x9e3779b9) >>> 0);
  g.monster = { id: map.monster, creatures: [], lair: null, camp: null, respawnWave: null, kills: 0, waveSeen: 1, marchWave: null, warned: false };
  if (M.special === 'fire') {
    // The dragon's mountain: between the central keeps, as clear of them as the middle allows.
    const c = realmCentre();
    let best = null, bd = -1;
    for (let i = 0; i < 120; i++) {
      const a = rnd() * Math.PI * 2, d = 70 + rnd() * 180, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      const clear = Math.min(...G.planets.map(p => Math.hypot(p.x - x, p.y - y) - p.r));
      if (clear > bd) { bd = clear; best = { x, y }; }
    }
    g.monster.lair = best;
    // The keeps around the lair are the richest on the map: the best land is the most dangerous.
    const rich = g.planets.filter(p => !p.owner).sort((a, b) => dist(a, best) - dist(b, best)).slice(0, 4);
    for (const p of rich) {
      p.units = Math.round(p.units * 1.6);
      const grown = Math.max(p.r, 27);
      if (g.planets.every(q => q === p || dist(p, q) > grown + q.r + 34)) p.r = grown;
      p.rich = true;
    }
  }
  if (M.special === 'raid') {
    // The bandit camp: the densest patch of woods that is well away from every army's castles.
    let best = null, bd = -1;
    for (let i = 0; i < 300; i++) {
      const c = realmCentre(), a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * realmRadius() * 0.85;
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      if (!castleClear(x, y, 50) || !ownedClear(x, y, 260)) continue;
      const n = treesNear(x, y);
      if (n > bd) { bd = n; best = { x, y }; }
    }
    best = best || farSpot(rnd);
    g.monster.camp = { monster: true, camp: true, owner: 0, id: 'camp', x: best.x, y: best.y, r: CAMP_R };
    // Clear the tents' ground of trees.
    g.trees = g.trees.filter(t => Math.hypot(t.x - best.x, t.y - best.y) > 26);
  }
  spawnMonster(rnd);
});

function spawnMonster(rnd = Math.random) {
  const Mo = G.monster, M = MONSTERS[Mo.id], n = M.count || 1;
  Mo.creatures = [];
  Mo.respawnWave = null; Mo.warned = false;
  const at = Mo.lair || (Mo.camp ? { x: Mo.camp.x, y: Mo.camp.y } : farSpot(rnd));
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, off = n > 1 ? 26 : 0;
    Mo.creatures.push({
      idx: i, monster: true, owner: 0, id: 'm' + i, r: CREATURE_R,
      x: at.x + Math.cos(a) * off, y: at.y + Math.sin(a) * off,
      hp: M.hp, maxHp: M.hp, dmg: {}, dest: null, route: null, dir: 1,
      asleep: M.special === 'smash', perched: M.special === 'fire', atCamp: M.special === 'raid',
      dead: false, hit: false, loot: 0, biteT: 0, raided: false,
    });
  }
  if (M.roads) for (const c of Mo.creatures) planRoad(c);
}

// ---------- the wave loop ----------
// A finished wave heals the monster and may bring it back. grandTick() calls this the moment the plan phase
// opens, so the player and the lords plan against the monster as it will march; update() calls it too, for
// the first wave and for saves from before this was called at the wave's end.
function monstersWave() {
  const Mo = G.monster;
  if (!Mo) return;
  const wave = G.wave || 1;
  if (Mo.waveSeen !== wave) { if (Mo.waveSeen) marchEnd(); Mo.waveSeen = wave; }
}
function monstersTick(dt) {
  const Mo = G.monster;
  if (!Mo) return;
  const wave = G.wave || 1;
  monstersWave();
  if (G.phase === 'march' && Mo.marchWave !== wave) { Mo.marchWave = wave; marchStart(); }
  rebindTargets();
  if (G.phase !== 'march') return;
  for (const c of Mo.creatures) {
    if (c.dead) continue;
    moveCreature(c, dt);
    fightAround(c, dt);
  }
  if (Mo.camp) campFight(dt);
  routeAiColumns();
}

// Packets and queued orders keep plain copies of their target after a save and resume; point them back at
// the live creature. Troops still marching on a dead creature go home.
function rebindTargets() {
  const Mo = G.monster;
  const live = t => t.camp ? Mo.camp : Mo.creatures[t.idx] || t;
  for (const k of G.packets) if (k.to && k.to.monster) { k.to = live(k.to); if (k.to.dead) goHome(k); }
  if (G.orders) for (const o of G.orders) if (o.to && o.to.monster) o.to = live(o.to);
  G.packets = G.packets.filter(k => k.n > 0.05);
}
function goHome(k) {
  k.hold = false;
  const home = k.from && k.from.owner === k.owner ? k.from
    : G.planets.filter(p => p.owner === k.owner).sort((a, b) => dist(a, k) - dist(b, k))[0];
  if (!home) { k.n = 0; return; }
  k.to = home; k.path = [{ x: home.x, y: home.y }]; k.wp = 0;
}

function marchStart() {
  const Mo = G.monster, M = MONSTERS[Mo.id];
  for (const c of Mo.creatures) {
    if (c.dead) continue;
    c.hit = false;
    if (M.special === 'fire') {
      // Fly out from the lair one wave, back to perch the next.
      if (c.perched) {
        c.perched = false;
        const targets = G.planets.filter(p => p.owner);
        const t = targets.length && Math.random() < 0.65 ? pick(targets) : null;
        if (t) { const a = Math.random() * Math.PI * 2; c.dest = clampRealm({ x: t.x + Math.cos(a) * 40, y: t.y + Math.sin(a) * 40 }); }
        else c.dest = wanderSpot();
      } else c.dest = { ...Mo.lair, lair: true };
    } else if (M.special === 'smash') {
      // The Cyclops sleeps nearly half its waves; otherwise it walks the road it chose last wave.
      c.asleep = !c.route || Math.random() < 0.45;
      if (!c.asleep) { c.dest = c.route[c.route.length - 1]; c.step = 0; }
    } else if (M.special === 'raid') {
      if (c.hp < c.maxHp * 0.5 || c.raided) { c.dest = { ...Mo.camp, camp: true }; c.raided = false; }
      else if (Math.random() < 0.25) {
        const targets = G.planets.filter(p => p.owner && dist(p, Mo.camp) < 560);
        const t = targets.length ? pick(targets) : null;
        c.dest = t ? { x: t.x, y: t.y, id: t.id, raid: true } : null;
      } else {
        const woods = G.trees.filter(t => Math.hypot(t.x - Mo.camp.x, t.y - Mo.camp.y) < 380 && castleClear(t.x, t.y, 24));
        const w = woods.length ? pick(woods) : wanderSpot(Math.random, Mo.camp, 380);
        c.dest = { x: w.x, y: w.y };
        if (!castleClear(c.dest.x, c.dest.y, 24)) c.dest = wanderSpot(Math.random, Mo.camp, 380);
      }
      c.atCamp = false;
    } else c.dest = wanderSpot();
  }
}

function marchEnd() {
  const Mo = G.monster, M = MONSTERS[Mo.id];
  for (const c of Mo.creatures) {
    if (c.dead) continue;
    // It regenerates when nobody fought it this wave (the dragon only on its perch, bandits faster at camp).
    const allowed = M.special === 'fire' ? c.perched : true;
    if (!c.hit && allowed && c.hp < c.maxHp) {
      c.hp = Math.min(c.maxHp, c.hp + M.regen * (c.atCamp ? 2 : 1));
      // Healed wounds come off the damage tally too, so the bar's shares and the consolation coins stay honest.
      const dealt = Object.values(c.dmg).reduce((a, d) => a + d, 0), left = c.maxHp - c.hp;
      if (dealt > left) for (const o in c.dmg) c.dmg[o] *= left / dealt;
    }
    c.dest = null;
    if (M.special === 'smash') { c.asleep = true; planRoad(c); }
  }
  if (Mo.respawnWave !== null) {
    if (!Mo.warned && G.wave >= Mo.respawnWave - 1) { Mo.warned = true; emit('monster', { kind: 'warning', monster: M }); }
    if (G.wave >= Mo.respawnWave) {
      spawnMonster();
      emit('monster', { kind: 'spawn', monster: M, creatures: Mo.creatures });
    }
  }
}

// The Cyclops walks from the castle it is at along one of its roads; the route is chosen a wave ahead.
function planRoad(c) {
  const at = G.planets.reduce((b, p) => !b || dist(p, c) < dist(b, c) ? p : b, null);
  const roads = G.roads.filter(r => r.a === at || r.b === at);
  if (!roads.length) { c.route = [wanderSpot()]; return; }
  const r = pick(roads), fwd = r.a === at;
  const pts = r.pts.map(q => ({ x: q.x, y: q.y }));
  if (!fwd) pts.reverse();
  const end = fwd ? r.b : r.a;
  // About half its walks go all the way to the castle at the far end; the rest stop short on the road.
  if (Math.random() < 0.55) pts[pts.length - 1] = { x: end.x, y: end.y, id: end.id, smash: true };
  else pts.splice(Math.max(2, Math.ceil(pts.length * (0.4 + Math.random() * 0.35))));
  c.route = pts;
}

// ---------- movement ----------
const ENGAGE_AT = 140;    // a creature turns to face troops sent at it once they are this close, instead of outpacing them
function moveCreature(c, dt) {
  const M = MONSTERS[G.monster.id];
  if (!c.dest || c.asleep) return;
  // Troops marching on it that are nearly here: it stops and fights rather than leading them a chase.
  c.engaged = G.packets.some(k => k.to === c && k.delay <= 0 && k.n > 0.05 && dist(k, c) < ENGAGE_AT);
  if (c.engaged) return;
  let target = c.dest;
  if (c.route && M.roads) {
    c.step = c.step || 0;
    target = c.route[Math.min(c.step, c.route.length - 1)];
  }
  const dx = target.x - c.x, dy = target.y - c.y, dd = Math.hypot(dx, dy);
  const step = M.speed * dt;
  if (dd <= Math.max(step, 2)) {
    c.x = target.x; c.y = target.y;
    if (c.route && M.roads && c.step < c.route.length - 1) { c.step++; return; }
    c.dest = null; c.route = null;
    arrived(c, target);
    return;
  }
  let ux = dx / dd, uy = dy / dd;
  if (!M.flies && !M.roads) {
    // Skirt around castles instead of walking through them.
    const nx = c.x + ux * step, ny = c.y + uy * step;
    const hit = G.planets.find(p => p.id !== c.dest.id && Math.hypot(p.x - nx, p.y - ny) < p.r * 1.5 + c.r * 0.6);
    if (hit && Math.hypot(c.x - hit.x, c.y - hit.y) > 1) {
      const px = c.x - hit.x, py = c.y - hit.y, pd = Math.hypot(px, py);
      const side = (px * dy - py * dx) > 0 ? 1 : -1;      // go round on the side nearer the destination
      ux = -py / pd * side + px / pd * 0.3; uy = px / pd * side + py / pd * 0.3;
      const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
    }
  }
  c.x += ux * step; c.y += uy * step;
  c.dir = ux < 0 ? -1 : 1;
  const inside = clampRealm({ x: c.x, y: c.y }, 30);
  c.x = inside.x; c.y = inside.y;
}

function arrived(c, at) {
  const Mo = G.monster, M = MONSTERS[Mo.id];
  if (M.special === 'fire') { if (at.lair) c.perched = true; else breatheFire(c); }
  else if (M.special === 'smash' && at.smash) smashCastle(c, G.planets[at.id]);
  else if (M.special === 'raid') {
    if (at.camp) c.atCamp = true;
    else if (at.raid) raidCastle(c, G.planets[at.id]);
  }
}

// ---------- specials ----------
// The dragon burns the nearest column or castle within reach of where it lands.
function breatheFire(c) {
  const M = MONSTERS[G.monster.id];
  let target = null, bd = M.fireReach;
  for (const k of G.packets) if (k.delay <= 0 && k.n > 0.5 && dist(k, c) < bd) { bd = dist(k, c); target = k; }
  for (const p of G.planets) if (p.owner && dist(p, c) < bd) { bd = dist(p, c); target = p; }
  if (!target) return;
  const burnt = target.n !== undefined ? target.n * M.fireBurn : target.units * M.fireBurn;
  if (target.n !== undefined) { target.n -= burnt; if (target.owner === 1) G.stats.roadLost += burnt; }
  else target.units = Math.max(0, target.units - burnt);
  G.fx.push({ kind: 'fire', x: c.x, y: c.y - 10, x1: target.x, y1: target.y, age: 0 });
  if (target.owner === 1 && !reduceMotion) G.shake = { until: G.time + 0.3, mag: 4 };
  emit('monster', { kind: 'fire', monster: M, o: target.owner, castle: target.n === undefined ? target : null, lost: burnt });
}

// The Cyclops walks into a castle: 30% of the garrison (smashGarrison) and one upgrade level are lost.
function smashCastle(c, p) {
  const M = MONSTERS[G.monster.id];
  if (!p) return;
  p.units = Math.max(0, p.units * (1 - M.smashGarrison));
  let level = null;
  if (p.up) {
    const kind = lvl(p, 'walls') >= lvl(p, 'barracks') ? 'walls' : 'barracks';
    if (lvl(p, kind) > 0) { p.up[kind]--; level = kind; }
  }
  // Stop at the gate rather than on top of the keep.
  const a = Math.atan2(c.y - p.y, c.x - p.x) || 0;
  c.x = p.x + Math.cos(a) * (p.r * 1.3 + 6); c.y = p.y + Math.sin(a) * (p.r * 1.3 + 6);
  G.fx.push({ kind: 'smash', x: p.x, y: p.y, r: p.r, age: 0 });
  if (!reduceMotion) G.shake = { until: G.time + 0.4, mag: p.owner === 1 ? 7 : 4 };
  emit('monster', { kind: 'smash', monster: M, o: p.owner, castle: p, level });
}

// A bandit captain reaches a castle: a quarter of its coins and a tenth of its garrison, then runs for camp.
function raidCastle(c, p) {
  const M = MONSTERS[G.monster.id];
  if (!p || !p.owner) { c.dest = { ...G.monster.camp, camp: true }; return; }
  const coins = G.coins[p.owner] * M.raidCoins;
  G.coins[p.owner] -= coins;
  c.loot += coins;
  p.units = Math.max(0, p.units * (1 - M.raidGarrison));
  c.raided = true;
  // Out through the gate, then run for camp.
  const a = Math.atan2(G.monster.camp.y - p.y, G.monster.camp.x - p.x);
  c.x = p.x + Math.cos(a) * (p.r * 1.6 + 8); c.y = p.y + Math.sin(a) * (p.r * 1.6 + 8);
  c.dest = { ...G.monster.camp, camp: true };
  G.fx.push({ kind: 'raid', x: p.x, y: p.y, r: p.r, age: 0 });
  emit('monster', { kind: 'raid', monster: M, o: p.owner, castle: p, coins });
}

// ---------- fighting ----------
// Troops sent at a creature stand and fight it (update() parks them with k.hold); any other column that
// strays within reach is bitten as it passes. Bandits only strike from the trees. The creature's kills per
// second are shared out over every troop it is fighting, so a big column lasts longer than a small one.
function fightAround(c, dt) {
  const M = MONSTERS[G.monster.id];
  const fighting = [];
  for (const k of G.packets) {
    if (k.delay > 0 || k.n <= 0.05) continue;
    if (k.to === c) {
      if (k.hold && dist(k, c) > c.r * 0.8 + 10) k.hold = false;
      if (k.hold) fighting.push(k);
    } else if (!k.to.monster && dist(k, c) <= M.reach + c.r * 0.4 && !(M.forest && !inWoods(k.x, k.y))) fighting.push(k);
  }
  if (!fighting.length) return;
  // A standing fight: every troop sent at it deals TROOP_DPS a second (1.5x on a sleeping Cyclops).
  const mul = c.asleep ? M.sleepMul || 1 : 1;
  for (const k of fighting) {
    if (k.to !== c) continue;
    damage(c, k.owner, k.n * TROOP_DPS * (k.str || 1) * mul * dt);
    if (c.dead) break;
  }
  const total = fighting.reduce((a, k) => a + k.n, 0), kills = Math.min(total, M.bite * BITE_RATE * dt);
  for (const k of fighting) {
    const lost = kills * k.n / total;
    k.n -= lost;
    if (k.owner === 1) G.stats.roadLost += lost;
  }
  c.biteT -= dt;
  if (c.biteT <= 0) {
    c.biteT = 0.3;
    G.fx.push({ kind: 'bite', x: c.x + c.dir * 10, y: c.y - 8, age: 0 });
    G.fx.push({ kind: 'clash', x: c.x + c.dir * 12, y: c.y, age: 0 });
    emit('clash', { attacker: 0, defender: 0, monster: true });
  }
  G.packets = G.packets.filter(k => k.n > 0.05);
}

function damage(c, o, d) {
  if (d <= 0 || c.dead) return;
  d = Math.min(d, c.hp);
  c.hp -= d; c.hit = true;
  c.dmg[o] = (c.dmg[o] || 0) + d;
  if (c.hp <= 0.001) slay(c, o);
}

// The final blow wins: the slayer takes the payout (and any loot), the others get a little back for their damage.
function slay(c, o) {
  const Mo = G.monster, M = MONSTERS[Mo.id];
  c.dead = true; c.hp = 0;
  Mo.kills++;
  const last = Mo.creatures.every(x => x.dead);
  let coins = M.payout + (c.loot || 0) + (last && M.bonus ? M.bonus : 0);
  G.coins[o] += coins;
  const shares = {};
  for (const [q, dealt] of Object.entries(c.dmg)) if (+q !== o) { shares[q] = dealt * CONSOLATION; G.coins[q] += shares[q]; }
  for (const k of G.packets) if (k.to === c) goHome(k);
  if (last) Mo.respawnWave = G.wave + M.respawn;
  G.events.push({ t: G.time, kind: 'slay', owner: o });
  if (o === 1) G.stats.slain = (G.stats.slain || 0) + 1;
  G.fx.push({ kind: 'roar', x: c.x, y: c.y, age: 0, col: col(o) });
  emit('monster', { kind: 'slain', monster: M, o, creature: c, coins, shares, last });
  if (o !== 1) lordSays(o, 'slay', true);
}

// Troops sent at the bandit camp: a force bigger than every captain there kills them all at once; a smaller one
// just fights the nearest captain.
function campFight(dt) {
  const Mo = G.monster, camp = Mo.camp;
  const here = Mo.creatures.filter(c => !c.dead && dist(c, camp) <= CAMP_R + 10);
  const raiders = G.packets.filter(k => k.to === camp && k.hold);
  if (!raiders.length) return;
  if (!here.length) { for (const k of raiders) goHome(k); return; }
  const force = {};
  for (const k of raiders) force[k.owner] = (force[k.owner] || 0) + k.n * (k.str || 1);
  const hpHere = here.reduce((a, c) => a + c.hp, 0);
  const big = Object.entries(force).find(([, f]) => f >= hpHere);
  if (big) {
    const o = +big[0];
    for (const c of here) { c.dmg[o] = (c.dmg[o] || 0) + c.hp; c.hp = 0; slay(c, o); }
    for (const k of raiders) if (k.owner === o) { k.n = Math.max(0, k.n - hpHere / (k.str || 1) / raiders.length); }
    G.packets = G.packets.filter(k => k.n > 0.05);
    for (const k of G.packets) if (k.to === camp) goHome(k);
    return;
  }
  for (const k of raiders) { k.hold = false; k.to = here.sort((a, b) => dist(a, k) - dist(b, k))[0]; }
}

// ---------- the AI lords ----------
// Nobody attacks a healthy monster. Below SWARM_AT every lord wants the bounty, each in character.
function monsterAi(ai) {
  const Mo = G.monster;
  if (!Mo) return false;
  const me = ai.id, id = G.fac[me], M = MONSTERS[Mo.id], mine = G.planets.filter(p => p.owner === me);
  const live = liveCreatures();
  if (!live.length || !mine.length) return false;
  if (ai.monsterWave === G.wave) return false;
  // Bandit country: keep the castles a captain is prowling near garrisoned.
  if (M.special === 'raid' && Math.random() < 0.5) {
    for (const p of mine) {
      if (p.units >= 15 || !live.some(c => dist(c, p) < 180)) continue;
      const helper = mine.filter(q => q !== p && q.units > 20).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (helper && send(me, [helper], p, 0.4)) { ai.monsterWave = G.wave; return true; }
    }
  }
  const c = live.sort((a, b) => a.hp - b.hp)[0];
  if (ai.diff === 'easy' && Math.random() < 0.5) return false;
  const already = G.packets.filter(k => k.to === c && k.owner === me).reduce((a, k) => a + k.n, 0)
    + (G.orders || []).filter(o => o.kind === 'send' && o.to === c && o.owner === me).reduce((a, o) => a + o.n, 0);
  const need = troopsToKill(c);
  if (already >= need) return false;
  const near = mine.filter(p => p.units >= 8).sort((a, b) => dist(a, c) - dist(b, c));
  if (!near.length) return false;
  let sent = false;
  if (c.hp / c.maxHp >= SWARM_AT) {
    // A healthy monster is a poor trade for anyone but a lord with troops to spare: when the three nearest castles
    // can field the whole kill at once, and that is still under a third of the army, the bounty is worth a wave.
    if (Math.random() > 0.12 || c.perched) return false;
    const srcs = near.filter(p => dist(p, c) < 560).slice(0, 3), can = srcs.reduce((a, p) => a + Math.floor(p.units * 0.8), 0);
    if (can < need * 1.25 || need * 3 > totalOf(me)) return false;
    sent = send(me, srcs, c, Math.min(0.8, need * 1.25 / Math.max(1, can) * 0.8));
    if (sent) ai.monsterWave = G.wave;
    return sent;
  }
  if (id === 'kharzul' || id === 'nyx') {
    // Torvek and Veyra throw in everything nearby.
    sent = send(me, near.filter(p => dist(p, c) < 560).slice(0, 3), c, 0.7);
  } else if (id === 'solmara') {
    // Amaru sends exactly enough to finish it, from the nearest castles.
    let left = need - already;
    for (const p of near.slice(0, 3)) {
      if (left <= 0) break;
      const n = Math.min(Math.floor(p.units * 0.9), left);
      if (n >= 3 && send(me, [p], c, n / p.units)) { sent = true; left -= n; }
    }
  } else {
    // Isolde and Sigrun only join when they already have troops close by. "Close" has to reach past a bandit's
    // camp: a wounded captain heals half its health there in a wave, so a lord who waits for it never gets one.
    const close = near.filter(p => dist(p, c) < 320);
    if (close.length) sent = send(me, close.slice(0, 2), c, 0.5);
  }
  if (sent) ai.monsterWave = G.wave;
  return sent;
}

// How much more or less a lord wants castle t because of the monster.
function monsterWorthMul(t, me) {
  const Mo = G.monster;
  if (!Mo) return 1;
  const M = MONSTERS[Mo.id];
  if (M.special === 'fire' && Mo.lair && (G.wave || 1) < 12 && dist(t, Mo.lair) < 160) return 0.35;
  if (M.special === 'smash' && onCyclopsRoad(t)) return 0.5;
  return 1;
}
const onCyclopsRoad = p => liveCreatures().some(c => c.route && c.route.some(q => Math.hypot(q.x - p.x, q.y - p.y) < p.r + 30));
const monsterAvoidUpgrade = p => !!G.monster && MONSTERS[G.monster.id].special === 'smash' && onCyclopsRoad(p);

// The lords' columns detour around a healthy monster when the detour is short; the player's take their chances.
function routeAiColumns() {
  const live = liveCreatures().filter(c => c.hp / c.maxHp >= SWARM_AT && !c.asleep && !c.perched);
  if (!live.length) return;
  const M = MONSTERS[G.monster.id];
  if (M.forest) return;
  const reach = M.reach * 2.2;
  for (const k of G.packets) {
    if (k.routed || k.delay > 0 || k.hold || k.to.monster || !k.path) continue;
    if (!G.ais.some(a => a.id === k.owner)) continue;
    k.routed = true;
    // Only the current leg is checked; a leg that would pass through the monster gets a waypoint beside it.
    const last = k.wp >= k.path.length - 1, goal = last ? k.to : k.path[k.wp];
    for (const c of live) {
      const dx = goal.x - k.x, dy = goal.y - k.y, len = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, Math.min(1, ((c.x - k.x) * dx + (c.y - k.y) * dy) / (len * len)));
      const fx = k.x + dx * t, fy = k.y + dy * t;
      if (Math.hypot(fx - c.x, fy - c.y) > reach) continue;
      const side = (dx * (c.y - k.y) - dy * (c.x - k.x)) > 0 ? -1 : 1;
      const via = { x: c.x - dy / len * reach * 1.4 * side, y: c.y + dx / len * reach * 1.4 * side };
      const detour = Math.hypot(via.x - k.x, via.y - k.y) + Math.hypot(goal.x - via.x, goal.y - via.y);
      if (detour < len * 1.35 && castleClear(via.x, via.y, 10) && !(G.terrain && crossesWater(G.terrain, k, via))) {
        k.path = [via, ...k.path.slice(k.wp)]; k.wp = 0;
      }
      break;
    }
  }
}

// ---------- pointer targets ----------
// At the whole-map view a creature is a few pixels wide, so sprites, bars and hit areas grow as the view zooms out.
const monsterScale = () => typeof sc === 'number' && sc > 0 ? Math.max(1, 0.8 / sc) : 1;
// What an order or banner calls a creature or the camp.
function monsterTargetName(t) {
  const M = monsterData();
  if (!M) return 'the monster';
  if (t.camp) return 'the bandit camp';
  return M.captains ? M.captains[t.idx % M.captains.length] : M.title || M.name;
}
// The creature (or bandit camp) under a world point, for dragging troops onto it. Inside the camp's ring the camp
// itself is the target, even with captains at home, so it can be stormed.
function monsterAt(w) {
  if (!G || !G.monster) return null;
  const scale = typeof sc === 'number' ? sc : 1, k = monsterScale();
  const camp = G.monster.camp;
  if (camp && Math.hypot(camp.x - w.x, (camp.y - w.y) * 0.85) < camp.r * k + 8 / scale) return camp;
  const hits = liveCreatures();
  let best = null, bd = Infinity;
  for (const c of hits) {
    const d = Math.hypot(c.x - w.x, (c.y - w.y) * 0.85);
    if (d < c.r * 1.2 * k + 12 / scale && d < bd) { best = c; bd = d; }
  }
  return best;
}
if (typeof planetAt === 'function') {
  const planetAtNoMonster = planetAt;
  planetAt = w => monsterAt(w) || planetAtNoMonster(w);
}

// ---------- drawing ----------
// Everything below is only called from render.js, after the canvas exists.
function drawMonsterGround(now) {
  const Mo = G.monster;
  if (!Mo) return;
  if (Mo.lair) {
    const { x, y } = Mo.lair, s = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 4, y + s * 0.35, s * 1.5, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    poly([[x - s * 1.4, y + s * 0.3], [x - s * 0.5, y - s * 0.6], [x - s * 0.2, y - s * 0.3], [x + 0.1 * s, y - s * 1.3], [x + s * 0.5, y - s * 0.4], [x + s * 0.8, y - s * 0.7], [x + s * 1.4, y + s * 0.3]], '#3a2a26');
    poly([[x - s * 0.2, y - s * 0.3], [x + 0.1 * s, y - s * 1.3], [x + s * 0.5, y - s * 0.4], [x + s * 0.3, y + s * 0.3], [x - s * 0.3, y + s * 0.3]], '#2a1e1c');
    // Lava glow in the crater.
    const g = reduceMotion ? 0.7 : 0.55 + 0.25 * Math.sin(now / 400);
    ctx.fillStyle = `rgba(255,110,30,${g})`; ctx.beginPath(); ctx.ellipse(x + s * 0.1, y - s * 1.2, s * 0.18, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,140,40,${g * 0.8})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 1.2); ctx.lineTo(x + s * 0.25, y - s * 0.6); ctx.lineTo(x + s * 0.15, y - s * 0.1); ctx.stroke();
  }
  if (Mo.camp) {
    const { x, y } = Mo.camp;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 30, 11, 0, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy, k] of [[-18, 2, 1], [16, 4, 0.9], [0, -10, 0.8]]) {
      const tx = x + dx, ty = y + dy, tw = 9 * k, th = 10 * k;
      poly([[tx - tw, ty], [tx + tw, ty], [tx, ty - th]], '#5a4a3a');
      poly([[tx - tw * 0.4, ty - th * 0.5], [tx + tw * 0.4, ty - th * 0.5], [tx, ty - th]], '#8a2a22');
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - th * 0.5); ctx.stroke();
    }
    const f = reduceMotion ? 0.8 : 0.6 + 0.4 * Math.sin(now / 90);
    ctx.fillStyle = `rgba(255,150,40,${f})`; ctx.beginPath(); ctx.ellipse(x, y + 1, 3, 4 * f, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1e1c'; ctx.fillRect(x - 5, y + 2, 10, 2);
    // A black flag over the camp.
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 24, y - 2); ctx.lineTo(x + 24, y - 22); ctx.stroke();
    poly([[x + 24, y - 22], [x + 34, y - 19], [x + 24, y - 15]], '#1a1410');
  }
  // The Cyclops's road for the coming wave, dashed, so everyone can read it.
  for (const c of liveCreatures()) {
    if (!c.route || c.dead) continue;
    ctx.setLineDash([6, 8]); ctx.lineDashOffset = reduceMotion ? 0 : -now / 90;
    ctx.strokeStyle = alpha(MONSTERS[G.monster.id].color, 0.7); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(c.x, c.y);
    for (let i = c.step || 0; i < c.route.length; i++) ctx.lineTo(c.route[i].x, c.route[i].y);
    ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
}

// The creatures are drawn in the same ink-outlined style as the castles.
function drawMonster(c, now) {
  const M = MONSTERS[G.monster.id], t = reduceMotion ? 0 : now / 1000, x = c.x, y = c.y, d = c.dir || 1;
  const k = monsterScale();
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y);
  const hovered = typeof ptr === 'object' && ptr.hover === c;
  if (hovered) {
    ctx.save(); ctx.translate(x, y + 8); ctx.scale(1, 0.5);
    ctx.strokeStyle = G.theme.ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, c.r * 1.45, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 9, c.r * 0.9, c.r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  if (M.art === 'wyrm') {
    // A long serpent: a sine-wave body of fat segments, head at the front.
    ctx.lineCap = 'round';
    for (const [w, colr] of [[9, INK], [6.5, M.color], [2.5, '#d7e6c2']]) {
      ctx.strokeStyle = colr; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const u = i / 12, bx = x - d * (u * 44 - 10), by = y + Math.sin(u * 6 + t * 5) * 5 - (1 - u) * 3; i ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by); }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    const hx = x + d * 12, hy = y - 3;
    poly([[hx - d * 6, hy - 6], [hx + d * 9, hy - 2], [hx + d * 8, hy + 4], [hx - d * 6, hy + 5]], M.color);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - d * 6, hy - 6); ctx.lineTo(hx + d * 9, hy - 2); ctx.lineTo(hx + d * 8, hy + 4); ctx.lineTo(hx - d * 6, hy + 5); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.arc(hx + d * 3, hy - 1, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (M.art === 'dragon') {
    const flap = c.perched ? 0 : Math.sin(t * 9) * 10;
    const body = '#b8322b', belly = '#e9b43b';
    // Wings.
    for (const s of [-1, 1]) {
      const wx = x + s * 6, span = c.perched ? 10 : 26;
      poly([[wx, y - 8], [wx + s * span, y - 16 - flap], [wx + s * span * 0.75, y - 4 - flap * 0.5], [wx + s * span * 0.4, y - 2]], c.perched ? '#8c2620' : body);
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx, y - 8); ctx.lineTo(wx + s * span, y - 16 - flap); ctx.lineTo(wx + s * span * 0.4, y - 2); ctx.stroke();
    }
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, y - 4, 13, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(x, y - 1, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Tail and neck.
    ctx.strokeStyle = body; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - d * 10, y - 3); ctx.quadraticCurveTo(x - d * 22, y - 2 + Math.sin(t * 4) * 3, x - d * 28, y - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + d * 10, y - 6); ctx.quadraticCurveTo(x + d * 16, y - 14, x + d * 18, y - 18); ctx.stroke(); ctx.lineCap = 'butt';
    poly([[x + d * 13, y - 22], [x + d * 27, y - 18], [x + d * 18, y - 13]], body);
    ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.arc(x + d * 18, y - 19, 1.4, 0, Math.PI * 2); ctx.fill();
    if (!c.perched && !reduceMotion) { ctx.fillStyle = 'rgba(255,120,30,0.6)'; ctx.beginPath(); ctx.arc(x + d * (26 + (t * 40 % 6)), y - 17, 1.5, 0, Math.PI * 2); ctx.fill(); }
  } else if (M.art === 'cyclops') {
    const skin = '#b9a27a', dark = '#8a7452';
    const sway = c.asleep ? 0 : Math.sin(t * 6) * 2;
    ctx.fillStyle = dark; ctx.fillRect(x - 7, y - 10, 5, 12); ctx.fillRect(x + 2, y - 10, 5, 12);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.roundRect(x - 11, y - 30, 22, 22, 5); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 11, y - 18, 22, 6);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - 36, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // The eye.
    ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.ellipse(x + d * 2, y - 37, 4, c.asleep ? 0.8 : 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!c.asleep) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + d * 3, y - 37, 1.6, 0, Math.PI * 2); ctx.fill(); }
    // Club.
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + d * 11, y - 20 + sway); ctx.lineTo(x + d * 24, y - 34 + sway); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.arc(x + d * 25, y - 36 + sway, 4.5, 0, Math.PI * 2); ctx.fill();
    if (c.asleep) {
      ctx.fillStyle = PARCH; ctx.font = '700 9px "Alegreya Sans", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const zz = reduceMotion ? 0 : (t * 2) % 1;
      ctx.fillText('z', x + 10, y - 44 - zz * 6); ctx.fillText('z', x + 15, y - 50 - zz * 8);
    }
  } else {
    // Bandit captain: three dark riders under a black pennant.
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 7, fy = y + (i % 2) * 3, step = reduceMotion || c.atCamp ? 0 : Math.sin(t * 8 + i);
      ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(fx, fy - 1); ctx.lineTo(fx - 1.4 * step, fy + 2.6); ctx.moveTo(fx, fy - 1); ctx.lineTo(fx + 1.4 * step, fy + 2.6); ctx.stroke();
      poly([[fx - 2.4, fy + 1], [fx + 2.4, fy + 1], [fx, fy - 6.5]], '#2a2420');
      ctx.fillStyle = '#c8956a'; ctx.beginPath(); ctx.arc(fx, fy - 5.2, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8322b'; ctx.fillRect(fx - 1.6, fy - 6.4, 3.2, 1.2);
      ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(fx + 2 * d, fy + 1.5); ctx.lineTo(fx + 2 * d, fy - 7); ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y - 20); ctx.stroke();
    const wave = reduceMotion ? 0 : Math.sin(t * 4 + c.idx) * 1.5;
    poly([[x, y - 20], [x + 9, y - 18 + wave], [x, y - 14]], '#1a1410');
  }
  ctx.lineJoin = 'miter';
  ctx.restore();
}

// Health bars with a coloured segment per army for the damage it has dealt, and the creature's name.
function drawMonsterBars(now) {
  const Mo = G.monster;
  if (!Mo) return;
  const M = MONSTERS[Mo.id], k = monsterScale();
  for (const c of Mo.creatures) {
    if (c.dead) continue;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k); ctx.translate(-c.x, -c.y);
    const w = M.count ? 34 : 48, h = 5, x = c.x - w / 2, y = c.y + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(x - 1, y - 1, w + 2, h + 2, 2); ctx.fill();
    let px = x;
    for (const [o, dealt] of Object.entries(c.dmg).sort((a, b) => b[1] - a[1])) {
      const sw = w * dealt / c.maxHp;
      ctx.fillStyle = col(+o); ctx.fillRect(px, y, sw, h); px += sw;
    }
    ctx.fillStyle = '#e8e0cc'; ctx.fillRect(px, y, Math.max(0, x + w - px), h);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, w, h);
    const label = `${M.captains ? M.captains[c.idx % M.captains.length] : (M.title || M.name).replace(/^the /i, '')} ${Math.ceil(c.hp)}`;
    ctx.font = `700 ${M.count ? 9 : 11}px "Alegreya Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,6,0.8)'; ctx.strokeText(label, c.x, y + h + 2);
    ctx.fillStyle = c.hp / c.maxHp < SWARM_AT ? '#ffb3ad' : PARCH; ctx.fillText(label, c.x, y + h + 2);
    ctx.restore();
  }
  if (Mo.respawnWave !== null && !liveCreatures().length && Mo.warned) {
    // The wave before it returns, a warning is drawn where it will appear: at the lair or camp, or anywhere.
    const at = Mo.lair || Mo.camp;
    if (at) {
      const p = reduceMotion ? 0.7 : 0.5 + 0.3 * Math.sin(now / 250);
      ctx.strokeStyle = alpha(M.color, p); ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(at.x, at.y, 40, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

function drawMonsterFx(f, now) {
  const life = MONSTER_FX[f.kind], t = Math.min(1, f.age / life);
  if (f.kind === 'fire') {
    // A cone of flame from the dragon to its target.
    const ang = Math.atan2(f.y1 - f.y, f.x1 - f.x), len = Math.hypot(f.x1 - f.x, f.y1 - f.y) * Math.min(1, t * 2.2);
    for (const [w, colr, a] of [[22, '#ff6a1a', 0.45], [12, '#ffb13b', 0.7], [5, '#fff3c0', 0.9]]) {
      ctx.strokeStyle = alpha(colr, a * (1 - t * t)); ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(ang) * len, f.y + Math.sin(ang) * len); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = `rgba(255,120,30,${0.5 * (1 - t)})`; ctx.beginPath(); ctx.arc(f.x1, f.y1, 10 + t * 22, 0, Math.PI * 2); ctx.fill();
  } else if (f.kind === 'smash') {
    ctx.save(); ctx.translate(f.x, f.y + f.r * 0.4); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, f.r * 0.6 + t * 50, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(90,70,50,${0.8 * (1 - t)})`; ctx.lineWidth = 8 * (1 - t) + 1; ctx.stroke(); ctx.restore();
    ctx.fillStyle = `rgba(120,100,70,${1 - t})`;
    for (let i = 0; i < 8; i++) { const a = i * 0.8; ctx.fillRect(f.x + Math.cos(a) * (8 + t * 30), f.y - 8 + Math.sin(a) * (5 + t * 14) - t * 10, 3, 3); }
  } else if (f.kind === 'raid') {
    // Coins scatter from the raided castle.
    for (let i = 0; i < 7; i++) {
      const a = 0.9 + i * 0.5, r = 6 + t * 30;
      ctx.fillStyle = alpha('#f3d27a', 1 - t); ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y - 10 + Math.sin(a) * r * 0.5 - t * 12, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (f.kind === 'bite') {
    ctx.strokeStyle = alpha('#fff8e6', 1 - t); ctx.lineWidth = 1.4;
    const open = (1 - t) * 6;
    ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - open); ctx.lineTo(f.x, f.y - open - 3); ctx.lineTo(f.x + 5, f.y - open);
    ctx.moveTo(f.x - 5, f.y + open); ctx.lineTo(f.x, f.y + open + 3); ctx.lineTo(f.x + 5, f.y + open); ctx.stroke();
  } else if (f.kind === 'roar') {
    for (let i = 0; i < 3; i++) {
      const u = Math.max(0, Math.min(1, t * 1.5 - i * 0.2));
      ctx.strokeStyle = alpha(f.col || PARCH, (1 - u) * 0.9); ctx.lineWidth = 3 - i;
      ctx.beginPath(); ctx.arc(f.x, f.y, 10 + u * 70, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

// ---------- banners and sound ----------
// The simulation reports through 'monster' events; the page turns them into banners. Headless runs have no toast().
on('monster', e => {
  if (typeof toast !== 'function' || !G || G.cfg.demo) return;
  const M = e.monster, title = M.title || M.name, name = title[0].toUpperCase() + title.slice(1);
  const captain = e.creature && M.captains ? M.captains[e.creature.idx % M.captains.length] : null;
  const who = o => o === 1 ? 'You' : army(o).full;
  const whose = o => o === 1 ? 'your' : `${army(o).name}'s`;
  if (e.kind === 'slain') {
    const extra = e.last && M.bonus ? ` The last captain: +${M.bonus} bonus.` : '';
    const slainName = captain || title;
    toast(e.o === 1 ? `You slew ${slainName}!` : `${who(e.o)} slays ${slainName}!`, `${e.o === 1 ? 'You take' : `${lordOf(e.o).short} takes`} the bounty: ${Math.round(e.coins)} coins.${extra}`, col(e.o));
    sfx.horn(e.o === 1);
  } else if (e.kind === 'warning') toast(`${name} stirs`, `It returns next wave${G.monster.lair ? ' to its lair' : G.monster.camp ? ' to its camp' : ', far from every castle'}.`, M.color);
  else if (e.kind === 'spawn') { toast(`${name} is abroad again`, M.desc, M.color); sfx.drum(); }
  else if (e.kind === 'fire') { toast(`${name} breathes fire`, e.castle ? `${whose(e.o)[0].toUpperCase() + whose(e.o).slice(1)} castle loses ${Math.round(e.lost)} troops to the flames.` : `A ${whose(e.o)} column loses ${Math.round(e.lost)} troops to the flames.`, M.color); if (e.o === 1) sfx.clash(); }
  else if (e.kind === 'smash') { toast(`${name} smashes a castle`, `${e.o ? whose(e.o)[0].toUpperCase() + whose(e.o).slice(1) + ' castle' : 'An unclaimed keep'} loses 30% of its garrison${e.level ? ` and a level of ${e.level}` : ''}.`, M.color); if (e.o === 1) sfx.clash(); }
  else if (e.kind === 'raid') { toast(`Bandits raid ${whose(e.o)} castle`, `They ride off with ${Math.round(e.coins)} coins and a tenth of the garrison.`, M.color); if (e.o === 1) sfx.clash(); }
});
