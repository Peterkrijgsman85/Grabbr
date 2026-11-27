(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrabbrModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeRect(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
  }

  function rectContains(rect, point, padding = 0) {
    return point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding;
  }

  function annotationBounds(item) {
    if (!item) return { x: 0, y: 0, width: 0, height: 0 };
    if (item.type === 'pen') {
      const xs = item.points.map(p => p.x), ys = item.points.map(p => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    if (item.type === 'text') {
      const lines=String(item.text||'').split('\n');
      return { x: item.x, y: item.y - item.fontSize, width: item.width || Math.max(...lines.map(line=>line.length))*item.fontSize*0.62, height: item.fontSize * (1.2*lines.length+.15) };
    }
    if (item.type === 'step') {
      const r = item.radius || 16;
      return { x: item.x - r, y: item.y - r, width: r * 2, height: r * 2 };
    }
    return normalizeRect({ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 });
  }

  function hitTest(item, point, padding = 8) {
    if (item?.type === 'arrow' || item?.type === 'line') {
      const vx = item.x2 - item.x1, vy = item.y2 - item.y1;
      const lengthSquared = vx * vx + vy * vy;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - item.x1) * vx + (point.y - item.y1) * vy) / lengthSquared)) : 0;
      const px = item.x1 + t * vx, py = item.y1 + t * vy;
      return Math.hypot(point.x - px, point.y - py) <= padding + (item.width || 5) / 2;
    }
    if (item?.type === 'step') return Math.hypot(point.x - item.x, point.y - item.y) <= (item.radius || 16) + padding;
    return rectContains(annotationBounds(item), point, padding);
  }

  function mapClientToDocument(client, rect, canvasSize, margin = 0) {
    const scaleX = rect.width > 0 ? canvasSize.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvasSize.height / rect.height : 1;
    return {
      x: (client.x - rect.left) * scaleX - margin,
      y: (client.y - rect.top) * scaleY - margin
    };
  }

  function resizeHandles(item) {
    if (!item || !['arrow', 'line', 'rect', 'ellipse', 'blur', 'pixelate', 'text', 'step'].includes(item.type)) return [];
    if (item.type === 'arrow' || item.type === 'line') {
      return [
        { id: 'start', x: item.x1, y: item.y1, cursor: 'move' },
        { id: 'end', x: item.x2, y: item.y2, cursor: 'move' }
      ];
    }
    const b = annotationBounds(item);
    if (item.type === 'step' || item.type === 'text') {
      return [
        { id: 'nw', x: b.x, y: b.y, cursor: 'nwse-resize' },
        { id: 'ne', x: b.x + b.width, y: b.y, cursor: 'nesw-resize' },
        { id: 'se', x: b.x + b.width, y: b.y + b.height, cursor: 'nwse-resize' },
        { id: 'sw', x: b.x, y: b.y + b.height, cursor: 'nesw-resize' }
      ];
    }
    return [
      { id: 'nw', x: b.x, y: b.y, cursor: 'nwse-resize' },
      { id: 'n', x: b.x + b.width / 2, y: b.y, cursor: 'ns-resize' },
      { id: 'ne', x: b.x + b.width, y: b.y, cursor: 'nesw-resize' },
      { id: 'e', x: b.x + b.width, y: b.y + b.height / 2, cursor: 'ew-resize' },
      { id: 'se', x: b.x + b.width, y: b.y + b.height, cursor: 'nwse-resize' },
      { id: 's', x: b.x + b.width / 2, y: b.y + b.height, cursor: 'ns-resize' },
      { id: 'sw', x: b.x, y: b.y + b.height, cursor: 'nesw-resize' },
      { id: 'w', x: b.x, y: b.y + b.height / 2, cursor: 'ew-resize' }
    ];
  }

  function hitResizeHandle(item, point, radius = 10) {
    return resizeHandles(item).find(handle => Math.hypot(point.x - handle.x, point.y - handle.y) <= radius) || null;
  }

  function resizeAnnotation(item, handleId, point, minimum = 8) {
    const resized = deepClone(item);
    if (resized.type === 'arrow' || resized.type === 'line') {
      if (handleId === 'start') { resized.x1 = point.x; resized.y1 = point.y; }
      if (handleId === 'end') { resized.x2 = point.x; resized.y2 = point.y; }
      return resized;
    }
    if (resized.type === 'step') {
      const distance = Math.hypot(point.x - resized.x, point.y - resized.y);
      resized.radius = Math.max(minimum, distance / Math.SQRT2);
      resized.fontSize = Math.max(10, resized.radius * 1.15);
      return resized;
    }
    if (resized.type === 'text') {
      const b = annotationBounds(resized);
      const opposite = {
        nw:{x:b.x+b.width,y:b.y+b.height}, ne:{x:b.x,y:b.y+b.height},
        se:{x:b.x,y:b.y}, sw:{x:b.x+b.width,y:b.y}
      }[handleId];
      if (!opposite) return resized;
      const originalDistance=Math.max(1,Math.hypot(b.width,b.height));
      const newDistance=Math.max(minimum,Math.hypot(point.x-opposite.x,point.y-opposite.y));
      const scale=newDistance/originalDistance;
      resized.fontSize=Math.max(1,Math.min(200,resized.fontSize*scale));
      resized.width=0;
      if (handleId==='nw'||handleId==='sw') resized.x=opposite.x-(b.width*scale);
      else resized.x=opposite.x;
      if (handleId==='nw'||handleId==='ne') resized.y=opposite.y-(b.height*scale)+resized.fontSize;
      else resized.y=opposite.y+resized.fontSize;
      return resized;
    }
    const b = annotationBounds(resized);
    let left = b.x, right = b.x + b.width, top = b.y, bottom = b.y + b.height;
    if (handleId.includes('w')) left = Math.min(point.x, right - minimum);
    if (handleId.includes('e')) right = Math.max(point.x, left + minimum);
    if (handleId.includes('n')) top = Math.min(point.y, bottom - minimum);
    if (handleId.includes('s')) bottom = Math.max(point.y, top + minimum);
    resized.x1 = left; resized.y1 = top; resized.x2 = right; resized.y2 = bottom;
    return resized;
  }

  function translateAnnotation(item, dx, dy) {
    const moved = JSON.parse(JSON.stringify(item));
    if (moved.type === 'pen') moved.points = moved.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    else if (moved.type === 'text' || moved.type === 'step') { moved.x += dx; moved.y += dy; }
    else { moved.x1 += dx; moved.y1 += dy; moved.x2 += dx; moved.y2 += dy; }
    return moved;
  }

  function supportsStrokeWidth(item) {
    return Boolean(item && ['arrow', 'line', 'rect', 'ellipse', 'pen'].includes(item.type));
  }

  function supportsFontSize(item) {
    return item?.type === 'text';
  }

  function supportsAnnotationShadow(item) {
    return Boolean(item && ['arrow','line','rect','ellipse','text','step'].includes(item.type));
  }

  function duplicateAnnotation(item, dx = 16, dy = 16, id = null) {
    if (!item) return null;
    const duplicate = translateAnnotation(item, dx, dy);
    duplicate.id = id || `${item.id || 'annotation'}-copy`;
    return duplicate;
  }

  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }

  class History {
    constructor(limit = 60) { this.limit = limit; this.items = []; this.index = -1; }
    push(state) {
      const next = deepClone(state);
      if (this.index >= 0 && JSON.stringify(this.items[this.index]) === JSON.stringify(next)) return false;
      this.items = this.items.slice(0, this.index + 1);
      this.items.push(next);
      if (this.items.length > this.limit) this.items.shift();
      this.index = this.items.length - 1;
      return true;
    }
    undo() { if (this.index <= 0) return null; this.index--; return deepClone(this.items[this.index]); }
    redo() { if (this.index >= this.items.length - 1) return null; this.index++; return deepClone(this.items[this.index]); }
    canUndo() { return this.index > 0; }
    canRedo() { return this.index >= 0 && this.index < this.items.length - 1; }
  }

  return { normalizeRect, rectContains, annotationBounds, hitTest, mapClientToDocument, resizeHandles, hitResizeHandle, resizeAnnotation, translateAnnotation, supportsStrokeWidth, supportsFontSize, supportsAnnotationShadow, duplicateAnnotation, deepClone, History };
});
