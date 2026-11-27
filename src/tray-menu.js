'use strict';
function displayAccelerator(platform, accelerator='') {
  if(platform==='darwin') return accelerator.replace('CommandOrControl','Command');
  return accelerator.replace('CommandOrControl','Control').replace('Command','Control');
}
function buildTrayTemplate(platform, actions, options={}) {
  if (!['darwin','win32','linux'].includes(platform)) throw new TypeError('Onbekend platform voor traymenu.');
  const shortcuts=options.shortcuts||{},icons=options.icons||{};
  const capture=(label,click,key,icon)=>({label,click,icon,accelerator:displayAccelerator(platform,shortcuts[key]),registerAccelerator:false});
  return [
    capture('Venster vastleggen',actions.captureWindow,'window',icons.window),
    capture('Gebied vastleggen',actions.captureRegion,'region',icons.region),
    capture('Scherm vastleggen',actions.captureScreen,'screen',icons.screen),
    capture('OCR-tekst vastleggen',actions.captureOcr,'ocr',icons.ocr),
    {type:'separator'},
    {label:'Laatste screenshot openen',click:actions.openLastScreenshot},
    {label:'Instellingen',click:actions.openSettings,icon:icons.settings},
    {type:'separator'},
    {label:'Grabbr openen',click:actions.openApp,icon:icons.grabbr},
    {label:'Afsluiten',click:actions.quit}
  ];
}
module.exports={buildTrayTemplate,displayAccelerator};
