// Coverage maths (contents/ui/code/coverage.js): fraction of the screen hidden behind windows.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { loadScript } = require('./harness');

const C = loadScript(path.join(__dirname, '..', 'contents', 'ui', 'code', 'coverage.js'));
const S = { x: 0, y: 0, width: 1920, height: 1080 };
const R = (x, y, width, height) => ({ x, y, width, height });
const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, a + ' vs ' + b);

test('empty cases', () => {
    assert.strictEqual(C.coverage([], S), 0);
    assert.strictEqual(C.coverage(null, S), 0);
    assert.strictEqual(C.coverage([R(0, 0, 100, 100)], null), 0);
    assert.strictEqual(C.coverage([R(0, 0, 100, 100)], R(0, 0, 0, 0)), 0);
    assert.strictEqual(C.coverage([R(5000, 0, 100, 100)], S), 0, 'window on another screen');
    assert.strictEqual(C.coverage([R(10, 10, 0, 50), R(10, 10, -5, 50), null, {}], S), 0, 'invalid rects ignored');
});

test('full and half coverage', () => {
    assert.strictEqual(C.coverage([R(0, 0, 1920, 1080)], S), 1);
    assert.strictEqual(C.coverage([R(-50, -50, 3000, 2000)], S), 1, 'bigger than the screen');
    assert.strictEqual(C.coverage([R(0, 0, 960, 1080)], S), 0.5);
    near(C.coverage([R(0, 540, 1920, 540)], S), 0.5, 0.02);   // 27 rows: sampling granularity
});

test('overlapping windows are counted once (union, not sum)', () => {
    const one = C.coverage([R(0, 0, 1200, 1080)], S);
    const two = C.coverage([R(0, 0, 1200, 1080), R(0, 0, 1200, 1080), R(100, 100, 400, 400)], S);
    assert.strictEqual(one, two);
    near(C.coverage([R(0, 0, 1200, 1080), R(600, 0, 1320, 1080)], S), 1, 0);
});

test('three tiled terminals covering nearly the whole screen (the owner scenario)', () => {
    const tiles = [R(0, 0, 640, 1080), R(640, 0, 640, 1080), R(1280, 0, 640, 1080)];
    assert.strictEqual(C.coverage(tiles, S), 1);
    const gaps = [R(8, 8, 624, 1064), R(648, 8, 624, 1064), R(1288, 8, 624, 1064)];   // gaps and margins (thin gaps below one 40 px sample cell are ignored)
    const c = C.coverage(gaps, S);
    assert.ok(c > 0.95, 'with gaps: ' + c);
    assert.ok(C.isCovered(c, 90));
    const two = C.coverage(tiles.slice(0, 2), S);
    near(two, 2 / 3, 0.02);
    assert.ok(!C.isCovered(two, 90));
});

test('multi-screen: global coordinates, only the part on this screen counts', () => {
    const right = R(1920, 0, 1920, 1080);                      // second monitor to the right
    assert.strictEqual(C.coverage([R(0, 0, 3840, 1080)], right), 1);
    assert.strictEqual(C.coverage([R(0, 0, 1920, 1080)], right), 0);
    near(C.coverage([R(1000, 0, 1920, 1080)], right), 1000 / 1920, 0.02);   // straddling both
    assert.strictEqual(C.coverage([R(0, 0, 3840, 1080)], R(-1920, 0, 1920, 1080)), 0, 'screen on the left of the origin');
    assert.strictEqual(C.coverage([R(-1920, 0, 1920, 1080)], R(-1920, 0, 1920, 1080)), 1);
});

test('fractional-scale logical sizes and odd rectangles do not break the grid', () => {
    const s = { x: 0, y: 0, width: 1536, height: 864.5 };
    assert.strictEqual(C.coverage([R(0, 0, 1536, 865)], s), 1);
    const c = C.coverage([R(100.5, 33.3, 800.25, 400.75)], s);
    assert.ok(c > 0.1 && c < 0.3, String(c));
});

test('isCovered: percent threshold on whole samples, clamped to 50..100, default 90', () => {
    assert.ok(C.isCovered(1, 100));
    assert.ok(!C.isCovered(1295 / 1296, 100), 'one sample short of 100 %');
    assert.ok(C.isCovered(0.9, 90));
    assert.ok(!C.isCovered(0.89, 90));
    assert.ok(C.isCovered(0.5, 50));
    assert.ok(!C.isCovered(0.49, 50));
    assert.ok(C.isCovered(0.5, 10), 'below the range -> 50');
    assert.ok(!C.isCovered(0.99, 1000), 'above the range -> 100');
    assert.ok(C.isCovered(0.9, undefined) && !C.isCovered(0.8, undefined), 'default 90');
    assert.ok(!C.isCovered(0, 50));
});
