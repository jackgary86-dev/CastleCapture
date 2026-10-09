#!/usr/bin/env node
// Renders art/launch-bg.js to PNG files without a browser.
//
//   npm install @napi-rs/canvas      (one-off, anywhere on NODE_PATH; it is not a project dependency)
//   node tools/render-art.js [--out art] [--sizes 1920x1080,3840x2160]
//
// The same paint() function draws the picture in art/launch-bg.html, so the files match.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let createCanvas;
try { ({ createCanvas } = require('@napi-rs/canvas')); }
catch { console.error('Missing @napi-rs/canvas: run `npm install @napi-rs/canvas` (or set NODE_PATH to a folder that has it).'); process.exit(2); }

const opt = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? def : process.argv[i + 1]; };
const outDir = path.resolve(opt('out', path.join(__dirname, '..', 'art')));
const sizes = opt('sizes', '1920x1080,3840x2160').split(',').map(s => s.split('x').map(Number));

const art = f => fs.readFileSync(path.join(__dirname, '..', 'art', f), 'utf8');
const sandbox = {};
vm.runInNewContext(art('launch-bg.js') + '\n;\n' + art('gallery.js'), sandbox);

// --gallery renders one PNG per panel plus a contact sheet instead of the launch background.
if (process.argv.includes('--gallery')) {
  const PW = 960, PH = 600, cols = 4, gap = 16;
  const panels = sandbox.galleryPanels;
  const dir = path.join(outDir, 'gallery');
  fs.mkdirSync(dir, { recursive: true });
  const rows = Math.ceil(panels.length / cols);
  const sheet = createCanvas(cols * PW + (cols + 1) * gap, rows * PH + (rows + 1) * gap);
  const sctx = sheet.getContext('2d');
  sctx.fillStyle = '#17140e'; sctx.fillRect(0, 0, sheet.width, sheet.height);
  panels.forEach((panel, i) => {
    const c = createCanvas(PW, PH);
    sandbox.paintGalleryPanel(c.getContext('2d'), PW, PH, panel);
    const file = path.join(dir, `${panel.kind}-${panel.id}.png`);
    fs.writeFileSync(file, c.toBuffer('image/png'));
    sctx.drawImage(c, gap + (i % cols) * (PW + gap), gap + Math.floor(i / cols) * (PH + gap));
  });
  fs.writeFileSync(path.join(outDir, 'gallery.png'), sheet.toBuffer('image/png'));
  console.log(`wrote ${panels.length} panels to ${path.relative(process.cwd(), dir)} and gallery.png`);
  process.exit(0);
}

for (const [W, H] of sizes) {
  const canvas = createCanvas(W, H);
  sandbox.paintLaunchBackground(canvas.getContext('2d'), W, H);
  const file = path.join(outDir, `launch-bg${W === 1920 ? '' : `-${W}x${H}`}.png`);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${W}x${H})`);
}
