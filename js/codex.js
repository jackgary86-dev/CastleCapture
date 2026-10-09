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
    <div class="codex codex-3" id="codexMonsters"></div>
    <span class="sublabel">The realm</span>
    <div class="codex codex-4" id="codexRealm"></div>`;
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
      const saves = typeof AI_UNIT !== 'undefined' && typeof MAP_UNITS !== 'undefined' && MAP_UNITS[AI_UNIT[id]];
      html += section('As a rival', para(g.personality + (saves ? ` Saves coins for a ${saves.name}.` : '')));
      if (typeof UNIT_TYPES !== 'undefined') html += section('Troop types', list(Object.values(UNIT_TYPES).map(u => `${u.name}: ${u.desc}`)) + (id === 'kharzul' ? para('Torvek trusts his horses and never fields catapults.') : AI_SIEGE ? '' : para('As a rival, this army rides cavalry to reinforce but does not field catapults yet.')));
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

  // ---- the realm: the rules behind troops, castles, map units and powers, with simple painted icons ----
  const REALM = [
    { id: 'troops', name: 'Troop types', sub: 'Foot, cavalry, catapults' },
    { id: 'kinds', name: 'Castle kinds', sub: 'Fortress, war camp, village' },
    { id: 'units', name: 'Map units', sub: 'Ballista, trebuchet, ward' },
    { id: 'powers', name: 'Special powers', sub: 'One per army' },
  ];
  const GOLD = '#e9b43b', PALE = '#ece2c6';
  // An army's emblem as plain strokes, the same shapes access.js draws on plaques.
  function glyph(c, emblem, x, y, r, fill) {
    c.save(); c.translate(x, y); c.fillStyle = fill; c.strokeStyle = fill; c.lineCap = 'round';
    if (emblem === 'crown') {
      c.beginPath(); c.moveTo(-r, r * 0.7); c.lineTo(-r, -r * 0.3); c.lineTo(-r * 0.5, r * 0.1); c.lineTo(0, -r * 0.8);
      c.lineTo(r * 0.5, r * 0.1); c.lineTo(r, -r * 0.3); c.lineTo(r, r * 0.7); c.closePath(); c.fill();
    } else if (emblem === 'moon') {
      c.beginPath(); c.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false); c.arc(r * 0.45, 0, r * 0.8, Math.PI * 1.45, Math.PI * 0.55, true); c.closePath(); c.fill();
    } else if (emblem === 'snow') {
      c.lineWidth = Math.max(1, r * 0.32);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(-Math.cos(a) * r, -Math.sin(a) * r); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
    } else if (emblem === 'sun') {
      c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.fill(); c.lineWidth = Math.max(1, r * 0.22);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
    } else {
      c.lineWidth = Math.max(1, r * 0.25); c.beginPath(); c.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.32, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  function paintRealmIcon(c, W, H, id) {
    const u = H / 300;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2418'); g.addColorStop(1, '#17140e');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(233,180,59,0.08)'; c.beginPath(); c.arc(W / 2, H * 0.55, H * 0.42, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round';
    const stroke = (w, col = GOLD) => { c.strokeStyle = col; c.lineWidth = w * u; };
    const figure = (x, y, s) => {   // a foot soldier: head, body, legs
      c.fillStyle = PALE; c.beginPath(); c.arc(x, y - s * 1.1, s * 0.32, 0, Math.PI * 2); c.fill();
      stroke(5, PALE); c.beginPath(); c.moveTo(x, y - s * 0.75); c.lineTo(x, y); c.moveTo(x, y); c.lineTo(x - s * 0.4, y + s * 0.8); c.moveTo(x, y); c.lineTo(x + s * 0.4, y + s * 0.8); c.stroke();
    };
    if (id === 'troops') {
      const y = H * 0.62, s = 34 * u;
      figure(W * 0.22, y, s); stroke(4); c.beginPath(); c.moveTo(W * 0.22 + s * 0.5, y + s * 0.6); c.lineTo(W * 0.22 + s * 0.5, y - s * 1.9); c.stroke();   // spear
      // horse and rider
      const hx = W * 0.5, hy = y + s * 0.2;
      c.fillStyle = PALE; c.beginPath(); c.ellipse(hx, hy, s * 1.1, s * 0.5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(hx + s * 1.1, hy - s * 0.55, s * 0.42, s * 0.3, -0.5, 0, Math.PI * 2); c.fill();
      stroke(6, PALE); for (const dx of [-0.7, -0.3, 0.4, 0.8]) { c.beginPath(); c.moveTo(hx + dx * s, hy + s * 0.3); c.lineTo(hx + dx * s, hy + s * 1.1); c.stroke(); }
      figure(hx - s * 0.1, hy - s * 0.9, s * 0.7);
      // catapult: frame, arm, stone
      const cx = W * 0.8, cy = y + s * 0.6;
      stroke(6); c.beginPath(); c.moveTo(cx - s, cy); c.lineTo(cx + s, cy); c.moveTo(cx - s * 0.5, cy); c.lineTo(cx, cy - s * 0.9); c.lineTo(cx + s * 0.5, cy); c.stroke();
      c.beginPath(); c.moveTo(cx + s * 0.3, cy - s * 0.2); c.lineTo(cx - s * 0.9, cy - s * 1.9); c.stroke();
      c.fillStyle = PALE; c.beginPath(); c.arc(cx - s * 0.95, cy - s * 2.05, s * 0.28, 0, Math.PI * 2); c.fill();
      c.fillStyle = GOLD; for (const dx of [-0.8, 0.8]) { c.beginPath(); c.arc(cx + dx * s, cy + s * 0.15, s * 0.3, 0, Math.PI * 2); c.fill(); }
    } else if (id === 'kinds') {
      const y = H * 0.55, s = 40 * u;
      // shield
      let x = W * 0.22; stroke(6); c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y + s * 0.2); c.quadraticCurveTo(x + s, y + s * 1.1, x, y + s * 1.4); c.quadraticCurveTo(x - s, y + s * 1.1, x - s, y + s * 0.2); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(x, y - s * 0.6); c.lineTo(x, y + s); c.moveTo(x - s * 0.6, y + s * 0.1); c.lineTo(x + s * 0.6, y + s * 0.1); c.stroke();
      // crossed swords
      x = W * 0.5; stroke(7); c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y + s * 1.2); c.moveTo(x + s, y - s); c.lineTo(x - s, y + s * 1.2); c.stroke();
      stroke(7, PALE); c.beginPath(); c.moveTo(x - s * 0.55, y + s * 0.5); c.lineTo(x - s * 0.1, y + s * 0.95); c.moveTo(x + s * 0.55, y + s * 0.5); c.lineTo(x + s * 0.1, y + s * 0.95); c.stroke();
      // cottage
      x = W * 0.78; c.fillStyle = PALE; c.fillRect(x - s * 0.9, y, s * 1.8, s * 1.2);
      c.fillStyle = GOLD; c.beginPath(); c.moveTo(x - s * 1.1, y); c.lineTo(x, y - s); c.lineTo(x + s * 1.1, y); c.closePath(); c.fill();
      c.fillStyle = '#17140e'; c.fillRect(x - s * 0.22, y + s * 0.45, s * 0.44, s * 0.75);
      c.strokeStyle = GOLD; c.lineWidth = 2 * u; c.setLineDash([6 * u, 6 * u]); c.beginPath(); c.arc(x, y + s * 0.5, s * 1.9, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    } else if (id === 'units') {
      const y = H * 0.7, s = 36 * u;
      // ballista tower with a bolt
      let x = W * 0.2; c.fillStyle = PALE; c.fillRect(x - s * 0.45, y - s * 1.8, s * 0.9, s * 1.8);
      for (let i = -1; i <= 1; i++) c.fillRect(x + i * s * 0.35 - s * 0.12, y - s * 2.1, s * 0.24, s * 0.3);
      stroke(4); c.beginPath(); c.moveTo(x + s * 0.4, y - s * 1.3); c.lineTo(x + s * 1.6, y - s * 1.9); c.stroke();
      // trebuchet
      x = W * 0.5; stroke(6, PALE); c.beginPath(); c.moveTo(x - s, y); c.lineTo(x, y - s * 1.4); c.lineTo(x + s, y); c.moveTo(x - s * 1.1, y); c.lineTo(x + s * 1.1, y); c.stroke();
      stroke(5); c.beginPath(); c.moveTo(x + s * 0.7, y - s * 0.6); c.lineTo(x - s * 1.1, y - s * 2.3); c.stroke();
      c.fillStyle = GOLD; c.beginPath(); c.arc(x - s * 1.15, y - s * 2.45, s * 0.25, 0, Math.PI * 2); c.fill();
      c.fillStyle = PALE; c.fillRect(x + s * 0.55, y - s * 0.6, s * 0.3, s * 0.45);
      // great ward
      x = W * 0.8; stroke(5); c.beginPath(); c.arc(x, y - s * 0.8, s * 1.1, 0, Math.PI * 2); c.stroke();
      stroke(3); c.setLineDash([5 * u, 5 * u]); c.beginPath(); c.arc(x, y - s * 0.8, s * 1.5, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      stroke(5, PALE); c.beginPath(); c.moveTo(x, y - s * 1.5); c.lineTo(x, y - s * 0.1); c.moveTo(x - s * 0.6, y - s * 1.2); c.lineTo(x + s * 0.6, y - s * 0.4); c.moveTo(x + s * 0.6, y - s * 1.2); c.lineTo(x - s * 0.6, y - s * 0.4); c.stroke();
    } else if (id === 'powers') {
      const ids = typeof ARMY_IDS !== 'undefined' ? ARMY_IDS : Object.keys(info.ARMIES);
      ids.forEach((aid, i) => {
        const x = W * (0.14 + i * 0.18), y = H * 0.55, r = 30 * u, A = game.armies && game.armies[aid];
        c.fillStyle = '#17140e'; c.beginPath(); c.arc(x, y, r * 1.35, 0, Math.PI * 2); c.fill();
        c.strokeStyle = A ? A.color : GOLD; c.lineWidth = 3 * u; c.stroke();
        glyph(c, A ? A.emblem : 'sun', x, y, r * 0.8, A ? A.color : GOLD);
      });
    }
  }
  const realmGrid = document.getElementById('codexRealm');
  for (const entry of REALM) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.kind = 'realm'; b.dataset.id = entry.id;
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    try { paintRealmIcon(cv.getContext('2d'), TW, TH, entry.id); } catch {}
    const name = document.createElement('b'); name.textContent = entry.name;
    const sub = document.createElement('small'); sub.textContent = entry.sub;
    b.append(cv, name, sub);
    b.setAttribute('aria-label', `Open the codex entry for ${entry.name}`);
    realmGrid.append(b);
  }
  const table = (head, rows) => `<table class="codex-table"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
  const x = v => `${v}×`;
  function realmEntry(id) {
    const entry = REALM.find(e => e.id === id);
    title.innerHTML = `${esc(entry.name)}<span class="chip" style="--c:#e9b43b;--ci:#2a2014">The realm</span>`;
    let html = '';
    if (id === 'troops' && typeof UNIT_TYPES !== 'undefined') {
      html += section('Choosing a type', para('The Troops buttons in the command bar, or T, set the type every column you send from then on will be. A castle trains plain troops; the type is chosen when they march.'));
      html += table(['Type', 'Speed', 'Against castles', 'On the road', 'Best for'], Object.values(UNIT_TYPES).map(t => [t.name, x(t.speed), x(t.siege), x(t.road), t.desc]));
      html += section('Using them', list(['Cavalry reach a threatened castle long before foot, and catch enemy columns on the road, but bounce off walls.', 'Catapults crack castles open but crawl and lose road fights: send foot alongside, or wait until the road is clear.', 'The rival lords field foot and cavalry; the AI keeps its catapults for sieges with an escort.']));
    } else if (id === 'kinds' && typeof CASTLE_KINDS !== 'undefined') {
      html += section('Special castles', para('About a quarter of the unclaimed keeps on a map are special. Each carries a badge beside its troop count, and keeps its kind when captured.'));
      html += table(['Kind', 'Badge', 'Defence', 'Training', 'Effect'], Object.values(CASTLE_KINDS).map(k => [k.name, k.name === 'Fortress' ? 'Shield' : k.name === 'War camp' ? 'Crossed swords' : 'Cottage', x(k.def), k.prod ? x(k.prod) : 'none', k.desc]));
      html += section('Sizes and upkeep', list(['Bigger castles train faster and hold more: small, medium and large keeps are capped at 60, 90 and 120 troops, plus 15 per Walls level; troops above the cap desert.', 'Training halves once a garrison passes twice the castle\'s size and halves again past four times.', 'Walls make defenders count more and archers shoot faster and farther; Barracks train faster and make stronger soldiers. A captured castle loses one level of each.']));
    } else if (id === 'units' && typeof MAP_UNITS !== 'undefined') {
      html += section('Buying one', para(`Every castle earns coins each minute by size (1, 2 or 3), up to a treasury of ${typeof COIN_CAP !== 'undefined' ? COIN_CAP : 300}. Press B or Map units to open the shop and place one unit per battle within reach of your castles. In the Grand Campaign purchases are queued as orders.`));
      html += table(['Unit', 'Role', 'Price', 'Range', 'What it does'], Object.values(MAP_UNITS).map(m => [m.name, m.kind, `${m.price} coins`, m.range, m.desc]));
      const lords = typeof AI_UNIT !== 'undefined' && game.lords ? Object.entries(AI_UNIT).filter(([aid]) => game.lords[aid]).map(([aid, u]) => `${game.lords[aid].short} saves for a ${MAP_UNITS[u].name}.`) : [];
      if (lords.length) html += section('What the lords buy', list(lords));
    } else if (id === 'powers' && game.armies) {
      const ids = typeof ARMY_IDS !== 'undefined' ? ARMY_IDS : Object.keys(game.armies);
      html += section('Timing', para(`Press Q, or click the power panel in the top left of the map. A power is first ready ${typeof FIRST_CHARGE !== 'undefined' ? FIRST_CHARGE : 45} seconds into a battle and then every ${typeof RECHARGE !== 'undefined' ? Math.round(RECHARGE / 60) : 5} minutes (the Power recharge setting changes this). Player 2 uses R. In the Grand Campaign a power is queued as an order and fires when the wave marches.`));
      html += table(['Army', 'Power', 'Lasts', 'Effect'], ids.map(aid => { const A = game.armies[aid]; return [A.name, A.power.name, `${A.power.dur}s`, A.power.desc]; }));
    } else {
      html += para('Nothing to show.');
    }
    body.innerHTML = html;
  }

  let lastFocus = null;
  function open(kind, id) {
    lastFocus = document.activeElement;
    if (kind === 'realm') { try { paintRealmIcon(art.getContext('2d'), art.width, art.height, id); } catch {} realmEntry(id); }
    else {
      try { paintGalleryPanel(art.getContext('2d'), art.width, art.height, { kind, id }); } catch {}
      if (kind === 'army') armyEntry(id); else monsterEntry(id);
    }
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
