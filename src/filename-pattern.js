(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GrabbrFilenamePattern=api;})(typeof self!=='undefined'?self:this,function(){
'use strict';
const DEFAULT_FILENAME_PATTERN = 'Grabbr-{date}-{time}-{type}';
const TOKENS = ['date','time','year','month','day','hour','minute','second','type','counter'];
const pad = value => String(value).padStart(2, '0');

function tokenValues(date, type, counter) {
  return {
    year: String(date.getFullYear()), month: pad(date.getMonth() + 1), day: pad(date.getDate()),
    hour: pad(date.getHours()), minute: pad(date.getMinutes()), second: pad(date.getSeconds()),
    date: `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
    type: String(type || 'Screenshot'), counter: String(counter || 1)
  };
}
function sanitizeFilename(value, fallback='Grabbr-Screenshot') {
  const cleaned=String(value||'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'');
  return (cleaned || fallback).slice(0,180);
}
function renderFilenamePattern(pattern=DEFAULT_FILENAME_PATTERN, context={}) {
  const values=tokenValues(context.date||new Date(), context.type, context.counter);
  const rendered=String(pattern||DEFAULT_FILENAME_PATTERN).replace(/\{([a-z]+)\}/gi,(match,key)=> key.toLowerCase() in values ? values[key.toLowerCase()] : match);
  return sanitizeFilename(rendered);
}
function extensionForFormat(format) { return format === 'jpeg' ? '.jpg' : '.png'; }
function filenameFromPattern(pattern, context={}) { return `${renderFilenamePattern(pattern,context)}${extensionForFormat(context.format)}`; }
function filenameForAttempt(pattern,context={},attempt=1){
  const base=filenameFromPattern(pattern,{...context,counter:attempt});
  if(attempt<=1||String(pattern).includes('{counter}'))return base;
  const ext=extensionForFormat(context.format);return `${base.slice(0,-ext.length)}-${attempt}${ext}`;
}
return {DEFAULT_FILENAME_PATTERN,TOKENS,sanitizeFilename,renderFilenamePattern,extensionForFormat,filenameFromPattern,filenameForAttempt};
});
