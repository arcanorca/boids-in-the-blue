#!/bin/bash

# Define paths
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/org.kde.plasma.boidsaquarium"
DEST_DIR="$HOME/.local/share/plasma/wallpapers/org.kde.plasma.boidsaquarium"

echo "Installing Boids in the Blue Wallpaper Plugin..."
echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"

# Ensure source exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found at $SOURCE_DIR"
    exit 1
fi

# Create destination parent directory if it doesn't exist
mkdir -p "$HOME/.local/share/plasma/wallpapers"

# Remove old version if it exists
if [ -d "$DEST_DIR" ]; then
    echo "Removing previous version..."
    rm -rf "$DEST_DIR"
fi

# Install new version
echo "Copying files..."
cp -r "$SOURCE_DIR" "$DEST_DIR"

echo "Installation complete!"
echo ""
echo "To apply changes:"
echo "1. Right connect on your desktop -> Configure Desktop and Wallpaper"
echo "2. Select 'Boids in the Blue' from the Wallpaper Type dropdown."
echo "   (If it doesn't appear, you may need to restart Plasma: 'plasmashell --replace &')"
