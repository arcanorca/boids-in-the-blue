// Theme integration: registry, config key, scene files, classic == the frozen original delegate.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadScript, loadBoids, mockComponent } = require('./harness');

const ROOT = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const T = loadScript(path.join(ROOT, 'contents', 'ui', 'code', 'themes.js'));

test('registry: pixel is the default, all themes are listed with a Scene.qml', () => {
    assert.strictEqual(T.DEFAULT_THEME, 'pixel');
    assert.deepStrictEqual(Array.from(T.THEMES, t => t.id), ['pixel', 'classic', 'biolum', 'illustrated', 'gameboy']);
    for (const t of T.THEMES) {
        assert.ok(t.name && t.description, t.id);
        assert.ok(fs.existsSync(path.join(ROOT, 'contents', 'themes', t.id, 'Scene.qml')), t.id + ' Scene.qml');
        assert.strictEqual(T.sceneFile(t.id), '../themes/' + t.id + '/Scene.qml');
    }
});

test('registry: unknown, empty and odd values resolve to pixel', () => {
    for (const v of ['', undefined, null, 'nope', 'PIXEL', 'classic ', 42, {}]) assert.strictEqual(T.resolve(v), 'pixel', String(v));
    for (const t of T.THEMES) assert.strictEqual(T.resolve(t.id), t.id);
    assert.strictEqual(T.sceneFile('nope'), '../themes/pixel/Scene.qml');
});

test('main.xml: one "theme" String key in General, default pixel', () => {
    const xml = read('contents', 'config', 'main.xml');
    assert.strictEqual((xml.match(/<entry name="theme"/g) || []).length, 1);
    const g = /<group name="General">([\s\S]*?)<\/group>/.exec(xml)[1];
    assert.match(g, /<entry name="theme" type="String">[\s\S]*?<default>pixel<\/default>/);
});

test('main.qml routes through the registry (no per-theme code) and releases delegates on a switch', () => {
    const main = read('contents', 'ui', 'main.qml');
    assert.match(main, /Themes\.resolve\(/);
    assert.match(main, /Themes\.sceneFile\(/);
    assert.match(main, /Boids\.releaseAll\(sim\)/);
    assert.doesNotMatch(main, /themes\/(pixel|biolum|illustrated)/);
});

test('classic renders through the original BoidDelegate (frozen copy used by the legacy comparison)', () => {
    assert.strictEqual(read('contents', 'themes', 'classic', 'BoidDelegate.qml'), read('tests', 'qml', 'legacy', 'BoidDelegate.qml'));
    const orig = require('child_process').spawnSync('git', ['show', 'fix/technical-bugs:contents/ui/BoidDelegate.qml'], { cwd: ROOT, encoding: 'utf8' });
    if (orig.status === 0) assert.strictEqual(read('contents', 'themes', 'classic', 'BoidDelegate.qml'), orig.stdout);
});

test('Boids.releaseAll releases pooled delegates (release()) and destroys plain ones, keeps the sim', () => {
    const B = loadBoids();
    const comp = mockComponent();
    const sim = B.createSimulation(800, 600, 1, {});
    B.step(sim, 1, {});
    B.sync(sim, null, comp);
    const total = sim.allLists.reduce((n, l) => n + l.length, 0);
    assert.strictEqual(comp.live.size, total);
    let released = 0;
    for (const l of sim.allLists) for (const e of l) if (e.delegate && e.kind === 'fish') e.delegate.release = () => { released++; };
    B.releaseAll(sim);
    assert.strictEqual(released, sim.entities.fish.length);
    assert.ok(sim.allLists.every(l => l.every(e => !e.delegate)));
    B.releaseAll(null);   // no simulation yet: no-op
    B.step(sim, 1, {});
    B.sync(sim, null, comp);
    assert.ok(sim.allLists.every(l => l.every(e => e.delegate)), 'fresh delegates after the switch');
});

test('theme folders carry no PNG size-class sprite pipeline', () => {
    for (const f of ['contents/images/sprites', 'contents/ui/BoidSprite.qml', 'contents/ui/code/sprites.js', 'tools/gen-sprites.js'])
        assert.ok(!fs.existsSync(path.join(ROOT, f)), f);
});
