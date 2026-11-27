'use strict';

const { execFile } = require('node:child_process');
const path = require('node:path');

function powershellPath(env = process.env) {
  return env.SystemRoot ? path.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe';
}

function notificationCommand(platform, title, message, env = process.env) {
  if (platform === 'darwin') {
    return {
      file: '/usr/bin/osascript',
      args: ['-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', '--', String(title), String(message)],
      label: 'macOS notification'
    };
  }
  if (platform === 'win32') {
    const script = "$title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($args[0]));$body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($args[1]));Add-Type -AssemblyName System.Windows.Forms;$n=New-Object System.Windows.Forms.NotifyIcon;$n.Icon=[System.Drawing.SystemIcons]::Information;$n.BalloonTipTitle=$title;$n.BalloonTipText=$body;$n.Visible=$true;$n.ShowBalloonTip(5000);Start-Sleep -Milliseconds 900;$n.Dispose()";
    return {
      file: powershellPath(env),
      args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script, Buffer.from(String(title)).toString('base64'), Buffer.from(String(message)).toString('base64')],
      label: 'Windows notification'
    };
  }
  return null;
}

function runExecFile(spec, options = {}) {
  const execFileImpl = options.execFileImpl || execFile;
  return new Promise((resolve, reject) => {
    execFileImpl(spec.file, spec.args, { windowsHide: true, timeout: options.timeoutMs || 8000, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${spec.label} mislukte${stderr?.trim() ? `: ${stderr.trim()}` : `: ${error.message}`}`));
      else resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

async function showNativeNotification(platform, title, message, options = {}) {
  const spec = notificationCommand(platform, title, message, options.env);
  if (!spec) throw new Error(`Geen native notificatiehelper beschikbaar voor ${platform}.`);
  await runExecFile(spec, options);
  return { ok: true, method: spec.label };
}

module.exports = { powershellPath, notificationCommand, runExecFile, showNativeNotification };
