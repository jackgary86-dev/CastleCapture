// achievements.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, achievements.js. There is no build step.
// Achievements and personal records. Listens to the simulation's events and never changes a
// battle; everything is saved in this browser under 'cs-achv'. Browser only.

const ACH_KEY = 'cs-achv';

// Progress-based achievements read their count from the records.
const ACHIEVEMENTS = [
  { id: 'firstWin', name: 'First Blood', desc: 'Win your first battle.' },
  { id: 'warlord', name: 'Warlord', desc: 'Win a battle on Warlord difficulty.' },
  { id: 'blitz', name: 'Lightning War', desc: 'Win a battle in under 2 minutes.' },
  { id: 'noPower', name: 'Steel Alone', desc: 'Win without using your special power.' },
  { id: 'untouched', name: 'Not One Stone', desc: 'Win without losing a single castle.' },
  { id: 'comeback', name: 'Back From the Brink', desc: 'Win after falling below a fifth of the troops on the map.' },
  { id: 'threeWay', name: 'Crown of Three', desc: 'Win a battle against two rivals at once.' },
  { id: 'builder', name: 'Master Builder', desc: 'Win with your map unit still standing on the field.' },
  { id: 'campaign', name: 'The High Throne', desc: "Win the last chapter of an army's story campaign." },
  { id: 'allArmies', name: 'Five Banners', desc: 'Win with every army.', goal: 5, progress: r => r.armiesWon.length },
  { id: 'allLords', name: 'Bane of Lords', desc: 'Beat every lord on Warlord.', goal: 5, progress: r => r.lordsBeatenHard.length },
  { id: 'ambush', name: 'Ambush Master', desc: 'Destroy 100 enemy troops in battles on the road.', goal: 100, progress: r => Math.floor(r.ambushed) },
  { id: 'conqueror', name: 'Conqueror', desc: 'Capture 100 castles.', goal: 100, progress: r => r.castles },
  // The Grand Campaign (#63): its wins count here, not towards the battle achievements above.
  { id: 'grandWin', name: 'Crowned', desc: 'Win a Grand Campaign.' },
  { id: 'grandWarlord', name: 'Emperor', desc: 'Win a Grand Campaign on Warlord difficulty.' },
  { id: 'grandMaps', name: 'Lord of Every Land', desc: 'Win a Grand Campaign on every map.', get goal() { return grandMapCount(); }, progress: r => r.grandMapsWon.length },
  { id: 'slayer', name: 'Monster Slayer', desc: 'Land the killing blow on a Grand Campaign monster.', goal: 1, progress: r => r.slain },
  { id: 'hunter', name: 'Beast Hunter', desc: 'Slay 10 Grand Campaign monsters.', goal: 10, progress: r => r.slain },
  // King of the Hill (#64): like the Grand Campaign, its games count here and not towards battles won and lost.
  { id: 'hillWin', name: 'King of the Hill', desc: 'Win a King of the Hill race.' },
  { id: 'hillFast', name: 'Unshaken', desc: `Reach ${HILL.goal} points in King of the Hill within ${Math.round(HILL.goal * 1.4 / 60)} minutes.` },
  { id: 'hillAll', name: 'Every Crown', desc: 'Win King of the Hill with every army.', goal: 5, progress: r => r.hillArmiesWon.length },
  // Siege Defense (#65): waves held, unlocked the moment the wave is beaten.
  { id: 'defense10', name: 'Hold the Line', desc: 'Survive 10 waves of Siege Defense.', goal: 10, progress: r => r.defenseBestWave },
  { id: 'defense20', name: 'Unbroken', desc: 'Survive 20 waves of Siege Defense.', goal: 20, progress: r => r.defenseBestWave },
  { id: 'defense30', name: 'The Last Bastion', desc: 'Survive 30 waves of Siege Defense.', goal: 30, progress: r => r.defenseBestWave },
  // Capture the Crown (#66): like the other modes, its raids count here and not towards battles won and lost.
  { id: 'crownWin', name: 'Crown Thief', desc: 'Win a Capture the Crown raid.' },
  { id: 'crownRoad', name: 'Highway Robbery', desc: "Seize a rival's crown from its column on the road." },
  { id: 'crownHidden', name: 'Sleight of Hand', desc: 'Win Capture the Crown without rival scouts ever finding your crown.' },
];
function grandMapCount() { return typeof GRAND_MAPS === 'object' ? Object.keys(GRAND_MAPS).length : 1; }

const blankRecords = () => ({
  battles: 0, wins: 0, losses: 0, castles: 0, ambushed: 0,
  byArmy: {}, byLord: {}, best: {}, armiesWon: [], lordsBeatenHard: [],
  grandPlayed: 0, grandWon: 0, grandMapsWon: [], slain: 0,
  hillPlayed: 0, hillWon: 0, hillArmiesWon: [], hillBest: {},   // hillBest: fastest time to the goal, by army
  defensePlayed: 0, defenseBestWave: 0, defenseBestScore: 0,
  crownPlayed: 0, crownWon: 0, crownsTaken: 0,
});
function loadAchievements() {
  const d = store.get(ACH_KEY, null);
  return { unlocked: (d && d.unlocked) || {}, rec: { ...blankRecords(), ...((d && d.rec) || {}) } };
}
let ach = loadAchievements();
const saveAchievements = () => store.set(ACH_KEY, ach);

// ---------- tracking a battle ----------
// Per-battle counters live on G, so a saved and resumed battle keeps them.
on('newGame', g => { g.ach = { ambushed: 0, exact: false }; });

// Enemy troops destroyed by the player's columns on the road. Uses the losses the road clash
// event reports when it has them.
on('clash', ({ attacker, defender, road, lost }) => {
  if (!road || !G || G.cfg.demo || !lost || (attacker !== 1 && defender !== 1)) return;
  const enemy = attacker === 1 ? defender : attacker;
  G.ach.exact = true;
  G.ach.ambushed += lost[enemy] || 0;
});

// Without per-clash losses, estimate from the player's own road losses and both sides' road strength.
function ambushedThisBattle() {
  if (G.ach && G.ach.exact) return G.ach.ambushed;
  const rivals = G.owners.slice(1);
  const enemyRoad = rivals.reduce((a, o) => a + army(o).stats.atk * army(o).stats.road, 0) / rivals.length;
  return G.stats.roadLost * (army(1).stats.atk * army(1).stats.road) / enemyRoad;
}

// The lowest share of all troops on the map the player held, from the summary chart's samples.
function lowestShare() {
  let low = 1;
  for (const s of G.history) {
    const total = s.v.reduce((a, x) => a + x, 0);
    if (total > 0) low = Math.min(low, s.v[0] / total);
  }
  return low;
}

// Unlock whatever the records now qualify for, plus any achievements in `earned`; returns the new ones.
function unlockEarned(earned = new Set()) {
  for (const a of ACHIEVEMENTS) if (a.goal && a.progress(ach.rec) >= a.goal) earned.add(a.id);
  const fresh = ACHIEVEMENTS.filter(a => earned.has(a.id) && !ach.unlocked[a.id]);
  for (const a of fresh) ach.unlocked[a.id] = Date.now();
  saveAchievements();
  return fresh;
}

// A Grand Campaign counts towards its own achievements and records, and towards the career totals
// (castles captured, troops destroyed on the road), but not towards battles won and lost.
function grandEnded(win) {
  const r = ach.rec;
  r.grandPlayed++;
  r.castles += G.caps;
  r.ambushed += ambushedThisBattle();
  const earned = new Set();
  if (win) {
    r.grandWon++;
    const map = G.cfg.grandMap || 'realm';
    if (!r.grandMapsWon.includes(map)) r.grandMapsWon.push(map);
    earned.add('grandWin');
    if (G.cfg.diff === 'hard') earned.add('grandWarlord');
  }
  showUnlocks(unlockEarned(earned));
}

// King of the Hill: its own wins, a best time to the goal per army, and the career totals.
function hillEnded(win) {
  const r = ach.rec, me = G.fac[1], H = G.hill;
  r.hillPlayed++;
  r.castles += G.caps;
  r.ambushed += ambushedThisBattle();
  const earned = new Set();
  if (win) {
    r.hillWon++;
    if (!r.hillArmiesWon.includes(me)) r.hillArmiesWon.push(me);
    earned.add('hillWin');
    if (H && H.reachedAt != null) {
      if (!(r.hillBest[me] <= H.reachedAt)) r.hillBest[me] = H.reachedAt;
      if (H.reachedAt <= HILL.goal * 1.4) earned.add('hillFast');
    }
  }
  showUnlocks(unlockEarned(earned));
}

// Slaying a map monster unlocks on the spot, with a banner, since a campaign can run for an hour.
on('monster', e => {
  if (e.kind !== 'slain' || e.o !== 1 || !G || G.cfg.demo) return;
  ach.rec.slain++;
  const fresh = unlockEarned();
  if (!fresh.length) return;
  refreshAchButton();
  // After the slaying banner (3.2 s), one achievement banner at a time.
  const game = G;
  fresh.forEach((a, i) => setTimeout(() => {
    if (G !== game || G.over) return;
    toast(`Achievement unlocked: ${a.name}`, a.desc, army(1).color);
    sfx.chime();
  }, 3300 * (i + 1)));
});

// Siege Defense (#65): the best wave counts as soon as it is beaten, with a banner, since a long siege
// can run a while; at the end the game counts towards the career totals but not battles won and lost.
on('defense', e => {
  if (e.kind !== 'cleared' || !G || G.cfg.demo) return;
  const r = ach.rec;
  r.defenseBestWave = Math.max(r.defenseBestWave, e.wave);   // the best score waits for the end: losing castles lowers it
  const fresh = unlockEarned();
  if (!fresh.length) return;
  refreshAchButton();
  fresh.forEach((a, i) => setTimeout(() => {
    if (G && !G.over) { toast(`Achievement unlocked: ${a.name}`, a.desc, army(1).color); sfx.chime(); }
  }, 3300 * (i + 1)));
});
function defenseEnded() {
  const r = ach.rec;
  r.defensePlayed++;
  r.castles += G.caps;
  r.ambushed += ambushedThisBattle();
  r.defenseBestWave = Math.max(r.defenseBestWave, G.def.held);
  r.defenseBestScore = Math.max(r.defenseBestScore, G.def.score);
  showUnlocks(unlockEarned());
}

// Capture the Crown: its own wins, crowns taken, and the career totals.
function crownEnded(win) {
  const r = ach.rec, C = G.crown;
  r.crownPlayed++;
  r.castles += G.caps;
  r.ambushed += ambushedThisBattle();
  const earned = new Set();
  const mine = C ? G.owners.filter(o => C.out[o] && C.out[o].by === 1) : [];
  r.crownsTaken += mine.length;
  if (mine.some(o => C.out[o].road)) earned.add('crownRoad');
  if (win) {
    r.crownWon++;
    earned.add('crownWin');
    if (C && C.exposed[1] == null) earned.add('crownHidden');
  }
  showUnlocks(unlockEarned(earned));
}

on('end', ({ win }) => {
  if (!G || G.cfg.demo || G.cfg.tutorial) return;
  if (G.mode === 'grand') { grandEnded(win); return; }
  if (G.mode === 'hill') { hillEnded(win); return; }
  if (G.mode === 'defense') { defenseEnded(); return; }
  if (G.mode === 'crown') { crownEnded(win); return; }
  if ((G.cfg.humans || 1) > 1) return;   // beating a friend at the other keyboard isn't beating a lord
  const r = ach.rec, me = G.fac[1], rivals = G.owners.slice(1).map(o => G.fac[o]), diff = G.cfg.diff;
  r.battles++;
  if (win) r.wins++; else r.losses++;
  (r.byArmy[me] ??= { w: 0, l: 0 })[win ? 'w' : 'l']++;
  for (const id of rivals) (r.byLord[id] ??= { w: 0, l: 0 })[win ? 'w' : 'l']++;
  r.castles += G.caps;
  r.ambushed += ambushedThisBattle();
  if (win) {
    if (!(r.best[diff] <= G.time)) r.best[diff] = G.time;
    if (!r.armiesWon.includes(me)) r.armiesWon.push(me);
    if (diff === 'hard') for (const id of rivals) if (!r.lordsBeatenHard.includes(id)) r.lordsBeatenHard.push(id);
  }

  // Which achievements this battle earned.
  const earned = new Set();
  if (win) {
    earned.add('firstWin');
    if (diff === 'hard') earned.add('warlord');
    if (G.time < 120) earned.add('blitz');
    if (G.stats.powerUses === 0) earned.add('noPower');
    if (G.stats.castlesLost === 0) earned.add('untouched');
    if (lowestShare() < 0.2) earned.add('comeback');
    if (G.owners.length > 2) earned.add('threeWay');
    if (!G.startUnit && G.units.some(u => u.owner === 1)) earned.add('builder');   // built in battle, not brought from the Profile (#85)
    if (G.cfg.campaign && CAMPAIGNS[G.cfg.campaign] && G.cfg.chapter === CAMPAIGNS[G.cfg.campaign].length) earned.add('campaign');
  }
  showUnlocks(unlockEarned(earned));
});

// ---------- end screen and menu ----------
function showUnlocks(fresh) {
  let box = document.getElementById('endAch');
  if (!box) {
    box = document.createElement('div');
    box.id = 'endAch'; box.className = 'end-ach';
    document.getElementById('endQuote').after(box);
  }
  box.hidden = !fresh.length;
  if (!fresh.length) return;
  box.innerHTML = '';
  for (const a of fresh) {
    const row = document.createElement('div');
    row.className = 'end-ach-row';
    row.innerHTML = '<span class="medal won" aria-hidden="true"></span><div><b></b><small></small></div>';
    row.querySelector('b').textContent = `Achievement unlocked: ${a.name}`;
    row.querySelector('small').textContent = a.desc;
    box.append(row);
  }
  sfx.chime();
}

const achOv = document.createElement('div');
achOv.className = 'overlay'; achOv.id = 'achOv'; achOv.hidden = true;
achOv.innerHTML = `<div class="sheet ach-sheet">
  <h2>Achievements</h2>
  <p id="achCount"></p>
  <div class="achs" id="achList"></div>
  <span class="label">Records</span>
  <dl class="records" id="achRecords"></dl>
  <div class="rec-tables">
    <table class="rec-table"><caption>Playing as</caption><thead><tr><th>Army</th><th>Won</th><th>Lost</th></tr></thead><tbody id="achByArmy"></tbody></table>
    <table class="rec-table"><caption>Against each lord</caption><thead><tr><th>Lord</th><th>Won</th><th>Lost</th></tr></thead><tbody id="achByLord"></tbody></table>
    <table class="rec-table"><caption>King of the Hill</caption><thead><tr><th>Army</th><th>Best to ${HILL.goal}</th></tr></thead><tbody id="achHill"></tbody></table>
  </div>
  <div class="row">
    <button class="primary" id="achClose">Back to the menu</button>
    <button id="achReset">Erase achievements and records</button>
  </div>
</div>`;
document.getElementById('board').append(achOv);

// Menu entry, under the campaign.
const achGroup = document.createElement('div');
achGroup.className = 'group';
achGroup.innerHTML = '<span class="label">Achievements and records</span><button id="btnAch"></button>';
document.getElementById('ladder').closest('.group').after(achGroup);
const btnAch = document.getElementById('btnAch');
const refreshAchButton = () => {
  btnAch.textContent = `View achievements (${Object.keys(ach.unlocked).length} of ${ACHIEVEMENTS.length}) and records`;
};
refreshAchButton();
on('end', refreshAchButton);

const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function cell(text) { const td = document.createElement('td'); td.textContent = text; return td; }

function renderAchievements() {
  const r = ach.rec, n = Object.keys(ach.unlocked).length;
  document.getElementById('achCount').textContent = `${n} of ${ACHIEVEMENTS.length} unlocked.`;
  const list = document.getElementById('achList');
  list.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const done = !!ach.unlocked[a.id];
    const row = document.createElement('div');
    row.className = 'ach' + (done ? ' done' : '');
    row.innerHTML = `<span class="medal${done ? ' won' : ''}" aria-hidden="true"></span><div class="ach-text"><b></b><span></span></div><div class="ach-state"></div>`;
    row.querySelector('b').textContent = a.name;
    row.querySelector('.ach-text span').textContent = a.desc;
    const state = row.querySelector('.ach-state');
    if (done) state.textContent = fmtDate(ach.unlocked[a.id]);
    else if (a.goal) {
      const v = Math.min(a.goal, a.progress(r));
      state.innerHTML = `<span class="bar"><span style="width:${(100 * v / a.goal).toFixed(1)}%"></span></span>`;
      state.append(`${v} / ${a.goal}`);
    } else state.textContent = 'Locked';
    list.append(row);
  }

  const rate = r.battles ? `${Math.round(100 * r.wins / r.battles)}%` : '—';
  const best = d => r.best[d] != null ? fmtTime(r.best[d]) : '—';
  const stats = [
    ['Battles', r.battles], ['Won', r.wins], ['Lost', r.losses], ['Win rate', rate],
    ['Castles captured', r.castles], ['Enemy troops destroyed on the road', Math.floor(r.ambushed)],
    ['Fastest win, Squire', best('easy')], ['Fastest win, Knight', best('medium')], ['Fastest win, Warlord', best('hard')],
    ['Grand Campaigns', r.grandPlayed], ['Grand Campaigns won', r.grandWon], ['Map monsters slain', r.slain],
    ['King of the Hill races', r.hillPlayed], ['King of the Hill won', r.hillWon],
    ['Siege Defense games', r.defensePlayed], ['Most waves held', r.defenseBestWave], ['Best Siege Defense score', r.defenseBestScore],
    ['Capture the Crown raids', r.crownPlayed], ['Raids won', r.crownWon], ['Crowns taken', r.crownsTaken],
  ];
  const dl = document.getElementById('achRecords');
  dl.innerHTML = '';
  for (const [k, v] of stats) {
    // Each label and value pair in its own div, so they stay together in the grid.
    const pair = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v; pair.append(dt, dd); dl.append(pair);
  }

  const fill = (id, label) => {
    const body = document.getElementById(id);
    body.innerHTML = '';
    for (const key of ARMY_IDS) {
      const rec = (id === 'achByArmy' ? r.byArmy : r.byLord)[key] || { w: 0, l: 0 };
      const tr = document.createElement('tr');
      const name = cell(label(key));
      name.style.setProperty('--c', ARMIES[key].color);
      name.className = 'rec-name';
      tr.append(name, cell(rec.w), cell(rec.l));
      body.append(tr);
    }
  };
  fill('achByArmy', key => ARMIES[key].name);
  fill('achByLord', key => `${LORDS[key].short} of ${ARMIES[key].name}`);
  const hill = document.getElementById('achHill');
  hill.innerHTML = '';
  for (const key of ARMY_IDS) {
    const tr = document.createElement('tr'), name = cell(ARMIES[key].name), best = r.hillBest[key];
    name.style.setProperty('--c', ARMIES[key].color);
    name.className = 'rec-name';
    tr.append(name, cell(best != null ? fmtTime(best) : '—'));
    hill.append(tr);
  }
}

let resetArmed = 0;
btnAch.addEventListener('click', () => { renderAchievements(); achOv.hidden = false; document.getElementById('achClose').focus(); });
document.getElementById('achClose').addEventListener('click', () => { achOv.hidden = true; btnAch.focus(); });
document.getElementById('achReset').addEventListener('click', e => {
  // Two clicks to erase, since this can't be undone.
  if (Date.now() - resetArmed > 4000) {
    resetArmed = Date.now();
    const btn = e.currentTarget;   // currentTarget is null once the click has been handled
    btn.textContent = 'Click again to erase everything';
    setTimeout(() => { btn.textContent = 'Erase achievements and records'; }, 4000);
    return;
  }
  resetArmed = 0;
  ach = { unlocked: {}, rec: blankRecords() };
  saveAchievements();
  e.currentTarget.textContent = 'Erase achievements and records';
  renderAchievements(); refreshAchButton();
});
addEventListener('keydown', e => { if (e.key === 'Escape' && !achOv.hidden) { e.stopImmediatePropagation(); achOv.hidden = true; btnAch.focus(); } }, true);
