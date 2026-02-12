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

[Watch Demo][boids-in-the-blue-preview.webm](https://github.com/user-attachments/assets/5d6c3304-87da-4c55-aa8f-8b1c4cd34b78)


<div align="center"> <img src="settings_preview.png" alt="Boids Aquarium Settings Preview" width="100%"> </div>

## // HOW IT WORKS

This wallpaper runs a procedural simulation based on Craig Reynolds' Boids algorithm (1987). It's built with QML and HTML5 Canvas.

Instead of just swimming randomly, the flock is connected to your hardware sensors.

### 1. Hardware Reactivity

The simulation monitors your system's stress level in real-time.

*   **Hybrid Monitoring**: It checks both CPU and GPU load and reacts to whichever is higher.
*   **Visual Feedback**: When your computer is idle, the flock is calm. When you compile code or play a game, the flock gets agitated, faster, and more chaotic.
*   **Control**: You can adjust how sensitive they are via the Response Intensity slider.

### 2. Ecosystem Logic

*   **The Rules**: Fish follow three simple vectors: Separation (don't crash), Alignment (fly together), and Cohesion (stay close).
*   **Life Cycle**: Left-click to spawn worms. If a fish eats 10 worms, it spawns a baby fish. The school grows as you feed it.
*   **Predators & Mob Fear**: Orcas hunt the fish. However, if the school gets dense enough (>20 fish), the predator gets scared and flees. Safety in numbers.

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

## // CONTROLS & CONFIG

**Mouse Interactions:**

*   **Left Click**: Drop food (Worms).
*   **Hover**: Pushes fish away (creates bubble trails).

**Settings Menu:**

*   **Input Source**: Choose between CPU, GPU, or Hybrid.
*   **Intensity**: Set how hard the flock reacts to system load (25% to 200%).
*   **Zen Mode**: Removes sudden movements for a calmer look.


## // CREDITS

*   **Developer**: arcanorca
*   **License**: GPLv3
*   **Stack**: QML / JavaScript / HTML5 Canvas Context
