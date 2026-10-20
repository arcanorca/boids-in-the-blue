#!/bin/bash

# Boids in the Blue Installer
# ---------------------------

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
OLD_ID="org.kde.plasma.boidsaquarium11"

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 not found (needed to read metadata.json)."
    exit 1
fi

PLUGIN_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["KPlugin"]["Id"])' "$PLUGIN_DIR/metadata.json")" || PLUGIN_ID=""
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["KPlugin"]["Version"])' "$PLUGIN_DIR/metadata.json")" || VERSION=""
if [ -z "$PLUGIN_ID" ] || [ -z "$VERSION" ]; then
    echo "❌ Error: could not read Id/Version from metadata.json."
    exit 1
fi

echo "🌊 Installing Boids in the Blue $VERSION..."

# Check if kpackagetool6 exists
if ! command -v kpackagetool6 &> /dev/null; then
    echo "❌ Error: kpackagetool6 not found. Are you on Plasma 6?"
    exit 1
fi

# Function to install
# Only metadata.json + contents/ belong in the installed package (not ports, tests, tools)
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT
cp -r "$PLUGIN_DIR/metadata.json" "$PLUGIN_DIR/contents" "$STAGE_DIR/"

install_pkg() {
    kpackagetool6 --type Plasma/Wallpaper --install "$STAGE_DIR"
}

# Function to remove
remove_pkg() {
    echo "🗑️ Removing old package registration..."
    kpackagetool6 --type Plasma/Wallpaper --remove "$PLUGIN_ID"
}

# ── Migration from the old plugin id ─────────────────────────
# Prints a qdbus-like binary name, or nothing.
find_qdbus() {
    local b
    for b in qdbus6 qdbus-qt6 qdbus; do
        if command -v "$b" &> /dev/null; then echo "$b"; return 0; fi
    done
    return 1
}

# Runs a Plasma desktop script and prints its output. $1 = script text.
plasma_eval() {
    local q
    if q="$(find_qdbus)"; then
        "$q" org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "$1"
    elif command -v gdbus &> /dev/null; then
        gdbus call --session --dest org.kde.plasmashell --object-path /PlasmaShell \
            --method org.kde.PlasmaShell.evaluateScript "$1"
    elif command -v busctl &> /dev/null; then
        busctl --user call org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell evaluateScript s "$1"
    else
        return 127
    fi
}

# Builds the desktop script; config keys come from contents/config/main.xml.
build_migration_script() {
    python3 - "$PLUGIN_DIR/contents/config/main.xml" "$OLD_ID" "$PLUGIN_ID" <<'PYEOF'
import json, sys
import xml.etree.ElementTree as ET

def local(tag):
    return tag.rsplit('}', 1)[-1]

root = ET.parse(sys.argv[1]).getroot()
groups = {}
for g in root.iter():
    if local(g.tag) != 'group':
        continue
    keys = [e.get('name') for e in g if local(e.tag) == 'entry' and e.get('name')]
    groups.setdefault(g.get('name'), []).extend(keys)

js = """
var OLD = %s, NEW = %s, GROUPS = %s;
var moved = 0;
desktops().forEach(function (d) {
    if (d.wallpaperPlugin !== OLD) return;
    Object.keys(GROUPS).forEach(function (g) {
        GROUPS[g].forEach(function (k) {
            d.currentConfigGroup = ["Wallpaper", OLD, g];
            var v = d.readConfig(k);
            if (v === undefined || v === null || String(v) === "") return;
            d.currentConfigGroup = ["Wallpaper", NEW, g];
            d.writeConfig(k, v);
        });
    });
    d.wallpaperPlugin = NEW;
    d.currentConfigGroup = ["Wallpaper", NEW, "General"];
    d.reloadConfig();
    moved++;
});
print("BOIDS_MIGRATED=" + moved);
""" % (json.dumps(sys.argv[2]), json.dumps(sys.argv[3]), json.dumps(groups))
print(js)
PYEOF
}

# Echoes the number of desktops using the old plugin, or fails if Plasma is unreachable.
count_old_desktops() {
    local out
    out="$(plasma_eval 'print("BOIDS_OLD=" + desktops().filter(function(d){return d.wallpaperPlugin === "'"$OLD_ID"'"}).length)' 2>/dev/null)" || return 1
    out="$(printf '%s' "$out" | grep -o 'BOIDS_OLD=[0-9]*' | head -n1)"
    [ -n "$out" ] || return 1
    echo "${out#BOIDS_OLD=}"
}

# Result: MIGRATION_DONE=1 only when it is safe to remove the old package.
MIGRATION_DONE=0
OLD_INSTALLED=0
MIGRATED_COUNT=0
migrate_from_old() {
    kpackagetool6 --type Plasma/Wallpaper --list 2>/dev/null | grep -qx "$OLD_ID" && OLD_INSTALLED=1

    local old_count
    if old_count="$(count_old_desktops)"; then
        :
    else
        if [ "$OLD_INSTALLED" -eq 1 ]; then
            echo "⚠️ Could not reach a running Plasma shell, so your settings were NOT migrated."
            echo "   The old package ($OLD_ID) was left installed so you lose nothing."
            echo "   Log in to a Plasma session and run ./install.sh again, or do it by hand:"
            echo "   select \"Boids in the Blue\" in Desktop > Configure > Wallpaper, re-apply"
            echo "   your settings, then run:"
            echo "   kpackagetool6 --type Plasma/Wallpaper --remove $OLD_ID"
        fi
        return 0
    fi

    if [ "$old_count" -gt 0 ]; then
        echo "🔁 Migrating $old_count desktop(s) from $OLD_ID to $PLUGIN_ID..."
        local script out cfg backup
        script="$(build_migration_script)" || { echo "⚠️ Could not build migration script. Old package kept."; return 0; }
        cfg="${XDG_CONFIG_HOME:-$HOME/.config}/plasma-org.kde.plasma.desktop-appletsrc"
        backup="$cfg.boids-backup-$(date +%Y%m%d-%H%M%S)"
        if ! cp -p "$cfg" "$backup"; then
            echo "⚠️ Could not back up $cfg. Migration aborted; old package kept."
            return 0
        fi
        echo "💾 Backed up Plasma desktop config to: $backup"
        echo "   (to restore: quit plasmashell, copy it back over $cfg, start plasmashell)"
        out="$(plasma_eval "$script" 2>&1)" || { echo "⚠️ Migration script failed: $out"; echo "   Old package kept. Restore hint: cp \"$backup\" \"$cfg\" (with plasmashell stopped)."; return 0; }
        MIGRATED_COUNT="$(printf '%s' "$out" | grep -o 'BOIDS_MIGRATED=[0-9]*' | head -n1 | cut -d= -f2)"
        if [ -z "$MIGRATED_COUNT" ] || [ "$MIGRATED_COUNT" -ne "$old_count" ]; then
            echo "⚠️ Migration did not complete as expected (${MIGRATED_COUNT:-0}/$old_count). Old package kept."
            echo "   Output: $out"
            echo "   Restore hint: cp \"$backup\" \"$cfg\" (with plasmashell stopped)."
            MIGRATED_COUNT=0
            return 0
        fi
        echo "✅ Migrated settings of $MIGRATED_COUNT desktop(s) to the new plugin."
    fi
    MIGRATION_DONE=1
}

echo "📦 Deploying package..."
status=0
if kpackagetool6 --type Plasma/Wallpaper --list | grep -qx "$PLUGIN_ID"; then
    echo "🔄 Found existing installation. Attempting upgrade..."
    if ! kpackagetool6 --type Plasma/Wallpaper --upgrade "$STAGE_DIR"; then
        echo "⚠️ Upgrade failed (possibly corrupted installation). Retrying with clean install..."
        remove_pkg
        install_pkg || status=1
    fi
else
    install_pkg || status=1
fi

if [ "$status" -eq 0 ]; then
    echo "✅ Installation successful!"

    # Carry settings over from the old plugin id (only if it is installed or in use)
    migrate_from_old
    if [ "$MIGRATION_DONE" -eq 1 ] && [ "$OLD_INSTALLED" -eq 1 ]; then
        echo "🗑️ Removing old package $OLD_ID..."
        kpackagetool6 --type Plasma/Wallpaper --remove "$OLD_ID" || echo "⚠️ Could not remove $OLD_ID (harmless; remove it manually)."
    fi

    echo "🧹 Clearing QML cache..."
    rm -rf "$HOME/.cache/plasmashell/qmlcache"

    if [ "$MIGRATED_COUNT" -gt 0 ]; then
        echo "ℹ️ Desktops were switched live; a Plasma restart is usually not needed."
    fi

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
            echo "✨ Plasma restarted. Enjoy Boids in the Blue $VERSION!"
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
