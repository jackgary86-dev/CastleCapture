// defense-ui.js
//
// Siege Defense (#65) in the browser: the menu card under Modes, the wave line in the header, the Next
// wave button, coin-bought Walls and Barracks in the castle panel, banners as waves come and go, the
// siege beast drawn over its column, and the end screen with the score and the daily record. The rules
// live in js/defense.js. Loaded after js/grand-menu.js; it only wraps hud(), updateCastlePanel(), draw()
// and endGame(), as story.js and events.js do.

// Start a game: a fresh siege at the skirmish difficulty, or today's daily siege.
function startDefense(daily = false) {
  play(defenseCfg(myArmy, qDiff, daily ? defenseDay() : null));
}

(() => {
  const $ = id => document.getElementById(id);
  const DAILY_KEY = 'cs-defense-daily';   // { 'YYYY-MM-DD': { score, wave, army } }, the last 30 days
  const daily = () => { const d = store.get(DAILY_KEY, {}); return d && typeof d === 'object' ? d : {}; };
  const records = () => (typeof ach === 'object' && ach && ach.rec) || {};
  const fmtDay = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

  // ---------- the menu: a Modes group, shared with the other modes, and the Siege Defense card ----------
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
  const card = document.createElement('div');
  card.className = 'resume defense-card';
  card.innerHTML = `<div><b>Siege Defense</b>
      <span>Hold a fortress of five castles against waves from up to three lords: catapults from wave 4, cavalry on your flank from wave 6, a siege beast from wave 10. Twenty seconds and a coin payout between waves.</span>
      <span id="defenseRec"></span></div>
    <button class="primary" id="btnDefense">Begin the siege</button>
    <button id="btnDefenseDaily">Daily siege</button>`;
  if (modes) modes.append(card);
  function renderCard() {
    const r = records(), today = defenseDay(), d = daily()[today];
    $('defenseRec').textContent = `Most waves held: ${r.defenseBestWave || 0} · best score ${r.defenseBestScore || 0} · today's siege: ${d ? `score ${d.score} (${plural(d.wave, 'wave')})` : 'not yet fought'}`;
    $('btnDefenseDaily').textContent = `Daily siege · ${fmtDay(today)}`;
  }
  $('btnDefense').addEventListener('click', () => startDefense(false));
  $('btnDefenseDaily').addEventListener('click', () => startDefense(true));
  const menu = $('menu');
  if (typeof MutationObserver === 'function' && menu) new MutationObserver(() => { if (!menu.hidden) renderCard(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  renderCard();

  // ---------- the Next wave button, beside Pause ----------
  const btnCall = document.createElement('button');
  btnCall.id = 'btnCallWave'; btnCall.type = 'button'; btnCall.hidden = true;
  btnCall.title = 'Start the next wave now';
  btnCall.textContent = 'Next wave';
  btnPause.before(btnCall);
  btnCall.addEventListener('click', () => { if (playable() && defenseCallWave()) hud(); });

  // ---------- the header line ----------
  const hudBefore = hud;
  hud = function () {
    hudBefore();
    const on = !!G && isDefense() && !G.cfg.demo;
    btnCall.hidden = !(on && !G.over && !G.intro && G.def.phase === 'break');
    if (!on) return;
    btnDiplo.hidden = true;   // the lords besiege you together and never treat
    const D = G.def, attackers = G.packets.reduce((a, k) => a + (k.owner !== 1 ? k.n : 0), 0);
    const now = D.phase === 'break' ? `Wave ${D.wave + 1} in ${Math.ceil(Math.max(0, D.left))}s` : `Wave ${D.wave}: ${Math.ceil(attackers)} attackers on the field`;
    statusEl.textContent = [`${G.cfg.daily ? 'Daily siege' : 'Siege Defense'} · ${DIFF_NAME[G.cfg.diff]}`, now, `${plural(D.held, 'wave')} held`, `Score ${D.score}`].join(' · ');
    statusEl.title = statusEl.textContent;
  };

  // ---------- Walls and Barracks for coins, in the castle panel ----------
  const castlePanelEl = $('castlePanel');
  const coinRow = document.createElement('div');
  coinRow.className = 'cp-row'; coinRow.id = 'defCoinRow'; coinRow.hidden = true;
  castlePanelEl.append(coinRow);
  let coinKey = '';
  const cpBefore = updateCastlePanel;
  updateCastlePanel = function () {
    cpBefore();
    const p = !!G && isDefense() ? selectedCastle() : null;
    coinRow.hidden = !p;
    if (!p) { coinKey = ''; return; }
    const coins = Math.floor(G.coins[1]);
    const key = `${p.id}|${coins}|${lvl(p, 'walls')}|${lvl(p, 'barracks')}`;
    if (key === coinKey) return;
    coinKey = key;
    coinRow.innerHTML = ['walls', 'barracks'].map(kind => {
      const price = defenseUpgradePrice(p, kind), ok = price !== null && coins >= price, name = kind === 'walls' ? 'Walls' : 'Barracks';
      const cost = price === null ? 'Fully upgraded' : ok ? `Costs ${price} coins` : `Costs ${price} coins · need ${price - coins} more`;
      return `<button class="upg${ok ? ' can' : ''}" data-coin="${kind}" ${ok ? '' : 'disabled'}><span class="u-top"><span class="u-name">${name} with coins</span></span><span class="u-cost">${cost}</span></button>`;
    }).join('');
  };
  coinRow.addEventListener('click', e => {
    const b = e.target.closest('button[data-coin]'), p = selectedCastle();
    if (!b || b.disabled || !p || !playable()) return;
    if (defenseBuyUpgrade(1, p, b.dataset.coin)) { castlePanelKey = ''; coinKey = ''; updateCastlePanel(); renderTreasury(); }
  });

  // ---------- banners ----------
  const TWIST = {
    [DEFENSE.siegeFrom]: 'Catapults roll with the wave. Catch them on the road before they reach your walls.',
    [DEFENSE.flankFrom]: 'Cavalry ride for the castle furthest from the main blow.',
    [DEFENSE.beastFrom]: 'A siege beast leads the charge at your biggest garrison: it strikes three times as hard.',
  };
  let bestAtStart = 0;
  on('newGame', g => { if (g.mode === 'defense') bestAtStart = records().defenseBestWave || 0; });
  on('defense', e => {
    if (!G || G.cfg.demo) return;
    if (e.kind === 'wave') {
      const joins = (e.plan.joins || []).filter(o => e.wave > 1).map(o => `${lordOf(o).short} of ${army(o).name} joins the siege.`);
      const first = e.wave === 1 ? `${lordOf(e.plan.forces[0].o).short} of ${army(e.plan.forces[0].o).name} marches on your fortress.` : '';
      toast(`Wave ${e.wave}: ${e.plan.total + e.plan.forces.reduce((a, f) => a + f.beast, 0)} attackers`, [first, ...joins, TWIST[e.wave] || ''].filter(Boolean).join(' '), WARN);
      sfx.horn(false);
    } else if (e.kind === 'cleared') {
      toast(`Wave ${e.wave} held`, `+${e.coins} coins${e.keeps ? ` (${plural(e.keeps, 'keep')} held)` : ''}. Score ${e.score}. The next wave comes in ${DEFENSE.breakSeconds} seconds.`, army(1).color);
      sfx.chime();
    }
  });

  // ---------- the siege beast, drawn over its column ----------
  const drawBefore = draw;
  draw = function (now) {
    drawBefore(now);
    if (!G || !isDefense() || G.cfg.demo) return;
    const beasts = G.packets.filter(k => k.beast && k.delay <= 0);
    if (!beasts.length) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
    for (const k of beasts) {
      const dir = k.dir || 1, bob = reduceMotion ? 0 : Math.sin(now / 120 + k.phase) * 1.2, x = k.x, y = k.y - 10 + bob;
      const hide = '#3b2f26', horn = '#e8dcc0';
      ctx.save(); ctx.translate(x, k.y); ctx.scale(1.5, 1.5); ctx.translate(-x, -k.y);   // half again a soldier's scale
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, k.y + 2, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
      // Body, legs, head and horns: a great horned brute in its lord's colour.
      ctx.fillStyle = hide; ctx.beginPath(); ctx.ellipse(x, y, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      for (const lx of [-8, -3, 3, 8]) ctx.fillRect(x + lx - 1.5, y + 4, 3, 7);
      ctx.beginPath(); ctx.ellipse(x + dir * 12, y - 3, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = horn; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + dir * 11, y - 7); ctx.quadraticCurveTo(x + dir * 9, y - 14, x + dir * 15, y - 15);
      ctx.moveTo(x + dir * 15, y - 6); ctx.quadraticCurveTo(x + dir * 17, y - 12, x + dir * 21, y - 11); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = col(k.owner); ctx.fillRect(x - 9, y - 9, 18, 3);
      ctx.fillStyle = WARN; ctx.beginPath(); ctx.arc(x + dir * 14, y - 4, 1.3, 0, Math.PI * 2); ctx.fill();
      // Its strength, on a plaque above.
      const label = `${Math.ceil(k.n)}×${DEFENSE.beastStr}`;
      ctx.font = '700 9px "Alegreya Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 8;
      ctx.fillStyle = PARCH; ctx.fillRect(x - w / 2, y - 25, w, 11);
      ctx.fillStyle = INK; ctx.fillText(label, x, y - 19.5);
      ctx.restore();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // ---------- the end screen ----------
  const endGameBefore = endGame;
  endGame = function (win) {
    endGameBefore(win);
    if (!G || !isDefense() || G.cfg.demo) return;
    const D = G.def, castles = D.score - D.held, lords = G.owners.slice(1).filter((o, i) => D.wave >= DEFENSE.lordsAt[i]).map(o => army(o).full);
    const lines = [`You held ${plural(D.held, 'wave')} against ${lords.length ? andList(lords) : 'the lords'}.`,
      `Score ${D.score}: ${plural(D.held, 'wave')} survived + ${plural(castles, 'castle')} still held after the last of them.`];
    if (D.held > bestAtStart && D.held > 0) lines.push(`A new record: your most waves held.`);
    else if (bestAtStart) lines.push(`Your record is ${plural(bestAtStart, 'wave')}.`);
    if (G.cfg.daily) {
      const all = daily(), prev = all[G.cfg.daily];
      if (!prev || D.score > prev.score) all[G.cfg.daily] = { score: D.score, wave: D.held, army: G.fac[1] };
      // Keep the last 30 days.
      const keep = Object.keys(all).sort().slice(-30);
      store.set(DAILY_KEY, Object.fromEntries(keep.map(k => [k, all[k]])));
      lines.push(prev && D.score <= prev.score ? `Today's best stands at ${prev.score}.` : `Your best for the daily siege of ${fmtDay(G.cfg.daily)}.`);
    }
    $('endTitle').textContent = 'The fortress has fallen';
    $('endTitle').className = 'result-lose';
    $('endText').textContent = lines.join(' ');
    $('seedLine').hidden = true;
    $('btnNext').hidden = true;
  };
})();
