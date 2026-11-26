'use strict';

class WindowRegistry {
  constructor() { this.windows = new Map(); }
  add(window) {
    if (!window || typeof window.id !== 'number') throw new TypeError('Ongeldig annotatievenster.');
    this.windows.set(window.id, window);
    return window;
  }
  remove(windowOrId) {
    const id = typeof windowOrId === 'number' ? windowOrId : windowOrId?.id;
    return this.windows.delete(id);
  }
  has(windowOrId) {
    const id = typeof windowOrId === 'number' ? windowOrId : windowOrId?.id;
    return this.windows.has(id);
  }
  get size() { return this.windows.size; }
  values() { return [...this.windows.values()]; }
}

module.exports = { WindowRegistry };
