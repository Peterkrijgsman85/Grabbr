'use strict';

const DEFAULT_ANNOTATION_SETTINGS = Object.freeze({ closeAfterCopy: false });

function normalizeAnnotationSettings(value) {
  return { closeAfterCopy: value?.closeAfterCopy === true };
}

module.exports = { DEFAULT_ANNOTATION_SETTINGS, normalizeAnnotationSettings };
