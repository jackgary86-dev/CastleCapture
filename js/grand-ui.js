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
    const to = o.to.monster ? (typeof monsterTargetName === 'function' ? monsterTargetName(o.to) : 'the monster')
      : o.to.owner === 1 ? 'reinforce your castle' : o.to.owner === 0 ? 'an unclaimed keep' : `${army(o.to.owner).name}`;
    return `${o.n} troops → ${to}`;
  }
  if (o.kind === 'power') return `${army(1).power.name}`;
  return `Build a ${MAP_UNITS[o.type].name}`;
}

let ordersKey = '';
on('newGame', () => { ordersKey = ''; });   // a loaded campaign can share a key with the old one but not its order objects
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
  renderOrders();
  if (!isGrand() || G.cfg.demo) return;
  const left = G.owners.filter(o => G.planets.some(p => p.owner === o) && !G.surrendered.has(o)).length;
  statusEl.textContent = `Wave ${G.wave} · ${G.phase === 'plan' ? 'Plan' : `March ${Math.max(0, Math.ceil(G.marchLeft))}s`} · ${left} realms left`;
};

// ---------- input: plan freely, then hands off while the armies march ----------
const marching = () => isGrand() && G.phase === 'march' && !G.cfg.demo;
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
  if (phase === 'march' && shopOpen) setShop(false);   // the shop waits for the next plan phase too
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
// Clicks on castles and the monster do nothing during the march window. Registered after the pan listener,
// so dragging empty ground still pans.
cv.addEventListener('pointerdown', e => { if (marching()) { e.stopImmediatePropagation(); } }, true);
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

// ---------- save slots ----------
// Slot 0 is the Continue autosave, written at the start of every plan phase and whenever the tab is
// hidden; slots 1-5 are the player's own. Each is a battle save (enc/dec from ui.js) plus the fields
// the campaign menu lists: label, wave, map and armies left.
const GRAND_SLOTS = 5;
const grandSlotKey = i => `cs-grand-${i}`;
const armiesLeft = () => G.owners.filter(o => G.planets.some(p => p.owner === o) && !G.surrendered.has(o)).length;
function grandSnapshot() {
  const state = Object.fromEntries(Object.entries(G).filter(([k]) => !SAVE_SKIP.has(k)).map(([k, v]) => [k, enc(v)]));
  const planets = G.planets.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === 'id' ? v : enc(v)])));
  return {
    v: SAVE_VERSION, savedAt: Date.now(), label: `${army(1).name}, wave ${G.wave}`, wave: G.wave,
    map: G.cfg.grandMap || 'realm', armiesLeft: armiesLeft(), cfg: G.cfg, portrait: G.h > G.w, state, planets,
  };
}
function saveGrandSlot(i) {
  if (!isGrand() || !savable()) return false;
  store.set(grandSlotKey(i), grandSnapshot());
  return true;
}
const readGrandSlot = i => {
  const d = store.get(grandSlotKey(i), null);
  return d && d.v === SAVE_VERSION && d.cfg && d.cfg.mode === 'grand' && d.state && Array.isArray(d.planets) ? d : null;
};
// Restores slot i (0 is Continue) and leaves the menu, paused. False if the slot is empty or stale.
function loadGrandSlot(i) {
  const d = readGrandSlot(i);
  if (!d) return false;
  const ok = resumeBattle(d, () => {});
  if (ok) { mmLast = -1e9; hud(); }
  return ok;
}
function deleteGrandSlot(i) { try { localStorage.removeItem(grandSlotKey(i)); } catch {} }

on('wave', ({ phase }) => { if (phase === 'plan' && isGrand() && !G.cfg.demo) saveGrandSlot(0); });
// A finished campaign has nothing to continue.
on('end', () => { if (isGrand() && !G.cfg.demo) deleteGrandSlot(0); });

// ---------- export and import ----------
function exportGrandSave() {
  if (!isGrand() || !savable()) return false;
  const blob = new Blob([JSON.stringify(grandSnapshot())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `castle-siege-campaign-wave-${G.wave}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
// Checks a file's text is a campaign save from this version, stores it as the Continue save and
// loads it. Returns an error message, or '' once the campaign is restored.
function importGrandSave(text) {
  let d;
  try { d = JSON.parse(text); } catch { return 'That file is not a saved campaign.'; }
  const hasProto = v => !!v && typeof v === 'object' && (Object.prototype.hasOwnProperty.call(v, '__proto__') || Object.values(v).some(hasProto));
  if (!d || typeof d !== 'object' || !d.cfg || d.cfg.mode !== 'grand' || !d.state || !Array.isArray(d.planets) || hasProto(d)) return 'That file is not a saved campaign.';
  if (d.v !== SAVE_VERSION) return 'That campaign was saved by another version of the game.';
  if (!Number.isFinite(d.wave) || !Number.isFinite(d.state.wave)) return 'That file is not a saved campaign.';
  // Keep the current Continue save until the file has actually loaded.
  const prev = store.get(grandSlotKey(0), null);
  store.set(grandSlotKey(0), d);
  if (loadGrandSlot(0)) return '';
  if (prev) store.set(grandSlotKey(0), prev); else deleteGrandSlot(0);
  return 'That campaign could not be restored.';
}

// ---------- the save box on the pause sheet ----------
const grandSaveBox = document.getElementById('grandSaveBox');
const grandSaveSlots = document.getElementById('grandSaveSlots');
const grandSaveNote = document.getElementById('grandSaveNote');
const grandImportFile = document.getElementById('grandImportFile');
let slotConfirm = 0;
const slotAgo = t => {
  const mins = Math.round((Date.now() - (t || 0)) / 60000);
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
};
function renderSaveBox() {
  const show = isGrand() && savable();
  grandSaveBox.hidden = !show;
  if (!show) return;
  grandSaveSlots.innerHTML = '';
  for (let i = 1; i <= GRAND_SLOTS; i++) {
    const d = store.get(grandSlotKey(i), null), used = !!(d && typeof d === 'object' && d.cfg);
    const li = document.createElement('li'), b = document.createElement('button');
    const name = document.createElement('span'), info = document.createElement('small');
    b.type = 'button';
    name.textContent = slotConfirm === i ? `Overwrite slot ${i}?` : `Slot ${i}`;
    info.textContent = used ? `${d.label || `Wave ${d.wave}`} · ${slotAgo(d.savedAt)}` : 'Empty';
    if (slotConfirm === i) b.className = 'confirm';
    b.append(name, info);
    b.addEventListener('click', () => {
      // A used slot asks once before it is overwritten.
      if (used && slotConfirm !== i) { slotConfirm = i; renderSaveBox(); grandSaveSlots.children[i - 1].firstChild.focus(); return; }
      slotConfirm = 0;
      grandSaveNote.textContent = saveGrandSlot(i) ? `Saved to slot ${i}.` : 'This campaign cannot be saved right now.';
      renderSaveBox();
      grandSaveSlots.children[i - 1].firstChild.focus();
    });
    li.append(b);
    grandSaveSlots.append(li);
  }
}
const setPausedGrand = setPaused;
setPaused = function (v) {
  setPausedGrand(v);
  slotConfirm = 0; grandSaveNote.textContent = '';
  renderSaveBox();
};
document.getElementById('btnGrandExport').addEventListener('click', () => {
  grandSaveNote.textContent = exportGrandSave() ? 'Campaign exported.' : 'This campaign cannot be exported right now.';
});
document.getElementById('btnGrandImport').addEventListener('click', () => grandImportFile.click());
grandImportFile.addEventListener('change', () => {
  const f = grandImportFile.files && grandImportFile.files[0];
  grandImportFile.value = '';
  if (!f) return;
  f.text().then(t => { const err = importGrandSave(t); grandSaveNote.textContent = err; if (!err) renderSaveBox(); });
});

// ---------- zoom buttons (above the minimap) ----------
// Click to zoom in or out about the middle of the board; Fit shows the whole realm. The + and - keys do the same.
const ZOOM_STEP = 1.4;
const zoomBar = document.getElementById('zoomBar'), zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut'), zoomFitBtn = document.getElementById('zoomFit');
const zoomBy = f => { if (isGrand() && !G.cfg.demo) { zoomAt(f, cw / 2, ch / 2); mmLast = -1e9; } };
zoomInBtn.addEventListener('click', () => zoomBy(ZOOM_STEP));
zoomOutBtn.addEventListener('click', () => zoomBy(1 / ZOOM_STEP));
zoomFitBtn.addEventListener('click', () => { if (isGrand()) { resetCamera(); mmLast = -1e9; } });
addEventListener('keydown', e => {
  if (!isGrand() || G.cfg.demo || e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, select, textarea'))) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(ZOOM_STEP); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / ZOOM_STEP); }
  else if (e.key === '0') { e.preventDefault(); resetCamera(); mmLast = -1e9; }
});

// ---------- minimap ----------
// The whole realm in the corner: castles in their owners' colours (as the player knows them under
// fog of war) and a frame round the part on screen. Click or drag on it to look somewhere else.
const minimap = document.getElementById('minimap');
const mm = minimap.getContext('2d');
let mmLast = 0;
const mmFrame = () => {
  const W = minimap.width, H = minimap.height, k = Math.min(W / G.w, H / G.h);
  return { W, H, k, x0: (W - G.w * k) / 2, y0: (H - G.h * k) / 2 };
};
function drawMinimap(now) {
  const show = isGrand() && !G.cfg.demo && !G.over;
  minimap.hidden = !show;
  zoomBar.hidden = !show;
  if (show) { zoomInBtn.disabled = cam.z >= CAM_MAX - 0.001; zoomOutBtn.disabled = zoomFitBtn.disabled = cam.z <= 1.001; }
  if (!show || (now - mmLast < 120 && now >= mmLast)) return;
  mmLast = now;
  const { W, H, k, x0, y0 } = mmFrame();
  mm.setTransform(1, 0, 0, 1, 0, 0);
  mm.clearRect(0, 0, W, H);
  mm.fillStyle = G.theme.bg || '#263220';
  mm.beginPath(); mm.arc(W / 2, H / 2, Math.min(W, H) / 2 - 3, 0, Math.PI * 2); mm.fill();
  for (const p of G.planets) {
    const q = typeof knownOf === 'function' ? knownOf(1, p) : p;
    mm.fillStyle = q.owner ? col(q.owner) : NEUTRAL;
    mm.beginPath(); mm.arc(x0 + p.x * k, y0 + p.y * k, Math.max(2, p.r * k * 1.3), 0, Math.PI * 2); mm.fill();
    if (q.owner === 1) { mm.strokeStyle = PARCH; mm.lineWidth = 1; mm.stroke(); }
  }
  // The map monster (#48), where the player can see it.
  if (G.monster) for (const c of G.monster.creatures) {
    if (c.dead || (typeof seesAt === 'function' && !seesAt(1, c.x, c.y))) continue;
    mm.fillStyle = MONSTERS[G.monster.id].color; mm.beginPath(); mm.arc(x0 + c.x * k, y0 + c.y * k, 3, 0, Math.PI * 2); mm.fill();
    mm.strokeStyle = INK; mm.lineWidth = 1; mm.stroke();
  }
  // The part of the realm on screen.
  const vx = Math.max(0, -ox / sc), vy = Math.max(0, -oy / sc);
  const vw = Math.min(G.w - vx, cw / sc), vh = Math.min(G.h - vy, ch / sc);
  mm.strokeStyle = PARCH; mm.lineWidth = 1.5;
  mm.strokeRect(x0 + vx * k, y0 + vy * k, vw * k, vh * k);
}
function minimapLook(e) {
  if (!isGrand() || typeof cam === 'undefined') return;
  const r = minimap.getBoundingClientRect(), { W, H, k, x0, y0 } = mmFrame();
  const mx = (e.clientX - r.left) * (W / r.width), my = (e.clientY - r.top) * (H / r.height);
  if (cam.z <= 1.001) cam.z = GRAND_START_ZOOM;
  cam.cx = (mx - x0) / k; cam.cy = (my - y0) / k;
  applyCamera();
  mmLast = -1e9;
}
let mmDrag = false;
minimap.addEventListener('pointerdown', e => { mmDrag = true; minimap.setPointerCapture?.(e.pointerId); minimapLook(e); e.preventDefault(); });
minimap.addEventListener('pointermove', e => { if (mmDrag) minimapLook(e); });
minimap.addEventListener('pointerup', () => { mmDrag = false; });
minimap.addEventListener('pointercancel', () => { mmDrag = false; });
const drawMinimapBase = draw;
draw = function (now) {
  drawMinimapBase(now);
  drawMinimap(now);
};
