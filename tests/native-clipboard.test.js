const test = require('node:test');
const assert = require('node:assert/strict');
const { MACOS_JXA, WINDOWS_POWERSHELL, nativeClipboardCommand, parseNativeResult, writePngNative } = require('../src/native-clipboard.js');
const { pngHeader } = require('./png-fixture.js');

const png = pngHeader(640, 360);

test('macOS fallback gebruikt NSPasteboard met PNG-bytes via stdin en geen tijdelijk bestand', () => {
  const spec = nativeClipboardCommand('darwin', png);
  assert.equal(spec.command, '/usr/bin/osascript');
  assert.deepEqual(spec.input, png);
  assert.match(MACOS_JXA, /NSPasteboard\.generalPasteboard/);
  assert.match(MACOS_JXA, /setDataForType\(data, type\)/);
  assert.doesNotMatch(MACOS_JXA, /writeToFile|NSTemporaryDirectory|\/tmp\//);
});

test('Windows fallback gebruikt STA PowerShell Windows Forms Clipboard zonder tijdelijk bestand', () => {
  const spec = nativeClipboardCommand('win32', png);
  assert.equal(spec.command, 'powershell.exe');
  assert.ok(spec.args.includes('-STA'));
  assert.equal(spec.input, png.toString('base64'));
  assert.match(WINDOWS_POWERSHELL, /Clipboard\]::SetImage/);
  assert.match(WINDOWS_POWERSHELL, /Clipboard\]::GetImage/);
  assert.doesNotMatch(WINDOWS_POWERSHELL, /Temp|WriteAllBytes|Set-Content|Out-File/);
});

test('native helperresultaat moet exacte PNG-afmetingen bevestigen', () => {
  assert.deepEqual(parseNativeResult('{"ok":true,"width":640,"height":360}\n', { width:640,height:360 }), { width:640,height:360 });
  assert.throws(() => parseNativeResult('{"ok":true,"width":10,"height":10}', { width:640,height:360 }), /andere afbeeldingsafmetingen/);
});

test('native writer werkt testbaar via geïnjecteerde procesrunner', async () => {
  let received;
  const result = await writePngNative(png, 'darwin', {
    runProcessImpl: async spec => { received = spec; return { stdout: '{"ok":true,"width":640,"height":360}\n', stderr: '' }; }
  });
  assert.equal(received.command, '/usr/bin/osascript');
  assert.deepEqual(result, { ok:true,width:640,height:360,method:'macOS NSPasteboard' });
});
