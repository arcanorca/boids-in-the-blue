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

**Settings** (five tabs; **Reset to Defaults** is at the bottom):

*   **Appearance**: pick the visual theme from preview cards (switches live).
*   **Ocean**: how many fish, jellyfish, anglerfish and orcas, and how big each is (and the worms you drop).
*   **Behavior**: flocking style (Calm, Default, Lively, Chaotic), cursor reaction (Off to Panic), orca/angler aggression and speed. *Advanced flocking* (collapsed) has the raw values: speeds, vision range, personal space, attraction, alignment, repulsion, random drift, edge avoidance.
*   **Environment**: day/night cycle and water colors with a preview (greyed out, with a note, when the theme does not use them).
*   **System**: react to CPU, GPU, a custom sensor or nothing, and how strongly; pause the animation while the desktop is covered, and how much of the screen must be covered.

**Power saving**: the simulation is driven by the rendered frames, so it stops by itself on a screen the compositor no longer presents (monitor off or in power saving, lid closed on a laptop whose internal display is disabled, covered). Each screen is independent: an external monitor keeps animating while the laptop panel sleeps. After two seconds without frames the sensors and ambient animations are switched off too. Windows covering at least 90 % of a screen (adjustable 50 to 100 %, for example three tiled terminals) pause it like a maximized window does.

**Flocking presets** are measured, not guessed: `npm run flock` prints schooling, spacing, collision and turning metrics for each preset on the real simulation (`tests/flock-eval.js`).

## // THEMES

Three looks share the same simulation. Open the wallpaper settings and pick one on the **Appearance** tab (it switches live):

*   **Refined Pixel** (default): crisp animated pixel-art sprites, smooth water gradient, light shafts, marine snow and a seabed.
*   **Classic**: the original blocky sprites on a smooth gradient.
*   **Bioluminescent Deep**: glowing creatures in dark water.

## // CHANGELOG

### v1.2
- **Ukiyo-e theme**: a new selectable look, indigo ink on washi paper with Ryuusen wave strokes, a Hokusai-style surface strip and wakame kelp; an optional pigment (Nishiki-e) colour set is available by editing one constant in its `theme.js`.
- **Terminal archived**: the theme was removed; it is preserved in the git tag `archive/terminal`. A saved `terminal` setting falls back to Refined Pixel.
- **Soft Illustrated archived**: the theme was removed; it is preserved in the git tag `archive/illustrated`. A saved `illustrated` setting falls back to Refined Pixel.
- **Plugin id change**: now `com.github.arcanorca.boidsintheblue` (no version in id or name); `install.sh` migrates existing settings and removes the old package.
- **Pause when covered**: the simulation pauses while a maximized/fullscreen window, or windows covering at least 90 % of the screen (new setting, 50 to 100 %), hide the wallpaper (not applied on the lock screen).
- **Frame-driven simulation**: stepping follows the rendered frames at a fixed 25 steps per second on any display rate, so it stops on screens that are off, closed or blanked while other monitors keep running; idle screens also switch off sensors and ambient animations.
- **Smoother water**: Refined Pixel uses one smooth gradient instead of stepped bands.
- **Fish no longer pass through each other**: separation is now body-aware (the personal space never gets narrower than the fish body, and fish also react to neighbours that are about to arrive), so schools flow around each other instead of drifting through. Steering is smoothed and bounded (low-pass filter, acceleration limit and a maximum turn per step), so crowded fish no longer twitch. The Personal space and Repulsion sliders keep their meaning on top of that.
- **Flocking**: new defaults and presets that school smoothly (fish used to twitch from oversized separation kicks); the cohesion, alignment, repulsion, random drift and edge ranges were rescaled to span sane behaviour. Saved custom values stay; values outside the new ranges fall back to the defaults.
- **Themes**: three selectable looks (Refined Pixel is the new default, Classic keeps the original rendering, plus Bioluminescent Deep); switching at runtime keeps the same school.
- **Settings redesign**: five tabs (Appearance with theme preview cards, Ocean, Behavior, Environment, System); flocking presets; plain-word levels instead of "Zen+"; help buttons; advanced flocking values collapsed. All saved settings keep working.
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
