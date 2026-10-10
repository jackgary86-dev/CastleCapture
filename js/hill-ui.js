// hill-ui.js
//
// King of the Hill (#64), the browser side: the menu entry under Modes, the per-realm score bar in the
// header, the leader callout banners, the crown over the hill keep and the end-screen text. The rules
// and the lords' tactics are in js/hill.js. Loaded after js/ui.js and js/grand-menu.js; it only reads
// the simulation, apart from starting a battle through play().

// Start a King of the Hill battle: `army` against `rivals` random lords (1, 2 or 4) on `diff`.
function startHill(armyId = myArmy, rivals = 1, diff = 'medium') {
  const foes = shuffle(ARMY_IDS.filter(id => id !== armyId)).slice(0, Math.max(1, Math.min(4, rivals)));
  play(hillCfg(armyId, foes, diff));
}

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const on1 = () => G && G.mode === 'hill' && G.hill && !G.cfg.demo;
  const who = o => o === 1 ? 'You' : lordOf(o).short;
  const crownSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 19h18l-1.6-11-4.6 4.2L12 5 9.2 12.2 4.6 8z"/></svg>';

  // ---------- the score bar in the header ----------
  const bar = document.createElement('div');
  bar.id = 'hillBar'; bar.hidden = true;
  bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'King of the Hill points');
  const strength = $('strength');
  if (strength && strength.after) strength.after(bar);
  let barKey = '';
  function renderBar() {
    if (!on1()) { if (!bar.hidden) bar.hidden = true; barKey = ''; return; }
    const H = G.hill, keys = G.owners.map(o => Math.floor(hillScore(o)));
    const key = `${keys.join('|')}|${H.holder}|${H.leader}|${H.focus}`;
    bar.hidden = false;
    if (key === barKey) return;
    barKey = key;
    bar.innerHTML = G.owners.map(o => {
      const pts = Math.floor(hillScore(o)), A = army(o);
      const cls = ['hb', o === H.holder ? 'holds' : '', o === H.leader ? 'leads' : '', o === H.focus ? 'hunted' : ''].filter(Boolean).join(' ');
      const state = o === H.holder ? ', holds the hill' : '';
      return `<span class="${cls}" style="--c:${col(o)}" title="${esc(`${o === 1 ? 'You' : `${lordOf(o).short} of ${A.name}`}: ${pts} of ${HILL.goal}${state}`)}">`
        + `<span class="hb-name">${o === H.leader ? crownSvg : ''}${esc(o === 1 ? 'You' : A.name)}</span>`
        + `<span class="hb-track"><span style="width:${(100 * pts / HILL.goal).toFixed(1)}%"></span></span>`
        + `<span class="hb-pts">${pts}</span></span>`;
    }).join('');
    bar.setAttribute('aria-label', `King of the Hill points, first to ${HILL.goal}: ` + G.owners.map(o => `${o === 1 ? 'you' : army(o).name} ${Math.floor(hillScore(o))}`).join(', '));
  }

  // The status line names the mode and the time left on the clock.
  const hudBeforeHill = hud;
  hud = function () {
    hudBeforeHill();
    renderBar();
    if (!on1()) return;
    const narrow = matchMedia('(max-width: 560px)').matches;
    const rivals = G.owners.slice(1).map(o => narrow ? army(o).name : `${lordOf(o).short} of ${army(o).name}`).join(' & ');
    const H = G.hill, holder = H.holder ? `${who(H.holder)} ${H.holder === 1 ? 'hold' : 'holds'} the hill` : 'The hill is unclaimed';
    statusEl.textContent = `King of the Hill · ${DIFF_NAME[G.cfg.diff]} · vs ${rivals} · ${holder} · ${fmtTime(Math.max(0, HILL.cap - G.time))} left`;
    statusEl.title = statusEl.textContent;
  };

  // ---------- banners ----------
  on('hill', e => {
    if (!on1()) return;
    const c = e.o ? col(e.o) : NEUTRAL;
    if (e.kind === 'take') {
      if (e.o === 1) { toast('You hold the hill!', `Every second you hold it scores a point. First to ${HILL.goal} wins.`, c); sfx.horn(true); }
      else if (e.was === 1) { toast(`${lordOf(e.o).short} takes the hill from you!`, `${army(e.o).full} scores while they hold it.`, c); sfx.horn(false); }
      else toast(`${lordOf(e.o).short} takes the hill`, `${army(e.o).full} scores while they hold it.`, c);
    } else if (e.kind === 'leader') {
      toast(e.o === 1 ? 'You lead the race for the crown' : `${lordOf(e.o).short} leads the race for the crown`, `${Math.floor(hillScore(e.o))} of ${HILL.goal} points.`, c);
    } else if (e.kind === 'focus') {
      toast(e.o === 1 ? `${HILL.focusAt} points! Every lord turns on you` : `${lordOf(e.o).short} has ${HILL.focusAt} points!`, e.o === 1 ? 'Hold the hill a little longer.' : 'Every lord turns on the leader. Strike now.', WARN);
      sfx.drum();
    }
    barKey = '';
  });

  // ---------- the crown over the hill keep ----------
  const drawBeforeHill = draw;
  draw = function (now) {
    drawBeforeHill(now);
    if (!on1()) return;
    const keep = G.planets[G.hill.id];
    if (!keep) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
    const pulse = reduceMotion ? 0.75 : 0.6 + 0.25 * Math.sin(now / 300);
    // A gold ring round the keep, in the holder's colour while it is held.
    ctx.save(); ctx.translate(keep.x, keep.y + keep.r * 0.45); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, keep.r * 1.8, 0, Math.PI * 2);
    ctx.strokeStyle = alpha('#f3c64a', pulse); ctx.lineWidth = 5; ctx.stroke();
    if (keep.owner) { ctx.beginPath(); ctx.arc(0, 0, keep.r * 1.8 + 6, 0, Math.PI * 2); ctx.strokeStyle = alpha(col(keep.owner), 0.8); ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
    // The crown floats above the towers.
    const cx = keep.x, cy = keep.y - keep.r * 2.05 - (reduceMotion ? 0 : Math.sin(now / 500) * 2), s = 11;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.6); ctx.lineTo(cx - s, cy - s * 0.4); ctx.lineTo(cx - s * 0.5, cy + s * 0.05);
    ctx.lineTo(cx, cy - s * 0.75); ctx.lineTo(cx + s * 0.5, cy + s * 0.05); ctx.lineTo(cx + s, cy - s * 0.4); ctx.lineTo(cx + s, cy + s * 0.6); ctx.closePath();
    ctx.fillStyle = '#f3c64a'; ctx.fill(); ctx.strokeStyle = '#8a6512'; ctx.lineWidth = 1.5; ctx.stroke();
    if (keep.owner) { ctx.fillStyle = col(keep.owner); ctx.beginPath(); ctx.arc(cx, cy + s * 0.15, 2.4, 0, Math.PI * 2); ctx.fill(); }
    // Each kingdom's seat flies a small gold pennant: it can be emptied but never taken.
    for (const p of G.planets) {
      if (!p.seat) continue;
      const x = p.x + p.r * 0.95, y = p.y - p.r * 1.15;
      ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y - 6); ctx.stroke();
      ctx.fillStyle = '#f3c64a'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 8, y - 3); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // ---------- the end screen ----------
  // Runs after ui.js's endGame (registered first), and rewrites the lines that assume a conquest.
  on('end', ({ win }) => {
    if (!G || G.mode !== 'hill' || G.cfg.demo) return;
    const H = G.hill, w = H.winner, pts = Math.floor(hillScore(1));
    const how = H.reachedAt != null ? `reached ${HILL.goal} points in ${fmtTime(H.reachedAt)}` : `had the most points when the clock ran out`;
    $('endTitle').textContent = win ? 'Crowned' : 'Defeat';
    $('endText').textContent = win
      ? `You ${how}. The crown of the hill is yours.`
      : w != null ? `${lordOf(w).name} ${how} (${Math.floor(hillScore(w))} points). You scored ${pts}.` : `You scored ${pts} points.`;
    $('seedLine').hidden = true;
    if (w != null && w !== 1) {
      const L = lordOf(w);
      $('endQuote').innerHTML = `${lordPortraitHtml(w)}<div><q></q><small>${L.name}, ${L.title}</small></div>`;
      $('endQuote').querySelector('q').textContent = pick(L.lines.hill || L.lines.victory);
    }
  });

  // ---------- the menu entry, under Modes ----------
  const sheet = document.querySelector('#menu .sheet');
  if (!sheet) return;
  let hDiff = ['easy', 'medium', 'hard'].includes(store.get('cs-hill-diff', 'medium')) ? store.get('cs-hill-diff', 'medium') : 'medium';
  let hRivals = [1, 2, 4].includes(store.get('cs-hill-rivals', 1)) ? store.get('cs-hill-rivals', 1) : 1;
  const group = document.createElement('div');
  group.className = 'group hill';
  group.innerHTML = `<span class="label">Modes</span>
    <b class="mode-name">King of the Hill</b>
    <p style="font-size:14px">A short race of five to ten minutes. A crowned keep stands at the centre of the map: whoever holds it scores a point a second, and the first to ${HILL.goal} wins. After ${HILL.cap / 60} minutes the most points wins. Your starting castle can be emptied but never taken, and the rival lords know the rule.</p>
    <span class="sublabel">Difficulty</span>
    <div class="seg" id="hillDiffSeg">${['easy', 'medium', 'hard'].map(d => `<button data-hdiff="${d}" aria-pressed="${d === hDiff}">${DIFF_NAME[d]}</button>`).join('')}</div>
    <span class="sublabel">Rivals</span>
    <div class="seg" id="hillRivalSeg">${[[1, '1 rival'], [2, '2 rivals'], [4, 'All four']].map(([n, t]) => `<button data-hrivals="${n}" aria-pressed="${n === hRivals}">${t}</button>`).join('')}</div>
    <p class="hill-best" id="hillBest"></p>
    <button class="primary" id="btnHill">Take the hill</button>`;
  const groups = [...sheet.querySelectorAll('.group')];
  const anchor = groups.find(g => g.classList.contains('grand')) || ($('ladder') && $('ladder').closest('.group'));
  if (anchor) anchor.after(group); else sheet.append(group);
  const pickIn = (id, attr, set) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    set(b.dataset[attr]);
  });
  pickIn('hillDiffSeg', 'hdiff', v => { hDiff = v; store.set('cs-hill-diff', v); });
  pickIn('hillRivalSeg', 'hrivals', v => { hRivals = +v; store.set('cs-hill-rivals', hRivals); });
  // The record for the army chosen at the top of the menu (kept by js/achievements.js).
  function renderBest() {
    const rec = typeof ach === 'object' && ach && ach.rec && ach.rec.hillBest ? ach.rec.hillBest[myArmy] : null;
    $('hillBest').textContent = rec != null ? `Best time to ${HILL.goal} with ${ARMIES[myArmy].name}: ${fmtTime(rec)}` : `No crown yet with ${ARMIES[myArmy].name}.`;
  }
  renderBest();
  $('btnHill').addEventListener('click', () => startHill(myArmy, hRivals, hDiff));
  $('armyPick').addEventListener('click', renderBest);
  const menu = $('menu');
  if (menu && typeof MutationObserver === 'function') new MutationObserver(() => { if (!menu.hidden) renderBest(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
})();
