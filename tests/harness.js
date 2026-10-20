// Loads the KDE adapter (contents/ui/code/boids.js, a QML `.pragma library`)
// into a Node vm context so the simulation can be tested and benchmarked
// without Qt. If the adapter has `.import "x.js" as Name` lines, each imported
// library is loaded into its own context (like QML does) and exposed as `Name`.
//
// opts.random: deterministic Math.random replacement (see mulberry32)
// opts.now:    Date.now replacement; default real clock. h.setTime(t) pins it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CODE_DIR = path.join(__dirname, '..', 'contents', 'ui', 'code');
const SRC = path.join(CODE_DIR, 'boids.js');

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeEnv(opts) {
    opts = opts || {};
    const M = Object.create(Math);
    if (opts.random) M.random = opts.random;
    const env = { time: null };
    const D = { now: function () { return env.time !== null ? env.time : Date.now(); } };
    return { M: M, D: opts.now ? { now: opts.now } : D, env: env };
}

function loadFile(file, e, imports) {
    const code = fs.readFileSync(file, 'utf8');
    const ctx = vm.createContext(Object.assign({ console: console, Math: e.M, Date: e.D }, imports || {}));
    const body = code.replace(/^\.pragma library.*$/m, '').replace(/^\.import .*$/mg, '');
    vm.runInContext(body, ctx, { filename: file });
    return { ctx: ctx, code: code };
}

function loadLib(file, e) {
    const imports = {};
    const code = fs.readFileSync(file, 'utf8');
    const re = /^\.import\s+"([^"]+)"\s+as\s+(\w+)/mg;
    let m;
    while ((m = re.exec(code))) imports[m[2]] = loadLib(path.join(path.dirname(file), m[1]), e);
    return loadFile(file, e, imports).ctx;
}

function loadBoids(opts) {
    const e = makeEnv(opts);
    const ctx = loadLib(SRC, e);
    ctx.setTime = function (t) { e.env.time = t; };
    return ctx;
}

// Load an arbitrary plain-JS helper (e.g. tests/scenarios.js) into a context
function loadScript(file) {
    return loadFile(file, makeEnv(), {}).ctx;
}

// Stand-in for QML Component.createObject: records created/destroyed delegates.
function mockComponent() {
    const c = {
        created: 0, destroyed: 0, live: new Set(),
        createObject(parent, props) {
            const d = Object.assign({}, props);
            d.destroy = function () { c.destroyed++; c.live.delete(d); };
            c.created++; c.live.add(d);
            return d;
        }
    };
    return c;
}

// Load any QML `.pragma library` file (with its .import chain) into a vm context
function loadLibrary(file, opts) { return loadLib(file, makeEnv(opts)); }

module.exports = { loadBoids, loadScript, loadLibrary, mockComponent, mulberry32 };
