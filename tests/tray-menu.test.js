const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrayTemplate,displayAccelerator } = require('../src/tray-menu.js');

function labels(platform) {
  const noop = () => {};
  return buildTrayTemplate(platform, { captureWindow: noop, captureRegion: noop, captureScreen: noop, openLastScreenshot: noop, openSettings:noop, openApp: noop, quit: noop })
    .filter(item => item.label).map(item => item.label);
}

test('macOS-menubalkmenu bevat Laatste screenshot openen', () => {
  assert.ok(labels('darwin').includes('Laatste screenshot openen'));
});

test('capture-items tonen dynamische platformhotkeys en iconen',()=>{const noop=()=>{},icons={window:'w',region:'r',screen:'s',settings:'gear',grabbr:'g'};for(const platform of ['darwin','win32']){const menu=buildTrayTemplate(platform,{captureWindow:noop,captureRegion:noop,captureScreen:noop,openLastScreenshot:noop,openSettings:noop,openApp:noop,quit:noop},{shortcuts:{window:'CommandOrControl+Shift+2',region:'CommandOrControl+Shift+3',screen:'CommandOrControl+Shift+4'},icons});assert.equal(menu[0].icon,'w');assert.equal(menu[5].label,'Instellingen');assert.equal(menu[5].icon,'gear');assert.equal(menu[7].icon,'g');assert.equal(menu[0].accelerator,platform==='darwin'?'Command+Shift+2':'Control+Shift+2');assert.equal(menu[0].registerAccelerator,false);}});

test('Windows-traymenu bevat Laatste screenshot openen', () => {
  assert.ok(labels('win32').includes('Laatste screenshot openen'));
});

test('traymenu behoudt alle captureacties op beide platformen', () => {
  for (const platform of ['darwin', 'win32']) {
    assert.deepEqual(labels(platform).slice(0, 4), ['Venster vastleggen', 'Gebied vastleggen', 'Scherm vastleggen', 'Laatste screenshot openen']);
  }
});
