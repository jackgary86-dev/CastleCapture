// twoplayer.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// Two players on one screen (#12). Player 2 owns kingdom 2 (the first rival) and plays with the
// keyboard: W A S D move a cursor ring between castles, E selects one of their castles or sends
// the selected troops to the castle under the cursor (Shift+E sends to one of their own), F selects
// all their castles, R uses their power, Shift+1 to 4 sets their send amount. Player 1 keeps the
// mouse, touch, and the Tab / arrow / Enter keys from access.js. Skirmish only; not the Grand
// Campaign. Hooks: cfg.humans (sim.js), sels / sendPcts / playerSend(t, owner) (ui.js) and
// drawThreats(now, me) (render.js).

(() => {
  const $ = id => document.getElementById(id);
  const board = $('board'), fogSeg = $('fogSeg');
  if (!board) return;
  const ME = 2;
  const TWO_KEY = 'cs-two';
  let twoOn = store.get(TWO_KEY, false);
  const sel2 = new Set();
  sels[ME] = sel2;
  sendPcts[ME] = 0.5;
  let cursor = null;   // the castle player 2's cursor ring is on
  const inPlay = () => typeof playable === 'function' && playable() && G.cfg.humans === 2 && G.mode !== 'grand';
  const mine = () => G.planets.filter(p => p.owner === ME);
  const alive2 = () => G.planets.some(p => p.owner === ME) || G.packets.some(k => k.owner === ME);

  // ---------- menu toggle ----------
  if (fogSeg && typeof fogSeg.after === 'function') {
    const label = document.createElement('span');
    label.className = 'sublabel'; label.textContent = 'Two players';
    const seg = document.createElement('div');
    seg.className = 'seg'; seg.id = 'twoSeg';
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Two players on one screen');
    seg.innerHTML = `<button data-two="off" aria-pressed="${!twoOn}">Off</button><button data-two="on" aria-pressed="${twoOn}">On</button>`;
    const note = document.createElement('p');
    note.id = 'twoNote'; note.style.fontSize = '13px';
    note.innerHTML = 'A second player takes the rival army, chosen above, with the keyboard: <b>W A S D</b> move the cursor, <b>E</b> selects a castle or sends to the one under the cursor, <b>F</b> selects all, <b>R</b> uses their power, <b>Shift+1–4</b> set how many to send, <b>T</b> offers or breaks a truce with the lord under the cursor and <b>Y</b> / <b>N</b> answer one. Fog of war is off for two players.';
    fogSeg.after(label, seg, note);
    note.hidden = !twoOn;
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      twoOn = b.dataset.two === 'on';
      store.set(TWO_KEY, twoOn);
      note.hidden = !twoOn;
      seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    });
  }
  // The skirmish cfg: kingdom 2 becomes a person, so no AI lord takes it and fog is off.
  const quickCfgBase = quickCfg;
  quickCfg = function () {
    const c = quickCfgBase();
    if (twoOn) { c.humans = 2; c.fog = false; }
    return c;
  };

  // ---------- keyboard ----------
  on('newGame', () => { sel2.clear(); cursor = null; });
  // The nearest castle roughly in the pressed direction (within 60 degrees), favouring ones straight ahead.
  function step(dx, dy) {
    const from = cursor || mine()[0];
    if (!from) return;
    let best = null, bestScore = Infinity;
    for (const p of G.planets) {
      if (p === from) continue;
      const vx = p.x - from.x, vy = p.y - from.y, d = Math.hypot(vx, vy) || 1;
      const off = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / d)));
      if (off > Math.PI / 3) continue;
      const score = d * (1 + off * 1.5);
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (best) cursor = best;
  }
  function confirm(sendHere) {
    if (!cursor) { cursor = mine()[0] || null; return; }
    const t = cursor;
    const sending = sel2.size && (sendHere || t.owner !== ME) && [...sel2].some(s => s !== t);
    if (sending) playerSend(t, ME);
    else if (t.owner === ME) { if (sel2.has(t)) sel2.delete(t); else sel2.add(t); }
  }
  // Capture phase, so a shifted digit is claimed here before ui.js's plain 1 to 4 handler sees it
  // (on most layouts Shift+3 is '#', but not on all).
  addEventListener('keydown', e => {
    if (!inPlay() || (e.target.closest && e.target.closest('button, input, select, textarea, a'))) return;
    const dirs = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
    if (dirs[e.code]) { e.preventDefault(); step(...dirs[e.code]); }
    else if (e.code === 'KeyE') { e.preventDefault(); confirm(e.shiftKey); }
    else if (e.code === 'KeyF') { e.preventDefault(); for (const p of mine()) sel2.add(p); }
    else if (e.code === 'KeyR') { e.preventDefault(); if (usePower(ME)) { sfx.drum(); hud(); } }
    else if (e.shiftKey && /^Digit[1-4]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); sendPcts[ME] = PCTS[+e.code.slice(5) - 1]; }
    else if (e.code === 'KeyT') { e.preventDefault(); diplomacyKey(); }
    else if ((e.code === 'KeyY' || e.code === 'KeyN') && G.offer && G.offer.to === ME) { e.preventDefault(); answerOffer(e.code === 'KeyY'); }
  }, true);

  // ---------- truces for player 2 ----------
  // T offers the lord whose castle is under the cursor a truce, or breaks the one running with them.
  function diplomacyKey() {
    const o = cursor && cursor.owner;
    if (!o || o === ME) { toast('Diplomacy', 'Put the cursor on a rival castle, then press T to offer that lord a truce or break one.', army(ME).color); return; }
    const L = lordOf(o);
    if (pactOf(ME, o)) { breakPact(o, ME); toast(`Player 2 breaks the truce with ${L.short}`, `${army(ME).name} and ${army(o).name} are at war again.`, army(ME).color); return; }
    const r = proposeTruce(ME, o);
    const text = r === 'accepted' ? `${L.short} accepts. Neither side may attack the other for ${PACT_TIME} seconds.`
      : r === 'refused' ? `${L.short} refuses.`
      : r === 'pending' ? `${L.short} is deciding.`
      : 'No truce is possible now: it needs three kingdoms still standing, no truce already, and the cooling-off time to have passed.';
    toast(`Player 2 offers ${L.short} a truce`, text, army(o).color);
  }
  // An offer made to player 2 waits on its own card until they press Y or N.
  const p2offer = document.createElement('div');
  p2offer.id = 'p2offer'; p2offer.hidden = true; p2offer.setAttribute('role', 'dialog'); p2offer.setAttribute('aria-label', 'A lord offers player 2 a truce');
  board.append(p2offer);
  let offerTimer2 = 0;
  on('offer', ({ from, to }) => {
    if (to !== ME || !G || G.cfg.humans !== 2) return;
    const id = G.fac[from], L = LORDS[id];
    p2offer.style.setProperty('--c', ARMIES[id].color);
    p2offer.innerHTML = `${portraitHtml(id)}<div><b>To Player 2: ${L.short}, ${L.title}</b><q></q><small>A truce for ${PACT_TIME} seconds. <kbd>Y</kbd> accept · <kbd>N</kbd> decline</small></div>`;
    p2offer.querySelector('q').textContent = pick(L.lines.offer || ['A truce?']);
    p2offer.hidden = false;
    clearTimeout(offerTimer2);
    offerTimer2 = setTimeout(() => { p2offer.hidden = true; }, OFFER_TIME * 1000 + 500);
  });
  on('offerAnswered', () => { p2offer.hidden = true; });
  on('newGame', () => { p2offer.hidden = true; });
  on('pact', ({ a, b }) => {
    if (!G || G.cfg.humans !== 2 || G.cfg.demo || (a !== ME && b !== ME) || a === 1 || b === 1) return;
    const o = a === ME ? b : a;
    toast(`Player 2: truce with ${lordOf(o).short}`, `For ${PACT_TIME} seconds ${army(ME).name} and ${army(o).name} cannot attack each other.`, army(o).color);
  });
  on('pactEnd', ({ a, b, by, expired }) => {
    if (!G || G.cfg.humans !== 2 || G.cfg.demo || (a !== ME && b !== ME) || a === 1 || b === 1) return;
    const o = a === ME ? b : a;
    if (by && by !== ME) toast(`${lordOf(by).short} breaks the truce with Player 2!`, `${army(by).full} can attack ${army(ME).name} again.`, army(by).color);
    else if (expired) toast(`Player 2's truce with ${lordOf(o).short} has ended`, `${army(ME).name} is at war again.`, army(o).color);
  });

  // ---------- drawing: threats, selection, cursor and the status panel ----------
  const p2hud = document.createElement('div');
  p2hud.id = 'p2hud'; p2hud.hidden = true; p2hud.setAttribute('role', 'status');
  board.append(p2hud);
  let hudText = '';
  const drawBeforeTwo = draw;
  draw = function (now) {
    drawBeforeTwo(now);
    const show = G && G.cfg.humans === 2 && !G.cfg.demo && G.mode !== 'grand';
    if (!show) { if (!p2hud.hidden) p2hud.hidden = true; return; }
    const A = army(ME);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
    if (!G.over) drawThreats(now, ME);
    const spin = reduceMotion ? 0 : now / 1100;
    for (const p of sel2) {
      ctx.save(); ctx.translate(p.x, p.y + p.r * 0.45); ctx.scale(1, 0.5); ctx.rotate(-spin);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = A.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, p.r * 1.45, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (cursor && !G.over) {
      const p = cursor, pulse = reduceMotion ? 0 : Math.sin(now / 180) * 2;
      ctx.save(); ctx.translate(p.x, p.y);
      for (const [c, w] of [[INK, 6], [A.color, 3]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.strokeRect(-p.r * 1.35 - pulse, -p.r * 1.6 - pulse, p.r * 2.7 + pulse * 2, p.r * 2.9 + pulse * 2);
      }
      ctx.restore();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Status panel: army, send amount and power state for player 2.
    const pw = G.pw[ME], activePw = G.time < pw.until;
    const power = G.over ? '' : activePw ? `${A.power.name} active` : pw.ready <= 0 ? `${A.power.name} ready · <kbd>R</kbd>` : `${A.power.name} in ${fmtTime(pw.ready)}`;
    const truces = (G.pacts || []).filter(p => (p.a === ME || p.b === ME) && G.time < p.until).map(p => `Truce with ${lordOf(p.a === ME ? p.b : p.a).short} ${Math.ceil(p.until - G.time)}s`).join(' · ');
    const text = `<b>Player 2 · ${A.name}</b>Send ${Math.round(sendPcts[ME] * 100)}% · ${sel2.size} selected<br>${power}${truces ? `<br>${truces}` : ''}`;
    if (text !== hudText) { p2hud.innerHTML = text; hudText = text; }
    p2hud.style.setProperty('--c', A.color);
    if (p2hud.hidden) p2hud.hidden = false;
  };

  // ---------- the end screen names the winner ----------
  const endGameBase = endGame;
  endGame = function (win) {
    endGameBase(win);
    if (!G || G.cfg.humans !== 2) return;
    const winner = win ? 1 : alive2() ? ME : G.owners.slice(2).filter(o => G.planets.some(p => p.owner === o)).sort((a, b) => totalOf(b) - totalOf(a))[0];
    const W = winner ? army(winner) : null;
    const who = winner === 1 ? 'Player 1' : winner === ME ? 'Player 2' : winner ? LORDS[G.fac[winner]].name : 'Nobody';
    $('endTitle').textContent = W ? `${W.name} wins` : 'Stalemate';
    $('endTitle').className = winner === 1 ? 'result-win' : 'result-lose';
    $('endText').textContent = W
      ? `${who}, ${W.full}, holds the realm. ${winner === 1 || winner === ME ? 'Swap seats and play again.' : 'Neither of you could stop the lords. Fight again.'}`
      : 'The war ended with no one left to hold the realm.';
  };
})();
