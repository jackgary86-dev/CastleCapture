// modes-ui.js
//
// What the three Modes cards share (#90): King of the Hill (hill-ui.js), Siege Defense (defense-ui.js) and
// Capture the Crown (crown-ui.js) each build a card in the menu's "Modes" group, a bar or line in the header,
// and banners. Loaded after js/ui.js and before those three; it defines the one global modeUi.

const modeUi = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // "You", or a rival lord's short name.
  const who = o => o === 1 ? 'You' : lordOf(o).short;
  const crownSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 19h18l-1.6-11-4.6 4.2L12 5 9.2 12.2 4.6 8z"/></svg>';

  // A rival as "Torvek of Kharzul", or just "Kharzul" on a narrow screen.
  const rivalName = (o, narrow = false) => narrow ? army(o).name : `${lordOf(o).short} of ${army(o).name}`;
  // Every rival, for the header's status line: "Torvek of Kharzul & Veyra of Nyxhollow".
  const rivalsText = () => {
    const narrow = matchMedia('(max-width: 560px)').matches;
    return G.owners.slice(1).map(o => rivalName(o, narrow)).join(' & ');
  };
  // A header bar entry's tooltip: "You: ..." or "Torvek of Kharzul: ...", escaped for an attribute.
  const barTitle = (o, text) => esc(`${o === 1 ? 'You' : rivalName(o)}: ${text}`);

  // `count` random rivals for armyId.
  const pickRivals = (armyId, count) => shuffle(ARMY_IDS.filter(id => id !== armyId)).slice(0, count);
  // A saved difficulty, or Knight when the saved value isn't one.
  const storedDiff = key => ['easy', 'medium', 'hard'].includes(store.get(key, 'medium')) ? store.get(key, 'medium') : 'medium';

  // The menu's "Modes" group, made the first time it's asked for: after the Grand Campaign group, or else
  // after the Campaign group, or else at the end of the menu.
  const labelled = text => [...document.querySelectorAll('#menu .sheet .group')].find(g => { const l = g.querySelector('.label'); return l && l.textContent.trim() === text; });
  function modesGroup() {
    const sheet = document.querySelector('#menu .sheet');
    let modes = labelled('Modes');
    if (!modes && sheet) {
      modes = document.createElement('div');
      modes.className = 'group modes';
      modes.innerHTML = '<span class="label">Modes</span>';
      const after = document.querySelector('#menu .sheet .group.grand') || labelled('Campaign');
      if (after) after.after(modes); else sheet.append(modes);
    }
    return modes;
  }

  // A segmented control: clicking a button presses it, releases the others, and passes its data-<attr> to set().
  const pickIn = (id, attr, set) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    set(b.dataset[attr]);
  });

  // Run fn whenever the menu is shown again (to refresh a card's records).
  function onMenuShown(fn) {
    const menu = $('menu');
    if (menu && typeof MutationObserver === 'function') new MutationObserver(() => { if (!menu.hidden) fn(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  }

  return { $, esc, who, crownSvg, rivalName, rivalsText, barTitle, pickRivals, storedDiff, modesGroup, pickIn, onMenuShown };
})();
