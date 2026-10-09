#!/usr/bin/env node
// Headless balance test: every army fights every other army with the AI playing both sides,
// and the run fails if any army's win rate leaves the agreed band.
//
//   node tools/balance.js                 # 4 games per pairing on Warlord, 600 s cap, band 25–75%
//   node tools/balance.js --games 8 --diff medium --seconds 900 --band 0.35,0.65
//   node tools/balance.js --json          # machine-readable results
//
// Only js/data.js and js/sim.js are loaded, so this also proves the simulation has no DOM
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
// The agreed band is deliberately wide to start with (see issue #47); tighten it as the armies are retuned.
const [BAND_LO, BAND_HI] = opt('band', '0.25,0.75').split(',').map(Number);
const JSON_OUT = process.argv.includes('--json');
const DT = 1 / 30;
const MIN_DECIDED = 6; // fewer decided games than this and the band is reported but not enforced

const root = path.join(__dirname, '..');
const code = ['js/data.js', 'js/sim.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .join('\n;\n');
const ctx = vm.createContext({ console });
vm.runInContext(code + `
;globalThis.__api = {
  ARMIES, ARMY_IDS, LORDS, newGame, update, totalOf,
  get G() { return G; },
  seedRandom(s) { Math.random = mulberry(s); },
};`, ctx, { filename: 'castle-siege-sim.js' });
const api = ctx.__api;
const ids = api.ARMY_IDS;

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
