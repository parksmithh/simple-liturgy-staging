const STORAGE_KEY = "simple-liturgy.prayer-format";
export const SIMPLE_PRAYER_FORMAT = "simple";
export const FULL_PRAYER_FORMAT = "full";

function normalizedFormat(value) {
  return value === FULL_PRAYER_FORMAT ? FULL_PRAYER_FORMAT : SIMPLE_PRAYER_FORMAT;
}

export function initializePrayerFormatPreference({ control, storage }) {
  const format = normalizedFormat(storage.getItem(STORAGE_KEY));
  control.checked = format === FULL_PRAYER_FORMAT;
  return format;
}

export function setPrayerFormat({ control, storage }, format) {
  const normalized = normalizedFormat(format);
  control.checked = normalized === FULL_PRAYER_FORMAT;
  try {
    storage.setItem(STORAGE_KEY, normalized);
  } catch {}
  return normalized;
}

export function bindPrayerFormatPreference({ control, storage, onChange }) {
  control.addEventListener("change", () => {
    const format = control.checked ? FULL_PRAYER_FORMAT : SIMPLE_PRAYER_FORMAT;
    onChange(setPrayerFormat({ control, storage }, format));
  });
}
