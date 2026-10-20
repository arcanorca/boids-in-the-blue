// Usage: node tests/bench.js   — simulation cost per step, no rendering.
const { loadBoids } = require('./harness');
const B = loadBoids();
for (const fish of [38, 100, 200, 400]) {
    const cfg = { fishCount: fish };
    const sim = B.createSimulation(1920, 1080, 1, cfg);
    for (let i = 0; i < 200; i++) B.step(sim, 1, cfg);
    const N = 2000, t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) B.step(sim, 1, cfg);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    console.log(`fish=${String(fish).padStart(3)}  ${ms.toFixed(3)} ms/step`);
}
