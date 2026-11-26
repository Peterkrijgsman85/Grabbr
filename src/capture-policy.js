(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrabbrCapturePolicy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const APP_NAME = 'Grabbr';

  function isOwnSourceName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    return normalized === 'grabbr' || normalized.startsWith('grabbr ') || normalized.startsWith('grabbr-');
  }

  function filterExternalSources(sources) {
    return (sources || []).filter(source => !isOwnSourceName(source?.name));
  }

  function mediaConstraints(kind) {
    const isWindow = kind === 'window';
    return {
      audio: false,
      video: {
        width: { max: 8192 },
        height: { max: 8192 },
        frameRate: { ideal: 1, max: 2 },
        cursor: isWindow ? 'never' : 'always',
        displaySurface: isWindow ? 'window' : 'monitor'
      }
    };
  }

  function cursorPolicySatisfied(kind, trackSettings) {
    if (kind !== 'window') return true;
    const value = trackSettings?.cursor;
    return value == null || value === 'never';
  }

  return { APP_NAME, isOwnSourceName, filterExternalSources, mediaConstraints, cursorPolicySatisfied };
});
