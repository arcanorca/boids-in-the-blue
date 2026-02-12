/* extension.js - Boids Gnome Port (GNOME Port V8 Physics) */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Cairo from 'gi://cairo';

/* -------------------- SETTINGS (BOIDS TUNING) -------------------- */

const FISH_COUNT = 30; // Slightly reduced for chill vibes
const JELLY_COUNT = 5;
const ANGLER_COUNT = 4;
const ORCA_COUNT = 2;

const FISH_SIZE = 6;
const ANGLER_SIZE = 8;
const ORCA_SIZE = 9;

// Slowed down max speed for "Zen" feel
const MAX_SPEED = 1.2;
const TURN_FACTOR = 0.2; // Smooth turning

// Increased ranges for better flocking awareness
const VISUAL_RANGE = 180;
const VISUAL_RANGE_SQ = VISUAL_RANGE * VISUAL_RANGE;

const PANIC_RANGE = 200;
const PANIC_RANGE_SQ = PANIC_RANGE * PANIC_RANGE;
const ORCA_PANIC_RANGE = 250;
const ORCA_PANIC_RANGE_SQ = ORCA_PANIC_RANGE * ORCA_PANIC_RANGE;
const MARGIN = 100;

// V8 Physics Weights
const COHESION_FACTOR = 0.005;   // Low: hang loosely
const ALIGNMENT_FACTOR = 0.05;   // Med: swim together
const SEPARATION_FACTOR = 0.15;  // High: maintain personal space
const SEPARATION_DIST = 60;      // Larger personal bubble
const SEPARATION_DIST_SQ = SEPARATION_DIST * SEPARATION_DIST;

const WANDER_FACTOR = 0.05;      // Smooth wander force
const FEAR_FACTOR = 0.8;
const ANGLER_FEAR_FACTOR = 1.2;

const EPS = 1e-6;
const TICK_MS = 33; // ~30 FPS

const WATER_TOP = [0.05, 0.1, 0.25];
const WATER_BOTTOM = [0.02, 0.04, 0.12];
const FISH_PALETTE = [
    [1.0, 0.5, 0.5], [1.0, 0.7, 0.3], [0.9, 0.9, 0.4],
    [0.3, 0.8, 0.9], [0.8, 0.6, 0.9],
];

/* -------------------- SPRITES -------------------- */

const FISH_SPRITE = [
    [0, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 2, 0],
    [1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0],
];

const ANGLER_SPRITE = [
    [0, 0, 0, 0, 0, 0, 2, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 3, 3, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
];

const ORCA_SPRITE = [
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 2, 2, 2, 1, 0, 1, 0, 1],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
];

const JELLY_SPRITE = [
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [2, 0, 2, 0, 2],
    [2, 0, 2, 0, 2],
    [0, 0, 2, 0, 0],
];

/* -------------------- ENTITIES -------------------- */

class Orca {
    constructor(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0.8;
        this.vy = 0.3;
        this.scale = ORCA_SIZE;
        this.angle = Math.random() * Math.PI * 2;
    }

    update(width, height) {
        this.angle += 0.005; // Slower rotation
        this.vx = Math.cos(this.angle) * 1.0;
        this.vy = Math.sin(this.angle * 0.8) * 0.5;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < -150) this.x = width + 150;
        if (this.x > width + 150) this.x = -150;
        if (this.y < -150) this.y = height + 150;
        if (this.y > height + 150) this.y = -150;
    }

    draw(cr) {
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;
        const facingRight = this.vx >= 0;

        for (let r = 0; r < ORCA_SPRITE.length; r++) {
            for (let c = 0; c < ORCA_SPRITE[r].length; c++) {
                const val = ORCA_SPRITE[r][c];
                if (!val) continue;

                // ORIGINAL COLORS
                if (val === 1) cr.setSourceRGB(0.3, 0.4, 0.5); // Dark Blue/Grey
                else if (val === 2) cr.setSourceRGB(0.9, 0.9, 0.9); // White Belly

                const drawC = facingRight ? c : (ORCA_SPRITE[r].length - 1 - c);
                cr.rectangle(
                    this.x + (drawC * this.scale),
                    this.y + (r * this.scale),
                    this.scale,
                    this.scale
                );
                cr.fill();
            }
        }
    }
}

class Jellyfish {
    constructor(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.speed = 0.2 + Math.random() * 0.2;
        this.scale = 5 + Math.random() * 2;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.wobblePhase = Math.random() * Math.PI * 2;
    }

    update(width, height) {
        this.y += this.speed * this.direction;
        this.wobblePhase += 0.05;
        this.x += Math.sin(this.wobblePhase) * 0.5;

        if (this.y < -50) this.y = height + 50;
        if (this.y > height + 50) this.y = -50;
    }

    draw(cr) {
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;

        cr.setSourceRGBA(0.8, 0.7, 1.0, 0.3);
        for (let r = 0; r < JELLY_SPRITE.length; r++) {
            for (let c = 0; c < JELLY_SPRITE[r].length; c++) {
                if (JELLY_SPRITE[r][c]) {
                    cr.rectangle(
                        this.x + (c * this.scale),
                        this.y + (r * this.scale),
                        this.scale,
                        this.scale
                    );
                }
            }
        }
        cr.fill();
    }
}

class Angler {
    constructor(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5);
        this.vy = (Math.random() - 0.5);
        this.scale = ANGLER_SIZE;
        this.color = [0.25, 0.2, 0.35]; // ORIGINAL COLOR
    }

    update(width, height, orcas) {
        let panic = false;

        for (const orca of orcas) {
            const pdx = this.x - orca.x;
            const pdy = this.y - orca.y;
            const distSq = pdx * pdx + pdy * pdy;

            if (distSq < ORCA_PANIC_RANGE_SQ) {
                if (distSq < EPS) continue;
                panic = true;

                const pdist = Math.sqrt(distSq);
                const urgency = (ORCA_PANIC_RANGE - pdist) / ORCA_PANIC_RANGE;

                // Stronger repulsion for angler
                this.vx += (pdx / pdist) * ANGLER_FEAR_FACTOR * (0.8 + urgency);
                this.vy += (pdy / pdist) * ANGLER_FEAR_FACTOR * (0.8 + urgency);
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        // Friction for drift feel
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Random drift impulse
        this.vx += (Math.random() - 0.5) * 0.05;
        this.vy += (Math.random() - 0.5) * 0.05;

        const speedSq = this.vx * this.vx + this.vy * this.vy;
        const limit = panic ? MAX_SPEED * 1.5 : 1.0;
        if (speedSq > limit * limit) {
            const speed = Math.sqrt(speedSq);
            if (speed > EPS) {
                this.vx = (this.vx / speed) * limit;
                this.vy = (this.vy / speed) * limit;
            }
        }

        if (panic) {
            if (this.x < -50) this.x = width + 50;
            if (this.x > width + 50) this.x = -50;
            if (this.y < -50) this.y = height + 50;
            if (this.y > height + 50) this.y = -50;
        } else {
            // Soft boundaries
            if (this.x < MARGIN) this.vx += 0.05;
            if (this.x > width - MARGIN) this.vx -= 0.05;
            if (this.y < MARGIN) this.vy += 0.05;
            if (this.y > height - MARGIN) this.vy -= 0.05;
        }
    }

    draw(cr) {
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;

        const facingRight = this.vx >= 0;
        for (let r = 0; r < ANGLER_SPRITE.length; r++) {
            for (let c = 0; c < ANGLER_SPRITE[r].length; c++) {
                const val = ANGLER_SPRITE[r][c];
                if (!val) continue;

                // ORIGINAL COLORS
                if (val === 1) cr.setSourceRGB(...this.color); // Dark Purple
                else if (val === 2) cr.setSourceRGB(1.0, 1.0, 0.6); // Yellow Bulb
                else if (val === 3) cr.setSourceRGB(1.0, 0.2, 0.2); // Red Mouth

                const drawC = facingRight ? c : (ANGLER_SPRITE[r].length - 1 - c);
                cr.rectangle(
                    this.x + (drawC * this.scale),
                    this.y + (r * this.scale),
                    this.scale,
                    this.scale
                );
                cr.fill();
            }
        }
    }
}

class Fish {
    constructor(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.personality = 0.8 + Math.random() * 0.4;

        // Random starting angle for rotation
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * (MAX_SPEED * 0.5);
        this.vy = Math.sin(angle) * (MAX_SPEED * 0.5);

        this.color = FISH_PALETTE[Math.floor(Math.random() * FISH_PALETTE.length)];
        this.scale = FISH_SIZE + (Math.random() * 2 - 1);

        // V8: Rotational Wander State
        this.wanderTheta = Math.random() * Math.PI * 2;
    }

    update(width, height, allFish, anglers) {
        let closeDx = 0, closeDy = 0;
        let xVelAvg = 0, yVelAvg = 0;
        let xPosAvg = 0, yPosAvg = 0;
        let neighbors = 0;
        let panic = false;

        // 1. PREDATOR AVOIDANCE
        for (const angler of anglers) {
            const pdx = this.x - angler.x;
            const pdy = this.y - angler.y;
            const distSq = pdx * pdx + pdy * pdy;

            if (distSq < PANIC_RANGE_SQ) {
                if (distSq < EPS) continue;
                panic = true;

                const pdist = Math.sqrt(distSq);
                const urgency = (PANIC_RANGE - pdist) / PANIC_RANGE;

                const scatterX = (Math.random() - 0.5) * 2;
                const scatterY = (Math.random() - 0.5) * 2;

                this.vx += (pdx / pdist) * FEAR_FACTOR * (0.8 + urgency) + scatterX;
                this.vy += (pdy / pdist) * FEAR_FACTOR * (0.8 + urgency) + scatterY;
            }
        }

        // 2. BOIDS FLOCKING (Individualist Style)
        if (!panic) {
            for (const other of allFish) {
                if (other === this) continue;

                const dx = this.x - other.x;
                const dy = this.y - other.y;

                if (Math.abs(dx) > VISUAL_RANGE || Math.abs(dy) > VISUAL_RANGE) continue;

                const distSq = dx * dx + dy * dy;
                if (distSq < VISUAL_RANGE_SQ) {
                    xVelAvg += other.vx;
                    yVelAvg += other.vy;
                    xPosAvg += other.x;
                    yPosAvg += other.y;

                    // Stronger separation for "closeness" but not stacking
                    if (distSq < SEPARATION_DIST_SQ) {
                        const dist = Math.sqrt(distSq);
                        // Weight inversely proportional to distance
                        if (dist > EPS) {
                            closeDx += (this.x - other.x) / dist;
                            closeDy += (this.y - other.y) / dist;
                        }
                    }
                    neighbors++;
                }
            }
        }

        if (neighbors > 0 && !panic) {
            xVelAvg /= neighbors;
            yVelAvg /= neighbors;
            xPosAvg /= neighbors;
            yPosAvg /= neighbors;

            this.vx += (xVelAvg - this.vx) * ALIGNMENT_FACTOR;
            this.vy += (yVelAvg - this.vy) * ALIGNMENT_FACTOR;

            this.vx += (xPosAvg - this.x) * COHESION_FACTOR;
            this.vy += (yPosAvg - this.y) * COHESION_FACTOR;
        }

        // Apply Strong Separation
        this.vx += closeDx * SEPARATION_FACTOR;
        this.vy += closeDy * SEPARATION_FACTOR;

        // 3. WANDER (Rotational - Natural Curves)
        if (!panic) {
            this.wanderTheta += (Math.random() - 0.5) * 0.4; // Slowly turn
            this.vx += Math.cos(this.wanderTheta) * WANDER_FACTOR;
            this.vy += Math.sin(this.wanderTheta) * WANDER_FACTOR;
        }

        // 4. BOUNDARIES (Soft turn)
        if (this.x < MARGIN) this.vx += TURN_FACTOR;
        if (this.x > width - MARGIN) this.vx -= TURN_FACTOR;
        if (this.y < MARGIN) this.vy += TURN_FACTOR;
        if (this.y > height - MARGIN) this.vy -= TURN_FACTOR;

        // 5. SPEED LIMIT
        const speedSq = this.vx * this.vx + this.vy * this.vy;
        const currentMax = panic ? MAX_SPEED * 1.5 : MAX_SPEED * this.personality;

        if (speedSq > currentMax * currentMax) {
            const speed = Math.sqrt(speedSq);
            if (speed > EPS) {
                this.vx = (this.vx / speed) * currentMax;
                this.vy = (this.vy / speed) * currentMax;
            }
        }

        // Min speed to prevent stalling
        if (speedSq < 0.1) {
            this.vx += (Math.random() - 0.5) * 0.5;
            this.vy += (Math.random() - 0.5) * 0.5;
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    draw(cr) {
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;

        const facingRight = this.vx >= 0;
        for (let r = 0; r < FISH_SPRITE.length; r++) {
            for (let c = 0; c < FISH_SPRITE[r].length; c++) {
                const val = FISH_SPRITE[r][c];
                if (!val) continue;

                if (val === 1) cr.setSourceRGB(...this.color);
                else if (val === 2) cr.setSourceRGB(1, 1, 1);

                const drawC = facingRight ? c : (FISH_SPRITE[r].length - 1 - c);
                cr.rectangle(
                    this.x + (drawC * this.scale),
                    this.y + (r * this.scale),
                    this.scale,
                    this.scale
                );
                cr.fill();
            }
        }
    }
}

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

        this._fishSchool = [];
        this._jellies = [];
        this._anglers = [];
        this._orcas = [];

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

        // 1) First safe time: BEFORE_REDRAW
        try {
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                if (this._inCleanup) return GLib.SOURCE_REMOVE;
                this._ensureAttached(true);
                this._scheduleSync(0);
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            // fallback
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (this._inCleanup) return GLib.SOURCE_REMOVE;
                this._ensureAttached(true);
                this._scheduleSync(0);
                return GLib.SOURCE_REMOVE;
            });
        }

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

                if (this._fishSchool.length === 0) {
                    for (let i = 0; i < FISH_COUNT; i++) this._fishSchool.push(new Fish(width, height));
                    for (let i = 0; i < JELLY_COUNT; i++) this._jellies.push(new Jellyfish(width, height));
                    for (let i = 0; i < ANGLER_COUNT; i++) this._anglers.push(new Angler(width, height));
                    for (let i = 0; i < ORCA_COUNT; i++) this._orcas.push(new Orca(width, height));
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

        this._fishSchool = [];
        this._jellies = [];
        this._anglers = [];
        this._orcas = [];

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

            try {
                this._step();
                this._area.queue_repaint();
                return GLib.SOURCE_CONTINUE;
            } catch (e) {
                console.error('BoidsGnome tick error: ' + e);
                this._stopSimulation();
                return GLib.SOURCE_REMOVE;
            }
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

        this._stopSimulation();
        this._uninstallScreenSaverHook();
        this._uninstallLogindHook();
        this._disconnectList(this._globalSigs);
        this._destroyAreaNow();

        this._inCleanup = false;
    }

    /* ---------- sim step & draw ---------- */

    _step() {
        const w = this._lastWidth;
        const h = this._lastHeight;
        if (!w || !h) return;

        for (const orca of this._orcas) orca.update(w, h);
        for (const angler of this._anglers) angler.update(w, h, this._orcas);
        for (const jelly of this._jellies) jelly.update(w, h);
        for (const fish of this._fishSchool) fish.update(w, h, this._fishSchool, this._anglers);
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

            for (const j of this._jellies) j.draw(cr);
            for (const o of this._orcas) o.draw(cr);
            for (const a of this._anglers) a.draw(cr);
            for (const f of this._fishSchool) f.draw(cr);

            // best-effort dispose (prevents GJS wrapper leaks on some setups)
            try { if (cr.$dispose) cr.$dispose(); } catch (e) { }
        } catch (e) {
            console.error('BoidsGnome repaint error: ' + e);
        }
    }
}
