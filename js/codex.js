// codex.js
//
// "Armies and monsters" on the main menu: a painted card for each army and monster (from
// art/gallery.js) that opens a codex entry with the art and everything known about them: story,
// strength and stats, special power, personality, homeland, and the lord with their lines.
// Loaded after js/grand-menu.js. Listens and reads only; it never changes game state.

(() => {
  if (typeof paintGalleryPanel !== 'function' || typeof galleryPanels === 'undefined') return;
  const sheet = document.querySelector('#menu .sheet');
  const board = document.getElementById('board');
  if (!sheet || !board) return;
  const info = galleryInfo;
  const game = { armies: typeof ARMIES !== 'undefined' ? ARMIES : null, lords: typeof LORDS !== 'undefined' ? LORDS : null };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- the section on the menu sheet ----
  const group = document.createElement('div');
  group.className = 'group';
  group.innerHTML = `<span class="label">Armies and monsters</span>
    <p class="codex-lead">Who you can lead, and what waits on the Grand Campaign maps. Open an entry for its story, strengths, power and lord.</p>
    <div class="codex" id="codexArmies"></div>
    <div class="codex codex-3" id="codexMonsters"></div>`;
  const rules = [...sheet.querySelectorAll('.label')].find(l => l.textContent.trim() === 'Rules of war');
  if (rules && rules.parentElement && rules.parentElement !== sheet) rules.parentElement.before(group); else sheet.append(group);

  const cards = galleryPanels.filter(p => p.kind === 'army' || p.kind === 'monster');
  const TW = 480, TH = 300;
  for (const panel of cards) {
    const entry = panel.kind === 'army' ? info.ARMIES[panel.id] : info.MONSTERS[panel.id];
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.kind = panel.kind; b.dataset.id = panel.id;
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    try { paintGalleryPanel(cv.getContext('2d'), TW, TH, panel); } catch {}
    b.append(cv);
    const name = document.createElement('b'); name.textContent = panel.kind === 'army' ? entry.name : entry.name;
    const sub = document.createElement('small'); sub.textContent = panel.kind === 'army' ? `${entry.role} · ${entry.lord.split(',')[0]}` : entry.title;
    b.append(name, sub);
    b.setAttribute('aria-label', `Open the codex entry for ${entry.name}`);
    document.getElementById(panel.kind === 'army' ? 'codexArmies' : 'codexMonsters').append(b);
  }

  // ---- the codex entry overlay ----
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'codexOv'; ov.hidden = true;
  ov.innerHTML = `<div class="sheet codex-sheet" role="dialog" aria-modal="true" aria-labelledby="codexTitle">
    <canvas id="codexArt" width="960" height="600"></canvas>
    <h2 id="codexTitle"></h2>
    <div id="codexBody"></div>
    <div class="row"><button id="codexClose">Close</button></div>
  </div>`;
  board.append(ov);
  const art = document.getElementById('codexArt'), title = document.getElementById('codexTitle'), body = document.getElementById('codexBody');

  const section = (h, html) => `<h3>${esc(h)}</h3>${html}`;
  const para = t => `<p>${esc(t)}</p>`;
  const list = items => `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  const stat = (label, v) => `<div><span>${esc(label)}</span><strong>${esc(v)}</strong></div>`;
  const lineKinds = { capture: 'Taking one of your castles', lose: 'Losing a castle', power: 'Using their power', counter: 'Striking back', nearDefeat: 'Near defeat', surrender: 'Surrendering', victory: 'Victory', defeat: 'Defeat' };

  function armyEntry(id) {
    const g = game.armies && game.armies[id], L = game.lords && game.lords[id], a = info.ARMIES[id], T = info.THEMES[a.theme];
    const chip = `<span class="chip" style="--c:${esc(g ? g.color : '#e9b43b')};--ci:${esc(g ? g.ink : '#2a2014')}">${esc(a.role)}</span>`;
    title.innerHTML = `${esc(g ? g.full : a.full)}${chip}`;
    let html = '';
    if (g) {
      html += section('Story', para(g.story));
      html += section('Strength', para(g.strength));
      const s = g.stats;
      html += section('Stats', `<div class="codex-stats">${stat('Attack', s.atk + '×')}${stat('Defence', s.def + '×')}${stat('Speed', s.speed + '×')}${stat('Training', s.prod + '×')}${stat('On the road', s.road + '×')}${stat('Vs keeps', s.neutral + '×')}</div>`);
      html += section(`Special power: ${g.power.name}`, para(`${g.power.desc} Lasts ${g.power.dur} seconds; ready 45 seconds into a battle, then every five minutes.`));
      html += section('As a rival', para(g.personality));
      html += section('Homeland', para(`${g.homeland}. Castles are built in the ${esc(a.castle)} style; its banners are ${g.flag === 'streamer' ? 'long streamers' : g.flag === 'tassel' ? 'horsehair tassels' : g.flag === 'square' ? 'square standards' : g.flag === 'pennant' ? 'long pennants' : 'swallow-tailed flags'}.`));
    } else {
      html += section('Homeland', para(T.name));
    }
    if (L) {
      html += section(`Lord: ${L.name}`, para(`${L.title[0].toUpperCase() + L.title.slice(1)}. ${L.bio}`) + `<p class="codex-quote">“${esc(L.challenge)}”</p>`);
      const lines = Object.entries(L.lines).filter(([k]) => lineKinds[k]).map(([k, v]) => `${lineKinds[k]}: “${v[0]}”`);
      html += section('Things they say', list(lines));
    }
    body.innerHTML = html;
  }

  function monsterEntry(id) {
    const m = info.MONSTERS[id];
    title.innerHTML = `${esc(m.name)}<span class="chip" style="--c:#e0362f;--ci:#fff8e6">Monster</span>`;
    body.innerHTML = section(m.title, para(m.story))
      + section('Where it roams', para(`${m.map}. It returns ${m.respawn} waves after it is killed, spawning far from every army's castles.`))
      + section('Abilities', list(m.abilities))
      + section('Health and bounty', `<div class="codex-stats codex-stats-3">${stat('Health', m.health)}${stat('Bounty', `${m.bounty} coins`)}${stat('Strength', m.strength)}</div>` + para('Damage dealt is tracked for every army, but the whole bounty goes to whoever lands the final blow.'))
      + section('How to beat it', para(m.tactics))
      + `<p class="codex-quote">“${esc(m.quote)}”</p>`;
  }

  let lastFocus = null;
  function open(kind, id) {
    lastFocus = document.activeElement;
    try { paintGalleryPanel(art.getContext('2d'), art.width, art.height, { kind, id }); } catch {}
    if (kind === 'army') armyEntry(id); else monsterEntry(id);
    ov.hidden = false;
    ov.querySelector('.sheet').scrollTop = 0;
    document.getElementById('codexClose').focus();
  }
  function close() {
    ov.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  group.addEventListener('click', e => { const b = e.target.closest('button[data-kind]'); if (b) open(b.dataset.kind, b.dataset.id); });
  document.getElementById('codexClose').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) { e.stopImmediatePropagation(); close(); } }, true);
})();
