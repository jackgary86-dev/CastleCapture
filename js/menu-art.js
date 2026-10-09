// menu-art.js
//
// Paints the launch background (art/launch-bg.js) behind the main menu and keeps it sized to the
// board. It only watches the menu overlay's `hidden` attribute, so it needs no hooks in ui.js.

(() => {
  const menu = document.getElementById('menu');
  const art = document.getElementById('menuArt');
  const title = document.getElementById('menuTitle');
  const board = document.getElementById('board');
  const actx = art.getContext('2d');
  let painted = '';

  function paint() {
    if (menu.hidden) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(board.clientWidth * dpr), H = Math.round(board.clientHeight * dpr);
    const key = `${W}x${H}`;
    if (!W || !H || key === painted) return;
    art.width = W; art.height = H;
    paintLaunchBackground(actx, W, H);
    painted = key;
  }

  function sync() {
    art.hidden = menu.hidden;
    if (title) title.hidden = menu.hidden;
    paint();
  }

  new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  new ResizeObserver(paint).observe(board);
  sync();
})();
