// access.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// Accessibility: a colour-blind mode (safer palette plus army emblems on plaques and columns),
// full keyboard play, and screen-reader announcements. Browser only; never changes the simulation.

// ---------- colour-blind mode ----------
// Okabe-Ito palette: distinguishable with the common forms of colour blindness.
const CB_PALETTE = {
  aldmere:   { color: '#0072B2', roof: '#00507d', ink: '#ffffff', plaqueText: '#ffffff' },
  kharzul:   { color: '#D55E00', roof: '#953f00', ink: '#ffffff', plaqueText: '#ffffff' },
  frostmark: { color: '#009E73', roof: '#006b4e', ink: '#ffffff', plaqueText: '#ffffff' },
  solmara:   { color: '#F0E442', roof: '#b3a920', ink: '#2a2014', plaqueText: '#2a2014' },
  nyx:       { color: '#CC79A7', roof: '#8f4f74', ink: '#2a2014', plaqueText: '#2a2014' },
};
const NORMAL_PALETTE = Object.fromEntries(ARMY_IDS.map(id => {
  const A = ARMIES[id];
  return [id, { color: A.color, roof: A.roof, ink: A.ink, plaqueText: A.plaqueText }];
}));
let cbMode = store.get('cs-cb', false);

function applyPalette() {
  for (const id of ARMY_IDS) Object.assign(ARMIES[id], (cbMode ? CB_PALETTE : NORMAL_PALETTE)[id]);
  // Refresh everything that copied a colour: the menu's army cards and the page accent.
  if (typeof renderArmies === 'function' && !document.getElementById('menu').hidden) renderArmies();
  if (typeof setArmyColors === 'function') setArmyColors(G && !G.cfg.demo ? G.fac[1] : myArmy);
}

// Each army's emblem as a small canvas glyph, so kingdoms differ by shape as well as colour.
function drawGlyph(id, x, y, r, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineCap = 'round';
  const emblem = ARMIES[id].emblem;
  if (emblem === 'crown') {
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.7); ctx.lineTo(-r, -r * 0.3); ctx.lineTo(-r * 0.5, r * 0.1); ctx.lineTo(0, -r * 0.8);
    ctx.lineTo(r * 0.5, r * 0.1); ctx.lineTo(r, -r * 0.3); ctx.lineTo(r, r * 0.7); ctx.closePath(); ctx.fill();
  } else if (emblem === 'moon') {
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false);
    ctx.arc(r * 0.45, 0, r * 0.8, Math.PI * 1.45, Math.PI * 0.55, true); ctx.closePath(); ctx.fill();
  } else if (emblem === 'snow') {
    ctx.lineWidth = Math.max(1, r * 0.32);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    }
  } else if (emblem === 'sun') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    }
  } else {
    ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// A glyph on a dark disc reads on any background.
function badge(id, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = INK; ctx.fill();
  ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = Math.max(0.8, r * 0.14); ctx.stroke();
  drawGlyph(id, x, y, r * 0.68, ARMIES[id].color);
}

// Emblem beside each owned castle's garrison plaque. Mirrors drawCastle's plaque layout.
const drawCastleBase = drawCastle;
drawCastle = function (p, now) {
  drawCastleBase(p, now);
  if (!cbMode || !p.owner) return;
  const s = p.r, baseY = p.y + s * 0.55, fs = Math.max(11, s * 0.5);
  ctx.font = `800 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
  const tw = ctx.measureText(String(Math.floor(p.units))).width + fs * 0.8, th = fs * 1.2, py = baseY + s * 0.22;
  badge(G.fac[p.owner], p.x - tw / 2 - fs * 0.8, py + th / 2, fs * 0.75);
};

// ---------- keyboard play ----------
let kbFocus = null;   // the castle the keyboard cursor is on
on('newGame', () => { kbFocus = null; });

// Names the castle's kind (fortress, war camp, village) when it has one.
const KIND_NAME = { fortress: 'fortress', camp: 'war camp', village: 'village' };
const castleName = p => {
  const kind = KIND_NAME[p.kind] || (p.owner === 0 ? 'keep' : 'castle');
  return p.owner === 0 ? `Unclaimed ${kind}` : p.owner === 1 ? `Your ${kind}` : `${army(p.owner).name} ${kind}`;
};
const describe = p => `${castleName(p)}, ${Math.floor(p.units)} troops${sel.has(p) ? ', selected' : ''}`;

function moveFocus(p) { kbFocus = p; announce(describe(p)); }
function cycleOwn(back) {
  const mine = G.planets.filter(p => p.owner === 1).sort((a, b) => a.y - b.y || a.x - b.x);
  if (!mine.length) return;
  const i = mine.indexOf(kbFocus);
  const next = i < 0 ? (back ? mine.length - 1 : 0) : (i + (back ? -1 : 1) + mine.length) % mine.length;
  moveFocus(mine[next]);
}
// The nearest castle roughly in the pressed direction (within 60 degrees), favouring ones straight ahead.
function stepFocus(dx, dy) {
  const from = kbFocus || G.planets.find(p => p.owner === 1);
  if (!from) return;
  let best = null, bestScore = Infinity;
  for (const p of G.planets) {
    if (p === from) continue;
    const vx = p.x - from.x, vy = p.y - from.y, d = Math.hypot(vx, vy);
    const off = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / d)));
    if (off > Math.PI / 3) continue;
    const score = d * (1 + off * 1.5);
    if (score < bestScore) { bestScore = score; best = p; }
  }
  if (best) moveFocus(best); else announce('No castle that way');
}
function confirmKey(sendHere) {
  if (!kbFocus) { cycleOwn(false); return; }
  const t = kbFocus;
  const sending = sel.size && (sendHere || t.owner !== 1) && [...sel].some(s => s !== t);
  if (sending) {
    const troops = [...sel].filter(s => s !== t).reduce((a, s) => a + Math.floor(s.units * sendPct), 0);
    playerSend(t);
    announce(`Sent ${troops} troops to ${castleName(t).toLowerCase()}`);
  } else if (t.owner === 1) {
    if (sel.has(t)) sel.delete(t); else sel.add(t);
    announce(`${sel.has(t) ? 'Selected' : 'Deselected'}. ${sel.size} of your castles selected`);
  } else announce('Select one of your castles first, with Tab and Enter');
}

addEventListener('keydown', e => {
  // Key events can target the document or window, which have no closest().
  if (!playable() || (e.target.closest && e.target.closest('button, input, select, textarea, a'))) return;
  const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (e.key === 'Tab') { e.preventDefault(); cycleOwn(e.shiftKey); }
  else if (dirs[e.key]) { e.preventDefault(); stepFocus(...dirs[e.key]); }
  else if (e.key === 'Enter') { e.preventDefault(); confirmKey(e.shiftKey); }
  else if (e.key === 'c' || e.key === 'C') setCbMode(!cbMode);
});

// Keyboard cursor and colour-blind column emblems, drawn over the finished frame.
const drawBase = draw;
draw = function (now) {
  drawBase(now);
  if (!G) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
  if (cbMode) for (const k of G.packets) if (k.delay <= 0 && k.n >= 1) badge(G.fac[k.owner], k.x, k.y - 15, 5.5);
  if (kbFocus && playable()) {
    const p = kbFocus, pulse = reduceMotion ? 0 : Math.sin(now / 180) * 2;
    ctx.save(); ctx.translate(p.x, p.y);
    for (const [c, w] of [[INK, 6], ['#fff8e6', 3]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.strokeRect(-p.r * 1.35 - pulse, -p.r * 1.6 - pulse, p.r * 2.7 + pulse * 2, p.r * 2.9 + pulse * 2);
    }
    ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

// ---------- screen-reader announcements ----------
const live = document.createElement('div');
live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.className = 'sr-only';
document.body.append(live);
let lastSaid = '';
function announce(text) {
  // Re-announce a repeated message by clearing first.
  live.textContent = text === lastSaid ? '' : live.textContent;
  setTimeout(() => { live.textContent = text; lastSaid = text; }, 30);
}
on('capture', ({ o, was, castle }) => {
  if (G.cfg.demo) return;
  if (o === 1) announce(`You captured ${was ? `a ${army(was).name} castle` : 'an unclaimed keep'}. ${Math.floor(castle.units)} troops inside`);
  else if (was === 1) announce(`${army(o).name} captured one of your castles`);
});
on('power', ({ o, army: A }) => { if (!G.cfg.demo) announce(o === 1 ? `You used ${A.power.name}` : `${A.name} used ${A.power.name}: ${A.power.desc}`); });
on('powerReady', ({ o }) => { if (o === 1 && !G.cfg.demo) announce(`${army(1).power.name} is ready. Press Q`); });
on('surrender', ({ o }) => { if (!G.cfg.demo) announce(`${army(o).name} surrenders`); });
on('build', ({ o, unit }) => { if (!G.cfg.demo) announce(`${o === 1 ? 'You' : army(o).name} built a ${unit.name}`); });
on('end', ({ win }) => { if (!G.cfg.demo) announce(win ? 'Victory' : 'Defeat'); });

// ---------- menu settings ----------
const accGroup = document.createElement('div');
accGroup.className = 'group';
accGroup.innerHTML = `<span class="label">Accessibility</span>
  <span class="sublabel">Colour-blind mode (C)</span>
  <div class="seg" id="cbSeg"><button data-cb="off">Off</button><button data-cb="on">On</button></div>
  <ul class="rules">
    <li><b>Tab</b> and <b>Shift+Tab</b> move between your castles; the <b>arrow keys</b> move to the nearest castle in that direction.</li>
    <li><b>Enter</b> selects or deselects your castle, or sends your selected troops to an enemy or unclaimed castle. <b>Shift+Enter</b> sends them to any castle, including your own.</li>
    <li><b>Space</b> selects all your castles and <b>Esc</b> clears the selection. Captures, powers and results are announced to screen readers.</li>
  </ul>`;
(document.getElementById('btnAch')?.closest('.group') || document.getElementById('ladder').closest('.group')).after(accGroup);
const cbSeg = document.getElementById('cbSeg');
function setCbMode(v) {
  cbMode = v;
  store.set('cs-cb', v);
  cbSeg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.cb === 'on') === cbMode)));
  applyPalette();
  announce(`Colour-blind mode ${cbMode ? 'on' : 'off'}`);
}
cbSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setCbMode(b.dataset.cb === 'on'); });
cbSeg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.cb === 'on') === cbMode)));
if (cbMode) applyPalette();
