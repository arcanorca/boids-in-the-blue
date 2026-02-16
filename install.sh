#!/bin/bash

# Boids in the Blue v1.1 Installer
# ----------------------------------

PLUGIN_DIR="org.kde.plasma.boidsaquarium11"
PLUGIN_ID="org.kde.plasma.boidsaquarium11"

echo "🌊 Installing Boids in the Blue v1.1..."

# Check if kpackagetool6 exists
if ! command -v kpackagetool6 &> /dev/null; then
    echo "❌ Error: kpackagetool6 not found. Are you on Plasma 6?"
    exit 1
fi

# Try to upgrade first, if fails, install
echo "📦 Deploying package..."
if kpackagetool6 --type Plasma/Wallpaper --list | grep -q "$PLUGIN_ID"; then
    kpackagetool6 --type Plasma/Wallpaper --upgrade "$PLUGIN_DIR"
else
    kpackagetool6 --type Plasma/Wallpaper --install "$PLUGIN_DIR"
fi

if [ $? -eq 0 ]; then
    echo "✅ Installation successful!"
    echo "🧹 Clearing QML cache..."
    rm -rf "$HOME/.cache/plasmashell/qmlcache"
    
    echo "🔄 Restarting Plasma Shell (Optional)..."
    read -p "Do you want to restart Plasma to apply changes immediately? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        systemctl --user restart plasma-plasmashell
        echo "✨ Plasma restarted. Enjoy your aquarium v1.1!"
    else
        echo "✨ Done. You may need to re-apply the wallpaper."
    fi
else
    echo "❌ Installation failed."
    exit 1
fi
