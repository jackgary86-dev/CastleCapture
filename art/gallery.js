// Art gallery: one painted panel for each army, each homeland map, each Grand Campaign map and
// each monster. Pure Canvas 2D and seeded, so art/gallery.html and tools/render-art.js --gallery
// produce the same pictures. Needs art/launch-bg.js loaded first (for the castle painters).

(function (root) {
  const L = root.launchArt;
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };

  // ---- palettes: sky (top, mid, horizon), far ridge, two hills, ground, and the feature painter ----
  const THEMES = {
    vale:      { name: 'The Vale of Aldmere',    sky: ['#1a2a4a', '#4a6a8a', '#d8b48a'], far: '#5a6a7a', hills: ['#3f5a3a', '#2f4a2c'], ground: '#243c20', feature: 'vale' },
    steppe:    { name: 'The Red Steppe',         sky: ['#3a1e1a', '#9a4a30', '#f0b070'], far: '#6a3a2a', hills: ['#8a5a30', '#6c4a26'], ground: '#4a3418', feature: 'steppe' },
    tundra:    { name: 'The Frostmark Fjords',   sky: ['#1a2436', '#5a7a9a', '#d0e0ea'], far: '#7a8a9a', hills: ['#b8c8d2', '#8a9eaa'], ground: '#dfe8ee', feature: 'tundra' },
    desert:    { name: 'The Sunscorched Sands',  sky: ['#2a1a3a', '#c06a40', '#ffd890'], far: '#8a6040', hills: ['#d4a862', '#b88a48'], ground: '#9a7838', feature: 'desert' },
    mire:      { name: 'Nyxhollow Mire',         sky: ['#0e0a18', '#2a2040', '#5a4a70'], far: '#2a2234', hills: ['#2c2838', '#1e1a28'], ground: '#161220', feature: 'mire' },
    scorched:  { name: 'The Scorched Reach',     sky: ['#0a0608', '#3a1410', '#c04a20'], far: '#2a1414', hills: ['#2e1c18', '#1e1210'], ground: '#140c0a', feature: 'scorched' },
    fells:     { name: "The Giant's Fells",      sky: ['#1a2230', '#4a5a6a', '#9ab0b8'], far: '#56646e', hills: ['#5a7a5a', '#44604a'], ground: '#36503a', feature: 'fells' },
    blackwood: { name: 'The Blackwood Marches',  sky: ['#0e1a14', '#1e3a2c', '#5a8a70'], far: '#1a3024', hills: ['#1e3a24', '#16301c'], ground: '#0e2014', feature: 'blackwood' },
  };
  const ARMIES = {
    aldmere:   { name: 'Aldmere',   full: 'The Azure Crown of Aldmere',  lord: 'Queen Isolde Varr, the Mason Queen',       role: 'Defense',  theme: 'vale',   castle: 'stone',     soldier: 'spear' },
    kharzul:   { name: 'Kharzul',   full: 'The Kharzul Horde',           lord: 'Khagan Torvek Ash-Mane, the Red Wind',    role: 'Attack',   theme: 'steppe', castle: 'palisade',  soldier: 'rider' },
    frostmark: { name: 'Frostmark', full: 'The Jarls of Frostmark',      lord: 'Jarl Sigrun Ironfrost, the White Wall',   role: 'Defense',  theme: 'tundra', castle: 'longhouse', soldier: 'shield' },
    solmara:   { name: 'Solmara',   full: 'The Sun Dominion of Solmara', lord: 'Sultan Amaru al-Zahir, the Golden Hand',  role: 'Balanced', theme: 'desert', castle: 'domes',     soldier: 'turban' },
    nyx:       { name: 'Nyxhollow', full: 'The Nyxhollow Covenant',      lord: 'The Hollow Matron Veyra, Mother of Crows', role: 'Attack',   theme: 'mire',   castle: 'spires',    soldier: 'hood' },
  };
  const MONSTERS = {
    wyrm: {
      name: 'The Wyrm of the Wastes', title: 'The Serpent Between the Keeps', sub: 'The Five Realms · wanders, ambushes columns · 600 health · 150 coins', theme: 'vale',
      map: 'The Five Realms', health: 600, bounty: 150, respawn: 10, strength: '3 troops for every 1 it fights',
      story: 'When the five kingdoms first marched against each other, the Wyrm came up out of the dry country to the east and found the roads between them full of soldiers. It has followed the armies ever since. It does not want castles and has never climbed a wall; it wants the columns strung out on the open road, and the more the realms make war, the fatter it grows. Every lord has sworn to kill it, and every lord has quietly let it eat a rival\'s army first.',
      abilities: [
        'Wanderer: roams the open country between the realms, skirting the castles rather than attacking them.',
        'Ambush: any column that passes within its reach is bitten, three troops for every one it fights.',
        'Turns to fight: troops sent at it are met head on once they come close, so it cannot simply be outrun.',
        'Regrowth: heals when a whole wave passes without anyone fighting it, so a wounded Wyrm has to be finished quickly.',
      ],
      tactics: 'Route columns around it rather than past it; a short detour costs less than a bitten army. When it is wounded, every lord comes for the bounty, so strike in the same wave with enough troops to land the last blow yourself, from castles close enough that it cannot heal before you arrive.',
      quote: 'It has no lair. It lives wherever the armies are.',
    },
    dragon: {
      name: 'The Red Dragon', title: 'Vaelthyr the Red', sub: 'The Scorched Reach · flies, breathes fire · 700 health · 180 coins', theme: 'scorched',
      map: 'The Scorched Reach', health: 700, bounty: 180, respawn: 10, strength: '3 troops for every 1 it fights',
      story: 'The Reach was green once. Then Vaelthyr came down from the north wind, burned the forests to ash and made the mountain at the centre his bed. For a hundred years the five kingdoms paid him tribute in cattle and gold; now the tribute has stopped, and he collects it himself. He sleeps on the hoard inside the Cinder Spire, and every few waves he wakes hungry and goes looking for whatever is marching below.',
      abilities: [
        'Flight: ignores roads, rivers and lava, and crosses the map in straight lines.',
        'Firebreath: when he lands, the nearest column or castle within reach loses a fifth of its troops in one blast.',
        'Hoard sleep: regenerates health while perched on the Cinder Spire.',
        'Old magic: cannot be frozen by Winter\'s Grip, slowed by a Great Ward, or touched by the Plague of Crows.',
      ],
      tactics: 'He only burns what is near where he lands, so keep columns moving between his flights and never park an army on the central keeps while he is awake. Strike from three castles at once so that the last blow is yours: whoever lands it takes the whole hoard. Frostmark shieldwalls take the fire best; Kharzul riders reach him first.',
      quote: 'The mountain is not on fire. The mountain is where the fire lives.',
    },
    cyclops: {
      name: 'The Cyclops', title: 'Old Grom of the Fells', sub: "The Giant's Fells · smashes castles · 900 health · 220 coins", theme: 'fells',
      map: "The Giant's Fells", health: 900, bounty: 220, respawn: 10, strength: '4 troops for every 1 it fights',
      story: 'The standing stones of the Fells were raised by giants, and Grom is the last of them. He is older than any kingdom and remembers none of them. He sleeps for years in the boulder fields and walks the old road when he wakes, looking for the stone circles his people built; a castle on a hill looks enough like one that he will try to put it right, and that is how castles are smashed. He does not hate anyone. He is simply very large.',
      abilities: [
        'Road-bound: slow and heavy, he follows the roads, so his route for the coming wave can be read from where he stands.',
        'Castle smash: a castle in his path loses 30% of its garrison and one level of its walls or barracks.',
        'Crushing blows: the hardest hitter of the three monsters, killing four troops for every one he fights.',
        'Deep sleeper: he sleeps where he stops; troops that attack a sleeping Grom deal half again as much damage that wave.',
      ],
      tactics: 'Watch the road a wave ahead and move the garrison out of any castle he is walking towards; walls do not stop him, they only give him something to break. Attack while he sleeps, and do it with everything at once: he has the most health of the three, and a half-finished fight just wakes him up. A cheap castle left in his way will turn him aside for a wave.',
      quote: 'He stepped on Hollin Keep on his way to somewhere else, and did not notice.',
    },
    bandits: {
      name: 'The Bandit Gang', title: 'The Blackwood Five', sub: 'The Blackwood Marches · five captains, raids and ambushes · 50 + 150 coins', theme: 'blackwood',
      map: 'The Blackwood Marches', health: '120 per captain, five captains', bounty: '50 per captain, 150 more for the last', respawn: 10, strength: '3 troops for every 1 they fight, but only in the trees',
      story: 'Every army leaves deserters, and the Blackwood takes them all. Five captains run the gang from a camp no lord has ever found: Redcap Morrow, who rode with Kharzul until he stole the Khagan\'s horse; Sister Ash, cast out of the Covenant for lying to the crows; Halvard Halfhand, who walked south out of the fjords one winter and never said why; Pell the Quiet, an Aldmere mason who builds the camp\'s traps; and Dunya Three-Rings, who kept the Sultan\'s accounts and now keeps the gang\'s. They do not want the realm. They want its coins, and they take them one castle at a time.',
      abilities: [
        'Five captains: each is a roaming column of about sixty bandits, moving separately with its own health.',
        'Ambush: they attack only troops inside the forest, where visibility is short and the trees are theirs.',
        'Raid: a captain who reaches a castle steals a quarter of its coins and a tenth of its garrison, then runs for the trees.',
        'The camp: captains return to a hidden clearing to heal; storm it with enough troops and every captain at home dies at once.',
        'Split bounty: fifty coins for each captain, and a hundred and fifty more for whoever kills the last.',
      ],
      tactics: 'Garrison the castles on the forest edge and spend your coins before the raiders arrive to take them. March through the woods in strength or not at all. The real prize is the camp: scout for it, wait until most captains are home, and storm it. Then hunt the last captain yourself, because the bonus goes to the final blow.',
      quote: 'Five banners went into the Blackwood. One gang came out, and it flies no banner at all.',
    },
  };
  const GRAND = {
    realm:     { sub: 'All five homelands around a green heart. Open roads between the keeps, and a serpent on them.' },
    scorched:  { sub: 'Volcanic badlands. Lava fissures cross at basalt bridges; the richest keeps ring the lair.' },
    fells:     { sub: 'High moorland of standing stones and fog. Hill forts, boulder fields, a slow road-bound giant.' },
    blackwood: { sub: 'Forest and river country. Ferry crossings, slow forest tracks, robber towers in the trees.' },
  };

  THEMES.realm = { ...THEMES.vale, name: 'The Five Realms' };

  const PANELS = [
    ...Object.keys(ARMIES).map(id => ({ kind: 'army', id })),   // this file's ARMIES: gallery.html has no data.js
    ...['vale', 'steppe', 'tundra', 'desert', 'mire'].map(id => ({ kind: 'map', id })),
    ...Object.keys(GRAND).map(id => ({ kind: 'grand', id })),
    ...Object.keys(MONSTERS).map(id => ({ kind: 'monster', id })),
  ];

  // ---- shared painters ----
  const poly = (ctx, pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const hill = (ctx, W, H, yBase, amp, freq, phase, col) => {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, yBase + Math.sin(x / W * freq + phase) * amp + Math.sin(x / W * freq * 2.7 + phase * 1.3) * amp * 0.35);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  const ridge = (ctx, W, H, yBase, amp, col, rnd, seedShift, n = 16) => {
    const pts = [[0, H]];
    for (let i = 0; i <= n; i++) pts.push([(i / n) * W, yBase - Math.abs(Math.sin(i * 1.7 + seedShift)) * amp - rnd() * amp * 0.5]);
    pts.push([W, H]); poly(ctx, pts, col);
  };
  function tree(ctx, x, y, s, kind, dark) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + 2, y + s * 0.25, s * 0.9, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 'pine') { poly(ctx, [[x - s * 0.55, y], [x + s * 0.55, y], [x, y - s * 1.7]], dark); poly(ctx, [[x - s * 0.4, y - s * 0.75], [x + s * 0.4, y - s * 0.75], [x, y - s * 2.0]], dark); ctx.fillStyle = '#eef3f6'; ctx.beginPath(); ctx.moveTo(x - s * 0.18, y - s * 1.55); ctx.lineTo(x + s * 0.18, y - s * 1.55); ctx.lineTo(x, y - s * 2.0); ctx.fill(); }
    else if (kind === 'palm') { ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.9, x + s * 0.1, y - s * 1.8); ctx.stroke(); ctx.strokeStyle = dark; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = Math.PI + i * Math.PI / 5; ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 1.8); ctx.quadraticCurveTo(x + s * 0.1 + Math.cos(a) * s * 0.7, y - s * 1.8 + Math.sin(a) * s * 0.5 - s * 0.2, x + s * 0.1 + Math.cos(a) * s * 1.1, y - s * 1.5 + Math.sin(a) * s * 0.4); ctx.stroke(); } ctx.lineCap = 'butt'; }
    else if (kind === 'dead') { ctx.strokeStyle = dark; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.4); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x - s * 0.6, y - s * 1.1); ctx.moveTo(x, y - s * 0.8); ctx.lineTo(x + s * 0.7, y - s * 1.4); ctx.moveTo(x - s * 0.6, y - s * 1.1); ctx.lineTo(x - s * 0.9, y - s * 1.6); ctx.stroke(); }
    else if (kind === 'shrub') { ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x - s * 0.35, y - s * 0.2, s * 0.45, 0, Math.PI * 2); ctx.arc(x + s * 0.3, y - s * 0.15, s * 0.4, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y - s * 0.9, s * 0.7, 0, Math.PI * 2); ctx.arc(x - s * 0.45, y - s * 0.55, s * 0.5, 0, Math.PI * 2); ctx.arc(x + s * 0.45, y - s * 0.6, s * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - s * 0.08, y - s * 0.6, s * 0.16, s * 0.6); }
  }
  function soldier(ctx, x, y, u, col, style, dir = 1) {
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.6 * u;
    if (style === 'rider') {
      ctx.fillStyle = '#6b4a2f'; ctx.beginPath(); ctx.ellipse(x, y - 6 * u, 13 * u, 7 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 13 * dir * u, y - 12 * u, 5 * u, 3.5 * u, -0.5 * dir, 0, Math.PI * 2); ctx.fill();
      for (const lx of [-8, -3, 4, 9]) { ctx.beginPath(); ctx.moveTo(x + lx * u, y - 2 * u); ctx.lineTo(x + lx * u, y + 8 * u); ctx.stroke(); }
      ctx.fillStyle = col; ctx.fillRect(x - 4 * u, y - 22 * u, 8 * u, 13 * u);
      ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(x, y - 25 * u, 4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 8 * dir * u, y - 12 * u); ctx.lineTo(x + 16 * dir * u, y - 30 * u); ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.moveTo(x - 3 * u, y - 10 * u); ctx.lineTo(x - 5 * u, y); ctx.moveTo(x + 3 * u, y - 10 * u); ctx.lineTo(x + 5 * u, y); ctx.stroke();
    if (style === 'hood') { poly(ctx, [[x - 8 * u, y], [x + 8 * u, y], [x, y - 26 * u]], col); poly(ctx, [[x - 5 * u, y - 16 * u], [x + 5 * u, y - 16 * u], [x + 2 * dir * u, y - 31 * u]], '#241f2d'); ctx.fillStyle = '#c9a2ff'; ctx.fillRect(x + dir * u - 1.2 * u, y - 21 * u, 2.4 * u, 2.4 * u); return; }
    ctx.fillStyle = col; ctx.fillRect(x - 5 * u, y - 24 * u, 10 * u, 15 * u);
    ctx.fillStyle = style === 'turban' ? '#c8956a' : '#e8c9a0'; ctx.beginPath(); ctx.arc(x, y - 28 * u, 4.5 * u, 0, Math.PI * 2); ctx.fill();
    if (style === 'turban') { ctx.fillStyle = '#f3ead6'; ctx.beginPath(); ctx.ellipse(x, y - 31 * u, 6 * u, 3.5 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#9aa3ab'; ctx.fillRect(x - 5 * u, y - 34 * u, 10 * u, 4 * u); }
    if (style === 'shield') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 7 * dir * u, y - 15 * u, 8 * u, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(x + 8 * dir * u, y + 2 * u); ctx.lineTo(x + 8 * dir * u, y - 44 * u); ctx.stroke();
    if (style !== 'turban') poly(ctx, [[x + 8 * dir * u, y - 44 * u], [x + 8 * dir * u, y - 50 * u], [x + (8 + 3 * dir) * u, y - 46 * u]], '#9aa3ab');
  }

  // ---- landscapes ----
  function landscape(ctx, W, H, T, rnd, opts = {}) {
    const u = H / 400;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.55, T.sky[1]); sky.addColorStop(1, T.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,245,230,${0.2 + rnd() * 0.5})`; ctx.fillRect(rnd() * W, rnd() * H * 0.35, u, u); }
    if (opts.sun !== false) {
      const sx = W * (opts.sunX ?? 0.75), sy = H * 0.2, sr = 26 * u, sc = opts.sunColor || '#fff1e0';
      const g = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4); g.addColorStop(0, alpha(sc, 0.3)); g.addColorStop(1, alpha(sc, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ridge(ctx, W, H, H * 0.58, 70 * u, T.far, rnd, 0.3);
    const haze = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.65); haze.addColorStop(0, alpha(T.sky[2], 0)); haze.addColorStop(1, alpha(T.sky[2], 0.35));
    ctx.fillStyle = haze; ctx.fillRect(0, H * 0.45, W, H * 0.2);
    hill(ctx, W, H, H * 0.68, 16 * u, 5.5, 0.4, T.hills[0]);
    hill(ctx, W, H, H * 0.78, 18 * u, 4.2, 2.2, T.hills[1]);
    FEATURE[T.feature](ctx, W, H, u, rnd, T);
    hill(ctx, W, H, H * 0.93, 10 * u, 3, 1.1, T.ground);
  }
  const FEATURE = {
    vale(ctx, W, H, u, rnd) {
      ctx.strokeStyle = 'rgba(190,210,230,0.8)'; ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W * 0.55, H * 0.66); ctx.bezierCurveTo(W * 0.45, H * 0.76, W * 0.62, H * 0.84, W * 0.5, H * 0.94); ctx.stroke();
      for (let i = 0; i < 18; i++) tree(ctx, rnd() * W, H * (0.8 + rnd() * 0.12), (8 + rnd() * 8) * u, 'oak', '#1c2c18');
    },
    steppe(ctx, W, H, u, rnd) {
      for (let i = 0; i < 14; i++) tree(ctx, rnd() * W, H * (0.72 + rnd() * 0.2), (6 + rnd() * 6) * u, 'shrub', '#5a4a22');
      for (let i = 0; i < 10; i++) { const x = rnd() * W, y = H * (0.75 + rnd() * 0.18), s = (3 + rnd() * 5) * u; ctx.fillStyle = '#8b7a66'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(240,180,120,0.18)'; ctx.fillRect(0, H * 0.6, W, H * 0.2);
    },
    tundra(ctx, W, H, u, rnd) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(rnd() * W, H * (0.7 + rnd() * 0.2), (30 + rnd() * 60) * u, (6 + rnd() * 8) * u, 0, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 22; i++) tree(ctx, rnd() * W, H * (0.74 + rnd() * 0.18), (7 + rnd() * 8) * u, 'pine', '#26442f');
    },
    desert(ctx, W, H, u, rnd) {
      ctx.fillStyle = 'rgba(255,230,170,0.25)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(rnd() * W, H * (0.72 + rnd() * 0.15), (60 + rnd() * 80) * u, (8 + rnd() * 10) * u, 0, 0, Math.PI * 2); ctx.fill(); }
      const ox = W * 0.62, oy = H * 0.84;
      ctx.fillStyle = '#3f8fa0'; ctx.beginPath(); ctx.ellipse(ox, oy, 46 * u, 12 * u, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 6; i++) tree(ctx, ox + (rnd() - 0.5) * 120 * u, oy - 6 * u + (rnd() - 0.5) * 20 * u, (8 + rnd() * 6) * u, 'palm', '#4d7a30');
    },
    mire(ctx, W, H, u, rnd) {
      for (let i = 0; i < 7; i++) { ctx.fillStyle = '#1a1426'; ctx.beginPath(); ctx.ellipse(rnd() * W, H * (0.72 + rnd() * 0.2), (18 + rnd() * 30) * u, (5 + rnd() * 7) * u, 0, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 16; i++) tree(ctx, rnd() * W, H * (0.72 + rnd() * 0.2), (8 + rnd() * 8) * u, 'dead', '#0e0a14');
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(190,170,220,0.08)'; ctx.beginPath(); ctx.ellipse(rnd() * W, H * (0.7 + rnd() * 0.2), 120 * u, 18 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    },
    scorched(ctx, W, H, u, rnd) {
      // The volcano, then glowing fissures and embers.
      poly(ctx, [[W * 0.42, H * 0.7], [W * 0.62, H * 0.28], [W * 0.66, H * 0.28], [W * 0.86, H * 0.7]], '#1e1210');
      const g = ctx.createRadialGradient(W * 0.64, H * 0.3, 2, W * 0.64, H * 0.3, 60 * u); g.addColorStop(0, 'rgba(255,150,60,0.9)'); g.addColorStop(1, 'rgba(255,100,40,0)');
      ctx.fillStyle = g; ctx.fillRect(W * 0.5, H * 0.1, W * 0.3, H * 0.4);
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const x0 = rnd() * W, y0 = H * (0.72 + rnd() * 0.2);
        for (const [w, c] of [[6 * u, 'rgba(255,120,40,0.35)'], [2.2 * u, '#ffb050']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0);
          let x = x0, y = y0; for (let k = 0; k < 5; k++) { x += (rnd() - 0.3) * 50 * u; y += (rnd() - 0.5) * 16 * u; ctx.lineTo(x, y); } ctx.stroke();
        }
      }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,${120 + rnd() * 80 | 0},60,${0.3 + rnd() * 0.6})`; ctx.fillRect(rnd() * W, rnd() * H, 1.5 * u, 1.5 * u); }
      for (let i = 0; i < 10; i++) { const x = rnd() * W, y = H * (0.75 + rnd() * 0.18), s = (4 + rnd() * 7) * u; poly(ctx, [[x - s, y], [x + s, y], [x + s * 0.3, y - s * 1.3], [x - s * 0.5, y - s * 0.9]], '#241816'); }
    },
    fells(ctx, W, H, u, rnd) {
      // A ring of standing stones, boulders and fog.
      const cx = W * 0.5, cy = H * 0.8;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, x = cx + Math.cos(a) * 90 * u, y = cy + Math.sin(a) * 22 * u, h = (18 + rnd() * 10) * u, w = 7 * u; poly(ctx, [[x - w, y], [x + w, y], [x + w * 0.7, y - h], [x - w * 0.8, y - h * 0.9]], a > Math.PI ? '#6a7a7a' : '#4a5a5a'); }
      for (let i = 0; i < 12; i++) { const x = rnd() * W, y = H * (0.72 + rnd() * 0.2), s = (4 + rnd() * 8) * u; ctx.fillStyle = '#6e7c78'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.65, 0, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(220,230,235,0.14)'; ctx.beginPath(); ctx.ellipse(rnd() * W, H * (0.66 + rnd() * 0.2), 140 * u, 16 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    },
    blackwood(ctx, W, H, u, rnd) {
      ctx.strokeStyle = '#3a6a78'; ctx.lineWidth = 16 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, H * 0.78); ctx.bezierCurveTo(W * 0.3, H * 0.72, W * 0.6, H * 0.9, W, H * 0.82); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,220,230,0.35)'; ctx.lineWidth = 2 * u; ctx.stroke();
      // Ferry.
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(W * 0.46, H * 0.8, 26 * u, 5 * u); ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(W * 0.48, H * 0.8); ctx.lineTo(W * 0.48, H * 0.72); ctx.stroke();
      for (let i = 0; i < 34; i++) { const y = H * (0.66 + rnd() * 0.3); if (Math.abs(y - H * 0.8) < 24 * u && rnd() < 0.7) continue; tree(ctx, rnd() * W, y, (8 + rnd() * 9) * u, rnd() < 0.6 ? 'pine' : 'oak', '#0c1a10'); }
      // Robber tower.
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(W * 0.82, H * 0.62, 14 * u, 30 * u); poly(ctx, [[W * 0.82 - 2 * u, H * 0.62], [W * 0.82 + 16 * u, H * 0.62], [W * 0.82 + 7 * u, H * 0.55]], '#3a2a1a');
    },
  };

  // ---- monsters ----
  function wyrm(ctx, W, H, u, rnd) {
    const green = '#5f8a4e', dark = '#34522c', belly = '#c8d79a';
    // An S-shaped body in overlapping segments, tail at the left and rearing head at the right.
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, x = W * (0.12 + t * 0.6), y = H * (0.8 - t * 0.12) + Math.sin(t * Math.PI * 2.2) * 34 * u;
      pts.push([x, y, (6 + t * 20) * u]);
    }
    for (const [x, y, r] of pts) { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x, y + r * 0.25, r * 1.1, r, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const [x, y, r] of pts) { ctx.fillStyle = green; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.88, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const [x, y, r] of pts) { ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(x, y + r * 0.55, r * 0.6, r * 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
    // Spines along the back.
    pts.forEach(([x, y, r], i) => { if (i % 3 === 0 && i < 40) poly(ctx, [[x - r * 0.3, y - r * 0.7], [x + r * 0.3, y - r * 0.7], [x, y - r * 1.4]], dark); });
    // Neck rearing up to the head.
    const [nx, ny, nr] = pts[40], hx = nx + 46 * u, hy = ny - 96 * u;
    ctx.strokeStyle = dark; ctx.lineCap = 'round'; ctx.lineWidth = nr * 1.9;
    ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx + 40 * u, ny - 20 * u, hx, hy); ctx.stroke();
    ctx.strokeStyle = green; ctx.lineWidth = nr * 1.6;
    ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx + 40 * u, ny - 20 * u, hx, hy); ctx.stroke();
    // Head: a long skull with an open jaw, fangs, a frill and one amber eye.
    poly(ctx, [[hx - 22 * u, hy - 14 * u], [hx + 20 * u, hy - 22 * u], [hx + 70 * u, hy - 8 * u], [hx + 64 * u, hy + 2 * u], [hx - 16 * u, hy + 8 * u]], green);
    poly(ctx, [[hx - 12 * u, hy + 10 * u], [hx + 58 * u, hy + 14 * u], [hx + 52 * u, hy + 26 * u], [hx - 14 * u, hy + 24 * u]], dark);
    ctx.fillStyle = '#3a1414'; poly(ctx, [[hx - 10 * u, hy + 6 * u], [hx + 62 * u, hy + 2 * u], [hx + 56 * u, hy + 13 * u], [hx - 10 * u, hy + 11 * u]], '#3a1414');
    for (let i = 0; i < 5; i++) { const x = hx + (8 + i * 11) * u; poly(ctx, [[x, hy + 3 * u], [x + 4 * u, hy + 3 * u], [x + 2 * u, hy + 10 * u]], '#f3ead6'); }
    for (let i = 0; i < 4; i++) poly(ctx, [[hx - (14 + i * 4) * u, hy - (8 + i * 6) * u], [hx - (4 + i * 4) * u, hy - (12 + i * 6) * u], [hx - (26 + i * 6) * u, hy - (26 + i * 9) * u]], i % 2 ? dark : '#7aa860');
    ctx.fillStyle = '#ffc840'; ctx.beginPath(); ctx.ellipse(hx + 22 * u, hy - 10 * u, 5 * u, 3.5 * u, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410'; ctx.fillRect(hx + 21 * u, hy - 13 * u, 2 * u, 6 * u);
    // A broken column on the road it has been following.
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(W * 0.04, H * 0.95); ctx.quadraticCurveTo(W * 0.5, H * 0.86, W * 0.98, H * 0.93); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i < 2 ? '#3a6fc0' : '#2a2a2a'; ctx.fillRect(W * (0.84 + i * 0.022), H * 0.9 + (rnd() - 0.5) * 4 * u, 3 * u, 7 * u); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(W * 0.42, H * 0.88, W * 0.32, 10 * u, 0, 0, Math.PI * 2); ctx.fill();
  }
  function dragon(ctx, W, H, u, rnd) {
    const cx = W * 0.52, cy = H * 0.52, red = '#b8302a', dark = '#6e1a16', belly = '#e8a060';
    // Crag to perch on.
    poly(ctx, [[W * 0.3, H * 0.9], [W * 0.42, H * 0.6], [W * 0.56, H * 0.56], [W * 0.7, H * 0.9]], '#231614');
    // Wings.
    const wing = (dir) => {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(cx, cy - 10 * u);
      ctx.quadraticCurveTo(cx + dir * 60 * u, cy - 120 * u, cx + dir * 150 * u, cy - 110 * u);
      ctx.lineTo(cx + dir * 120 * u, cy - 50 * u); ctx.lineTo(cx + dir * 140 * u, cy - 10 * u); ctx.lineTo(cx + dir * 90 * u, cy - 20 * u); ctx.lineTo(cx + dir * 100 * u, cy + 20 * u);
      ctx.lineTo(cx + dir * 40 * u, cy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = red; ctx.lineWidth = 2.5 * u; for (const [x, y] of [[150, -110], [140, -10], [100, 20]]) { ctx.beginPath(); ctx.moveTo(cx, cy - 10 * u); ctx.lineTo(cx + dir * x * u, cy + y * u); ctx.stroke(); }
    };
    wing(-1); wing(1);
    // Tail, body, neck as thick strokes.
    ctx.lineCap = 'round'; ctx.strokeStyle = red; ctx.lineWidth = 22 * u;
    ctx.beginPath(); ctx.moveTo(cx - 10 * u, cy + 20 * u); ctx.quadraticCurveTo(cx - 90 * u, cy + 40 * u, cx - 140 * u, cy + 110 * u); ctx.lineWidth = 12 * u; ctx.stroke();
    ctx.lineWidth = 34 * u; ctx.beginPath(); ctx.moveTo(cx - 30 * u, cy + 10 * u); ctx.lineTo(cx + 20 * u, cy + 4 * u); ctx.stroke();
    ctx.lineWidth = 18 * u; ctx.beginPath(); ctx.moveTo(cx + 20 * u, cy + 4 * u); ctx.quadraticCurveTo(cx + 60 * u, cy - 20 * u, cx + 70 * u, cy - 70 * u); ctx.stroke();
    ctx.strokeStyle = belly; ctx.lineWidth = 8 * u; ctx.beginPath(); ctx.moveTo(cx - 30 * u, cy + 22 * u); ctx.lineTo(cx + 18 * u, cy + 16 * u); ctx.stroke();
    // Head with horns and fire.
    poly(ctx, [[cx + 55 * u, cy - 80 * u], [cx + 100 * u, cy - 74 * u], [cx + 118 * u, cy - 60 * u], [cx + 96 * u, cy - 52 * u], [cx + 60 * u, cy - 58 * u]], red);
    poly(ctx, [[cx + 62 * u, cy - 80 * u], [cx + 50 * u, cy - 104 * u], [cx + 74 * u, cy - 84 * u]], '#2a1a14');
    ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(cx + 80 * u, cy - 72 * u, 3.5 * u, 0, Math.PI * 2); ctx.fill();
    const fire = ctx.createLinearGradient(cx + 110 * u, 0, cx + 240 * u, 0); fire.addColorStop(0, 'rgba(255,240,120,0.95)'); fire.addColorStop(0.5, 'rgba(255,120,30,0.8)'); fire.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = fire; ctx.beginPath(); ctx.moveTo(cx + 112 * u, cy - 58 * u); ctx.quadraticCurveTo(cx + 180 * u, cy - 90 * u, cx + 240 * u, cy - 40 * u); ctx.quadraticCurveTo(cx + 180 * u, cy - 30 * u, cx + 112 * u, cy - 54 * u); ctx.fill();
    // Legs and claws.
    ctx.strokeStyle = dark; ctx.lineWidth = 9 * u; for (const dx of [-14, 12]) { ctx.beginPath(); ctx.moveTo(cx + dx * u, cy + 18 * u); ctx.lineTo(cx + (dx - 6) * u, cy + 46 * u); ctx.stroke(); }
    ctx.lineWidth = 3 * u; for (const dx of [-20, 6]) for (const c of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(cx + dx * u, cy + 46 * u); ctx.lineTo(cx + (dx + c) * u, cy + 54 * u); ctx.stroke(); }
    // Spines.
    ctx.fillStyle = dark; for (let i = 0; i < 7; i++) { const t = i / 6, x = cx - 30 * u + t * 50 * u, y = cy - 10 * u; poly(ctx, [[x - 4 * u, y], [x + 4 * u, y], [x, y - 12 * u]], dark); }
  }
  function cyclops(ctx, W, H, u, rnd) {
    const cx = W * 0.5, base = H * 0.86, skin = '#8a7a66', dark = '#5a4e40', hide = '#5a4228';
    const stone = (x, y, w, h, c) => poly(ctx, [[x - w, y], [x + w, y], [x + w * 0.7, y - h], [x - w * 0.8, y - h * 0.9]], c);
    for (let i = 0; i < 6; i++) stone(W * (0.08 + i * 0.17) + (rnd() - 0.5) * 20 * u, base + (rnd() - 0.5) * 10 * u, 8 * u, (24 + rnd() * 16) * u, i % 2 ? '#5c6a68' : '#48544e');
    // Legs, torso, arms.
    ctx.fillStyle = dark; for (const dx of [-30, 22]) poly(ctx, [[cx + dx * u - 16 * u, base], [cx + dx * u + 16 * u, base], [cx + dx * u + 12 * u, base - 90 * u], [cx + dx * u - 14 * u, base - 90 * u]], dark);
    poly(ctx, [[cx - 60 * u, base - 80 * u], [cx + 56 * u, base - 80 * u], [cx + 50 * u, base - 190 * u], [cx - 54 * u, base - 190 * u]], skin);
    poly(ctx, [[cx - 62 * u, base - 125 * u], [cx + 58 * u, base - 125 * u], [cx + 54 * u, base - 80 * u], [cx - 58 * u, base - 80 * u]], hide);
    ctx.strokeStyle = skin; ctx.lineWidth = 26 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 54 * u, base - 175 * u); ctx.lineTo(cx - 100 * u, base - 110 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 50 * u, base - 175 * u); ctx.lineTo(cx + 96 * u, base - 230 * u); ctx.stroke();
    // Club held high.
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 12 * u; ctx.beginPath(); ctx.moveTo(cx + 96 * u, base - 230 * u); ctx.lineTo(cx + 150 * u, base - 330 * u); ctx.stroke();
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(cx + 150 * u, base - 335 * u, 22 * u, 30 * u, 0.5, 0, Math.PI * 2); ctx.fill();
    // Head with one eye.
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(cx, base - 220 * u, 40 * u, 44 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.ellipse(cx, base - 226 * u, 16 * u, 13 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8a020'; ctx.beginPath(); ctx.arc(cx + 2 * u, base - 226 * u, 7 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(cx + 3 * u, base - 226 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark; ctx.fillRect(cx - 20 * u, base - 196 * u, 40 * u, 5 * u);
    for (const dx of [-14, 10]) poly(ctx, [[cx + dx * u, base - 196 * u], [cx + (dx + 6) * u, base - 196 * u], [cx + (dx + 3) * u, base - 206 * u]], '#f3ead6');
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, base + 4 * u, 90 * u, 10 * u, 0, 0, Math.PI * 2); ctx.fill();
  }
  function bandits(ctx, W, H, u, rnd) {
    const cx = W * 0.5, cy = H * 0.84;
    // Camp: tents, fire glow, five hooded captains.
    const tent = (x, y, s, c) => { poly(ctx, [[x - s, y], [x + s, y], [x, y - s * 1.3]], c); poly(ctx, [[x - s * 0.25, y], [x + s * 0.25, y], [x, y - s * 0.6]], '#0a0806'); };
    tent(W * 0.2, cy - 10 * u, 34 * u, '#3a2e22'); tent(W * 0.82, cy - 16 * u, 30 * u, '#2e2a26');
    const g = ctx.createRadialGradient(cx, cy - 10 * u, 4 * u, cx, cy - 10 * u, 140 * u); g.addColorStop(0, 'rgba(255,170,70,0.6)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffb040'; for (let i = 0; i < 5; i++) poly(ctx, [[cx - 10 * u + i * 5 * u, cy], [cx - 2 * u + i * 5 * u, cy], [cx - 6 * u + i * 5 * u + (rnd() - 0.5) * 6 * u, cy - (16 + rnd() * 14) * u]], i % 2 ? '#ffd060' : '#ff8030');
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(cx - 16 * u, cy + 2 * u); ctx.lineTo(cx + 14 * u, cy + 6 * u); ctx.moveTo(cx - 12 * u, cy + 7 * u); ctx.lineTo(cx + 16 * u, cy); ctx.stroke();
    const captain = (x, y, s, col, dir) => {
      poly(ctx, [[x - s * 0.55, y], [x + s * 0.55, y], [x + s * 0.3, y - s * 1.5], [x - s * 0.3, y - s * 1.5]], col);
      poly(ctx, [[x - s * 0.42, y - s * 1.3], [x + s * 0.42, y - s * 1.3], [x + s * 0.1 * dir, y - s * 2.2]], '#171410');
      ctx.fillStyle = '#e8c9a0'; ctx.fillRect(x - s * 0.12, y - s * 1.55, s * 0.24, s * 0.22);
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x + s * 0.5 * dir, y); ctx.lineTo(x + s * 0.5 * dir, y - s * 2.2); ctx.stroke();
    };
    const cols = ['#4a3a2a', '#2c3a2a', '#3a2a3a', '#4a2a22', '#2a2e3a'];
    [[-0.28, 0.01, 1], [-0.13, 0.05, 1], [0.0, 0.08, -1], [0.14, 0.05, -1], [0.27, 0.0, -1]].forEach(([dx, dy, dir], i) => captain(cx + dx * W, cy + dy * H, 30 * u, cols[i], dir));
    // Loot.
    ctx.fillStyle = '#e9b43b'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(W * 0.3 + rnd() * 30 * u, cy + 8 * u + rnd() * 8 * u, 2.2 * u, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---- panels ----
  function caption(ctx, W, H, title, sub, accent) {
    const u = H / 400, bh = 54 * u;
    const g = ctx.createLinearGradient(0, H - bh * 1.6, 0, H); g.addColorStop(0, 'rgba(10,8,14,0)'); g.addColorStop(1, 'rgba(10,8,14,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, H - bh * 1.6, W, bh * 1.6);
    ctx.fillStyle = accent || '#e9b43b'; ctx.fillRect(12 * u, H - bh + 6 * u, 4 * u, bh - 16 * u);
    ctx.fillStyle = '#f4ecd6'; ctx.font = `${20 * u}px "IM Fell English SC", "Palatino Linotype", Georgia, serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 24 * u, H - bh + 24 * u);
    ctx.fillStyle = '#d8cdb0'; ctx.font = `${11 * u}px "Alegreya Sans", "Segoe UI", sans-serif`;
    ctx.fillText(sub, 24 * u, H - bh + 42 * u, W - 40 * u);
  }
  function finish(ctx, W, H, rnd) {
    for (let i = 0; i < W * H / 700; i++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'; ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H); v.addColorStop(0, 'rgba(10,8,14,0)'); v.addColorStop(1, 'rgba(10,8,14,0.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function paintPanel(ctx, W, H, panel) {
    const rnd = mulberry((panel.kind + panel.id).split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7));
    const u = H / 400;
    if (panel.kind === 'army') {
      const A = ARMIES[panel.id], C = L.ARMY[panel.id], T = THEMES[A.theme];
      landscape(ctx, W, H, T, rnd, { sunX: 0.8, sunColor: panel.id === 'nyx' ? '#d8c8f0' : '#fff1e0' });
      ctx.fillStyle = A.theme === 'tundra' ? '#8fa6a8' : alpha(T.ground, 0.9); ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.74, 150 * u, 24 * u, 0, 0, Math.PI * 2); ctx.fill();
      L[A.castle](ctx, W * 0.5, H * 0.73, 46 * u, C, u, rnd);
      L.flag(ctx, W * 0.12, H * 0.9, 90 * u, C.color, u);
      for (let i = 0; i < 3; i++) soldier(ctx, W * (0.68 + i * 0.09), H * 0.9 - i * 6 * u, u * 0.9, C.color, A.soldier, -1);
      caption(ctx, W, H, A.full, `${A.role} · ${A.lord} · ${T.name}`, C.color);
    } else if (panel.kind === 'map' || panel.kind === 'grand') {
      const T = THEMES[panel.id];
      landscape(ctx, W, H, T, rnd, { sunX: 0.72, sunColor: panel.id === 'mire' || panel.id === 'blackwood' ? '#d8c8f0' : panel.id === 'scorched' ? '#ffb070' : '#fff1e0' });
      const owner = Object.keys(ARMIES).find(id => ARMIES[id].theme === panel.id);
      if (owner) { const C = L.ARMY[owner]; L[ARMIES[owner].castle](ctx, W * 0.26, H * 0.71, 20 * u, C, u, rnd); }
      const sub = panel.kind === 'grand' ? GRAND[panel.id].sub : `Homeland of ${ARMIES[owner].full}`;
      caption(ctx, W, H, T.name, sub, panel.kind === 'grand' ? '#ff8c42' : L.ARMY[owner].color);
    } else {
      const M = MONSTERS[panel.id], T = THEMES[M.theme];
      landscape(ctx, W, H, T, rnd, { sunX: 0.22, sunColor: panel.id === 'dragon' ? '#ffb070' : '#d8e0f0' });
      ({ wyrm, dragon, cyclops, bandits })[panel.id](ctx, W, H, u, rnd);
      caption(ctx, W, H, M.name, M.sub, '#e0362f');
    }
    finish(ctx, W, H, rnd);
  }

  root.galleryPanels = PANELS;
  root.paintGalleryPanel = paintPanel;
  root.galleryInfo = { THEMES, ARMIES, MONSTERS, GRAND };
})(typeof globalThis !== 'undefined' ? globalThis : this);
