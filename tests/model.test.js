const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRect, annotationBounds, hitTest, mapClientToDocument, resizeHandles, hitResizeHandle, resizeAnnotation, supportsStrokeWidth, supportsFontSize, duplicateAnnotation, translateAnnotation, History } = require('../src/model.js');

test('normalizeRect normaliseert een omgekeerde selectie', () => {
  assert.deepEqual(normalizeRect({ x: 20, y: 30 }, { x: 5, y: 10 }), { x: 5, y: 10, width: 15, height: 20 });
});

test('pen bounds en hit-test zijn correct', () => {
  const pen = { type: 'pen', points: [{ x: 2, y: 4 }, { x: 18, y: 12 }] };
  assert.deepEqual(annotationBounds(pen), { x: 2, y: 4, width: 16, height: 8 });
  assert.equal(hitTest(pen, { x: 10, y: 8 }), true);
});

test('translateAnnotation verplaatst zonder origineel te muteren', () => {
  const rect = { type: 'rect', x1: 1, y1: 2, x2: 6, y2: 9 };
  const moved = translateAnnotation(rect, 10, -2);
  assert.deepEqual(moved, { type: 'rect', x1: 11, y1: 0, x2: 16, y2: 7 });
  assert.equal(rect.x1, 1);
});

test('history kapt redo af na nieuwe wijziging', () => {
  const h = new History();
  h.push({ n: 1 }); h.push({ n: 2 }); h.push({ n: 3 });
  assert.deepEqual(h.undo(), { n: 2 });
  h.push({ n: 4 });
  assert.equal(h.canRedo(), false);
  assert.deepEqual(h.undo(), { n: 2 });
});

test('rechthoeken krijgen acht resize-handles en kunnen per zijde schalen', () => {
  const rect = { type: 'rect', x1: 10, y1: 20, x2: 110, y2: 80 };
  assert.equal(resizeHandles(rect).length, 8);
  assert.equal(hitResizeHandle(rect, { x: 110, y: 50 }).id, 'e');
  assert.deepEqual(resizeAnnotation(rect, 'se', { x: 150, y: 120 }), { type: 'rect', x1: 10, y1: 20, x2: 150, y2: 120 });
});

test('blur en pixelate krijgen acht duidelijke resize-handles', () => {
  for (const type of ['blur', 'pixelate']) {
    const item = { type, x1: 20, y1: 30, x2: 220, y2: 130 };
    assert.deepEqual(resizeHandles(item).map(handle => handle.id), ['nw','n','ne','e','se','s','sw','w']);
  }
});

test('blur/pixelate kunnen vanuit alle hoeken en zijden worden geresized', () => {
  const expected = {
    nw: { x1: 5, y1: 8, x2: 200, y2: 120 },
    n:  { x1: 20, y1: 8, x2: 200, y2: 120 },
    ne: { x1: 20, y1: 8, x2: 240, y2: 120 },
    e:  { x1: 20, y1: 30, x2: 240, y2: 120 },
    se: { x1: 20, y1: 30, x2: 240, y2: 160 },
    s:  { x1: 20, y1: 30, x2: 200, y2: 160 },
    sw: { x1: 5, y1: 30, x2: 200, y2: 160 },
    w:  { x1: 5, y1: 30, x2: 200, y2: 120 }
  };
  const points = { nw:{x:5,y:8},n:{x:100,y:8},ne:{x:240,y:8},e:{x:240,y:70},se:{x:240,y:160},s:{x:100,y:160},sw:{x:5,y:160},w:{x:5,y:70} };
  for (const type of ['blur','pixelate']) {
    for (const handle of Object.keys(points)) {
      const resized = resizeAnnotation({ type, x1:20,y1:30,x2:200,y2:120 }, handle, points[handle]);
      assert.deepEqual(resized, { type, ...expected[handle] }, `${type}:${handle}`);
    }
  }
});

test('blur/pixelate verplaatsen beide hoeken zonder hun afmetingen te wijzigen', () => {
  for (const type of ['blur','pixelate']) {
    const moved = translateAnnotation({ type, x1:20,y1:30,x2:200,y2:120 }, 35, -12);
    assert.deepEqual(moved, { type, x1:55,y1:18,x2:235,y2:108 });
    assert.deepEqual(annotationBounds(moved), { x:55,y:18,width:180,height:90 });
  }
});

test('blur/pixelate handles blijven raakbaar met Retina/DPI-geschaalde documentcoördinaten', () => {
  const item = { type:'blur', x1:100,y1:80,x2:300,y2:220 };
  const documentPoint = mapClientToDocument({ x:225, y:180 }, { left:25,top:20,width:400,height:280 }, { width:800,height:560 }, 100);
  assert.deepEqual(documentPoint, { x:300,y:220 });
  assert.equal(hitResizeHandle(item, documentPoint, 14).id, 'se');
});

test('pijluiteinden zijn onafhankelijk resizebaar', () => {
  const arrow = { type: 'arrow', x1: 5, y1: 6, x2: 50, y2: 60 };
  const resized = resizeAnnotation(arrow, 'end', { x: 90, y: 100 });
  assert.equal(resized.x1, 5);
  assert.equal(resized.y1, 6);
  assert.equal(resized.x2, 90);
  assert.equal(resized.y2, 100);
});

test('lijnannotaties hebben twee onafhankelijke eindpunthandles', () => {
  const line = { type: 'line', x1: 12, y1: 18, x2: 180, y2: 96, width: 7 };
  assert.deepEqual(resizeHandles(line).map(handle => handle.id), ['start', 'end']);
  const resized = resizeAnnotation(line, 'start', { x: 30, y: 42 });
  assert.deepEqual({ x1: resized.x1, y1: resized.y1, x2: resized.x2, y2: resized.y2 }, { x1: 30, y1: 42, x2: 180, y2: 96 });
  assert.equal(hitTest(resized, { x: 105, y: 69 }, 3), true);
});

test('clientcoördinaten blijven correct bij zoom en Retina/DPI scaling', () => {
  const point = mapClientToDocument({ x: 350, y: 225 }, { left: 100, top: 50, width: 500, height: 250 }, { width: 2000, height: 1000 }, 70);
  assert.deepEqual(point, { x: 930, y: 630 });
});

test('propertyondersteuning geldt voor strokes en alleen tekst voor fontgrootte', () => {
  for (const type of ['arrow','line','rect','ellipse','pen']) assert.equal(supportsStrokeWidth({ type }), true);
  assert.equal(supportsStrokeWidth({ type: 'text' }), false);
  assert.equal(supportsFontSize({ type: 'text' }), true);
  assert.equal(supportsFontSize({ type: 'step' }), false);
});

test('annotatie plakken behoudt eigenschappen en voegt een offset toe', () => {
  const original = { id: 'a', type: 'line', x1: 10, y1: 20, x2: 50, y2: 60, width: 11, color: '#123456' };
  const pasted = duplicateAnnotation(original, 16, 16, 'b');
  assert.deepEqual(pasted, { id: 'b', type: 'line', x1: 26, y1: 36, x2: 66, y2: 76, width: 11, color: '#123456' });
});

test('stapnummer schaalt badge en font proportioneel', () => {
  const step = { type: 'step', x: 50, y: 50, radius: 16, fontSize: 18, number: 1 };
  const resized = resizeAnnotation(step, 'se', { x: 92, y: 92 });
  assert.ok(resized.radius > 41 && resized.radius < 43);
  assert.equal(resized.fontSize, resized.radius * 1.15);
});

test('history ondersteunt toevoegen, verwijderen, verplaatsen, resizen, properties en plakken', () => {
  const h = new History(20);
  const states = [
    { annotations: [] },
    { annotations: [{ id:'a', type:'line', x1:0,y1:0,x2:10,y2:10,width:3 }] },
    { annotations: [] },
    { annotations: [{ id:'a', type:'line', x1:5,y1:5,x2:15,y2:15,width:3 }] },
    { annotations: [{ id:'a', type:'line', x1:5,y1:5,x2:30,y2:30,width:3 }] },
    { annotations: [{ id:'a', type:'line', x1:5,y1:5,x2:30,y2:30,width:9 }] },
    { annotations: [{ id:'a', type:'line', x1:5,y1:5,x2:30,y2:30,width:9 },{ id:'b', type:'line', x1:21,y1:21,x2:46,y2:46,width:9 }] }
  ];
  states.forEach(state => h.push(state));
  for (let i=states.length-2;i>=0;i--) assert.deepEqual(h.undo(), states[i]);
  for (let i=1;i<states.length;i++) assert.deepEqual(h.redo(), states[i]);
});

test('blur move en resize zijn volledig undo/redo-baar', () => {
  const h = new History();
  const initial = { annotations:[{ id:'blur-1',type:'blur',x1:20,y1:30,x2:120,y2:90 }] };
  const moved = { annotations:[{ id:'blur-1',type:'blur',x1:50,y1:55,x2:150,y2:115 }] };
  const resized = { annotations:[{ id:'blur-1',type:'blur',x1:10,y1:15,x2:210,y2:160 }] };
  h.push(initial); h.push(moved); h.push(resized);
  assert.deepEqual(h.undo(), moved);
  assert.deepEqual(h.undo(), initial);
  assert.deepEqual(h.redo(), moved);
  assert.deepEqual(h.redo(), resized);
});
