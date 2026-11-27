const test = require('node:test');
const assert = require('node:assert/strict');
const { obscureRenderPlan } = require('../src/obscure-render.js');

test('blurplan rekent canvas/marge terug naar originele screenshotpixels', () => {
  const plan = obscureRenderPlan('blur', { x: 170, y: 120, width: 240, height: 100 }, 70, { width: 1200, height: 800 });
  assert.deepEqual(plan.source, { x: 100, y: 50, width: 240, height: 100 });
  assert.deepEqual(plan.destination, { x: 170, y: 120, width: 240, height: 100 });
  assert.ok(plan.expandedSource.x < plan.source.x);
  assert.ok(plan.expandedSource.width > plan.source.width);
});

test('resize maakt een volledig nieuw blurplan vanuit de gewijzigde bronregio', () => {
  const before = obscureRenderPlan('blur', { x: 170, y: 120, width: 120, height: 80 }, 70, { width: 1200, height: 800 });
  const after = obscureRenderPlan('blur', { x: 130, y: 95, width: 330, height: 210 }, 70, { width: 1200, height: 800 });
  assert.notDeepEqual(after.source, before.source);
  assert.deepEqual(after.source, { x: 60, y: 25, width: 330, height: 210 });
  assert.equal(after.cropInExpanded.width, 330);
  assert.equal(after.cropInExpanded.height, 210);
});

test('pixelateplan samplet opnieuw op basis van de huidige resized regio', () => {
  const small = obscureRenderPlan('pixelate', { x: 80, y: 90, width: 60, height: 48 }, 20, { width: 500, height: 400 });
  const large = obscureRenderPlan('pixelate', { x: 80, y: 90, width: 240, height: 192 }, 20, { width: 500, height: 400 });
  assert.deepEqual(small.source, { x: 60, y: 70, width: 60, height: 48 });
  assert.deepEqual(large.source, { x: 60, y: 70, width: 240, height: 192 });
  assert.notDeepEqual(small.sampleSize, large.sampleSize);
});

test('obscureplan clipt verplaatste regio veilig aan screenshotgrenzen', () => {
  const plan = obscureRenderPlan('pixelate', { x: 40, y: 50, width: 160, height: 120 }, 70, { width: 500, height: 400 });
  assert.deepEqual(plan.source, { x: 0, y: 0, width: 130, height: 100 });
  assert.deepEqual(plan.destination, { x: 70, y: 70, width: 130, height: 100 });
});
