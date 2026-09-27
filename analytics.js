const STORAGE_KEY = "simple-liturgy.analytics-enabled";
const SCRIPT_SELECTOR = "script[data-simple-liturgy-analytics]";
const TRACKER_URL = "";
const WEBSITE_ID = "";
const ENABLED_MESSAGE = "Anonymous analytics are on. At most one anonymous page-view signal is sent when a page opens.";
const DISABLED_MESSAGE = "Analytics are off. No future usage data will be sent from this device.";
const TEMPORARY_ENABLED_MESSAGE = "Anonymous analytics are on for this page, but your browser could not save the choice.";
const TEMPORARY_DISABLED_MESSAGE = "Analytics are off for this page, but your browser could not save the choice.";
const UNAVAILABLE_MESSAGE = "Analytics are off because your browser could not access the saved preference.";
const TRACKED_DOCUMENTS = new WeakSet();

function readPreference(storage) {
  try {
    return storage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return null;
  }
}

function writePreference(storage, enabled) {
  try {
    storage.setItem(STORAGE_KEY, String(enabled));
    return true;
  } catch {
    return false;
  }
}

function statusMessage(enabled) {
  if (enabled) return ENABLED_MESSAGE;
  return DISABLED_MESSAGE;
}

function syncControls(controls, statuses, enabled, overrideMessage = "") {
  controls.forEach(control => { control.checked = enabled; });
  const message = overrideMessage || statusMessage(enabled);
  statuses.forEach(status => { status.textContent = message; });
}

function sendPageview(document, trackerWindow, isEnabled) {
  if (!isEnabled() || TRACKED_DOCUMENTS.has(document)) return;
  const track = trackerWindow.umami?.track;
  if (typeof track !== "function") return;
  track.call(trackerWindow.umami);
  TRACKED_DOCUMENTS.add(document);
}

function loadTracker(document, trackerWindow, isEnabled) {
  if (!TRACKER_URL || !WEBSITE_ID) return null;
  if (!isEnabled() || TRACKED_DOCUMENTS.has(document)) return null;
  const existing = document.querySelector(SCRIPT_SELECTOR);
  if (existing) {
    sendPageview(document, trackerWindow, isEnabled);
    return existing;
  }
  const script = document.createElement("script");
  script.defer = true;
  script.src = TRACKER_URL;
  script.dataset.websiteId = WEBSITE_ID;
  script.dataset.autoTrack = "false";
  script.dataset.doNotTrack = "true";
  script.dataset.excludeSearch = "true";
  script.dataset.excludeHash = "true";
  script.dataset.simpleLiturgyAnalytics = "";
  script.addEventListener("load", () => sendPageview(document, trackerWindow, isEnabled), { once: true });
  document.head.append(script);
  return script;
}

export function initializeAnalytics({ document, storage, trackerWindow }) {
  if (!TRACKER_URL || !WEBSITE_ID) {
    const controls = Array.from(document.querySelectorAll("[data-analytics-toggle]"));
    const statuses = Array.from(document.querySelectorAll("[data-analytics-status]"));
    controls.forEach(control => { control.checked = false; control.disabled = true; });
    statuses.forEach(status => { status.textContent = "Analytics are off on staging."; });
    return false;
  }
  const controls = Array.from(document.querySelectorAll("[data-analytics-toggle]"));
  const statuses = Array.from(document.querySelectorAll("[data-analytics-status]"));
  const preference = readPreference(storage);
  let enabled = preference ?? false;

  syncControls(controls, statuses, enabled, preference === null ? UNAVAILABLE_MESSAGE : "");
  trackerWindow.addEventListener?.("storage", event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const nextPreference = readPreference(storage);
    enabled = nextPreference ?? false;
    syncControls(controls, statuses, enabled, nextPreference === null ? UNAVAILABLE_MESSAGE : "");
    if (enabled) loadTracker(document, trackerWindow, () => enabled);
  });
  loadTracker(document, trackerWindow, () => enabled);

  controls.forEach(control => {
    control.addEventListener("change", () => {
      enabled = control.checked;
      const persisted = writePreference(storage, enabled);
      const temporaryMessage = enabled ? TEMPORARY_ENABLED_MESSAGE : TEMPORARY_DISABLED_MESSAGE;
      syncControls(controls, statuses, enabled, persisted ? "" : temporaryMessage);
      if (enabled) loadTracker(document, trackerWindow, () => enabled);
    });
  });

  return enabled;
}
