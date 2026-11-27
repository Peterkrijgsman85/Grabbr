(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrabbrObscureRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function obscureRenderPlan(type, canvasRect, margin, imageSize) {
    if (!['blur', 'pixelate'].includes(type)) throw new TypeError('Onbekend obscure-type.');
    if (!canvasRect || !imageSize || imageSize.width <= 0 || imageSize.height <= 0) return null;

    const documentRect = {
      x: canvasRect.x - margin,
      y: canvasRect.y - margin,
      width: canvasRect.width,
      height: canvasRect.height
    };
    const left = clamp(Math.floor(documentRect.x), 0, imageSize.width);
    const top = clamp(Math.floor(documentRect.y), 0, imageSize.height);
    const right = clamp(Math.ceil(documentRect.x + documentRect.width), 0, imageSize.width);
    const bottom = clamp(Math.ceil(documentRect.y + documentRect.height), 0, imageSize.height);
    const width = right - left, height = bottom - top;
    if (width <= 0 || height <= 0) return null;

    const source = { x: left, y: top, width, height };
    const destination = { x: left + margin, y: top + margin, width, height };
    if (type === 'pixelate') {
      const blockSize = Math.max(5, Math.min(18, Math.round(Math.min(width, height) / 12)));
      return {
        type, source, destination, blockSize,
        sampleSize: { width: Math.max(1, Math.ceil(width / blockSize)), height: Math.max(1, Math.ceil(height / blockSize)) }
      };
    }

    const blurRadius = Math.max(7, Math.min(24, width / 12));
    const padding = Math.ceil(blurRadius * 2);
    const expandedLeft = Math.max(0, left - padding);
    const expandedTop = Math.max(0, top - padding);
    const expandedRight = Math.min(imageSize.width, right + padding);
    const expandedBottom = Math.min(imageSize.height, bottom + padding);
    const expandedSource = {
      x: expandedLeft, y: expandedTop,
      width: expandedRight - expandedLeft,
      height: expandedBottom - expandedTop
    };
    return {
      type, source, destination, blurRadius, padding, expandedSource,
      cropInExpanded: { x: left - expandedLeft, y: top - expandedTop, width, height }
    };
  }

  return { obscureRenderPlan };
});
