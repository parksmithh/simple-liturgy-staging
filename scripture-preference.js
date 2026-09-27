const STORAGE_KEY = "simple-liturgy.scripture";
const MODES = new Set(["off", "web", "kjv"]);

function updateControls(controls, mode) {
  controls?.forEach(control => {
    control.checked = control.value === mode;
  });
}

export function initializeScripturePreference({ controls, storage }) {
  let mode = "off";
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (MODES.has(saved)) mode = saved;
  } catch {
    mode = "off";
  }
  updateControls(controls, mode);
  return mode;
}

export function setScriptureMode({ controls, storage }, mode) {
  if (!MODES.has(mode)) return null;
  updateControls(controls, mode);
  try {
    storage.setItem(STORAGE_KEY, mode);
  } catch {
    // Keep UI in sync even when storage is unavailable.
  }
  return mode;
}

export function bindScripturePreference({ controls, storage, onChange }) {
  controls.forEach(control => control.addEventListener("change", () => {
    if (!control.checked) return;
    const mode = setScriptureMode({ controls, storage }, control.value);
    if (mode) onChange(mode);
  }));
}

export function editionForMode(mode) {
  if (mode === "web") return "engwebp";
  if (mode === "kjv") return "eng-kjv";
  return null;
}

export const SCRIPTURE_MODES = MODES;
