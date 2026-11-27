#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$ROOT/release-test}"
APP="$OUT/Grabbr.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app"
cp "$ROOT"/{main.js,preload.js,overlay-preload.js,package.json,LICENSE} "$APP/Contents/Resources/app/"
cp -R "$ROOT/src" "$ROOT/assets" "$APP/Contents/Resources/app/"
cp "$ROOT/assets/icon.icns" "$APP/Contents/Resources/Grabbr.icns"
cat > "$APP/Contents/Resources/TEST_BUILD.txt" <<'TXT'
Grabbr 0.7.4 macOS Apple Silicon test bundle.

No Node.js or npm is required. Because the build environment could not retrieve the Electron binary, this test bundle downloads and verifies the official Electron 45.4.1 arm64 runtime on first launch, caches it under ~/Library/Application Support/Grabbr, and reuses it afterwards. Internet access is required only for that first runtime installation.
TXT
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Grabbr</string><key>CFBundleName</key><string>Grabbr</string>
<key>CFBundleIdentifier</key><string>com.grabbr.test.arm64</string><key>CFBundleVersion</key><string>0.7.4</string>
<key>CFBundleShortVersionString</key><string>0.7.4</string><key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleExecutable</key><string>Grabbr</string><key>CFBundleIconFile</key><string>Grabbr.icns</string>
<key>LSMinimumSystemVersion</key><string>12.3</string><key>LSApplicationCategoryType</key><string>public.app-category.graphics-design</string>
<key>LSArchitecturePriority</key><array><string>arm64</string></array><key>NSHighResolutionCapable</key><true/>
<key>NSScreenCaptureUsageDescription</key><string>Grabbr gebruikt schermopname om vensters, schermen en geselecteerde gebieden vast te leggen.</string>
</dict></plist>
PLIST
# The tested launcher template lives in the checked-in test bundle source.
cp "$ROOT/macos/GrabbrLauncher" "$APP/Contents/MacOS/Grabbr"
chmod 755 "$APP/Contents/MacOS/Grabbr"
printf 'Built %s\n' "$APP"
