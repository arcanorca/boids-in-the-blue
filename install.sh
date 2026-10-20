#!/bin/bash

# Boids in the Blue v1.1 Installer
# ----------------------------------

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ID="org.kde.plasma.boidsaquarium11"

echo "🌊 Installing Boids in the Blue v1.1..."

# Check if kpackagetool6 exists
if ! command -v kpackagetool6 &> /dev/null; then
    echo "❌ Error: kpackagetool6 not found. Are you on Plasma 6?"
    exit 1
fi

# Try to upgrade first, if fails, install
# Function to install
install_pkg() {
    kpackagetool6 --type Plasma/Wallpaper --install "$PLUGIN_DIR"
}

# Function to remove
remove_pkg() {
    echo "🗑️ Removing old package registration..."
    kpackagetool6 --type Plasma/Wallpaper --remove "$PLUGIN_ID"
}

echo "📦 Deploying package..."
status=0
if kpackagetool6 --type Plasma/Wallpaper --list | grep -qx "$PLUGIN_ID"; then
    echo "🔄 Found existing installation. Attempting upgrade..."
    if ! kpackagetool6 --type Plasma/Wallpaper --upgrade "$PLUGIN_DIR"; then
        echo "⚠️ Upgrade failed (possibly corrupted installation). Retrying with clean install..."
        remove_pkg
        install_pkg || status=1
    fi
else
    install_pkg || status=1
fi

if [ "$status" -eq 0 ]; then
    echo "✅ Installation successful!"
    echo "🧹 Clearing QML cache..."
    rm -rf "$HOME/.cache/plasmashell/qmlcache"

    if [ -t 0 ]; then
        echo "🔄 Restarting Plasma Shell (Optional)..."
        read -p "Do you want to restart Plasma to apply changes immediately? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if ! systemctl --user restart plasma-plasmashell; then
                echo "⚠️ systemctl restart failed. Falling back to kquitapp6/kstart..."
                kquitapp6 plasmashell
                (setsid kstart plasmashell > /dev/null 2>&1 &)
            fi
            echo "✨ Plasma restarted. Enjoy your aquarium v1.1!"
        else
            echo "✨ Done. You may need to re-apply the wallpaper."
        fi
    else
        echo "✨ Done. Restart Plasma or re-apply the wallpaper to see changes."
    fi
else
    echo "❌ Installation failed."
    exit 1
fi
