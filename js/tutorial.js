// tutorial.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// A guided first battle. Seven lessons, each waiting until the player does it, on a fixed map at
// home against a calm rival whose AI only wakes for the final lesson. Browser only.

const TUT_KEY = 'cs-tut-done';
const TUT_SEED = 2024;
let tut = null;   // lesson state for the current tutorial battle

const nearest = (from, list) => list.reduce((b, p) => !b || dist(from, p) < dist(from, b) ? p : b, null);
const mineNow = () => G.planets.filter(p => p.owner === 1);
const rivalCastle = () => G.planets.filter(p => p.owner === 2).sort((a, b) => b.units - a.units)[0];
// Lessons only use plain keeps: a fortress's doubled defenders would ask more than the lesson has taught.
const lessonKeeps = () => {
  const plain = G.planets.filter(p => p.owner === 0 && p.kind !== 'fortress');
  return plain.length ? plain : G.planets.filter(p => p.owner === 0);
};
const plainKeep = p => { if (p && p.kind === 'fortress') delete p.kind; return p; };

// Each lesson: a title, the instruction (which may read the lesson state), optional setup, the castles
// to ring in gold, and a done() check against the game state.
const LESSONS = [
  {
    title: 'Send your first troops',
    text: () => 'Drag from your castle (gold ring) onto the unclaimed keep marked in gold. Your troops march along the road and take it.',
    setup(t) {
      const home = mineNow()[0];
      t.home = home;
      t.keep = plainKeep(nearest(home, lessonKeeps()));
      t.keep.units = Math.min(t.keep.units, 5);
    },
    rings: t => [t.home, t.keep],
    done: t => t.keep.owner === 1,
  },
  {
    title: 'Choose how many to send',
    text: t => `Each order sends a share of a castle's troops. Press 1 to 4, scroll the mouse wheel, or use the Send buttons to pick an amount. Choose ${t.goalPct * 100}% now.`,
    setup(t) { t.goalPct = sendPct === 1 ? 0.25 : 1; },
    rings: () => [],
    done: t => sendPct === t.goalPct,
  },
  {
    title: 'Attack from several castles',
    text: () => 'Drag across both of your castles, then onto the keep marked in gold. Every castle you pass over sends troops. (Or press Space to select all your castles, then click the keep.)',
    setup(t) {
      t.multi = false;
      const mine = mineNow();
      t.keep2 = plainKeep(lessonKeeps().sort((a, b) => dist(a, nearest(a, mine)) - dist(b, nearest(b, mine)))[0]);
    },
    rings: t => [...mineNow(), t.keep2].filter(Boolean),
    done: t => t.multi,
  },
  {
    title: 'Watch for red banners',
    text: () => 'Enemy troops are marching on your castle marked in gold. The red banner over it counts them, and a pulsing ring means it will fall. Send troops from your other castles to reinforce it.',
    setup(t) {
      const enemy = rivalCastle(), mine = mineNow();
      t.threat = nearest(enemy, mine);
      t.threat.units = Math.min(t.threat.units, 12);
      enemy.units = Math.max(enemy.units, 70);
      send(2, [enemy], t.threat, 0.5);
      t.reinforced = false;
    },
    rings: t => [t.threat],
    done: t => t.reinforced || !G.packets.some(k => k.owner === 2 && k.to === t.threat),
  },
  {
    title: 'Meet them on the road',
    text: t => `${t.note || ''}Enemy soldiers are about to march on the keep marked in gold. Armies that meet on the road fight, and the stronger column marches on. Send troops to that keep to catch them on the way.`,
    setup(t) {
      const mine = mineNow();
      // The unclaimed keep nearest your lands, so your column can meet theirs before it arrives.
      t.contested = plainKeep(lessonKeeps().sort((a, b) => dist(a, nearest(a, mine)) - dist(b, nearest(b, mine)))[0]);
      t.clashed = false; t.retries = 0; t.note = '';
      if (t.contested) launchRaid(t);
    },
    // If they get there first, put the keep back and send them again, twice at most.
    update(t) {
      if (!t.contested || t.clashed || t.contested.owner !== 2 || G.packets.some(k => k.owner === 2 && k.to === t.contested)) return;
      if (t.retries >= 2) { t.giveUp = true; return; }
      t.retries++;
      t.contested.owner = 0; t.contested.units = 10;
      t.note = 'They got there first. Send your troops as soon as the column sets out. ';
      launchRaid(t);
    },
    rings: t => t.contested ? [t.contested] : [],
    done: t => !t.contested || t.clashed || t.contested.owner === 1 || t.giveUp,
  },
  {
    title: 'Use your special power',
    text: () => { const P = army(1).power; return `Your army's power is ready: ${P.name}. ${P.desc} Press Q, or click the power panel at the top left.`; },
    setup(t) { G.pw[1].ready = 0; t.powered = false; },
    rings: () => [],
    done: t => t.powered,
  },
  {
    title: 'Take their castle',
    text: () => `${lordOf(2).short} will fight back now. Capture every enemy castle to win. Tip: your castles earn coins, and B opens the shop for a map unit.`,
    setup() { G.ais = [{ id: 2, diff: 'easy', timer: 2, readyAt: null, counter: null, focus: null, recentCaps: [], snap: new Map() }]; },
    rings: () => G.planets.filter(p => p.owner === 2),
    done: () => G.over,
  },
];

// The enemy column for the road lesson waits 3 seconds before setting out, so there's time to read.
function launchRaid(t) {
  const enemy = rivalCastle();
  enemy.units = Math.max(enemy.units, 60);
  const before = new Set(G.packets);
  send(2, [enemy], t.contested, 0.4);
  for (const k of G.packets) if (!before.has(k)) k.delay += 3;
}

// ---------- running the lessons ----------
function startLesson(i) {
  tut.i = i;
  tut.at = G.time;
  LESSONS[i].setup?.(tut);
}
function tutorialTick() {
  // tutCardEl is the lesson card created below.
  if (!G || !G.cfg.tutorial || G.over) { tutCardEl.hidden = true; return; }
  if (!tut || tut.game !== G) {
    // A new tutorial battle, or Fight again: the rival stays idle until the last lesson.
    tut = { game: G, i: -1 };
    G.ais = [];
    G.hintDone = true;
  }
  if (G.intro) { tutCardEl.hidden = true; return; }
  if (tut.i < 0) startLesson(0);
  // Keep the rival alive through the lessons, so it can't surrender before the final one.
  if (tut.i < LESSONS.length - 1) { const e = rivalCastle(); if (e) e.units = Math.max(e.units, 40); }
  if (!G.paused) LESSONS[tut.i].update?.(tut);
  if (!G.paused && LESSONS[tut.i].done(tut) && tut.i < LESSONS.length - 1) { sfx.chime(); startLesson(tut.i + 1); }
  tauntEl.hidden = true;
  const L = LESSONS[tut.i];
  document.getElementById('tutStep').textContent = `Lesson ${tut.i + 1} of ${LESSONS.length}`;
  document.getElementById('tutTitle').textContent = L.title;
  const text = L.text(tut);
  const p = document.getElementById('tutText');
  if (p.textContent !== text) p.textContent = text;
  document.getElementById('tutSkip').hidden = tut.i === LESSONS.length - 1;
  tutCardEl.hidden = false;
}
setInterval(tutorialTick, 150);

// Lessons that need to know how the player sent troops.
const playerSendBase = playerSend;
playerSend = function (t) {
  if (tut && G && G.cfg.tutorial && tut.i >= 0) {
    const sources = [...sel].filter(s => s !== t && s.owner === 1);
    if (sources.length >= 2) tut.multi = true;
    if (t === tut.threat && sources.length) tut.reinforced = true;
  }
  playerSendBase(t);
};
on('clash', ({ attacker, defender, road }) => { if (tut && road && (attacker === 1 || defender === 1)) tut.clashed = true; });
on('power', ({ o }) => { if (tut && o === 1) tut.powered = true; });
on('end', ({ win }) => {
  if (!G || !G.cfg.tutorial) return;
  if (win) store.set(TUT_KEY, true);
  document.getElementById('endText').textContent = win
    ? 'Tutorial complete. You know the basics: choose an army in the menu and march to war.'
    : 'The tutorial battle was lost, but the lessons still count. Fight again, or head to the menu and start a real battle.';
  document.getElementById('btnNext').hidden = true;
  renderLearn();
});

// Gold rings round the castles each lesson is about, drawn over the finished frame.
const drawBeforeTutorial = draw;
draw = function (now) {
  drawBeforeTutorial(now);
  if (!tut || !G || G.over || G.intro || !G.cfg.tutorial || tut.i < 0) return;
  const rings = LESSONS[tut.i].rings(tut);
  if (!rings.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
  const pulse = reduceMotion ? 0.8 : 0.55 + 0.35 * Math.sin(now / 220);
  for (const p of rings) {
    ctx.save(); ctx.translate(p.x, p.y + p.r * 0.45); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, p.r * 1.75, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 210, 90, ${pulse})`; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

// ---------- starting it ----------
function startTutorial() {
  const me = myArmy, rival = me === 'frostmark' ? 'aldmere' : 'frostmark';
  tut = null;
  play({ tutorial: true, seed: TUT_SEED, n: 12, diff: 'easy', armies: [me, rival], map: me });
}

const tutCardEl = document.createElement('div');
tutCardEl.id = 'tutCard'; tutCardEl.hidden = true;
tutCardEl.setAttribute('role', 'region'); tutCardEl.setAttribute('aria-label', 'Tutorial');
tutCardEl.innerHTML = `<button class="tut-head" id="tutHead" aria-expanded="true" title="Show or hide the lesson"><span class="tut-step" id="tutStep"></span><b id="tutTitle"></b></button><p id="tutText" aria-live="polite"></p>
  <div class="tut-actions"><button id="tutSkip">Skip this lesson</button><button id="tutLeave">Leave the tutorial</button></div>`;
document.getElementById('board').append(tutCardEl);
// Tap the heading to fold the card down to one line when it covers the map.
document.getElementById('tutHead').addEventListener('click', e => {
  const folded = tutCardEl.classList.toggle('folded');
  e.currentTarget.setAttribute('aria-expanded', String(!folded));
});
document.getElementById('tutSkip').addEventListener('click', () => { if (tut && tut.i < LESSONS.length - 1) startLesson(tut.i + 1); });
document.getElementById('tutLeave').addEventListener('click', () => { tut = null; store.set(TUT_KEY, true); tutCardEl.hidden = true; toMenu(); renderLearn(); });

// Menu entry: offered up front until the tutorial has been played or dismissed, then kept as a small replay button.
const learnGroup = document.createElement('div');
learnGroup.className = 'group learn';
document.querySelector('#menu .sheet > p').after(learnGroup);
function renderLearn() {
  const fresh = !store.get(TUT_KEY, false) && !store.get('cs-hint', false);
  learnGroup.classList.toggle('fresh', fresh);
  learnGroup.innerHTML = fresh
    ? `<span class="label">New to Castle Siege?</span><p>A short guided battle teaches the basics, one step at a time, in about three minutes.</p>
       <div class="row"><button class="primary" id="btnLearn">Play the tutorial</button><button id="btnLearnNo">No thanks</button></div>`
    : `<span class="label">Learn to play</span><div class="row"><button id="btnLearn">Play the tutorial again</button></div>`;
  document.getElementById('btnLearn').addEventListener('click', startTutorial);
  document.getElementById('btnLearnNo')?.addEventListener('click', () => { store.set(TUT_KEY, true); renderLearn(); });
}
renderLearn();
