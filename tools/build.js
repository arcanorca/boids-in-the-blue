#!/usr/bin/env node
// Emits the per-target builds of core/boids-core.js:
//   contents/ui/code/boids-core.js  KDE (.pragma library, imported by the adapter)
//   core/dist/boids-core.esm.js     ESM (GNOME extension)        and boids-gnome-port/boids-core.js
//   core/dist/boids-core.web.js     classic script -> window.BoidsCore and boids-web/boids-core.js
// Usage: node tools/build.js [--check]   (--check exits 1 if a generated file is stale)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'core', 'boids-core.js');
const HEADER = '// GENERATED from core/boids-core.js by tools/build.js - do not edit.\n';

function parseExports(src) {
    const m = /\/\*\s*@exports-begin([\s\S]*?)@exports-end\s*\*\//.exec(src);
    if (!m) throw new Error('no @exports-begin/@exports-end block in core/boids-core.js');
    const names = m[1].split(/[\s,]+/).filter(Boolean);
    const seen = {};
    for (const n of names) {
        if (seen[n]) throw new Error('duplicate export ' + n);
        seen[n] = true;
        const decl = new RegExp('^(function\\s+' + n + '\\b|var\\s+' + n + '\\b)', 'm');
        if (!decl.test(src)) throw new Error('export "' + n + '" is not a top-level function/var');
    }
    return names;
}

function targets() {
    const src = fs.readFileSync(SRC, 'utf8');
    const names = parseExports(src);
    const map = names.map(n => n + ': ' + n).join(', ');
    const esm = HEADER + '\n' + src + '\nexport { ' + names.join(', ') + ' };\n';
    const web = HEADER + '\n(function (root) {\n' + src +
                '\nroot.BoidsCore = { ' + map + ' };\n' +
                '})(typeof globalThis !== \'undefined\' ? globalThis : this);\n';
    return [
        { file: path.join(ROOT, 'contents', 'ui', 'code', 'boids-core.js'),
          text: '.pragma library\n\n' + HEADER + '\n' + src },
        { file: path.join(ROOT, 'core', 'dist', 'boids-core.esm.js'), text: esm },
        { file: path.join(ROOT, 'boids-gnome-port', 'boids-core.js'), text: esm },
        { file: path.join(ROOT, 'core', 'dist', 'boids-core.web.js'), text: web },
        { file: path.join(ROOT, 'boids-web', 'boids-core.js'), text: web }
    ];
}

const check = process.argv.includes('--check');
let stale = 0;
for (const t of targets()) {
    const rel = path.relative(ROOT, t.file);
    const cur = fs.existsSync(t.file) ? fs.readFileSync(t.file, 'utf8') : null;
    if (check) {
        if (cur !== t.text) { console.error('STALE: ' + rel + ' (run: node tools/build.js)'); stale++; }
    } else if (cur !== t.text) {
        fs.mkdirSync(path.dirname(t.file), { recursive: true });
        fs.writeFileSync(t.file, t.text);
        console.log('wrote ' + rel);
    }
}
if (check) { if (stale) process.exit(1); console.log('build --check: all generated files up to date'); }
