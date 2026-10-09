// ui.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Everything the player touches: HUD, power panel, treasury and shop, input, menus, the frame loop, and the listeners that turn simulation events into sound and banners.

// ---------- HUD ----------
const strengthEl = document.getElementById('strength'), statusEl = document.getElementById('status');
const powerPanel = document.getElementById('powerPanel'), btnPower = document.getElementById('btnPower');
const ppFill = document.getElementById('ppFill'), ppEmblem = document.getElementById('ppEmblem'), ppName = document.getElementById('ppName');
const ppState = document.getElementById('ppState'), ppDesc = document.getElementById('ppDesc'), ppMore = document.getElementById('ppMore');
const RING = 2 * Math.PI * 20;
let ppArmy = null;
const toastEl = document.getElementById('toast'), tauntEl = document.getElementById('taunt');
let hudTick = 0, toastTimer = 0, tauntTimer = 0;
let tauntsOn = store.get('cs-taunts', true);

function toast(title, detail, color) {
  toastEl.innerHTML = '';
  toastEl.append(title);
  if (detail) { const sm = document.createElement('small'); sm.textContent = detail; toastEl.append(sm); }
  toastEl.style.setProperty('--toast', color);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

// A lord speaks. Routine lines are rate-limited per lord and overall; key moments can force through.
function taunt(o, kind, force = false) {
  if (!G || G.cfg.demo || o === 1 || !tauntsOn) return;
  const lines = lordOf(o).lines[kind];
  if (!lines) return;
  if (!force && (G.time - (G.tauntAt[o] ?? -99) < 12 || G.time - G.lastTaunt < 4)) return;
  G.tauntAt[o] = G.lastTaunt = G.time;
  const A = army(o), L = lordOf(o);
  tauntEl.style.setProperty('--c', A.color);
  tauntEl.innerHTML = `${portraitHtml(G.fac[o])}<div><b>${L.short}, ${L.title}</b><q></q></div>`;
  tauntEl.querySelector('q').textContent = pick(lines);
  tauntEl.hidden = false;
  clearTimeout(tauntTimer);
  tauntTimer = setTimeout(() => { tauntEl.hidden = true; }, 4500);
}

// What the simulation reports, turned into sound, banners and lord lines.
on('newGame', () => { sel.clear(); resize(); sfx.music.setTheme(ARMIES[G.cfg.map].map); });
on('power', ({ o, army: A }) => {
  if (G.cfg.demo) return;
  toast(o === 1 ? `You ${A.power.call}!` : `${A.full} ${A.power.they}!`, o === 1 ? A.power.desc : A.power.desc.replace(/\byour\b/g, 'their'), A.color);
  sfx.power(o === 1);
  if (o !== 1) taunt(o, 'power', true);
});
on('powerReady', ({ o }) => { if (o === 1 && !G.cfg.demo) sfx.chime(); });
on('weather', ({ kind, prev }) => {
  if (G.cfg.demo) return;
  if (kind === 'clear') { toast(`The ${WEATHER[prev].name.toLowerCase()} clears`, 'Marching, training and sight are back to normal.', '#cbbb92'); return; }
  const W = WEATHER[kind], home = G.owners.find(o => G.fac[o] === W.native);
  toast(W.name, W.desc + (home ? ` ${home === 1 ? 'Your troops are' : army(home).full + ' are'} used to it and unaffected.` : ''), '#cbbb92');
});
on('taunt', ({ o, kind, force }) => taunt(o, kind, force));
on('clash', ({ attacker, defender, road }) => { if (!G.cfg.demo && (road || attacker === 1 || defender === 1)) sfx.clash(); });
on('capture', ({ o, was, castle }) => {
  if (was === 1) sel.delete(castle);
  if (!G.cfg.demo && (o === 1 || was === 1)) sfx.horn(o === 1);
});
// Taking a special castle for the first time explains what it does.
on('capture', ({ o, castle }) => {
  if (o !== 1 || !castle.kind || G.cfg.demo) return;
  G.kindsSeen ??= [];
  if (G.kindsSeen.includes(castle.kind)) return;
  G.kindsSeen.push(castle.kind);
  const K = CASTLE_KINDS[castle.kind];
  toast(`You took a ${K.name.toLowerCase()}`, K.desc, army(1).color);
});
on('build', ({ o, unit: U }) => {
  if (G.cfg.demo) return;
  toast(o === 1 ? `You build a ${U.name}` : `${army(o).full} builds a ${U.name}`, o === 1 ? U.desc : U.desc.replace(/\bYour\b/g, 'Their'), col(o));
  sfx.drum();
});
on('surrender', ({ o, heir }) => {
  if (G.cfg.demo) return;
  const A = army(o);
  toast(`${A.full} surrenders!`, heir ? 'Their castles open their gates to you.' : 'Their castles fall back to neutral.', A.color);
  taunt(o, 'surrender', true);
  sfx.horn(true);
});
on('end', ({ win }) => endGame(win));

function hud() {
  if (!G) return;
  // Under fog the bar shows rivals as the player knows them: remembered garrisons and columns in sight.
  const totals = G.owners.map(o => [o, o === 1 || !G.cfg.fog || G.cfg.demo ? totalOf(o) : knownTotal(1, o)]);
  const sum = totals.reduce((a, [, v]) => a + v, 0) || 1;
  strengthEl.innerHTML = totals.map(([o, v]) => `<span title="${army(o).full}" style="width:${(v / sum * 100).toFixed(1)}%;background:${col(o)}"></span>`).join('');
  if (G.cfg.demo) {
    statusEl.textContent = `${army(1).name} vs ${army(2).name}`;
  } else {
    const rivals = G.owners.slice(1).map(o => `${lordOf(o).short} of ${army(o).name}`).join(' & ');
    const label = G.cfg.level ? `Battle ${G.cfg.level}: ${LEVELS[G.cfg.level - 1].name} vs ${rivals}` : `${DIFF_NAME[G.cfg.diff]} · vs ${rivals}`;
    const sky = [G.weather && G.weather.kind !== 'clear' ? WEATHER[G.weather.kind].name : '', nightAmt() > 0.5 ? 'Night' : ''].filter(Boolean).join(', ');
    statusEl.textContent = `${label} · ${fmtTime(G.time)}${sky ? ' · ' + sky : ''}`;
  }
  updatePowerPanel();
  updateCastlePanel();
}

// ---------- castle upgrade panel ----------
// Shown along the bottom of the map when exactly one of your castles is selected.
// This runs before the $ helper further down is defined, so it looks elements up directly.
const castlePanel = document.getElementById('castlePanel');
const UPG_TEXT = {
  walls: { name: 'Walls', key: 'U', desc: 'Defenders count 15% more; archers shoot faster and farther.' },
  barracks: { name: 'Barracks', key: 'I', desc: 'Trains 8% faster; its soldiers hit 12% harder.' },
};
let castlePanelKey = '';
function selectedCastle() {
  if (!G || G.cfg.demo || G.over || G.intro || sel.size !== 1) return null;
  const p = [...sel][0];
  return p.owner === 1 ? p : null;
}
function updateCastlePanel() {
  const p = selectedCastle();
  castlePanel.hidden = !p;
  if (!p) { castlePanelKey = ''; return; }
  const units = Math.floor(p.units), key = `${p.id}|${units}|${lvl(p, 'walls')}|${lvl(p, 'barracks')}`;
  if (key === castlePanelKey) return;
  castlePanelKey = key;
  document.getElementById('cpInfo').textContent = `${kindOf(p) ? kindOf(p).name + ' · ' : ''}${units} troops · Walls ${ROMAN[lvl(p, 'walls')]} · Barracks ${ROMAN[lvl(p, 'barracks')]}`;
  for (const kind of ['walls', 'barracks']) {
    const btn = kind === 'walls' ? document.getElementById('btnWalls') : document.getElementById('btnBarracks');
    const T = UPG_TEXT[kind], L = lvl(p, kind), cost = upgradeCost(p, kind), ok = canUpgrade(p, kind);
    const title = cost === null ? `${T.name} ${ROMAN[L]} · max` : `${T.name} ${L ? ROMAN[L] + ' → ' : ''}${ROMAN[L + 1]}`;
    const costText = cost === null ? 'Fully upgraded' : ok ? `Costs ${cost} troops` : `Costs ${cost} troops · need ${cost + 1 - units} more`;
    btn.innerHTML = `<span class="u-top"><span class="u-name"></span><span class="u-key">${T.key}</span></span><span class="u-desc">${T.desc}</span><span class="u-cost"></span>`;
    btn.querySelector('.u-name').textContent = title;
    btn.querySelector('.u-cost').textContent = costText;
    btn.classList.toggle('can', ok);
    btn.disabled = !ok;
  }
}
// Upgrade every selected castle that can afford it.
function playerUpgrade(kind) {
  if (!G || G.cfg.demo || G.over || G.intro || G.paused) return;
  let any = false;
  for (const p of sel) if (p.owner === 1 && upgrade(p, kind)) any = true;
  if (any) { castlePanelKey = ''; updateCastlePanel(); }
}
document.getElementById('btnWalls').addEventListener('click', () => playerUpgrade('walls'));
document.getElementById('btnBarracks').addEventListener('click', () => playerUpgrade('barracks'));
on('upgrade', ({ castle }) => { if (castle.owner === 1 && !G.cfg.demo) sfx.chime(); });

// Special power panel: name, description, and a countdown ring until it can be used.
function updatePowerPanel() {
  powerPanel.hidden = !G || G.cfg.demo || G.over;
  if (powerPanel.hidden) return;
  const id = G.fac[1], A = ARMIES[id], pw = G.pw[1];
  if (ppArmy !== id) {
    ppArmy = id;
    ppEmblem.innerHTML = svg(A.emblem);
    ppName.textContent = A.power.name;
    ppDesc.textContent = A.power.desc;
  }
  const active = G.time < pw.until, ready = !active && pw.ready <= 0;
  let fill, state;
  if (active) {
    const left = pw.until - G.time;
    fill = left / A.power.dur;
    state = `Active · ${Math.ceil(left)}s left`;
  } else if (!ready) {
    fill = 1 - pw.ready / (pw.until > 0 ? rechargeTime() : FIRST_CHARGE);
    state = `Ready in ${fmtTime(Math.ceil(pw.ready))}`;
  } else {
    fill = 1;
    state = 'Ready · press Q';
  }
  powerPanel.classList.toggle('ready', ready);
  powerPanel.classList.toggle('active', active);
  btnPower.disabled = !ready || !playable();
  ppFill.style.strokeDashoffset = (RING * (1 - Math.max(0, Math.min(1, fill)))).toFixed(2);
  if (ppState.textContent !== state) ppState.textContent = state;
}
ppMore.addEventListener('click', () => {
  const open = powerPanel.classList.toggle('expanded');
  ppMore.setAttribute('aria-expanded', String(open));
  ppMore.textContent = open ? 'Hide details' : 'What does it do?';
});

// Music swells with the fighting: troops on the march, clashes, and any power in use.
function musicMood() {
  if (!G) return;
  const marching = G.packets.reduce((a, k) => a + k.n, 0);
  const clashes = G.fx.filter(f => f.kind === 'clash').length;
  const power = G.owners.some(o => G.time < G.pw[o].until) ? 0.4 : 0;
  const level = G.over || G.paused ? 0 : marching / 120 + clashes / 8 + power;
  sfx.music.setIntensity(G.cfg.demo ? level * 0.4 : level);
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // In a Grand Campaign plan phase the world stands still until the player marches.
  if (G && !G.over && !G.paused && !G.intro && !(G.mode === 'grand' && G.phase === 'plan')) {
    // Faster speeds run extra small steps, so road battles and arrivals stay as precise as at normal speed.
    let left = dt * (G.cfg.demo ? 1 : gameSpeed);
    while (left > 1e-6 && !G.over) { const step = Math.min(left, 1 / 60); update(step); left -= step; }
  }
  for (const s of [...sel]) if (s.owner !== 1) sel.delete(s);
  draw(now);
  if ((hudTick += dt) > 0.2) { hudTick = 0; hud(); renderTreasury(); musicMood(); }
  requestAnimationFrame(frame);
}

// ---------- input ----------
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc, sx: e.clientX, sy: e.clientY };
}
function planetAt(w) {
  let best = null, bd = Infinity;
  for (const p of G.planets) {
    // Castles are taller than wide, so measure from their visual middle.
    const d = Math.hypot(p.x - w.x, (p.y - w.y) * 0.85);
    if (d < p.r * 1.2 + 12 / sc && d < bd) { best = p; bd = d; }
  }
  return best;
}
const playable = () => G && !G.cfg.demo && !G.over && !G.paused && !G.intro;

function playerSend(t) {
  if (send(1, [...sel].filter(s => s !== t), t, sendPct)) {
    sfx.drum();
    if (!G.hintDone) { G.hintDone = true; store.set('cs-hint', true); }
  }
  sel.clear();
}
function playerPower() { if (playable() && usePower(1)) hud(); }

// ---------- treasury and map-unit shop ----------
const trEl = document.getElementById('treasury'), shopEl = document.getElementById('shop'), btnShop = document.getElementById('btnShop'), trNote = document.getElementById('trNote');
let shopOpen = false, lastShopHtml = '', noteFlash = null;

function setShop(open) {
  shopOpen = open;
  btnShop.setAttribute('aria-expanded', String(open));
  renderTreasury();
}

function renderTreasury() {
  trEl.hidden = !G || G.cfg.demo || G.over || G.intro;
  if (trEl.hidden) return;
  const coins = G.coins[1], income = incomeOf(1);
  document.getElementById('coinCount').textContent = Math.floor(coins);
  document.getElementById('coinRate').textContent = `+${income}/min`;
  const owned = G.units.find(u => u.owner === 1);
  btnShop.hidden = !!owned || !!G.placing;
  if (owned) {
    shopEl.hidden = true; trNote.hidden = false;
    trNote.innerHTML = `Your <b>${MAP_UNITS[owned.type].name}</b> stands on the field. One map unit per battle.`;
    return;
  }
  if (G.placing) {
    shopEl.hidden = true; trNote.hidden = false;
    trNote.innerHTML = noteFlash && performance.now() < noteFlash.until
      ? `<b>${noteFlash.text}.</b> Pick another spot.`
      : `Click near your castles to place the <b>${MAP_UNITS[G.placing].name}</b>. Right-click or Esc to cancel.`;
    return;
  }
  trNote.hidden = true;
  shopEl.hidden = !shopOpen;
  if (!shopOpen) return;
  const html = Object.entries(MAP_UNITS).map(([id, U]) => {
    const can = coins >= U.price;
    const when = can ? 'Click to buy, then place it on the map'
      : income > 0 ? `Affordable in ${fmtTime(Math.ceil((U.price - coins) / income * 60))}` : `Need ${Math.ceil(U.price - coins)} more coins`;
    return `<button class="unit${can ? ' can' : ''}" data-unit="${id}" ${can ? '' : 'disabled'}>
      <span class="u-top"><span class="u-name">${U.name}</span><span class="u-kind">${U.kind}</span><span class="u-price">${U.price} coins</span></span>
      <span class="u-desc">${U.desc} Range ${U.range}.</span>
      <span class="u-when">${when}</span></button>`;
  }).join('') + '<p class="tr-note">You can buy <b>one</b> map unit per battle.</p>';
  if (html !== lastShopHtml) { shopEl.innerHTML = html; lastShopHtml = html; }
}

btnShop.addEventListener('click', () => setShop(!shopOpen));
shopEl.addEventListener('click', e => {
  const b = e.target.closest('button[data-unit]');
  if (!b || b.disabled || !playable()) return;
  G.placing = b.dataset.unit;
  ptr.placeHover = false;
  sel.clear();
  setShop(false);
});
function cancelPlacing() { if (G && G.placing) { G.placing = null; renderTreasury(); } }
// Returns true when the click was used for placing a map unit.
function placeAt(e) {
  if (!G.placing) return false;
  if (e.button === 2) { cancelPlacing(); return true; }
  const w = toWorld(e), problem = placeProblem(1, w.x, w.y);
  if (problem) { noteFlash = { text: problem, until: performance.now() + 1800 }; renderTreasury(); return true; }
  buyUnit(1, G.placing, w.x, w.y);
  G.placing = null;
  renderTreasury();
  return true;
}
cv.addEventListener('contextmenu', e => { if (G && G.placing) e.preventDefault(); });
// ---------- game speed ----------
const SPEEDS = [1, 1.5, 2];
let gameSpeed = SPEEDS.includes(store.get('cs-speed', 1)) ? store.get('cs-speed', 1) : 1;
const speedCtl = document.getElementById('speedCtl');
function setSpeed(v) {
  gameSpeed = v;
  store.set('cs-speed', v);
  speedCtl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
}
speedCtl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSpeed(+b.dataset.speed); });
const stepSpeed = d => setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(gameSpeed) + d))]);
setSpeed(gameSpeed);

// ---------- send amount ----------
const PCTS = [0.25, 0.5, 0.75, 1];
let sendPct = PCTS.includes(store.get('cs-send', 0.5)) ? store.get('cs-send', 0.5) : 0.5;
const sendCtl = document.getElementById('sendCtl');
function setSendPct(v) {
  sendPct = v;
  store.set('cs-send', v);
  sendCtl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.pct === v)));
}
sendCtl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSendPct(+b.dataset.pct); });
cv.addEventListener('wheel', e => {
  if (!playable()) return;
  e.preventDefault();
  const i = PCTS.indexOf(sendPct) + (e.deltaY < 0 ? 1 : -1);
  setSendPct(PCTS[Math.max(0, Math.min(PCTS.length - 1, i))]);
}, { passive: false });
setSendPct(sendPct);

// ---------- rally points ----------
const rallyDrag = { from: null, timer: 0 };
function beginRally(p) { rallyDrag.from = p; sel.clear(); ptr.down = false; ptr.hover = null; }
cv.addEventListener('contextmenu', e => { if (playable()) e.preventDefault(); });

cv.addEventListener('pointerdown', e => {
  if (!playable()) return;
  if (placeAt(e)) return;
  cv.setPointerCapture(e.pointerId);
  const w = toWorld(e), p = planetAt(w);
  clearTimeout(rallyDrag.timer);
  if (p && p.owner === 1 && (e.button === 2 || e.shiftKey)) {
    ptr.wx = w.x; ptr.wy = w.y;
    beginRally(p);
    return;
  }
  if (e.pointerType === 'touch' && p && p.owner === 1) {
    rallyDrag.timer = setTimeout(() => { if (ptr.down && !ptr.moved && ptr.start === p) beginRally(p); }, 450);
  }
  Object.assign(ptr, { down: true, moved: false, sx: w.sx, sy: w.sy, wx: w.x, wy: w.y, start: p, wasSel: !!p && sel.has(p), hover: p });
  if (!p) { sel.clear(); return; }
  if (p.owner === 1) sel.add(p);
  else if (sel.size) { playerSend(p); ptr.down = false; }
});
cv.addEventListener('pointermove', e => {
  if (G && G.placing && playable()) { const w = toWorld(e); ptr.wx = w.x; ptr.wy = w.y; ptr.placeHover = true; return; }
  if (rallyDrag.from && playable()) { const w = toWorld(e); ptr.wx = w.x; ptr.wy = w.y; ptr.hover = planetAt(w); return; }
  if (!ptr.down || !playable()) return;
  const w = toWorld(e);
  ptr.wx = w.x; ptr.wy = w.y;
  if (Math.hypot(w.sx - ptr.sx, w.sy - ptr.sy) > 6) ptr.moved = true;
  const p = planetAt(w);
  ptr.hover = p;
  if (ptr.moved && p && p.owner === 1 && ptr.start && ptr.start.owner === 1) sel.add(p);
});
cv.addEventListener('pointerup', e => {
  clearTimeout(rallyDrag.timer);
  if (rallyDrag.from) {
    const from = rallyDrag.from, q = playable() ? planetAt(toWorld(e)) : null;
    rallyDrag.from = null; ptr.hover = null;
    // Release on another of your castles to set the route; anywhere else clears it.
    from.rally = q && q.owner === 1 && q !== from ? q : null;
    return;
  }
  if (!ptr.down) return;
  ptr.down = false;
  if (!playable()) return;
  const p = planetAt(toWorld(e));
  if (ptr.moved) {
    if (p && sel.size) playerSend(p);
    else if (!p) sel.clear();
  } else if (ptr.start && ptr.start.owner === 1 && ptr.wasSel) {
    if (sel.size > 1) playerSend(ptr.start);
    else sel.delete(ptr.start);
  }
  ptr.hover = null;
});
cv.addEventListener('pointercancel', () => { ptr.down = false; ptr.hover = null; rallyDrag.from = null; clearTimeout(rallyDrag.timer); });

function selectAll() { if (playable()) G.planets.forEach(p => p.owner === 1 && sel.add(p)); }
function setPaused(v) {
  if (!G || G.cfg.demo || G.over || G.intro) return;
  G.paused = v; pauseOv.hidden = !v;
  btnPause.textContent = v ? 'Resume' : 'Pause';
}
addEventListener('keydown', e => {
  if (e.code === 'Space' && playable()) { e.preventDefault(); selectAll(); }
  else if (e.key >= '1' && e.key <= '4') setSendPct(PCTS[+e.key - 1]);
  else if (e.key === 'q' || e.key === 'Q') playerPower();
  else if (e.key === 'u' || e.key === 'U') playerUpgrade('walls');
  else if (e.key === 'i' || e.key === 'I') playerUpgrade('barracks');
  else if (e.key === '[') stepSpeed(-1);
  else if (e.key === ']') stepSpeed(1);
  else if (e.key === 'm' || e.key === 'M') toggleSound();
  else if (e.key === 'n' || e.key === 'N') toggleMusic();
  else if (e.key === 'p' || e.key === 'P') setPaused(!(G && G.paused));
  else if ((e.key === 'b' || e.key === 'B') && playable()) { if (G.placing) cancelPlacing(); else if (!G.bought.has(1)) setShop(!shopOpen); }
  else if (e.key === 'Escape' && G && G.placing) cancelPlacing();
  else if (e.key === 'Escape') { if (sel.size) sel.clear(); else if (G && !G.cfg.demo && !G.over) setPaused(!G.paused); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// ---------- menus ----------
const $ = id => document.getElementById(id);
const menu = $('menu'), pauseOv = $('pauseOv'), endOv = $('endOv'), lordOv = $('lordOv'), btnPause = $('btnPause'), btnAll = $('btnAll');
let lastCfg = null;
const isPortrait = () => board.clientHeight > board.clientWidth * 1.1;
let qDiff = 'medium', qAis = 1, qField = 'theirs', qRival = 'random';
let myArmy = ARMY_IDS.includes(store.get('cs-army', 'aldmere')) ? store.get('cs-army', 'aldmere') : 'aldmere';

function segment(id, attr, set) {
  const el = $(id);
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    set(b.dataset[attr]);
  });
}
segment('diffSeg', 'diff', v => qDiff = v);
segment('aiSeg', 'ais', v => qAis = +v);
segment('fieldSeg', 'field', v => qField = v);
segment('rivalSeg', 'rival', v => qRival = v);
segment('tauntSeg', 'taunts', v => { tauntsOn = v === 'on'; store.set('cs-taunts', tauntsOn); });
let fogOn = store.get('cs-fog', false);
segment('fogSeg', 'fog', v => { fogOn = v === 'on'; store.set('cs-fog', fogOn); });
$('fogSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.fog === 'on') === fogOn)));
$('tauntSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.taunts === 'on') === tauntsOn)));

function setArmyColors(id) {
  const A = ARMIES[id];
  document.documentElement.style.setProperty('--army', A.color);
  document.documentElement.style.setProperty('--army-ink', A.ink);
}

function renderArmies() {
  $('armyPick').innerHTML = ARMY_IDS.map(id => {
    const A = ARMIES[id];
    return `<button data-army="${id}" aria-pressed="${id === myArmy}" style="--c:${A.color}">${svg(A.emblem)}<b>${A.name}</b><small>${A.role}</small></button>`;
  }).join('');
  const A = ARMIES[myArmy], st = A.stats;
  $('dossier').style.setProperty('--c', A.color);
  $('dossier').innerHTML = `
    <h3>${A.full}<span class="chip" style="--c:${A.color};--ci:${A.ink}">${A.role}</span></h3>
    <p>${A.story}</p>
    <dl>
      <dt>Strength</dt><dd>${A.strength}</dd>
      <dt>Power</dt><dd><b>${A.power.name}.</b> ${A.power.desc}</dd>
      <dt>Homeland</dt><dd>${A.homeland}</dd>
      <dt>As a rival</dt><dd>${A.personality}</dd>
      <dt>Lord</dt><dd><b>${LORDS[myArmy].name}, ${LORDS[myArmy].title}.</b> ${LORDS[myArmy].bio}</dd>
    </dl>`;
  if (qRival !== 'random' && qRival === myArmy) qRival = 'random';
  $('rivalSeg').innerHTML = `<button data-rival="random" aria-pressed="${qRival === 'random'}">Random</button>` +
    ARMY_IDS.filter(id => id !== myArmy).map(id => `<button data-rival="${id}" aria-pressed="${qRival === id}">${ARMIES[id].name}</button>`).join('');
  setArmyColors(myArmy);
}
$('armyPick').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  myArmy = b.dataset.army; store.set('cs-army', myArmy);
  renderArmies(); renderLadder();
});

const others = () => ARMY_IDS.filter(id => id !== myArmy);
function levelRivals(lv) {
  const o = others(), L = LEVELS[lv - 1];
  return L.ais === 1 ? [o[(lv - 1) % 4]] : [o[(lv - 1) % 4], o[lv % 4]];
}

function renderLadder() {
  const unlocked = store.get('cs-unlocked', 1), done = store.get('cs-done', []);
  $('ladder').innerHTML = LEVELS.map((L, i) => {
    const rivals = levelRivals(i + 1).map(id => `${LORDS[id].short} of ${ARMIES[id].name}`).join(' & ');
    return `<button data-level="${i + 1}" ${i + 1 > unlocked ? 'disabled' : ''} class="${done.includes(i + 1) ? 'done' : ''}" title="${L.name}: vs ${rivals} · ${DIFF_NAME[L.diff]}"><b>${['I','II','III','IV','V','VI','VII','VIII'][i]}</b><small>${i + 1 > unlocked ? 'Locked' : L.name}</small></button>`;
  }).join('');
}
$('ladder').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  startLevel(+b.dataset.level);
});

function startLevel(lv) {
  const rivals = levelRivals(lv);
  play({ ...LEVELS[lv - 1], level: lv, armies: [myArmy, ...rivals], map: rivals[0] });
}
// ---------- custom battle settings ----------
const PRESETS = {
  quick:    { castles: 12, map: 0.8,  start: 60, neutral: 0.5, speed: 1.25, recharge: 120 },
  standard: { castles: 18, map: 1,    start: 40, neutral: 1,   speed: 1,    recharge: 300 },
  long:     { castles: 26, map: 1.25, start: 30, neutral: 1.5, speed: 1,    recharge: 480 },
};
const SET_IDS = { castles: 'setCastles', map: 'setMap', start: 'setStart', neutral: 'setNeutral', speed: 'setSpeed', recharge: 'setRecharge' };
function readCustom() {
  const c = {};
  // A blank or unknown value falls back to Standard rather than becoming zero.
  for (const [k, id] of Object.entries(SET_IDS)) { const v = +$(id).value; c[k] = v > 0 ? v : PRESETS.standard[k]; }
  const raw = $('setSeed').value.trim();
  c.seed = /^\d{1,10}$/.test(raw) ? +raw : null;
  return c;
}
function showCustom(c) {
  for (const [k, id] of Object.entries(SET_IDS)) $(id).value = String(c[k]);
  $('outCastles').textContent = $('setCastles').value;
  const now = readCustom();
  const match = Object.keys(PRESETS).find(name => Object.keys(SET_IDS).every(k => PRESETS[name][k] === now[k]));
  $('presetSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === match)));
}
function saveCustom() {
  const c = readCustom();
  store.set('cs-custom', { ...c, seed: $('setSeed').value.trim() });
  showCustom(c);
}
$('presetSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  showCustom(PRESETS[b.dataset.preset]); saveCustom();
});
$('customBox').addEventListener('input', saveCustom);
{
  // Restore saved settings; anything missing or no longer offered falls back to Standard.
  const saved = store.get('cs-custom', null) || {};
  showCustom({ ...PRESETS.standard });
  for (const [k, id] of Object.entries(SET_IDS)) {
    if (saved[k] == null) continue;
    const el = $(id), before = el.value;
    el.value = String(saved[k]);
    if (el.value !== String(saved[k])) el.value = before;
  }
  if (typeof saved.seed === 'string') $('setSeed').value = saved.seed;
  showCustom(readCustom());
}
$('btnCopySeed').addEventListener('click', () => {
  const seed = $('seedVal').textContent;
  const done = () => { $('btnCopySeed').textContent = 'Copied'; setTimeout(() => { $('btnCopySeed').textContent = 'Copy'; }, 1500); };
  const fallback = () => getSelection().selectAllChildren($('seedVal'));
  try { navigator.clipboard.writeText(seed).then(done, fallback); } catch { fallback(); }
});

function quickCfg() {
  let rivals = shuffle(others());
  if (qRival !== 'random') rivals = [qRival, ...rivals.filter(id => id !== qRival)];
  rivals = rivals.slice(0, qAis);
  const c = readCustom(), fixed = c.seed !== null;
  return {
    seed: fixed ? c.seed : Math.floor(Math.random() * 1e9), fixedSeed: fixed,
    n: qAis === 4 ? Math.round(c.castles * 1.75) : c.castles + (qAis === 1 ? 0 : 1), mapScale: c.map, start: c.start, neutral: c.neutral, speedMul: c.speed, recharge: c.recharge,
    diff: qDiff, armies: [myArmy, ...rivals], map: qField === 'mine' ? myArmy : rivals[0], fog: fogOn,
  };
}
// ---------- save and resume ----------
// A battle is saved to the browser when the tab is hidden or closed, and every 10 seconds.
// Anything that can be rebuilt (the map, scenery, effects) is left out; resume rebuilds the
// same map from its seed, then lays the saved state over it. Castle references are stored as ids.
const SAVE_KEY = 'cs-save', SAVE_VERSION = 2;
const SAVE_SKIP = new Set(['theme', 'roadPts', 'fx', 'shots', 'roads', 'meadows', 'trees', 'pools', 'rocks', 'planets', 'placing', 'shake', 'paused', 'terrain', 'paths', 'sight']);
function enc(v) {
  if (v === null || typeof v !== 'object') return v;
  if (G.planets.includes(v)) return { $p: v.id };
  if (v instanceof Set) return { $set: [...v].map(enc) };
  if (v instanceof Map) return { $map: [...v].map(([k, x]) => [enc(k), enc(x)]) };
  if (Array.isArray(v)) return v.map(enc);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
}
function dec(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dec);
  if ('$p' in v) return G.planets[v.$p];
  if ('$set' in v) return new Set(v.$set.map(dec));
  if ('$map' in v) return new Map(v.$map.map(([k, x]) => [dec(k), dec(x)]));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
}
const savable = () => G && !G.cfg.demo && !G.cfg.tutorial && !G.over && !G.intro;
function saveBattle() {
  if (!savable()) return;
  // A Grand Campaign keeps its own autosave (cs-grand-0, grand-ui.js) so it never replaces a battle's.
  if (G.mode === 'grand') { if (typeof saveGrandSlot === 'function') saveGrandSlot(0); return; }
  const state = Object.fromEntries(Object.entries(G).filter(([k]) => !SAVE_SKIP.has(k)).map(([k, v]) => [k, enc(v)]));
  const planets = G.planets.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === 'id' ? v : enc(v)])));
  store.set(SAVE_KEY, { v: SAVE_VERSION, savedAt: Date.now(), cfg: G.cfg, portrait: G.h > G.w, state, planets });
}
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} };
const loadSave = () => { const d = store.get(SAVE_KEY, null); return d && d.v === SAVE_VERSION && d.cfg && d.state ? d : null; };
// Also restores Grand Campaign slots (loadGrandSlot passes its own save and failure handler).
function resumeBattle(d = loadSave(), onFail = clearSave) {
  if (!d) { renderResume(); return false; }
  try {
    lastCfg = d.cfg;
    shopOpen = false; btnShop.setAttribute('aria-expanded', 'false');
    menu.hidden = true; endOv.hidden = true; toastEl.hidden = true; tauntEl.hidden = true; lordOv.hidden = true;
    btnPause.disabled = false; btnAll.disabled = false;
    setArmyColors(d.cfg.armies[0]);
    newGame(d.cfg, d.portrait);
    for (const [k, v] of Object.entries(d.state)) if (k !== '__proto__') G[k] = dec(v);
    for (const sp of d.planets) Object.assign(G.planets[sp.id], dec(sp));
    G.intro = false; G.over = false; G.paused = false;
    setPaused(true);
    if (G.mode === 'grand') toast('Campaign resumed', `Wave ${G.wave}. Press Resume the siege when you are ready.`, army(1).color);
    else toast('Battle resumed', 'Press Resume the siege when you are ready.', army(1).color);
    return true;
  } catch (err) {
    // A save from an older version of the game can't always be restored; drop it rather than crash.
    onFail();
    toMenu();
    return false;
  }
}
function renderResume() {
  const d = loadSave(), box = $('resumeBox');
  box.hidden = !d;
  if (!d) return;
  const me = ARMIES[d.cfg.armies[0]], foes = d.cfg.armies.slice(1).map(id => ARMIES[id].name).join(' & ');
  const mins = Math.round((Date.now() - d.savedAt) / 60000);
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
  $('resumeText').textContent = `${me.name} vs ${foes} in ${ARMIES[d.cfg.map].homeland}, ${fmtTime(d.state.time || 0)} in. Saved ${ago}.`;
}
addEventListener('pagehide', saveBattle);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveBattle(); });
setInterval(() => { if (G && !G.paused) saveBattle(); }, 10000);

function play(cfg) {
  clearSave();
  lastCfg = cfg;
  shopOpen = false; btnShop.setAttribute('aria-expanded', 'false');
  menu.hidden = true; endOv.hidden = true; pauseOv.hidden = true; toastEl.hidden = true;
  btnPause.disabled = false; btnAll.disabled = false; btnPause.textContent = 'Pause';
  setArmyColors(cfg.armies[0]);
  newGame(cfg, isPortrait());
  G.hintDone = store.get('cs-hint', false);
  tauntEl.hidden = true;
  // The rival lords introduce themselves before the battle starts.
  const rivals = cfg.armies.slice(1);
  $('lordHead').textContent = rivals.length > 1 ? `Your rivals in ${ARMIES[cfg.map].homeland}` : `Your rival in ${ARMIES[cfg.map].homeland}`;
  $('lordList').innerHTML = rivals.map(id => {
    const L = LORDS[id], A = ARMIES[id];
    return `<div class="lord">${portraitHtml(id)}<div><h3>${L.name}</h3><div class="title">${L.title[0].toUpperCase() + L.title.slice(1)} · ${A.full}<span class="chip" style="--c:${A.color};--ci:${A.ink}">${A.role}</span></div><q>${L.challenge}</q></div></div>`;
  }).join('');
  G.intro = true;
  lordOv.hidden = false;
  $('btnFight').focus();
}
function startBattle() {
  if (!G || !G.intro) return;
  G.intro = false;
  lordOv.hidden = true;
  const me = ARMIES[G.cfg.armies[0]], foes = G.cfg.armies.slice(1).map(id => ARMIES[id].full).join(' and ');
  toast(`${ARMIES[G.cfg.map].homeland}`, `${me.full} against ${foes}`, me.color);
}
function toMenu() {
  renderResume();
  renderArmies(); renderLadder();
  menu.hidden = false; endOv.hidden = true; pauseOv.hidden = true; toastEl.hidden = true; tauntEl.hidden = true; lordOv.hidden = true;
  btnPause.disabled = true; btnAll.disabled = true;
  newGame(demoCfg(), isPortrait());
}
// ---------- end-of-battle summary chart ----------
// Army colours carry identity; dash patterns and direct labels back them up, since blue and violet sit close for some readers.
const SERIES_DASH = [[], [7, 4], [2, 3]];
const CHART_INK = '#ece2c6', CHART_MUTED = '#a99d80', CHART_GRID = 'rgba(236,226,198,0.12)';
const seriesName = o => o === 1 ? 'You' : lordOf(o).short;
const niceStep = raw => { const p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw); };
let chartBase = null, chartGeom = null;

function renderSummary() {
  const cvs = $('endChart'), tip = $('chartTip');
  const W = cvs.clientWidth, H = 180, d = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = Math.round(W * d); cvs.height = Math.round(H * d);
  const c = cvs.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, 0);
  const hist = G.history, owners = G.owners, end = Math.max(G.time, 1);
  const maxV = Math.max(10, ...hist.flatMap(h => h.v));
  const step = niceStep(maxV / 3), top = Math.ceil(maxV / step) * step;
  const L = 38, R = 70, T = 12, B = 24, pw = W - L - R, ph = H - T - B;
  const X = t => L + (t / end) * pw, Y = v => T + ph - (v / top) * ph;
  const valueAt = (i, t) => {
    let best = hist[0];
    for (const h of hist) if (Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
    return best.v[i];
  };
  c.fillStyle = TIMBER; c.fillRect(0, 0, W, H);
  c.font = '500 11px "Alegreya Sans", system-ui, sans-serif';

  // Recessive grid and axes.
  c.strokeStyle = CHART_GRID; c.lineWidth = 1; c.fillStyle = CHART_MUTED;
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let v = 0; v <= top; v += step) {
    c.beginPath(); c.moveTo(L, Math.round(Y(v)) + 0.5); c.lineTo(L + pw, Math.round(Y(v)) + 0.5); c.stroke();
    c.fillText(String(v), L - 6, Y(v));
  }
  const tStep = end > 240 ? 60 : end > 90 ? 30 : 15;
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (let t = 0; t <= end + 0.01; t += tStep) c.fillText(fmtTime(t), X(t), T + ph + 7);

  // Castles won and lost, as ticks along the baseline.
  for (const e of G.events) {
    if (e.kind !== 'took' && e.kind !== 'lost') continue;
    const x = X(e.t), y = T + ph;
    c.fillStyle = e.kind === 'took' ? col(1) : WARN;
    c.beginPath();
    if (e.kind === 'took') { c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.lineTo(x, y - 7); }
    else { c.moveTo(x - 4, y - 7); c.lineTo(x + 4, y - 7); c.lineTo(x, y); }
    c.closePath(); c.fill();
  }

  // One 2px line per kingdom.
  owners.forEach((o, i) => {
    c.strokeStyle = col(o); c.lineWidth = 2; c.lineJoin = 'round'; c.setLineDash(SERIES_DASH[i] || []);
    c.beginPath();
    hist.forEach((h, j) => { const x = X(h.t), y = Y(h.v[i]); j ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
  });
  c.setLineDash([]);

  // Special powers: a diamond on the user's line, ringed in the surface colour so it stays readable where lines cross.
  for (const e of G.events) {
    if (e.kind !== 'power') continue;
    const i = owners.indexOf(e.owner); if (i < 0) continue;
    const x = X(e.t), y = Y(valueAt(i, e.t));
    c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath();
    c.fillStyle = col(e.owner); c.fill(); c.strokeStyle = TIMBER; c.lineWidth = 2; c.stroke();
  }

  // Direct labels at the end of each line, nudged apart so they never overlap.
  const labels = owners.map((o, i) => ({ o, y: Y(hist[hist.length - 1].v[i]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k++) labels[k].y = Math.max(labels[k].y, labels[k - 1].y + 14);
  c.font = '700 12px "Alegreya Sans", system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
  for (const lb of labels) {
    c.fillStyle = col(lb.o); c.beginPath(); c.arc(L + pw + 8, lb.y, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = CHART_INK; c.fillText(seriesName(lb.o), L + pw + 15, lb.y);
  }

  chartBase = c.getImageData(0, 0, cvs.width, cvs.height);
  chartGeom = { L, T, pw, ph, end, X, Y, W, H, d, valueAt };
  tip.hidden = true;

  // Legend: line style per kingdom, then what the markers mean.
  const swatch = (color, dash) => `<svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash.join(' ')}"/></svg>`;
  $('chartKey').innerHTML = owners.map((o, i) => `<span>${swatch(col(o), SERIES_DASH[i] || [])}${o === 1 ? 'You' : `${lordOf(o).short} (${army(o).name})`}</span>`).join('') +
    `<span><svg width="12" height="12" aria-hidden="true"><path d="M6 0l6 6-6 6-6-6z" fill="${CHART_MUTED}"/></svg>Special power used</span>` +
    `<span><svg width="10" height="9" aria-hidden="true"><path d="M0 9h10L5 0z" fill="${col(1)}"/></svg>You took a castle</span>` +
    `<span><svg width="10" height="9" aria-hidden="true"><path d="M0 0h10L5 9z" fill="${WARN}"/></svg>You lost a castle</span>`;

  // Table view: the same numbers every 15 seconds.
  const rows = [];
  for (let t = 0; t < end; t += 15) rows.push(t);
  rows.push(end);
  $('endTable').innerHTML = `<thead><tr><th scope="col">Time</th>${owners.map(o => `<th scope="col">${seriesName(o)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(t => `<tr><td>${fmtTime(t)}</td>${owners.map((o, i) => `<td>${Math.round(valueAt(i, t))}</td>`).join('')}</tr>`).join('') + '</tbody>';
}

// Hover: a crosshair and a tooltip with every kingdom's strength at that moment.
function chartHover(e) {
  if (!chartBase || !chartGeom) return;
  const cvs = $('endChart'), tip = $('chartTip'), g = chartGeom, c = cvs.getContext('2d');
  const r = cvs.getBoundingClientRect(), x = e.clientX - r.left;
  if (x < g.L - 10 || x > g.L + g.pw + 10) { chartLeave(); return; }
  const t = Math.max(0, Math.min(g.end, (x - g.L) / g.pw * g.end));
  c.setTransform(1, 0, 0, 1, 0, 0); c.putImageData(chartBase, 0, 0); c.setTransform(g.d, 0, 0, g.d, 0, 0);
  const cx = g.X(t);
  c.strokeStyle = 'rgba(236,226,198,0.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(Math.round(cx) + 0.5, g.T); c.lineTo(Math.round(cx) + 0.5, g.T + g.ph); c.stroke();
  const vals = G.owners.map((o, i) => ({ o, v: Math.round(g.valueAt(i, t)) }));
  for (const { o, v } of vals) { c.beginPath(); c.arc(cx, g.Y(v), 4, 0, Math.PI * 2); c.fillStyle = col(o); c.fill(); c.strokeStyle = TIMBER; c.lineWidth = 2; c.stroke(); }
  tip.innerHTML = `<b>${fmtTime(t)}</b>` + vals.sort((a, b) => b.v - a.v).map(({ o, v }) => `<br>${seriesName(o)}: <b>${v}</b>`).join('');
  tip.hidden = false;
  const tw = tip.offsetWidth;
  tip.style.left = `${Math.max(4, Math.min(g.W - tw - 4, cx + 12 > g.W - tw - 4 ? cx - tw - 12 : cx + 12))}px`;
}
function chartLeave() {
  if (!chartBase) return;
  const c = $('endChart').getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.putImageData(chartBase, 0, 0);
  $('chartTip').hidden = true;
}
// Redraw whenever the chart's box changes size: on first layout of the end screen and on window resizes.
let chartW = 0;
new ResizeObserver(() => {
  const w = $('endChart').clientWidth;
  if (w && w !== chartW && G && G.over) { chartW = w; renderSummary(); }
}).observe($('endChart'));
$('endChart').addEventListener('pointermove', chartHover);
$('endChart').addEventListener('pointerleave', chartLeave);

function endGame(win) {
  clearSave();
  G.over = true; sel.clear();
  sfx.fanfare(win);
  btnPause.disabled = true; btnAll.disabled = true;
  const lv = G.cfg.level, me = army(1);
  if (win && lv) {
    store.set('cs-unlocked', Math.max(store.get('cs-unlocked', 1), Math.min(LEVELS.length, lv + 1)));
    store.set('cs-done', [...new Set([...store.get('cs-done', []), lv])]);
  }
  $('endTitle').textContent = win ? 'Victory' : 'Defeat';
  $('endTitle').className = win ? 'result-win' : 'result-lose';
  $('endText').textContent = win
    ? (lv === LEVELS.length ? `The High Throne has fallen. ${me.full} rules the realm.` : lv ? `${LEVELS[lv - 1].name} is yours. ${LEVELS[lv].name} awaits.` : `${me.name} banners fly over every castle in ${G.theme === THEMES[me.map] ? 'your homeland' : ARMIES[G.cfg.map].homeland}.`)
    : `Your last castle has fallen to ${G.owners.slice(1).map(o => army(o).full).join(' and ')}. Claim more keeps early, and keep your power for the moment it matters.`;
  // The rival lord has the last word: the strongest survivor if you lost, the last one standing if you won.
  const lordO = win ? G.owners[G.owners.length - 1] : G.owners.slice(1).sort((a, b) => totalOf(b) - totalOf(a))[0];
  const L = lordOf(lordO);
  $('endQuote').innerHTML = `${portraitHtml(G.fac[lordO])}<div><q></q><small>${L.name}, ${L.title}</small></div>`;
  $('endQuote').querySelector('q').textContent = pick(L.lines[!win ? 'victory' : G.surrendered.has(lordO) ? 'surrender' : 'defeat']);
  tauntEl.hidden = true;
  $('seedLine').hidden = !!lv;
  $('seedVal').textContent = G.cfg.seed;
  $('endTime').textContent = fmtTime(G.time);
  $('endCaps').textContent = G.caps;
  $('endPeak').textContent = Math.floor(G.peak);
  $('endLost').textContent = G.stats.castlesLost;
  $('endSent').textContent = G.stats.sent;
  $('endRoad').textContent = Math.round(G.stats.roadLost);
  $('endPowers').textContent = G.stats.powerUses;
  G.history.push({ t: G.time, v: G.owners.map(totalOf) });
  endOv.hidden = false;
  toastEl.hidden = true;
  chartW = 0;
  renderSummary();
  $('btnNext').hidden = !(win && lv && lv < LEVELS.length);
  endOv.hidden = false;
}

$('btnQuick').addEventListener('click', () => play(quickCfg()));
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnQuit').addEventListener('click', () => { clearSave(); toMenu(); });
$('btnResumeSave').addEventListener('click', () => resumeBattle());
$('btnDiscard').addEventListener('click', () => { clearSave(); renderResume(); });
$('btnMenu').addEventListener('click', toMenu);
$('btnRetry').addEventListener('click', () => play(lastCfg.level || lastCfg.fixedSeed ? lastCfg : { ...lastCfg, seed: Math.floor(Math.random() * 1e9) }));
$('btnNext').addEventListener('click', () => startLevel(lastCfg.level + 1));
btnPause.addEventListener('click', () => setPaused(!G.paused));
btnAll.addEventListener('click', selectAll);
btnPower.addEventListener('click', playerPower);
$('btnFight').addEventListener('click', startBattle);

const btnSound = $('btnSound');
function toggleSound() {
  sfx.setMuted(!sfx.muted);
  btnSound.textContent = sfx.muted ? 'Muted' : 'Sound on';
  btnSound.setAttribute('aria-pressed', String(!sfx.muted));
}
btnSound.addEventListener('click', toggleSound);
btnSound.textContent = sfx.muted ? 'Muted' : 'Sound on';

const btnMusic = $('btnMusic');
function toggleMusic() {
  sfx.music.setOn(!sfx.music.on);
  btnMusic.textContent = sfx.music.on ? 'Music on' : 'Music off';
  btnMusic.setAttribute('aria-pressed', String(sfx.music.on));
}
btnMusic.addEventListener('click', toggleMusic);
btnMusic.textContent = sfx.music.on ? 'Music on' : 'Music off';

resize();
toMenu();
requestAnimationFrame(frame);
