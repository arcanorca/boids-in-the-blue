#!/usr/bin/env node
// Generates the "illustrated" theme art: writes the SVG sources to
// contents/themes/illustrated/svg/ and rasterises them (rsvg-convert) to
// contents/themes/illustrated/img/ at several widths ("LODs") so the renderer can pick the
// smallest texture that still covers the on-screen size (crisp, no heavy down-sampling).
// Usage: node tools/gen-illustrated.js        (needs rsvg-convert; the PNGs are committed)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, '..', 'contents', 'themes', 'illustrated');
const SVG = path.join(DIR, 'svg'), IMG = path.join(DIR, 'img');
fs.mkdirSync(SVG, { recursive: true });
fs.mkdirSync(IMG, { recursive: true });

// ── helpers ────────────────────────────────────────────────
const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#0a1a2e', t);

const LODS = {   // texture widths (px) per sprite; must match LODS in theme.js
    fish: [48, 84, 144], orca: [96, 180, 320], angler: [64, 120, 220],
    'jelly-bell': [48, 88, 160], 'jelly-tent': [48, 88, 160], worm: [24, 48], bubble: [24, 48],
    glow: [64]
};

const files = {};     // name -> { svg, widths }
function add(name, svg, widths) { files[name] = { svg, widths }; }
const svg = (w, h, body, defs) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<defs>${defs || ''}</defs>\n${body}\n</svg>\n`;
const lg = (id, stops, x2, y2) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2 || 0}" y2="${y2 === undefined ? 1 : y2}">` +
    stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"${s[2] !== undefined ? ` stop-opacity="${s[2]}"` : ''}/>`).join('') + `</linearGradient>`;
const rg = (id, stops, cx, cy, r) => `<radialGradient id="${id}" cx="${cx || .5}" cy="${cy || .5}" r="${r || .5}">` +
    stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"${s[2] !== undefined ? ` stop-opacity="${s[2]}"` : ''}/>`).join('') + `</radialGradient>`;

// ── fish (120 x 80, faces right) ───────────────────────────
const FISH_COLORS = {            // keys are mapped from the simulation's FISH_PALETTE in theme.js
    coral: '#ef8a7c', apricot: '#f1b366', lemon: '#d9d37c', teal: '#58c3c6', lilac: '#b39ad6',
    hot: '#e8453d'               // stress overlay
};
function fish(c, alarm) {
    const back = darken(c, .26), belly = lighten(c, .55), fin = darken(c, .14), finTip = lighten(c, .2);
    const eye = alarm ? '#ffe9e0' : '#1c2b40';
    const body = 'M111 42 C109 29 94 16 72 15 C51 14 39 27 35 40 C39 53 51 67 72 66 C94 65 109 55 111 42 Z';
    const defs = lg('b', [[0, back], [.42, c], [1, belly]]) + lg('f', [[0, fin], [1, finTip]], 1, 0) +
        `<clipPath id="bc"><path d="${body}"/></clipPath>`;
    return svg(120, 80, `
<path d="M42 40 C30 31 20 22 5 11 C12 25 13 34 11 40 C13 46 12 55 5 69 C20 58 30 49 42 40 Z" fill="url(#f)" opacity=".92"/>
<path d="M56 19 C62 3 84 0 94 23 C80 17 68 16 56 19 Z" fill="${fin}" opacity=".95"/>
<path d="M64 63 C67 74 80 76 86 62 Z" fill="${fin}" opacity=".85"/>
<path d="${body}" fill="url(#b)"/>
<g clip-path="url(#bc)">
  <ellipse cx="78" cy="60" rx="34" ry="9" fill="#fff" opacity=".22"/>
  <path d="M36 28 C60 18 90 18 112 34 L112 10 L36 10 Z" fill="${darken(c, .32)}" opacity=".30"/>
  <path d="M52 30 C60 38 60 50 52 56 M62 26 C70 36 70 52 62 60" fill="none" stroke="${darken(c, .3)}" stroke-width="1.6" opacity=".16" stroke-linecap="round"/>
</g>
<path d="M92 24 C86 34 86 50 92 60" fill="none" stroke="${darken(c, .35)}" stroke-width="1.8" opacity=".35" stroke-linecap="round"/>
<path d="M82 47 C73 54 66 56 61 53 C68 48 73 44 82 47 Z" fill="${darken(c, .2)}" opacity=".9"/>
<circle cx="97" cy="36" r="4.6" fill="${eye}"/>
<circle cx="98.6" cy="34.4" r="1.5" fill="#fff" opacity=".9"/>
<path d="M110 44 C108 46 106 46 104 45" fill="none" stroke="${darken(c, .45)}" stroke-width="1.4" opacity=".55" stroke-linecap="round"/>`, defs);
}
for (const k in FISH_COLORS) add('fish-' + k, fish(FISH_COLORS[k]), LODS.fish);
add('fish-alarm', fish('#7d1634', true), LODS.fish);

// ── orca (240 x 105, faces right) ──────────────────────────
{
    const body = 'M237 60 C236 46 221 34 197 32 C177 30.5 157 30.5 140 32 C134 20 124 8 112 2 C114 14 110 27 102 33 C80 37 58 43 44 52 L40 55 C58 64 82 72 110 77 C142 82 178 85 203 79 C223 74 237 68 237 60 Z';
    const defs = lg('b', [[0, '#587a96'], [.3, '#324b63'], [1, '#222f40']]) + lg('w', [[0, '#f6f9f8'], [1, '#bccdd4']]) +
        `<clipPath id="bc"><path d="${body}"/></clipPath>`;
    add('orca', svg(240, 105, `
<path d="M48 52 C35 46 20 36 3 27 C12 42 14 50 22 54 C14 60 14 68 3 81 C20 71 35 62 48 56 Z" fill="#2a3d52"/>
<path d="M190 70 C186 84 178 96 166 103 C183 103 199 91 205 74 Z" fill="#2a3b50"/>
<path d="${body}" fill="url(#b)"/>
<g clip-path="url(#bc)">
  <path d="M241 65 C221 67 201 69 179 69.5 C151 70 125 68 101 63 C80 58 60 54 40 50 L40 100 L241 100 Z" fill="url(#w)"/>
  <path d="M237 60.5 C221 63 207 65 190 65.5" fill="none" stroke="#2a3b50" stroke-width="1.3" opacity=".5" stroke-linecap="round"/>
  <ellipse cx="97" cy="37" rx="24" ry="6" fill="#a3b4c4" opacity=".5"/>
  <path d="M44 52 C80 38 120 32 160 31 C190 30.5 215 36 237 52" fill="none" stroke="#9ec0dc" stroke-width="2" opacity=".35"/>
</g>
<ellipse cx="203" cy="46.5" rx="15" ry="5.6" transform="rotate(-12 203 46.5)" fill="#f6f9f8"/>
<circle cx="210" cy="46.5" r="2.7" fill="#17232f"/>`, defs), LODS.orca);
}

// ── angler (170 x 130, faces right; lure glow is a separate sprite) ──
{
    const body = 'M150 62 C150 34 126 18 96 18 C62 18 36 36 32 64 C30 84 46 104 76 108 C100 112 124 104 140 88 C147 80 150 72 150 62 Z';
    const defs = lg('b', [[0, '#66589a'], [.5, '#4a3f72'], [1, '#32294e']]) + `<clipPath id="bc"><path d="${body}"/></clipPath>`;
    add('angler', svg(170, 130, `
<path d="M36 66 C22 58 11 46 4 33 C14 50 18 62 16 68 C18 75 14 87 6 99 C21 93 29 83 38 72 Z" fill="#4b4074" opacity=".95"/>
<path d="M68 24 C74 8 92 6 102 20 Z" fill="#56497f"/>
<path d="M104 82 C92 90 84 100 78 104 C94 106 108 98 118 88 Z" fill="#56497f"/>
<path d="M104 22 C106 -2 134 -5 150 9" fill="none" stroke="#6e6094" stroke-width="3" stroke-linecap="round"/>
<path d="${body}" fill="url(#b)"/>
<g clip-path="url(#bc)">
  <path d="M30 88 C60 108 110 112 150 80 L150 120 L30 120 Z" fill="#8f80bd" opacity=".35"/>
  <path d="M40 40 C60 22 100 14 150 40 L150 0 L40 0 Z" fill="#9d8fd0" opacity=".16"/>
</g>
<g fill="#d6f2f0" opacity=".7"><circle cx="64" cy="64" r="2"/><circle cx="76" cy="76" r="1.6"/><circle cx="88" cy="68" r="1.8"/><circle cx="58" cy="82" r="1.4"/><circle cx="100" cy="86" r="1.5"/></g>
<path d="M152 61 C140 67 124 78 106 77 C120 87 140 85 151 77 Z" fill="#1b1330"/>
<g fill="#f3efe0"><path d="M148 65 l3 6 l-6 -3 Z"/><path d="M138 70 l3 6 l-7 -3 Z"/><path d="M127 74 l3 6 l-7 -3 Z"/><path d="M116 77 l2 5 l-6 -2 Z"/>
<path d="M146 76 l-3 -5 l6 2 Z"/><path d="M134 79 l-3 -5 l6 2 Z"/></g>
<circle cx="123" cy="47" r="8" fill="#efe7c8"/><circle cx="125" cy="47" r="4.6" fill="#1b1330"/><circle cx="126.5" cy="45" r="1.4" fill="#fff"/>
<circle cx="150" cy="9" r="5.5" fill="#fff4b0"/><circle cx="150" cy="9" r="3" fill="#fffdf0"/>`, defs), LODS.angler);
}

// ── jellyfish: bell (100 x 70) + tentacles (100 x 100) ────
add('jelly-bell', svg(100, 70, `
<path d="M5 58 C2 24 26 3 50 3 C74 3 98 24 95 58 C90 53 85 60 79 56 C73 52 67 60 61 56 C55 52 47 60 40 56 C34 52 28 60 21 56 C15 52 10 60 5 58 Z" fill="url(#b)" stroke="#fbe3f4" stroke-opacity=".6" stroke-width="1.5"/>
<path d="M16 50 C14 28 28 12 50 12 C72 12 86 28 84 50" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>
<path d="M38 52 C34 34 38 20 50 14 M62 52 C66 34 62 20 50 14" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.6" stroke-linecap="round"/>
<ellipse cx="34" cy="20" rx="14" ry="6" transform="rotate(-24 34 20)" fill="#fff" opacity=".42"/>`,
    lg('b', [[0, '#f6d5ee', .92], [.55, '#cdb8f0', .7], [1, '#a9b2f2', .55]])), LODS['jelly-bell']);
add('jelly-tent', svg(100, 100, `
<g fill="none" stroke-linecap="round">
<path d="M22 0 C14 18 30 30 22 50 C16 66 26 80 22 96" stroke="#d9c4f2" stroke-opacity=".7" stroke-width="2.4"/>
<path d="M38 0 C30 20 46 34 38 56 C34 72 42 86 38 98" stroke="#e6cdf3" stroke-opacity=".75" stroke-width="2.4"/>
<path d="M62 0 C70 20 54 34 62 56 C66 72 58 86 62 98" stroke="#e6cdf3" stroke-opacity=".75" stroke-width="2.4"/>
<path d="M78 0 C86 18 70 30 78 50 C84 66 74 80 78 96" stroke="#d9c4f2" stroke-opacity=".7" stroke-width="2.4"/>
<path d="M44 0 C36 12 52 22 46 36 C42 46 50 54 47 62" stroke="#f9e4f6" stroke-opacity=".6" stroke-width="5.5"/>
<path d="M56 0 C64 12 48 22 54 36 C58 46 50 54 53 62" stroke="#f9e4f6" stroke-opacity=".6" stroke-width="5.5"/>
</g>`), LODS['jelly-tent']);

// ── worm (24 x 48) ─────────────────────────────────────────
add('worm', svg(24, 48, `
<path d="M12 6 C21 13 3 19 12 26 C21 33 3 39 12 44" fill="none" stroke="#e9948a" stroke-width="8.5" stroke-linecap="round"/>
<path d="M12 6 C21 13 3 19 12 26 C21 33 3 39 12 44" fill="none" stroke="#b9605c" stroke-width="8.5" stroke-linecap="butt" stroke-dasharray="1.1 5.6" opacity=".38"/>
<path d="M10.2 6 C18.5 13 .5 19 10.2 26 C18.5 33 .5 39 10.2 44" fill="none" stroke="#ffd0c4" stroke-width="2.6" stroke-linecap="round" opacity=".65"/>`), LODS.worm);

// ── bubble (64 x 64) ───────────────────────────────────────
add('bubble', svg(64, 64, `
<circle cx="32" cy="32" r="28" fill="url(#g)" stroke="#e2f6ff" stroke-opacity=".7" stroke-width="2.6"/>
<path d="M17 28 C18 19 25 13 34 12" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="3.6" stroke-linecap="round"/>
<circle cx="44" cy="44" r="3" fill="#fff" opacity=".4"/>`,
    rg('g', [[0, '#fff', .02], [.7, '#d8f2ff', .12], [1, '#fff', .34]])), LODS.bubble);

// ── glows (64 x 64) ────────────────────────────────────────
const glow = (a, b, c) => svg(64, 64, `<circle cx="32" cy="32" r="32" fill="url(#g)"/>`, rg('g', [[0, a, 1], [.3, b, .55], [1, c, 0]]));
add('glow-warm', glow('#fff6c0', '#ffd77a', '#ffc060'), LODS.glow);
add('glow-white', glow('#ffffff', '#ffe8f4', '#ffd0ec'), LODS.glow);
add('glow-red', glow('#ff7a70', '#ff4a44', '#ff2a30'), LODS.glow);

// ── ambient art ────────────────────────────────────────────
// light ray: soft-edged beam, widening downwards, fading out
add('ray', svg(256, 1024, `<g filter="url(#bl)"><path d="M96 0 L160 0 L232 1024 L24 1024 Z" fill="url(#r)"/></g>`,
    lg('r', [[0, '#f2fff6', .9], [.35, '#dffcf0', .38], [1, '#c8f2ea', 0]]) +
    `<filter id="bl" x="-30%" y="-5%" width="160%" height="110%"><feGaussianBlur stdDeviation="14 3"/></filter>`), [128]);
// kelp blades (60 x 300); three shapes
function kelp(variant) {
    const stems = [
        'M30 300 C14 250 46 215 28 168 C14 128 40 96 26 52 C20 32 26 14 30 4',
        'M30 300 C44 258 12 226 32 184 C48 148 18 112 34 74 C42 52 36 26 30 6',
        'M30 300 C20 262 40 236 26 200 C14 164 38 140 28 100 C20 72 34 44 30 8'
    ][variant];
    const leaves = [
        [[46, 245, 58, 226], [14, 205, 2, 184], [44, 158, 56, 138], [14, 118, 4, 96], [42, 78, 54, 56], [18, 44, 8, 26]],
        [[14, 252, 2, 232], [46, 214, 58, 194], [16, 168, 4, 146], [46, 128, 56, 104], [18, 90, 8, 68], [44, 52, 52, 30]],
        [[44, 262, 58, 244], [14, 222, 2, 204], [44, 178, 58, 156], [14, 138, 4, 114], [44, 96, 56, 74], [16, 60, 6, 38]]
    ][variant];
    const leaf = l => `<path d="M${30 + (l[0] > 30 ? 2 : -2)} ${l[1] + 14} Q${l[2]} ${l[3] + 6} ${l[0]} ${l[1] - 6} Q${l[0] > 30 ? 36 : 24} ${l[1] - 2} ${30 + (l[0] > 30 ? 2 : -2)} ${l[1] + 14} Z" fill="url(#k)" opacity=".92"/>`;
    return svg(60, 300, `<path d="${stems}" fill="none" stroke="url(#k)" stroke-width="5" stroke-linecap="round"/>${leaves.map(leaf).join('')}`,
        lg('k', [[0, '#4a9a82'], [.6, '#2c7468'], [1, '#1b5656']]));
}
for (let v = 0; v < 3; v++) add('kelp' + (v + 1), kelp(v), [60, 120]);
// seabed layers: far hills (1920 x 300), near dune with rocks + coral accents (1920 x 260)
add('seabed-far', svg(1920, 300, `<path d="M0 300 L0 150 C160 96 300 120 440 150 C600 184 720 92 900 84 C1080 76 1180 150 1340 160 C1520 172 1640 90 1780 96 C1850 99 1890 118 1920 130 L1920 300 Z" fill="url(#s)"/>
<path d="M0 300 L0 200 C220 170 380 210 600 196 C820 182 980 150 1200 176 C1420 202 1640 170 1920 198 L1920 300 Z" fill="#2f7283" opacity=".55"/>`,
    lg('s', [[0, '#3a8795'], [1, '#1f5a6e']])), [1920]);
add('seabed-near', svg(1920, 260, `
<path d="M0 260 L0 130 C200 96 380 150 620 140 C860 130 1040 84 1300 108 C1560 132 1740 96 1920 118 L1920 260 Z" fill="url(#s)"/>
<path d="M0 260 L0 190 C260 170 520 206 820 190 C1120 174 1500 200 1920 176 L1920 260 Z" fill="#18434b" opacity=".9"/>
<g fill="#4d8279"><ellipse cx="330" cy="150" rx="38" ry="16"/><ellipse cx="372" cy="156" rx="22" ry="11"/><ellipse cx="1480" cy="124" rx="44" ry="17"/><ellipse cx="1530" cy="132" rx="24" ry="10"/></g>
<g fill="#8fb9ae" opacity=".55"><ellipse cx="760" cy="176" rx="10" ry="5"/><ellipse cx="790" cy="181" rx="6" ry="3.5"/><ellipse cx="1140" cy="170" rx="8" ry="4.5"/><ellipse cx="1700" cy="152" rx="9" ry="4.5"/></g>
<g fill="none" stroke="#d9806f" stroke-width="5" stroke-linecap="round" opacity=".8">
 <path d="M1010 130 C1010 112 1004 100 996 88 M1010 130 C1012 110 1020 98 1030 90 M1010 130 L1010 84 M1010 118 C1020 112 1034 110 1044 104 M1010 118 C1000 112 988 112 980 104"/></g>
<g fill="none" stroke="#e29a8a" stroke-width="4" stroke-linecap="round" opacity=".7">
 <path d="M500 168 C500 156 496 148 490 140 M500 168 C502 154 508 148 516 142 M500 168 L500 136"/></g>`,
    lg('s', [[0, '#3b7068'], [1, '#1c4a4f']])), [1920]);

// ── write + rasterise ──────────────────────────────────────
let n = 0;
for (const name in files) {
    const f = files[name];
    fs.writeFileSync(path.join(SVG, name + '.svg'), f.svg);
    for (const w of f.widths) {
        const out = path.join(IMG, name + '-' + w + '.png');
        const r = spawnSync('rsvg-convert', ['-w', String(w), '-o', out, path.join(SVG, name + '.svg')], { encoding: 'utf8' });
        if (r.status !== 0) { console.error('rsvg-convert failed for ' + name + ': ' + (r.stderr || r.error)); process.exit(1); }
        n++;
    }
}
console.log(Object.keys(files).length + ' svg, ' + n + ' png -> ' + DIR);
