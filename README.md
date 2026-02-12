# Boids in the Blue 🐟 (KDE Plasma 6 Live Wallpaper)

```text
       ████
   ██████████
 ██████████◉◉
 ████████████
   ██████
     ██
```

A system-reactive flocking simulation.

## // DEMO

https://github.com/user-attachments/assets/d896e1b9-4d1e-4f65-bfdf-85580c7df1e8

<div align="center">
  <img src="settings_preview.png" alt="Settings Menu" width="35%">
</div>

## // HOW IT WORKS

This wallpaper runs a procedural flocking simulation based on Craig Reynolds’ Boids algorithm (1987), which models lifelike group motion using simple local rules like separation, alignment, and cohesion. The name “Boids” comes from “bird-oid”. It’s built with QML and an HTML5 Canvas renderer for smooth real-time animation.


### 1. Reactivity & Interaction

The simulation monitors your system's stress level in real-time.

*   **Hybrid Monitoring**:Fully configurable—choose to track CPU, GPU, Both or custom sensor ID. As the load increases, the fish gradually turn red and start trembling nervously.
*   **Cursor Evasion**: The school (flock of fish) perceives your mouse cursor as a foreign object. If you move the pointer too close, the fish will scatter and flee to avoid it.
*   **Control**: You can fine-tune the reaction sensitivity and cursor panic using the Response Intensity slider in settings GUI.

### 2. Ecosystem Logic

*   **The Algorithm**: Fish follow three simple bird-oid vectors: Separation (don't crash), Alignment (swim together), and Cohesion (stay close).
*   **Life Cycle**: Left-click to spawn worms. Breeding is a group effort: whenever the school collectively consumes 10 worms, a new baby fish is born.
*   **Predators**: Orcas and Anglerfish roam the screen. If the school gets too close, they simply chase the fish, causing them to scatter.

## // INSTALLATION

**Requirements**: KDE Plasma 6 + kpackagetool6

### Option A: Git (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/arcanorca/boids-in-the-blue.git
cd boids-in-the-blue

# 2. Install
kpackagetool6 --type Plasma/Wallpaper --install .
```

### Option B: Update

If you already have it installed and want the new features:

```bash
cd boids-in-the-blue
git pull
kpackagetool6 --type Plasma/Wallpaper --upgrade .
```

## // OTHER VERSIONS

### 1. Gnome Shell Port
A lightweight port for Gnome Desktop users is included in the `boids-gnome-port` folder.
*   **Tested On**: Fedora 43 (Other distributions are likely compatible but unverified).
*   **Install**: Copy `boids-gnome-port` to `~/.local/share/gnome-shell/extensions/boids-gnome-port@arcanorca` and restart session.
    **Configuration**: No GUI yet. You can manually tweak visual parameters (count, speed, colors) by editing the constants in extension.js.

### 2. Web / HTML5 Port
A standalone HTML5 version is available in the `boids-web` folder.
*   **Usage**: Simply open `boids-web/index.html` in any modern web browser.
*   **Configuration**: You can customize the simulation behavior by modifying the variables directly inside the index.html file.

## // CONTROLS & CONFIG

**Mouse Interactions:**

*   **Left Click**: Drop food (Worms).
*   **Hover**: Pushes fish away (creates bubble trails).

**Settings Menu:**

*   **Input Source**: Choose between CPU, GPU, Hybrid or custom ID for sensors
*   **Intensity**: Set how hard the flock reacts to system load (25% to 200%).
*   **Zen Mode**: Removes sudden movements for a calmer look.


## // CREDITS

*   **Developer**: arcanorca
*   **License**: GPLv3
*   **Stack**: QML / JavaScript / HTML5 Canvas Context
