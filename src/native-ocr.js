'use strict';

const { runProcess } = require('./native-clipboard.js');
const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizePngBytes } = require('./clipboard-payload.js');
const { normalizeOcrText } = require('./ocr-text.js');

const MACOS_VISION_JXA = String.raw`
ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('Vision');
function run() {
  var data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  if (!data || Number(data.length) < 24) throw new Error('Geen geldige afbeeldingsdata ontvangen.');
  var request = $.VNRecognizeTextRequest.alloc.init;
  request.setRecognitionLevel($.VNRequestTextRecognitionLevelAccurate);
  request.setUsesLanguageCorrection = true;
  var handler = $.VNImageRequestHandler.alloc.initWithDataOptions(data, $({}));
  var success = handler.performRequestsError($([request]), null);
  if (!success) throw new Error('Vision OCR kon de afbeelding niet verwerken.');
  var observations = request.results.js || [];
  var lines = observations.map(function(observation) {
    var candidates = observation.topCandidates(1);
    if (Number(candidates.count) < 1) return '';
    return candidates.objectAtIndex(0).string.js;
  }).filter(function(line) { return line && line.trim().length > 0; });
  var textData = $(lines.join('\n')).dataUsingEncoding($.NSUTF8StringEncoding);
  var encoded = textData.base64EncodedStringWithOptions(0);
  return JSON.stringify({ ok: true, textBase64: ObjC.unwrap(encoded) });
}`;

const WINDOWS_OCR_POWERSHELL = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
function Await($operation, [Type]$resultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
  $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}
$encoded = [Console]::In.ReadToEnd().Trim()
if ([string]::IsNullOrWhiteSpace($encoded)) { throw 'Geen afbeeldingsdata ontvangen.' }
$bytes = [Convert]::FromBase64String($encoded)
$temp = [IO.Path]::Combine([IO.Path]::GetTempPath(), ('grabbr-ocr-' + [Guid]::NewGuid().ToString('N') + '.png'))
try {
  [IO.File]::WriteAllBytes($temp, $bytes)
  $storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($temp)) ([Windows.Storage.StorageFile])
  $stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($null -eq $engine) { throw 'Windows OCR kon geen lokale taalengine maken.' }
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $textBytes = [Text.Encoding]::UTF8.GetBytes([string]$result.Text)
  [Console]::Out.WriteLine((@{ ok = $true; textBase64 = [Convert]::ToBase64String($textBytes) } | ConvertTo-Json -Compress))
  $bitmap.Dispose(); $stream.Dispose()
} finally {
  Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}`;

function encodedPowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function helperExecutable(platform, env = process.env) {
  if (platform === 'darwin') return '/usr/bin/osascript';
  if (platform === 'win32') return env.SystemRoot ? path.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe';
  return null;
}

async function assertHelperAvailable(platform, options = {}) {
  const executable = helperExecutable(platform, options.env);
  if (!executable) throw new Error(`Geen lokale OCR-helper voor ${platform}.`);
  if (path.isAbsolute(executable)) {
    const fsApi = options.fsApi || fs;
    try { await fsApi.access(executable); }
    catch { throw new Error(`OCR-helper ontbreekt of is niet toegankelijk: ${executable}`); }
  }
  options.log?.('helper-preflight', { platform, method: executable });
  return executable;
}

function ocrCommand(platform, pngBytes) {
  const bytes = normalizePngBytes(pngBytes);
  if (platform === 'darwin') {
    return { command: helperExecutable('darwin'), args: ['-l', 'JavaScript', '-e', MACOS_VISION_JXA], input: bytes, label: 'macOS Vision OCR' };
  }
  if (platform === 'win32') {
    return {
      command: helperExecutable('win32'),
      args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedPowerShell(WINDOWS_OCR_POWERSHELL)],
      input: bytes.toString('base64'),
      label: 'Windows OCR'
    };
  }
  return null;
}

function parseOcrResult(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let parsed = null;
  for (let index = lines.length - 1; index >= 0; index--) {
    try { parsed = JSON.parse(lines[index]); break; } catch {}
  }
  if (!parsed?.ok || typeof parsed.textBase64 !== 'string') throw new Error('De lokale OCR-helper gaf geen geldig resultaat terug.');
  return normalizeOcrText(Buffer.from(parsed.textBase64, 'base64').toString('utf8'));
}

async function recognizeTextFromPng(pngBytes, platform, options = {}) {
  await assertHelperAvailable(platform, options);
  const command = ocrCommand(platform, pngBytes);
  if (!command) throw new Error(`Lokale OCR wordt niet ondersteund op ${platform}.`);
  options.log?.('helper-spawn', { platform, method: command.command, bytes: Buffer.byteLength(command.input) });
  const result = options.runProcessImpl ? await options.runProcessImpl(command) : await runProcess(command, { timeoutMs: options.timeoutMs || 45000, spawnImpl: options.spawnImpl });
  const text = parseOcrResult(result.stdout);
  options.log?.('helper-complete', { platform, method: command.label, ok: true });
  return { text, method: command.label };
}

module.exports = { MACOS_VISION_JXA, WINDOWS_OCR_POWERSHELL, helperExecutable, assertHelperAvailable, ocrCommand, parseOcrResult, recognizeTextFromPng };
