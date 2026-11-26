'use strict';

class WindowLifecyclePolicy {
  constructor(options = {}) {
    this.suppressDurationMs = options.suppressDurationMs || 1200;
    this.suppressActivateUntil = 0;
  }

  markProgrammaticAnnotationClose(now = Date.now()) {
    this.suppressActivateUntil = now + this.suppressDurationMs;
  }

  shouldHandleActivate(now = Date.now()) {
    return now >= this.suppressActivateUntil;
  }

  activateExistingMainWindow(mainWindow) {
    if (!this.shouldHandleActivate()) return false;
    if (!mainWindow || mainWindow.isDestroyed?.()) return false;
    mainWindow.show?.();
    mainWindow.focus?.();
    return true;
  }

  shouldQuitOnAllWindowsClosed(hasTray) {
    return !hasTray;
  }
}

module.exports = { WindowLifecyclePolicy };
