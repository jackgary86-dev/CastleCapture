// grand-ui.js
//
// The Grand Campaign's planning screen: the orders list and its March button, order arrows drawn on
// the map, the wave and phase in the header, and keeping the map still while you plan and hands-off
// while the armies march. The rules live in grand.js; the menu entry (#51) calls startGrand().

// Start a Grand Campaign with the player's army against the other four. diff defaults to the
// skirmish difficulty the player last picked.
function startGrand(mapId = 'realm', armyId = myArmy, diff = qDiff) {
  const rivals = shuffle(ARMY_IDS.filter(id => id !== armyId));
  play({
    mode: 'grand', grandMap: GRAND_MAPS[mapId] ? mapId : 'realm',
    seed: Math.floor(Math.random() * 1e9), n: GRAND.castles, diff,
    armies: [armyId, ...rivals], map: armyId,
  });
  // The realm is far bigger than the board: open zoomed in on the player's home castle.
  const home = G.planets.find(p => p.owner === 1);
  if (home && typeof cam !== 'undefined') { cam.z = GRAND_START_ZOOM; cam.cx = home.x; cam.cy = home.y; applyCamera(); }
}
const GRAND_START_ZOOM = 2.4;

// ---------- the orders panel ----------
const ordersPanel = document.getElementById('ordersPanel');
const ordersList = document.getElementById('ordersList');
const btnMarch = document.getElementById('btnMarch');
const waveLabel = document.getElementById('waveLabel');

function orderText(o) {
  if (o.kind === 'send') {
    const to = o.to.owner === 1 ? 'reinforce your castle' : o.to.owner === 0 ? 'an unclaimed keep' : `${army(o.to.owner).name}`;
    return `${o.n} troops → ${to}`;
  }
  if (o.kind === 'power') return `${army(1).power.name}`;
  return `Build a ${MAP_UNITS[o.type].name}`;
}

let ordersKey = '';
function renderOrders() {
  const show = isGrand() && !G.over && !G.cfg.demo;
  ordersPanel.hidden = !show;
  if (!show) { ordersKey = ''; return; }
  const mine = G.orders.filter(o => o.owner === 1);
  const key = `${G.wave}|${G.phase}|${mine.map(o => `${o.kind}${o.n || ''}${o.to ? o.to.id : ''}`).join(',')}`;
  if (key !== ordersKey) {
    ordersKey = key;
    waveLabel.textContent = `Wave ${G.wave}`;
    ordersList.innerHTML = '';
    if (G.phase === 'plan') {
      if (!mine.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Drag from your castles to queue orders. Nothing moves until you march.';
        ordersList.append(li);
      }
      mine.forEach(o => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = orderText(o);
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'ord-x'; x.textContent = '×';
        x.setAttribute('aria-label', `Cancel order: ${orderText(o)}`);
        x.addEventListener('click', () => { cancelOrder(o); renderOrders(); hud(); });
        li.append(span, x);
        ordersList.append(li);
      });
    }
  }
  if (G.phase === 'plan') {
    btnMarch.disabled = !playable();
    btnMarch.textContent = 'March!';
    btnMarch.title = 'Launch every queued order (Enter)';
  } else {
    btnMarch.disabled = true;
    btnMarch.textContent = `Marching… ${Math.max(0, Math.ceil(G.marchLeft))}s`;
  }
}
btnMarch.addEventListener('click', () => { if (playable()) { march(); renderOrders(); hud(); } });

// The header shows the wave and phase instead of the clock.
const hudBase = hud;
hud = function () {
  hudBase();
  if (!isGrand() || G.cfg.demo) return;
  const left = G.owners.filter(o => G.planets.some(p => p.owner === o) && !G.surrendered.has(o)).length;
  statusEl.textContent = `Wave ${G.wave} · ${G.phase === 'plan' ? 'Plan' : `March ${Math.max(0, Math.ceil(G.marchLeft))}s`} · ${left} realms left`;
  renderOrders();
};

// ---------- input: plan freely, then hands off while the armies march ----------
const marching = () => isGrand() && G.phase === 'march' && !G.cfg.demo;
// Map drags and clicks do nothing during the march window.
cv.addEventListener('pointerdown', e => { if (marching()) { e.stopImmediatePropagation(); } }, true);
addEventListener('keydown', e => {
  if (!isGrand() || G.cfg.demo || G.over) return;
  if (e.target.closest && e.target.closest('button, input, select, textarea, a')) return;
  if (e.key === 'Enter') {
    // Enter marches unless the keyboard cursor is in use, where Enter selects and sends; Ctrl+Enter always marches.
    const cursorInUse = typeof kbFocus !== 'undefined' && kbFocus;
    if (G.phase === 'plan' && playable() && (e.ctrlKey || !cursorInUse)) {
      e.preventDefault(); e.stopImmediatePropagation();
      march(); renderOrders(); hud();
    }
  } else if (marching() && (e.key === 'q' || e.key === 'Q' || e.key === 'u' || e.key === 'U' || e.key === 'i' || e.key === 'I' || e.key === 'b' || e.key === 'B')) {
    // Powers, upgrades and the shop wait for the next plan phase.
    e.stopImmediatePropagation();
  }
}, true);

on('wave', ({ wave, phase }) => {
  if (!isGrand() || G.cfg.demo) return;
  renderOrders();
  if (phase === 'plan') toast(`Wave ${wave}`, 'Plan your moves, then march.', army(1).color);
});
on('order', () => renderOrders());

// ---------- camera: WASD and dragging empty ground pan the realm (Ctrl+scroll or pinch zooms, from touch.js) ----------
const PAN_STEP = 140;   // screen pixels per key press
function panBy(dx, dy) {
  if (typeof cam === 'undefined' || !isGrand()) return;
  if (cam.z <= 1.001) return;
  cam.cx += dx / sc; cam.cy += dy / sc; applyCamera();
}
addEventListener('keydown', e => {
  if (!isGrand() || G.cfg.demo || (e.target.closest && e.target.closest('button, input, select, textarea, a'))) return;
  const k = e.key.toLowerCase(), d = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] }[k];
  if (d && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); panBy(d[0] * PAN_STEP, d[1] * PAN_STEP); }
});
let pan = null;
cv.addEventListener('pointerdown', e => {
  if (!isGrand() || G.cfg.demo || e.button !== 0 || e.pointerType === 'touch' || G.placing) return;
  const r = cv.getBoundingClientRect(), w = { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc };
  if (planetAt(w) || typeof cam === 'undefined' || cam.z <= 1.001) return;
  pan = { x: e.clientX, y: e.clientY };
  e.stopImmediatePropagation();
}, true);
addEventListener('pointermove', e => {
  if (!pan) return;
  panBy(pan.x - e.clientX, pan.y - e.clientY);
  pan = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { pan = null; });

// ---------- queued orders on the map ----------
// The player's orders as dashed arrows with their troop counts, drawn over the finished frame.
const drawGrandBase = draw;
draw = function (now) {
  drawGrandBase(now);
  if (!isGrand() || G.phase !== 'plan' || G.cfg.demo) return;
  const mine = G.orders.filter(o => o.owner === 1 && o.kind === 'send');
  if (!mine.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
  const c = col(1);
  // Orders from several castles to one target share a label with their total.
  const totals = new Map();
  for (const o of mine) totals.set(o.to, (totals.get(o.to) || 0) + o.n);
  for (const o of mine) {
    const a = o.from, b = o.to, ang = Math.atan2(b.y - a.y, b.x - a.x);
    const x0 = a.x + Math.cos(ang) * a.r, y0 = a.y + Math.sin(ang) * a.r;
    const x1 = b.x - Math.cos(ang) * (b.r + 8), y1 = b.y - Math.sin(ang) * (b.r + 8);
    ctx.lineCap = 'round';
    for (const [stroke, w] of [[alpha(G.theme.ring === INK ? PARCH : INK, 0.55), 6 / Math.max(sc, 0.5)], [c, 2.6 / Math.max(sc, 0.5)]]) {
      ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.setLineDash([10, 6]); ctx.lineDashOffset = reduceMotion ? 0 : -now / 40;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.setLineDash([]);
    poly([[x1 + Math.cos(ang) * 9, y1 + Math.sin(ang) * 9], [x1 + Math.cos(ang + 2.4) * 9, y1 + Math.sin(ang + 2.4) * 9], [x1 + Math.cos(ang - 2.4) * 9, y1 + Math.sin(ang - 2.4) * 9]], c);
  }
  ctx.lineCap = 'butt';
  for (const [t, n] of totals) {
    const fs = 13 / Math.max(sc, 0.5), label = `${n}`;
    ctx.font = `800 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
    const w = ctx.measureText(label).width + fs, x = t.x - w / 2, y = t.y - t.r * 2.2 - fs * 1.6;
    ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, fs * 1.5, 3); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = army(1).plaqueText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, t.x, y + fs * 0.78);
  }
};
