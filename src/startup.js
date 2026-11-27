(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrabbrStartup = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isSupportedPlatform(platform) {
    return platform === 'darwin' || platform === 'win32';
  }

  function loginItemOptions(platform, execPath, enabled) {
    if (!isSupportedPlatform(platform)) return null;
    const options = { openAtLogin: Boolean(enabled) };
    if (platform === 'win32') {
      options.path = execPath;
      options.args = [];
    }
    return options;
  }

  function normalizeState(platform, nativeState, desired = false) {
    return {
      supported: isSupportedPlatform(platform),
      openAtLogin: isSupportedPlatform(platform) ? Boolean(nativeState?.openAtLogin) : false,
      desired: Boolean(desired),
      wasOpenedAtLogin: Boolean(nativeState?.wasOpenedAtLogin),
      wasOpenedAsHidden: Boolean(nativeState?.wasOpenedAsHidden)
    };
  }

  return { isSupportedPlatform, loginItemOptions, normalizeState };
});
