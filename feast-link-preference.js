const STORAGE_KEY = "simple-liturgy.feast-links-enabled";

export function initializeFeastLinks({ control, storage }) {
  const enabled = storage.getItem(STORAGE_KEY) !== "false";
  control.checked = enabled;
  return enabled;
}

export function setFeastLinksEnabled({ control, storage }, enabled) {
  const normalized = Boolean(enabled);
  control.checked = normalized;
  storage.setItem(STORAGE_KEY, String(normalized));
  return normalized;
}

export function bindFeastLinksPreference({ control, storage, invalidateLayout, isReady, render }) {
  control.addEventListener("change", () => {
    setFeastLinksEnabled({ control, storage }, control.checked);
    invalidateLayout();
    if (isReady()) render();
  });
}
