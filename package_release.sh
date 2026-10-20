#!/bin/bash

# Boids in the Blue Release Packager
# ----------------------------------
# Builds the installable KPackage (metadata.json + contents/ only) and a
# GitHub release zip that also carries the installer and README.

set -euo pipefail
cd "$(dirname "$0")"

# Validate sources before packaging
python3 -m json.tool metadata.json > /dev/null || { echo "❌ metadata.json is invalid"; exit 1; }
if command -v xmllint &> /dev/null; then
    xmllint --noout contents/config/main.xml || { echo "❌ main.xml is invalid"; exit 1; }
else
    echo "⚠️ xmllint not found, skipping main.xml validation"
fi

VERSION="$(python3 -c 'import json; print(json.load(open("metadata.json"))["KPlugin"]["Version"])')"
OUTPUT_NAME="BoidsInTheBlue-v${VERSION}.kpackage"
ZIP_NAME="BoidsInTheBlue-v${VERSION}.zip"
PACKAGE_FILES=(metadata.json contents)

echo "📦 Packaging Boids in the Blue v${VERSION}..."

rm -f BoidsInTheBlue-*.kpackage BoidsInTheBlue-*.zip

# KPackage = zip with metadata.json and contents/ at the top level
zip -qr "$OUTPUT_NAME" "${PACKAGE_FILES[@]}" -x "*/.*" -x ".*" -x "*/__pycache__/*"

# Release zip for GitHub
zip -qr "$ZIP_NAME" "${PACKAGE_FILES[@]}" install.sh README.md -x "*/.*" -x ".*" -x "*/__pycache__/*"

echo "✅ Created $OUTPUT_NAME"
echo "✅ Created $ZIP_NAME"
echo "🎉 Ready for release!"
