#!/usr/bin/env node
// Summarises Grand Campaign runs from tools/balance.js --mode grand --json: per army, campaigns won, times
// out first, average finishing place and the wave it usually fell; overall, the median and longest
// campaign and how many hit the wave cap (with who was still in them).
//
//   node tools/balance.js --mode grand --map all --games 10 --diff hard --json --seed 1000 > g1000.json
//   (and seeds 1010, 1020, 1030 in parallel)
//   node tools/grandsum.js g1000.json g1010.json g1020.json g1030.json [--cap 400] [--json]

const fs = require('fs');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i === -1 ? def : args[i + 1]; };
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--cap'));
if (!files.length) { console.error('usage: node tools/grandsum.js run1.json [run2.json ...] [--cap 400] [--json]'); process.exit(2); }
const CAP = +opt('cap', 400);

// balance.js may print a warning before the JSON, so read from the first brace.
const results = files.flatMap(f => { const t = fs.readFileSync(f, 'utf8'); return JSON.parse(t.slice(t.indexOf('{'))).results; });
const ids = ['aldmere', 'kharzul', 'frostmark', 'solmara', 'nyx'];
const st = Object.fromEntries(ids.map(id => [id, { wins: 0, first: 0, place: 0, outWaves: [] }]));
for (const r of results) {
  if (r.winner) st[r.winner].wins++;
  if (r.eliminated[0]) st[r.eliminated[0].army].first++;
  // Place: the winner 1st, the knocked-out in reverse order of going out, anyone else (surrendered or still
  // in at the cap) shares the places in between.
  const order = r.eliminated.map(e => e.army);
  for (const id of ids) {
    st[id].place += id === r.winner ? 1 : order.includes(id) ? 5 - order.indexOf(id) : 2.5;
    const e = r.eliminated.find(x => x.army === id);
    if (e) st[id].outWaves.push(e.wave);
  }
}
const waves = results.map(r => r.waves).sort((a, b) => a - b), med = xs => xs.length ? xs[xs.length >> 1] : null;
const capped = results.filter(r => !r.winner || r.waves >= CAP);
const summary = {
  campaigns: results.length, medianWaves: med(waves), longest: waves[waves.length - 1], over300: waves.filter(w => w > 300).length, capped: capped.length,
  armies: ids.map(id => ({ army: id, wins: st[id].wins, firstOut: st[id].first, avgPlace: +(st[id].place / results.length).toFixed(2), medianOutWave: med(st[id].outWaves.sort((a, b) => a - b)) })),
  cappedCampaigns: capped.map(r => ({ seed: r.seed, map: r.map, waves: r.waves, left: (r.left || []).map(l => `${l.army} ${l.troops}`).join(', ') })),
};
if (args.includes('--json')) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
console.log(`${summary.campaigns} campaigns · median ${summary.medianWaves} waves · longest ${summary.longest} · over 300: ${summary.over300} · hit the cap: ${summary.capped}`);
console.log('army        wins  first out  avg place  median out-wave');
for (const a of summary.armies) console.log(`${a.army.padEnd(10)} ${String(a.wins).padStart(5)} ${String(a.firstOut).padStart(10)} ${a.avgPlace.toFixed(2).padStart(10)} ${String(a.medianOutWave ?? '-').padStart(16)}`);
for (const c of summary.cappedCampaigns) console.log(`capped: seed ${c.seed} (${c.map}) at ${c.waves} waves, still in: ${c.left || '?'}`);
