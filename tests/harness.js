// Loads contents/ui/code/boids.js (a QML `.pragma library`) into a Node vm
// context so the simulation can be tested and benchmarked without Qt.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'contents', 'ui', 'code', 'boids.js');

function loadBoids() {
    const code = fs.readFileSync(SRC, 'utf8').replace(/^\.pragma library.*$/m, '');
    const ctx = vm.createContext({ console, Math, Date });
    vm.runInContext(code, ctx, { filename: SRC });
    return ctx;
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

module.exports = { loadBoids, mockComponent };
