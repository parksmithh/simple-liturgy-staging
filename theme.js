const STORAGE_KEY = "daily-office-theme";
const MODES = new Set(["light", "dark", "system"]);

function updateControls(controls, mode) {
  controls?.forEach(control => {
    control.checked = control.value === mode;
  });
}

function themeColor(context) {
  const styles = context.styles
    ? context.styles(context.root)
    : globalThis.getComputedStyle?.(context.root);
  return styles?.getPropertyValue("--app-background").trim() || "";
}

function resolvedTheme(mode, media) {
  return mode === "system" ? media.matches ? "dark" : "light" : mode;
}

function applyTheme(context, mode) {
  const theme = resolvedTheme(mode, context.media);
  context.root.dataset.themeMode = mode;
  context.root.dataset.theme = theme;
  const color = themeColor(context);
  if (color) context.meta?.setAttribute("content", color);
  updateControls(context.controls, mode);
  return theme;
}

export function initializeTheme({ root, controls, storage, media, meta, styles }) {
  const saved = storage.getItem(STORAGE_KEY);
  const mode = MODES.has(saved) ? saved : "system";
  applyTheme({ root, controls, media, meta, styles }, mode);
  return mode;
}

export function setThemeMode(context, mode) {
  if (!MODES.has(mode)) return context.root.dataset.themeMode;
  applyTheme(context, mode);
  context.storage.setItem(STORAGE_KEY, mode);
  return mode;
}

export function syncSystemTheme(context) {
  if (context.root.dataset.themeMode !== "system") return null;
  return applyTheme(context, "system");
}
