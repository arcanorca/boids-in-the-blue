#!/usr/bin/env node
// Overlap debug image: steps the real sim, draws every fish as a sprite-sized box (7 x 6 cells * size)
// with a heading tick; boxes of fish that overlap another fish (centre distance < 0.8 body widths) are red.
//   node tests/overlap-image.js out.png [fish=120] [steps=2000] [seed=3] [w=1920] [h=1080]
const fs = require('fs');
const { loadBoids, mulberry32 } = require('./harness');
const PNG = require('./png');
const out = process.argv[2] || 'overlap.png';
const [fishN, steps, seed, W, H] = [120, 2000, 3, 1920, 1080].map((d, i) => Number(process.argv[3 + i] || d));
const B = loadBoids({ random: mulberry32(seed * 7919) });
const cfg = { fishCount: fishN, anglerCount: 0, orcaCount: 0, jellyCount: 0, cursorFearLevel: 0 };
const sim = B.createSimulation(W, H, 1, cfg);
for (let t = 0; t < steps; t++) B.step(sim, 1, cfg);
const px = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { px[i * 4] = 12; px[i * 4 + 1] = 40; px[i * 4 + 2] = 70; px[i * 4 + 3] = 255; }
const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; };
const fish = sim.entities.fish;
let ov = 0;
for (const a of fish) {
    const s = cfg.fishSize || 4, wa = 7 * (s + a.sizeVariation), ha = 6 * (s + a.sizeVariation);
    let hit = false;
    for (const b of fish) if (b !== a && Math.hypot(a.x - b.x, a.y - b.y) < 0.8 * 0.5 * (wa + 7 * (s + b.sizeVariation))) hit = true;
    if (hit) ov++;
    const c = hit ? [255, 60, 60] : [120, 220, 160];
    for (let x = -wa / 2; x <= wa / 2; x++) { set(a.x + x, a.y - ha / 2, c); set(a.x + x, a.y + ha / 2, c); }
    for (let y = -ha / 2; y <= ha / 2; y++) { set(a.x - wa / 2, a.y + y, c); set(a.x + wa / 2, a.y + y, c); }
    const sp = Math.hypot(a.vx, a.vy) || 1;
    for (let k = 0; k < 12; k++) set(a.x + a.vx / sp * k, a.y + a.vy / sp * k, [255, 255, 255]);
}
fs.writeFileSync(out, PNG.encode(W, H, px));
console.log(out + ': ' + fish.length + ' fish, ' + ov + ' overlapping (' + (100 * ov / fish.length).toFixed(1) + '%)');
