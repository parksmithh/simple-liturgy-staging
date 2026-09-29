import { createBoundaryTimer } from "./boundary-timer.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";

const STORAGE_KEY = "simple-liturgy.psalm-display";
const BY_TIME_OF_DAY = "by-time-of-day";
const MODES = new Set(["together", BY_TIME_OF_DAY]);

function updateControls(controls, mode) {
  controls?.forEach(control => {
    control.checked = control.value === mode;
  });
}

export function initializePsalmPreference({ controls, storage }) {
  const saved = storage.getItem(STORAGE_KEY);
  const mode = MODES.has(saved) ? saved : "together";
  updateControls(controls, mode);
  return mode;
}

export function setPsalmDisplayMode({ controls, storage }, mode) {
  if (!MODES.has(mode)) return null;
  updateControls(controls, mode);
  storage.setItem(STORAGE_KEY, mode);
  return mode;
}

export function bindPsalmPreference({ controls, storage, onChange }) {
  controls.forEach(control => control.addEventListener("change", () => {
    if (!control.checked) return;
    const mode = setPsalmDisplayMode({ controls, storage }, control.value);
    if (mode) onChange(mode);
  }));
}

export function psalmOfficeAt(date = new Date()) {
  return date.getHours() < 12 ? "morning" : "evening";
}

export function millisecondsUntilPsalmBoundary(date = new Date()) {
  const boundary = new Date(date);
  if (psalmOfficeAt(date) === "morning") {
    boundary.setHours(12, 0, 0, 0);
  } else {
    boundary.setDate(boundary.getDate() + 1);
    boundary.setHours(0, 0, 0, 0);
  }
  return Math.max(1, boundary.getTime() - date.getTime());
}

export function refreshPsalmDisplay({
  date,
  activeOffice,
  resetForNewLocalDate,
  render,
}) {
  const dateChanged = resetForNewLocalDate(date);
  const officeChanged = activeOffice !== psalmOfficeAt(date);
  if (dateChanged || officeChanged) render();
  return { dateChanged, officeChanged };
}

export function createPsalmBoundaryTimer({
  now = () => new Date(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timer => globalThis.clearTimeout(timer),
  onBoundary,
}) {
  let displayMode = "together";
  const timer = createBoundaryTimer({
    millisecondsUntilBoundary: millisecondsUntilPsalmBoundary,
    isActive: () => displayMode === BY_TIME_OF_DAY,
    setState(mode) {
      displayMode = mode;
      return displayMode;
    },
    now,
    setTimer,
    clearTimer,
    onBoundary,
  });

  return {
    reschedule: timer.reschedule,
    setMode(mode, date = now()) {
      if (!MODES.has(mode)) return false;
      timer.setState(mode, date);
      return true;
    },
    stop: timer.stop,
  };
}
