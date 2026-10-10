// mind.js
//
// Smarter AI lords (#68): rivals with memory rather than bots. No DOM access; sim.js calls in through
// mindTick(), mindPz() and mindWorthMul(), and js/mind-ui.js shows the banners and the debug overlay.
//
// - Coalitions: when one realm holds AI_MIND.coalitionAt of all the troops on the map, the other lords
//   sign truces with each other and focus on it (an AI leader's rivals also offer the player a place in
//   it). The truces break once the leader falls below AI_MIND.coalitionEnd.
// - Grudges: a lord remembers who took its castles and who broke a truce with it, wants that realm's
//   castles more for it, and says so. Grudges fade with time and are saved with the game (G.mind).
// - Reading the player: a lord fighting a person notices a rusher (builds up its garrisons) or a turtle
//   (expands faster while the walls go up).
// - Openings: each lord picks one of two or three named openings per battle, so the same lord plays
//   differently from game to game. Not in the Grand Campaign, which has its own opening rule.
//
// None of it plays in King of the Hill, Capture the Crown or Siege Defense (MIND_MODES_OFF).
// AI_MIND.on (or cfg.aiMind === false for one game) turns all of it off; tools/balance.js can set any
// value with --set mind.<key>=<value>.

const AI_MIND = {
  on: true,
  // coalitionEnd: 0.35 since #72 (was 0.3), so a coalition breaks up before it stalls a Grand Campaign.
  coalitionAt: 0.4, coalitionEnd: 0.35, coalitionFocus: 1.6, coalitionAfter: 60, coalitionCool: 60,
  grudgeCapture: 1, grudgeBetray: 3, grudgeDecay: 0.01, grudgeWeight: 0.2, grudgeMax: 4, grudgeSay: 3,
  adapt: true, openings: true, openingSecs: 60,
};
// Each lord's openings: multipliers on its personality (ARMIES[id].ai) for the first openingSecs seconds;
// `keep` is added rather than multiplied. They are kept small on purpose: each changes how a lord plays
// without making it stronger or weaker (at twice these sizes Sigrun won 72% of Warlord battles).
const LORD_OPENINGS = {
  aldmere: [{ name: 'Stone by stone', keep: 2, neutralBias: 1.08 }, { name: 'The long wall', defendAt: 1.12, keep: 1 }, { name: 'Royal progress', neutralBias: 1.15 }],
  kharzul: [{ name: 'Red dawn', enemyBias: 1.12 }, { name: 'The wide ride', neutralBias: 1.12 }, { name: 'Hunt the weak', opportunist: 1.2 }],
  frostmark: [{ name: 'Shield wall', defendAt: 1.12, keep: 1 }, { name: 'Raiding season', enemyBias: 1.1 }],
  solmara: [{ name: 'Caravan roads', neutralBias: 1.15 }, { name: 'Gold for blood', opportunist: 1.15 }, { name: 'The patient purse', keep: 2 }],
  nyx: [{ name: 'Whispering mire', opportunist: 1.15 }, { name: 'Night tide', enemyBias: 1.1 }],
  // The alternate lords (#71, LORDS_ALT in data.js).
  aldmereAlt: [{ name: 'Open gates', defendAt: 1.12 }, { name: 'First lance', enemyBias: 1.1 }],
  kharzulAlt: [{ name: 'On the ridge', keep: 2 }, { name: 'Loose and wheel', opportunist: 1.15 }],
  frostmarkAlt: [{ name: 'Thaw', neutralBias: 1.12 }, { name: 'First slide', enemyBias: 1.1 }],
  solmaraAlt: [{ name: 'Signed and sealed', keep: 2 }, { name: 'Trade winds', neutralBias: 1.15 }],
  nyxAlt: [{ name: 'Still water', defendAt: 1.12, keep: 1 }, { name: 'Rising damp', neutralBias: 1.12 }],
};

// King of the Hill, Capture the Crown and Siege Defense give the lords their own tactics for the mode, and are
// balanced on those alone, so the smarter lords play skirmishes, story battles and the Grand Campaign.
const MIND_MODES_OFF = ['hill', 'crown', 'defense'];
const mindOn = () => AI_MIND.on && G && G.cfg.aiMind !== false && !G.cfg.demo && !G.cfg.tutorial && !MIND_MODES_OFF.includes(G.mode);
on('newGame', g => {
  g.mind = { grudges: {}, said: {}, coalition: null, coalCool: 0, style: { toEnemy: 0, toNeutral: 0 } };
});
const grudgeOf = (o, q) => (G.mind && G.mind.grudges[o] && G.mind.grudges[o][q]) || 0;
function addGrudge(o, q, n) {
  if (!mindOn() || !o || !q || o === q) return;
  const g = (G.mind.grudges[o] ??= {});
  g[q] = Math.min(AI_MIND.grudgeMax * 2, (g[q] || 0) + n);
}
on('capture', ({ o, was }) => { if (was && G.mind) addGrudge(was, o, AI_MIND.grudgeCapture); });
on('pactEnd', ({ a, b, by }) => { if (by && G.mind) addGrudge(by === a ? b : a, by, AI_MIND.grudgeBetray); });

// ---------- every step ----------
function mindTick(dt) {
  if (!mindOn() || !G.mind) return;
  const M = G.mind;
  // Grudges fade; a lord who reaches grudgeSay against a person says so, once until it fades again.
  for (const [o, g] of Object.entries(M.grudges)) for (const q of Object.keys(g)) {
    const key = `${o}-${q}`;
    if (g[q] >= AI_MIND.grudgeSay && !M.said[key] && human(+q) && !human(+o)) { M.said[key] = 1; lordSays(+o, 'grudge', true); }
    else if (g[q] < 1 && M.said[key]) delete M.said[key];
    g[q] = Math.max(0, g[q] - AI_MIND.grudgeDecay * dt);
  }
  // The player's style, from the columns they have marching.
  if (AI_MIND.adapt) for (const k of G.packets) {
    // Counted once: the flag rides on the column, so a saved and resumed game doesn't count it again.
    if (k.owner !== 1 || k.styled) continue;
    k.styled = true;
    if (k.to && k.to.owner && k.to.owner !== 1 && !k.to.monster) M.style.toEnemy++;
    else if (k.to && !k.to.owner) M.style.toNeutral++;
  }
  mindCoalition();
}

// ---------- coalitions ----------
function mindCoalition() {
  const M = G.mind, alive = aliveOwners();
  if (!G.pacts) return;
  if (M.coalition) {
    const C = M.coalition, sum = alive.reduce((a, o) => a + totalOf(o), 0) || 1;
    if (!alive.includes(C.against) || alive.length < 3 || totalOf(C.against) / sum < AI_MIND.coalitionEnd) endCoalition(alive.includes(C.against) ? 'checked' : 'fallen');
    return;
  }
  if (alive.length < 3 || G.time < AI_MIND.coalitionAfter || G.time < M.coalCool) return;
  const sum = alive.reduce((a, o) => a + totalOf(o), 0) || 1, lead = leaderOf();
  if (totalOf(lead) / sum < AI_MIND.coalitionAt) return;
  const lords = alive.filter(o => o !== lead && !human(o) && G.ais.some(ai => ai.id === o));
  if (!lords.length) return;
  const members = [...lords];
  // Every pair of lords against the leader makes peace (Torvek included: he wants the leader's blood more).
  for (let i = 0; i < lords.length; i++) for (let j = i + 1; j < lords.length; j++) {
    const [a, b] = [lords[i], lords[j]];
    if (allied(a, b) || (G.betrayers || {})[a] || (G.betrayers || {})[b]) continue;
    makePact(a, b);
    const p = pactOf(a, b);
    p.until = G.time + 1e7; p.coalition = true;   // until the coalition ends (a finite number: saves are JSON)
  }
  // Against another lord, the strongest of the rest invites the player into the coalition. Accepting makes the
  // player a member: their truce with that lord lasts until the coalition breaks up (see 'offerAnswered').
  const people = alive.filter(o => o !== lead && human(o));
  if (people.length && !G.offer) {
    const ranked = [...lords].sort((a, b) => totalOf(b) - totalOf(a));
    M.invite = { from: ranked[0], to: people[0], against: lead };
    if (proposeTruce(ranked[0], people[0]) !== 'pending') M.invite = null;
  }
  M.coalition = { against: lead, since: G.time, members };
  for (const o of lords) lordSays(o, 'coalition');
  emit('coalition', { kind: 'formed', against: lead, members });
}
on('offerAnswered', ({ from, yes }) => {
  const M = G && G.mind, inv = M && M.invite;
  if (!inv || inv.from !== from) return;
  M.invite = null;
  const C = M.coalition, p = yes && pactOf(from, inv.to);
  if (!p || !C || C.against !== inv.against) return;
  p.until = G.time + 1e7; p.coalition = true;
  if (!C.members.includes(inv.to)) C.members.push(inv.to);
  emit('coalition', { kind: 'joined', against: C.against, members: C.members, o: inv.to });
});
function endCoalition(why) {
  const M = G.mind, C = M.coalition;
  M.coalition = null; M.invite = null;
  M.coalCool = G.time + AI_MIND.coalitionCool;
  for (const p of G.pacts) if (p.coalition && G.time < p.until) endPact(p, null);
  emit('coalition', { kind: 'ended', against: C.against, members: C.members, why });
}

// ---------- the lord's thinking ----------
const humanStyle = () => {
  const s = G.mind && G.mind.style;
  if (!s) return 'balanced';
  const total = s.toEnemy + s.toNeutral;
  if (total >= 4 && s.toEnemy / total >= 0.6 && G.time < 240) return 'rusher';
  const walls = G.planets.filter(p => p.owner === 1).reduce((a, p) => a + lvl(p, 'walls') + lvl(p, 'barracks'), 0);
  if (walls >= 3 && s.toEnemy <= 2) return 'turtle';
  return 'balanced';
};
// Adjusts a lord's personality (a copy, pz) for this decision: its opening, and how the player plays.
function mindPz(ai, pz) {
  if (!mindOn()) return;
  if (AI_MIND.openings && G.mode !== 'grand') {
    const list = LORD_OPENINGS[lordKey(ai.id)];
    // Chosen from the map's seed, not Math.random: a replayed seed gets the same openings, and the choice
    // doesn't shift the random numbers every later decision draws.
    if (list && ai.opening == null) ai.opening = Math.abs(((G.cfg.seed | 0) * 31 + ai.id * 7919) | 0) % list.length;
    const op = list && list[ai.opening];
    if (op && G.time < AI_MIND.openingSecs) for (const [k, v] of Object.entries(op)) {
      if (k === 'name' || !(k in pz)) continue;
      pz[k] = k === 'keep' ? pz[k] + v : pz[k] * v;
    }
  }
  if (AI_MIND.adapt && G.owners.some(o => human(o)) && G.mode !== 'grand') {
    const style = humanStyle();
    if (style === 'rusher') { pz.keep += 3; pz.defendAt *= 1.2; }
    else if (style === 'turtle') pz.neutralBias *= 1.25;
    ai.read = style;
  }
}
// How much more a lord wants castle t: a grudge against its owner, and the coalition's target.
function mindWorthMul(ai, t) {
  if (!mindOn() || !t.owner) return 1;
  let mul = 1 + Math.min(AI_MIND.grudgeMax, grudgeOf(ai.id, t.owner)) * AI_MIND.grudgeWeight;
  const C = G.mind && G.mind.coalition;
  if (C && t.owner === C.against && C.members.includes(ai.id)) mul *= AI_MIND.coalitionFocus;
  return mul;
}
const openingName = ai => { const l = LORD_OPENINGS[lordKey(ai.id)]; return l && ai.opening != null ? l[ai.opening].name : null; };
