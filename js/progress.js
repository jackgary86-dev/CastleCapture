// progress.js
//
// Progression (#70): renown earned in every mode, unlocks bought with it, and the persistent realm map of
// Grand Campaign victories with its seasons and hall of fame. Saved in this browser under 'cs-progress'.
// No DOM access: js/progress-ui.js draws the profile page, the end-screen renown line and the skins.
//
// Cosmetics never touch a battle. The two gameplay unlocks are small and capped, and each can be switched
// off on the profile page: a starting map unit in skirmishes (it uses up that battle's one map unit), and
// a few extra troops at home in the Grand Campaign for each region claimed this season. The headless tools
// (tools/balance.js) never load this file, so their results never include either.

const PROGRESS_KEY = 'cs-progress';

// Renown for each result. Harder difficulties and longer modes pay more; a loss still pays a little.
const RENOWN = {
  battleWin: { easy: 6, medium: 12, hard: 20 }, battleLoss: 3,
  chapter: 10,                                        // on top of the battle, for a story chapter won
  grandWin: { easy: 40, medium: 70, hard: 120 }, grandLoss: 15,
  hillWin: { easy: 8, medium: 15, hard: 25 }, hillLoss: 4,
  defenseWave: 2,                                     // per wave held in Siege Defense
  slain: 10,                                          // landing the killing blow on a map monster
  achievement: 15,                                    // each achievement unlocked
};

// What renown buys. Banners and roofs are cosmetic; a starting unit is the one gameplay unlock.
const UNLOCKS = [
  { id: 'banner-swallow', kind: 'banner', shape: 'swallow', name: 'Swallowtail banner', price: 40, desc: 'The forked banner of the Azure Crown.' },
  { id: 'banner-tassel', kind: 'banner', shape: 'tassel', name: 'Horsetail standard', price: 40, desc: 'The horsehair standard of the steppe clans.' },
  { id: 'banner-square', kind: 'banner', shape: 'square', name: 'Square war banner', price: 40, desc: 'The square banner of the northern jarls.' },
  { id: 'banner-pennant', kind: 'banner', shape: 'pennant', name: 'Long pennant', price: 40, desc: 'The long pennant of the desert sultans.' },
  { id: 'banner-streamer', kind: 'banner', shape: 'streamer', name: "Witch's streamer", price: 40, desc: 'The rippling streamer of the mire covens.' },
  { id: 'roof-gilded', kind: 'roof', color: '#d4a537', name: 'Gilded roofs', price: 60, desc: 'Gold leaf on every roof and spire you hold.' },
  { id: 'roof-verdigris', kind: 'roof', color: '#4f8f7f', name: 'Verdigris roofs', price: 60, desc: 'Old copper, weathered green.' },
  { id: 'roof-ember', kind: 'roof', color: '#b5452f', name: 'Ember roofs', price: 60, desc: 'Fired red tile.' },
  { id: 'roof-midnight', kind: 'roof', color: '#2e3550', name: 'Midnight roofs', price: 60, desc: 'Slate as dark as a moonless sky.' },
  { id: 'roof-bone', kind: 'roof', color: '#d9cfb8', name: 'Bone roofs', price: 60, desc: 'Limewashed white.' },
  { id: 'unit-ballista', kind: 'unit', unit: 'ballista', name: 'Starting Ballista Tower', price: 150, desc: 'Skirmishes begin with a Ballista Tower beside your home castle.' },
  { id: 'unit-trebuchet', kind: 'unit', unit: 'trebuchet', name: 'Starting Siege Trebuchet', price: 150, desc: 'Skirmishes begin with a Siege Trebuchet beside your home castle.' },
  { id: 'unit-ward', kind: 'unit', unit: 'ward', name: 'Starting Great Ward', price: 150, desc: 'Skirmishes begin with a Great Ward beside your home castle.' },
  // Alternate lords (#71): a second lord for each army, picked on the army card once bought.
  ...Object.entries(LORDS_ALT).map(([army, L]) => ({ id: `lord-${army}`, kind: 'lord', army, name: `${L.name}, ${L.title}`, price: L.price, desc: `${ARMIES[army].name}: ${L.playstyle}` })),
];
// Each Grand Campaign map won this season is a claimed region, worth a few troops at home in later campaigns.
const REALM_BONUS = { perRegion: 4, max: 12 };

const blankProgress = () => ({
  v: 1, renown: 0, earned: 0, owned: [], equip: { banner: null, roof: null, unit: null },
  useUnit: true, useRealm: true, achSeen: null, pastDeeds: false, lordPick: {},
  season: 1, seasonStart: Date.now(), seasonEarned: 0, regions: {}, hall: [], log: [],
});
// Only plain, well-typed fields survive a load or an import; anything else falls back to a fresh start.
function cleanProgress(d) {
  const b = blankProgress();
  if (!d || typeof d !== 'object' || d.v !== 1) return b;
  const num = (v, def) => Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
  const ids = new Set(UNLOCKS.map(u => u.id));
  b.renown = num(d.renown, 0); b.earned = num(d.earned, b.renown); b.seasonEarned = num(d.seasonEarned, 0);
  b.owned = Array.isArray(d.owned) ? [...new Set(d.owned.filter(id => ids.has(id)))] : [];
  for (const k of Object.keys(b.equip)) {
    const id = d.equip && d.equip[k];
    if (b.owned.includes(id) && UNLOCKS.find(u => u.id === id).kind === k) b.equip[k] = id;
  }
  b.useUnit = d.useUnit !== false; b.useRealm = d.useRealm !== false;
  if (d.lordPick && typeof d.lordPick === 'object') for (const army of Object.keys(LORDS_ALT)) if (d.lordPick[army] === 'alt' && b.owned.includes(`lord-${army}`)) b.lordPick[army] = 'alt';
  b.achSeen = Number.isFinite(d.achSeen) ? d.achSeen : null; b.pastDeeds = !!d.pastDeeds;
  b.season = num(d.season, 1) || 1; b.seasonStart = num(d.seasonStart, Date.now());
  const maps = typeof GRAND_MAPS === 'object' ? GRAND_MAPS : {};
  if (d.regions && typeof d.regions === 'object') for (const [m, r] of Object.entries(d.regions)) {
    if (maps[m] && r && ARMIES[r.army]) b.regions[m] = { army: r.army, diff: String(r.diff || ''), at: num(r.at, 0) };
  }
  if (Array.isArray(d.hall)) b.hall = d.hall.filter(h => h && typeof h === 'object').slice(0, 50).map(h => ({
    season: num(h.season, 0), from: num(h.from, 0), to: num(h.to, 0), earned: num(h.earned, 0),
    regions: Array.isArray(h.regions) ? h.regions.filter(r => r && maps[r.map] && ARMIES[r.army]).map(r => ({ map: r.map, army: r.army })) : [],
  }));
  if (Array.isArray(d.log)) b.log = d.log.filter(e => e && Number.isFinite(e.n) && typeof e.why === 'string').slice(0, 12).map(e => ({ t: num(e.t, 0), n: Math.floor(e.n), why: e.why.slice(0, 80) }));
  return b;
}
let career = cleanProgress(store.get(PROGRESS_KEY, null));
const saveProgress = () => store.set(PROGRESS_KEY, career);

const unlockById = id => UNLOCKS.find(u => u.id === id) || null;
// The unlock of a kind in use, or null.
const equipped = kind => { const id = career.equip[kind]; return id && career.owned.includes(id) ? unlockById(id) : null; };

function addRenown(n, why) {
  n = Math.floor(n);
  if (!(n > 0)) return 0;
  career.renown += n; career.earned += n; career.seasonEarned += n;
  career.log.unshift({ t: Date.now(), n, why });
  career.log.length = Math.min(career.log.length, 12);
  return n;
}
// Spend renown on an unlock (and put it to use at once). False if it is owned, unknown or too dear.
function buyUnlock(id) {
  const u = unlockById(id);
  if (!u || career.owned.includes(id) || career.renown < u.price) return false;
  career.renown -= u.price;
  career.owned.push(id);
  if (u.kind === 'lord') career.lordPick[u.army] = 'alt';   // a new lord takes the army's seat at once
  else career.equip[u.kind] = id;
  saveProgress();
  emit('progress', { kind: 'bought', unlock: u });
  return true;
}
// Use an owned unlock, or pass a kind and null to go back to the army's own look (or no starting unit).
function equipUnlock(kind, id) {
  if (id !== null && (!career.owned.includes(id) || unlockById(id).kind !== kind)) return false;
  career.equip[kind] = id;
  saveProgress();
  return true;
}

// Achievements already unlocked when progression arrives, and the records behind them, are paid out once,
// so a veteran starts with something to spend.
function payPastDeeds() {
  if (career.pastDeeds || typeof ach !== 'object') return 0;
  const r = ach.rec, n = Object.keys(ach.unlocked).length;
  career.pastDeeds = true;
  career.achSeen = n;
  const got = addRenown(n * RENOWN.achievement + (r.wins || 0) * 8 + (r.grandWon || 0) * 60 + (r.hillWon || 0) * 10 + (r.defenseBestWave || 0) * 2, 'Past deeds');
  saveProgress();
  return got;
}
payPastDeeds();

// ---------- alternate lords (#71) ----------
const ownsLord = army => career.owned.includes(`lord-${army}`);
function setLordPick(army, alt) {
  if (alt && !ownsLord(army)) return false;
  if (alt) career.lordPick[army] = 'alt'; else delete career.lordPick[army];
  saveProgress();
  return true;
}
// Which seats an alternate lord takes in a new game (cfg.lordAlt, read by newGame in sim.js): the player's own
// pick, and each rival with an alternate the player owns half the time. Never in the menu's demo, the
// tutorial, a story chapter (written for the base lords) or a second player's seat.
function pickLordAlts(cfg) {
  if (cfg.demo || cfg.tutorial || cfg.campaign) return undefined;
  const people = cfg.humans || 1;
  return cfg.armies.map((army, i) => !!LORDS_ALT[army] && ownsLord(army)
    && (i === 0 ? career.lordPick[army] === 'alt' : i >= people && Math.random() < 0.5));
}

// ---------- earning ----------
// What the last game paid, for the end screen: { total, lines: [[why, n], ...] }.
let lastRenown = null;
const playerGame = () => G && !G.cfg.demo && !G.cfg.tutorial && (G.cfg.humans || 1) === 1;

// Registered after achievements.js's own 'end' listener, so records and achievements are already counted.
on('end', ({ win }) => {
  lastRenown = null;
  if (!playerGame()) return;
  const diff = G.cfg.diff in RENOWN.battleWin ? G.cfg.diff : 'medium', lines = [];
  const pay = (n, why) => { const got = addRenown(n, why); if (got) lines.push([why, got]); };
  if (G.mode === 'grand') {
    if (win) {
      pay(RENOWN.grandWin[diff], 'Grand Campaign won');
      const map = G.cfg.grandMap || 'realm', had = career.regions[map];
      career.regions[map] = { army: G.fac[1], diff, at: Date.now() };
      if (!had) lines.push([`${(GRAND_MAPS[map] || GRAND_MAPS.realm).name} claimed for the realm map`, 0]);
    } else pay(RENOWN.grandLoss + Math.min(30, Math.floor((G.wave || 0) / 10)), 'Grand Campaign fought');
  } else if (G.mode === 'hill') {
    pay(win ? RENOWN.hillWin[diff] : RENOWN.hillLoss, win ? 'King of the Hill won' : 'King of the Hill raced');
  } else if (G.mode === 'defense') {
    pay(RENOWN.defenseWave * ((G.def && G.def.held) || 0), `Siege Defense: ${(G.def && G.def.held) || 0} waves held`);
  } else {
    pay(win ? RENOWN.battleWin[diff] : RENOWN.battleLoss, win ? 'Battle won' : 'Battle fought');
    if (win && G.cfg.campaign) pay(RENOWN.chapter, 'Story chapter won');
  }
  if (typeof ach === 'object') {
    const n = Object.keys(ach.unlocked).length, fresh = Math.max(0, n - (career.achSeen ?? n));
    career.achSeen = n;
    if (fresh) pay(fresh * RENOWN.achievement, fresh === 1 ? 'Achievement unlocked' : `${fresh} achievements unlocked`);
  }
  saveProgress();
  lastRenown = { total: lines.reduce((a, l) => a + l[1], 0), lines };
});
// The killing blow on a map monster pays on the spot.
on('monster', e => {
  if (e.kind !== 'slain' || e.o !== 1 || !playerGame()) return;
  addRenown(RENOWN.slain, `Slew ${e.monster.short || e.monster.name}`);
  saveProgress();
});

// ---------- the realm map and its seasons ----------
const realmBonus = () => Math.min(REALM_BONUS.max, Object.keys(career.regions).length * REALM_BONUS.perRegion);
// Close the season: its claimed regions go to the hall of fame and the map starts empty.
function newSeason() {
  if (Object.keys(career.regions).length) career.hall.unshift({
    season: career.season, from: career.seasonStart, to: Date.now(), earned: career.seasonEarned,
    regions: Object.entries(career.regions).map(([map, r]) => ({ map, army: r.army })),
  });
  career.hall.length = Math.min(career.hall.length, 50);
  career.season++; career.seasonStart = Date.now(); career.seasonEarned = 0; career.regions = {};
  saveProgress();
}

// ---------- applying the gameplay unlocks ----------
// A resumed game runs newGame first and then restores its saved state over it, so these never apply twice.
on('newGame', g => {
  if (g.cfg.demo || g.cfg.tutorial || (g.cfg.humans || 1) > 1) return;
  const home = g.planets.find(p => p.owner === 1);
  if (!home) return;
  // Grand Campaign: a few troops at home for each region claimed this season.
  if (g.cfg.mode === 'grand') {
    const bonus = career.useRealm ? realmBonus() : 0;
    if (bonus) { home.units += bonus; g.realmBonus = bonus; }
    return;
  }
  // Skirmishes only (not story chapters or the other modes): the starting map unit, which uses up the
  // battle's one map unit. It stands on the first clear spot found walking out from home towards the centre.
  const U = career.useUnit && !g.cfg.mode && !g.cfg.campaign ? equipped('unit') : null;
  if (!U || g.bought.has(1)) return;
  const base = Math.atan2(g.h / 2 - home.y, g.w / 2 - home.x);
  for (const d of [home.r + 46, home.r + 70, home.r + 100]) for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
    const x = home.x + Math.cos(base + da) * d, y = home.y + Math.sin(base + da) * d;
    if (placeProblem(1, x, y)) continue;
    placeUnit(1, U.unit, x, y);
    g.bought.add(1);
    g.startUnit = U.unit;
    return;
  }
});
