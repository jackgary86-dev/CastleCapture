// progress-ui.js
//
// Progression (#70) in the browser: the Profile entry on the menu and its page (renown, the unlock shop,
// the realm map, the hall of fame, records, export and import), the renown line on the end screen, and the
// two cosmetic hooks render.js asks for (the player's banner shape and roof colour). The rules and the
// saved state live in js/progress.js.

// ---------- cosmetics, read by render.js ----------
// Only in a real game: the menu's demo battle keeps every army's own look.
const skinsOn = () => G && !G.cfg.demo;
function playerBannerShape() { const u = skinsOn() && equipped('banner'); return u ? u.shape : null; }
function playerRoofCol(c) { const u = skinsOn() && equipped('roof'); return u ? u.color : c; }

// ---------- the end screen ----------
on('end', () => {
  let box = document.getElementById('endRenown');
  if (!box) {
    box = document.createElement('div');
    box.id = 'endRenown'; box.className = 'end-renown';
    document.getElementById('endQuote').after(box);
  }
  box.hidden = !lastRenown || !lastRenown.lines.length;
  if (box.hidden) return;
  box.innerHTML = '<b></b><ul></ul>';
  box.querySelector('b').textContent = `+${lastRenown.total} renown · ${career.renown} to spend`;
  const ul = box.querySelector('ul');
  for (const [why, n] of lastRenown.lines) {
    const li = document.createElement('li');
    li.textContent = n ? `${why}: +${n}` : why;
    ul.append(li);
  }
  refreshProfileButton();
});

// ---------- the menu entry ----------
const profileGroup = document.createElement('div');
profileGroup.className = 'group';
profileGroup.innerHTML = '<span class="label">Profile and renown</span><button id="btnProfile"></button>';
document.getElementById('btnAch').closest('.group').after(profileGroup);
const btnProfile = document.getElementById('btnProfile');
function refreshProfileButton() {
  btnProfile.textContent = `Profile: ${career.renown} renown to spend, ${career.owned.length} of ${UNLOCKS.length} unlocks`;
}
refreshProfileButton();

// ---------- the profile page ----------
const profOv = document.createElement('div');
profOv.className = 'overlay'; profOv.id = 'profileOv'; profOv.hidden = true;
profOv.innerHTML = `<div class="sheet prof-sheet" role="dialog" aria-labelledby="profTitle">
  <h2 id="profTitle">Profile</h2>
  <dl class="records" id="profStats"></dl>
  <span class="label">Banners and roofs</span>
  <p class="prof-note">Cosmetic: they change how your castles look and nothing else.</p>
  <div class="prof-shop" id="profLooks"></div>
  <span class="label">Alternate lords</span>
  <p class="prof-note">A second lord for each army, with their own tactics, lines and twist on the power. Once bought, pick them on the army card; rival armies may then field them too.</p>
  <div class="prof-shop" id="profLords"></div>
  <span class="label">Starting map units</span>
  <p class="prof-note">Skirmishes only. The unit stands beside your home castle from the start and uses up that battle's one map unit.</p>
  <label class="prof-toggle"><input type="checkbox" id="profUseUnit"> Bring my starting unit into skirmishes</label>
  <div class="prof-shop" id="profUnits"></div>
  <span class="label">Realm map</span>
  <p class="prof-note" id="profRealmNote"></p>
  <label class="prof-toggle"><input type="checkbox" id="profUseRealm"> Use the realm bonus in Grand Campaigns</label>
  <div class="prof-realm" id="profRealm"></div>
  <div class="row"><button id="profSeason">Begin a new season</button></div>
  <span class="label">Hall of fame</span>
  <div id="profHall"></div>
  <span class="label">Recent renown</span>
  <ul class="prof-log" id="profLog"></ul>
  <span class="label">Save and share</span>
  <div class="row">
    <button id="profExport">Export profile</button>
    <button id="profImportBtn">Import profile</button>
    <input type="file" id="profImport" accept="application/json,.json" hidden>
  </div>
  <p class="gs-note" id="profNote" role="status"></p>
  <div class="row"><button class="primary" id="profClose">Back to the menu</button></div>
</div>`;
document.getElementById('board').append(profOv);
const $p = id => document.getElementById(id);

const fmtDay = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
let seasonArmed = 0;

function shopRow(u) {
  const owned = career.owned.includes(u.id), on = u.kind === 'lord' ? owned : career.equip[u.kind] === u.id;
  const b = document.createElement('button');
  b.className = 'prof-item' + (on ? ' on' : '');
  b.dataset.id = u.id;
  b.disabled = !owned && career.renown < u.price;
  b.setAttribute('aria-pressed', String(on));
  const swatch = u.kind === 'roof' ? `<span class="prof-swatch" style="background:${u.color}"></span>` : u.kind === 'lord' ? portraitHtml(u.army, true) : '';
  b.innerHTML = `${swatch}<span><b></b><small></small></span><em></em>`;
  b.querySelector('b').textContent = u.name;
  b.querySelector('small').textContent = u.desc;
  b.querySelector('em').textContent = u.kind === 'lord' ? (owned ? 'Owned' : `${u.price} renown`) : on ? 'In use' : owned ? 'Use' : `${u.price} renown`;
  return b;
}
function renderProfile() {
  const r = typeof ach === 'object' ? ach.rec : {};
  const stats = [
    ['Renown to spend', career.renown], ['Renown earned', career.earned], ['Season', career.season],
    ['Battles won', r.wins || 0], ['Grand Campaigns won', r.grandWon || 0], ['Hills taken', r.hillWon || 0],
    ['Most siege waves', r.defenseBestWave || 0], ['Monsters slain', r.slain || 0],
  ];
  $p('profStats').innerHTML = '';
  for (const [k, v] of stats) {
    const d = document.createElement('div');
    d.innerHTML = '<dt></dt><dd></dd>';
    d.querySelector('dt').textContent = k; d.querySelector('dd').textContent = v;
    $p('profStats').append(d);
  }
  $p('profLooks').replaceChildren(...UNLOCKS.filter(u => u.kind === 'banner' || u.kind === 'roof').map(shopRow));
  $p('profLords').replaceChildren(...UNLOCKS.filter(u => u.kind === 'lord').map(shopRow));
  $p('profUnits').replaceChildren(...UNLOCKS.filter(u => u.kind === 'unit').map(shopRow));
  $p('profUseUnit').checked = career.useUnit;
  $p('profUseRealm').checked = career.useRealm;

  // The realm map: one tile per Grand Campaign map, in the colours of the army that claimed it this season.
  const held = Object.keys(career.regions).length;
  $p('profRealmNote').textContent = `Season ${career.season}, since ${fmtDay(career.seasonStart)}. Win a Grand Campaign to claim its map. `
    + `Each region claimed adds ${REALM_BONUS.perRegion} troops to your home castle at the start of a Grand Campaign (at most ${REALM_BONUS.max}); now +${realmBonus()}.`;
  $p('profRealm').replaceChildren(...Object.entries(GRAND_MAPS).map(([id, m]) => {
    const c = career.regions[id], tile = document.createElement('div');
    tile.className = 'prof-region' + (c ? ' claimed' : '');
    if (c) tile.style.setProperty('--c', ARMIES[c.army].color);
    tile.innerHTML = '<b></b><small></small>';
    tile.querySelector('b').textContent = m.name;
    tile.querySelector('small').textContent = c ? `Claimed by ${ARMIES[c.army].name}, ${fmtDay(c.at)}` : 'Unclaimed';
    return tile;
  }));
  $p('profSeason').disabled = !held;
  $p('profSeason').textContent = seasonArmed && Date.now() - seasonArmed < 4000 ? 'Really end this season?' : 'Begin a new season';

  const hall = $p('profHall');
  hall.innerHTML = '';
  if (!career.hall.length) { hall.innerHTML = '<p class="prof-note">Seasons you close are remembered here.</p>'; }
  for (const h of career.hall) {
    const p = document.createElement('p');
    p.className = 'prof-hall';
    p.textContent = `Season ${h.season} (${fmtDay(h.from)} to ${fmtDay(h.to)}): ${h.regions.map(x => `${GRAND_MAPS[x.map].name} for ${ARMIES[x.army].name}`).join(', ')}; ${h.earned} renown earned.`;
    hall.append(p);
  }
  $p('profLog').replaceChildren(...(career.log.length ? career.log : [{ why: 'Nothing yet: win a battle.', n: 0, t: 0 }]).map(e => {
    const li = document.createElement('li');
    li.textContent = e.n ? `+${e.n} · ${e.why}${e.t ? ` · ${fmtDay(e.t)}` : ''}` : e.why;
    return li;
  }));
  refreshProfileButton();
}

btnProfile.addEventListener('click', () => {
  $p('profNote').textContent = ''; renderProfile(); profOv.hidden = false;
  profOv.scrollTop = 0; $p('profClose').focus({ preventScroll: true });   // open at the top, with Back a Tab away
});
$p('profClose').addEventListener('click', () => { profOv.hidden = true; btnProfile.focus(); });
profOv.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); profOv.hidden = true; btnProfile.focus(); } });
// Buying puts the unlock to use; clicking the one in use takes it off again.
profOv.addEventListener('click', e => {
  const b = e.target.closest('.prof-item');
  if (!b || b.disabled) return;
  const u = unlockById(b.dataset.id);
  if (u.kind === 'lord') {
    // Lords are picked on the army card; here they are only bought.
    if (!career.owned.includes(u.id) && buyUnlock(u.id)) { $p('profNote').textContent = `${LORDS_ALT[u.army].short} will lead ${ARMIES[u.army].name} when you pick that army.`; sfx.chime(); renderArmies(); }
  } else if (career.equip[u.kind] === u.id) equipUnlock(u.kind, null);
  else if (career.owned.includes(u.id)) equipUnlock(u.kind, u.id);
  else if (buyUnlock(u.id)) { $p('profNote').textContent = `Bought: ${u.name}.`; sfx.chime(); }
  renderProfile();
  const again = profOv.querySelector(`[data-id="${u.id}"]`);
  if (again) again.focus();
});
$p('profUseUnit').addEventListener('change', e => { career.useUnit = e.target.checked; saveProgress(); });
$p('profUseRealm').addEventListener('change', e => { career.useRealm = e.target.checked; saveProgress(); });
$p('profSeason').addEventListener('click', () => {
  // Two clicks, since the realm map can't be brought back.
  if (!seasonArmed || Date.now() - seasonArmed > 4000) { seasonArmed = Date.now(); renderProfile(); setTimeout(renderProfile, 4100); return; }
  seasonArmed = 0;
  newSeason();
  $p('profNote').textContent = `Season ${career.season} has begun. The last one is in the hall of fame.`;
  renderProfile();
});

// ---------- export and import ----------
$p('profExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(career)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'castle-siege-profile.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $p('profNote').textContent = 'Profile exported.';
});
$p('profImportBtn').addEventListener('click', () => $p('profImport').click());
$p('profImport').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $p('profNote').textContent = importProfile(await f.text()) || 'Profile imported.';
  renderProfile();
});
// Returns an error message, or '' once the profile has replaced this one.
function importProfile(text) {
  let d;
  try { d = JSON.parse(text); } catch { return 'That file is not a Castle Siege profile.'; }
  if (!d || typeof d !== 'object' || d.v !== 1 || !Number.isFinite(d.renown)) return 'That file is not a Castle Siege profile.';
  career = cleanProgress(d);
  career.pastDeeds = true;   // an imported profile brings its own history
  saveProgress();
  refreshProfileButton();
  return '';
}

// ---------- alternate lords on the army card (#71) ----------
// The dossier's Lord line: the lord who will lead the army, and a choice between the two once the alternate is owned.
function lordCardHtml(army) {
  const base = LORDS[army], alt = LORDS_ALT[army], useAlt = ownsLord(army) && career.lordPick[army] === 'alt';
  const L = useAlt ? alt : base;
  const text = `<b>${L.name}, ${L.title}.</b> ${L.bio}${useAlt ? ` <i>${alt.playstyle} ${alt.power.twist}</i>` : ''}`;
  if (!alt) return text;
  if (!ownsLord(army)) return `${text} <small class="lord-note">${alt.name} can lead ${ARMIES[army].name} instead: ${alt.price} renown on the Profile page.</small>`;
  return `<span class="lord-pick" role="group" aria-label="Who leads ${ARMIES[army].name}">`
    + `<button type="button" data-lordpick="base" aria-pressed="${!useAlt}">${portraitHtml(army)}${base.short}</button>`
    + `<button type="button" data-lordpick="alt" aria-pressed="${useAlt}">${portraitHtml(army, true)}${alt.short}</button></span>${text}`;
}
document.getElementById('dossier').addEventListener('click', e => {
  const b = e.target.closest('[data-lordpick]');
  if (!b) return;
  setLordPick(myArmy, b.dataset.lordpick === 'alt');
  renderArmies();
  const again = document.querySelector(`#dossier [data-lordpick="${b.dataset.lordpick}"]`);
  if (again) again.focus();
});
renderArmies();
