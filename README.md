# Boids in the Blue 🐟

<div align="center">

```text
       ████
   ██████████
 ██████████◉◉
 ████████████
   ██████
     ██
```

**A System-Reactive Artificial Life Simulation for KDE Plasma 6**

[![Plasma 6 Compatible](https://img.shields.io/badge/Plasma-6.0%2B-blue?style=flat-square&logo=kde)](https://kde.org/plasma-desktop/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-green.svg?style=flat-square)](LICENSE)

</div>

---

> **"Dive into a computational abyss."**
>
> Watch complex schooling patterns emerge from simple rules. This isn't a looped video—it's a living ecosystem that breathes with your hardware.

---

## 🎥 Alive on Your Desktop

**Real-time render. Fluid dynamics. Zero pre-baked animations.**

[Watch the Demo](https://github.com/user-attachments/assets/cb6ac6cf-664a-43f1-abf5-2ebe053aeaf6)

<div align="center"> <img src="preview.png" alt="Boids Aquarium Preview" width="100%"> </div>

## ⚡ System Reactivity

The ocean reflects your computer's state. The flock connects directly to your hardware sensors, creating a visualized `htop` for your desktop.

### 🧠 Hybrid Monitoring Engine
The simulation monitors both **CPU** and **GPU** load in real-time, reacting to whichever is under higher stress.

*   **Idle State**: The water is calm. Fish drift lazily. Ideal for focused work.
*   **High Load**: When you compile code, render 3D scenes, or train models, the ecosystem responds. The flock becomes agitated, faster, and chaotic.
*   **Response Intensity**: Customizable sensitivity. From *Subtle* shifts to *Organic* panic.

## 🧬 The Ecosystem

The simulation is built on an extended version of Craig Reynolds' Boids algorithm (1987), featuring:

*   **Diverse Population**:
    *   **Fish**: The core school. They follow Alignment, Cohesion, and Separation rules.
    *   **Jellyfish**: Drift slowly, unaffected by the school's panic.
    *   **Anglers**: Solitary deep-sea dwellers.
    *   **Orcas**: Apex predators that hunt the fish.
*   **Mob Dynamics**:
    *   **Predation**: Orcas hunt fish.
    *   **Fear & courage**: If the fish school becomes dense enough (>20 units), they turn the tables and chase the predator away. Safety in numbers.
*   **Lifecycle**:
    *   **Feeding**: Left-click to spawn worms.
    *   **Reproduction**: Fish that eat enough worms will spawn offspring.

## ⚙️ Configuration & Customization

Tailor the simulation to your aesthetic and performance needs via the Plasma Desktop settings.

### 1. Population Control
Fine-tune the density of your aquarium.
*   **Spawn Counts**: Set exact numbers for Fish, Jellyfish, Anglers, and Orcas.
*   **Creature Scale**: Adjust the size of each species independently (e.g., make massive whales or tiny nano-swarms).

### 2. Behavior Engine
*   **Flocking Physics**: Tweak *Cohesion*, *Alignment*, and *Separation* forces to change how the school moves.
*   **Speed Limits**: Set *Min/Max Speed* constraints.
*   **Personal Space**: Adjust collision avoidance distance.
*   **Cursor Interaction**:
    *   *Panic*: Fish flee from your mouse.
    *   *Zen*: Fish ignore the cursor for a purely observational experience.

### 3. Visuals
*   **Water Colors**: Customize the gradient of the deep. Pick your own *Surface* and *Deep* colors to match your desktop theme (e.g., Dracula, Nord, or Gruvbox palettes).
*   **FPS Limit**: Cap the simulation frame rate for battery saving on laptops.

## 📦 Installation

**Requirements**: KDE Plasma 6 + `kpackagetool6`

### Option A: Git (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/arcanorca/boids-in-the-blue.git
cd boids-in-the-blue

# 2. Install the wallpaper plugin
kpackagetool6 --type Plasma/Wallpaper --install .
```

### Option B: Update Existing

```bash
cd boids-in-the-blue
git pull
kpackagetool6 --type Plasma/Wallpaper --upgrade .
```

## 🎮 Controls

| Action | Effect |
| :--- | :--- |
| **Left Click** | Drop food (Worms) for the fish to eat. |
| **Right Click** | Open Desktop Menu -> "Configure Desktop and Wallpaper" to access settings. |
| **Hover** | Pushes fish away (unless in *Zen* mode). |

## 📝 Credits

*   **Developer**: [arcanorca](https://github.com/arcanorca)
*   **Tech Stack**: QML / JavaScript / HTML5 Canvas
*   **License**: GPLv3
