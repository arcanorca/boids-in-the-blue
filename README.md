# Boids in the Blue (KDE Plasma 6 Live Wallpaper)

<div align="center">
  <br/> <img src="https://raw.githubusercontent.com/arcanorca/boids-in-the-blue/main/logo.svg" width="200" />
  
  <br/> <br/> </div>

A lightweight, real-time Boids simulation. Relaxing, interactive, and performance-friendly.

## // DEMO

https://github.com/user-attachments/assets/d896e1b9-4d1e-4f65-bfdf-85580c7df1e8

<div align="center">
  <h3>[Screenshots]</h3>
  
  <img src="https://github.com/user-attachments/assets/37279e9e-3b12-47c3-9e43-376c1617dfd7" width="45%" style="margin:5px;" />
  <img src="https://github.com/user-attachments/assets/bff973bc-1e15-4aec-86fc-962ca3192d8e" width="45%" style="margin:5px;" />
  
  <br/>

  <img src="https://github.com/user-attachments/assets/42380813-dab9-4f95-a1d4-643c1fef97fd" width="45%" style="margin:5px;" />
  <img src="https://github.com/user-attachments/assets/eb6690f0-bea8-43a3-bf50-86fe543a07bb" width="45%" style="margin:5px;" />

  <br/><br/>

  <h3>[Settings GUI]</h3>
  <img src="https://github.com/user-attachments/assets/4a7821b8-8e1b-48d8-9365-3cfd12d00fee" width="30%" style="box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2); border-radius: 10px;" />
</div>



## // HOW IT WORKS

This wallpaper runs a procedural flocking simulation based on Craig Reynolds’ Boids algorithm (1987), which models lifelike group motion using simple local rules like separation, alignment, and cohesion. The name “Boids” comes from “bird-oid”. 

It’s built with QML and an HTML5 Canvas renderer for smooth real-time animation.


### 1. Reactivity & Interaction

The simulation monitors your system's stress level in real-time.

*   **System Monitoring**: Choose to track CPU, GPU, Both or custom sensor ID. As the load increases, the fish gradually turn red and start trembling nervously.
*   **Cursor Evasion**: The school (group of fish) perceives your mouse cursor as a foreign object. If you move the pointer too close, the fish will scatter and flee to avoid it.
*   **Control**: You can fine-tune the reaction sensitivity and cursor panic using the Response Intensity slider in settings GUI.

### 2. Ecosystem Logic

*   **The Algorithm**: Fish follow three simple bird-oid vectors: Separation (don't crash!), Alignment (swim together), and Cohesion (stay close).
*   **Life Cycle**: Left-click to spawn worms. Breeding is a group effort: whenever the school collectively consumes 10 worms, a new baby fish is born, yay!
*   **Predators**: Orcas and Anglerfish roam the screen. If the school gets too close, they simply chase the fish, causing them to scatter.

## // INSTALLATION

**Requirements**: KDE Plasma 6 + kpackagetool6


### KDE Store

`Desktop and Wallpaper` -> `Get New Plugins...` -> search `Boids`

### Git

```bash
# 1. Clone the repo
git clone https://github.com/arcanorca/boids-in-the-blue.git
cd boids-in-the-blue

# 2. Run install script
./install.sh

# OR manual install (plugin id: com.github.arcanorca.boidsintheblue):
# kpackagetool6 --type Plasma/Wallpaper --install .
# Update an existing install:
# kpackagetool6 --type Plasma/Wallpaper --upgrade .
# Uninstall:
# kpackagetool6 --type Plasma/Wallpaper --remove com.github.arcanorca.boidsintheblue
```

### Upgrading from 1.1

v1.2 changed the plugin id (`org.kde.plasma.boidsaquarium11` -> `com.github.arcanorca.boidsintheblue`).

*   **install.sh**: migrates your settings to the new id automatically, switches your desktops to the new plugin and then removes the old package. Plasma must be running; if it is not, the old package is kept and nothing is lost.
*   **KDE Store**: after installing 1.2, select "Boids in the Blue" again in the Wallpaper settings and remove the old "Boids in the Blue v1.1" entry. Settings must be re-applied manually on this path.

## // OTHER VERSIONS

Both ports run the same simulation core as the KDE plugin (`core/boids-core.js`), so they share its behaviour (worms, bubbles, breeding, predators, cursor fear, NaN safety). Each port only has its own renderer, input and lifecycle code. The copies `boids-gnome-port/boids-core.js` and `boids-web/boids-core.js` are generated: after changing the core run `npm run build` (`npm test` fails if they are stale).

### 1. Gnome Shell Port
A lightweight port for Gnome Desktop users is included in the `boids-gnome-port` folder.
*   **Tested On**: Fedora 43 (Other distributions are likely compatible but unverified). The latest core-based rewrite has only been syntax/logic checked outside a GNOME session.
*   **Install**: Copy the whole `boids-gnome-port` folder (it must include `boids-core.js`) to `~/.local/share/gnome-shell/extensions/boids-gnome-port@arcanorca` and restart session.
*   **Configuration**: No GUI yet. You can tweak counts and sizes in the `CONFIG` object at the top of `extension.js` (same keys as the KDE settings). There is no pointer interaction on GNOME.

### 2. Web / HTML5 Port
A standalone HTML5 version is available in the `boids-web` folder.
*   **Usage**: Open `boids-web/index.html` in any modern web browser (works from `file://`; keep `boids-core.js` next to it). Left-click drops a worm, right-click bursts bubbles, the cursor scares the fish.
*   **Configuration**: Edit the `CONFIG` object inside `index.html` (same keys as the KDE settings).

## // CONTROLS & CONFIG

**Mouse Interactions:**

*   **Left-click**: Drop food (Worms).
*   **Left-click hold**: Cursor interaction fallback (fish flee + bubbles).

**Settings Menu:**

*   **Input Source**: Choose between CPU, GPU, Hybrid or custom ID for sensors.
*   **Response Intensity**: Set how hard the flock reacts to system load (25% to 200%).
*   **Cursor Fear**: Zen, Zen+, Strong, Panic, it controls how dramatically fish react to your cursor.
*   **Day/Night Cycle**: Syncs water gradient to your local time of day, can be toggle on/off.
*   **Predator Speed/Aggression**: Fine-tune orca and angler behavior.

## // CHANGELOG

### v1.2
- **Plugin id change**: now `com.github.arcanorca.boidsintheblue` (no version in id or name); `install.sh` migrates existing settings and removes the old package.
- **Pause when covered**: the simulation pauses while a maximized/fullscreen window covers the wallpaper (not applied on the lock screen).
- **Bug fixes**: (to be refined)

### v1.1
- **Major Optimization**: Cached config per-step, removed redundant repaints. CPU thread usage reduced 80% compare to v1.0.
- **Day/Night Cycle**: Added a real-time Day/Night cycle with sunrise/sunset gradients and surface glimmer.
- **UI Polish**: Refreshed the Settings GUI and added a "Reset to Defaults" button.
- **Web Port Sync**: Day/night cycle, cursor interaction, predator AI ported to HTML5 version.
- **Orca Cursor Chase**: Orcas pursue your cursor.
- **Smooth U-Turn**: Fish arc away from walls instead of bouncing.

## // CREDITS

*   **Developer**: arcanorca 
*   **License**: GPLv3
*   **Stack**: QML / JavaScript / HTML5 Canvas Context


```text
       ████
   ██████████
 ██████████◉◉
 ████████████
   ██████
     ██
```
