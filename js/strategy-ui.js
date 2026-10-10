// strategy-ui.js
//
// Deeper strategy (#67) in the browser: the four switches under Custom battle (on by default for
// skirmishes), the branch buttons on the castle panel, the badges drawn on castles (hill, branch, cut off,
// champion), the champion's standard on its column, and the banners when a champion rides, holds,
// falls or returns. The rules are in js/strategy.js; render.js and ui.js call the hooks below.

// ---------- the switches under Custom battle ----------
const STRATEGY_FEATURES = [
  ['spec', 'Castle branches', 'Keep, Barracks or Market once a castle has an upgrade'],
  ['supply', 'Supply lines', 'castles more than three castles from your chain train at half speed'],
  ['terrain', 'Terrain', 'hills defend better, river crossings slow, roads speed up'],
  ['heroes', 'Champions', "each lord's champion leads a column and strikes harder"],
];
let strategyPicks = { ...STRATEGY_ALL, ...store.get('cs-strategy', {}) };
// What quickCfg() puts in a skirmish's cfg: the switches that are on, or nothing at all when every one is off.
function strategySetting() {
  return Object.values(strategyPicks).some(Boolean) ? { ...strategyPicks } : undefined;
}
{
  const seed = document.getElementById('setSeed');
  const holder = seed && seed.closest('.settings');
  if (holder) {
    const box = document.createElement('fieldset');
    box.className = 'wide strategy-box';
    box.innerHTML = '<legend>Deeper strategy</legend>' + STRATEGY_FEATURES.map(([id, name, desc]) =>
      `<label class="check"><input type="checkbox" data-strat="${id}"${strategyPicks[id] ? ' checked' : ''}> <b>${name}</b> <small>${desc}</small></label>`).join('');
    box.addEventListener('change', e => {
      const c = e.target.closest('input[data-strat]'); if (!c) return;
      strategyPicks[c.dataset.strat] = c.checked;
      store.set('cs-strategy', strategyPicks);
    });
    holder.append(box);
  }
}

// ---------- the castle panel: pick a branch ----------
const cpSpec = document.createElement('div');
cpSpec.className = 'cp-row cp-spec'; cpSpec.hidden = true;
document.getElementById('castlePanel').append(cpSpec);
cpSpec.addEventListener('click', e => {
  const b = e.target.closest('button[data-spec]');
  if (!b || b.disabled || !G || G.over || G.paused || (typeof handsOff === 'function' && handsOff())) return;
  const p = selectedCastle();
  if (p && p.owner === 1 && specialise(p, b.dataset.spec)) { castlePanelKey = ''; updateCastlePanel(); }
});
// Called by ui.js's updateCastlePanel for the castle on show.
function strategyPanel(p) {
  const show = !!G.cfg.strategy && G.cfg.strategy.spec && p.owner === 1;
  cpSpec.hidden = !show;
  if (!show) return;
  if (p.spec) {
    const S = STRATEGY.spec[p.spec];
    cpSpec.innerHTML = '<p class="cp-note"></p>';
    cpSpec.firstChild.textContent = `${S.name}: ${S.desc}`;
    return;
  }
  const ready = canSpecialise(p), cost = specCost(p), coins = Math.floor(G.coins[1]);
  // Until the castle has an upgrade, one line says what's coming rather than three disabled buttons.
  if (!ready) {
    cpSpec.innerHTML = '<p class="cp-note">Upgrade its Walls or Barracks to pick a branch: Keep, Barracks or Market.</p>';
    return;
  }
  cpSpec.innerHTML = SPEC_IDS.map(id => {
    const S = STRATEGY.spec[id], ok = ready && coins >= cost;
    return `<button class="upg${ok ? ' can' : ''}" data-spec="${id}"${ok ? '' : ' disabled'}><span class="u-top"><span class="u-name">${S.name}</span></span><span class="u-desc">${S.desc}</span><span class="u-cost">Costs ${cost} coins${ok ? '' : ` · need ${cost - coins} more`}</span></button>`;
  }).join('');
}

// ---------- on the map ----------
// A castle on a hill stands on a grassy rise.
function drawStrategyGround(p, s, baseY) {
  if (!stratOn('terrain') || !p.high) return;
  // A rise under the castle, with contour lines, in the ground's colour but darker so it reads on any map.
  ctx.fillStyle = 'rgba(60,70,44,0.42)';
  ctx.beginPath(); ctx.ellipse(p.x, baseY + s * 0.1, s * 1.7, s * 0.95, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,34,20,0.65)'; ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath(); ctx.ellipse(p.x, baseY + s * 0.1, s * 1.7, s * 0.95, 0, Math.PI, 0); ctx.stroke();
  ctx.lineWidth = Math.max(0.8, s * 0.04);
  ctx.beginPath(); ctx.ellipse(p.x, baseY + s * 0.1, s * 1.25, s * 0.62, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
}
// Left of the garrison plaque: the branch badge, a broken chain when cut off; over the castle, the champion.
function drawStrategyMarks(p, s, baseY, py, th, tw, now) {
  let x = p.x - tw / 2 - 3 - th;
  const S = specOf(p);
  if (S) {
    ctx.fillStyle = PARCH; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, py, th, th, 3); ctx.fill(); ctx.stroke();
    const cx = x + th / 2, cy = py + th / 2, r = th * 0.3;
    ctx.fillStyle = INK;
    if (p.spec === 'keep') { ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy - r); ctx.lineTo(cx + r, cy); ctx.quadraticCurveTo(cx + r, cy + r, cx, cy + r * 1.2); ctx.quadraticCurveTo(cx - r, cy + r, cx - r, cy); ctx.closePath(); ctx.fill(); }
    else if (p.spec === 'barracks') { ctx.fillRect(cx - r * 0.15, cy - r * 1.1, r * 0.3, r * 2); ctx.fillRect(cx - r * 0.7, cy + r * 0.3, r * 1.4, r * 0.3); }
    else { ctx.fillStyle = '#e9b43b'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke(); }
    x -= th + 3;
  }
  if (p.owner && stratOn('supply') && !suppliedAt(p)) {
    // Cut off: a broken chain.
    const cx = x + th / 2, cy = py + th / 2, r = th * 0.22;
    ctx.strokeStyle = WARN; ctx.lineWidth = Math.max(1.5, th * 0.12);
    ctx.beginPath(); ctx.ellipse(cx - r * 1.1, cy, r, r * 0.7, 0, 0.3, Math.PI * 2 - 0.3); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + r * 1.1, cy, r, r * 0.7, 0, Math.PI + 0.3, Math.PI * 3 - 0.3); ctx.stroke();
  }
  if (heroAt(p)) drawChampion(p.x - s * 0.95, baseY - s * 0.2, s * 1.1, p.owner, now);
}
// The champion's standard: a tall pole with a long pennant in the army's colour and a gold finial.
function drawChampion(x, y, h, o, now) {
  const wave = reduceMotion ? 0 : Math.sin(now / 240 + x) * 1.5;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = col(o);
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.55, y - h + h * 0.12 + wave); ctx.lineTo(x + h * 0.4, y - h + h * 0.22 + wave * 0.5); ctx.lineTo(x + h * 0.55, y - h + h * 0.34 + wave); ctx.lineTo(x, y - h + h * 0.34); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#f3c64a'; ctx.beginPath(); ctx.arc(x, y - h - 2, 2.4, 0, Math.PI * 2); ctx.fill();
}
// On the column that carries it.
function drawHeroStandard(k, now) { drawChampion(k.x - (k.dir || 1) * 6, k.y + 2, 22, k.owner, now); }

// ---------- banners ----------
on('hero', ({ o, kind, castle }) => {
  if (!G || G.cfg.demo) return;
  const L = lordOf(o), name = `${L.short}'s champion`;
  if (o === 1) {
    if (kind === 'rides') toast('Your champion rides out', `Every column of this attack strikes ${Math.round((STRATEGY.heroStr - 1) * 100)}% harder. If it is wiped out, the champion falls.`, army(1).color);
    else if (kind === 'falls') toast('Your champion has fallen', `They will return in ${STRATEGY.heroBack} seconds, at your strongest castle.`, WARN);
    else if (kind === 'holds') toast('Your champion holds the castle', `They stay at ${castle && castle.kind ? 'the ' + CASTLE_KINDS[castle.kind].name.toLowerCase() : 'the castle they took'}, which defends ${Math.round((STRATEGY.heroDef - 1) * 100)}% better while they are there.`, army(1).color);
    else if (kind === 'returns') toast('Your champion returns', `They wait at your strongest castle, which defends ${Math.round((STRATEGY.heroDef - 1) * 100)}% better while they are there. Send ${STRATEGY.heroMin} or more troops from it to lead an attack.`, army(1).color);
  } else if (kind === 'falls') toast(`${name} has fallen`, `${army(o).full} attack without them for ${STRATEGY.heroBack} seconds.`, army(o).color);
});
on('specialise', ({ castle, branch }) => {
  if (!G || G.cfg.demo || castle.owner !== 1) return;
  const S = STRATEGY.spec[branch];
  toast(`A new ${S.name.toLowerCase()}`, S.desc, army(1).color);
});
