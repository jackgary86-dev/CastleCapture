// crown-ui.js
//
// Capture the Crown (#66), the browser side: the card under Modes on the menu, the crown bar in the
// header, the Scouts troop button, hiding and moving your crown from the castle panel, the crown marks
// on the map, banners and the end screen. The rules and the lords' tactics are in js/crown.js. Loaded
// after js/defense-ui.js; it only wraps hud(), updateCastlePanel() and draw(), and starts a battle
// through play().
//
// It shows only what the player knows: your own crown, crowns your scouts or captures have found, crown
// columns in sight, and every crown once the heralds reveal them. Rival crowns stay hidden otherwise.

// Start a Capture the Crown duel: `army` against one random lord on `diff`, on a large map.
function startCrown(armyId = myArmy, rivals = 1, diff = 'medium') {
  const foes = shuffle(ARMY_IDS.filter(id => id !== armyId)).slice(0, 1);
  play(crownCfg(armyId, foes, diff));
}

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const on1 = () => !!G && G.mode === 'crown' && !!G.crown && !G.cfg.demo;
  const who = o => o === 1 ? 'You' : lordOf(o).short;
  const crownIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 19h18l-1.6-11-4.6 4.2L12 5 9.2 12.2 4.6 8z"/></svg>';
  const hideLeft = () => Math.max(0, CROWN.hideTime - G.time);
  // What the player knows about realm o's crown: its castle (or null), and how.
  function knownCrown(o) {
    const C = G.crown;
    if (o === 1 || C.revealed) {
      const k = crownCarrier(o);
      return crownAt(o) ? { castle: crownAt(o), how: 'at' } : k ? { castle: k.to, how: 'road', k } : null;
    }
    const k = crownCarrier(o);
    if (k && seesAt(1, k.x, k.y)) return { castle: k.to, how: 'road', k };
    const intel = C.intel[1] || {};
    for (const [id, i] of Object.entries(intel)) if (i.crown === o && G.planets[id].owner === o) return { castle: G.planets[id], how: 'found', t: i.t };
    return null;
  }

  // ---------- the crown bar in the header ----------
  const bar = document.createElement('div');
  bar.id = 'crownBar'; bar.hidden = true;
  bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Crowns');
  const strength = $('strength');
  if (strength && strength.after) strength.after(bar);
  let barKey = '';
  function stateOf(o) {
    const C = G.crown;
    if (C.out[o]) return { text: C.out[o].by ? `crown taken by ${C.out[o].by === 1 ? 'you' : lordOf(C.out[o].by).short}` : 'crown lost', cls: 'out' };
    const kc = knownCrown(o);
    if (o === 1) {
      if (!kc) return { text: 'crown missing', cls: '' };
      if (kc.how === 'road') return { text: `crown on the road, ${Math.ceil(kc.k.crown.dur - kc.k.crown.t)}s`, cls: 'road' };
      return { text: G.time < CROWN.hideTime ? `hide your crown: ${Math.ceil(hideLeft())}s` : C.exposed[1] != null && G.time - C.exposed[1] < 60 ? 'crown spotted by scouts!' : 'crown hidden', cls: C.exposed[1] != null && G.time - C.exposed[1] < 60 ? 'spotted' : 'mine' };
    }
    if (!kc) return { text: 'crown hidden', cls: '' };
    if (kc.how === 'road') return { text: 'crown on the road!', cls: 'road found' };
    return { text: C.revealed ? 'crown revealed' : 'crown found', cls: 'found' };
  }
  function renderBar() {
    if (!on1()) { if (!bar.hidden) bar.hidden = true; barKey = ''; return; }
    const states = G.owners.map(o => [o, stateOf(o)]);
    const key = states.map(([o, s]) => `${o}:${s.text}:${s.cls}`).join('|');
    bar.hidden = false;
    if (key === barKey) return;
    barKey = key;
    bar.innerHTML = states.map(([o, s]) => `<span class="cb ${s.cls}" style="--c:${col(o)}" title="${esc(`${o === 1 ? 'You' : `${lordOf(o).short} of ${army(o).name}`}: ${s.text}`)}">`
      + `<span class="cb-icon">${crownIcon}</span><span class="cb-name">${esc(o === 1 ? 'You' : army(o).name)}</span><span class="cb-state">${esc(s.text)}</span></span>`).join('');
    bar.setAttribute('aria-label', 'Crowns: ' + states.map(([o, s]) => `${o === 1 ? 'you' : army(o).name}, ${s.text}`).join('; '));
  }

  // ---------- scouts: a troop button of their own, shown only in this mode ----------
  const scoutBtn = document.createElement('button');
  scoutBtn.dataset.unit = 'scout'; scoutBtn.hidden = true;
  scoutBtn.title = `Scouts: ${CROWN.scoutTroops} fast riders look inside a castle without attacking, to find a hidden crown`;
  scoutBtn.textContent = 'Scouts';
  scoutBtn.setAttribute('aria-pressed', 'false');
  unitCtl.append(scoutBtn);

  let introShown = null;   // the battle the rules banner was last shown for

  // ---------- the status line ----------
  const hudBeforeCrown = hud;
  hud = function () {
    hudBeforeCrown();
    renderBar();
    scoutBtn.hidden = !on1();
    if (!on1() && unitType === 'scout') setUnitType('foot');
    if (!on1()) return;
    intro();
    const narrow = matchMedia('(max-width: 560px)').matches;
    const rivals = G.owners.slice(1).map(o => narrow ? army(o).name : `${lordOf(o).short} of ${army(o).name}`).join(' & ');
    const C = G.crown, left = G.owners.filter(o => !C.out[o]).length;
    const when = G.over ? `Over after ${fmtTime(G.time)}` : G.time < CROWN.hideTime ? `Hide your crown: ${Math.ceil(hideLeft())}s free`
      : C.revealed ? 'Every crown is revealed' : `Crowns revealed in ${fmtTime(Math.max(0, CROWN.revealAt - G.time))}`;
    statusEl.textContent = `Capture the Crown · ${DIFF_NAME[G.cfg.diff]} · vs ${rivals} · ${when}${G.owners.length > 2 ? ` · ${left} crowns left` : ''}`;
    statusEl.title = statusEl.textContent;
  };

  // ---------- hiding and moving your crown, from the castle panel ----------
  const castlePanelEl = $('castlePanel');
  const crownRow = document.createElement('div');
  crownRow.className = 'cp-row crown-row'; crownRow.id = 'crownRow'; crownRow.hidden = true;
  castlePanelEl.append(crownRow);
  let rowKey = '';
  const cpBefore = updateCastlePanel;
  updateCastlePanel = function () {
    cpBefore();
    const p = on1() ? selectedCastle() : null;
    crownRow.hidden = !p;
    if (!p) { rowKey = ''; return; }
    const C = G.crown, at = crownAt(1), coins = Math.floor(G.coins[1]), hiding = G.time < CROWN.hideTime;
    const escort = Math.floor((at ? at.units : 0) * pctOf(1));
    let name, cost, ok = false;
    if (C.out[1]) { name = 'Your crown is lost'; cost = ''; }
    else if (!at) { name = 'Your crown is on the road'; cost = 'Wait until it arrives'; }
    else if (at === p) { name = 'Your crown is here'; cost = hiding ? `Select another castle to hide it there (free for ${Math.ceil(hideLeft())}s)` : `Select another castle to move it (${CROWN.moveCost} coins)`; }
    else if (hiding) { name = 'Hide your crown here'; cost = `Free and secret for ${Math.ceil(hideLeft())}s more`; ok = true; }
    else {
      name = 'Move your crown here';
      ok = coins >= CROWN.moveCost && escort >= 1;
      cost = coins < CROWN.moveCost ? `${CROWN.moveCost} coins · need ${CROWN.moveCost - coins} more` : escort < 1 ? 'No troops to escort it' : `${CROWN.moveCost} coins · ${CROWN.moveTime}s on the road with ${escort} troops (your send %)`;
    }
    const key = `${p.id}|${name}|${cost}|${ok}`;
    if (key === rowKey) return;
    rowKey = key;
    crownRow.innerHTML = `<button class="upg crown-move${ok ? ' can' : ''}" ${ok ? '' : 'disabled'}><span class="u-top"><span class="u-name"></span></span><span class="u-cost"></span></button>`;
    crownRow.querySelector('.u-name').textContent = name;
    crownRow.querySelector('.u-cost').textContent = cost;
  };
  crownRow.addEventListener('click', e => {
    const b = e.target.closest('button'), p = selectedCastle();
    if (!b || b.disabled || !p || !playable() || !on1()) return;
    if (crownMove(1, p, pctOf(1))) { rowKey = ''; castlePanelKey = ''; updateCastlePanel(); renderTreasury(); hud(); }
  });

  // ---------- banners ----------
  on('newGame', g => {
    if (g.mode !== 'crown' || g.cfg.demo) return;
    barKey = ''; rowKey = '';
  });
  on('crown', e => {
    if (!on1()) return;
    const c = e.o ? col(e.o) : NEUTRAL;
    switch (e.kind) {
      case 'hid': if (e.o === 1) { toast('Your crown is hidden', 'No rival saw where it went.', army(1).color); sfx.chime(); } break;
      case 'move': if (e.o === 1) { toast('Your crown takes the road', `${CROWN.moveTime} seconds to its new castle. If its column is destroyed, whoever destroyed it takes your crown.`, army(1).color); sfx.drum(); } break;
      case 'landed': if (e.o === 1) { toast('Your crown is safe', 'It has reached its new castle.', army(1).color); sfx.chime(); } break;
      case 'sighted': if (e.by === 1) { toast(`${lordOf(e.o).short} is moving their crown!`, 'Their crown column is in sight. Destroy it on the road to take the crown.', c); sfx.horn(true); } break;
      case 'scouted':
        if (e.o === 1) {
          if (e.found) { toast(`Crown found!`, `Your scouts saw ${army(e.found).name}'s crown inside. Take that castle to knock ${lordOf(e.found).short} out.`, col(e.found)); sfx.horn(true); }
          else toast('No crown there', `Your scouts found no crown in that castle${e.owner ? ` of ${army(e.owner).name}` : ''}.`, army(1).color);
        } else if (e.owner === 1 && e.found === 1) { toast(`${lordOf(e.o).short}'s scouts found your crown!`, `Move it (select another castle) or guard it well.`, WARN); sfx.horn(false); }
        else if (e.owner === 1) toast(`${lordOf(e.o).short}'s scouts at your gate`, 'They found no crown there.', c);
        break;
      case 'empty': if (e.o === 1) toast('No crown here', `This castle of ${army(e.owner).name} held no crown.`, army(1).color); break;
      case 'out':
        if (e.o === 1) break;   // the end screen says it
        if (e.by === 1) { toast(`You took ${lordOf(e.o).short}'s crown!`, `${army(e.o).full} is knocked out; its castles stand empty.`, army(1).color); sfx.horn(true); }
        else toast(`${lordOf(e.o).short}'s crown has fallen`, `${e.by ? `${lordOf(e.by).short} took it${e.road ? ' on the road' : ''}` : 'It was lost'}. ${army(e.o).full} is out; its castles stand empty.`, c);
        break;
      case 'hidden': toast('The crowns are hidden', `Every realm has hidden its crown. Scout reports from the opening no longer count. Moving your crown now costs ${CROWN.moveCost} coins.`, '#f3c64a'); break;
      case 'reveal': toast('The heralds betray every crown', 'Every crown is now marked on the map. Strike, or move yours.', WARN); sfx.drum(); break;
    }
    barKey = '';
  });
  // The rules, once, a moment into the battle (after the banner naming the battlefield).
  function intro() {
    if (introShown === G || G.intro || G.time < 2.5) return;
    introShown = G;
    if (G.time < CROWN.hideTime) toast('Hide your crown', `It starts in your seat. For ${CROWN.hideTime} seconds you can hide it in any castle you hold, free and unseen: select the castle, then Hide your crown here. Find rival crowns with Scouts (the Troops buttons).`, '#f3c64a');
  }

  // ---------- crowns on the map ----------
  function drawCrown(x, y, s, fill, dot, now, struck = false) {
    const cy = y - (reduceMotion ? 0 : Math.sin(now / 500) * 1.5);
    ctx.beginPath();
    ctx.moveTo(x - s, cy + s * 0.6); ctx.lineTo(x - s, cy - s * 0.4); ctx.lineTo(x - s * 0.5, cy + s * 0.05);
    ctx.lineTo(x, cy - s * 0.75); ctx.lineTo(x + s * 0.5, cy + s * 0.05); ctx.lineTo(x + s, cy - s * 0.4); ctx.lineTo(x + s, cy + s * 0.6); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 1.4; ctx.stroke();
    if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x, cy + s * 0.15, s * 0.24, 0, Math.PI * 2); ctx.fill(); }
    if (struck) { ctx.strokeStyle = WARN; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s * 1.1, cy + s * 0.8); ctx.lineTo(x + s * 1.1, cy - s * 0.9); ctx.stroke(); }
  }
  const drawBeforeCrown = draw;
  draw = function (now) {
    drawBeforeCrown(now);
    if (!on1()) return;
    const C = G.crown;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
    // Castles a scout or a capture showed to hold no crown, while the report is fresh.
    const intel = C.intel[1] || {};
    for (const [id, i] of Object.entries(intel)) {
      const p = G.planets[id];
      if (i.crown || G.time - i.t > CROWN.intelFresh || p.owner === 1 || !p.owner) continue;
      ctx.globalAlpha = 0.75 * Math.max(0.3, 1 - (G.time - i.t) / CROWN.intelFresh);
      drawCrown(p.x, p.y - p.r * 1.9, 6, '#a99d80', null, 0, true);
      ctx.globalAlpha = 1;
    }
    for (const o of G.owners) {
      if (C.out[o]) continue;
      const kc = knownCrown(o);
      if (!kc) continue;
      if (kc.how === 'road') { const k = kc.k; drawCrown(k.x, k.y - 20, 7, '#f3c64a', col(o), now); }
      else { const p = kc.castle; drawCrown(p.x, p.y - p.r * 1.95, o === 1 ? 9 : 10, '#f3c64a', col(o), now); }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // ---------- the end screen ----------
  // Runs after ui.js's endGame (registered first), and rewrites the lines that assume a conquest.
  on('end', ({ win }) => {
    if (!G || G.mode !== 'crown' || G.cfg.demo) return;
    const C = G.crown, mine = C.out[1];
    const taken = G.owners.filter(o => C.out[o] && C.out[o].by === 1).map(o => army(o).name);
    $('endTitle').textContent = win ? 'The last crown' : 'Your crown is taken';
    $('endText').textContent = win
      ? `Yours is the last crown standing.${taken.length ? ` You took the crown${taken.length > 1 ? 's' : ''} of ${taken.join(' and ')}.` : ''} ${C.moves[1] ? `You moved your crown ${C.moves[1]} time${C.moves[1] > 1 ? 's' : ''}` : 'Your crown never moved'} and sent ${C.scouts[1]} scouting part${C.scouts[1] === 1 ? 'y' : 'ies'}.`
      : mine && mine.by ? `${lordOf(mine.by).name} took your crown${mine.road ? ' on the road' : ''} after ${fmtTime(mine.t)}.` : 'Your crown was lost.';
    $('seedLine').hidden = true;
    const lordO = !win && mine && mine.by ? mine.by : null;
    if (lordO) {
      const L = lordOf(lordO);
      $('endQuote').innerHTML = `${lordPortraitHtml(lordO)}<div><q></q><small>${L.name}, ${L.title}</small></div>`;
      $('endQuote').querySelector('q').textContent = pick(L.lines.crown || L.lines.victory);
    }
  });

  // ---------- the menu card, under Modes ----------
  const sheet = document.querySelector('#menu .sheet');
  const labelled = text => [...document.querySelectorAll('#menu .sheet .group')].find(g => { const l = g.querySelector('.label'); return l && l.textContent.trim() === text; });
  let modes = labelled('Modes');
  if (!modes && sheet) {
    modes = document.createElement('div');
    modes.className = 'group modes';
    modes.innerHTML = '<span class="label">Modes</span>';
    const after = document.querySelector('#menu .sheet .group.grand') || labelled('Campaign');
    if (after) after.after(modes); else sheet.append(modes);
  }
  let cDiff = ['easy', 'medium', 'hard'].includes(store.get('cs-crown-diff', 'medium')) ? store.get('cs-crown-diff', 'medium') : 'medium';
  const card = document.createElement('div');
  card.className = 'resume crown-card';
  card.innerHTML = `<div><b>Capture the Crown</b>
      <span>A scouting and bluffing duel under fog of war: you against one lord on a large map. Each realm hides its crown in one of its castles; take the castle holding a rival's crown and that realm is out at once. Send Scouts to look inside castles, move your crown for ${CROWN.moveCost} coins (${CROWN.moveTime} seconds on the road, where it can be seized), and fool the lords with decoy garrisons. The last crown wins.</span>
      <span id="crownRec"></span>
      <span class="crown-opts"><span class="seg" id="crownDiffSeg" role="group" aria-label="Capture the Crown difficulty">${['easy', 'medium', 'hard'].map(d => `<button data-cdiff="${d}" aria-pressed="${d === cDiff}">${DIFF_NAME[d]}</button>`).join('')}</span>
</span></div>
    <button class="primary" id="btnCrown">Raid for the crown</button>`;
  if (modes) modes.append(card);
  const pickIn = (id, attr, set) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    set(b.dataset[attr]);
  });
  pickIn('crownDiffSeg', 'cdiff', v => { cDiff = v; store.set('cs-crown-diff', v); });
  function renderRec() {
    const r = typeof ach === 'object' && ach && ach.rec ? ach.rec : {};
    $('crownRec').textContent = r.crownPlayed ? `Raids won: ${r.crownWon || 0} of ${r.crownPlayed} · crowns taken: ${r.crownsTaken || 0}` : 'No raids yet.';
  }
  renderRec();
  $('btnCrown').addEventListener('click', () => startCrown(myArmy, 1, cDiff));
  const menu = $('menu');
  if (menu && typeof MutationObserver === 'function') new MutationObserver(() => { if (!menu.hidden) renderRec(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
})();
