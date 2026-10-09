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

const src = fs.readFileSync(path.join(__dirname, '..', 'art', 'launch-bg.js'), 'utf8');
const sandbox = {};
vm.runInNewContext(src, sandbox);

for (const [W, H] of sizes) {
  const canvas = createCanvas(W, H);
  sandbox.paintLaunchBackground(canvas.getContext('2d'), W, H);
  const file = path.join(outDir, `launch-bg${W === 1920 ? '' : `-${W}x${H}`}.png`);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${W}x${H})`);
}
