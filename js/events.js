// events.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// Random map events (#35): every 60 to 90 seconds of battle one of four things happens, announced
// with a toast. Mercenaries fill an unclaimed keep; plague thins a garrison; a bandit column
// raids the weakest castle; a harvest speeds one kingdom's training for a while. Off by default,
// with a toggle in the Skirmish menu. Event state lives on G (G.ev) so saves carry it.

(() => {
  const EV_KEY = 'cs-events';
  const EVERY_MIN = 60, EVERY_MAX = 90;   // seconds between events
  const FIRST = 60;                        // no event before this point of a battle
  const MERC_TROOPS = 30, MERC_GLOW = 90;  // extra troops in the keep, and how long its glow lasts
  const PLAGUE_FRAC = 0.3;
  const HARVEST_SECONDS = 30;
  const BANDIT_MIN = 8, BANDIT_MAX = 40;
  const BANDIT_COLOR = ARMIES.bandits.color;

  let eventsOn = store.get(EV_KEY, false);
  // The bandit column's owner id: one past the kingdoms, so it never collides with a player.
  const banditId = () => G.owners.length + 1;
  const active = () => G && G.ev && G.cfg.events && !G.cfg.demo && !G.cfg.tutorial && !G.over && !G.intro;
  const owned = () => G.planets.filter(p => p.owner && p.owner <= G.owners.length);
  const neutral = () => G.planets.filter(p => p.owner === 0);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const say = (title, detail, color) => { if (typeof toast === 'function') toast(title, detail, color); };
  const who = o => o === 1 ? 'your' : `${army(o).name}'s`;

  // ---------- the four events ----------
  const EVENTS = {
    mercenaries: {
      can: () => neutral().length > 0,
      run() {
        const keep = neutral().sort((a, b) => a.units - b.units)[0];
        keep.units += MERC_TROOPS;
        G.ev.merc = { id: keep.id, until: G.time + MERC_GLOW };
        say('Mercenaries', `A company of ${MERC_TROOPS} sellswords has camped in an unclaimed keep. They join whoever takes it first.`, '#e9b43b');
      },
    },
    plague: {
      can: () => owned().some(p => p.units >= 10),
      run() {
        const p = pick(owned().filter(q => q.units >= 10));
        const lost = Math.floor(p.units * PLAGUE_FRAC);
        p.units = Math.max(1, p.units - lost);
        G.ev.plague = { id: p.id, until: G.time + 4 };
        say('Plague', `Sickness sweeps ${who(p.owner)} ${p.kind === 'village' ? 'village' : 'castle'}: ${lost} troops are lost.`, '#7a8a5a');
      },
    },
    bandits: {
      can: () => owned().length > 0 && G.planets.length > 1,
      run() {
        // The weakest held castle, judged by its defence, is the target; the column sets out from
        // the unclaimed keep (or failing that, any castle) farthest from it, so it is seen coming.
        const target = owned().sort((a, b) => a.units * defAt(a) - b.units * defAt(b))[0];
        const starts = (neutral().length ? neutral() : G.planets).filter(p => p !== target);
        const from = starts.sort((a, b) => dist(b, target) - dist(a, target))[0];
        if (!from) return;
        const n = Math.max(BANDIT_MIN, Math.min(BANDIT_MAX, Math.ceil(target.units * defAt(target) * 0.7) + 6));
        const owner = banditId();
        const path = pathOf(from, target).pts, first = path[0];
        const ang = Math.atan2(first.y - from.y, first.x - from.x);
        const files = Math.min(12, Math.max(3, Math.ceil(n / 3)));
        for (let i = 0; i < files; i++) {
          const cnt = Math.floor(n / files) + (i < n % files ? 1 : 0);
          const off = (Math.random() - 0.5) * from.r * 0.8;
          G.packets.push({
            owner, from, to: target, n: cnt, str: 1, delay: i * 0.08, phase: Math.random() * 6.28,
            path, wp: 0, jx: (Math.random() - 0.5) * 4, jy: (Math.random() - 0.5) * 4,
            x: from.x + Math.cos(ang) * from.r * 0.8 - Math.sin(ang) * off, y: from.y + Math.sin(ang) * from.r * 0.8 + Math.cos(ang) * off,
          });
        }
        say('Bandits', `A raiding party of ${n} is marching on ${who(target.owner)} ${target.kind === 'village' ? 'village' : 'castle'}.`, BANDIT_COLOR);
      },
    },
    harvest: {
      can: () => owned().length > 0,
      run() {
        const o = pick(G.owners.filter(q => G.planets.some(p => p.owner === q)));
        G.ev.harvest = { o, until: G.time + HARVEST_SECONDS };
        say('Harvest', `A rich harvest in ${o === 1 ? 'your lands' : army(o).homeland}: ${o === 1 ? 'your' : army(o).name} castles train half again as fast for ${HARVEST_SECONDS} seconds.`, army(o).color);
      },
    },
  };

  function fire() {
    const names = Object.keys(EVENTS).filter(k => EVENTS[k].can());
    if (!names.length) return;
    const name = pick(names);
    EVENTS[name].run();
    G.ev.last = name;
    emit('mapEvent', { name });
  }

  // ---------- wiring into the battle ----------
  on('newGame', () => {
    if (G.cfg.events === undefined) G.cfg.events = eventsOn && !G.cfg.demo && !G.cfg.tutorial;
    G.ev = { next: FIRST + rnd(0, EVERY_MAX - EVERY_MIN), merc: null, plague: null, harvest: null, last: null };
    // The bandit column needs an army behind its owner id for strength, speed and colour lookups.
    const b = banditId();
    G.fac[b] = 'bandits';
    G.pw[b] = { ready: 1e9, until: -1 };
    if (G.coins) G.coins[b] = 0;
  });
  // Bandits hold nothing: a castle they overrun is left unclaimed with the survivors inside.
  on('capture', ({ o, castle }) => {
    if (!G || o !== banditId()) return;
    castle.owner = 0;
    castle.rally = null;
    say('Bandits', 'The raiders sacked the castle and scattered. It stands unclaimed.', BANDIT_COLOR);
  });

  const updateBeforeEvents = update;
  update = function (dt) {
    updateBeforeEvents(dt);
    if (!active()) return;
    const ev = G.ev;
    if (ev.merc && (G.time > ev.merc.until || G.planets[ev.merc.id].owner !== 0)) ev.merc = null;
    if (ev.plague && G.time > ev.plague.until) ev.plague = null;
    if (ev.harvest && G.time > ev.harvest.until) ev.harvest = null;
    // The Grand Campaign is paced by waves, not the clock (see the 'wave' listener below).
    if (G.mode === 'grand') return;
    if (G.time >= ev.next) {
      ev.next = G.time + rnd(EVERY_MIN, EVERY_MAX);
      fire();
    }
  };
  // In the Grand Campaign an event opens every few march phases, so it is seen before the plans
  // for the next wave are made.
  const GRAND_EVERY = 4;
  on('wave', ({ wave, phase }) => {
    if (phase !== 'march' || !active() || !G.mode || G.mode !== 'grand') return;
    if (wave > 1 && wave % GRAND_EVERY === 0) fire();
  });

  // Glows over the finished frame: gold round a keep holding mercenaries, a sickly haze over a
  // plagued castle, and a green shimmer round a harvesting kingdom's castles.
  const drawBeforeEvents = draw;
  draw = function (now) {
    drawBeforeEvents(now);
    if (!G || !G.ev || G.cfg.demo) return;
    const ev = G.ev;
    if (!ev.merc && !ev.plague && !ev.harvest) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(sc, sc);
    const pulse = reduceMotion ? 0.7 : 0.5 + 0.3 * Math.sin(now / 260);
    const ring = (p, color, w) => {
      ctx.save(); ctx.translate(p.x, p.y + p.r * 0.45); ctx.scale(1, 0.5);
      ctx.beginPath(); ctx.arc(0, 0, p.r * 1.7, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
    };
    if (ev.merc && G.planets[ev.merc.id]) ring(G.planets[ev.merc.id], `rgba(233, 180, 59, ${pulse})`, 5);
    if (ev.plague && G.planets[ev.plague.id]) {
      const p = G.planets[ev.plague.id], a = Math.max(0, (ev.plague.until - G.time) / 4) * 0.45;
      ctx.fillStyle = `rgba(110, 140, 70, ${a})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - p.r * 0.2, p.r * 1.8, p.r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (ev.harvest) for (const p of G.planets) if (p.owner === ev.harvest.o) ring(p, `rgba(140, 200, 90, ${pulse * 0.8})`, 3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // ---------- menu toggle ----------
  const anchor = document.getElementById('tauntSeg');
  if (anchor && anchor.parentNode && typeof anchor.after === 'function') {
    const label = document.createElement('span');
    label.className = 'sublabel'; label.textContent = 'Map events';
    const seg = document.createElement('div');
    seg.className = 'seg'; seg.id = 'eventSeg';
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Map events');
    seg.innerHTML = `<button data-events="off" aria-pressed="${!eventsOn}">Off</button><button data-events="on" aria-pressed="${eventsOn}">On</button>`;
    const note = document.createElement('p');
    note.style.fontSize = '13px';
    note.textContent = 'Mercenaries, plague, bandit raids and harvests, every minute or two.';
    anchor.after(label, seg, note);
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      eventsOn = b.dataset.events === 'on';
      store.set(EV_KEY, eventsOn);
      seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    });
  }
})();
