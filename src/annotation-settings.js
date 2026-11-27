'use strict';
const DEFAULT_ANNOTATION_SETTINGS=Object.freeze({afterCopy:'copy'});
function normalizeAnnotationSettings(value){
  if(['copy','close','minimize'].includes(value?.afterCopy))return{afterCopy:value.afterCopy};
  return{afterCopy:value?.closeAfterCopy===true?'close':'copy'};
}
module.exports={DEFAULT_ANNOTATION_SETTINGS,normalizeAnnotationSettings};
