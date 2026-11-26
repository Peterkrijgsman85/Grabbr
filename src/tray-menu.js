'use strict';

function buildTrayTemplate(platform, actions) {
  if (!['darwin', 'win32', 'linux'].includes(platform)) throw new TypeError('Onbekend platform voor traymenu.');
  return [
    { label: 'Venster vastleggen', click: actions.captureWindow },
    { label: 'Gebied vastleggen', click: actions.captureRegion },
    { label: 'Scherm vastleggen', click: actions.captureScreen },
    { type: 'separator' },
    { label: 'Laatste screenshot openen', click: actions.openLastScreenshot },
    { type: 'separator' },
    { label: 'Grabbr openen', click: actions.openApp },
    { label: 'Afsluiten', click: actions.quit }
  ];
}

module.exports = { buildTrayTemplate };
