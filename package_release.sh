#!/bin/bash

# Boids in the Blue Release Packager
# ----------------------------------

VERSION="1.1"
PLUGIN_DIR="org.kde.plasma.boidsaquarium11"
OUTPUT_NAME="BoidsInTheBlue-v${VERSION}.kpackage"
ZIP_NAME="BoidsInTheBlue-v${VERSION}.zip"

echo "📦 Packaging Boids in the Blue v${VERSION}..."

# Remove old builds
rm -f *.kpackage *.zip

# Create kpackage (basically a zip)
# We exclude hidden files and temporary files
zip -r "$OUTPUT_NAME" "$PLUGIN_DIR" -x "*/.*" -x "*/__pycache__/*"

# Create a standard zip for GitHub release
zip -r "$ZIP_NAME" "$PLUGIN_DIR" install_v11.sh README.md -x "*/.*"

echo "✅ Created $OUTPUT_NAME"
echo "✅ Created $ZIP_NAME"
echo "🎉 Ready for release!"
