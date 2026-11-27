(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrabbrHotkeys = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    window: 'CommandOrControl+Shift+2',
    region: 'CommandOrControl+Shift+3',
    screen: 'CommandOrControl+Shift+4',
    ocr: 'CommandOrControl+Shift+5'
  });

  const MODIFIERS = new Set(['Command', 'Cmd', 'Control', 'Ctrl', 'CommandOrControl', 'CmdOrCtrl', 'Alt', 'Option', 'AltGr', 'Shift', 'Super']);
  const KEYS = /^(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4])|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Plus|Num\d|num\d|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen)$/i;

  function validateAccelerator(value) {
    if (typeof value !== 'string' || !value.trim()) return { valid: false, reason: 'Sneltoets ontbreekt.' };
    const parts = value.split('+').map(v => v.trim()).filter(Boolean);
    if (parts.length < 2) return { valid: false, reason: 'Gebruik minimaal één modificatietoets en één gewone toets.' };
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);
    if (!modifiers.every(modifier => MODIFIERS.has(modifier))) return { valid: false, reason: 'Onbekende modificatietoets.' };
    if (!KEYS.test(key)) return { valid: false, reason: 'Deze toets wordt niet ondersteund.' };
    if (new Set(modifiers.map(v => v.toLowerCase())).size !== modifiers.length) return { valid: false, reason: 'Een modificatietoets staat dubbel.' };
    return { valid: true };
  }

  function validateSettings(settings) {
    const normalized = { ...DEFAULTS, ...(settings || {}) };
    for (const action of Object.keys(DEFAULTS)) {
      const result = validateAccelerator(normalized[action]);
      if (!result.valid) return { valid: false, action, reason: result.reason };
    }
    const lowered = Object.values(normalized).map(value => value.toLowerCase());
    if (new Set(lowered).size !== lowered.length) return { valid: false, reason: 'Elke actie moet een unieke sneltoets hebben.' };
    return { valid: true, settings: normalized };
  }

  function eventToAccelerator(event, isMac = false) {
    const modifiers = [];
    if (event.metaKey) modifiers.push(isMac ? 'Command' : 'Super');
    if (event.ctrlKey) modifiers.push('Control');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (!modifiers.length) return null;
    const ignored = new Set(['Meta', 'Control', 'Alt', 'Shift']);
    if (ignored.has(event.key)) return null;
    let key = event.key;
    if (/^Key[A-Z]$/.test(event.code || '')) key = event.code.slice(3);
    else if (/^Digit[0-9]$/.test(event.code || '')) key = event.code.slice(5);
    else if (/^F(?:[1-9]|1\d|2[0-4])$/.test(event.code || '')) key = event.code;
    else if (event.code === 'NumpadAdd') key = 'Plus';
    const aliases = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', '+': 'Plus' };
    key = aliases[key] || key;
    if (key.length === 1) key = key.toUpperCase();
    const accelerator = [...modifiers, key].join('+');
    return validateAccelerator(accelerator).valid ? accelerator : null;
  }

  return { DEFAULTS, validateAccelerator, validateSettings, eventToAccelerator };
});
