// render.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js. There is no build step.
// Canvas drawing: scenery, castles, soldiers, map units, effects and the aiming overlay. Owns the canvas and the view state (ptr, sel) that input writes.

// ---------- rendering ----------
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const board = document.getElementById('board');
let dpr = 1, cw = 0, ch = 0, sc = 1, ox = 0, oy = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = board.clientWidth; ch = board.clientHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  if (G) { sc = Math.min(cw / G.w, ch / G.h); ox = (cw - G.w * sc) / 2; oy = (ch - G.h * sc) / 2; }
}
new ResizeObserver(resize).observe(board);
// Moving the window to a screen with another scale changes devicePixelRatio without resizing the board.
(function watchDpr() {
  matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { resize(); watchDpr(); }, { once: true });
})();

const ptr = { down: false, moved: false, sx: 0, sy: 0, wx: 0, wy: 0, start: null, wasSel: false, hover: null };
const sel = new Set();   // the player's selected castles

const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
const shadeRight = (x, y, w, h, a = 0.14) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(x + w * 0.62, y, w * 0.38, h); };
function crenels(x, y, w, size) {
  const n = Math.max(2, Math.round(w / (size * 2)));
  const step = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) ctx.fillRect(x + i * step * 2, y - size, step, size);
}
function arch(cx, baseY, gw, gh, pointed) {
  ctx.fillStyle = INK; ctx.beginPath();
  ctx.moveTo(cx - gw / 2, baseY); ctx.lineTo(cx - gw / 2, baseY - gh + gw / 2);
  if (pointed) ctx.quadraticCurveTo(cx - gw / 2, baseY - gh - gw * 0.2, cx, baseY - gh - gw * 0.35), ctx.quadraticCurveTo(cx + gw / 2, baseY - gh - gw * 0.2, cx + gw / 2, baseY - gh + gw / 2);
  else ctx.arc(cx, baseY - gh + gw / 2, gw / 2, Math.PI, 0);
  ctx.lineTo(cx + gw / 2, baseY); ctx.fill();
}

// Each army's castle style. Returns the points where its banners fly.
const CASTLE = {
  stone(p, s, baseY, tier, roofCol) {
    const stone = '#bdb3a0', dark = '#807563';
    const block = (x, y, w, h, shade, cren = true) => {
      ctx.fillStyle = shade ? dark : stone; ctx.fillRect(x, y, w, h);
      if (cren) crenels(x, y, w, Math.max(2, s * 0.12));
      shadeRight(x, y, w, h);
    };
    const cone = (cx, y, w, h) => poly([[cx - w / 2 - 1.5, y], [cx + w / 2 + 1.5, y], [cx, y - h]], roofCol);
    if (tier === 1) {
      const w = s * 0.9, h = s * 1.3;
      block(p.x - w / 2, baseY - h, w, h, false, false);
      cone(p.x, baseY - h, w, s * 0.6);
      return [[p.x, baseY - h - s * 0.6]];
    }
    const ww = s * (tier === 2 ? 1.7 : 2), wh = s * 0.75, tw = s * 0.5, th = s * (tier === 2 ? 1.2 : 1.1);
    const lx = p.x - ww / 2 - tw * 0.3, rx = p.x + ww / 2 - tw * 0.7;
    block(lx, baseY - th, tw, th, true, false); cone(lx + tw / 2, baseY - th, tw, s * 0.5);
    block(rx, baseY - th, tw, th, true, false); cone(rx + tw / 2, baseY - th, tw, s * 0.5);
    block(p.x - ww / 2 + tw * 0.4, baseY - wh, ww - tw * 0.8, wh);
    let flagAt = [lx + tw / 2, baseY - th - s * 0.5];
    if (tier === 3) {
      const kw = s * 0.75, kh = s * 1.5;
      block(p.x - kw / 2, baseY - kh, kw, kh);
      flagAt = [p.x, baseY - kh - s * 0.12];
    }
    arch(p.x, baseY, s * 0.36, s * 0.46);
    return [flagAt];
  },
  palisade(p, s, baseY, tier, roofCol) {
    const wood = '#8a5a33', woodDark = '#68431f';
    const yurt = (cx, r) => {
      ctx.fillStyle = '#d9c9a3'; ctx.beginPath(); ctx.arc(cx, baseY - s * 0.38, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = roofCol; ctx.fillRect(cx - r, baseY - s * 0.38 - r * 0.45, r * 2, r * 0.18);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(cx, baseY - s * 0.38, r, Math.PI * 1.5, 0); ctx.lineTo(cx, baseY - s * 0.38); ctx.fill();
    };
    const pw = s * (tier === 1 ? 1.2 : tier === 2 ? 1.8 : 2.2), ph = s * (tier === 1 ? 0.5 : 0.62);
    let flagAt;
    if (tier === 3) {
      // Wooden watchtower behind the palisade.
      const tx = p.x - pw * 0.28, th = s * 1.55;
      ctx.fillStyle = woodDark; ctx.fillRect(tx - s * 0.08, baseY - th, s * 0.16, th);
      ctx.fillStyle = wood; ctx.fillRect(tx - s * 0.3, baseY - th, s * 0.6, s * 0.28);
      poly([[tx - s * 0.36, baseY - th], [tx + s * 0.36, baseY - th], [tx, baseY - th - s * 0.3]], roofCol);
      flagAt = [tx, baseY - th - s * 0.3];
    }
    const yurts = tier === 1 ? [[0, 0.45]] : tier === 2 ? [[-0.4, 0.42], [0.4, 0.34]] : [[0.05, 0.5], [0.6, 0.34]];
    yurts.forEach(([dx, r]) => yurt(p.x + dx * s, r * s));
    if (!flagAt) flagAt = [p.x + yurts[0][0] * s, baseY - s * 0.38 - yurts[0][1] * s];
    // Pointed stakes.
    const n = Math.max(5, Math.round(pw / (s * 0.17)));
    const sw = pw / n;
    for (let i = 0; i < n; i++) {
      const x = p.x - pw / 2 + i * sw;
      if (tier > 1 && Math.abs(x + sw / 2 - p.x) < s * 0.2) continue;
      poly([[x, baseY], [x, baseY - ph], [x + sw / 2, baseY - ph - sw * 0.9], [x + sw, baseY - ph], [x + sw, baseY]], i % 2 ? wood : woodDark);
    }
    if (tier > 1) { ctx.fillStyle = INK; ctx.fillRect(p.x - s * 0.2, baseY - ph * 0.8, s * 0.4, ph * 0.8); }
    return [flagAt];
  },
  longhouse(p, s, baseY, tier, roofCol) {
    const stone = '#9aa3ab', timber = '#5a4433', snow = '#f4f8fb';
    const roof = (cx, y, w, h) => {
      poly([[cx - w / 2 - 2, y], [cx + w / 2 + 2, y], [cx, y - h]], '#3b2e24');
      poly([[cx - w * 0.28, y - h * 0.45], [cx + w * 0.28, y - h * 0.45], [cx, y - h - 0.5]], snow);
      ctx.fillStyle = roofCol; ctx.fillRect(cx - 1.2, y - h - 4, 2.4, 4);
    };
    const tower = (cx, w, h) => {
      ctx.fillStyle = stone; ctx.fillRect(cx - w / 2, baseY - h, w, h); shadeRight(cx - w / 2, baseY - h, w, h);
      roof(cx, baseY - h, w, s * 0.75);
      return [cx, baseY - h - s * 0.75 - 4];
    };
    if (tier === 1) return [tower(p.x, s * 0.8, s * 1.15)];
    let flagAt;
    if (tier === 3) flagAt = tower(p.x - s * 0.75, s * 0.55, s * 1.5);
    const lw = s * (tier === 2 ? 1.3 : 1.5), lh = s * 0.5, ly = baseY - s * 0.3 - lh;
    ctx.fillStyle = timber; ctx.fillRect(p.x - lw / 2 + s * 0.1, ly, lw, lh); shadeRight(p.x - lw / 2 + s * 0.1, ly, lw, lh, 0.2);
    roof(p.x + s * 0.1, ly, lw, s * 0.7);
    if (!flagAt) flagAt = [p.x + s * 0.1, ly - s * 0.7 - 4];
    // Low rubble wall in front.
    const ww = s * (tier === 2 ? 1.8 : 2.1), wh = s * 0.32;
    ctx.fillStyle = stone; ctx.beginPath(); ctx.roundRect(p.x - ww / 2, baseY - wh, ww, wh, [wh * 0.4, wh * 0.4, 0, 0]); ctx.fill();
    ctx.fillStyle = snow; ctx.fillRect(p.x - ww / 2 + 2, baseY - wh, ww - 4, 1.6);
    arch(p.x, baseY, s * 0.3, s * 0.3);
    return [flagAt];
  },
  domes(p, s, baseY, tier, roofCol) {
    const sand = '#e2c48a', sandDark = '#b9975c';
    const dome = (cx, y, r) => {
      ctx.fillStyle = roofCol; ctx.beginPath(); ctx.ellipse(cx, y, r, r * 1.05, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.35, y - r * 0.45, r * 0.25, r * 0.4, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, y - r * 1.05); ctx.lineTo(cx, y - r * 1.05 - 4); ctx.stroke();
      return [cx, y - r * 1.05 - 4];
    };
    const minaret = (cx, h) => {
      const w = s * 0.32;
      ctx.fillStyle = sandDark; ctx.fillRect(cx - w / 2, baseY - h, w, h);
      ctx.fillStyle = sand; ctx.fillRect(cx - w * 0.75, baseY - h * 0.72, w * 1.5, 2);
      return dome(cx, baseY - h, w * 0.62);
    };
    if (tier === 1) return [minaret(p.x, s * 1.5)];
    const bw = s * (tier === 2 ? 1.5 : 1.9), bh = s * 0.8;
    const flags = [];
    if (tier === 3) { minaret(p.x - bw / 2 - s * 0.12, s * 1.7); minaret(p.x + bw / 2 + s * 0.12, s * 1.7); }
    flags.push(dome(p.x, baseY - bh, s * (tier === 2 ? 0.45 : 0.6)));
    ctx.fillStyle = sand; ctx.fillRect(p.x - bw / 2, baseY - bh, bw, bh); shadeRight(p.x - bw / 2, baseY - bh, bw, bh, 0.12);
    // Stepped merlons.
    const n = Math.max(4, Math.round(bw / (s * 0.25)));
    for (let i = 0; i < n; i++) { const x = p.x - bw / 2 + (i + 0.5) * bw / n; poly([[x - 2.2, baseY - bh], [x + 2.2, baseY - bh], [x, baseY - bh - 3.5]], sand); }
    arch(p.x, baseY, s * 0.36, s * 0.5, true);
    return flags;
  },
  spires(p, s, baseY, tier, roofCol, glow) {
    const slate = '#4b4558', slateDark = '#353042';
    const spire = (cx, w, h, rh) => {
      ctx.fillStyle = slateDark; ctx.fillRect(cx - w / 2, baseY - h, w, h); shadeRight(cx - w / 2, baseY - h, w, h, 0.2);
      poly([[cx - w / 2 - 1.5, baseY - h], [cx + w / 2 + 1.5, baseY - h], [cx, baseY - h - rh]], roofCol);
      ctx.fillStyle = glow; ctx.fillRect(cx - w * 0.15, baseY - h * 0.75, w * 0.3, h * 0.16);
      return [cx, baseY - h - rh];
    };
    if (tier === 1) return [spire(p.x, s * 0.6, s * 1.2, s * 0.95)];
    const ww = s * (tier === 2 ? 1.6 : 2), wh = s * 0.58;
    const flags = [];
    const sp = tier === 2 ? [[-0.62, 1.15, 0.85], [0.62, 1.0, 0.75]] : [[-0.8, 1.0, 0.75], [0.8, 1.0, 0.75]];
    sp.forEach(([dx, h, rh]) => flags.push(spire(p.x + dx * s, s * 0.42, s * h, s * rh)));
    if (tier === 3) flags.unshift(spire(p.x, s * 0.55, s * 1.55, s * 1.15));
    ctx.fillStyle = slate; ctx.fillRect(p.x - ww / 2 + s * 0.2, baseY - wh, ww - s * 0.4, wh);
    const n = Math.max(4, Math.round(ww / (s * 0.22)));
    for (let i = 0; i < n; i++) { const x = p.x - ww / 2 + s * 0.2 + (i + 0.5) * (ww - s * 0.4) / n; poly([[x - 1.8, baseY - wh], [x + 1.8, baseY - wh], [x, baseY - wh - 4]], slate); }
    arch(p.x, baseY, s * 0.32, s * 0.42, true);
    return [flags[0]];
  },
};

// Each army's banner shape.
const FLAG = {
  swallow(x, top, h, c, wave) {
    const fw = h * 0.75, fh = h * 0.45;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + fw * 0.5, top + wave, x + fw, top + fh * 0.15 + wave * 0.5);
    ctx.lineTo(x + fw * 0.82, top + fh * 0.5);
    ctx.lineTo(x + fw, top + fh * 0.85 - wave * 0.5);
    ctx.quadraticCurveTo(x + fw * 0.5, top + fh - wave, x, top + fh);
    ctx.closePath(); ctx.fill();
  },
  tassel(x, top, h, c, wave) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, top, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(x + i, top + 2);
      ctx.quadraticCurveTo(x + i * 2 + wave * 1.5, top + h * 0.3, x + i * 2.5 + wave * 2.5, top + h * 0.55); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  },
  square(x, top, h, c, wave) {
    const bw = h * 0.6, bh = h * 0.62, sway = wave * 0.6;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, top + 1); ctx.lineTo(x + bw, top + 1); ctx.stroke();
    poly([[x + 1, top + 1], [x + bw, top + 1], [x + bw + sway, top + bh], [x + bw / 2 + sway, top + bh * 0.8], [x + 1 + sway, top + bh]], c);
  },
  pennant(x, top, h, c, wave) {
    const fw = h * 1.0, fh = h * 0.32;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + fw * 0.5, top + fh * 0.3 + wave, x + fw, top + fh * 0.5 + wave * 1.4);
    ctx.quadraticCurveTo(x + fw * 0.5, top + fh * 0.75 + wave, x, top + fh);
    ctx.closePath(); ctx.fill();
  },
  streamer(x, top, h, c, wave, now) {
    ctx.strokeStyle = c; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, top + 1.5);
    const len = h * 1.1, ph = reduceMotion ? 0 : now / 220;
    for (let i = 1; i <= 10; i++) { const t = i / 10; ctx.lineTo(x + len * t, top + 1.5 + Math.sin(ph + t * 6) * 2.4 * t + t * 3); }
    ctx.stroke(); ctx.lineCap = 'butt';
  },
};

// `raise` runs from 0 (banner at the foot of the pole) to 1 (flying at the top).
function drawFlag(x, y, h, o, now, seed, raise = 1) {
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  if (!o || raise <= 0) return;
  const wave = reduceMotion ? 0 : Math.sin(now / 260 + seed) * 1.6;
  FLAG[army(o).flag](x, y - h + (1 - raise) * h * 0.7, h, col(o), wave * raise, now);
}

const CAPTURE_ANIM = 1.1;   // seconds for the old banner to lower and the new one to rise
// Which banner flies over a castle right now, and how high, during a capture.
function bannerState(p) {
  const t = G.time - (p.capturedAt ?? -99);
  if (reduceMotion || t >= CAPTURE_ANIM) return [p.owner, 1];
  const half = CAPTURE_ANIM * 0.45;
  if (t < half) return [p.prevOwner, 1 - t / half];
  return [p.owner, (t - half) / (CAPTURE_ANIM - half)];
}

function drawCastle(p, now) {
  const s = p.r, baseY = p.y + s * 0.55;
  const tier = s < 18 ? 1 : s < 26 ? 2 : 3;
  const c = col(p.owner);
  // Claimed land under the castle.
  ctx.beginPath(); ctx.ellipse(p.x, baseY - s * 0.1, s * 1.25, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = p.owner ? alpha(c, 0.3) : 'rgba(20,18,12,0.22)'; ctx.fill();
  if (p.owner) { ctx.strokeStyle = alpha(c, 0.75); ctx.lineWidth = 1.5; ctx.stroke(); }
  if (powerOn(p.owner, 'stoneOath')) {
    const pulse = reduceMotion ? 0.7 : 0.5 + 0.35 * Math.sin(now / 200);
    ctx.save(); ctx.translate(p.x, baseY - s * 0.6); ctx.scale(1, 0.9);
    ctx.beginPath(); ctx.arc(0, 0, s * 1.35, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = alpha(c, pulse); ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  }

  const style = p.owner ? army(p.owner).castle : G.theme.castle;
  const roofCol = p.owner ? army(p.owner).roof : '#6f6a5e';
  const glow = p.owner ? c : '#5a5468';
  const flags = CASTLE[style](p, s, baseY, tier, roofCol, glow);
  if (p.kind) drawKindDetail(p, s, baseY);
  const [flagOwner, raise] = bannerState(p);
  for (const [fx, fy] of flags) drawFlag(fx, fy, s * 0.6, flagOwner, now, p.id, raise);

  if (powerOn(p.owner, 'goldenTithe') && !reduceMotion) {
    for (let i = 0; i < 4; i++) {
      const t = (now / 900 + i * 0.25 + p.id * 0.13) % 1;
      ctx.fillStyle = alpha('#ffd75e', 1 - t);
      ctx.beginPath(); ctx.arc(p.x + Math.sin(i * 2.1 + p.id) * s * 0.7, baseY - s * 0.4 - t * s * 1.6, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Garrison plaque.
  const label = String(Math.floor(p.units));
  const fs = Math.max(11, s * 0.5);
  ctx.font = `800 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
  const tw = ctx.measureText(label).width + fs * 0.8, th = fs * 1.2, py = baseY + s * 0.22;
  ctx.fillStyle = p.owner ? c : PARCH;
  ctx.beginPath(); ctx.roundRect(p.x - tw / 2, py, tw, th, 3); ctx.fill();
  // A gold rim when the castle is full and has stopped training.
  const full = p.owner && p.units >= capOf(p) - 0.5;
  ctx.strokeStyle = full ? '#f3c64a' : INK; ctx.lineWidth = full ? 2 : 1; ctx.stroke();
  ctx.fillStyle = p.owner ? army(p.owner).plaqueText : INK;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, p.x, py + th / 2 + 1);
  // Upgrade pips under the plaque: stone blocks for Walls, gold blades for Barracks.
  const wl = lvl(p, 'walls'), bl = lvl(p, 'barracks');
  if (p.owner && (wl || bl)) {
    const ps = Math.max(4, s * 0.2), gap = 2, n = wl + bl;
    let x = p.x - (n * ps + (n - 1) * gap) / 2;
    const y = py + th + 2;
    for (let i = 0; i < wl; i++, x += ps + gap) {
      ctx.fillStyle = '#cfd4d8'; ctx.fillRect(x, y, ps, ps);
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, ps, ps);
    }
    for (let i = 0; i < bl; i++, x += ps + gap) {
      const tri = [[x, y + ps], [x + ps, y + ps], [x + ps / 2, y]];
      poly(tri, '#f3c64a');
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); tri.forEach(([tx, ty], i2) => i2 ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty)); ctx.closePath(); ctx.stroke();
    }
  }
  // Kind badge to the right of the plaque; the plaque itself and its left side stay unchanged.
  if (p.kind) drawKindBadge(p, p.x + tw / 2 + 3, py, th);
  // Hourglass beside the plaque when upkeep is slowing training: amber at half speed, red at a quarter.
  const up = p.owner ? upkeepOf(p) : 1;
  if (up < 1) {
    const hx = p.x + tw / 2 + 5 + (p.kind ? th + 3 : 0), hy = py + th / 2, hs = th * 0.38;
    ctx.fillStyle = up < 0.5 ? WARN : '#e9b43b';
    ctx.beginPath(); ctx.moveTo(hx - hs * 0.7, hy - hs); ctx.lineTo(hx + hs * 0.7, hy - hs); ctx.lineTo(hx, hy);
    ctx.lineTo(hx + hs * 0.7, hy + hs); ctx.lineTo(hx - hs * 0.7, hy + hs); ctx.lineTo(hx, hy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  }
}

// A village's reach, drawn faintly on the ground in its owner's colour.
function drawVillageAuras(now) {
  const R = CASTLE_KINDS.village.aura;
  for (const v of G.planets) {
    if (v.kind !== 'village' || !v.owner) continue;
    ctx.save(); ctx.translate(v.x, v.y + v.r * 0.4); ctx.scale(1, 0.62);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = alpha(col(v.owner), 0.05); ctx.fill();
    ctx.setLineDash([6, 8]); ctx.lineDashOffset = reduceMotion ? 0 : -now / 80;
    ctx.strokeStyle = alpha(col(v.owner), 0.35); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

// Ground-level detail that marks a castle's kind: an outer rampart, a ring of tents, or cottages.
function drawKindDetail(p, s, baseY) {
  if (p.kind === 'fortress') {
    const w = s * 2.5, h = s * 0.26, x = p.x - w / 2, y = baseY - h + s * 0.08;
    ctx.fillStyle = '#857e70'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + w * 0.6, y, w * 0.4, h);
    ctx.fillStyle = '#857e70'; crenels(x, y, w, Math.max(2, s * 0.1));
    ctx.fillStyle = INK; ctx.fillRect(p.x - s * 0.16, y + h * 0.15, s * 0.32, h * 0.85);
  } else if (p.kind === 'camp') {
    const band = p.owner ? col(p.owner) : '#8a7a5a';
    for (const dx of [-1.25, 1.25]) {
      const tx = p.x + dx * s, ty = baseY + s * 0.05, tw2 = s * 0.42, th2 = s * 0.42;
      poly([[tx - tw2, ty], [tx + tw2, ty], [tx, ty - th2]], '#e3d6b6');
      poly([[tx - tw2 * 0.45, ty - th2 * 0.45], [tx + tw2 * 0.45, ty - th2 * 0.45], [tx, ty - th2]], band);
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - th2 * 0.5); ctx.stroke();
    }
  } else if (p.kind === 'village') {
    const roof = p.owner ? army(p.owner).roof : '#7a5a3a';
    for (const [dx, dy, k] of [[-1.3, 0.05, 1], [1.25, 0.1, 0.85], [-0.95, 0.32, 0.75]]) {
      const hx = p.x + dx * s, hy = baseY + dy * s, hw = s * 0.36 * k, hh = s * 0.26 * k;
      ctx.fillStyle = '#d9c9a3'; ctx.fillRect(hx - hw / 2, hy - hh, hw, hh);
      poly([[hx - hw * 0.62, hy - hh], [hx + hw * 0.62, hy - hh], [hx, hy - hh - hw * 0.55]], roof);
      ctx.fillStyle = INK; ctx.fillRect(hx - hw * 0.1, hy - hh * 0.55, hw * 0.2, hh * 0.55);
    }
  }
}

// Small badge beside the garrison plaque naming the kind: a shield, crossed swords or a cottage.
function drawKindBadge(p, x, y, size) {
  ctx.fillStyle = PARCH; ctx.beginPath(); ctx.roundRect(x, y, size, size, 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
  const cx = x + size / 2, cy = y + size / 2, r = size * 0.32;
  ctx.fillStyle = INK; ctx.strokeStyle = INK;
  if (p.kind === 'fortress') {
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy - r); ctx.lineTo(cx + r, cy); ctx.quadraticCurveTo(cx + r, cy + r * 0.8, cx, cy + r * 1.15);
    ctx.quadraticCurveTo(cx - r, cy + r * 0.8, cx - r, cy); ctx.closePath(); ctx.fill();
  } else if (p.kind === 'camp') {
    ctx.lineWidth = size * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r, cy - r); ctx.moveTo(cx + r, cy + r); ctx.lineTo(cx - r, cy - r); ctx.stroke();
    ctx.lineCap = 'butt';
  } else if (p.kind === 'village') {
    ctx.beginPath(); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx - r, cy - r * 0.1); ctx.lineTo(cx, cy - r * 1.05); ctx.lineTo(cx + r, cy - r * 0.1); ctx.lineTo(cx + r, cy + r); ctx.closePath(); ctx.fill();
  } else {
    // A Siege Defense camp (js/defense.js): a war banner on a pole.
    ctx.fillRect(cx - r * 0.8, cy - r * 1.1, Math.max(1, size * 0.1), r * 2.2);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 1.1); ctx.lineTo(cx + r, cy - r * 0.6); ctx.lineTo(cx - r * 0.7, cy - r * 0.1); ctx.closePath(); ctx.fill();
  }
}

// Each army's soldier.
// A small white pennant with a stripe in the player's colour: this castle's kingdom has a truce with you.
function drawTruceMark(p) {
  const x = p.x + p.r * 0.95, y = p.y - p.r * 1.25;
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x, y - 2); ctx.stroke();
  poly([[x, y - 2], [x + 10, y + 1], [x, y + 4]], '#f6f1e2');
  ctx.strokeStyle = col(1); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 7, y + 1.2); ctx.stroke();
}

// A small wheeled catapult with its army's pennant; the arm rocks as it rolls.
function drawCatapult(x, y, o, dir, t) {
  const rock = reduceMotion ? 0 : Math.sin(t) * 0.15;
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 6, y - 2, 12, 3);
  ctx.strokeStyle = '#4a3019'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 1, y - 2); ctx.lineTo(x + 1, y - 7); ctx.lineTo(x + 3, y - 2); ctx.stroke();
  const ax = x + 1, ay = y - 7, a = -0.9 * dir + rock, len = 9;
  ctx.strokeStyle = '#8a6239'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(ax - Math.cos(a) * 3 * dir, ay + Math.sin(a) * 3); ctx.lineTo(ax + Math.cos(a) * len * dir, ay - Math.sin(Math.abs(a)) * len); ctx.stroke();
  ctx.fillStyle = '#4a3019'; ctx.beginPath(); ctx.arc(ax + Math.cos(a) * len * dir, ay - Math.sin(Math.abs(a)) * len, 1.6, 0, Math.PI * 2); ctx.fill();
  for (const wx of [x - 4, x + 4]) { ctx.fillStyle = '#3b2a19'; ctx.beginPath(); ctx.arc(wx, y + 1.5, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 5 * dir, y - 2); ctx.lineTo(x - 5 * dir, y - 9); ctx.stroke();
  poly([[x - 5 * dir, y - 9], [x - 5 * dir - 4 * dir, y - 8], [x - 5 * dir, y - 7]], col(o));
}

function soldier(x, y, o, t, dir, style) {
  const c = col(o), step = reduceMotion ? 0 : Math.sin(t);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
  if (style === 'rider') {
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y); ctx.lineTo(x - 2.5 + step * 1.5, y + 3);
    ctx.moveTo(x + 2.5, y); ctx.lineTo(x + 2.5 - step * 1.5, y + 3);
    ctx.stroke();
    ctx.fillStyle = '#6b4a2f'; ctx.beginPath(); ctx.ellipse(x, y - 1, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 4 * dir, y - 3, 1.6, 1.1, -0.6 * dir, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c; ctx.fillRect(x - 1.3, y - 6, 2.6, 3.6);
    ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(x, y - 7, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3 * dir, y - 3); ctx.lineTo(x + 5 * dir, y - 9); ctx.stroke();
    return;
  }
  // Legs.
  ctx.beginPath();
  ctx.moveTo(x, y - 1); ctx.lineTo(x - 1.4 * step, y + 2.6);
  ctx.moveTo(x, y - 1); ctx.lineTo(x + 1.4 * step, y + 2.6);
  ctx.stroke();
  if (style === 'hood') {
    poly([[x - 2.4, y + 1], [x + 2.4, y + 1], [x, y - 6.5]], c);
    poly([[x - 1.6, y - 4.6], [x + 1.6, y - 4.6], [x + 0.6 * dir, y - 8.6]], '#241f2d');
    ctx.fillStyle = '#c9a2ff'; ctx.fillRect(x + 0.3 * dir - 0.4, y - 6.2, 0.8, 0.8);
    return;
  }
  if (style === 'turban') {
    poly([[x - 2.2, y + 0.5], [x + 2.2, y + 0.5], [x + 1.2, y - 4.6], [x - 1.2, y - 4.6]], c);
    ctx.fillStyle = '#c8956a'; ctx.beginPath(); ctx.arc(x, y - 5.6, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3ead6'; ctx.beginPath(); ctx.ellipse(x, y - 6.6, 1.7, 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2 * dir, y + 1.5); ctx.lineTo(x + 2 * dir, y - 8.5); ctx.stroke();
    return;
  }
  ctx.fillStyle = c; ctx.fillRect(x - 1.5, y - 4.6, 3, 4);
  ctx.fillStyle = style === 'shield' ? '#e2c7a2' : '#e8c9a0'; ctx.beginPath(); ctx.arc(x, y - 5.8, 1.3, 0, Math.PI * 2); ctx.fill();
  if (style === 'shield') {
    ctx.fillStyle = '#9aa3ab'; ctx.fillRect(x - 1.4, y - 7.6, 2.8, 1);
    ctx.beginPath(); ctx.arc(x + 1.8 * dir, y - 2.6, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = army(o).roof; ctx.fill(); ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = 0.7; ctx.stroke();
    return;
  }
  ctx.fillStyle = '#9aa3ab'; ctx.fillRect(x - 1.4, y - 7.4, 2.8, 1.1);
  ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x + 2 * dir, y + 1.5); ctx.lineTo(x + 2 * dir, y - 7.5); ctx.stroke();
}

// Red banners over the player's castles that enemy troops are marching on.
// ---------- fog of war ----------
// A castle out of sight is drawn as the player last saw it: last known owner and garrison, no live
// capture animation. The fog layer drawn over the map then greys it.
function drawRemembered(p, now) {
  const k = knownOf(1, p);
  if (k === p) { drawCastle(p, now); return; }
  const keep = { owner: p.owner, units: p.units, capturedAt: p.capturedAt };
  p.owner = k.owner; p.units = k.units; p.capturedAt = -99;
  try { drawCastle(p, now); } finally { Object.assign(p, keep); }
}

// Darkens everything the player can't see, with soft edges round each castle's and column's sight.
const fogCv = document.createElement('canvas'), fogCtx = fogCv.getContext('2d');
function drawFog() {
  const src = G.sight[1];
  // Nothing to draw on a board with no size (a hidden or collapsed window).
  if (!src || !cv.width || !cv.height) return;
  if (fogCv.width !== cv.width || fogCv.height !== cv.height) { fogCv.width = cv.width; fogCv.height = cv.height; }
  const f = fogCtx;
  f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fogCv.width, fogCv.height);
  f.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
  f.globalCompositeOperation = 'source-over';
  f.fillStyle = 'rgba(14,12,22,0.55)'; f.fillRect(-40, -40, G.w + 80, G.h + 80);
  f.globalCompositeOperation = 'destination-out';
  for (const s of src) {
    const g = f.createRadialGradient(s.x, s.y, s.r * 0.7, s.x, s.y, s.r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g; f.beginPath(); f.arc(s.x, s.y, s.r, 0, Math.PI * 2); f.fill();
  }
  f.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fogCv, 0, 0); ctx.restore();
}

// Weather and night, drawn over the whole board. Particles are worked out from the clock, so they need
// no state; under reduced motion only the tints show.
const WEATHER_LOOK = {
  rain: { tint: '#4f6178', a: 0.16 }, dust: { tint: '#b08a50', a: 0.22 }, snow: { tint: '#eef4fa', a: 0.12 },
  heat: { tint: '#ff9f40', a: 0.09 }, mist: { tint: '#d6d6e4', a: 0.18 },
};
const hash01 = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
function drawWeather(now) {
  if (!G.weather) return;
  const night = nightAmt();
  if (night > 0) { ctx.fillStyle = `rgba(10,16,42,${(0.3 * night).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch); }
  const amt = weatherAmt();
  for (const [kind, a] of [[G.weather.prev, 1 - amt], [G.weather.kind, amt]]) {
    if (kind === 'clear' || a <= 0.01) continue;
    const L = WEATHER_LOOK[kind];
    ctx.fillStyle = alpha(L.tint, L.a * a); ctx.fillRect(0, 0, cw, ch);
    if (reduceMotion) continue;
    const area = cw * ch;
    if (kind === 'rain') {
      ctx.strokeStyle = `rgba(205,218,236,${0.45 * a})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0, n = Math.round(area / 7000); i < n; i++) {
        const y = (hash01(i, 1) * (ch + 40) + now * (0.6 + hash01(i, 3) * 0.3)) % (ch + 40) - 20;
        const x = (hash01(i, 2) * cw + y * 0.25) % cw;
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 11);
      }
      ctx.stroke();
    } else if (kind === 'snow') {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
      for (let i = 0, n = Math.round(area / 5500); i < n; i++) {
        const y = (hash01(i, 1) * ch + now * 0.035 * (0.6 + hash01(i, 3))) % ch;
        const x = (hash01(i, 2) * cw + Math.sin(now / 900 + i) * 12 + cw) % cw;
        ctx.beginPath(); ctx.arc(x, y, 0.9 + hash01(i, 4) * 1.4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'dust') {
      ctx.strokeStyle = `rgba(222,186,128,${0.4 * a})`; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0, n = Math.round(area / 9000); i < n; i++) {
        const x = (hash01(i, 2) * (cw + 80) + now * 0.32 * (0.7 + hash01(i, 3))) % (cw + 80) - 40;
        const y = hash01(i, 1) * ch + Math.sin(now / 500 + i) * 5;
        ctx.moveTo(x, y); ctx.lineTo(x - 16 - hash01(i, 4) * 10, y + 1.5);
      }
      ctx.stroke();
    } else if (kind === 'heat') {
      ctx.strokeStyle = `rgba(255,228,180,${0.12 * a})`; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const y0 = ((i + 0.5) / 7 * ch + now * 0.012) % ch;
        ctx.beginPath();
        for (let x = 0; x <= cw; x += 16) ctx.lineTo(x, y0 + Math.sin(x / 40 + now / 300 + i) * 3);
        ctx.stroke();
      }
    } else if (kind === 'mist') {
      ctx.fillStyle = `rgba(226,226,238,${0.11 * a})`;
      for (let i = 0; i < 9; i++) {
        const x = (hash01(i, 2) * (cw + 500) + now * 0.018 * (0.5 + hash01(i, 3))) % (cw + 500) - 250;
        const y = hash01(i, 1) * ch;
        ctx.beginPath(); ctx.ellipse(x, y, 240, 70, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// Red banners over kingdom `me`'s castles counting the enemy troops marching on them.
function drawThreats(now, me = 1) {
  const inc = incomingFor(me);
  for (const p of G.planets) {
    if (p.owner !== me) continue;
    const threat = inc[p.id].reduce((a, v, o) => o > 0 && o !== me ? a + v : a, 0);
    if (threat < 0.5) continue;
    const falls = threat > (p.units + inc[p.id][me]) * defAt(p);
    if (falls) {
      const pulse = reduceMotion ? 0.6 : 0.45 + 0.4 * Math.sin(now / 160);
      ctx.save(); ctx.translate(p.x, p.y + p.r * 0.45); ctx.scale(1, 0.5);
      ctx.beginPath(); ctx.arc(0, 0, p.r * 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(WARN, pulse); ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
    }
    const label = String(Math.ceil(threat)), fs = 12;
    ctx.font = `800 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
    const w = ctx.measureText(label).width + 24, h = 17, x = p.x - w / 2, y = p.y - p.r * 2.05 - h;
    ctx.fillStyle = falls ? WARN : alpha(WARN, 0.8);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(p.x + 4, y + h); ctx.lineTo(p.x, y + h + 5); ctx.lineTo(p.x - 4, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    const ix = x + 9, iy = y + h / 2;
    ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ix - 4, iy - 4); ctx.lineTo(ix + 4, iy + 4); ctx.moveTo(ix + 4, iy - 4); ctx.lineTo(ix - 4, iy + 4); ctx.stroke();
    ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 16, iy + 1);
  }
}

function drawTree(t, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(t.x + 2, t.y + t.s * 0.7, t.s, t.s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  if (kind === 'oak') {
    ctx.fillStyle = t.shade < 0.5 ? '#1f2c18' : '#26361d'; ctx.beginPath(); ctx.arc(t.x, t.y, t.s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,190,110,0.18)'; ctx.beginPath(); ctx.arc(t.x - t.s * 0.3, t.y - t.s * 0.35, t.s * 0.5, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'shrub') {
    const r = t.s * 0.55;
    ctx.fillStyle = t.shade < 0.5 ? '#4f4a24' : '#5c5a2a';
    ctx.beginPath(); ctx.arc(t.x - r * 0.6, t.y, r, 0, Math.PI * 2); ctx.arc(t.x + r * 0.6, t.y + 0.5, r * 0.85, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'pine') {
    const s = t.s * 1.2;
    poly([[t.x - s * 0.7, t.y + s * 0.5], [t.x + s * 0.7, t.y + s * 0.5], [t.x, t.y - s * 0.9]], t.shade < 0.5 ? '#24402f' : '#2c4a37');
    poly([[t.x - s * 0.5, t.y - s * 0.15], [t.x + s * 0.5, t.y - s * 0.15], [t.x, t.y - s * 1.4]], '#2f5040');
    poly([[t.x - s * 0.22, t.y - s * 0.95], [t.x + s * 0.22, t.y - s * 0.95], [t.x, t.y - s * 1.4]], '#f4f8fb');
  } else if (kind === 'palm') {
    ctx.strokeStyle = '#7a5a33'; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(t.x, t.y + t.s * 0.5); ctx.quadraticCurveTo(t.x + 2, t.y - t.s * 0.5, t.x + 1, t.y - t.s * 1.3); ctx.stroke();
    ctx.strokeStyle = t.shade < 0.5 ? '#3f6b2a' : '#4d7a30'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(t.x + 1, t.y - t.s * 1.3);
      ctx.quadraticCurveTo(t.x + 1 + Math.cos(a) * t.s * 0.8, t.y - t.s * 1.3 + Math.sin(a) * t.s * 0.5 - 2, t.x + 1 + Math.cos(a) * t.s * 1.2, t.y - t.s * 1.0 + Math.sin(a) * t.s * 0.4);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  } else {
    ctx.strokeStyle = '#100d16'; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(t.x, t.y + t.s * 0.5); ctx.lineTo(t.x, t.y - t.s * 1.2);
    ctx.moveTo(t.x, t.y - t.s * 0.4); ctx.lineTo(t.x - t.s * 0.6, t.y - t.s * 1.0);
    ctx.moveTo(t.x, t.y - t.s * 0.7); ctx.lineTo(t.x + t.s * 0.7, t.y - t.s * 1.2);
    ctx.moveTo(t.x - t.s * 0.6, t.y - t.s * 1.0); ctx.lineTo(t.x - t.s * 0.8, t.y - t.s * 1.4);
    ctx.stroke();
  }
}

// ---------- map unit drawing ----------
function drawUnitRange(u, now, color, valid = true) {
  const R = MAP_UNITS[u.type].range;
  ctx.beginPath(); ctx.arc(u.x, u.y, R, 0, Math.PI * 2);
  const pulse = u.type === 'ward' && !reduceMotion ? 0.06 + 0.03 * Math.sin(now / 500) : 0.05;
  ctx.fillStyle = alpha(color, valid ? pulse : 0.08); ctx.fill();
  ctx.setLineDash([6, 6]); ctx.strokeStyle = alpha(color, 0.55); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
}

function drawUnit(u, now) {
  const c = col(u.owner), x = u.x, y = u.y;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 1, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (u.type === 'ballista') {
    ctx.strokeStyle = '#5e3b20'; ctx.lineWidth = 2.2; ctx.beginPath();
    ctx.moveTo(x - 9, y); ctx.lineTo(x - 4, y - 12); ctx.moveTo(x + 9, y); ctx.lineTo(x + 4, y - 12); ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 6, y - 5); ctx.stroke();
    ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 10, y - 15, 20, 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 9, y - 15); ctx.lineTo(x + 9, y - 27); ctx.stroke();
    poly([[x + 9, y - 27], [x + 17, y - 24.5], [x + 9, y - 22]], c);
    ctx.save(); ctx.translate(x, y - 17); ctx.rotate(u.aim || 0);
    ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(1, 0, 7, -1.25, 1.25); ctx.stroke();
    ctx.strokeStyle = '#d8cfb8'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(1 + Math.cos(-1.25) * 7, Math.sin(-1.25) * 7); ctx.lineTo(-3, 0); ctx.lineTo(1 + Math.cos(1.25) * 7, Math.sin(1.25) * 7); ctx.stroke();
    ctx.restore();
  } else if (u.type === 'trebuchet') {
    ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 15, y - 4, 30, 4);
    ctx.strokeStyle = '#68431f'; ctx.lineWidth = 2.6; ctx.beginPath();
    ctx.moveTo(x - 10, y - 3); ctx.lineTo(x, y - 25); ctx.lineTo(x + 10, y - 3); ctx.stroke();
    // The arm rests pointing down-right, whips over the top when it fires, then settles back.
    const since = G.time - u.fired, rest = 0.85, fired = -2.3;
    const ang = since < 0.35 ? rest + (fired - rest) * (since / 0.35) : since < 1.8 ? fired + (rest - fired) * ((since - 0.35) / 1.45) : rest;
    const px = x, py = y - 25, lx = px + Math.cos(ang) * 24, ly = py + Math.sin(ang) * 24, sx = px - Math.cos(ang) * 8, sy = py - Math.sin(ang) * 8;
    ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = c; ctx.fillRect(sx - 4, sy - 1, 8, 7);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(sx - 4, sy - 1, 8, 7);
    if (since > 1.8 || since < 0) { ctx.fillStyle = '#6b6458'; ctx.beginPath(); ctx.arc(lx, ly + 2, 2.6, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const glow = reduceMotion ? 0.8 : 0.55 + 0.4 * Math.sin(now / 400);
    ctx.fillStyle = '#8f897d';
    ctx.beginPath(); ctx.roundRect(x - 15, y - 13, 5, 13, [2, 2, 0, 0]); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + 10, y - 12, 5, 12, [2, 2, 0, 0]); ctx.fill();
    poly([[x - 5, y], [x - 3.5, y - 24], [x, y - 29], [x + 3.5, y - 24], [x + 5, y]], '#7d776c');
    shadeRight(x - 5, y - 26, 10, 26, 0.12);
    ctx.fillStyle = alpha(c, glow * 0.45); ctx.beginPath(); ctx.arc(x, y - 16, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - 16, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = alpha(c, glow); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 10); ctx.moveTo(x - 3, y - 16); ctx.lineTo(x + 3, y - 16); ctx.stroke();
  }
}

function drawShots() {
  for (const sh of G.shots) {
    if (G.cfg.fog && !G.cfg.demo && !seesAt(1, sh.t.x, sh.t.y) && !seesAt(1, sh.u.x, sh.u.y)) continue;
    const t = Math.min(1, sh.age / sh.dur);
    const x0 = sh.u.x, y0 = sh.u.y - 26, x1 = sh.t.x, y1 = sh.t.y - sh.t.r * 0.6;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * 80;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x0 + (x1 - x0) * t, sh.u.y + (sh.t.y - sh.u.y) * t, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b6458'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlacement(now) {
  if (!G.placing || !ptr.placeHover) return;
  const ghost = { owner: 1, type: G.placing, x: ptr.wx, y: ptr.wy, aim: 0, fired: -9 };
  const problem = placeProblem(1, ptr.wx, ptr.wy);
  drawUnitRange(ghost, now, problem ? WARN : col(1), !problem);
  ctx.globalAlpha = problem ? 0.45 : 0.8; drawUnit(ghost, now); ctx.globalAlpha = 1;
  if (problem) {
    const fs = 12 / sc;
    ctx.font = `700 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
    const w = ctx.measureText(problem).width + fs, lx = ptr.wx - w / 2, ly = ptr.wy + 10 / sc;
    ctx.fillStyle = alpha(TIMBER, 0.88); ctx.beginPath(); ctx.roundRect(lx, ly, w, fs * 1.6, 3 / sc); ctx.fill();
    ctx.fillStyle = '#ffb3ad'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(problem, ptr.wx, ly + fs * 0.85);
  }
}

function rallyArrow(a, bx, by, color, now) {
  const ang = Math.atan2(by - a.y, bx - a.x), len = Math.hypot(bx - a.x, by - a.y);
  const x0 = a.x + Math.cos(ang) * a.r, y0 = a.y + Math.sin(ang) * a.r, x1 = a.x + Math.cos(ang) * (len - 14), y1 = a.y + Math.sin(ang) * (len - 14);
  const head = [[x1 + Math.cos(ang) * 7, y1 + Math.sin(ang) * 7], [x1 + Math.cos(ang + 2.5) * 7, y1 + Math.sin(ang + 2.5) * 7], [x1 + Math.cos(ang - 2.5) * 7, y1 + Math.sin(ang - 2.5) * 7]];
  // A wider pass in the map's contrast colour first, so gold arrows still read on desert sand and teal on snow.
  const outline = color === G.theme.ring ? (G.theme.ring === INK ? PARCH : INK) : G.theme.ring;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineDashOffset = reduceMotion ? 0 : -now / 60;
  for (const [c, w] of [[alpha(outline, 0.6), 5], [alpha(color, 0.9), 2.2]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.strokeStyle = alpha(outline, 0.6); ctx.lineWidth = 3;
  ctx.beginPath(); head.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
  poly(head, alpha(color, 0.95));
  ctx.lineCap = 'butt';
}
function drawRallies(now) {
  for (const p of G.planets) if (p.rally && p.owner === 1) rallyArrow(p, p.rally.x, p.rally.y, col(1), now);
  if (rallyDrag.from) {
    const h = ptr.hover && ptr.hover.owner === 1 && ptr.hover !== rallyDrag.from ? ptr.hover : null;
    rallyArrow(rallyDrag.from, h ? h.x : ptr.wx, h ? h.y : ptr.wy, G.theme.ring, now);
    const msg = h ? 'Rally here' : 'Release on one of your castles';
    const fs = 12 / sc;
    ctx.font = `700 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
    const w = ctx.measureText(msg).width + fs, lx = ptr.wx + 14 / sc, ly = ptr.wy - 26 / sc;
    ctx.fillStyle = alpha(TIMBER, 0.85); ctx.beginPath(); ctx.roundRect(lx, ly, w, fs * 1.6, 3 / sc); ctx.fill();
    ctx.fillStyle = PARCH; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(msg, lx + fs / 2, ly + fs * 0.85);
  }
}

// A plank bridge laid across the river.
function drawBridge(b) {
  const len = RIVER_W + 16, wid = 12, ang = Math.atan2(b.tx, -b.ty);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-len / 2 + 1.5, -wid / 2 + 2, len, wid);
  ctx.fillStyle = G.theme.bridge || '#8a6239'; ctx.fillRect(-len / 2, -wid / 2, len, wid);
  ctx.strokeStyle = G.theme.bridge ? 'rgba(0,0,0,0.35)' : '#5e3f22'; ctx.lineWidth = 1;
  for (let x = -len / 2 + 3; x < len / 2; x += 4) { ctx.beginPath(); ctx.moveTo(x, -wid / 2); ctx.lineTo(x, wid / 2); ctx.stroke(); }
  ctx.strokeStyle = '#4a3019'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-len / 2, -wid / 2); ctx.lineTo(len / 2, -wid / 2); ctx.moveTo(-len / 2, wid / 2); ctx.lineTo(len / 2, wid / 2); ctx.stroke();
  ctx.restore();
}

function drawScenery(now) {
  const T = G.theme;
  ctx.fillStyle = T.field; ctx.fillRect(0, 0, G.w, G.h);
  ctx.fillStyle = T.lit;
  for (const m of G.meadows) { ctx.beginPath(); ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2); ctx.fill(); }
  const TR = G.terrain;
  for (const f of TR.forests) {
    ctx.fillStyle = alpha(T.wood, 0.45); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const o of G.pools) {
    if (T.lava) {
      // A glowing fissure: a dark crack with molten rock showing through.
      const glow = reduceMotion ? 0.8 : 0.65 + 0.2 * Math.sin(now / 600 + o.x);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.rx * 1.15, o.ry * 1.3, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = alpha(T.pool, glow); ctx.beginPath(); ctx.ellipse(o.x, o.y, o.rx, o.ry * 0.8, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,230,120,${glow * 0.6})`; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.rx * 0.5, o.ry * 0.3, 0.4, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = T.pool; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(o.x, o.y, o.rx * 0.95, o.ry * 0.9, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, c] of [[RIVER_W + 7, T.bank], [RIVER_W, T.water]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    for (const r of TR.rivers) { ctx.beginPath(); r.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); }
    if (TR.lake) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(TR.lake.x, TR.lake.y, TR.lake.r + (w - RIVER_W) / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
  for (const r of TR.rivers) { ctx.beginPath(); r.forEach((q, i) => i ? ctx.lineTo(q.x + 2, q.y - 2) : ctx.moveTo(q.x + 2, q.y - 2)); ctx.stroke(); }
  for (const [w, a] of [[9, 0.25], [5, 0.55]]) {
    ctx.strokeStyle = alpha(T.road, a); ctx.lineWidth = w;
    for (const r of G.roads) { ctx.beginPath(); r.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); }
  }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  for (const b of TR.bridges) drawBridge(b);
  for (const r of G.rocks) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(r.x + 1, r.y + r.s * 0.4, r.s, r.s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b8577'; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.s, r.s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (G.monster && typeof drawMonsterGround === 'function') drawMonsterGround(now);
  for (const t of G.trees) drawTree(t, T.tree);
  if ((T.tree === 'dead' && !T.sky || T.sky === 'fog') && !reduceMotion) {
    // Drifting marsh fog, or the fog banks of the fells.
    const n = T.sky === 'fog' ? Math.ceil(G.h / 120) : 5, tint = T.sky === 'fog' ? 'rgba(220,230,228,0.07)' : 'rgba(190,170,220,0.05)';
    for (let i = 0; i < n; i++) {
      const x = ((now / 60 + i * 260) % (G.w + 300)) - 150, y = (i * 137) % G.h;
      ctx.fillStyle = tint; ctx.beginPath(); ctx.ellipse(x, y, 160, 40, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (T.sky === 'embers' && !reduceMotion) {
    // Drifting embers rising off the badlands.
    const n = Math.ceil(G.w * G.h / 60000);
    for (let i = 0; i < n; i++) {
      const t = (now / 2400 + i * 0.37) % 1, x = ((i * 977) % G.w) + Math.sin(now / 700 + i) * 20, y = G.h - t * G.h;
      ctx.fillStyle = `rgba(255,${120 + (i % 4) * 25},40,${0.7 * (1 - t)})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCrows(f, now) {
  const t = f.age / 2.6;
  for (let i = 0; i < 9; i++) {
    const a = now / 300 + i * (Math.PI * 2 / 9), r = f.r * (1.4 - t * 0.6);
    const x = f.x + Math.cos(a) * r, y = f.y - f.r * 0.8 + Math.sin(a) * r * 0.5;
    const flap = Math.sin(now / 60 + i) * 2;
    ctx.strokeStyle = `rgba(10,8,14,${1 - t * 0.7})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - 3, y - flap); ctx.lineTo(x, y); ctx.lineTo(x + 3, y - flap); ctx.stroke();
  }
}

function draw(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = G ? G.theme.bg : TIMBER; ctx.fillRect(0, 0, cw, ch);
  if (!G) return;
  let shakeX = 0, shakeY = 0;
  if (G.shake && G.time < G.shake.until) {
    const k = (G.shake.until - G.time) / 0.35 * G.shake.mag;
    shakeX = (Math.random() - 0.5) * 2 * k; shakeY = (Math.random() - 0.5) * 2 * k;
  }
  ctx.translate(ox + shakeX, oy + shakeY); ctx.scale(sc, sc);
  drawScenery(now);
  for (const u of G.units) drawUnitRange(u, now, col(u.owner));
  drawRallies(now);
  drawVillageAuras(now);
  const spin = reduceMotion ? 0 : now / 1100;
  const ring = G.theme.ring;

  if (ptr.down && ptr.moved && sel.size) {
    ctx.strokeStyle = alpha(ring, 0.8); ctx.lineWidth = 2 / sc; ctx.setLineDash([7 / sc, 6 / sc]);
    const tx = ptr.hover ? ptr.hover.x : ptr.wx, ty = ptr.hover ? ptr.hover.y : ptr.wy;
    // Aiming at a castle shows the route each column will actually march.
    for (const s of sel) {
      if (s === ptr.hover) continue;
      ctx.beginPath(); ctx.moveTo(s.x, s.y);
      if (ptr.hover) for (const q of pathOf(s, ptr.hover).pts) ctx.lineTo(q.x, q.y);
      else ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    let troops = 0;
    for (const s of sel) if (s !== ptr.hover) troops += Math.floor(s.units * sendPct);
    const msg = `${Math.round(sendPct * 100)}% · ${troops}${unitType !== 'foot' ? ' · ' + UNIT_TYPES[unitType].name : ''}`;
    const fs = 13 / sc;
    ctx.font = `800 ${fs}px "Alegreya Sans", system-ui, sans-serif`;
    const lw = ctx.measureText(msg).width + fs, lx = ptr.wx + 14 / sc, ly = ptr.wy - 26 / sc;
    ctx.fillStyle = alpha(TIMBER, 0.85); ctx.beginPath(); ctx.roundRect(lx, ly, lw, fs * 1.6, 3 / sc); ctx.fill();
    ctx.fillStyle = PARCH; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, lx + fs / 2, ly + fs * 0.85);
  }

  for (const p of G.planets) {
    const targeted = ptr.down && ptr.moved && sel.size && ptr.hover === p && !sel.has(p);
    if (!sel.has(p) && !targeted) continue;
    ctx.save(); ctx.translate(p.x, p.y + p.r * 0.45); ctx.scale(1, 0.5); ctx.rotate(spin);
    ctx.setLineDash(sel.has(p) ? [8, 6] : []); ctx.strokeStyle = ring; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 1.45, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  // Castles and troops back to front so nearer things overlap farther ones.
  const items = G.planets.map(p => ({ y: p.y + p.r * 0.55, p }));
  // Under fog, enemy columns out of sight aren't drawn.
  for (const k of G.packets) if (k.delay <= 0 && (k.owner === 1 || G.cfg.demo || seesAt(1, k.x, k.y))) items.push({ y: k.y, k });
  for (const u of G.units) items.push({ y: u.y, u });
  if (G.monster) for (const m of G.monster.creatures) if (!m.dead && (G.cfg.demo || seesAt(1, m.x, m.y))) items.push({ y: m.y + 8, m });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.u) { drawUnit(it.u, now); continue; }
    if (it.m) { drawMonster(it.m, now); continue; }
    if (it.p) { if (G.cfg.fog && !G.cfg.demo) drawRemembered(it.p, now); else drawCastle(it.p, now); if (!G.cfg.demo && allied(1, it.p.owner)) drawTruceMark(it.p); continue; }
    const k = it.k, dir = k.dir || 1, isFrozen = frozen(k.owner);
    if (k.type === 'siege') { drawCatapult(k.x, k.y, k.owner, dir, isFrozen ? 0 : now / 140 + k.phase); if (isFrozen) { ctx.fillStyle = 'rgba(210,235,255,0.45)'; ctx.beginPath(); ctx.ellipse(k.x, k.y - 4, 10, 8, 0, 0, Math.PI * 2); ctx.fill(); } continue; }
    const style = k.type === 'horse' ? 'rider' : army(k.owner).soldier;
    const figures = Math.min(Math.ceil(k.n), 3);
    if (powerOn(k.owner, 'bloodMoon')) {
      ctx.strokeStyle = alpha(col(k.owner), 0.45); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(k.x - dir * 4, k.y - 2); ctx.lineTo(k.x - dir * 16, k.y - 2); ctx.stroke();
    }
    for (let i = 0; i < figures; i++) {
      const fx = k.x + (i - (figures - 1) / 2) * 4.6, fy = k.y + (i % 2) * 2.5;
      soldier(fx, fy, k.owner, isFrozen ? 0 : now / 90 + k.phase + i, dir, style);
      // A gold crest on soldiers from upgraded barracks.
      if ((k.str || 1) > 1) { const cy = fy - (style === 'rider' ? 8.3 : 7.2); poly([[fx - 1.4, cy], [fx + 1.4, cy], [fx, cy - 2.6]], '#f3c64a'); }
    }
    if (isFrozen) { ctx.fillStyle = 'rgba(210,235,255,0.45)'; ctx.beginPath(); ctx.ellipse(k.x, k.y - 3, 8, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  if (G.monster) drawMonsterBars(now);
  if (!G.cfg.demo) drawThreats(now);
  if (G.cfg.fog && !G.cfg.demo) drawFog();
  drawShots();
  drawPlacement(now);

  for (const f of G.fx) {
    if (MONSTER_FX[f.kind]) { drawMonsterFx(f, now); continue; }
    if (f.kind === 'clash') {
      const t = f.age / 0.35;
      ctx.strokeStyle = alpha('#fff3d0', 1 - t); ctx.lineWidth = 1.2;
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 2 + 0.6, r1 = 2 + t * 3, r2 = 4 + t * 6;
        ctx.beginPath(); ctx.moveTo(f.x + Math.cos(ang) * r1, f.y - 4 + Math.sin(ang) * r1); ctx.lineTo(f.x + Math.cos(ang) * r2, f.y - 4 + Math.sin(ang) * r2); ctx.stroke();
      }
    } else if (f.kind === 'arrow') {
      // A short arrow streaking from the walls to the column.
      const t = Math.min(1, f.age / 0.18), hx = f.x + (f.x1 - f.x) * t, hy = f.y + (f.y1 - f.y) * t;
      const ang = Math.atan2(f.y1 - f.y, f.x1 - f.x);
      ctx.strokeStyle = alpha('#f3e6c0', 1 - f.age / 0.3); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx - Math.cos(ang) * 7, hy - Math.sin(ang) * 7); ctx.lineTo(hx, hy); ctx.stroke();
    } else if (f.kind === 'upgrade') {
      const t = f.age / 0.8;
      ctx.strokeStyle = alpha(f.col, 1 - t); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y - f.r * 0.4 - t * 16, f.r * (0.6 + t * 0.5), Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (f.kind === 'bolt') {
      ctx.strokeStyle = alpha('#f3e6c0', 1 - f.age / 0.2); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x1, f.y1); ctx.stroke();
    } else if (f.kind === 'impact') {
      const t = f.age / 0.6;
      ctx.save(); ctx.translate(f.x, f.y + f.r * 0.4); ctx.scale(1, 0.5);
      ctx.beginPath(); ctx.arc(0, 0, f.r * 0.8 + t * 26, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120,100,70,${0.45 * (1 - t)})`; ctx.fill(); ctx.restore();
      ctx.fillStyle = `rgba(90,80,64,${1 - t})`;
      for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.fillRect(f.x + Math.cos(a) * (6 + t * 16), f.y - 6 + Math.sin(a) * (4 + t * 10) - t * 6, 2, 2); }
    } else if (f.kind === 'dust') {
      const t = f.age / 0.9;
      ctx.fillStyle = alpha(G.theme.dust, 0.7 * (1 - t));
      ctx.beginPath(); ctx.arc(f.x, f.y, f.s * (1 + t * 1.6), 0, Math.PI * 2); ctx.fill();
    } else if (f.kind === 'crows') {
      drawCrows(f, now);
    } else {
      const t = f.age / 0.9;
      ctx.save(); ctx.translate(f.x, f.y + f.r * 0.45); ctx.scale(1, 0.5);
      ctx.beginPath(); ctx.arc(0, 0, f.r * 1.3 + t * 40, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(f.col, 1 - t); ctx.lineWidth = 6 * (1 - t) + 1; ctx.stroke(); ctx.restore();
    }
  }

  // Map-wide tints while a power is active.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWeather(now);
  for (const o of G.owners) {
    const id = army(o).power.id;
    if (!powerOn(o, id)) continue;
    if (id === 'bloodMoon') { ctx.fillStyle = 'rgba(160,20,20,0.10)'; ctx.fillRect(0, 0, cw, ch); }
    if (id === 'wintersGrip') {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      g.addColorStop(0, 'rgba(220,240,255,0)'); g.addColorStop(1, 'rgba(220,240,255,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
  }

  // The Grand Campaign's orders panel explains its own dragging, and on phones would cover this (#60).
  if (!G.cfg.demo && !G.hintDone && G.mode !== 'grand') {
    const msg = 'Drag from a castle flying your banner onto another castle to attack';
    ctx.font = '500 14px "Alegreya Sans", system-ui, sans-serif';
    // On phones the treasury and objective badge sit along the bottom edge, so the hint goes above them,
    // to the right of the touch thumb bar, wrapped onto two lines when it doesn't fit (#57).
    const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 560px)').matches;
    const thumbs = narrow && typeof document !== 'undefined' && document.body && document.body.classList.contains('touchui');
    const x0 = thumbs ? 112 : 16, room = cw - x0 - 16, cx = x0 + room / 2;
    let lines = [msg];
    if (ctx.measureText(msg).width + 24 > room) {
      const words = msg.split(' '), half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
    }
    const w = Math.min(room, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24), h = 12 + 18 * lines.length;
    const y = ch - (narrow ? 100 : 14) - h;
    ctx.fillStyle = alpha(TIMBER, 0.82); ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, 4); ctx.fill();
    ctx.fillStyle = '#ece2c6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, cx, y + 15 + 18 * i, room - 16));
  }
}
