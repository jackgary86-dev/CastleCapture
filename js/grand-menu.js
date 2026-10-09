// grand-menu.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// The main menu's Grand Campaign section (#51): the map cards with painted previews, the Begin
// button, the Continue row and the saved-games sheet. It only reads GRAND_MAPS, MONSTERS and THEMES
// and calls the Grand Campaign's own entry points when they exist (startGrand, loadGrandSlot,
// deleteGrandSlot from #46), so it loads and degrades cleanly while those are still being built.
// Browser only; never touches the simulation.

(() => {
  const $ = id => document.getElementById(id);
  const menu = $('menu');
  const sheet = document.querySelector('#menu .sheet');
  if (!menu || !sheet) return;

  // ---------- what exists yet ----------
  // Top-level const/let in a classic script never lands on globalThis, so each name is tested with
  // typeof directly (safe for names no script has declared yet).
  const grandMaps = () => (typeof GRAND_MAPS !== 'undefined' && GRAND_MAPS && typeof GRAND_MAPS === 'object' ? GRAND_MAPS : null);
  const monsters = () => (typeof MONSTERS !== 'undefined' && MONSTERS && typeof MONSTERS === 'object' ? MONSTERS : null);
  // Starting: #46's own startGrand(mapId, armyId) when it defines one, else the agreed cfg shape
  // passed to play() once js/grand.js (genGrandMap) is loaded.
  const grandReady = () => typeof genGrandMap === 'function' && typeof GRAND !== 'undefined' && typeof play === 'function';
  const startFallback = (mapId, armyId) => {
    const rivals = ARMY_IDS.filter(id => id !== armyId);
    const diff = typeof qDiff === 'string' ? qDiff : 'medium';
    play({ mode: 'grand', seed: Math.floor(Math.random() * 1e9), n: GRAND.castles, diff, armies: [armyId, ...rivals], map: armyId, grandMap: mapId });
  };
  const fns = {
    startGrand: () => (typeof startGrand === 'function' ? startGrand : grandReady() ? startFallback : null),
    loadGrandSlot: () => (typeof loadGrandSlot === 'function' ? loadGrandSlot : null),
    deleteGrandSlot: () => (typeof deleteGrandSlot === 'function' ? deleteGrandSlot : null),
  };
  const fn = name => fns[name]();
  const FALLBACK_MAP = { realm: { name: 'The Realm', theme: 'vale', monster: null, desc: 'All five armies on one great map, with no monster abroad.' } };
  const maps = () => {
    const src = grandMaps();
    const entries = src ? Object.entries(src).filter(([, m]) => m && typeof m === 'object' && m.name) : [];
    return entries.length ? entries : Object.entries(FALLBACK_MAP);
  };
  const monsterName = m => { const M = monsters(); return (m && m.monster && M && M[m.monster] && M[m.monster].name) || null; };
  const themeOf = m => (typeof THEMES === 'object' && THEMES[m.theme]) || THEMES.vale || {};
  const SLOT_KEY = i => `cs-grand-${i}`;
  const slot = i => { const d = store.get(SLOT_KEY(i), null); return d && typeof d === 'object' && d.map !== undefined ? d : null; };
  const ago = t => {
    const mins = Math.round((Date.now() - (t || 0)) / 60000);
    return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
  };
  const slotMap = d => { const src = grandMaps(); return (src && src[d.map] && src[d.map].name) || (FALLBACK_MAP[d.map] && FALLBACK_MAP[d.map].name) || 'The Realm'; };
  const slotLine = d => `${slotMap(d)} · Wave ${d.wave || 1} · ${d.armiesLeft != null ? `${d.armiesLeft} armies left` : 'five armies'} · saved ${ago(d.savedAt)}`;

  // ---------- map previews ----------
  // A small painted thumbnail in the style of art/launch-bg.js: the map's ground, water or lava,
  // scenery and roads from its THEMES entry, with the five realms' castles in the army colours.
  // Seeded by the map id so it is the same every time, and cheap enough to repaint on demand.
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
  const mixc = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = i => Math.round(((pa >> i) & 255) * (1 - t) + ((pb >> i) & 255) * t);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  };
  const hex = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
  function paintPreview(canvas, id, m) {
    const T = themeOf(m), W = 240, H = 130;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const c = canvas.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = mulberry(hash(id));
    const bg = hex(T.bg) || '#263220', field = hex(T.field) || '#33432a', lit = hex(T.lit) || field;
    // Ground, then softer lit patches like meadows.
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      c.fillStyle = i % 3 ? field : lit;
      c.beginPath(); c.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 50, 10 + rnd() * 26, rnd() * Math.PI, 0, Math.PI * 2); c.fill();
    }
    // Fog banks (misty themes) soften the far side.
    const fog = hex(T.fog);
    if (fog) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, alpha(fog, 0.45)); g.addColorStop(0.6, alpha(fog, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    // A river, or a lava fissure that glows: a wandering ribbon across the map.
    const lava = hex(T.lava), pool = hex(T.pool), water = hex(T.water) || pool;
    if (lava || (T.river && water) || (T.pools > 0 && pool)) {
      const col = lava || water;
      const pts = []; let x = -10, y = H * (0.3 + rnd() * 0.4);
      while (x < W + 10) { pts.push([x, y]); x += 18 + rnd() * 14; y += (rnd() - 0.5) * 26; y = Math.max(12, Math.min(H - 12, y)); }
      if (lava) { c.strokeStyle = alpha(lava, 0.35); c.lineWidth = 11; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.stroke(); }
      c.strokeStyle = col; c.lineWidth = lava ? 3 : 6; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.stroke();
      if (!lava) { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.2; c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py - 1.5) : c.moveTo(px, py - 1.5)); c.stroke(); }
      // Crossings: basalt bridges over lava, ferries over water.
      c.fillStyle = lava ? '#2a2420' : (hex(T.road) || '#8d7a55');
      for (let i = 1; i < pts.length - 1; i += Math.max(3, Math.floor(pts.length / 3))) c.fillRect(pts[i][0] - 2, pts[i][1] - 7, 4, 14);
    }
    // Pools where the theme has standing water but no river in this thumbnail.
    if (pool && T.pools > 3) for (let i = 0; i < 3; i++) { c.fillStyle = pool; c.beginPath(); c.ellipse(rnd() * W, rnd() * H, 6 + rnd() * 8, 3 + rnd() * 4, 0, 0, Math.PI * 2); c.fill(); }
    // Roads: the five realms round a central keep. Forest tracks are drawn dashed.
    const forest = T.forest === true ? 1 : (T.forest || 0);
    const cx = W / 2, cy = H / 2 + 2, R = Math.min(W, H) * 0.4;
    const posts = ARMY_IDS.map((_, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return [cx + Math.cos(a) * R * 1.2, cy + Math.sin(a) * R * 0.85]; });
    c.strokeStyle = alpha(hex(T.road) || '#8d7a55', 0.8); c.lineWidth = 1.5; c.setLineDash(forest ? [3, 3] : []);
    for (let i = 0; i < 5; i++) {
      c.beginPath(); c.moveTo(...posts[i]); c.lineTo(cx, cy); c.stroke();
      c.beginPath(); c.moveTo(...posts[i]); c.lineTo(...posts[(i + 1) % 5]); c.stroke();
    }
    c.setLineDash([]);
    // Scenery: trees in the theme's style, boulders and rocks.
    const trees = Math.min(120, (T.trees || 40) + forest * 20), tree = T.tree || 'oak';
    const dark = mixc(bg, '#000000', 0.35), leaf = hex(T.wood) || mixc(field, '#1c2a16', 0.45);
    for (let i = 0; i < trees; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (Math.hypot(x - cx, y - cy) < 11) continue;
      if (tree === 'pine') { c.fillStyle = leaf; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 2.5, y + 1); c.lineTo(x - 2.5, y + 1); c.closePath(); c.fill(); }
      else if (tree === 'dead' || tree === 'shrub') { c.strokeStyle = dark; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y - 3); c.lineTo(x - 2, y - 5); c.moveTo(x, y - 2); c.lineTo(x + 2, y - 4); c.stroke(); }
      else if (tree === 'palm') { c.strokeStyle = leaf; c.lineWidth = 1; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(k * 1.6) * 4, y - 2 + Math.sin(k * 1.6) * 2); c.stroke(); } }
      else { c.fillStyle = leaf; c.beginPath(); c.arc(x, y, 2 + rnd() * 1.5, 0, Math.PI * 2); c.fill(); }
    }
    const rocks = (T.rocks || 0) + (T.boulders || 0) * 2;
    c.fillStyle = mixc(field, '#9a9a96', 0.55);
    for (let i = 0; i < Math.min(60, rocks); i++) { const x = rnd() * W, y = rnd() * H, s = 1.5 + rnd() * (T.boulders ? 3 : 1.5); c.beginPath(); c.moveTo(x - s, y + s * 0.6); c.lineTo(x, y - s); c.lineTo(x + s, y + s * 0.6); c.closePath(); c.fill(); }
    // Embers drift over scorched ground.
    if (lava) for (let i = 0; i < 24; i++) { c.fillStyle = `rgba(255,${150 + Math.floor(rnd() * 80)},60,${0.3 + rnd() * 0.5})`; c.fillRect(rnd() * W, rnd() * H, 1.2, 1.2); }
    // Castles: one per realm in its army's colour (the colour-blind palette when it is on), and
    // the central keep, which is the monster's lair where the map has one.
    const castle = (x, y, s, col, roof) => {
      c.fillStyle = col; c.fillRect(x - s, y - s * 0.6, s * 2, s * 1.4);
      c.fillStyle = roof; c.beginPath(); c.moveTo(x - s * 1.15, y - s * 0.6); c.lineTo(x, y - s * 1.6); c.lineTo(x + s * 1.15, y - s * 0.6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - s, y + s * 0.8, s * 2, 1);
    };
    ARMY_IDS.forEach((aid, i) => { const A = ARMIES[aid]; castle(posts[i][0], posts[i][1], 5, A.color, A.roof || A.color); });
    const ring = hex(T.ring) || '#dccba2';
    if (m.monster) {
      const glowCol = lava ? '#ff8c3c' : ring;
      const g = c.createRadialGradient(cx, cy, 2, cx, cy, 22);
      g.addColorStop(0, alpha(glowCol, 0.55)); g.addColorStop(1, alpha(glowCol, 0));
      c.fillStyle = g; c.fillRect(cx - 24, cy - 24, 48, 48);
    }
    castle(cx, cy, 6, mixc(ring, bg, 0.3), mixc(ring, bg, 0.55));
    // Vignette so the card edges sit into the parchment.
    const v = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 2.2);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  // ---------- the menu group ----------
  const group = document.createElement('div');
  group.className = 'group grand';
  group.innerHTML = `<span class="label">Grand Campaign</span>
    <p style="font-size:14px">All five armies on one great map, fought in waves. About an hour to win or lose.</p>
    <div class="resume grand-continue" id="grandContinue" hidden>
      <div><b>Continue the campaign</b><span id="grandContinueText"></span></div>
      <button class="primary" id="btnGrandContinue">Continue</button>
    </div>
    <div class="grand-maps" id="grandMaps" role="group" aria-label="Choose a map"></div>
    <p class="grand-note" id="grandNote" hidden></p>
    <div class="row">
      <button class="primary" id="btnGrandBegin">Begin the Grand Campaign</button>
      <button id="btnGrandSlots">Saved games</button>
    </div>`;
  const groups = [...document.querySelectorAll('#menu .sheet .group')];
  const byLabel = text => groups.find(g => { const l = g.querySelector('.label'); return l && l.textContent.trim() === text; });
  const campaign = byLabel('Campaign'), rules = byLabel('Rules of war');
  if (campaign) campaign.after(group);
  else if (rules) rules.before(group);
  else ($('ladder')?.closest('.group') || sheet).after(group);

  let chosen = store.get('cs-grand-map', null);
  const mapsEl = $('grandMaps'), noteEl = $('grandNote'), beginBtn = $('btnGrandBegin'), contBox = $('grandContinue');

  function renderMaps() {
    const list = maps();
    if (!list.some(([id]) => id === chosen)) chosen = list[0][0];
    mapsEl.innerHTML = list.map(([id, m]) => {
      const mon = monsterName(m);
      return `<button class="grand-map" data-map="${id}" aria-pressed="${id === chosen}">
        <canvas width="240" height="130" aria-hidden="true"></canvas>
        <b>${m.name}</b>
        <span class="grand-monster">${mon ? `Monster: ${mon}` : 'No monster abroad'}</span>
        <small>${m.desc || ''}</small>
      </button>`;
    }).join('');
    paintAll();
    const ready = !!fn('startGrand');
    const notes = [];
    if (!ready) notes.push('The Grand Campaign is still being built: the maps open as soon as it lands.');
    if (list.length < 3) notes.push(`${3 - list.length} more map${list.length === 2 ? '' : 's'} on the way.`);
    noteEl.textContent = notes.join(' ');
    noteEl.hidden = !notes.length;
    beginBtn.disabled = !ready;
    mapsEl.classList.toggle('single', list.length === 1);
  }
  function paintAll() {
    for (const b of mapsEl.querySelectorAll('button[data-map]')) {
      const m = maps().find(([id]) => id === b.dataset.map);
      const cv = b.querySelector('canvas');
      if (m && cv) { try { paintPreview(cv, m[0], m[1]); } catch {} }
    }
  }
  mapsEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-map]'); if (!b) return;
    chosen = b.dataset.map; store.set('cs-grand-map', chosen);
    mapsEl.querySelectorAll('button[data-map]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  beginBtn.addEventListener('click', () => {
    const start = fn('startGrand');
    if (!start) return;
    const army = typeof myArmy === 'string' ? myArmy : 'aldmere';
    start(chosen, army);
  });

  // ---------- Continue row ----------
  function renderContinue() {
    const d = slot(0);
    contBox.hidden = !d;
    if (d) $('grandContinueText').textContent = slotLine(d);
  }
  $('btnGrandContinue').addEventListener('click', () => { const load = fn('loadGrandSlot'); if (load && slot(0)) load(0); });

  // ---------- Saved games sheet ----------
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'grandSlotsOv'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-labelledby', 'grandSlotsHead');
  ov.innerHTML = `<div class="sheet grand-slots">
    <span class="label" id="grandSlotsHead">Saved games</span>
    <p style="font-size:14px">Five slots for the Grand Campaign. Save from the pause menu during a campaign; load or delete here.</p>
    <div class="slots" id="grandSlotList"></div>
    <div class="row"><button id="grandSlotsClose">Back to the menu</button></div>
  </div>`;
  ($('board') || document.body).append(ov);
  const listEl = $('grandSlotList'), slotsBtn = $('btnGrandSlots');
  let confirming = -1;
  function renderSlots() {
    const canLoad = !!fn('loadGrandSlot');
    listEl.innerHTML = [1, 2, 3, 4, 5].map(i => {
      const d = slot(i);
      if (!d) return `<div class="slot empty"><b>Slot ${i}</b><span>Empty</span></div>`;
      return `<div class="slot"><div><b>${d.label ? String(d.label).replace(/[<>&]/g, '') : `Slot ${i}`}</b><span>${slotLine(d)}</span></div>
        <button data-load="${i}" ${canLoad ? '' : 'disabled'}>Load</button>
        <button data-del="${i}" class="${confirming === i ? 'danger' : ''}">${confirming === i ? 'Really delete?' : 'Delete'}</button></div>`;
    }).join('');
  }
  listEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.load) { const load = fn('loadGrandSlot'); if (load) { ov.hidden = true; load(+b.dataset.load); } return; }
    if (b.dataset.del) {
      const i = +b.dataset.del;
      if (confirming !== i) { confirming = i; renderSlots(); listEl.querySelector(`[data-del="${i}"]`)?.focus(); return; }
      const del = fn('deleteGrandSlot');
      if (del) del(i); else { try { localStorage.removeItem(SLOT_KEY(i)); } catch {} }
      confirming = -1; renderSlots(); renderContinue();
    }
  });
  slotsBtn.addEventListener('click', () => { confirming = -1; renderSlots(); ov.hidden = false; $('grandSlotsClose').focus(); });
  $('grandSlotsClose').addEventListener('click', () => { ov.hidden = true; slotsBtn.focus(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) { e.stopImmediatePropagation(); ov.hidden = true; slotsBtn.focus(); } }, true);

  // ---------- keeping it fresh ----------
  // Re-read the saves whenever the menu is shown, and repaint the previews when the colour-blind
  // palette changes (access.js swaps the army colours through applyPalette).
  function refresh() { renderMaps(); renderContinue(); }
  if (typeof MutationObserver === 'function') new MutationObserver(() => { if (!menu.hidden) refresh(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  if (typeof applyPalette === 'function') {
    const applyPaletteBase = applyPalette;
    applyPalette = function () { applyPaletteBase(); paintAll(); };
  }
  on('wave', () => { if (!menu.hidden) renderContinue(); });
  refresh();
})();
