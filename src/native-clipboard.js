'use strict';

const { spawn } = require('node:child_process');
const { pngDimensions, dimensionsMatch } = require('./clipboard-payload.js');

const MACOS_JXA = String.raw`
ObjC.import('AppKit');
ObjC.import('Foundation');
function run() {
  var data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  if (!data || Number(data.length) < 24) throw new Error('Geen geldige PNG-data ontvangen.');
  var representation = $.NSBitmapImageRep.imageRepWithData(data);
  if (!representation) throw new Error('AppKit kon de PNG niet lezen.');
  var pasteboard = $.NSPasteboard.generalPasteboard;
  pasteboard.clearContents;
  var type = $('public.png');
  var written = pasteboard.setDataForType(data, type);
  var confirmed = pasteboard.dataForType(type);
  if (!written || !confirmed || Number(confirmed.length) !== Number(data.length)) throw new Error('NSPasteboard bevestigde de PNG niet.');
  return JSON.stringify({ ok: true, width: Number(representation.pixelsWide), height: Number(representation.pixelsHigh) });
}`;

const WINDOWS_POWERSHELL = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$encoded = [Console]::In.ReadToEnd().Trim()
if ([string]::IsNullOrWhiteSpace($encoded)) { throw 'Geen PNG-data ontvangen.' }
$bytes = [Convert]::FromBase64String($encoded)
$stream = New-Object System.IO.MemoryStream(,$bytes)
$source = [System.Drawing.Image]::FromStream($stream, $true, $true)
$bitmap = New-Object System.Drawing.Bitmap($source)
$written = $false
for ($attempt = 0; $attempt -lt 6 -and -not $written; $attempt++) {
  try {
    [System.Windows.Forms.Clipboard]::SetImage($bitmap)
    $written = $true
  } catch {
    if ($attempt -ge 5) { throw }
    Start-Sleep -Milliseconds (60 * ($attempt + 1))
  }
}
if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) { throw 'Windows Clipboard bevat geen afbeelding na SetImage.' }
$confirmed = [System.Windows.Forms.Clipboard]::GetImage()
if ($null -eq $confirmed -or $confirmed.Width -ne $bitmap.Width -or $confirmed.Height -ne $bitmap.Height) { throw 'Windows Clipboard bevestigde de afbeelding niet.' }
[Console]::Out.WriteLine((@{ ok = $true; width = $confirmed.Width; height = $confirmed.Height } | ConvertTo-Json -Compress))
$confirmed.Dispose()
$bitmap.Dispose()
$source.Dispose()
$stream.Dispose()`;

function encodedPowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function nativeClipboardCommand(platform, pngBytes) {
  if (platform === 'darwin') {
    return { command: '/usr/bin/osascript', args: ['-l', 'JavaScript', '-e', MACOS_JXA], input: Buffer.from(pngBytes), label: 'macOS NSPasteboard' };
  }
  if (platform === 'win32') {
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedPowerShell(WINDOWS_POWERSHELL)],
      input: Buffer.from(pngBytes).toString('base64'),
      label: 'Windows Forms Clipboard'
    };
  }
  return null;
}

function runProcess(commandSpec, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;
  const timeoutMs = options.timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', settled = false;
    const child = spawnImpl(commandSpec.command, commandSpec.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill?.();
      reject(new Error(`${commandSpec.label} reageerde niet binnen ${timeoutMs} ms.`));
    }, timeoutMs);
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    });
    child.on('close', code => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (code !== 0) reject(new Error(`${commandSpec.label} mislukte${stderr.trim() ? `: ${stderr.trim()}` : ` met code ${code}`}`));
      else resolve({ stdout, stderr });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(commandSpec.input);
  });
}

function parseNativeResult(stdout, expected) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let parsed = null;
  for (let index = lines.length - 1; index >= 0; index--) {
    try { parsed = JSON.parse(lines[index]); break; } catch {}
  }
  if (!parsed?.ok) throw new Error('De native clipboardhelper gaf geen geldige succesbevestiging.');
  const actual = { width: Number(parsed.width), height: Number(parsed.height) };
  if (!dimensionsMatch(expected, actual)) throw new Error('De native clipboardhelper bevestigde andere afbeeldingsafmetingen.');
  return actual;
}

async function writePngNative(pngBytes, platform, options = {}) {
  const expected = pngDimensions(pngBytes);
  const commandSpec = nativeClipboardCommand(platform, pngBytes);
  if (!commandSpec) throw new Error(`Geen native clipboardfallback beschikbaar voor ${platform}.`);
  const result = options.runProcessImpl
    ? await options.runProcessImpl(commandSpec)
    : await runProcess(commandSpec, options);
  const actual = parseNativeResult(result.stdout, expected);
  return { ok: true, width: actual.width, height: actual.height, method: commandSpec.label };
}

module.exports = { MACOS_JXA, WINDOWS_POWERSHELL, nativeClipboardCommand, parseNativeResult, runProcess, writePngNative };
