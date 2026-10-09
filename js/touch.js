// touch.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// Touch and small-screen play: a pinch-zoom and pan camera, larger touch targets, and a thumb bar
// with the controls a phone player needs most. Browser only; never changes the simulation.

// ---------- camera ----------
// The camera sits on top of the fit-to-board view that resize() computes: zoom multiplies the
// scale, and (cx, cy) is the world point at the centre of the board.
const CAM_MAX = 3;
const cam = { z: 1, cx: 0, cy: 0 };
let fitSc = 1;

function applyCamera() {
  if (!G) return;
  if (cam.z <= 1.001) { cam.z = 1; cam.cx = G.w / 2; cam.cy = G.h / 2; }
  sc = fitSc * cam.z;
  ox = cw / 2 - cam.cx * sc;
  oy = ch / 2 - cam.cy * sc;
  // Keep the map on screen: centre it on an axis where it fits, otherwise stop at its edges.
  const mw = G.w * sc, mh = G.h * sc;
  ox = mw <= cw ? (cw - mw) / 2 : Math.min(0, Math.max(cw - mw, ox));
  oy = mh <= ch ? (ch - mh) / 2 : Math.min(0, Math.max(ch - mh, oy));
  cam.cx = (cw / 2 - ox) / sc;
  cam.cy = (ch / 2 - oy) / sc;
}
const resizeBase = resize;
resize = function () {
  resizeBase();
  if (!G) return;
  fitSc = sc;
  applyCamera();
};
// Zoom by a factor while keeping the world point under (sx, sy) on the board in place.
function zoomAt(factor, sx, sy) {
  if (!G) return;
  const wx = (sx - ox) / sc, wy = (sy - oy) / sc;
  cam.z = Math.max(1, Math.min(CAM_MAX, cam.z * factor));
  sc = fitSc * cam.z;
  cam.cx = wx + (cw / 2 - sx) / sc;
  cam.cy = wy + (ch / 2 - sy) / sc;
  applyCamera();
}
function resetCamera() { cam.z = 1; applyCamera(); }
on('newGame', () => { cam.z = 1; resize(); });
// render.js's ResizeObserver holds the original resize(); this one re-applies the camera after it.
new ResizeObserver(() => resize()).observe(board);

// ---------- gestures ----------
// Two fingers pinch to zoom and drag to pan. The UI's own pointer handlers never see a second finger,
// and anything the first finger started (a selection drag, a rally) is undone.
const touches = new Map();
let gesture = null, lastTouch = false, selBefore = [];
const boardXY = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const midDist = () => {
  const [a, b] = [...touches.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
};

cv.addEventListener('pointerdown', e => {
  lastTouch = e.pointerType === 'touch';
  if (!lastTouch) return;
  if (!touches.size) selBefore = [...sel];
  touches.set(e.pointerId, boardXY(e));
  if (touches.size === 2 && G) {
    e.stopImmediatePropagation();
    ptr.down = false; ptr.moved = false; ptr.hover = null;
    rallyDrag.from = null; clearTimeout(rallyDrag.timer);
    sel.clear(); for (const p of selBefore) if (p.owner === 1) sel.add(p);
    const m = midDist();
    gesture = { d0: m.d || 1, z0: cam.z, wx: (m.x - ox) / sc, wy: (m.y - oy) / sc };
  } else if (gesture) e.stopImmediatePropagation();
}, true);

cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') lastTouch = true;
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, boardXY(e));
  if (!gesture) return;
  e.stopImmediatePropagation();
  if (touches.size < 2) return;
  const m = midDist();
  cam.z = Math.max(1, Math.min(CAM_MAX, gesture.z0 * m.d / gesture.d0));
  sc = fitSc * cam.z;
  // Keep the world point that was under the fingers under their midpoint.
  cam.cx = gesture.wx + (cw / 2 - m.x) / sc;
  cam.cy = gesture.wy + (ch / 2 - m.y) / sc;
  applyCamera();
}, true);

const liftTouch = e => {
  if (!touches.has(e.pointerId)) return;
  touches.delete(e.pointerId);
  // While a gesture is ending, swallow the remaining finger so lifting it doesn't send troops.
  if (gesture) { e.stopImmediatePropagation(); if (!touches.size) gesture = null; }
};
cv.addEventListener('pointerup', liftTouch, true);
cv.addEventListener('pointercancel', liftTouch, true);

// Desktop: Ctrl+scroll (and trackpad pinch, which arrives as Ctrl+wheel) zooms; plain scroll still sets the send amount.
cv.addEventListener('wheel', e => {
  if (!e.ctrlKey || !G || G.cfg.demo) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const p = boardXY(e);
  zoomAt(Math.exp(-e.deltaY * 0.002), p.x, p.y);
}, { capture: true, passive: false });

// Larger hit areas for fingers, especially on small castles.
const planetAtBase = planetAt;
planetAt = function (w) {
  if (!lastTouch) return planetAtBase(w);
  let best = null, bd = Infinity;
  for (const p of G.planets) {
    const d = Math.hypot(p.x - w.x, (p.y - w.y) * 0.85);
    if (d < Math.max(p.r * 1.3, 26 / sc) + 10 / sc && d < bd) { best = p; bd = d; }
  }
  return best;
};

// ---------- thumb bar ----------
// Big controls within thumb reach on phones and touch screens: power, send amount, select all, fit view.
const touchUI = () => matchMedia('(pointer: coarse)').matches || board.clientWidth <= 560;
const thumb = document.createElement('div');
thumb.id = 'thumbBar'; thumb.hidden = true;
thumb.setAttribute('role', 'group'); thumb.setAttribute('aria-label', 'Battle controls');
thumb.innerHTML = `<button id="tbPower" title="Special power (Q)"><span class="tb-icon" id="tbPowerIcon"></span><span id="tbPowerText">Power</span></button>
  <button id="tbSend" title="Troops to send (1-4)"></button>
  <button id="tbAll" title="Select all your castles (Space)">All</button>
  <button id="tbFit" title="Fit the whole map" hidden>Fit</button>`;
board.append(thumb);
document.getElementById('tbPower').addEventListener('click', () => playerPower());
document.getElementById('tbSend').addEventListener('click', () => setSendPct(PCTS[(PCTS.indexOf(sendPct) + 1) % PCTS.length]));
document.getElementById('tbAll').addEventListener('click', () => selectAll());
document.getElementById('tbFit').addEventListener('click', resetCamera);

function renderThumb() {
  const show = !!G && !G.cfg.demo && !G.over && !G.intro && touchUI();
  thumb.hidden = !show;
  document.body.classList.toggle('touchui', touchUI());
  if (!show) return;
  const pw = G.pw[1], A = army(1), tb = document.getElementById('tbPower');
  const active = G.time < pw.until, ready = !active && pw.ready <= 0;
  document.getElementById('tbPowerIcon').innerHTML = svg(A.emblem);
  document.getElementById('tbPowerText').textContent = active ? `${Math.ceil(pw.until - G.time)}s` : ready ? 'Power' : fmtTime(Math.ceil(pw.ready));
  tb.disabled = !ready || G.paused;
  tb.classList.toggle('ready', ready && !G.paused);
  document.getElementById('tbSend').textContent = `Send ${Math.round(sendPct * 100)}%`;
  document.getElementById('tbFit').hidden = cam.z <= 1.001;
}
setInterval(renderThumb, 200);
renderThumb();
