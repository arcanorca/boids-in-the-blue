.pragma library

// Flocking presets: the single source of truth for the settings page (config.qml) and for
// tests/flock-eval.js, which measures how each one behaves.
// "default" has no values: it reads the defaults from main.xml.
// Order of the values = KEYS.
var KEYS = ["fishMaxSpeed", "fishMinSpeed", "visualRange", "separationDist",
            "cohesionFactor", "alignmentFactor", "separationFactor", "wanderFactor", "turnFactor"];
var IDS = ["calm", "default", "lively", "chaotic"];
var VALUES = {
    calm:    [0.45, 0.12, 160, 50, 0.0002, 0.05, 0.003, 0.004, 0.05],
    "default": null,
    lively:  [1.5, 0.4, 130, 28, 0.0025, 0.05, 0.05, 0.04, 0.08],
    chaotic: [1.7, 0.4, 80, 32, 0.0004, 0.01, 0.03, 0.05, 0.09]
};
