import { createBoundaryTimer } from "./boundary-timer.js?v=staging-f18f79ebcf4e06b14d443fdf719911679985a338";

const STORAGE_KEY = "simple-liturgy.noonday-enabled";

export function initializeNoondayPreference({ control, storage }) {
  const enabled = storage.getItem(STORAGE_KEY) === "true";
  control.checked = enabled;
  return enabled;
}

export function setNoondayEnabled({ control, storage }, enabled) {
  const normalized = Boolean(enabled);
  control.checked = normalized;
  try {
    storage.setItem(STORAGE_KEY, String(normalized));
  } catch {}
  return normalized;
}

export function bindNoondayPreference({ control, storage, onChange }) {
  control.addEventListener("change", () => {
    onChange(setNoondayEnabled({ control, storage }, control.checked));
  });
}

export function noondayServiceAt(date = new Date(), enabled = true) {
  if (!enabled) return "daily";
  const hour = date.getHours();
  return hour >= 10 && hour < 14 ? "noonday" : "daily";
}

export function noondayPreviewRelation(date = new Date()) {
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  return date < noon ? "future" : "past";
}

export function noondayPreviewPeriodAt(date = new Date(), enabled = true) {
  const hour = date.getHours();
  if (enabled && hour >= 10 && hour < 14) return "noonday";
  if (hour < 10 || (!enabled && hour < 12)) return "morning";
  return "evening";
}

export function noondayPreviewMarkerAt(date = new Date(), enabled = true) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}:${noondayPreviewPeriodAt(date, enabled)}`;
}

export function shouldExitNoondayPreview(date, marker, enabled = true) {
  return noondayPreviewMarkerAt(date, enabled) !== marker;
}

export function refreshNoondayPreview({
  date,
  marker,
  enabled,
  exit,
  resetForNewLocalDate,
  render,
}) {
  const exited = shouldExitNoondayPreview(date, marker, enabled);
  if (exited) exit(date);
  resetForNewLocalDate(date);
  render();
  return { exited };
}

export function shouldShowNoondayPreview(date = new Date(), enabled = true) {
  return noondayServiceAt(date, enabled) !== "noonday";
}

export function millisecondsUntilNoondayBoundary(date = new Date()) {
  const boundary = new Date(date);
  const hour = date.getHours();
  if (hour < 10) {
    boundary.setHours(10, 0, 0, 0);
  } else if (hour < 12) {
    boundary.setHours(12, 0, 0, 0);
  } else if (hour < 14) {
    boundary.setHours(14, 0, 0, 0);
  } else {
    boundary.setDate(boundary.getDate() + 1);
    boundary.setHours(0, 0, 0, 0);
  }
  return Math.max(1, boundary.getTime() - date.getTime());
}

export function refreshNoondayService({
  date,
  enabled,
  activeService,
  resetForNewLocalDate,
  render,
}) {
  const dateChanged = resetForNewLocalDate(date);
  const service = noondayServiceAt(date, enabled);
  const serviceChanged = activeService !== service;
  if (dateChanged || serviceChanged) render(service);
  return { dateChanged, serviceChanged, service };
}

export function createNoondayBoundaryTimer({
  now = () => new Date(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timer => globalThis.clearTimeout(timer),
  onBoundary,
}) {
  let enabled = false;
  const timer = createBoundaryTimer({
    millisecondsUntilBoundary: millisecondsUntilNoondayBoundary,
    isActive: () => enabled,
    setState(nextEnabled) {
      enabled = Boolean(nextEnabled);
      return enabled;
    },
    now,
    setTimer,
    clearTimer,
    onBoundary,
  });

  return {
    reschedule: timer.reschedule,
    setEnabled: timer.setState,
    stop: timer.stop,
  };
}
