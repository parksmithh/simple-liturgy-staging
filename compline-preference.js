import { createBoundaryTimer } from "./boundary-timer.js?v=staging-f18f79ebcf4e06b14d443fdf719911679985a338";

const STORAGE_KEY = "simple-liturgy.compline-enabled";
const COMPLINE_START_HOUR = 21;
export const COMPLINE_END_HOUR = 4;

export function initializeComplinePreference({ control, storage }) {
  const enabled = storage.getItem(STORAGE_KEY) === "true";
  control.checked = enabled;
  return enabled;
}

export function setComplineEnabled({ control, storage }, enabled) {
  const normalized = Boolean(enabled);
  control.checked = normalized;
  try {
    storage.setItem(STORAGE_KEY, String(normalized));
  } catch {}
  return normalized;
}

export function bindComplinePreference({ control, storage, onChange }) {
  control.addEventListener("change", () => {
    onChange(setComplineEnabled({ control, storage }, control.checked));
  });
}

export function complineServiceAt(date = new Date(), enabled = true) {
  if (!enabled) return "daily";
  const hour = date.getHours();
  return hour >= COMPLINE_START_HOUR || hour < COMPLINE_END_HOUR ? "compline" : "daily";
}

export function complinePreviewRelation(date = new Date()) {
  const compline = new Date(date);
  compline.setHours(21, 0, 0, 0);
  return date < compline ? "future" : "past";
}

function complinePreviewPeriodAt(date = new Date(), enabled = true) {
  if (complineServiceAt(date, enabled) === "compline") return "compline";
  return date.getHours() < 21 ? "before-compline" : "after-compline";
}

export function complinePreviewMarkerAt(date = new Date(), enabled = true) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}:${complinePreviewPeriodAt(date, enabled)}`;
}

export function refreshComplinePreview({
  date,
  marker,
  enabled,
  exit,
  resetForNewLocalDate,
  render,
}) {
  const exited = complinePreviewMarkerAt(date, enabled) !== marker;
  if (exited) exit(date);
  resetForNewLocalDate(date);
  render();
  return { exited };
}

export function shouldShowComplinePreview(date = new Date(), enabled = true) {
  return complineServiceAt(date, enabled) !== "compline";
}

export function millisecondsUntilComplineBoundary(date = new Date()) {
  const boundary = new Date(date);
  if (date.getHours() < COMPLINE_END_HOUR) {
    boundary.setHours(COMPLINE_END_HOUR, 0, 0, 0);
  } else if (date.getHours() < COMPLINE_START_HOUR) {
    boundary.setHours(COMPLINE_START_HOUR, 0, 0, 0);
  } else {
    boundary.setDate(boundary.getDate() + 1);
    boundary.setHours(COMPLINE_END_HOUR, 0, 0, 0);
  }
  return Math.max(1, boundary.getTime() - date.getTime());
}

export function createComplineBoundaryTimer({
  now = () => new Date(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timer => globalThis.clearTimeout(timer),
  onBoundary,
}) {
  let enabled = false;
  const timer = createBoundaryTimer({
    millisecondsUntilBoundary: millisecondsUntilComplineBoundary,
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
