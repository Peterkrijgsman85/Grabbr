const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrayTemplate,displayAccelerator } = require('../src/tray-menu.js');

function labels(platform) {
  const noop = () => {};
  return buildTrayTemplate(platform, { captureWindow: noop, captureRegion: noop, captureScreen: noop, captureOcr:noop, openLastScreenshot: noop, openSettings:noop, openApp: noop, quit: noop })
    .filter(item => item.label).map(item => item.label);
}

test('macOS-menubalkmenu bevat Laatste screenshot openen', () => {
  assert.ok(labels('darwin').includes('Laatste screenshot openen'));
});

test('capture-items tonen dynamische platformhotkeys en iconen',()=>{const noop=()=>{},icons={window:'w',region:'r',screen:'s',ocr:'o',settings:'gear',grabbr:'g'};for(const platform of ['darwin','win32']){const menu=buildTrayTemplate(platform,{captureWindow:noop,captureRegion:noop,captureScreen:noop,captureOcr:noop,openLastScreenshot:noop,openSettings:noop,openApp:noop,quit:noop},{shortcuts:{window:'CommandOrControl+Shift+2',region:'CommandOrControl+Shift+3',screen:'CommandOrControl+Shift+4',ocr:'CommandOrControl+Shift+5'},icons});assert.equal(menu[0].icon,'w');assert.equal(menu[3].icon,'o');assert.equal(menu[6].label,'Instellingen');assert.equal(menu[6].icon,'gear');assert.equal(menu[8].icon,'g');assert.equal(menu[0].accelerator,platform==='darwin'?'Command+Shift+2':'Control+Shift+2');assert.equal(menu[3].accelerator,platform==='darwin'?'Command+Shift+5':'Control+Shift+5');assert.equal(menu[0].registerAccelerator,false);}});

test('Windows-traymenu bevat Laatste screenshot openen', () => {
  assert.ok(labels('win32').includes('Laatste screenshot openen'));
});

test('traymenu behoudt alle captureacties op beide platformen', () => {
  for (const platform of ['darwin', 'win32']) {
    assert.deepEqual(labels(platform).slice(0, 5), ['Venster vastleggen', 'Gebied vastleggen', 'Scherm vastleggen', 'OCR-tekst vastleggen', 'Laatste screenshot openen']);
  }
});
