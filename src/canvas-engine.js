(function () {
  'use strict';

  const M = window.GrabbrModel;
  const O = window.GrabbrObscureRender;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  class CanvasEngine {
    constructor(canvas, callbacks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.callbacks = callbacks;
      this.image = null;
      this.baseDataUrl = null;
      this.name = 'Grabbr';
      this.annotations = [];
      this.selectedIndex = -1;
      this.tool = 'select';
      this.style = { color: '#765cff', width: 7, fontSize: 28 };
      this.shadow = { enabled: true };
      this.margin = 0;
      this.draft = null;
      this.cropRect = null;
      this.drag = null;
      this.stepCounter = 1;
      this.bindEvents();
    }

    bindEvents() {
      this.canvas.addEventListener('pointerdown', e => this.pointerDown(e));
      this.canvas.addEventListener('pointermove', e => this.pointerMove(e));
      this.canvas.addEventListener('pointerup', e => this.pointerUp(e));
      this.canvas.addEventListener('pointercancel', e => this.pointerUp(e));
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    async setDocument(dataUrl, name = 'Grabbr', options = {}) {
      this.baseDataUrl = dataUrl;
      this.name = name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Grabbr';
      this.annotations = [];
      this.selectedIndex = -1;
      this.cropRect = null;
      this.draft = null;
      this.stepCounter = 1;
      if (typeof options.shadow === 'boolean') this.shadow.enabled = options.shadow;
      await this.loadBaseImage(dataUrl);
      this.render();
    }

    loadBaseImage(dataUrl) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => { this.image = image; resolve(); };
        image.onerror = () => reject(new Error('De vastgelegde afbeelding kon niet worden geopend.'));
        image.src = dataUrl;
      });
    }

    getMargin() {
      if (!this.shadow.enabled) return 0;
      return 70;
    }

    setTool(tool) {
      this.tool = tool;
      this.draft = null;
      if (tool !== 'crop') this.cropRect = null;
      this.canvas.style.cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
      this.render();
    }

    setStyle(next) { Object.assign(this.style, next); }
    setShadowEnabled(enabled, commit = true) {
      if (this.shadow.enabled === Boolean(enabled)) return false;
      this.shadow.enabled = Boolean(enabled);
      this.render();
      if (commit) this.callbacks.onCommit?.();
      return true;
    }

    getSelectedAnnotation() {
      return this.selectedIndex >= 0 ? this.annotations[this.selectedIndex] || null : null;
    }

    notifySelection() {
      const item = this.getSelectedAnnotation();
      this.callbacks.onSelection?.(Boolean(item), item ? M.deepClone(item) : null);
    }

    applySelectedProperties(next, commit = true) {
      const item = this.getSelectedAnnotation();
      if (!item) return false;
      let changed = false;
      if (next.color && item.color !== next.color) { item.color = next.color; changed = true; }
      if (Number.isFinite(next.width) && M.supportsStrokeWidth(item) && item.width !== next.width) { item.width = next.width; changed = true; }
      if (Number.isFinite(next.fontSize) && M.supportsFontSize(item) && item.fontSize !== next.fontSize) { item.fontSize = next.fontSize; item.width = 0; changed = true; }
      if (!changed) return false;
      this.render(); this.notifySelection();
      if (commit) this.callbacks.onCommit?.();
      return true;
    }

    copySelectedAnnotation() {
      const item = this.getSelectedAnnotation();
      return item ? M.deepClone(item) : null;
    }

    pasteAnnotation(item, offset = 16) {
      if (!item) return false;
      const duplicate = M.duplicateAnnotation(item, offset, offset, crypto.randomUUID());
      this.annotations.push(duplicate);
      this.selectedIndex = this.annotations.length - 1;
      this.render(); this.notifySelection(); this.callbacks.onCommit?.();
      return true;
    }

    scene() {
      return { baseDataUrl: this.baseDataUrl, annotations: M.deepClone(this.annotations), shadow: { enabled: this.shadow.enabled }, stepCounter: this.stepCounter };
    }

    async restoreScene(scene) {
      if (scene.baseDataUrl && scene.baseDataUrl !== this.baseDataUrl) {
        this.baseDataUrl = scene.baseDataUrl;
        await this.loadBaseImage(this.baseDataUrl);
      }
      this.annotations = M.deepClone(scene.annotations || []);
      this.shadow = { enabled: scene.shadow?.enabled === true };
      this.stepCounter = scene.stepCounter || 1;
      this.selectedIndex = -1;
      this.render();
      this.notifySelection();
    }

    dimensions() { return this.image ? { width: this.image.naturalWidth, height: this.image.naturalHeight } : null; }

    resizeCanvas() {
      if (!this.image) return;
      this.margin = this.getMargin();
      const width = this.image.naturalWidth + this.margin * 2;
      const height = this.image.naturalHeight + this.margin * 2;
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
    }

    render(forExport = false) {
      if (!this.image) return;
      this.resizeCanvas();
      const ctx = this.ctx;
      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (this.shadow.enabled) {
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 14;
      }
      ctx.drawImage(this.image, this.margin, this.margin);
      ctx.shadowColor = 'transparent';
      for (const item of this.annotations) this.drawAnnotation(item, ctx);
      if (this.draft) this.drawAnnotation(this.draft, ctx);
      if (!forExport) {
        if (this.selectedIndex >= 0 && this.annotations[this.selectedIndex]) this.drawSelection(this.annotations[this.selectedIndex], ctx);
        if (this.cropRect) this.drawCropOverlay(this.cropRect, ctx);
      }
      ctx.restore();
    }

    docPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      return M.mapClientToDocument({ x: event.clientX, y: event.clientY }, rect, { width: this.canvas.width, height: this.canvas.height }, this.margin);
    }

    boundedPoint(point) {
      return { x: clamp(point.x, 0, this.image.naturalWidth), y: clamp(point.y, 0, this.image.naturalHeight) };
    }

    visualScale() {
      const rect = this.canvas.getBoundingClientRect();
      return rect.width > 0 ? this.canvas.width / rect.width : 1;
    }

    baseItem(type, p) {
      return { id: crypto.randomUUID(), type, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: this.style.color, width: this.style.width, fontSize: this.style.fontSize };
    }

    pointerDown(event) {
      if (!this.image || event.button !== 0) return;
      const point = this.boundedPoint(this.docPoint(event));
      this.canvas.setPointerCapture(event.pointerId);
      if (this.tool === 'select') {
        const selected = this.annotations[this.selectedIndex];
        const handle = selected ? M.hitResizeHandle(selected, point, 12 * this.visualScale()) : null;
        if (handle) {
          this.drag = { action: 'resize', handle: handle.id, start: point, original: M.deepClone(selected) };
          this.canvas.style.cursor = handle.cursor;
          this.render();
          return;
        }
        const found = [...this.annotations].map((item, index) => ({ item, index })).reverse().find(v => M.hitTest(v.item, point, 10));
        this.selectedIndex = found ? found.index : -1;
        this.drag = found ? { action: 'move', start: point, original: M.deepClone(found.item) } : null;
        this.notifySelection();
        this.render();
        return;
      }
      if (this.tool === 'text') {
        this.callbacks.onTextRequest?.(point, text => {
          if (!text.trim()) return;
          this.annotations.push({ id: crypto.randomUUID(), type: 'text', x: point.x, y: point.y, text: text.trim(), color: this.style.color, fontSize: this.style.fontSize, width: 0 });
          this.selectedIndex = this.annotations.length - 1;
          this.callbacks.onCommit?.();
          this.render();
          this.notifySelection();
        });
        return;
      }
      if (this.tool === 'step') {
        this.annotations.push({ id: crypto.randomUUID(), type: 'step', x: point.x, y: point.y, number: this.stepCounter++, radius: Math.max(14, this.style.fontSize * .58), color: this.style.color, fontSize: this.style.fontSize });
        this.selectedIndex = this.annotations.length - 1;
        this.callbacks.onCommit?.();
        this.render();
        this.notifySelection();
        return;
      }
      if (this.tool === 'pen') this.draft = { id: crypto.randomUUID(), type: 'pen', points: [point], color: this.style.color, width: this.style.width };
      else this.draft = this.baseItem(this.tool, point);
      this.drag = { start: point };
      this.render();
    }

    pointerMove(event) {
      if (!this.image) return;
      const point = this.boundedPoint(this.docPoint(event));
      if (!this.drag) {
        if (this.tool === 'select') {
          const selected = this.annotations[this.selectedIndex];
          const handle = selected ? M.hitResizeHandle(selected, point, 12 * this.visualScale()) : null;
          this.canvas.style.cursor = handle?.cursor || (selected && M.hitTest(selected, point, 8) ? 'move' : 'default');
        }
        return;
      }
      if (this.tool === 'select' && this.selectedIndex >= 0 && this.drag.original) {
        if (this.drag.action === 'resize') {
          this.annotations[this.selectedIndex] = M.resizeAnnotation(this.drag.original, this.drag.handle, point, 10);
        } else {
          const dx = point.x - this.drag.start.x, dy = point.y - this.drag.start.y;
          this.annotations[this.selectedIndex] = M.translateAnnotation(this.drag.original, dx, dy);
        }
      } else if (this.draft?.type === 'pen') {
        const last = this.draft.points[this.draft.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) > 1.5) this.draft.points.push(point);
      } else if (this.draft) {
        this.draft.x2 = point.x; this.draft.y2 = point.y;
        if (this.tool === 'crop') this.cropRect = M.normalizeRect(this.drag.start, point);
      }
      this.render();
    }

    pointerUp(event) {
      if (!this.drag) return;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (this.tool === 'select') {
        if (this.selectedIndex >= 0 && this.drag.original && JSON.stringify(this.drag.original) !== JSON.stringify(this.annotations[this.selectedIndex])) this.callbacks.onCommit?.();
      } else if (this.tool === 'crop') {
        const rect = this.cropRect;
        this.callbacks.onCropChange?.(Boolean(rect && rect.width >= 4 && rect.height >= 4));
      } else if (this.draft) {
        const bounds = M.annotationBounds(this.draft);
        const valid = this.draft.type === 'pen' ? this.draft.points.length > 1 : bounds.width + bounds.height >= 5;
        if (valid) {
          this.annotations.push(this.draft);
          this.selectedIndex = this.annotations.length - 1;
          this.callbacks.onCommit?.();
          this.notifySelection();
        }
        this.draft = null;
      }
      this.drag = null;
      if (this.tool === 'select') this.canvas.style.cursor = 'default';
      this.render();
    }

    deleteSelected() {
      if (this.selectedIndex < 0) return false;
      this.annotations.splice(this.selectedIndex, 1);
      this.selectedIndex = -1;
      this.notifySelection();
      this.callbacks.onCommit?.();
      this.render();
      return true;
    }

    cancelCrop() {
      this.cropRect = null; this.draft = null; this.drag = null;
      this.callbacks.onCropChange?.(false);
      this.render();
    }

    async applyCrop() {
      if (!this.cropRect || this.cropRect.width < 4 || this.cropRect.height < 4) return false;
      const r = {
        x: Math.floor(clamp(this.cropRect.x, 0, this.image.naturalWidth - 1)),
        y: Math.floor(clamp(this.cropRect.y, 0, this.image.naturalHeight - 1)),
        width: Math.floor(clamp(this.cropRect.width, 1, this.image.naturalWidth - this.cropRect.x)),
        height: Math.floor(clamp(this.cropRect.height, 1, this.image.naturalHeight - this.cropRect.y))
      };
      const temp = document.createElement('canvas');
      temp.width = r.width; temp.height = r.height;
      temp.getContext('2d').drawImage(this.image, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
      this.baseDataUrl = temp.toDataURL('image/png');
      await this.loadBaseImage(this.baseDataUrl);
      this.annotations = this.annotations
        .filter(item => {
          const b = M.annotationBounds(item);
          return b.x + b.width >= r.x && b.y + b.height >= r.y && b.x <= r.x + r.width && b.y <= r.y + r.height;
        })
        .map(item => M.translateAnnotation(item, -r.x, -r.y));
      this.cropRect = null; this.draft = null; this.selectedIndex = -1;
      this.callbacks.onCropChange?.(false);
      this.callbacks.onBaseChanged?.();
      this.render();
      this.notifySelection();
      this.callbacks.onCommit?.();
      return true;
    }

    drawAnnotation(item, ctx) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = item.color || '#ff3b5c';
      ctx.fillStyle = item.color || '#ff3b5c';
      ctx.lineWidth = item.width || 5;
      const ox = this.margin, oy = this.margin;
      const x1 = (item.x1 ?? 0) + ox, y1 = (item.y1 ?? 0) + oy, x2 = (item.x2 ?? 0) + ox, y2 = (item.y2 ?? 0) + oy;
      if (item.type === 'pen') {
        if (item.points.length > 1) {
          ctx.beginPath(); ctx.moveTo(item.points[0].x + ox, item.points[0].y + oy);
          for (let i = 1; i < item.points.length; i++) ctx.lineTo(item.points[i].x + ox, item.points[i].y + oy);
          ctx.stroke();
        }
      } else if (item.type === 'line' || item.type === 'arrow') {
        if (item.type === 'line') {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        } else {
          this.drawModernArrow(ctx, x1, y1, x2, y2, item.width || 5);
        }
      } else if (item.type === 'rect' || item.type === 'ellipse') {
        const r = M.normalizeRect({ x: x1, y: y1 }, { x: x2, y: y2 });
        ctx.beginPath();
        if (item.type === 'rect') ctx.roundRect(r.x, r.y, r.width, r.height, Math.min(10, r.width / 5, r.height / 5));
        else {
          ctx.shadowColor = this.withAlpha(item.color || '#ff3b5c', .18);
          ctx.shadowBlur = Math.max(1.5, (item.width || 5) * .45);
          ctx.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
      } else if (item.type === 'text') {
        ctx.font = `600 ${item.fontSize}px Inter, -apple-system, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        const lines = item.text.split('\n');
        const lineHeight = item.fontSize * 1.2;
        item.width = Math.max(...lines.map(line => ctx.measureText(line).width));
        lines.forEach((line, index) => ctx.fillText(line, item.x + ox, item.y + oy + index * lineHeight));
      } else if (item.type === 'step') {
        const x = item.x + ox, y = item.y + oy, r = item.radius || 16;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = this.contrastColor(item.color);
        ctx.font = `700 ${Math.round(r * 1.15)}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(item.number), x, y + .5);
      } else if (item.type === 'redact') {
        const r = M.normalizeRect({ x: x1, y: y1 }, { x: x2, y: y2 });
        ctx.fillStyle = '#111217'; ctx.fillRect(r.x, r.y, r.width, r.height);
      } else if (item.type === 'blur' || item.type === 'pixelate') {
        const r = M.normalizeRect({ x: x1, y: y1 }, { x: x2, y: y2 });
        this.drawObscure(item.type, r, ctx);
      }
      ctx.restore();
    }

    drawObscure(type, rect, ctx) {
      const plan = O.obscureRenderPlan(type, rect, this.margin, { width: this.image.naturalWidth, height: this.image.naturalHeight });
      if (!plan) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(plan.destination.x, plan.destination.y, plan.destination.width, plan.destination.height);
      ctx.clip();
      if (type === 'blur') {
        const source = document.createElement('canvas');
        source.width = plan.expandedSource.width;
        source.height = plan.expandedSource.height;
        source.getContext('2d').drawImage(
          this.image,
          plan.expandedSource.x, plan.expandedSource.y, plan.expandedSource.width, plan.expandedSource.height,
          0, 0, source.width, source.height
        );
        const filtered = document.createElement('canvas');
        filtered.width = source.width; filtered.height = source.height;
        const filteredContext = filtered.getContext('2d');
        filteredContext.filter = `blur(${plan.blurRadius}px)`;
        filteredContext.drawImage(source, 0, 0);
        filteredContext.filter = 'none';
        ctx.drawImage(
          filtered,
          plan.cropInExpanded.x, plan.cropInExpanded.y, plan.cropInExpanded.width, plan.cropInExpanded.height,
          plan.destination.x, plan.destination.y, plan.destination.width, plan.destination.height
        );
      } else {
        const small = document.createElement('canvas');
        small.width = plan.sampleSize.width; small.height = plan.sampleSize.height;
        small.getContext('2d').drawImage(
          this.image,
          plan.source.x, plan.source.y, plan.source.width, plan.source.height,
          0, 0, small.width, small.height
        );
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, small.width, small.height, plan.destination.x, plan.destination.y, plan.destination.width, plan.destination.height);
        ctx.imageSmoothingEnabled = true;
      }
      ctx.restore();
    }

    contrastColor(hex) {
      const clean = (hex || '#ffffff').replace('#', '');
      const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
      const n = parseInt(full, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#111217' : '#ffffff';
    }

    withAlpha(hex, alpha) {
      const clean = (hex || '#ffffff').replace('#', '');
      const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
      const n = parseInt(full, 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
    }

    drawModernArrow(ctx, x1, y1, x2, y2, width) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length < 1) return;
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      const bend = Math.min(10, length * .025);
      const cx = (x1 + x2) / 2 + nx * bend;
      const cy = (y1 + y2) / 2 + ny * bend;
      ctx.save();
      ctx.lineWidth = Math.max(3, width);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = this.withAlpha(ctx.strokeStyle, .16);
      ctx.shadowBlur = Math.max(1, width * .42);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();

      const head = Math.min(Math.max(18, width * 4.1), Math.max(18, length * .42));
      const spread = Math.PI * .27;
      const wing1 = { x: x2 - head * Math.cos(angle - spread), y: y2 - head * Math.sin(angle - spread) };
      const wing2 = { x: x2 - head * Math.cos(angle + spread), y: y2 - head * Math.sin(angle + spread) };
      const curve = Math.max(3, head * .12);
      ctx.beginPath();
      ctx.moveTo(wing1.x, wing1.y);
      ctx.quadraticCurveTo(x2 - curve * Math.cos(angle) + nx * curve, y2 - curve * Math.sin(angle) + ny * curve, x2, y2);
      ctx.quadraticCurveTo(x2 - curve * Math.cos(angle) - nx * curve, y2 - curve * Math.sin(angle) - ny * curve, wing2.x, wing2.y);
      ctx.stroke();
      ctx.restore();
    }

    drawSelection(item, ctx) {
      const scale = this.visualScale();
      const b = M.annotationBounds(item), p = 7 * scale;
      const handles = M.resizeHandles(item);
      ctx.save(); ctx.setLineDash([5 * scale, 4 * scale]); ctx.lineWidth = 1.25 * scale; ctx.strokeStyle = '#8d79ff';
      if (item.type === 'arrow' || item.type === 'line') {
        ctx.beginPath(); ctx.moveTo(item.x1 + this.margin, item.y1 + this.margin); ctx.lineTo(item.x2 + this.margin, item.y2 + this.margin); ctx.stroke();
      } else {
        ctx.strokeRect(b.x + this.margin - p, b.y + this.margin - p, Math.max(1, b.width + p * 2), Math.max(1, b.height + p * 2));
      }
      ctx.setLineDash([]);
      if (handles.length) {
        handles.forEach(handle => {
          ctx.beginPath();
          ctx.arc(handle.x + this.margin, handle.y + this.margin, 6 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff'; ctx.fill();
          ctx.lineWidth = 2 * scale; ctx.strokeStyle = '#765cff'; ctx.stroke();
        });
      } else {
        ctx.fillStyle = '#fff';
        [[b.x-p,b.y-p],[b.x+b.width+p,b.y-p],[b.x-p,b.y+b.height+p],[b.x+b.width+p,b.y+b.height+p]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x + this.margin, y + this.margin, 3.5 * scale, 0, Math.PI*2); ctx.fill(); });
      }
      ctx.restore();
    }

    drawCropOverlay(rect, ctx) {
      const r = { x: rect.x + this.margin, y: rect.y + this.margin, width: rect.width, height: rect.height };
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath();
      ctx.rect(this.margin, this.margin, this.image.naturalWidth, this.image.naturalHeight);
      ctx.rect(r.x, r.y, r.width, r.height); ctx.fill('evenodd');
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([7,5]); ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(15,17,23,.85)';
      const label = `${Math.round(r.width)} × ${Math.round(r.height)}`; ctx.font = '12px sans-serif';
      const tw = ctx.measureText(label).width + 14; ctx.fillRect(r.x, Math.max(this.margin, r.y - 25), tw, 21); ctx.fillStyle = '#fff'; ctx.fillText(label, r.x + 7, Math.max(this.margin + 14, r.y - 10));
      ctx.restore();
    }

    exportDataUrl(format = 'png') {
      this.render(true);
      let outputCanvas = this.canvas;
      if (format === 'jpeg') {
        if (this.shadow.enabled) throw new Error('JPEG ondersteunt geen transparante schaduw. Schakel de schaduw uit of kies PNG.');
        const flat = document.createElement('canvas'); flat.width = this.canvas.width; flat.height = this.canvas.height;
        const fctx = flat.getContext('2d'); fctx.fillStyle = '#fff'; fctx.fillRect(0, 0, flat.width, flat.height); fctx.drawImage(this.canvas, 0, 0); outputCanvas = flat;
      }
      const data = outputCanvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', .92);
      this.render(false);
      return data;
    }

    async exportPngBytes() {
      if (!this.image) throw new Error('Er is geen screenshot om te kopiëren.');
      this.render(true);
      try {
        const blob = await new Promise((resolve, reject) => {
          this.canvas.toBlob(result => result ? resolve(result) : reject(new Error('De geannoteerde screenshot kon niet als PNG worden gerenderd.')), 'image/png');
        });
        const buffer = await blob.arrayBuffer();
        if (!buffer.byteLength) throw new Error('De gerenderde PNG is leeg.');
        return new Uint8Array(buffer);
      } finally {
        this.render(false);
      }
    }
  }

  window.CanvasEngine = CanvasEngine;
})();
