// story.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// Story campaigns (#27): the menu ladder for the chosen army's chapters (js/campaigns.js), the
// parchment story screen before each battle, the objective badge during it, progress per army
// under cs-camp-<army>, and the victory text. Armies without a campaign keep the shared LEVELS
// ladder. Browser only.

(() => {
  const $ = id => document.getElementById(id);
  const board = $('board'), ladderEl = $('ladder');
  if (!board || !ladderEl) return;
  const NUMERAL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const camp = id => (ARMIES[id] && Array.isArray(ARMIES[id].campaign) && ARMIES[id].campaign.length ? ARMIES[id].campaign : null);
  const progKey = id => `cs-camp-${id}`;
  const progress = id => { const p = store.get(progKey(id), null); return p && typeof p === 'object' ? { unlocked: p.unlocked || 1, done: Array.isArray(p.done) ? p.done : [] } : { unlocked: 1, done: [] }; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------- the menu ladder ----------
  const group = ladderEl.closest('.group');
  const lead = group && group.querySelector('p');
  const leadBase = lead ? lead.textContent : '';
  const renderLadderBase = renderLadder;
  renderLadder = function () {
    const C = camp(myArmy);
    if (!C) { renderLadderBase(); ladderEl.classList.remove('story'); if (lead) lead.textContent = leadBase; return; }
    const { unlocked, done } = progress(myArmy), L = LORDS[myArmy];
    if (lead) lead.textContent = `${L.name}'s story in ${C.length} battles, ending in a showdown with ${LORDS[C[C.length - 1].rivals[0]].name}.`;
    ladderEl.classList.add('story');
    ladderEl.innerHTML = C.map((ch, i) => {
      const n = i + 1, locked = n > unlocked;
      const rivals = ch.rivals.map(id => `${LORDS[id].short} of ${ARMIES[id].name}`).join(' & ');
      return `<button data-level="${n}" ${locked ? 'disabled' : ''} class="${done.includes(n) ? 'done' : ''}" title="${esc(ch.name)}: vs ${esc(rivals)} · ${DIFF_NAME[ch.diff]}"><b>${NUMERAL[i]}</b><small>${locked ? 'Locked' : esc(ch.name)}</small></button>`;
    }).join('');
  };

  // ---------- the story screen ----------
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'storyOv'; ov.hidden = true;
  ov.innerHTML = `<div class="sheet story-sheet" role="dialog" aria-modal="true" aria-labelledby="storyTitle">
    <span class="story-eyebrow" id="storyEyebrow"></span>
    <h2 id="storyTitle"></h2>
    <div class="lords" id="storyLines"></div>
    <div class="story-objective" id="storyObjective"></div>
    <div class="row"><button class="primary" id="storyGo">To battle</button><button id="storyBack">Back</button></div>
  </div>`;
  board.append(ov);
  let pending = null;   // the cfg the story screen will start

  function chapterCfg(armyId, n) {
    const C = camp(armyId), ch = C[n - 1];
    const map = ch.map === 'home' ? armyId : ch.map;
    return {
      seed: ch.seed, n: ch.n, diff: ch.diff, armies: [armyId, ...ch.rivals], map, fixedSeed: true,
      campaign: armyId, chapter: n, ...(ch.setup || {}),
    };
  }
  function showStory(armyId, n) {
    const C = camp(armyId), ch = C[n - 1];
    if (!ch) return;
    pending = chapterCfg(armyId, n);
    $('storyEyebrow').textContent = `${ARMIES[armyId].full} · Chapter ${n} of ${C.length}`;
    $('storyTitle').textContent = ch.name;
    $('storyLines').innerHTML = (ch.story || []).map(line => {
      const L = LORDS[line.who], A = ARMIES[line.who];
      return `<div class="lord">${portraitHtml(line.who)}<div><h3>${esc(L.name)}</h3><div class="title">${esc(L.title[0].toUpperCase() + L.title.slice(1))} · ${esc(A.name)}</div><q>${esc(line.text)}</q></div></div>`;
    }).join('');
    $('storyObjective').innerHTML = `<b>${objectiveTitle(pending)}</b>${esc(ch.objective || '')}`;
    ov.hidden = false;
    $('storyGo').focus();
  }
  const objectiveTitle = cfg => cfg.holdFor ? `Hold out for ${fmt(cfg.holdFor)}` : cfg.mustTake ? 'Take the castle ringed in gold' : 'Take every enemy castle';
  $('storyGo').addEventListener('click', () => { if (!pending) return; ov.hidden = true; play(pending); });
  $('storyBack').addEventListener('click', () => { ov.hidden = true; pending = null; });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) { e.stopImmediatePropagation(); ov.hidden = true; pending = null; } }, true);

  // The ladder's click handler and the Next battle button both call startLevel(n). Next battle
  // passes lastCfg.level + 1, which a story chapter does not set, so recover the chapter from lastCfg.
  const startLevelBase = startLevel;
  startLevel = function (lv) {
    const armyId = Number.isFinite(lv) ? myArmy : (typeof lastCfg === 'object' && lastCfg && lastCfg.campaign);
    if (!Number.isFinite(lv) && armyId) lv = lastCfg.chapter + 1;
    if (armyId && camp(armyId) && lv >= 1 && lv <= camp(armyId).length) showStory(armyId, lv);
    else if (Number.isFinite(lv)) startLevelBase(lv);
  };

  // ---------- the end of a chapter ----------
  const endGameBase = endGame;
  endGame = function (win) {
    endGameBase(win);
    if (!G || !G.cfg.campaign) return;
    const armyId = G.cfg.campaign, n = G.cfg.chapter, C = camp(armyId), ch = C && C[n - 1];
    if (!ch) return;
    if (win) {
      const p = progress(armyId);
      store.set(progKey(armyId), { unlocked: Math.max(p.unlocked, Math.min(C.length, n + 1)), done: [...new Set([...p.done, n])] });
    }
    const last = n === C.length, rival = LORDS[ch.rivals[0]];
    $('endText').textContent = win
      ? ch.after || `${ch.name} is won.`
      : G.cfg.holdFor
        ? `The keep fell with ${fmt(Math.max(0, G.cfg.holdFor - G.time))} still to hold. ${rival.short} keeps the field, for now.`
        : `${ch.name} is lost. ${rival.name} keeps the field, for now. Fight it again.`;
    $('seedLine').hidden = true;
    $('btnNext').hidden = !(win && !last);
    if (win && last) $('endTitle').textContent = 'The story ends';
  };

  // ---------- during the battle: the objective badge and the gold ring ----------
  const badge = document.createElement('div');
  badge.id = 'objective'; badge.hidden = true; badge.setAttribute('role', 'status');
  board.append(badge);
  let badgeText = '';
  const drawBeforeStory = draw;
  draw = function (now) {
    drawBeforeStory(now);
    const show = G && G.cfg.campaign && !G.over && !G.intro && !G.cfg.demo;
    if (!show) { if (!badge.hidden) badge.hidden = true; return; }
    const cfg = G.cfg, target = G.mustTake != null ? G.planets[G.mustTake] : null;
    const text = cfg.holdFor ? `<b>Hold out</b>${fmt(Math.max(0, cfg.holdFor - G.time))} to go`
      : target ? `<b>Objective</b>Take the castle ringed in gold (${Math.floor(target.units)} inside)`
      : `<b>Objective</b>Take every enemy castle`;
    if (text !== badgeText) { badge.innerHTML = text; badgeText = text; }
    // Until the first send, the drag hint is painted at the bottom centre too; sit above it.
    badge.classList.toggle('above-hint', !G.hintDone);
    if (badge.hidden) badge.hidden = false;
    if (!target || target.owner === 1) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
    const pulse = reduceMotion ? 0.8 : 0.55 + 0.35 * Math.sin(now / 220);
    ctx.save(); ctx.translate(target.x, target.y + target.r * 0.45); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, target.r * 1.75, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 210, 90, ${pulse})`; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  renderLadder();
})();
