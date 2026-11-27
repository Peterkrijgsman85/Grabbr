const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const launcher = fs.readFileSync(path.join(root, 'macos', 'GrabbrLauncher'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'build-macos-arm64-test-app.sh'), 'utf8');

test('macOS testlauncher vereist geen Node.js of npm', () => {
  assert.doesNotMatch(launcher, /\bnode\b|\bnpm\b/);
  assert.match(launcher, /electron-v\$VERSION-darwin-arm64\.zip/);
  assert.doesNotMatch(launcher, /electron-v[^\s"']*(?:darwin-x64|universal)[^\s"']*\.zip/);
});

test('gedownloade officiële runtime wordt vóór wijziging cryptografisch geverifieerd', () => {
  const hash = launcher.indexOf('shasum -a 256');
  const verify = launcher.indexOf('codesign --verify --deep --strict --verbose=4');
  const copy = launcher.indexOf('/usr/bin/ditto --rsrc --extattr "$electron_app" "$RUNTIME_APP"');
  assert.ok(hash >= 0 && verify > hash && copy > verify);
  assert.match(launcher, /Developer ID Application/);
  assert.match(launcher, /TeamIdentifier/);
});

test('Electron ZIP-layout wordt vóór extractie op volledige top-level app gecontroleerd', () => {
  assert.match(launcher, /verify_archive_layout\(\)/);
  assert.match(launcher, /Electron\.app\/Contents\/_CodeSignature\/CodeResources/);
  assert.match(launcher, /Contents\/Resources\/default_app\.asar/);
  assert.match(launcher, /Electron Framework\.framework\/Versions\/A\/Electron Framework/);
});

test('extractie gebruikt system unzip, exact Electron.app-pad en geen find of ditto-extractie', () => {
  assert.match(launcher, /\/usr\/bin\/unzip -q "\$zip" -d "\$extracted"/);
  assert.match(launcher, /electron_app="\$extracted\/Electron\.app"/);
  assert.doesNotMatch(launcher, /ditto -x -k/);
  assert.doesNotMatch(launcher, /find "\$extracted"[^\n]*Electron\.app/);
});

test('diagnostische preflight vereist Resources, Frameworks, CodeResources en symlinks', () => {
  assert.match(launcher, /preflight_extracted_bundle\(\)/);
  assert.match(launcher, /Contents\/Resources is leeg/);
  assert.match(launcher, /Contents\/Frameworks is leeg/);
  assert.match(launcher, /Frameworksymlink Versions\/Current ontbreekt/);
  assert.match(launcher, /CodeResources wijkt na extractie af/);
});

test('gewijzigde testbundle wordt na payloadinjectie ad-hoc opnieuw verzegeld', () => {
  const payload = launcher.indexOf('/usr/bin/ditto "$APP_SOURCE" "$RUNTIME_APP/Contents/Resources/app"');
  const resign = launcher.indexOf('codesign --force --deep --sign -', payload);
  const preserve = launcher.indexOf('--preserve-metadata=entitlements,requirements,flags,runtime', resign);
  const verify = launcher.indexOf('codesign --verify --deep --strict', resign);
  assert.ok(payload >= 0 && resign > payload && preserve > resign && verify > preserve);
});

test('ongeldige 0.7.0 runtimecache wordt verworpen en opnieuw geïnstalleerd', () => {
  assert.match(launcher, /verify_cached_runtime\(\)/);
  const verify = launcher.indexOf('if ! verify_cached_runtime; then');
  const remove = launcher.indexOf('/bin/rm -rf "$RUNTIME_APP"', verify);
  const install = launcher.indexOf('install_runtime', remove);
  assert.ok(verify >= 0 && remove > verify && install > remove);
});

test('builder maakt Grabbr.app met arm64-prioriteit, icoon en ingebedde source', () => {
  assert.match(builder, /Grabbr\.app/);
  assert.match(builder, /LSArchitecturePriority/);
  assert.match(builder, /<string>arm64<\/string>/);
  assert.match(builder, /Grabbr\.icns/);
  assert.match(builder, /Contents\/Resources\/app/);
});
