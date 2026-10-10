// juice.js
//
// Feel and juice (#69), the parts that live outside the battle drawing: a gentle shake when big columns
// crash into a castle, the Grand Campaign camera turning to the monster when it acts, the victory and
// defeat cinematic, the strength sparkline on the end screen, and the volume sliders. Nothing here
// touches the simulation: it only listens to its events and reads G. The particles (dust, capture sparks,
// cracked walls and scaffolding) are drawn by render.js. Loads last, after every other script.

// ---------- a shake on big clashes ----------
// Columns of this many troops or more hitting a castle (or a road battle killing this many) shake the board,
// harder the bigger the clash; only clashes the player is part of, and never with reduced motion.
const JUICE_BIG_CLASH = 30;
on('clash', ({ attacker, defender, n = 0, road, lost }) => {
  if (reduceMotion || !G || G.cfg.demo || (attacker !== 1 && defender !== 1)) return;
  const size = road && lost ? Object.values(lost).reduce((a, v) => a + v, 0) : n;
  if (size < JUICE_BIG_CLASH) return;
  const mag = Math.min(5, 1.5 + size / 30);
  if (!G.shake || G.time >= G.shake.until || G.shake.mag < mag) G.shake = { until: G.time + 0.3, mag };
});

// ---------- the Grand Campaign camera follows the monster ----------
// When the monster breathes fire, smashes or raids somewhere off screen, the camera glides there over
// 0.7 s (unless the player is dragging or has reduced motion on). render.js calls juicePanStep each frame.
let juicePan = null;
const JUICE_PAN_MS = 700;
on('monster', e => {
  if (reduceMotion || !G || G.cfg.demo || G.mode !== 'grand' || typeof cam === 'undefined' || cam.z <= 1.001) return;
  if (!['fire', 'smash', 'raid'].includes(e.kind) || ptr.down) return;
  const live = G.monster ? G.monster.creatures.filter(c => !c.dead) : [];
  const at = e.castle || live.sort((a, b) => (b.hit ? 1 : 0) - (a.hit ? 1 : 0))[0];
  if (!at) return;
  // Already on screen: leave the camera alone.
  const sx = at.x * sc + ox, sy = at.y * sc + oy;
  if (sx > 40 && sx < cw - 40 && sy > 40 && sy < ch - 40) return;
  juicePan = { x0: cam.cx, y0: cam.cy, x1: at.x, y1: at.y, t0: performance.now() };
});
on('newGame', () => { juicePan = null; });
function juicePanStep(now) {
  if (!juicePan || typeof cam === 'undefined') return;
  if (ptr.down) { juicePan = null; return; }   // the player took the camera back
  const t = Math.min(1, (now - juicePan.t0) / JUICE_PAN_MS), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  cam.cx = juicePan.x0 + (juicePan.x1 - juicePan.x0) * e;
  cam.cy = juicePan.y0 + (juicePan.y1 - juicePan.y0) * e;
  applyCamera();
  if (t >= 1) juicePan = null;
}

// ---------- victory and defeat ----------
// A short cinematic over the end screen: the winning army's banner unfurls, its lord appears, and the lord
// has a word. Click, tap or any key skips it; it fades out by itself after a few seconds.
const cinema = document.createElement('div');
cinema.id = 'cinema'; cinema.hidden = true;
cinema.setAttribute('role', 'dialog'); cinema.setAttribute('aria-modal', 'true'); cinema.setAttribute('aria-labelledby', 'cineTitle');
document.body.append(cinema);
let cinemaTimer = 0;
function closeCinema() {
  if (cinema.hidden) return;
  clearTimeout(cinemaTimer);
  cinema.hidden = true;
  const next = document.querySelector('#endOv:not([hidden]) button.primary, #endOv:not([hidden]) button');
  if (next) next.focus({ preventScroll: true });
}
cinema.addEventListener('click', closeCinema);
addEventListener('keydown', e => { if (!cinema.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closeCinema(); } }, true);

function endWinner(win) {
  if (win) return 1;
  if (G.mode === 'hill' && G.hill && G.hill.winner != null) return G.hill.winner;
  return G.owners.slice(1).filter(o => !G.surrendered.has(o)).sort((a, b) => totalOf(b) - totalOf(a))[0] ?? G.owners[1];
}
function showCinema(win) {
  const w = endWinner(win), A = army(w), L = lordOf(w);
  const quote = pick((L.lines && L.lines.victory) || ['The field is ours.']);
  cinema.style.setProperty('--c', A.color);
  cinema.innerHTML = `<div class="cine-stage${reduceMotion ? ' still' : ''}">
      <div class="cine-banner"><svg viewBox="0 0 100 140" aria-hidden="true"><path d="M0 0H100V118L50 140L0 118Z" fill="var(--c)"/><path d="M0 0H100V10H0Z" fill="rgb(0 0 0 / .25)"/></svg><div class="cine-emblem">${svg(A.emblem)}</div></div>
      <div class="cine-lord">${lordPortraitHtml(w)}</div>
      <h2 id="cineTitle" class="${win ? 'result-win' : 'result-lose'}">${win ? 'Victory' : 'Defeat'}</h2>
      <p class="cine-name"></p>
      <blockquote class="cine-quote"></blockquote>
      <small class="cine-skip">Click or press any key to continue</small>
    </div>`;
  cinema.querySelector('.cine-name').textContent = `${A.full} · ${L.name}`;
  cinema.querySelector('.cine-quote').textContent = `“${quote}”`;
  cinema.hidden = false;
  cinema.focus?.();
  cinemaTimer = setTimeout(closeCinema, reduceMotion ? 2600 : 4200);
}

// ---------- the strength sparkline on the end screen ----------
// Your share of every army's troops over the whole battle, in one small line under the result.
function renderSparkline() {
  const hist = G.history || [];
  let el = document.getElementById('endSpark');
  if (!el) {
    el = document.createElement('figure'); el.id = 'endSpark'; el.className = 'end-spark';
    document.getElementById('endText').after(el);
  }
  if (hist.length < 2) { el.hidden = true; return; }
  const W = 220, H = 40, end = Math.max(1, hist[hist.length - 1].t);
  const share = h => { const sum = h.v.reduce((a, v) => a + v, 0) || 1; return h.v[0] / sum; };
  const pts = hist.map(h => [h.t / end * W, H - 2 - share(h) * (H - 4)]);
  const peak = Math.max(...hist.map(share)), last = share(hist[hist.length - 1]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  el.hidden = false;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Your share of all troops: peak ${Math.round(peak * 100)}%, at the end ${Math.round(last * 100)}%">
      <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="spark-mid"/>
      <polygon points="0,${H} ${line} ${W},${H}" fill="${army(1).color}" opacity="0.18"/>
      <polyline points="${line}" fill="none" stroke="${army(1).color}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3" fill="${army(1).color}"/>
    </svg><figcaption>Your share of all troops, start to finish · peak ${Math.round(peak * 100)}%</figcaption>`;
}

// ui.js's endGame runs first (it registered on 'end' earlier), so the end screen is filled in by now.
on('end', ({ win }) => {
  if (!G || G.cfg.demo || G.cfg.tutorial) return;
  renderSparkline();
  if (G.mode !== 'defense') showCinema(win);
});
on('newGame', () => closeCinema());

// ---------- volume ----------
// Three sliders (everything, effects, music), on the menu and on the pause sheet, kept in step.
const JUICE_VOLUMES = [['all', 'Volume'], ['effects', 'Effects'], ['music', 'Music']];
function volumeBox(where) {
  const box = document.createElement('div');
  box.className = 'volume-box';
  box.innerHTML = JUICE_VOLUMES.map(([ch, name]) =>
    `<label>${name} <output>${Math.round(sfx.volume(ch) * 100)}%</output><input type="range" min="0" max="100" step="5" value="${Math.round(sfx.volume(ch) * 100)}" data-ch="${ch}" aria-label="${name}"></label>`).join('');
  box.addEventListener('input', e => {
    const r = e.target.closest('input[data-ch]'); if (!r) return;
    sfx.setVolume(r.dataset.ch, r.value / 100);
    for (const other of document.querySelectorAll(`.volume-box input[data-ch="${r.dataset.ch}"]`)) {
      other.value = r.value; other.previousElementSibling.textContent = `${r.value}%`;
    }
  });
  where(box);
  return box;
}
{
  const group = document.createElement('div');
  group.className = 'group';
  group.innerHTML = '<span class="label">Sound</span>';
  volumeBox(b => group.append(b));
  const rules = [...document.querySelectorAll('#menu .label')].find(l => l.textContent.trim() === 'Rules of war');
  if (rules && rules.parentElement) rules.parentElement.before(group);
  const pauseRow = document.querySelector('#pauseOv .row');
  if (pauseRow) volumeBox(b => pauseRow.after(b));
}
