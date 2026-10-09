#!/usr/bin/env node
// Headless balance test: every army fights every other army with the AI playing both sides,
// and the run fails if any army's win rate leaves the agreed band.
//
//   node tools/balance.js                 # 4 games per pairing on Warlord, 600 s cap, band 33–67%
//   node tools/balance.js --games 8 --diff medium --seconds 900 --band 0.35,0.65
//   node tools/balance.js --json          # machine-readable results
//   node tools/balance.js --fps 30        # coarser, faster simulation step (default 60, as in the game)
//   node tools/balance.js --mode grand --games 4   # Grand Campaign: five AI lords play waves to the end
//
// Only js/data.js, js/sim.js and js/grand.js are loaded, so this also proves the simulation has no DOM
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
// The agreed band (see issue #47), tightened from 25–75% once every army sat inside 38–63% at 8 games on
// Warlord and Knight; tighten it again as the armies are retuned.
const [BAND_LO, BAND_HI] = opt('band', '0.33,0.67').split(',').map(Number);
const JSON_OUT = process.argv.includes('--json');
const MODE = opt('mode', 'battle');
// Simulate at the game's own step (the browser runs 1/60 s substeps); coarser steps let fast columns skip
// past each other on the road and skew the results.
const DT = 1 / +opt('fps', 60);
const MIN_DECIDED = 6; // fewer decided games than this and the band is reported but not enforced

const root = path.join(__dirname, '..');
const code = ['js/data.js', 'js/sim.js', 'js/grand.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .join('\n;\n');
const ctx = vm.createContext({ console });
vm.runInContext(code + `
;globalThis.__api = {
  ARMIES, ARMY_IDS, LORDS, GRAND, newGame, update, totalOf, march,
  get G() { return G; },
  seedRandom(s) { Math.random = mulberry(s); },
};`, ctx, { filename: 'castle-siege-sim.js' });
const api = ctx.__api;
const ids = api.ARMY_IDS;
if (MODE === 'grand') { runGrand(); process.exit(0); }

const stat = Object.fromEntries(ids.map(id => [id, { games: 0, decided: 0, wins: 0, powers: 0, units: 0, surrenders: 0 }]));
const lengths = [];
let crashes = 0;

function runGame(armies, mapOf, seed, label) {
  api.seedRandom(seed);
  api.newGame({ seed, n: armies.length === 2 ? 18 : 19, diff: DIFF, armies, map: mapOf });
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
  return { army: id, lord: api.LORDS[id].short, games: s.games, decided: s.decided, wins: s.wins, winRate: rate, powers: stat[id].powers, mapUnits: stat[id].units, surrenders: stat[id].surrenders, outside };
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
  const GR = api.GRAND, results = [];
  for (let g = 0; g < GAMES; g++) {
    const seed = 7000 + g;
    api.seedRandom(seed);
    // Rotate who sits in each realm so every army plays every start.
    const armies = ids.map((_, i) => ids[(i + g) % ids.length]);
    api.newGame({ mode: 'grand', seed, n: GR.castles, diff: DIFF, armies, map: armies[0] });
    const G = api.G;
    G.ais.unshift({ id: 1, diff: DIFF, timer: 1, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() });
    const alive = o => G.planets.some(p => p.owner === o) || G.packets.some(k => k.owner === o);
    const out = { seed, waves: 0, winner: null, eliminated: [] };
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
      }
    } catch (e) {
      console.error(`crash in grand campaign seed ${seed}: ${e.stack}`);
      process.exit(1);
    }
    out.waves = G.wave;
    out.castles = G.planets.length;
    results.push(out);
  }
  const waves = results.map(r => r.waves).sort((a, b) => a - b);
  const median = waves[waves.length >> 1];
  const minutes = w => Math.round(w * (GR.waveSeconds + GR.planSecondsEstimate) / 60);
  if (JSON_OUT) { console.log(JSON.stringify({ mode: 'grand', diff: DIFF, results, medianWaves: median, estMinutes: minutes(median) }, null, 2)); return; }
  console.log(`Castle Siege Grand Campaign: ${DIFF}, ${GAMES} campaigns, ${results[0] ? results[0].castles : '?'} castles, ${GR.waveSeconds}s waves`);
  for (const r of results) {
    const order = r.eliminated.map(e => `${e.army}@${e.wave}`).join(', ');
    console.log(`seed ${r.seed}: ${r.waves} waves, winner ${r.winner || 'none (cap)'}; out: ${order || '-'}`);
  }
  console.log(`\nmedian ${median} waves = about ${minutes(median)} min of play (${GR.waveSeconds}s march + ~${GR.planSecondsEstimate}s planning per wave); target 120–180 waves, about an hour`);
}
