'use strict';

const { runProcess } = require('./native-clipboard.js');
const { normalizeOcrText } = require('./ocr-text.js');

const WINDOWS_TEXT_CLIPBOARD = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$encoded = [Console]::In.ReadToEnd().Trim()
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
if ([string]::IsNullOrWhiteSpace($text)) { throw 'Geen tekst ontvangen.' }
$written = $false
for ($attempt = 0; $attempt -lt 6 -and -not $written; $attempt++) {
  try { [System.Windows.Forms.Clipboard]::SetText($text); $written = $true }
  catch { if ($attempt -ge 5) { throw }; Start-Sleep -Milliseconds (60 * ($attempt + 1)) }
}
$confirmed = [System.Windows.Forms.Clipboard]::GetText()
if ($confirmed -ne $text) { throw 'Windows Clipboard bevestigde de tekst niet.' }
[Console]::Out.WriteLine((@{ ok = $true; textBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($confirmed)) } | ConvertTo-Json -Compress))`;

function encodedPowerShell(script) { return Buffer.from(script, 'utf16le').toString('base64'); }

function nativeTextCommands(platform, text) {
  if (platform === 'darwin') {
    return {
      write: { command: '/usr/bin/pbcopy', args: [], input: text, label: 'macOS pbcopy' },
      read: { command: '/usr/bin/pbpaste', args: [], input: '', label: 'macOS pbpaste' }
    };
  }
  if (platform === 'win32') {
    return {
      write: {
        command: 'powershell.exe',
        args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedPowerShell(WINDOWS_TEXT_CLIPBOARD)],
        input: Buffer.from(text, 'utf8').toString('base64'),
        label: 'Windows Forms text clipboard'
      },
      read: null
    };
  }
  return null;
}

function parseWindowsTextResult(stdout, expected) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let parsed = null;
  for (let index = lines.length - 1; index >= 0; index--) { try { parsed = JSON.parse(lines[index]); break; } catch {} }
  if (!parsed?.ok || typeof parsed.textBase64 !== 'string') throw new Error('Windows Clipboard gaf geen geldige bevestiging.');
  const confirmed = Buffer.from(parsed.textBase64, 'base64').toString('utf8');
  if (confirmed !== expected) throw new Error('Windows Clipboard bevestigde andere tekst.');
}

async function writeTextNative(text, platform, options = {}) {
  const commands = nativeTextCommands(platform, text);
  if (!commands) throw new Error(`Geen native tekstclipboard beschikbaar voor ${platform}.`);
  const runner = options.runProcessImpl || (spec => runProcess(spec, { timeoutMs: options.timeoutMs || 15000, spawnImpl: options.spawnImpl }));
  const written = await runner(commands.write);
  if (platform === 'darwin') {
    const read = await runner(commands.read);
    if (read.stdout !== text) throw new Error('macOS NSPasteboard bevestigde andere tekst.');
  } else {
    parseWindowsTextResult(written.stdout, text);
  }
  return { ok: true, method: commands.write.label };
}

async function writeTextToSystemClipboard(value, dependencies = {}) {
  const text = normalizeOcrText(value);
  if (!text) return { ok: false, error: 'Er is geen herkende tekst om te kopiëren.' };
  const electronClipboard = dependencies.electronClipboard;
  const failures = [];
  if (electronClipboard && typeof electronClipboard.writeText === 'function' && typeof electronClipboard.readText === 'function') {
    try {
      electronClipboard.writeText(text);
      if (electronClipboard.readText() !== text) throw new Error('Electron Clipboard bevestigde andere tekst.');
      return { ok: true, text, method: 'Electron main clipboard.writeText' };
    } catch (error) { failures.push(`Electron-route: ${error.message}`); }
  } else failures.push('Electron-route: writeText/readText niet beschikbaar');

  try {
    const nativeWriter = dependencies.nativeWriter || writeTextNative;
    const result = await nativeWriter(text, dependencies.platform || process.platform, dependencies.nativeOptions || {});
    if (!result?.ok) throw new Error('Native helper bevestigde de tekst niet.');
    return { ok: true, text, method: result.method || 'native text clipboard' };
  } catch (error) { failures.push(`Native route: ${error.message}`); }

  return { ok: false, error: `Tekst kopiëren mislukt. ${failures.join(' | ')}` };
}

module.exports = { WINDOWS_TEXT_CLIPBOARD, nativeTextCommands, parseWindowsTextResult, writeTextNative, writeTextToSystemClipboard };
