const test=require('node:test');const assert=require('node:assert/strict');const {renderFilenamePattern,filenameFromPattern,filenameForAttempt,sanitizeFilename}=require('../src/filename-pattern.js');
const date=new Date(2026,10,27,9,8,7);
test('alle vereiste tokens renderen',()=>{assert.equal(renderFilenamePattern('{year}-{month}-{day}_{hour}-{minute}-{second}_{date}_{time}_{type}_{counter}',{date,type:'Venster',counter:3}),'2026-11-27_09-08-07_2026-11-27_09-08-07_Venster_3');});
test('ongeldige tekens worden veilig',()=>assert.equal(sanitizeFilename('CRM: klant/naam?'),'CRM- klant-naam-'));
test('extensie volgt uitvoerformaat',()=>{assert.match(filenameFromPattern('Grabbr-{counter}',{date,type:'x',counter:1,format:'png'}),/\.png$/);assert.match(filenameFromPattern('Grabbr-{counter}',{date,type:'x',counter:1,format:'jpeg'}),/\.jpg$/);});
test('botsingen gebruiken countertoken of -2/-3 zonder overschrijven',()=>{assert.equal(filenameForAttempt('Grabbr-{type}',{date,type:'Venster',format:'png'},2),'Grabbr-Venster-2.png');assert.equal(filenameForAttempt('Grabbr-{type}-{counter}',{date,type:'Venster',format:'png'},3),'Grabbr-Venster-3.png');});
