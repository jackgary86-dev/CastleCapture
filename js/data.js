// data.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Constants, the five armies and their lords, homeland themes, campaign levels, and small utilities. No DOM access: the headless balance runner loads this file.

const SPEED = 80;             // base marching speed, world units per second
const PROD = 0.055;           // troops per second per unit of castle size
const FIRST_CHARGE = 45;      // seconds before a special power is first ready
const RECHARGE = 300;         // seconds a special power takes to recharge after use
const COIN_PER_MIN = [0, 1, 2, 3]; // coins per minute from a small, medium and large castle
const RALLY_EVERY = 2;        // seconds between rally-point sends
const RALLY_KEEP = 5;         // troops a rallying castle keeps at home
// Castle upgrades: Walls (defence and archers) and Barracks (training and soldier strength), three levels each.
const UPGRADE = {
  max: 3,
  cost: [15, 25, 40],          // troops for level 1, 2, 3 at a medium castle (0.8x small, 1.2x large)
  wallDef: 0.15,               // defenders count +15% per Walls level
  barracksTrain: 0.08,         // +8% training per Barracks level
  barracksStr: 0.12,           // +12% soldier strength per Barracks level
  // Archers, by Walls level 0-3: reach beyond the walls, seconds between volleys, troops each volley takes down.
  archer: { reach: [32, 46, 62, 80], every: [1.1, 0.9, 0.7, 0.55], kill: [0.6, 1, 1.4, 1.9] },
};
const ROMAN = ['0', 'I', 'II', 'III'];
// Special castle kinds, given to about a quarter of the unclaimed keeps. A captured castle keeps its kind.
// def multiplies wall strength, prod multiplies training; a village trains nothing but speeds up its owner's castles nearby.
// worth is how much more (or less) an AI wants the castle than its size alone suggests.
const CASTLE_KINDS = {
  fortress: { name: 'Fortress', def: 2, prod: 1, worth: 0.85, desc: 'Every defender counts double.' },
  camp: { name: 'War camp', def: 0.7, prod: 1.6, worth: 1.5, desc: 'Trains 60% faster, but its walls are weak: defenders count 0.7.' },
  village: { name: 'Village', def: 1, prod: 0, worth: 1.3, aura: 150, auraBoost: 0.25, desc: 'Trains no troops, but your castles within reach train 25% faster.' },
};
const KIND_SHARE = 0.25;
// Garrison cap by castle size (index = tier: 1 small, 2 medium, 3 large), plus WALL_CAP per Walls level.
// A castle at its cap stops training; troops marching in can still push it over.
const GARRISON_CAP = [0, 60, 90, 120];
const WALL_CAP = 15;
const DESERT_RATE = 0.05;     // troops above the cap desert at this fraction of the excess per second
// Weather that drifts across a homeland during a battle (THEMES[...].weather lists which kinds).
// speed: marching speed; prod: training; sight: fog-of-war sight. The army whose homeland it is
// (native) is used to it and ignores the effects.
const WEATHER = {
  clear: { name: 'Clear skies', speed: 1, prod: 1, sight: 1 },
  rain:  { name: 'Rain', desc: 'The roads turn to mud: troops march 10% slower.', speed: 0.9, prod: 1, sight: 0.85, native: 'aldmere' },
  dust:  { name: 'Dust storm', desc: 'Troops march 15% slower and see less.', speed: 0.85, prod: 1, sight: 0.65, native: 'kharzul' },
  snow:  { name: 'Snowfall', desc: 'Troops march 15% slower.', speed: 0.85, prod: 1, sight: 0.85, native: 'frostmark' },
  heat:  { name: 'Scorching heat', desc: 'Castles train 15% slower.', speed: 1, prod: 0.85, sight: 1, native: 'solmara' },
  mist:  { name: 'Marsh fog', desc: 'Troops see half as far and march 5% slower.', speed: 0.95, prod: 1, sight: 0.5, native: 'nyx' },
};
const WEATHER_FIRST = 30;          // seconds of clear skies at the start of a battle
const WEATHER_SPELL = [40, 70];    // each spell of weather, or of clear skies, lasts this long
const WEATHER_FADE = 4;            // seconds for weather to set in or clear
const DAY_LENGTH = 240;            // one full day and night, in seconds
const NIGHT_PROD = 0.9;            // training at the darkest hour of the night
const UPKEEP_AT = 2;          // training halves above this many troops per unit of castle size, and halves again at twice that
// Grand Campaign (#46): a wave-based mode with all five armies on one large map.
const GRAND = {
  castles: 71,                 // 5 starting castles, a central keep, and 13 neutral keeps per realm
  radius: 1000,                // realm radius in world units (the regular battle map is 1000 x 640)
  start: 40,                   // starting troops
  waveSeconds: 20,             // length of each march window, in game seconds
  planSecondsEstimate: 10,     // typical time a player spends planning a wave, for length estimates
  actionsPerWave: { easy: 1, medium: 2, hard: 3 },  // decisions each AI lord makes per wave
  siegeSources: { easy: 3, medium: 5, hard: 8 },    // castles an AI lord may combine into one attack
  surrenderShare: 0.2,         // a rival realm surrenders below this fraction of the strongest realm's troops
  surrenderFromWave: 20,       // ...but never before this wave
  finishBias: 1.5,             // how much more a lord wants castles of a rival at under half its strength
  waveCap: 400,                // headless runs stop here
};
// Grand Campaign maps. #50 adds more, each with its own monster from MONSTERS (#48).
const GRAND_MAPS = {
  realm: { name: 'The Five Realms', theme: 'vale', monster: null },
};
const MONSTERS = {};
const PLACE_REACH = 170;      // a map unit must be placed within this distance of one of your castles
const MAP_UNITS = {
  ballista: {
    name: 'Ballista Tower', kind: 'Defensive', price: 40, range: 120,
    desc: 'Fires bolts at enemy soldiers marching within range, killing about three troops a second.',
  },
  trebuchet: {
    name: 'Siege Trebuchet', kind: 'Offensive', price: 65, range: 180,
    desc: 'Every 5 seconds, hurls a boulder at the enemy castle in range with the biggest garrison, knocking out 15% of its defenders.',
  },
  ward: {
    name: 'Great Ward', kind: 'Support', price: 90, range: 150,
    desc: 'Your castles inside train twice as fast and their defenders count 1.5×. Enemy troops passing through march at half speed.',
  },
};
// The unit each lord saves up for.
const AI_UNIT = { aldmere: 'ward', kharzul: 'trebuchet', frostmark: 'ballista', solmara: 'ward', nyx: 'trebuchet' };
const NEUTRAL = '#8c8676', INK = '#2a2014', PARCH = '#dccba2', TIMBER = '#17140e', WARN = '#e0362f';
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- the five armies ----------
const EMBLEM = {
  crown: '<path fill="currentColor" d="M3 19h18l-1.6-11-4.6 4.2L12 5 9.2 12.2 4.6 8z"/><rect fill="currentColor" x="3" y="20" width="18" height="2"/>',
  moon: '<path fill="currentColor" d="M14.5 2.5a9.5 9.5 0 1 0 7 15.8A8 8 0 0 1 14.5 2.5z"/><path fill="none" stroke="currentColor" stroke-width="1.6" d="M17 6l4-4M19 9l3-1"/>',
  snow: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5M3 10.5l3.6-.9-.9-3.6M21 13.5l-3.6.9.9 3.6M3 13.5l3.6.9-.9 3.6M21 10.5l-3.6-.9.9-3.6"/></g>',
  sun: '<circle fill="currentColor" cx="12" cy="12" r="4.6"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
  eye: '<path fill="none" stroke="currentColor" stroke-width="2" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle fill="currentColor" cx="12" cy="12" r="3.4"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 1v2.5M5 3l1.4 2M19 3l-1.4 2"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${EMBLEM[name]}</svg>`;

const ARMIES = {
  aldmere: {
    name: 'Aldmere', full: 'The Azure Crown of Aldmere', emblem: 'crown',
    color: '#4f8ff0', roof: '#2f5ea8', ink: '#08142a', plaqueText: '#fff8e6',
    role: 'Defense', homeland: 'The Vale of Aldmere', map: 'vale',
    castle: 'stone', flag: 'swallow', soldier: 'spear',
    story: "Aldmere's kings have held the green river vale for nine hundred years without losing a keep for long. Its masons' guild is older than the crown, and every child there learns that a wall built well is worth a hundred spears.",
    strength: 'Masterwork walls. Every defender in an Aldmere castle counts as 1.45 soldiers.',
    stats: { atk: 1, def: 1.45, speed: 1, prod: 1, road: 1, neutral: 1 },
    power: { id: 'stoneOath', name: 'Stone Oath', dur: 20, desc: 'For 20 seconds, every defender in your castles counts double.', call: 'swear the Stone Oath', they: 'swears the Stone Oath' },
    personality: 'Defensive. Holds the frontier, reinforces early, and marches only when it badly outnumbers you.',
    ai: { sendFrac: 0.45, keep: 10, enemyBias: 0.9, neutralBias: 1, margin: 1.35, defendAt: 0.8, thinkMul: 1.1, front: true, opportunist: 1.2, boldAt: 1.6 },
  },
  kharzul: {
    name: 'Kharzul', full: 'The Kharzul Horde', emblem: 'moon',
    color: '#d9443e', roof: '#a8322d', ink: '#2a0806', plaqueText: '#fff8e6',
    role: 'Attack', homeland: 'The Red Steppe', map: 'steppe',
    castle: 'palisade', flag: 'tassel', soldier: 'rider',
    story: 'Born in the saddle on the endless red grass, the clans of Kharzul build no stone. They raise palisades where they halt and burn them when they ride on. Their shamans read every war in the colour of the moon.',
    strength: 'Horse lords. Riders move 30% faster and strike 1.12× harder, but they fight at 0.9 in crowded battles on the road, wooden palisades defend at only 0.9, and horses struggle through forests.',
    stats: { forest: 0.45, atk: 1.12, def: 0.9, speed: 1.3, prod: 1, road: 0.9, neutral: 1 },
    power: { id: 'bloodMoon', name: 'Blood Moon Charge', dur: 15, desc: 'For 15 seconds, your riders move twice as fast and hit 1.5× harder.', call: 'charge under the Blood Moon', they: 'charges under the Blood Moon' },
    personality: 'Very aggressive. Attacks constantly with most of its army and rarely stops to defend.',
    ai: { sendFrac: 0.75, keep: 4, enemyBias: 2.2, neutralBias: 0.9, margin: 1.0, defendAt: 1.4, thinkMul: 0.7, front: false, opportunist: 1.3, boldAt: 0.9 },
  },
  frostmark: {
    name: 'Frostmark', full: 'The Jarls of Frostmark', emblem: 'snow',
    color: '#36c2b4', roof: '#1f7f75', ink: '#04201d', plaqueText: '#04201d',
    role: 'Defense', homeland: 'The Frostmark Fjords', map: 'tundra',
    castle: 'longhouse', flag: 'square', soldier: 'shield',
    story: 'In the frozen north the jarls winter behind stone and pine, waiting out storms that would kill any army caught in the open. They are slow to march and almost impossible to dislodge, and their shieldwalls do not break.',
    strength: 'Shieldwall. Frostmark troops count 1.45× in battles on the road, and castles defend at 1.4. They march 5% slower, but forests barely slow them.',
    stats: { forest: 0.85, atk: 1, def: 1.4, speed: 0.95, prod: 1, road: 1.45, neutral: 1 },
    power: { id: 'wintersGrip', name: "Winter's Grip", dur: 12, desc: 'A blizzard sweeps the map. For 12 seconds, every enemy soldier in the field freezes in place.', call: "call down Winter's Grip", they: "calls down Winter's Grip" },
    personality: 'Very defensive. Builds up behind its walls, punishes weak attacks, and strikes only at castles left nearly empty.',
    ai: { sendFrac: 0.45, keep: 10, enemyBias: 0.6, neutralBias: 1, margin: 1.35, defendAt: 0.6, thinkMul: 1.25, front: true, opportunist: 2.4, boldAt: 1.5 },
  },
  solmara: {
    name: 'Solmara', full: 'The Sun Dominion of Solmara', emblem: 'sun',
    color: '#e9b43b', roof: '#c08a1c', ink: '#2a1c02', plaqueText: '#2a1c02',
    role: 'Balanced', homeland: 'The Sunscorched Sands', map: 'desert',
    castle: 'domes', flag: 'pennant', soldier: 'turban',
    story: "Solmara's wealth flows from the oases and caravan roads of the great desert. Its sultans pay their soldiers in gold, and gold raises soldiers faster than any blade can cut them down.",
    strength: 'Rich treasury. Soldiers fight at 0.9, but the Golden Tithe can double the training of every castle at once.',
    stats: { atk: 0.9, def: 0.95, speed: 1, prod: 1, road: 1, neutral: 1 },
    power: { id: 'goldenTithe', name: 'Golden Tithe', dur: 15, desc: 'Open the treasury. For 15 seconds, your castles train troops twice as fast.', call: 'open the Golden Tithe', they: 'opens the Golden Tithe' },
    personality: 'Balanced. Expands steadily, defends what it holds, and attacks when the odds are good.',
    ai: { sendFrac: 0.5, keep: 8, enemyBias: 1.3, neutralBias: 1.1, margin: 1.15, defendAt: 0.9, thinkMul: 1, front: false, opportunist: 1.4, boldAt: 1.3 },
  },
  nyx: {
    name: 'Nyxhollow', full: 'The Nyxhollow Covenant', emblem: 'eye',
    color: '#a46ae0', roof: '#5b3a85', ink: '#170828', plaqueText: '#fff8e6',
    role: 'Attack', homeland: 'Nyxhollow Mire', map: 'mire',
    castle: 'spires', flag: 'streamer', soldier: 'hood',
    story: 'Out of the drowned marshes comes the Covenant, a court of witches and hooded zealots. Unclaimed keeps open their gates to Nyxhollow whispers, and the crows of the mire carry plague wherever they are sent.',
    strength: 'Whispers. Attacks on unclaimed keeps count 1.35×, and Covenant troops strike 1.12× harder.',
    stats: { atk: 1.12, def: 1, speed: 1, prod: 1, road: 1, neutral: 1.35 },
    power: { id: 'crows', name: 'Plague of Crows', dur: 3, desc: 'Crows descend on the three largest enemy castles. Each loses 40% of its garrison at once.', call: 'loose the Plague of Crows', they: 'looses the Plague of Crows' },
    personality: 'Aggressive and cunning. Snaps up unclaimed keeps quickly and pounces on any castle you leave weak.',
    ai: { sendFrac: 0.6, keep: 6, enemyBias: 1.8, neutralBias: 1.4, margin: 1.05, defendAt: 1.0, thinkMul: 0.85, front: false, opportunist: 2.2, boldAt: 1.1 },
  },
  // Not a kingdom: the raiding column of the bandit map event (#35). It owns no castles, no
  // lord commands it and it never appears in the army pickers (see ARMY_IDS).
  bandits: {
    pseudo: true,
    name: 'Bandits', full: 'The Greyhand Bandits', emblem: 'eye',
    color: '#8d8a80', roof: '#5a5750', ink: '#1a1917', plaqueText: '#fff8e6',
    role: 'Raiders', homeland: 'The wild roads', map: 'vale',
    castle: 'stone', flag: 'swallow', soldier: 'hood',
    story: 'Deserters and outlaws who follow the war for its leavings.',
    strength: 'Raiders. They fight like ordinary soldiers and hold nothing they take.',
    stats: { atk: 1, def: 1, speed: 1.1, prod: 0, road: 1, neutral: 1, forest: 0.9 },
    power: { id: 'none', name: 'None', dur: 0, desc: '', call: '', they: '' },
    personality: '',
    ai: { sendFrac: 0, keep: 0, enemyBias: 1, neutralBias: 1, margin: 1, defendAt: 1, thinkMul: 1, front: false, opportunist: 1, boldAt: 1 },
  },
};
// The five playable kingdoms, in picker order. Pseudo-armies (the bandits) are left out.
const ARMY_IDS = Object.keys(ARMIES).filter(id => !ARMIES[id].pseudo);

// ---------- the lords who command each army as a rival ----------
const LORDS = {
  bandits: {
    name: 'The Greyhand', short: 'Greyhand', title: 'bandit captain',
    bio: 'No one knows a face; the hood passes to whoever is left.',
    challenge: 'Your roads are ours tonight.',
    lines: { capture: ['Take what you can carry and burn the rest.'], lose: ['Scatter! Back to the woods!'] },
  },
  aldmere: {
    name: 'Queen Isolde Varr', short: 'Isolde', title: 'the Mason Queen',
    bio: 'Patient and formal, she believes every war is won by the side whose walls stand longest.',
    challenge: 'Aldmere has stood nine hundred years. It will stand tonight.',
    lines: {
      capture: ['Another stone for my walls.', 'You built that badly. I will build it better.'],
      lose: ['A setback. Walls can be rebuilt.', 'Enjoy it while it lasts.'],
      power: ['By the Oath of Stone!'],
      nearDefeat: ['Even good walls fall. Remember that I built them.'],
      victory: ['Patience wins every siege. You had none.'],
      defeat: ['The vale is yours. Keep its walls in good repair.'],
      surrender: ['I yield. Keep the walls standing; they deserve better than this war.'],
    },
  },
  kharzul: {
    name: 'Khagan Torvek Ash-Mane', short: 'Torvek', title: 'the Red Wind',
    bio: 'Warlord of the clans. He has never built a wall and never retreated.',
    challenge: "Your walls are just firewood I haven't burned yet.",
    lines: {
      capture: ['Burn it. We ride on.', 'Ha! Next!'],
      lose: ["Keep it. I'll take two of yours.", 'A pile of sticks. I have more.'],
      power: ['The moon is red! RIDE!'],
      nearDefeat: ['A horse lord dies in the saddle, not on his knees!'],
      victory: ['The steppe wind blows over your ashes.'],
      defeat: ['You ride well, for a wall-builder.'],
      surrender: ['Bah! We ride for the steppe. This is not over.'],
    },
  },
  frostmark: {
    name: 'Jarl Sigrun Ironfrost', short: 'Sigrun', title: 'the White Wall',
    bio: 'Eldest jarl of the fjords. Silent for long stretches, then sudden and brutal.',
    challenge: 'Come north, then.',
    lines: {
      capture: ['You left it open to the cold.'],
      lose: ['Hm.'],
      power: ['Winter takes them.'],
      counter: ['Now.'],
      nearDefeat: ['The ice breaks in spring. It always returns.'],
      victory: ['The north keeps its own.'],
      defeat: ['Spring comes early this year.'],
      surrender: ['We go north. Enough.'],
    },
  },
  solmara: {
    name: 'Sultan Amaru al-Zahir', short: 'Amaru', title: 'the Golden Hand',
    bio: 'The richest ruler in the realm, who treats every war as a trade negotiation.',
    challenge: 'Every castle has a price. Yours is cheap.',
    lines: {
      capture: ['Bought and paid for.', 'A bargain.'],
      lose: ['A small expense.', 'Put it on my account.'],
      power: ['Open the treasury!'],
      nearDefeat: ['Surely we can come to an arrangement?'],
      victory: ['The sands are mine. Send me the bill.'],
      defeat: ['Well played. Name your price.'],
      surrender: ['Let us call it a business loss. I withdraw.'],
    },
  },
  nyx: {
    name: 'The Hollow Matron Veyra', short: 'Veyra', title: 'Mother of Crows',
    bio: 'High witch of the Covenant, who speaks in whispers and seems to know your next move.',
    challenge: 'The crows told me you would come.',
    lines: {
      capture: ['Empty halls echo so sweetly.', 'I saw that coming. Did you?'],
      lose: ['Take it. The mire will take it back.'],
      power: ['Fly, my darlings. Feast.'],
      nearDefeat: ['The mire keeps what it drowns. I will return.'],
      victory: ['Sleep now. The crows will keep watch.'],
      defeat: ['The crows did not see this. How interesting.'],
      surrender: ['The Covenant withdraws into the mire. For now.'],
    },
  },
};

// Painted busts, 64×64.
function portrait(id) {
  const A = ARMIES[id];
  const bust = (skin, extra) => `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" fill="${A.roof}"/><circle cx="32" cy="26" r="30" fill="${A.color}" opacity="0.25"/>
    ${extra.back || ''}
    <path d="M8 64c2-14 12-20 24-20s22 6 24 20z" fill="${A.color}"/>
    <rect x="27" y="36" width="10" height="9" fill="${skin}"/>
    <ellipse cx="32" cy="28" rx="11" ry="13" fill="${skin}"/>
    ${extra.front || ''}</svg>`;
  switch (id) {
    case 'aldmere': return bust('#f0d2b4', {
      back: '<path d="M17 30c0-14 7-20 15-20s15 6 15 20v20H17z" fill="#f4efe4"/>',
      front: '<path d="M21 22c2-8 7-11 11-11s9 3 11 11c-3-3-7-4-11-4s-8 1-11 4z" fill="#6b4a30"/><path d="M21 17l3-8 4 5 4-7 4 7 4-5 3 8z" fill="#e9b43b" stroke="#8a6512" stroke-width="0.8"/><circle cx="32" cy="12" r="1.6" fill="#4f8ff0"/><ellipse cx="28" cy="29" rx="1.3" ry="1" fill="#2a2014"/><ellipse cx="36" cy="29" rx="1.3" ry="1" fill="#2a2014"/><path d="M29 36q3 1.5 6 0" stroke="#9a5a4a" stroke-width="1.2" fill="none"/><path d="M14 50l18 6 18-6" stroke="#e9b43b" stroke-width="2" fill="none"/>',
    });
    case 'kharzul': return bust('#c8936a', {
      back: '<path d="M32 2c4 2 5 6 3 10" stroke="#1a1410" stroke-width="4" fill="none" stroke-linecap="round"/>',
      front: '<path d="M19 22c0-9 6-12 13-12s13 3 13 12c-4-2-8-3-13-3s-9 1-13 3z" fill="#4a3220"/><rect x="19" y="18" width="26" height="4" fill="#d9443e"/><path d="M22 34c2 10 6 13 10 13s8-3 10-13c-3 3-6 4-10 4s-7-1-10-4z" fill="#1a1410"/><path d="M27 29l3-1M34 28l3 1" stroke="#1a1410" stroke-width="1.6"/><path d="M38 22l3 12" stroke="#8a4a3a" stroke-width="1.2"/><path d="M10 52l12-6M54 52l-12-6" stroke="#6b4a2f" stroke-width="4"/>',
    });
    case 'frostmark': return bust('#f2dccb', {
      back: '<rect x="18" y="26" width="6" height="26" rx="3" fill="#e8ecef"/><rect x="40" y="26" width="6" height="26" rx="3" fill="#e8ecef"/><path d="M18 34h6M18 40h6M18 46h6M40 34h6M40 40h6M40 46h6" stroke="#b9c3cb" stroke-width="1"/>',
      front: '<path d="M20 24c1-9 6-13 12-13s11 4 12 13c-3-4-7-5-12-5s-9 1-12 5z" fill="#e8ecef"/><rect x="20" y="18" width="24" height="3" fill="#9aa3ab"/><circle cx="32" cy="19.5" r="2" fill="#36c2b4"/><path d="M27 29h3M34 29h3" stroke="#2a2014" stroke-width="1.4"/><path d="M29 36h6" stroke="#9a6a5a" stroke-width="1.2"/><path d="M10 54c6-8 14-10 22-10s16 2 22 10" stroke="#f4f8fb" stroke-width="5" fill="none"/>',
    });
    case 'solmara': return bust('#a8744e', {
      front: '<path d="M18 22c0-10 6-14 14-14s14 4 14 14c0 2-1 3-2 3H20c-1 0-2-1-2-3z" fill="#f3ead6"/><path d="M19 18q13-6 26 0" stroke="#d9cfb8" stroke-width="1.4" fill="none"/><circle cx="32" cy="17" r="2.6" fill="#e9b43b" stroke="#8a6512" stroke-width="0.8"/><path d="M23 33c1 9 5 12 9 12s8-3 9-12c-3 2-6 3-9 3s-6-1-9-3z" fill="#1a1410"/><ellipse cx="28" cy="29" rx="1.3" ry="1" fill="#1a1410"/><ellipse cx="36" cy="29" rx="1.3" ry="1" fill="#1a1410"/><path d="M14 50q18 8 36 0" stroke="#e9b43b" stroke-width="3" fill="none"/>',
    });
    default: return bust('#d8cfe0', {
      back: '<path d="M12 64c0-30 6-54 20-58 14 4 20 28 20 58z" fill="#241a33"/>',
      front: '<path d="M18 40c0-18 5-30 14-32 9 2 14 14 14 32-3-8-7-14-14-14s-11 6-14 14z" fill="#2e2242"/><ellipse cx="28" cy="31" rx="1.8" ry="1.2" fill="#c9a2ff"/><ellipse cx="36" cy="31" rx="1.8" ry="1.2" fill="#c9a2ff"/><path d="M30 38q2 1 4 0" stroke="#6a5a7a" stroke-width="1" fill="none"/><path d="M44 12l6-6M45 15l7-3" stroke="#0e0a14" stroke-width="2" stroke-linecap="round"/>',
    });
  }
}
const portraitHtml = id => `<span class="portrait" style="--c:${ARMIES[id].color}">${portrait(id)}</span>`;

// Homeland maps: ground, roads, scenery and the style of unclaimed keeps.
const THEMES = {
  vale:   { bg: '#263220', field: '#33432a', lit: '#3d5031', road: '#8d7a55', ring: PARCH, tree: 'oak',   trees: 90, clump: 0.7, rocks: 0,  pools: 3, pool: '#3f6a7a', castle: 'stone', weather: ['rain'], river: true, forest: true, water: '#3f6a7a', bank: '#6d6a44', wood: '#283a1f', dust: '#b9a27a' },
  steppe: { bg: '#4a3a20', field: '#6c5a32', lit: '#7b683c', road: '#a88d5a', ring: PARCH, tree: 'shrub', trees: 45, clump: 0.4, rocks: 28, pools: 0, pool: '#5c7480', castle: 'palisade', weather: ['dust'], river: true, forest: false, water: '#4c6c78', bank: '#8f7a4c', wood: '#5a4a28', dust: '#c9a46a' },
  tundra: { bg: '#8a96a2', field: '#c3cdd6', lit: '#d8e0e7', road: '#8d98a3', ring: INK,   tree: 'pine',  trees: 85, clump: 0.75, rocks: 14, pools: 3, pool: '#9fbfd2', castle: 'longhouse', weather: ['snow'], river: true, forest: true, water: '#7ea6c0', bank: '#e9eff3', wood: '#aab7b4', dust: '#ffffff' },
  desert: { bg: '#9a7843', field: '#c8a462', lit: '#d6b574', road: '#a3824a', ring: INK,   tree: 'palm',  trees: 30, clump: 0,  rocks: 10, pools: 4, pool: '#3f8fa0', castle: 'domes', weather: ['heat', 'dust'], river: false, forest: false, water: '#3f8fa0', bank: '#b8955a', wood: '#b8955a', dust: '#efdcae' },
  mire:   { bg: '#16131c', field: '#28242f', lit: '#332d3d', road: '#5a4f68', ring: PARCH, tree: 'dead',  trees: 60, clump: 0.6, rocks: 0,  pools: 9, pool: '#1a1426', castle: 'spires', weather: ['mist', 'rain'], river: true, forest: true, water: '#120d1c', bank: '#463d55', wood: '#1f1a27', dust: '#8a7ea0' },
};

const LEVELS = [
  { seed: 11, n: 12, diff: 'easy',   ais: 1, name: 'Thornbury' },
  { seed: 23, n: 14, diff: 'easy',   ais: 1, name: 'Ashford' },
  { seed: 37, n: 16, diff: 'medium', ais: 1, name: 'Ravenmoor' },
  { seed: 41, n: 18, diff: 'medium', ais: 1, name: 'Coldwater' },
  { seed: 59, n: 18, diff: 'hard',   ais: 1, name: 'Greyhelm' },
  { seed: 61, n: 20, diff: 'hard',   ais: 1, name: 'Wolfden' },
  { seed: 73, n: 19, diff: 'hard',   ais: 2, name: 'Three Crowns' },
  { seed: 89, n: 22, diff: 'hard',   ais: 2, name: 'High Throne', aiBonus: 25 },
];
const DIFF_NAME = { easy: 'Squire', medium: 'Knight', hard: 'Warlord' };

// ---------- utilities ----------
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// A small event bus. The simulation emits what happened (a capture, a power, the end of a
// battle); the UI listens and turns it into sound, banners and lord lines. Headless runs
// simply have no listeners.
const listeners = {};
const on = (name, fn) => { (listeners[name] ??= []).push(fn); return fn; };
const emit = (name, data) => { for (const fn of listeners[name] || []) fn(data); };
