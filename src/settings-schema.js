'use strict';
const { DEFAULTS: DEFAULT_SHORTCUTS, validateSettings } = require('./hotkeys.js');
const { DEFAULT_FILENAME_PATTERN } = require('./filename-pattern.js');

const DEFAULT_SETTINGS=Object.freeze({
  shortcuts:{...DEFAULT_SHORTCUTS},
  general:{startup:false,afterCopy:'copy',hideGrabbrDuringCapture:true},
  capture:{windowShadow:true},
  storage:{autoSave:true,directory:null,filenamePattern:DEFAULT_FILENAME_PATTERN,format:'png',jpegQuality:90},
  editor:{strokeWidth:7,fontSize:28,stepSize:44,annotationShadow:false},
  updates:{automatic:true,lastCheckedAt:null,includePrereleases:false},
  recent:{lastSavedPath:null}
});
const bounded=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.round(Number(v)))):fallback;
function migrateSettings(raw={},defaultDirectory=null){
  const shortcutValidation=validateSettings(raw.shortcuts);const validShortcuts=shortcutValidation.valid?shortcutValidation.settings:{...DEFAULT_SHORTCUTS};
  const legacyAnnotation=raw.annotation||{};
  const legacyStartup=raw.startup||{};
  const legacyStorage=raw.storage||{};
  return {
    shortcuts:validShortcuts,
    general:{
      startup:raw.general?.startup===true||legacyStartup.openAtLogin===true,
      afterCopy:['copy','close','minimize'].includes(raw.general?.afterCopy)?raw.general.afterCopy:((raw.general?.closeAfterCopy===true||legacyAnnotation.closeAfterCopy===true)?'close':'copy'),
      hideGrabbrDuringCapture:raw.general?.hideGrabbrDuringCapture!==false
    },
    capture:{windowShadow:raw.capture?.windowShadow!==false},
    storage:{
      autoSave:legacyStorage.autoSave!==false,
      directory:typeof legacyStorage.directory==='string'&&legacyStorage.directory.trim()?legacyStorage.directory:defaultDirectory,
      filenamePattern:typeof legacyStorage.filenamePattern==='string'&&legacyStorage.filenamePattern.trim()?legacyStorage.filenamePattern:DEFAULT_FILENAME_PATTERN,
      format:legacyStorage.format==='jpeg'?'jpeg':'png',
      jpegQuality:bounded(legacyStorage.jpegQuality,1,100,90)
    },
    editor:{
      strokeWidth:bounded(raw.editor?.strokeWidth,1,200,7),
      fontSize:bounded(raw.editor?.fontSize,1,200,28),
      stepSize:bounded(raw.editor?.stepSize,1,200,44),
      annotationShadow:raw.editor?.annotationShadow===true
    },
    updates:{automatic:raw.updates?.automatic!==false,lastCheckedAt:typeof raw.updates?.lastCheckedAt==='string'?raw.updates.lastCheckedAt:null,includePrereleases:raw.updates?.includePrereleases===true},
    recent:{lastSavedPath:typeof raw.recent?.lastSavedPath==='string'?raw.recent.lastSavedPath:null}
  };
}
module.exports={DEFAULT_SETTINGS,migrateSettings,bounded};
