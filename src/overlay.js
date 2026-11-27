(() => {
  'use strict';

  const canvas = document.querySelector('#overlayCanvas');
  const ctx = canvas.getContext('2d');
  const hint = document.querySelector('#hint');
  const measurement = document.querySelector('#measurement');
  let background = null;
  let start = null;
  let current = null;
  let dragging = false;
  let ratio = window.devicePixelRatio || 1;

  function normalize(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
  }

  function point(event) { return { x: event.clientX, y: event.clientY }; }

  function resize() {
    ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    draw();
  }

  function draw() {
    if (!background) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.drawImage(background, 0, 0, innerWidth, innerHeight);
    ctx.fillStyle = 'rgba(3, 5, 9, .58)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (!start || !current) return;
    const rect = normalize(start, current);
    if (!rect.width || !rect.height) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.drawImage(background, 0, 0, innerWidth, innerHeight);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(rect.x + .5, rect.y + .5, rect.width - 1, rect.height - 1);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#765cff';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 2, rect.y + 2, Math.max(0, rect.width - 4), Math.max(0, rect.height - 4));
    const size = 7;
    ctx.fillStyle = '#fff';
    [[rect.x,rect.y],[rect.x+rect.width,rect.y],[rect.x,rect.y+rect.height],[rect.x+rect.width,rect.y+rect.height]].forEach(([x,y]) => {
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.strokeStyle = '#765cff'; ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    });
    ctx.restore();
    measurement.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
    measurement.classList.remove('hidden');
    const left = Math.min(innerWidth - 135, Math.max(8, rect.x));
    const top = rect.y > 44 ? rect.y - 36 : Math.min(innerHeight - 34, rect.y + rect.height + 9);
    measurement.style.left = `${left}px`;
    measurement.style.top = `${top}px`;
  }

  function finish() {
    if (!start || !current) return cancelSelection();
    const rect = normalize(start, current);
    if (rect.width < 4 || rect.height < 4) return cancelSelection();
    const output = document.createElement('canvas');
    const sourceScaleX = background.naturalWidth / innerWidth;
    const sourceScaleY = background.naturalHeight / innerHeight;
    output.width = Math.max(1, Math.round(rect.width * sourceScaleX));
    output.height = Math.max(1, Math.round(rect.height * sourceScaleY));
    const out = output.getContext('2d');
    out.drawImage(background,
      rect.x * sourceScaleX, rect.y * sourceScaleY, rect.width * sourceScaleX, rect.height * sourceScaleY,
      0, 0, output.width, output.height);
    window.grabbrOverlay.complete({dataUrl:output.toDataURL('image/png'),coordinateSpace:{bitmapWidth:output.width,bitmapHeight:output.height,logicalWidth:rect.width,logicalHeight:rect.height}});
  }

  function cancelSelection() {
    start = null; current = null; dragging = false;
    measurement.classList.add('hidden');
    hint.classList.remove('hidden');
    draw();
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    start = current = point(event);
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
    hint.classList.add('hidden');
    draw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    current = point(event);
    draw();
  });
  canvas.addEventListener('pointerup', event => {
    if (!dragging) return;
    current = point(event);
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    finish();
  });
  canvas.addEventListener('contextmenu', event => { event.preventDefault(); window.grabbrOverlay.cancel(); });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.grabbrOverlay.cancel();
    if (event.key === 'Enter' && start && current) finish();
  });
  window.addEventListener('resize', resize);

  window.grabbrOverlay.onInitialize(payload => {
    const image = new Image();
    image.onload = () => { background = image; resize(); };
    image.src = payload.image;
  });
})();
