// mind-ui.js
//
// Smarter AI lords (#68) in the browser: banners when a coalition forms against a runaway leader or breaks
// up, and a debug overlay listing each lord's opening, current target, grudges and read of the player.
// The overlay is behind a dev flag: open the game with ?aidebug in the address, or set
// localStorage 'cs-ai-debug' to '1'. The rules live in js/mind.js.

on('coalition', ({ kind, against, members }) => {
  if (!G || G.cfg.demo) return;
  const target = against === 1 ? 'you' : lordOf(against).short;
  const list = (members || []).map(o => lordOf(o).short);
  const names = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list.join('');
  if (kind === 'formed') toast(against === 1 ? 'A coalition rises against you!' : `A coalition against ${target}`,
    against === 1 ? `${names} have made peace with each other to bring you down.` : `${names} have made peace with each other to stop ${target}.`,
    against === 1 ? '#c0392b' : army(against).color);
  else toast('The coalition breaks up', `${target === 'you' ? 'You are' : `${target} is`} no longer the realm's great threat. Every lord for themselves again.`, '#cbbb92');
});

const aiDebugOn = (() => {
  try { return /[?&]aidebug\b/.test(location.search) || localStorage.getItem('cs-ai-debug') === '1'; } catch { return false; }
})();
if (aiDebugOn) {
  const box = document.createElement('pre');
  box.id = 'aiDebug';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:absolute;left:12px;bottom:12px;z-index:3;margin:0;padding:8px 10px;max-width:min(520px,calc(100% - 24px));'
    + 'font:12px/1.35 ui-monospace,Consolas,monospace;color:#f4ecd6;background:rgb(10 8 14 / 0.82);border:1px solid #6b5a3a;border-radius:4px;pointer-events:none;white-space:pre-wrap;';
  document.getElementById('board').append(box);
  setInterval(() => {
    box.hidden = !G || G.cfg.demo || !G.mind;
    if (box.hidden) return;
    const name = o => o === 0 ? 'unclaimed' : human(o) ? 'you' : lordOf(o).short;
    const C = G.mind.coalition, lines = [`AI debug · ${Math.round(G.time)}s · player reads as ${humanStyle()}`];
    lines.push(C ? `coalition against ${name(C.against)}: ${C.members.map(name).join(', ')}` : 'no coalition');
    for (const ai of G.ais) {
      const g = G.mind.grudges[ai.id] || {}, plan = ai.plan && G.planets[ai.plan.t];
      const grudges = Object.entries(g).filter(([, v]) => v >= 0.5).map(([q, v]) => `${name(+q)} ${v.toFixed(1)}`).join(', ') || 'none';
      lines.push(`${name(ai.id).padEnd(8)} ${(openingName(ai) || '-').padEnd(16)} target ${plan ? `#${plan.id} (${name(ai.plan.owner)}) ${Math.round(G.time - ai.plan.at)}s ago` : '-'} · grudges ${grudges}`);
    }
    box.textContent = lines.join('\n');
  }, 500);
}
