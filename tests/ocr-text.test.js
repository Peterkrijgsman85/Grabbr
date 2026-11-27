const test=require('node:test');const assert=require('node:assert/strict');const {normalizeOcrText,hasRecognizedText}=require('../src/ocr-text.js');
test('OCR-tekst normaliseert CRLF, tabs, spaties en lege regels',()=>{assert.equal(normalizeOcrText('  Eerste\r\nTweede\t regel\r\n\r\n\r\n Derde  '),'Eerste\nTweede regel\n\nDerde');});
test('lege of uitsluitend whitespace OCR-resultaten zijn leeg',()=>{for(const value of ['',null,' \t\r\n ']){assert.equal(normalizeOcrText(value),'');assert.equal(hasRecognizedText(value),false);}});
test('regelvolgorde en betekenisvolle enkele lege regel blijven behouden',()=>{assert.equal(normalizeOcrText('A\n\nB\nC'),'A\n\nB\nC');});
