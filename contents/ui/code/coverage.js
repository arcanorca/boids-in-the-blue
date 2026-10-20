.pragma library

// How much of a screen is hidden behind windows: the share of a COLS x ROWS grid of sample points
// (cell centres) that lies inside at least one window rectangle (so overlapping windows count once).
//
//   rects:  [{x, y, width, height}, ...] in the same (global, logical) coordinates as `screen`
//   screen: {x, y, width, height}
//   returns 0..1 (0 for an empty or invalid screen; invalid rectangles are ignored)

var COLS = 48;
var ROWS = 27;

function coverage(rects, screen, cols, rows) {
    cols = cols || COLS;
    rows = rows || ROWS;
    if (!screen || !(screen.width > 0) || !(screen.height > 0) || !rects || !rects.length) return 0;
    // clip every rectangle to the screen first; drop empty ones
    var clipped = [];
    for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (!r || !(r.width > 0) || !(r.height > 0)) continue;
        var x0 = Math.max(r.x, screen.x), y0 = Math.max(r.y, screen.y);
        var x1 = Math.min(r.x + r.width, screen.x + screen.width);
        var y1 = Math.min(r.y + r.height, screen.y + screen.height);
        if (x1 > x0 && y1 > y0) clipped.push([x0, y0, x1, y1]);
    }
    if (!clipped.length) return 0;
    var hit = 0;
    for (var cy = 0; cy < rows; cy++) {
        var py = screen.y + (cy + 0.5) * screen.height / rows;
        for (var cx = 0; cx < cols; cx++) {
            var px = screen.x + (cx + 0.5) * screen.width / cols;
            for (var k = 0; k < clipped.length; k++) {
                var c = clipped[k];
                if (px >= c[0] && px < c[2] && py >= c[1] && py < c[3]) { hit++; break; }
            }
        }
    }
    return hit / (cols * rows);
}

// Pause decision: coverage (0..1) against a percent threshold (50..100); 100 % means every
// sample point is covered. The threshold is clamped; a missing or invalid one means 90.
function isCovered(fraction, thresholdPercent) {
    var t = Math.max(50, Math.min(100, Number(thresholdPercent) || 90));
    return fraction >= t / 100 - 1e-9;
}
