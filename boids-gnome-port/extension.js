/* extension.js - Boids Gnome Port
 *
 * The simulation (boids, predators, worms, bubbles, breeding ...) lives in
 * boids-core.js, a generated copy of core/boids-core.js shared with the KDE
 * wallpaper and the web port (regenerate with `npm run build`). This file only
 * owns the GNOME-specific parts: lifecycle, the St.DrawingArea and its Cairo painter.
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Cairo from 'gi://cairo';

import * as Core from './boids-core.js';

/* -------------------- SETTINGS -------------------- */

// Passed to the core as its configuration object (same keys as the KDE settings).
// Anything left out uses the core default. Edit here to tweak.
const CONFIG = {
    fishCount: 30,
    jellyCount: 5,
    anglerCount: 4,
    orcaCount: 2,
    fishSize: 6,
    anglerSize: 8,
    orcaSize: 9,
    jellySize: 5,
};

const TICK_MS = 40; // 25 Hz, the same fixed simulation rate as the KDE plugin

const WATER_TOP = [0.05, 0.1, 0.25];
const WATER_BOTTOM = [0.02, 0.04, 0.12];

/* -------------------- RENDERING -------------------- */

// Layer colours per species, matching the KDE BoidDelegate. null = layer not drawn;
// 'body' = same colour as the entity's own colour.
const LAYER2 = { fish: '#FFFFFF', angler: '#FFFF99', orca: '#E6E6E6', jelly: 'body' };
const LAYER3 = { angler: '#FF3333' };
const BODY_COLOR = { orca: '#4D6680', angler: '#403359', jelly: '#8B7BB5' };

const _rgbCache = new Map();
// Accepts #RRGGBB and rgba(r, g, b, a); returns [r, g, b, a] in 0..1
function parseColor(str) {
    let c = _rgbCache.get(str);
    if (c) return c;
    c = [1, 1, 1, 1];
    const hex = /^#([0-9a-f]{6})$/i.exec(str || '');
    const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(str || '');
    if (hex) {
        const n = parseInt(hex[1], 16);
        c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
    } else if (rgba) {
        c = [rgba[1] / 255, rgba[2] / 255, rgba[3] / 255, rgba[4] !== undefined ? Number(rgba[4]) : 1];
    }
    _rgbCache.set(str, c);
    return c;
}

// One fill per colour layer (not per cell), like the KDE delegate.
function drawSprite(cr, sprite, x, y, size, flip, body, layer2, layer3, alpha) {
    const rows = sprite.length, cols = sprite[0].length;
    const w = size + 1, h = size + 1;
    const left = x + 0.5 - cols * size / 2;
    const top = y + 0.5 - rows * size / 2;
    for (let layer = 1; layer <= 3; layer++) {
        const col = layer === 1 ? body : layer === 2 ? layer2 : layer3;
        if (!col) continue;
        let has = false;
        for (let r = 0; r < rows; r++) {
            const row = sprite[r];
            for (let c = 0; c < cols; c++) {
                if (row[c] !== layer) continue;
                cr.rectangle(left + (flip ? cols - 1 - c : c) * size, top + r * size, w, h);
                has = true;
            }
        }
        if (has) {
            const p = parseColor(col);
            cr.setSourceRGBA(p[0], p[1], p[2], p[3] * alpha);
            cr.fill();
        }
    }
}

function drawEntity(cr, sim, ent) {
    if (!Number.isFinite(ent.x) || !Number.isFinite(ent.y)) return;
    if (ent.x < -60 || ent.x > sim.width + 60 || ent.y < -60 || ent.y > sim.height + 60) return;
    const cc = sim._c;
    const S = Core.SPRITES;
    const flip = !ent.facingRight;
    switch (ent.kind) {
    case 'fish':
        drawSprite(cr, S.FISH, ent.x, ent.y, cc.fishSize + ent.sizeVariation, flip,
            ent.color || '#FFFFFF', LAYER2.fish, null, 1);
        break;
    case 'angler':
        drawSprite(cr, S.ANGLER, ent.x, ent.y, cc.anglerSize, flip,
            BODY_COLOR.angler, LAYER2.angler, LAYER3.angler, 1);
        break;
    case 'orca':
        drawSprite(cr, S.ORCA, ent.x, ent.y, cc.orcaSize, flip,
            BODY_COLOR.orca, LAYER2.orca, null, 1);
        break;
    case 'jelly':
        drawSprite(cr, S.JELLY, ent.x, ent.y, cc.jellySize + ent.sizeVariation, false,
            BODY_COLOR.jelly, BODY_COLOR.jelly, null, 0.25);
        break;
    case 'worm':
        drawSprite(cr, S.WORM, ent.x, ent.y, cc.wormSize, false,
            Core.WORM_COLOR, null, null, Math.max(0, Math.min(1, ent.life)));
        break;
    case 'bubble':
        drawSprite(cr, S.BUBBLE, ent.x, ent.y, ent.scale, false,
            Core.BUBBLE_COLOR, null, null, 1);
        break;
    }
}

/* -------------------- EXTENSION -------------------- */

/* -------------------- EXTENSION -------------------- */

export default class BoidsGnomeExtension extends Extension {
    enable() {
        this._area = null;
        this._constraint = null;

        this._timer = 0;
        this._syncSource = 0;
        this._enableIdle = 0;

        this._lastWidth = 0;
        this._lastHeight = 0;

        // The simulation survives actor rebuilds (monitors-changed etc.); only disable() drops it
        this._sim = null;
        this._errorsSeen = new Set();

        this._globalSigs = [];
        this._areaSigs = [];

        this._loginProxy = null;
        this._loginSignalId = 0;

        this._ssProxy = null;
        this._ssSignalId = 0;

        this._screensaverActive = false;
        this._inCleanup = false;

        // Boot / attach watchdog (fix: login blank, dpms blank)
        this._bootSource = 0;
        this._bootIdle = 0;
        this._bootTries = 0;

        this._enableIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._enableIdle = 0;
            this._lateEnable();
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        this._cleanup();
    }

    /* ---------- small helpers ---------- */

    _gconnect(obj, sig, cb) {
        if (!obj) return 0;
        const id = obj.connect(sig, cb);
        this._globalSigs.push([obj, id]);
        return id;
    }

    _aconnect(obj, sig, cb) {
        if (!obj) return 0;
        const id = obj.connect(sig, cb);
        this._areaSigs.push([obj, id]);
        return id;
    }

    _disconnectList(list) {
        for (const [obj, id] of list) {
            try { obj.disconnect(id); } catch (e) { }
        }
        list.length = 0;
    }

    _isUserMode() {
        try { return Main.sessionMode?.currentMode === 'user'; }
        catch (e) { return false; }
    }

    _getBgGroup() {
        return Main.layoutManager.backgroundGroup || Main.layoutManager._backgroundGroup || null;
    }

    _shouldRunNow() {
        const user = this._isUserMode();
        const locked = Main.screenShield ? !!Main.screenShield.locked : false;
        return user && !locked && !this._screensaverActive;
    }

    _scheduleSync(delayMs = 0) {
        if (this._inCleanup) return;

        if (this._syncSource) {
            try { GLib.Source.remove(this._syncSource); } catch (e) { }
            this._syncSource = 0;
        }

        const run = () => {
            this._syncSource = 0;
            this._syncLifecycle();
            return GLib.SOURCE_REMOVE;
        };

        if (delayMs <= 0) {
            this._syncSource = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, run);
        } else {
            this._syncSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, run);
        }
    }

    /* ---------- boot & attach logic (MAIN HOTFIX) ---------- */

    _bootAfterFirstRedraw() {
        if (this._inCleanup) return;

        // 1) First safe time: an idle callback. Meta.later_add() is deprecated
        // (replaced by Meta.Laters via global.compositor.get_laters() in newer
        // shells, and gone from the API surface across 45-55), so use a plain GLib
        // idle source: it works identically on every supported version and is
        // removable on disable(). The 1 s watchdog below covers a late background group.
        if (this._bootIdle) {
            try { GLib.Source.remove(this._bootIdle); } catch (e) { }
        }
        this._bootIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._bootIdle = 0;
            if (this._inCleanup) return GLib.SOURCE_REMOVE;
            this._ensureAttached(true);
            this._scheduleSync(0);
            return GLib.SOURCE_REMOVE;
        });

        // 2) retry watchdog: backgroundGroup sometimes appears late on login / dpms
        if (this._bootSource) {
            try { GLib.Source.remove(this._bootSource); } catch (e) { }
            this._bootSource = 0;
        }
        this._bootTries = 0;

        this._bootSource = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (this._inCleanup) return GLib.SOURCE_REMOVE;

            const ok = this._ensureAttached(false);
            if (ok) {
                this._bootSource = 0;
                this._scheduleSync(0);
                return GLib.SOURCE_REMOVE;
            }

            this._bootTries++;
            if (this._bootTries > 20) {
                this._bootSource = 0;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _ensureAttached(aggressiveRebuild = false) {
        if (this._inCleanup) return false;

        // If stage is not mapped (blank screen / DPMS), wait.
        try {
            if (global.stage && global.stage.mapped === false)
                return false;
        } catch (e) { }

        const bgGroup = this._getBgGroup();
        if (!bgGroup) return false;

        try {
            if (bgGroup.mapped === false)
                return false;
        } catch (e) { }

        // create area if needed
        if (!this._area) this._createAreaSafe();
        if (!this._area) return false;

        // ensure parent is backgroundGroup
        let parent = null;
        try { parent = this._area.get_parent(); } catch (e) { }

        if (parent !== bgGroup) {
            try {
                if (aggressiveRebuild) {
                    this._destroyAreaNow();
                    this._createAreaSafe();
                } else {
                    try { parent?.remove_child(this._area); } catch (e) { }
                    bgGroup.insert_child_at_index(this._area, 0);
                }
            } catch (e) {
                try {
                    this._destroyAreaNow();
                    this._createAreaSafe();
                } catch (e2) { }
            }
        }

        this._ensureDimensions();
        try { this._area.queue_repaint(); } catch (e) { }
        return true;
    }

    _ensureDimensions() {
        if (!this._area) return;
        try {
            const box = this._area.get_allocation_box();
            const width = box.x2 - box.x1;
            const height = box.y2 - box.y1;
            if (width > 0 && height > 0) {
                this._lastWidth = width;
                this._lastHeight = height;

                if (!this._sim) {
                    this._sim = Core.createSimulation(width, height, 1, CONFIG);
                    // populate the per-config cache the painter reads
                    Core.step(this._sim, 1, CONFIG);
                } else if (this._sim.width !== width || this._sim.height !== height) {
                    Core.resize(this._sim, width, height, 1);
                }
            }
        } catch (e) { }
    }

    /* ---------- GNOME hooks ---------- */

    _lateEnable() {
        if (this._inCleanup) return;

        // session / lock lifecycle
        try { this._gconnect(Main.sessionMode, 'updated', () => this._scheduleSync(200)); } catch (e) { }
        try { if (Main.screenShield) this._gconnect(Main.screenShield, 'locked-changed', () => this._scheduleSync(200)); } catch (e) { }

        // monitors changed -> often recreates background actors, so re-attach
        try {
            this._gconnect(Main.layoutManager, 'monitors-changed', () => {
                this._ensureAttached(true);
                this._scheduleSync(0);
            });
        } catch (e) { }

        // DPMS blank/unblank: stage mapped toggles
        try {
            this._gconnect(global.stage, 'notify::mapped', () => {
                this._ensureAttached(false);
                this._scheduleSync(0);
            });
        } catch (e) { }

        this._installScreenSaverHook();
        this._installLogindHook();

        // HOTFIX: attach after first redraw + watchdog retries
        this._bootAfterFirstRedraw();

        // normal lifecycle kick
        this._scheduleSync(500);
    }

    _installLogindHook() {
        try {
            this._loginProxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                'org.freedesktop.login1',
                'org.freedesktop.login1',
                'org.freedesktop.login1.Manager',
                null
            );

            this._loginSignalId = this._loginProxy.connectSignal(
                'PrepareForSleep',
                (_p, _sender, [sleeping]) => {
                    this._screensaverActive = !!sleeping;
                    this._scheduleSync(sleeping ? 0 : 1000);
                }
            );
        } catch (e) {
            console.error('BoidsGnome: logind hook failed: ' + e);
        }
    }

    _uninstallLogindHook() {
        if (this._loginProxy && this._loginSignalId) {
            try { this._loginProxy.disconnectSignal(this._loginSignalId); } catch (e) { }
        }
        this._loginProxy = null;
        this._loginSignalId = 0;
    }

    _installScreenSaverHook() {
        const tryCreate = (name, path, iface) => {
            return Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                name,
                path,
                iface,
                null
            );
        };

        const connectActiveChanged = (proxy) => {
            this._ssSignalId = proxy.connectSignal('ActiveChanged', (_p, _sender, [active]) => {
                this._screensaverActive = !!active;
                this._scheduleSync(active ? 0 : 500);
            });

            try {
                const res = proxy.call_sync('GetActive', null, Gio.DBusCallFlags.NONE, -1, null);
                const unpack = res.deep_unpack();
                this._screensaverActive = !!(Array.isArray(unpack) ? unpack[0] : unpack);
            } catch (e) {
                this._screensaverActive = false;
            }
        };

        try {
            this._ssProxy = tryCreate('org.gnome.ScreenSaver', '/org/gnome/ScreenSaver', 'org.gnome.ScreenSaver');
            connectActiveChanged(this._ssProxy);
        } catch (e) {
            try {
                this._ssProxy = tryCreate('org.freedesktop.ScreenSaver', '/org/freedesktop/ScreenSaver', 'org.freedesktop.ScreenSaver');
                connectActiveChanged(this._ssProxy);
            } catch (e2) {
                this._screensaverActive = false;
                this._ssProxy = null;
                this._ssSignalId = 0;
            }
        }
    }

    _uninstallScreenSaverHook() {
        if (this._ssProxy && this._ssSignalId) {
            try { this._ssProxy.disconnectSignal(this._ssSignalId); } catch (e) { }
        }
        this._ssProxy = null;
        this._ssSignalId = 0;
    }

    /* ---------- actor ---------- */

    _createAreaSafe() {
        if (this._area) return;

        const bgGroup = this._getBgGroup();
        if (!bgGroup) return;

        try {
            this._area = new St.DrawingArea({ reactive: false });

            this._constraint = new Clutter.BindConstraint({
                source: global.stage,
                coordinate: Clutter.BindCoordinate.ALL,
            });
            this._area.add_constraint(this._constraint);

            this._aconnect(this._area, 'repaint', (area) => this._safeRepaint(area));
            this._aconnect(this._area, 'notify::allocation', () => {
                this._ensureDimensions();
            });

            bgGroup.insert_child_at_index(this._area, 0);
            this._ensureDimensions();
        } catch (e) {
            console.error('BoidsGnome: createArea failed: ' + e);
            try { this._area?.destroy(); } catch (e2) { }
            this._area = null;
            this._constraint = null;
        }
    }

    _destroyAreaNow() {
        this._stopSimulation();
        this._disconnectList(this._areaSigs);

        if (this._area) {
            try { this._area.destroy(); } catch (e) { }
        }

        this._area = null;
        this._constraint = null;

        // NOTE: this._sim is deliberately kept; it is re-sized when the new actor reports its size.

        this._lastWidth = 0;
        this._lastHeight = 0;
    }

    /* ---------- lifecycle ---------- */

    _syncLifecycle() {
        if (this._inCleanup) return;

        // Always ensure we're attached when we want to run
        const shouldRun = this._shouldRunNow();

        if (shouldRun) {
            this._ensureAttached(false);
            if (this._area) this._area.show();
            this._startSimulation();
        } else {
            this._stopSimulation();
            if (this._area) this._area.hide();
        }
    }

    _startSimulation() {
        if (this._timer) return;
        if (!this._area) return;
        if (!this._shouldRunNow()) return;

        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TICK_MS, () => {
            // If locked/blank, just keep timer but don't draw heavy
            if (Main.screenShield && Main.screenShield.locked)
                return GLib.SOURCE_CONTINUE;

            // if stage unmapped (blank screen), don't step/draw; wait for notify::mapped
            try {
                if (global.stage && global.stage.mapped === false)
                    return GLib.SOURCE_CONTINUE;
            } catch (e) { }

            if (!this._area || !this._shouldRunNow()) {
                this._stopSimulation();
                if (this._area) this._area.hide();
                return GLib.SOURCE_REMOVE;
            }

            // Make sure actor is still properly attached (covers bgGroup rebuild)
            this._ensureAttached(false);

            // A failing step must never kill the timer: log it once and keep going
            try {
                this._step();
            } catch (e) {
                this._logOnce('tick', e);
            }
            try { this._area.queue_repaint(); } catch (e) { this._logOnce('repaint-queue', e); }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopSimulation() {
        if (this._timer) {
            try { GLib.Source.remove(this._timer); } catch (e) { }
            this._timer = 0;
        }
    }

    _cleanup() {
        if (this._inCleanup) return;
        this._inCleanup = true;

        if (this._enableIdle) {
            try { GLib.Source.remove(this._enableIdle); } catch (e) { }
            this._enableIdle = 0;
        }

        if (this._syncSource) {
            try { GLib.Source.remove(this._syncSource); } catch (e) { }
            this._syncSource = 0;
        }

        if (this._bootSource) {
            try { GLib.Source.remove(this._bootSource); } catch (e) { }
            this._bootSource = 0;
        }

        if (this._bootIdle) {
            try { GLib.Source.remove(this._bootIdle); } catch (e) { }
            this._bootIdle = 0;
        }

        this._stopSimulation();
        this._uninstallScreenSaverHook();
        this._uninstallLogindHook();
        this._disconnectList(this._globalSigs);
        this._destroyAreaNow();
        this._sim = null;

        this._inCleanup = false;
    }

    /* ---------- sim step & draw ---------- */

    _logOnce(where, e) {
        const key = where + ': ' + (e && e.message ? e.message : e);
        if (this._errorsSeen.has(key)) return;
        this._errorsSeen.add(key);
        console.error('BoidsGnome ' + key);
    }

    _step() {
        if (!this._sim || !this._lastWidth || !this._lastHeight) return;
        Core.step(this._sim, 1, CONFIG);
    }

    _safeRepaint(area) {
        if (!area) return;

        if (Main.screenShield && Main.screenShield.locked) return;
        if (this._screensaverActive) return;

        // if stage unmapped, don't paint
        try {
            if (global.stage && global.stage.mapped === false)
                return;
        } catch (e) { }

        try {
            const cr = area.get_context();
            if (!cr) return;

            const h = this._lastHeight || 1080;
            const pat = new Cairo.LinearGradient(0, 0, 0, h);
            pat.addColorStopRGB(0, ...WATER_TOP);
            pat.addColorStopRGB(1, ...WATER_BOTTOM);

            cr.setSource(pat);
            cr.paint();

            const sim = this._sim;
            if (sim && sim._c) {
                for (const list of sim.allLists) {
                    for (let i = 0; i < list.length; i++) {
                        try { drawEntity(cr, sim, list[i]); } catch (e) { this._logOnce('draw', e); }
                    }
                }
            }

            // best-effort dispose (prevents GJS wrapper leaks on some setups)
            try { if (cr.$dispose) cr.$dispose(); } catch (e) { }
        } catch (e) {
            this._logOnce('repaint', e);
        }
    }
}
