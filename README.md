# 🌊 Boids in the Blue (KDE Plasma Wallpaper)

> **Dive into a computational abyss.** Watch complex schooling patterns arise from simple rules. The ecosystem breathes with your PC.

![KDE Plasma 6](https://img.shields.io/badge/Plasma-6.0%2B-blue?logo=kde&logoColor=white)
![License](https://img.shields.io/badge/License-GPL_v3-green)
![Status](https://img.shields.io/badge/Status-Stable-success)

---

## 🎥 Demo

> *[Place your demo video here. Simply drag and drop an .mp4 file into the GitHub editor to upload and embed it!]*

<div align="center">
  <img src="preview.png" alt="Boids Aquarium Preview" width="100%">
</div>

---

# Boids in the Blue 🐟

> **A procedural ecosystem living in your idle cycles.**

**Boids in the Blue** ports the classic flocking algorithm to **KDE Plasma 6**, but with a twist. It's not a looped video. It's a **reactive substrate** that breathes with your hardware. Your desktop is now a living tank.

![Plasma 6](https://img.shields.io/badge/Plasma-6.0%2B-blue.svg?style=flat-square) ![License](https://img.shields.io/badge/License-GPLv3-green.svg?style=flat-square)

## ⚡ System-Reactive Core

This isn't just eye candy. The school connects directly to your machine's heartbeat.

*   **Hybrid System Load Engine**: We hook into CPU/GPU stress metrics.
*   **Visual `htop`**: When you compile a kernel or train a model, the water gets turbulent. The fish panic. It's a biological visualizations of your system load.
*   **Gain Control**: Adjust the **Response Intensity** via the config panel.
    *   *Damped*: Subtle shifts.
    *   *Volatile*: Absolute chaos at high load (Ambulance Mode).

## 🧬 Emergent Gameplay

No scripted paths. Pure math.

*   **Spawn & Feed**: Left-click to drop payload (worms). Fish hunt them down using hunger vectors.
*   **Life Cycle**: If a fish consumes enough calories (10 worms), it spawns a new instance.
*   **Mob Fear**: Predators (Orcas) chase fish. But if the school is dense enough (>20 units), the predator's "fear" weight overrides its "hunger". Safety in numbers.
*   **Physics**: Hard bounces and smooth wrapping. No entities lost to the void.

## 🎮 Inputs

*   **LMB (Click)**: Drop food.
*   **Hover**: Push forces (creates a bubble trail).
*   **Config**: Tweak population limits, cohesion factors, and color palettes in real-time.

## 🛠 Deployment

**Dependencies**: `kpackagetool6` (Standard in Plasma 6)

### One-Liner Install
```bash
# Clone and install
git clone https://github.com/your-repo/boids-in-the-blue.git
cd boids-in-the-blue
./install.sh
```

### Manual Install
```bash
kpackagetool6 --type Plasma/Wallpaper --install org.kde.plasma.boidsaquarium
```

### Upgrade
```bash
# If already installed
kpackagetool6 --type Plasma/Wallpaper --upgrade org.kde.plasma.boidsaquarium
```

Once installed, right-click your desktop → "Configure Desktop and Wallpaper" → Select **Boids in the Blue**.

---

*Code is law. PRs welcome.*

---

## 📝 Credits
Developed by **Arcanorca**.
Powered by HTML5 Canvas & QML.
Based on the classic Boids algorithm (Craig Reynolds).
