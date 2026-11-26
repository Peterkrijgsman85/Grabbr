const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('system unzip behoudt Electron-bundlebestanden, execute-bit en frameworksymlink', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grabbr-electron-zip-'));
  const archive = path.join(root, 'electron.zip');
  const extracted = path.join(root, 'out');
  fs.mkdirSync(extracted);
  const script = String.raw`
import zipfile, stat, sys
archive=sys.argv[1]
entries={
'Electron.app/Contents/Info.plist':b'plist',
'Electron.app/Contents/MacOS/Electron':b'arm64-binary',
'Electron.app/Contents/_CodeSignature/CodeResources':b'coded-resources',
'Electron.app/Contents/Resources/default_app.asar':b'asar',
'Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework':b'framework'
}
with zipfile.ZipFile(archive,'w') as z:
  for name,data in entries.items():
    info=zipfile.ZipInfo(name)
    mode=0o100755 if name.endswith('/Electron') or name.endswith('Electron Framework') else 0o100644
    info.external_attr=(mode << 16)
    info.create_system=3
    z.writestr(info,data)
  link=zipfile.ZipInfo('Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/Current')
  link.external_attr=(0o120777 << 16)
  link.create_system=3
  z.writestr(link,b'A')
`;
  const made = spawnSync('python3', ['-c', script, archive], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const result = spawnSync('unzip', ['-q', archive, '-d', extracted], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const app = path.join(extracted, 'Electron.app');
  const codeResources = path.join(app, 'Contents/_CodeSignature/CodeResources');
  const executable = path.join(app, 'Contents/MacOS/Electron');
  const current = path.join(app, 'Contents/Frameworks/Electron Framework.framework/Versions/Current');
  assert.equal(fs.readFileSync(codeResources, 'utf8'), 'coded-resources');
  assert.ok(fs.statSync(executable).mode & 0o100);
  assert.equal(fs.lstatSync(current).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(current), 'A');
  fs.rmSync(root, { recursive: true, force: true });
});
