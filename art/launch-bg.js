// Launch page background: a dusk valley with the five homelands' castles on the skyline.
// Pure Canvas 2D, seeded, so it renders identically in the browser (launch-bg.html) and in
// Node (tools/render-art.js). paint(ctx, W, H) draws the whole picture at any size.

(function (root) {
  const ARMY = {
    frostmark: { color: '#36c2b4', roof: '#1f7f75' },
    aldmere:   { color: '#4f8ff0', roof: '#2f5ea8' },
    solmara:   { color: '#e9b43b', roof: '#c08a1c' },
    kharzul:   { color: '#d9443e', roof: '#a8322d' },
    nyx:       { color: '#a46ae0', roof: '#5b3a85' },
  };

  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
  const mix = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = i => Math.round(((pa >> i) & 255) * (1 - t) + ((pb >> i) & 255) * t);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  };

  function paint(ctx, W, H) {
    const rnd = mulberry(20261009);
    const u = H / 1080;                       // scale unit: the picture is designed at 1920×1080
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };

    // ---- sky ----
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#120f22'); sky.addColorStop(0.45, '#3a2a4e'); sky.addColorStop(0.78, '#8a4b4a'); sky.addColorStop(1, '#d08a4a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 320; i++) {
      const x = rnd() * W, y = rnd() * H * 0.42, r = rnd() * 1.4 * u + 0.3;
      ctx.fillStyle = `rgba(255,240,220,${0.25 + rnd() * 0.6 * (1 - y / (H * 0.42))})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Moon, faintly blood-tinted, with a wide glow.
    const mx = W * 0.72, my = H * 0.2, mr = 78 * u;
    const glow = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
    glow.addColorStop(0, 'rgba(255,200,170,0.35)'); glow.addColorStop(0.4, 'rgba(255,160,130,0.12)'); glow.addColorStop(1, 'rgba(255,160,130,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const moon = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, '#fff1e0'); moon.addColorStop(0.7, '#f0c9a8'); moon.addColorStop(1, '#d99a82');
    ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,100,90,0.18)';
    for (const [dx, dy, r] of [[-0.3, 0.1, 0.22], [0.25, -0.2, 0.15], [0.1, 0.4, 0.12], [0.45, 0.25, 0.09]]) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); ctx.fill(); }
    // Clouds: long soft bands lit from below.
    for (let i = 0; i < 9; i++) {
      const y = H * (0.18 + rnd() * 0.3), x = rnd() * W, w = (260 + rnd() * 420) * u, h = (14 + rnd() * 22) * u;
      const g = ctx.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, 'rgba(70,50,80,0.55)'); g.addColorStop(1, 'rgba(230,150,110,0.5)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ---- far mountains ----
    const ridge = (yBase, amp, col, seedShift, peaks) => {
      const pts = [[0, H]];
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W;
        let y = yBase - Math.abs(Math.sin(i * 1.7 + seedShift)) * amp - rnd() * amp * 0.5;
        if (peaks && peaks.includes(i)) y -= amp * 0.9;
        pts.push([x, y]);
      }
      pts.push([W, H]);
      poly(pts, col);
      return pts;
    };
    ridge(H * 0.6, 150 * u, '#5b4a6a', 0.3, [19]);
    // An ember on the tallest peak: the dragon's lair.
    const lair = ctx.createRadialGradient(W * 0.68, H * 0.6 - 215 * u, 2, W * 0.68, H * 0.6 - 215 * u, 60 * u);
    lair.addColorStop(0, 'rgba(255,140,60,0.9)'); lair.addColorStop(0.3, 'rgba(255,100,40,0.35)'); lair.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = lair; ctx.fillRect(W * 0.6, H * 0.4, W * 0.16, H * 0.3);
    ridge(H * 0.64, 110 * u, '#453a55', 2.1);
    // Haze between mountains and hills.
    const haze = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.7);
    haze.addColorStop(0, 'rgba(210,140,110,0)'); haze.addColorStop(1, 'rgba(210,140,110,0.35)');
    ctx.fillStyle = haze; ctx.fillRect(0, H * 0.5, W, H * 0.2);

    // ---- hills (back to front), each a smooth curve ----
    const hill = (yBase, amp, freq, phase, col) => {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8 * u) ctx.lineTo(x, yBase + Math.sin(x / W * freq + phase) * amp + Math.sin(x / W * freq * 2.7 + phase * 1.3) * amp * 0.35);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    };
    hill(H * 0.69, 26 * u, 5.5, 0.4, '#3f5a3a');
    hill(H * 0.74, 30 * u, 4.2, 2.2, '#36502f');

    // ---- river: a winding band that comes out from behind the far hills and widens toward the viewer ----
    // Drawn as a filled ribbon around a bezier centreline, in two reaches: a narrow one between the
    // middle hills, and a broad one in front of the near hill that runs down to the tree line.
    const bez = (p0, p1, p2, p3, t) => {
      const k = 1 - t;
      return [k * k * k * p0[0] + 3 * k * k * t * p1[0] + 3 * k * t * t * p2[0] + t * t * t * p3[0],
              k * k * k * p0[1] + 3 * k * k * t * p1[1] + 3 * k * t * t * p2[1] + t * t * t * p3[1]];
    };
    const ribbon = (p0, p1, p2, p3, w0, w1, fill, highlight) => {
      const left = [], right = [], n = 40;
      for (let i = 0; i <= n; i++) {
        const t = i / n, [x, y] = bez(p0, p1, p2, p3, t), [x2, y2] = bez(p0, p1, p2, p3, Math.min(1, t + 0.01));
        const dx = x2 - x, dy = y2 - y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        const w = (w0 + (w1 - w0) * t) / 2;
        left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
      }
      poly([...left, ...right.reverse()], fill);
      ctx.strokeStyle = highlight; ctx.lineWidth = Math.max(1.2 * u, w0 * 0.25); ctx.lineCap = 'round';
      ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = bez(p0, p1, p2, p3, i / n); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    };
    const water = ctx.createLinearGradient(0, H * 0.7, 0, H);
    water.addColorStop(0, 'rgba(236,170,132,0.85)'); water.addColorStop(1, 'rgba(120,110,140,0.95)');
    ribbon([W * 0.52, H * 0.705], [W * 0.46, H * 0.74], [W * 0.56, H * 0.77], [W * 0.5, H * 0.805], 5 * u, 16 * u, water, 'rgba(255,235,210,0.7)');

    hill(H * 0.8, 34 * u, 3.1, 4.0, '#2b4226');
    ribbon([W * 0.5, H * 0.795], [W * 0.44, H * 0.84], [W * 0.5, H * 0.9], [W * 0.41, H * 0.975], 16 * u, 95 * u, water, 'rgba(255,225,195,0.5)');
    // Moonlight glitter on the broad reach.
    for (let i = 0; i < 60; i++) {
      const t = rnd(), [x, y] = bez([W * 0.5, H * 0.795], [W * 0.44, H * 0.84], [W * 0.5, H * 0.9], [W * 0.41, H * 0.975], t);
      const w = (16 + 79 * t) * u * 0.42;
      ctx.fillStyle = `rgba(255,240,215,${0.15 + rnd() * 0.35})`;
      ctx.fillRect(x + (rnd() - 0.5) * w * 2, y + (rnd() - 0.5) * 3 * u, (3 + rnd() * 8) * u, 1.2 * u);
    }

    // ---- roads between the castles ----
    ctx.strokeStyle = 'rgba(200,170,120,0.35)'; ctx.lineWidth = 3 * u; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(W * 0.1, H * 0.76); ctx.quadraticCurveTo(W * 0.3, H * 0.69, W * 0.35, H * 0.715); ctx.quadraticCurveTo(W * 0.5, H * 0.75, W * 0.62, H * 0.7); ctx.quadraticCurveTo(W * 0.78, H * 0.66, W * 0.9, H * 0.72); ctx.stroke();

    // ---- castles ----
    const castles = [
      { id: 'frostmark', x: W * 0.1,  y: H * 0.735, s: 44 * u, draw: longhouse },
      { id: 'aldmere',   x: W * 0.35, y: H * 0.705, s: 60 * u, draw: stone },
      { id: 'solmara',   x: W * 0.62, y: H * 0.69,  s: 50 * u, draw: domes },
      { id: 'kharzul',   x: W * 0.9,  y: H * 0.715, s: 46 * u, draw: palisade },
      { id: 'nyx',       x: W * 0.78, y: H * 0.655, s: 40 * u, draw: spires },
    ];
    castles.sort((a, b) => a.y - b.y);
    for (const c of castles) {
      // Hilltop under each castle.
      ctx.fillStyle = c.id === 'frostmark' ? '#8fa6a8' : '#3a5633';
      ctx.beginPath(); ctx.ellipse(c.x, c.y + c.s * 0.05, c.s * 2.2, c.s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      c.draw(ctx, c.x, c.y, c.s, ARMY[c.id], u, rnd);
    }

    // ---- marching columns along the road ----
    const march = (x0, y0, x1, y1, col, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(i) * 1.5 * u;
        ctx.fillStyle = col; ctx.fillRect(x, y - 4 * u, 2 * u, 4 * u);
        ctx.fillStyle = '#1a1410'; ctx.fillRect(x + 1.5 * u, y - 7 * u, 0.8 * u, 7 * u);
      }
    };
    march(W * 0.17, H * 0.745, W * 0.29, H * 0.705, ARMY.frostmark.color, 14);
    march(W * 0.56, H * 0.73, W * 0.44, H * 0.74, ARMY.solmara.color, 11);
    march(W * 0.84, H * 0.695, W * 0.7, H * 0.68, ARMY.kharzul.color, 16);

    // ---- foreground: tree line, a ridge, and a great banner ----
    hill(H * 0.9, 24 * u, 2.4, 1.1, '#1d2e1a');
    const tree = (x, y, s, kind) => {
      if (kind === 'pine') { poly([[x - s * 0.5, y], [x + s * 0.5, y], [x, y - s * 1.6]], '#141f12'); poly([[x - s * 0.35, y - s * 0.7], [x + s * 0.35, y - s * 0.7], [x, y - s * 1.9]], '#141f12'); }
      else { ctx.fillStyle = '#141f12'; ctx.beginPath(); ctx.arc(x, y - s * 0.8, s * 0.7, 0, Math.PI * 2); ctx.arc(x - s * 0.4, y - s * 0.5, s * 0.5, 0, Math.PI * 2); ctx.arc(x + s * 0.4, y - s * 0.55, s * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - s * 0.08, y - s * 0.6, s * 0.16, s * 0.6); }
    };
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W, y = H * (0.86 + rnd() * 0.12), s = (26 + rnd() * 34) * u;
      if (x > W * 0.3 && x < W * 0.62 && y < H * 0.97) continue; // keep the river mouth open
      tree(x, y, s, rnd() < 0.45 ? 'pine' : 'oak');
    }
    poly([[0, H], [0, H * 0.95], [W * 0.18, H * 0.93], [W * 0.3, H * 0.985], [W * 0.5, H * 0.97], [W * 0.72, H * 0.99], [W, H * 0.955], [W, H]], '#10190f');
    // The banner: a tall pole at the left with a swallow-tailed flag catching the last light.
    const bx = W * 0.15, by = H * 0.985, bh = 300 * u;
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - bh); ctx.stroke();
    ctx.fillStyle = '#e9b43b'; ctx.beginPath(); ctx.arc(bx, by - bh - 4 * u, 6 * u, 0, Math.PI * 2); ctx.fill();
    const fw = 230 * u, fh = 120 * u, top = by - bh + 6 * u;
    const fg = ctx.createLinearGradient(bx, 0, bx + fw, 0);
    fg.addColorStop(0, ARMY.aldmere.roof); fg.addColorStop(1, ARMY.aldmere.color);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(bx, top);
    ctx.bezierCurveTo(bx + fw * 0.35, top + 18 * u, bx + fw * 0.7, top - 10 * u, bx + fw, top + fh * 0.12);
    ctx.lineTo(bx + fw * 0.8, top + fh * 0.5); ctx.lineTo(bx + fw, top + fh * 0.88);
    ctx.bezierCurveTo(bx + fw * 0.7, top + fh + 10 * u, bx + fw * 0.35, top + fh - 18 * u, bx, top + fh);
    ctx.closePath(); ctx.fill();
    // A crown on the flag.
    ctx.fillStyle = '#f3d27a';
    const cx = bx + fw * 0.42, cy = top + fh * 0.52, cs = 26 * u;
    poly([[cx - cs, cy + cs * 0.6], [cx + cs, cy + cs * 0.6], [cx + cs * 0.8, cy - cs * 0.5], [cx + cs * 0.35, cy], [cx, cy - cs * 0.9], [cx - cs * 0.35, cy], [cx - cs * 0.8, cy - cs * 0.5]], '#f3d27a');

    // ---- light, texture, vignette ----
    const warm = ctx.createRadialGradient(mx, my, 0, mx, my, W * 0.9);
    warm.addColorStop(0, 'rgba(255,190,140,0.10)'); warm.addColorStop(1, 'rgba(255,190,140,0)');
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 900; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(rnd() * W, rnd() * H, 1.5 * u, 1.5 * u);
    }
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vig.addColorStop(0, 'rgba(10,8,14,0)'); vig.addColorStop(1, 'rgba(10,8,14,0.55)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  }

  // ---- castle silhouettes, lit from the moon side with warm windows ----
  function windows(ctx, pts, u) { ctx.fillStyle = '#ffcc7a'; for (const [x, y] of pts) ctx.fillRect(x - 1.2 * u, y - 2 * u, 2.4 * u, 3.5 * u); }
  const wall = (ctx, x, y, w, h, base) => { ctx.fillStyle = base; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,200,150,0.14)'; ctx.fillRect(x + w * 0.55, y, w * 0.45, h); };
  const crenels = (ctx, x, y, w, size, col) => { ctx.fillStyle = col; const n = Math.max(2, Math.round(w / (size * 2))), step = w / (n * 2 - 1); for (let i = 0; i < n; i++) ctx.fillRect(x + i * step * 2, y - size, step, size); };

  function stone(ctx, x, y, s, A, u) {
    const base = '#3a3340';
    wall(ctx, x - s * 1.1, y - s * 0.8, s * 2.2, s * 0.8, base); crenels(ctx, x - s * 1.1, y - s * 0.8, s * 2.2, s * 0.1, base);
    for (const tx of [x - s * 1.25, x + s * 0.85]) { wall(ctx, tx, y - s * 1.35, s * 0.4, s * 1.35, '#2e2834'); ctx.fillStyle = A.roof; ctx.beginPath(); ctx.moveTo(tx - s * 0.05, y - s * 1.35); ctx.lineTo(tx + s * 0.45, y - s * 1.35); ctx.lineTo(tx + s * 0.2, y - s * 1.75); ctx.fill(); }
    wall(ctx, x - s * 0.35, y - s * 1.8, s * 0.7, s * 1.8, base); crenels(ctx, x - s * 0.35, y - s * 1.8, s * 0.7, s * 0.1, base);
    windows(ctx, [[x - s * 0.15, y - s * 1.3], [x + s * 0.15, y - s * 1.3], [x - s * 0.7, y - s * 0.45], [x + s * 0.6, y - s * 0.45], [x, y - s * 0.9]], u);
    flag(ctx, x, y - s * 1.9, s * 0.55, A.color, u);
  }
  function palisade(ctx, x, y, s, A, u) {
    const w = s * 2.4;
    for (let i = 0; i < 14; i++) { const px = x - w / 2 + i * (w / 14); ctx.fillStyle = i % 2 ? '#3d2a18' : '#2f2012'; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - s * 0.55); ctx.lineTo(px + w / 28, y - s * 0.7); ctx.lineTo(px + w / 14, y - s * 0.55); ctx.lineTo(px + w / 14, y); ctx.fill(); }
    for (const [dx, r] of [[-0.55, 0.45], [0.5, 0.38]]) { ctx.fillStyle = '#6b5a3c'; ctx.beginPath(); ctx.arc(x + dx * s, y - s * 0.5, r * s, Math.PI, 0); ctx.fill(); ctx.fillStyle = A.roof; ctx.fillRect(x + dx * s - r * s, y - s * 0.5 - r * s * 0.5, r * s * 2, r * s * 0.16); }
    wall(ctx, x - s * 0.1, y - s * 1.6, s * 0.2, s * 1.1, '#2f2012'); ctx.fillStyle = '#3d2a18'; ctx.fillRect(x - s * 0.35, y - s * 1.6, s * 0.7, s * 0.3);
    ctx.fillStyle = A.roof; ctx.beginPath(); ctx.moveTo(x - s * 0.42, y - s * 1.6); ctx.lineTo(x + s * 0.42, y - s * 1.6); ctx.lineTo(x, y - s * 1.95); ctx.fill();
    windows(ctx, [[x - s * 0.55, y - s * 0.7], [x + s * 0.5, y - s * 0.65], [x, y - s * 1.45]], u);
    // Torches on the stakes.
    for (const tx of [x - w / 2 + s * 0.2, x + w / 2 - s * 0.2]) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(tx, y - s * 0.85, 3 * u, 0, Math.PI * 2); ctx.fill(); }
    flag(ctx, x, y - s * 1.95, s * 0.5, A.color, u);
  }
  function longhouse(ctx, x, y, s, A, u) {
    wall(ctx, x - s * 0.9, y - s * 0.6, s * 1.8, s * 0.6, '#3a3d44');
    ctx.fillStyle = '#2a2320'; ctx.beginPath(); ctx.moveTo(x - s * 1.0, y - s * 0.6); ctx.lineTo(x + s * 1.0, y - s * 0.6); ctx.lineTo(x, y - s * 1.4); ctx.fill();
    ctx.fillStyle = '#eef3f6'; ctx.beginPath(); ctx.moveTo(x - s * 0.45, y - s * 1.04); ctx.lineTo(x + s * 0.45, y - s * 1.04); ctx.lineTo(x, y - s * 1.4); ctx.fill();
    wall(ctx, x - s * 1.4, y - s * 1.3, s * 0.45, s * 1.3, '#3a3d44'); ctx.fillStyle = '#2a2320'; ctx.beginPath(); ctx.moveTo(x - s * 1.5, y - s * 1.3); ctx.lineTo(x - s * 0.85, y - s * 1.3); ctx.lineTo(x - s * 1.175, y - s * 1.9); ctx.fill();
    ctx.fillStyle = '#eef3f6'; ctx.beginPath(); ctx.moveTo(x - s * 1.33, y - s * 1.6); ctx.lineTo(x - s * 1.02, y - s * 1.6); ctx.lineTo(x - s * 1.175, y - s * 1.9); ctx.fill();
    windows(ctx, [[x - s * 0.4, y - s * 0.3], [x + s * 0.4, y - s * 0.3], [x, y - s * 0.85], [x - s * 1.175, y - s * 0.9]], u);
    flag(ctx, x - s * 1.175, y - s * 1.95, s * 0.45, A.color, u);
  }
  function domes(ctx, x, y, s, A, u) {
    wall(ctx, x - s * 1.1, y - s * 0.7, s * 2.2, s * 0.7, '#5a4a3a');
    for (let i = 0; i < 8; i++) { const px = x - s * 1.1 + (i + 0.5) * s * 2.2 / 8; ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(px - 3 * u, y - s * 0.7); ctx.lineTo(px + 3 * u, y - s * 0.7); ctx.lineTo(px, y - s * 0.78); ctx.fill(); }
    ctx.fillStyle = A.roof; ctx.beginPath(); ctx.ellipse(x, y - s * 0.7, s * 0.55, s * 0.6, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.95, s * 0.14, s * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();
    for (const tx of [x - s * 1.3, x + s * 1.3]) { wall(ctx, tx - s * 0.12, y - s * 1.7, s * 0.24, s * 1.7, '#5a4a3a'); ctx.fillStyle = A.roof; ctx.beginPath(); ctx.ellipse(tx, y - s * 1.7, s * 0.18, s * 0.2, 0, Math.PI, 0); ctx.fill(); }
    windows(ctx, [[x - s * 0.6, y - s * 0.35], [x + s * 0.6, y - s * 0.35], [x, y - s * 0.4], [x - s * 1.3, y - s * 1.2], [x + s * 1.3, y - s * 1.2]], u);
    flag(ctx, x, y - s * 1.32, s * 0.45, A.color, u);
  }
  function spires(ctx, x, y, s, A, u) {
    wall(ctx, x - s * 1.0, y - s * 0.55, s * 2.0, s * 0.55, '#2a2535');
    const spire = (sx, w, h, rh) => { wall(ctx, sx - w / 2, y - h, w, h, '#221d2d'); ctx.fillStyle = A.roof; ctx.beginPath(); ctx.moveTo(sx - w / 2 - 2 * u, y - h); ctx.lineTo(sx + w / 2 + 2 * u, y - h); ctx.lineTo(sx, y - h - rh); ctx.fill(); ctx.fillStyle = A.color; ctx.fillRect(sx - w * 0.15, y - h * 0.75, w * 0.3, h * 0.14); };
    spire(x - s * 0.8, s * 0.4, s * 1.1, s * 0.8); spire(x + s * 0.8, s * 0.4, s * 1.0, s * 0.75); spire(x, s * 0.55, s * 1.6, s * 1.2);
    // Mist around the base.
    ctx.fillStyle = 'rgba(190,170,220,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, s * 2.4, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    flag(ctx, x, y - s * 2.8, s * 0.45, A.color, u, true);
  }
  function flag(ctx, x, y, h, col, u, streamer) {
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
    ctx.fillStyle = col;
    if (streamer) { ctx.strokeStyle = col; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.bezierCurveTo(x + h * 0.4, y - h - 4 * u, x + h * 0.7, y - h + 6 * u, x + h * 1.1, y - h + 2 * u); ctx.stroke(); return; }
    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + h * 0.5, y - h + 4 * u, x + h * 0.8, y - h + h * 0.08);
    ctx.lineTo(x + h * 0.62, y - h + h * 0.3); ctx.lineTo(x + h * 0.8, y - h + h * 0.52); ctx.quadraticCurveTo(x + h * 0.5, y - h + h * 0.6, x, y - h + h * 0.55); ctx.closePath(); ctx.fill();
  }

  root.paintLaunchBackground = paint;
  // The castle and banner painters, shared with art/gallery.js.
  root.launchArt = { stone, palisade, longhouse, domes, spires, flag, ARMY };
})(typeof globalThis !== 'undefined' ? globalThis : this);
