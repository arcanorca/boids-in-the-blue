// Runs tests/qml/pool.qml (EntityLayer pooling) in the real QML engine; skipped without qml6.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

test('EntityLayer pool: reuse, no ghosts, no cap, clean recycling', (t) => {
    const r = spawnSync('qml6', [path.join(__dirname, 'qml', 'pool.qml')], {
        env: Object.assign({}, process.env, { QT_QPA_PLATFORM: 'offscreen', QT_FORCE_STDERR_LOGGING: '1' }),
        encoding: 'utf8', timeout: 120000 });
    if (r.error) return t.skip('qml6 not available');
    const lines = (r.stdout + r.stderr).split('\n').map(l => l.replace(/^qml: /, '')).filter(l => l.startsWith('POOL '));
    assert.ok(lines.length >= 7, 'expected pool checks, got:\n' + r.stdout + r.stderr);
    const bad = lines.filter(l => !/^POOL \S+ ok/.test(l));
    assert.deepStrictEqual(bad, [], bad.join('\n'));
    assert.ok(!/\[boids\]|Cannot|TypeError|ReferenceError/.test(r.stdout + r.stderr), r.stdout + r.stderr);
});
