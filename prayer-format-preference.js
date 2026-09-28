const STORAGE_KEY = "simple-liturgy.prayer-format";
export const SIMPLE_PRAYER_FORMAT = "simple";
export const FULL_PRAYER_FORMAT = "full";
const FORMATS = new Set([SIMPLE_PRAYER_FORMAT, FULL_PRAYER_FORMAT]);

function normalizedFormat(value) {
  return FORMATS.has(value) ? value : SIMPLE_PRAYER_FORMAT;
}

function updateControls(controls, format) {
  controls?.forEach(control => {
    control.checked = control.value === format;
  });
}

export function initializePrayerFormatPreference({ controls, storage }) {
  const format = normalizedFormat(storage.getItem(STORAGE_KEY));
  updateControls(controls, format);
  return format;
}

export function setPrayerFormat({ controls, storage }, format) {
  const normalized = normalizedFormat(format);
  updateControls(controls, normalized);
  try {
    storage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Keep UI in sync even when storage is unavailable.
  }
  return normalized;
}

export function bindPrayerFormatPreference({ controls, storage, onChange }) {
  controls.forEach(control => control.addEventListener("change", () => {
    if (!control.checked) return;
    onChange(setPrayerFormat({ controls, storage }, control.value));
  }));
}
