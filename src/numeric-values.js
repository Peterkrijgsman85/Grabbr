(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrabbrNumericValues = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normalizeManualValue(value, minimum = 1, maximum = 200) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed)) return null;
    return clamp(parsed, minimum, maximum);
  }
  function sliderPosition(value, minimum, maximum) { return clamp(Number(value), minimum, maximum); }
  return { clamp, normalizeManualValue, sliderPosition };
});
