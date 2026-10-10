#!/usr/bin/env node
// Headless balance test: every army fights every other army with the AI playing both sides,
// and the run fails if any army's win rate leaves the agreed band.
//
//   node tools/balance.js                 # 4 games per pairing on Warlord, 600 s cap, band 33–67%
//   node tools/balance.js --games 8 --diff medium --seconds 900 --band 0.35,0.65
//   node tools/balance.js --json          # machine-readable results
//   node tools/balance.js --fps 30        # coarser, faster simulation step (default 60, as in the game)
//   node tools/balance.js --mode grand --games 4   # Grand Campaign: five AI lords play waves to the end
//   node tools/balance.js --mode grand --map scorched   # ...on one map (realm, scorched, fells, blackwood); 'all' cycles them
//   node tools/balance.js --mode hill --games 16   # King of the Hill (#64): every pairing races for the crowned keep
//   node tools/balance.js --mode defense --games 8   # Siege Defense: the AI holds the fortress; median waves per army
//   node tools/balance.js --mode crown --games 16    # Capture the Crown (#66): every pairing hunts the other's hidden crown
//
// Only the simulation files in `code` below are loaded (data, sim, grand, hill, strategy, defense, crown, monsters, mind), so this also proves the simulation has no DOM
// dependencies. Math.random is seeded per game, so the same arguments always give the same result.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const opt = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
};
const GAMES = +opt('games', 4);
const DIFF = opt('diff', 'hard');
const SECONDS = +opt('seconds', 600);
// --castles N and --scale X play ordinary battles on another map size (the menu's Long preset is 26 and 1.25).
const CASTLES = +opt('castles', 0), SCALE = +opt('scale', 0);
// The agreed band (see issue #47), tightened from 25–75% once every army sat inside 38–63% at 8 games on
// Warlord and Knight; tighten it again as the armies are retuned.
const [BAND_LO, BAND_HI] = opt('band', '0.33,0.67').split(',').map(Number);
const JSON_OUT = process.argv.includes('--json');
const MODE = opt('mode', 'battle');
// --strategy on plays battles with every deeper-strategy feature (#67) switched on; off (the default) leaves them
// out; a list such as --strategy spec,terrain switches on just those (spec, supply, terrain, heroes).
const STRATEGY_OPT = opt('strategy', 'off');
const STRATEGY_RUN = STRATEGY_OPT === 'off' ? null
  : STRATEGY_OPT === 'on' ? { spec: true, supply: true, terrain: true, heroes: true }
  : Object.fromEntries(['spec', 'supply', 'terrain', 'heroes'].map(f => [f, STRATEGY_OPT.split(',').includes(f)]));
// --lords alt seats every army's alternate lord (#71, LORDS_ALT) in every game; base (the default) the usual ones.
const LORDSET = opt('lords', 'base');
if (!['base', 'alt'].includes(LORDSET)) { console.error('--lords must be base or alt'); process.exit(2); }
const SEED0 = +opt('seed', 7000);  // Grand Campaign seeds run from here
// Simulate at the game's own step (the browser runs 1/60 s substeps); coarser steps let fast columns skip
// past each other on the road and skew the results.
const DT = 1 / +opt('fps', 60);
const MIN_DECIDED = 6; // fewer decided games than this and the band is reported but not enforced

const root = path.join(__dirname, '..');
const code = ['js/data.js', 'js/sim.js', 'js/grand.js', 'js/hill.js', 'js/strategy.js', 'js/defense.js', 'js/crown.js', 'js/monsters.js', 'js/mind.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .join('\n;\n');
const ctx = vm.createContext({ console });
vm.runInContext(code + `
;globalThis.__api = {
  ARMIES, ARMY_IDS, LORDS, LORDS_ALT, AI_MIND, GRAND, GRAND_MAPS, MONSTERS, HILL, DEFENSE, CROWN, STRATEGY, STRATEGY_ALL, newGame, update, totalOf, march, on, hillCfg, defenseCfg, crownCfg,
  get G() { return G; },
  seedRandom(s) { Math.random = mulberry(s); },
};`, ctx, { filename: 'castle-siege-sim.js' });
const api = ctx.__api;
if (LORDSET === 'alt') {
  const plain = api.newGame;
  api.newGame = (cfg, ...rest) => plain({ ...cfg, lordAlt: cfg.armies.map(() => true) }, ...rest);
}
const lordShort = id => (LORDSET === 'alt' ? api.LORDS_ALT : api.LORDS)[id].short;
const ids = api.ARMY_IDS;
// --set overrides GRAND settings for a run without editing data.js, e.g.
//   --set surrenderShare=0.3,siegeSources.hard=10
for (const pair of (opt('set', '') || '').split(',').filter(Boolean)) {
  const [keyPath, raw] = pair.split('='), keys = keyPath.split('.'), last = keys.pop();
  // mind.<key> sets the smarter-AI switches (js/mind.js, #68), e.g. --set mind.on=0; strategy.<key> a deeper-strategy
  // setting (js/strategy.js, #67), e.g. --set strategy.supplyHops=3; anything else is a GRAND setting.
  const root = keys[0] === 'mind' ? (keys.shift(), api.AI_MIND) : keys[0] === 'strategy' ? (keys.shift(), api.STRATEGY) : api.GRAND;
  const obj = keys.reduce((o, k) => o[k], root);
  if (!obj || !(last in obj)) { console.error(`--set: no setting ${keyPath}`); process.exit(1); }
  obj[last] = isNaN(+raw) ? raw : +raw;
}
if (MODE === 'grand') { runGrand(); process.exit(0); }
if (MODE === 'hill') process.exit(runHill() ? 1 : 0);
if (MODE === 'defense') process.exit(runDefense() ? 0 : 1);
if (MODE === 'crown') process.exit(runCrown() ? 1 : 0);

const stat = Object.fromEntries(ids.map(id => [id, { games: 0, decided: 0, wins: 0, powers: 0, units: 0, surrenders: 0 }]));
const lengths = [];
let crashes = 0;

function runGame(armies, mapOf, seed, label) {
  api.seedRandom(seed);
  api.newGame({ seed, n: CASTLES || (armies.length === 2 ? 18 : 19), diff: DIFF, armies, map: mapOf, ...(SCALE ? { mapScale: SCALE } : {}), ...(STRATEGY_RUN ? { strategy: { ...STRATEGY_RUN } } : {}) });
  const G = api.G;
  // The player's seat is driven by the AI too.
  G.ais.unshift({ id: 1, diff: DIFF, timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
  try {
    while (G.time < SECONDS && !G.over) api.update(DT);
  } catch (e) {
    crashes++;
    console.error(`crash in ${label}: ${e.stack}`);
    return;
  }
  const alive = o => G.planets.some(p => p.owner === o);
  const survivors = G.owners.filter(alive);
  const winner = survivors.length === 1 ? G.fac[survivors[0]] : null;
  lengths.push(G.time);
  for (const o of G.owners) {
    const s = stat[G.fac[o]];
    s.games++;
    if (winner) s.decided++;
    if (winner === G.fac[o]) s.wins++;
    s.powers += G.events.filter(e => e.kind === 'power' && e.owner === o).length;
    s.units += G.bought.has(o) ? 1 : 0;
    s.surrenders += G.surrendered.has(o) ? 1 : 0;
  }
  return winner;
}

// Every pairing, alternating whose homeland is fought on.
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    for (let g = 0; g < GAMES; g++) {
      const a = ids[i], b = ids[j];
      runGame([a, b], g % 2 ? a : b, 1000 + i * 100 + j * 10 + g, `${a} vs ${b} #${g}`);
    }
  }
}
// Two three-way battles for crash coverage. The win band is judged on the pairings only,
// so snapshot those results first; power, unit and surrender counts include everything.
const pairStat = JSON.parse(JSON.stringify(stat));
runGame(['kharzul', 'frostmark', 'nyx'], 'solmara', 5, 'three-way A');
runGame(['aldmere', 'solmara', 'kharzul'], 'nyx', 9, 'three-way B');

lengths.sort((x, y) => x - y);
const rows = ids.map(id => {
  const s = pairStat[id];
  const rate = s.decided ? s.wins / s.decided : null;
  const outside = rate !== null && s.decided >= MIN_DECIDED && (rate < BAND_LO || rate > BAND_HI);
  return { army: id, lord: lordShort(id), games: s.games, decided: s.decided, wins: s.wins, winRate: rate, powers: stat[id].powers, mapUnits: stat[id].units, surrenders: stat[id].surrenders, outside };
});
const summary = {
  diff: DIFF, gamesPerPairing: GAMES, secondsCap: SECONDS, band: [BAND_LO, BAND_HI],
  medianLength: lengths.length ? Math.round(lengths[lengths.length >> 1]) : null,
  undecided: lengths.length - rows.reduce((a, r) => a + r.decided, 0) / 2,
  crashes, rows,
};

if (JSON_OUT) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  const pct = r => r.winRate === null ? '   -' : `${Math.round(r.winRate * 100)}%`.padStart(4);
  console.log(`Castle Siege balance: ${DIFF}, ${GAMES} games per pairing, ${SECONDS}s cap, band ${Math.round(BAND_LO * 100)}–${Math.round(BAND_HI * 100)}%`);
  console.log(`median battle ${summary.medianLength}s, ${summary.undecided} pairing games undecided at the cap, ${crashes} crashes\n`);
  console.log('army        lord     games decided  wins  rate  powers  units  surrenders');
  for (const r of rows) {
    console.log(`${r.army.padEnd(11)} ${r.lord.padEnd(8)} ${String(r.games).padStart(5)} ${String(r.decided).padStart(7)} ${String(r.wins).padStart(5)}  ${pct(r)}  ${String(r.powers).padStart(6)}  ${String(r.mapUnits).padStart(5)}  ${String(r.surrenders).padStart(10)}${r.outside ? '   <-- outside band' : ''}`);
  }
}

const failed = crashes > 0 || rows.some(r => r.outside);
if (failed && !JSON_OUT) console.log('\nFAILED: ' + (crashes ? `${crashes} crash(es)` : 'an army is outside the win band'));
process.exit(failed ? 1 : 0);

// ---------- Grand Campaign ----------
// Five AI lords (the player's seat included) play waves until one realm is left, the wave cap is hit,
// or every survivor is stuck. Reports how many waves a campaign takes and roughly how long that is to play.
function runGrand() {
  const GR = api.GRAND, results = [], mapIds = Object.keys(api.GRAND_MAPS), MAP = opt('map', 'realm');
  // Each map's monster (#48, #50): count kills, who landed the final blow and what its special did.
  const monsterLog = [];
  api.on('monster', e => monsterLog.push(e));
  for (let g = 0; g < GAMES; g++) {
    const seed = SEED0 + g, grandMap = MAP === 'all' ? mapIds[g % mapIds.length] : MAP;
    api.seedRandom(seed);
    monsterLog.length = 0;
    // Rotate who sits in each realm so every army plays every start.
    const armies = ids.map((_, i) => ids[(i + g) % ids.length]);
    api.newGame({ mode: 'grand', seed, n: GR.castles, diff: DIFF, armies, map: armies[0], grandMap });
    const G = api.G;
    G.ais.unshift({ id: 1, diff: DIFF, timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    const alive = o => G.planets.some(p => p.owner === o) || G.packets.some(k => k.owner === o);
    const out = { seed, map: grandMap, waves: 0, winner: null, eliminated: [], monster: null };
    try {
      while (G.wave <= GR.waveCap) {
        // The player's seat falling ends a real campaign; here the other lords play on to a single winner.
        G.over = false;
        api.march();
        for (let t = 0; t < GR.waveSeconds; t += DT) api.update(DT);
        // Stay in plan state if the battle has "ended" for the player's seat; the other lords play on.
        if (G.phase === 'march') { G.phase = 'plan'; G.wave++; }
        for (const o of G.owners) if (!alive(o) && !out.eliminated.some(e => e.o === o)) out.eliminated.push({ o, army: G.fac[o], wave: G.wave });
        const left = G.owners.filter(o => alive(o) && !G.surrendered.has(o));
        if (left.length <= 1) { out.winner = left.length ? G.fac[left[0]] : null; break; }
        // The player's seat is an AI lord here too, so it resigns under the same rule the AI lords surrender
        // by (sim.js checkSurrender): far enough behind the strongest realm for three waves running. In the
        // game a person is never made to surrender, but one that far behind would resign or be finished;
        // without this a hopeless seat 1 could hold out to the wave cap (#72).
        if (alive(1) && !G.surrendered.has(1) && G.wave >= GR.surrenderFromWave) {
          const share = Math.min(GR.wearyMax, GR.surrenderShare + Math.max(0, G.wave - GR.wearyFrom) * GR.wearyPerWave);
          const strongest = Math.max(...G.owners.filter(q => q !== 1 && alive(q) && !G.surrendered.has(q)).map(api.totalOf));
          out.seat1Weak = api.totalOf(1) < strongest * share ? (out.seat1Weak || 0) + 1 : 0;
          if (out.seat1Weak >= 3) {
            G.surrendered.add(1);
            for (const p of G.planets) if (p.owner === 1) { p.owner = 0; p.units = Math.round(p.units * 0.5); }
            G.packets = G.packets.filter(k => k.owner !== 1);
            out.seat1Resigned = G.wave;
          }
        }
      }
    } catch (e) {
      console.error(`crash in grand campaign seed ${seed}: ${e.stack}`);
      process.exit(1);
    }
    out.waves = G.wave;
    out.castles = G.planets.length;
    // Who was still in it at the end, with their troops (for a campaign that hit the cap), and who gave up.
    out.left = G.owners.filter(o => alive(o) && !G.surrendered.has(o)).map(o => ({ army: G.fac[o], seat: o, troops: Math.round(api.totalOf(o)) }));
    out.surrendered = [...G.surrendered].map(o => G.fac[o]);
    if (G.monster) {
      const slain = monsterLog.filter(e => e.kind === 'slain'), specials = monsterLog.filter(e => ['fire', 'smash', 'raid'].includes(e.kind)).length;
      out.monster = { id: G.monster.id, kills: slain.length, slayers: slain.map(e => G.fac[e.o]), specials, left: G.monster.creatures.filter(c => !c.dead).length };
    }
    results.push(out);
  }
  const waves = results.map(r => r.waves).sort((a, b) => a - b);
  const median = waves[waves.length >> 1];
  const minutes = w => Math.round(w * (GR.waveSeconds + GR.planSecondsEstimate) / 60);
  if (JSON_OUT) { console.log(JSON.stringify({ mode: 'grand', diff: DIFF, results, medianWaves: median, estMinutes: minutes(median) }, null, 2)); return; }
  console.log(`Castle Siege Grand Campaign: ${DIFF}, ${GAMES} campaigns, ${results[0] ? results[0].castles : '?'} castles, ${GR.waveSeconds}s waves`);
  for (const r of results) {
    const order = r.eliminated.map(e => `${e.army}@${e.wave}`).join(', ');
    const mon = r.monster ? `; ${r.monster.id}: ${r.monster.kills} kill${r.monster.kills === 1 ? '' : 's'}${r.monster.slayers.length ? ' by ' + r.monster.slayers.join(', ') : ''}, ${r.monster.specials} special${r.monster.specials === 1 ? '' : 's'}` : '';
    console.log(`seed ${r.seed} (${r.map}): ${r.waves} waves, winner ${r.winner || 'none (cap)'}; out: ${order || '-'}${mon}`);
  }
  console.log(`\nmedian ${median} waves = about ${minutes(median)} min of play (${GR.waveSeconds}s march + ~${GR.planSecondsEstimate}s planning per wave); target 120–180 waves, about an hour`);
}

// ---------- King of the Hill (#64) ----------
// Every pairing races for the crowned keep, alternating whose homeland it is fought on, with the AI
// playing both seats. A game is decided by the goal or the time cap (most points; the knockout count stays 0, as seats can't fall), so every
// game counts towards the band. Two three-way races follow for crash coverage. Returns true on failure.
function runHill() {
  const H = api.HILL, st = Object.fromEntries(ids.map(id => [id, { games: 0, wins: 0, held: 0, goal: 0 }]));
  const how = { goal: 0, knockout: 0, cap: 0 }, lens = [];
  let fails = 0;
  const play = (armies, mapOf, seed, label) => {
    api.seedRandom(seed);
    const cfg = api.hillCfg(armies[0], armies.slice(1), DIFF, seed);
    cfg.map = mapOf;
    api.newGame(cfg);
    const G = api.G;
    G.ais.unshift({ id: 1, diff: DIFF, timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    try {
      // The player's seat falling ends a real game; here the race plays on to its own end.
      while (G.hill.winner == null && G.time < H.cap + 1) { G.over = false; api.update(DT); }
    } catch (e) {
      fails++;
      console.error(`crash in ${label}: ${e.stack}`);
      return null;
    }
    const w = G.hill.winner;
    if (w == null) { console.error(`${label}: the race never ended`); fails++; return null; }
    lens.push(G.time);
    how[G.hill.reachedAt != null ? 'goal' : G.time >= H.cap ? 'cap' : 'knockout']++;
    return { G, w };
  };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let g = 0; g < GAMES; g++) {
        const a = ids[i], b = ids[j];
        const r = play([a, b], g % 2 ? a : b, 3000 + i * 100 + j * 10 + g, `${a} vs ${b} #${g}`);
        if (!r) continue;
        for (const o of r.G.owners) {
          const s = st[r.G.fac[o]];
          s.games++;
          s.held += r.G.hill.score[o];
          if (o === r.w) { s.wins++; if (r.G.hill.reachedAt != null) s.goal++; }
        }
      }
    }
  }
  play(['kharzul', 'frostmark', 'nyx'], 'solmara', 5, 'three-way A');
  play(['aldmere', 'solmara', 'kharzul', 'frostmark', 'nyx'], 'nyx', 9, 'five-way');
  lens.sort((x, y) => x - y);
  const rows = ids.map(id => {
    const s = st[id], rate = s.games ? s.wins / s.games : null;
    return { army: id, lord: lordShort(id), games: s.games, wins: s.wins, winRate: rate, byGoal: s.goal, avgPoints: s.games ? Math.round(s.held / s.games) : 0,
      outside: rate !== null && s.games >= MIN_DECIDED && (rate < BAND_LO || rate > BAND_HI) };
  });
  const median = lens.length ? Math.round(lens[lens.length >> 1]) : null;
  if (JSON_OUT) console.log(JSON.stringify({ mode: 'hill', diff: DIFF, gamesPerPairing: GAMES, band: [BAND_LO, BAND_HI], medianLength: median, ended: how, crashes: fails, rows }, null, 2));
  else {
    console.log(`Castle Siege King of the Hill: ${DIFF}, ${GAMES} games per pairing, goal ${H.goal}, cap ${H.cap}s, band ${Math.round(BAND_LO * 100)}–${Math.round(BAND_HI * 100)}%`);
    console.log(`median race ${median}s (${(median / 60).toFixed(1)} min); ended by goal ${how.goal}, knockout ${how.knockout}, time cap ${how.cap}; ${fails} crashes\n`);
    console.log('army        lord     games  wins  rate  by goal  avg points');
    for (const r of rows) console.log(`${r.army.padEnd(11)} ${r.lord.padEnd(8)} ${String(r.games).padStart(5)} ${String(r.wins).padStart(5)}  ${r.winRate === null ? '   -' : (Math.round(r.winRate * 100) + '%').padStart(4)}  ${String(r.byGoal).padStart(7)}  ${String(r.avgPoints).padStart(10)}${r.outside ? '   <-- outside band' : ''}`);
  }
  const failed = fails > 0 || rows.some(r => r.outside);
  if (failed && !JSON_OUT) console.log('\nFAILED: ' + (fails ? `${fails} crash(es)` : 'an army is outside the win band'));
  return failed;
}

// ---------- Siege Defense ----------
// The AI defends the fortress (the hard AI by default, as the Grand runner seats it) against the scripted
// waves, once per seed for every army. Reports the median waves survived per defending army, and fails if
// any army's median sits more than --spread (default 40%) above or below the median of all games.
function runDefense() {
  const SPREAD = +opt('spread', 0.4), CAP = api.DEFENSE.waveCap, rows = [], all = [];
  let crashes = 0;
  ids.forEach((id, i) => {
    const waves = [], scores = [], lengths = [];
    for (let g = 0; g < GAMES; g++) {
      const seed = SEED0 + g * 31 + i * 1000;
      api.seedRandom(seed);
      api.newGame(api.defenseCfg(id, DIFF, null, seed));
      const G = api.G;
      G.ais.unshift({ id: 1, diff: DIFF, timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
      try {
        while (!G.over && G.def.wave <= CAP) api.update(DT);
      } catch (e) {
        crashes++;
        console.error(`crash in defense ${id} seed ${seed}: ${e.stack}`);
        continue;
      }
      waves.push(G.def.held); scores.push(G.def.score); lengths.push(G.time); all.push(G.def.held);
    }
    const med = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
    rows.push({ army: id, games: waves.length, medianWaves: med(waves), medianScore: med(scores), minutes: Math.round(med(lengths) / 6) / 10, waves });
  });
  const sorted = [...all].sort((a, b) => a - b), median = sorted.length ? sorted[sorted.length >> 1] : 0;
  for (const r of rows) r.outside = r.medianWaves === null || Math.abs(r.medianWaves - median) > median * SPREAD;
  const ok = !crashes && !rows.some(r => r.outside);
  if (JSON_OUT) { console.log(JSON.stringify({ mode: 'defense', diff: DIFF, games: GAMES, medianWaves: median, spread: SPREAD, crashes, rows }, null, 2)); return ok; }
  console.log(`Castle Siege Siege Defense: ${DIFF} AI defending, ${GAMES} games per army, waves cap ${CAP}`);
  console.log('army        games  median waves  median score  median length  waves per game');
  for (const r of rows) console.log(`${r.army.padEnd(11)} ${String(r.games).padStart(5)}  ${String(r.medianWaves).padStart(12)}  ${String(r.medianScore).padStart(12)}  ${(r.minutes + ' min').padStart(13)}  ${r.waves.join(' ')}${r.outside ? '   <-- outside the spread' : ''}`);
  console.log(`\nmedian ${median} waves over all games (target 8-15); every army within ${Math.round(SPREAD * 100)}% of it${ok ? '' : ' -- FAILED'}${crashes ? `; ${crashes} crash(es)` : ''}`);
  return ok;
}

// ---------- Capture the Crown (#66) ----------
// Every pairing hunts the other's hidden crown under fog, alternating whose homeland it is fought on,
// with the AI playing both seats (the player's seat hides its crown in character too). A game is decided
// when one realm holds the last crown; games still running at --seconds (default 1500) are undecided.
// The mode is always a duel on a large map. Returns true on failure.
function runCrown() {
  const CAP = +opt('seconds', 1500), st = Object.fromEntries(ids.map(id => [id, { games: 0, decided: 0, wins: 0, moves: 0, scouts: 0, road: 0 }]));
  const lens = [], how = { castle: 0, road: 0 };
  let fails = 0, undecided = 0;
  const play = (armies, mapOf, seed, label) => {
    api.seedRandom(seed);
    const cfg = api.crownCfg(armies[0], armies.slice(1), DIFF, seed);
    cfg.map = mapOf;
    api.newGame(cfg);
    const G = api.G;
    G.ais.unshift({ id: 1, diff: DIFF, timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    try {
      // The player's seat losing its crown ends a real game; here the others play on to the last crown.
      while (G.crown.winner == null && G.time < CAP) { G.over = false; api.update(DT); }
    } catch (e) {
      fails++;
      console.error(`crash in ${label}: ${e.stack}`);
      return null;
    }
    const w = G.crown.winner;
    if (w == null) undecided++; else lens.push(G.time);
    for (const o of G.owners) { const x = G.crown.out[o]; if (x && x.by) how[x.road ? 'road' : 'castle']++; }
    return { G, w };
  };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let g = 0; g < GAMES; g++) {
        const a = ids[i], b = ids[j];
        const r = play([a, b], g % 2 ? a : b, 6000 + i * 100 + j * 10 + g, `${a} vs ${b} #${g}`);
        if (!r) continue;
        for (const o of r.G.owners) {
          const s = st[r.G.fac[o]];
          s.games++;
          s.moves += r.G.crown.moves[o]; s.scouts += r.G.crown.scouts[o];
          if (r.w != null) { s.decided++; if (o === r.w) s.wins++; }
        }
      }
    }
  }
  lens.sort((x, y) => x - y);
  const rows = ids.map(id => {
    const s = st[id], rate = s.decided ? s.wins / s.decided : null;
    return { army: id, lord: lordShort(id), games: s.games, decided: s.decided, wins: s.wins, winRate: rate,
      movesPerGame: s.games ? +(s.moves / s.games).toFixed(1) : 0, scoutsPerGame: s.games ? +(s.scouts / s.games).toFixed(1) : 0,
      outside: rate !== null && s.decided >= MIN_DECIDED && (rate < BAND_LO || rate > BAND_HI) };
  });
  const median = lens.length ? Math.round(lens[lens.length >> 1]) : null;
  if (JSON_OUT) console.log(JSON.stringify({ mode: 'crown', diff: DIFF, gamesPerPairing: GAMES, band: [BAND_LO, BAND_HI], medianLength: median, undecided, crownsTaken: how, crashes: fails, rows }, null, 2));
  else {
    console.log(`Castle Siege Capture the Crown: ${DIFF}, ${GAMES} games per pairing, ${CAP}s cap, crowns revealed at ${api.CROWN.revealAt}s, band ${Math.round(BAND_LO * 100)}–${Math.round(BAND_HI * 100)}%`);
    console.log(`median game ${median}s (${median == null ? '-' : (median / 60).toFixed(1)} min); ${undecided} undecided; crowns taken in castles ${how.castle}, on the road ${how.road}; ${fails} crashes\n`);
    console.log('army        lord     games decided  wins  rate  moves/game  scouts/game');
    for (const r of rows) console.log(`${r.army.padEnd(11)} ${r.lord.padEnd(8)} ${String(r.games).padStart(5)} ${String(r.decided).padStart(7)} ${String(r.wins).padStart(5)}  ${r.winRate === null ? '   -' : (Math.round(r.winRate * 100) + '%').padStart(4)}  ${String(r.movesPerGame).padStart(10)}  ${String(r.scoutsPerGame).padStart(11)}${r.outside ? '   <-- outside band' : ''}`);
  }
  const failed = fails > 0 || rows.some(r => r.outside);
  if (failed && !JSON_OUT) console.log('\nFAILED: ' + (fails ? `${fails} crash(es)` : 'an army is outside the win band'));
  return failed;
}
