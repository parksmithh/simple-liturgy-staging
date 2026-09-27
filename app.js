import { initializeAnalytics } from "./analytics.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { controlModel, createState, dateWithOffset, focusPageCounts, focusSwipeEvent, handle, keyboardEvent, lessonValues, LORDS_PRAYER_TEXT, model, numberedLiturgicalTextHtml, paginatePrayerByFit, paginateTimedOfficeByFit, parseBundle, parseCollects, prayerAvailableHeight, prayerLineationHtml, remapFocusPageAfterLayout, resolvePrayer, screenClickDecision, screenHtml, scriptureCitationPresentation, stateAfterDateChange, stateForDate, swipeEvent, timedOfficeAvailableHeight, timedOfficeTextHtml, upcomingFeastDays, usesNumberedVerseLayout } from "./bookmark-engine.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { bindComplinePreference, complinePreviewMarkerAt, complinePreviewRelation, createComplineBoundaryTimer, initializeComplinePreference, refreshComplinePreview, setComplineEnabled, shouldShowComplinePreview } from "./compline-preference.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { createDailyOfficeDayLoader, mergeDailyOfficeContent } from "./daily-office-content.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { composeDailyOffice } from "./daily-office.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { bindFeastLinksPreference, initializeFeastLinks } from "./feast-link-preference.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { createFullOfficePreviewController, fullOfficeLoadingHtml, fullOfficeLoadingService, isFullOfficeService } from "./full-office-lifecycle.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { bindNoondayPreference, createNoondayBoundaryTimer, initializeNoondayPreference, noondayPreviewMarkerAt, noondayPreviewRelation, refreshNoondayPreview, setNoondayEnabled, shouldShowNoondayPreview } from "./noonday-preference.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { localIsoDate, officePeriodAt, scheduledServiceAt, timedOfficePreviewToExit } from "./office-schedule.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { calendarEventIconAssetPath, paintPixelArtStack } from "./pixel-art.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { bindPrayerFormatPreference, initializePrayerFormatPreference } from "./prayer-format-preference.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { bindPsalmPreference, createPsalmBoundaryTimer, initializePsalmPreference, psalmOfficeAt, refreshPsalmDisplay } from "./psalm-preference.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { bindPrayerReminderSettings } from "./prayer-calendar.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { createReadingPackLoader, loadAroundToday, mergeReadingBundle } from "./reading-pack-loader.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { createScripturePackLoader } from "./scripture-pack-loader.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import {
  bindScripturePreference,
  editionForMode,
  initializeScripturePreference,
} from "./scripture-preference.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import {
  applyScriptureToSimpleView,
  applyScriptureToTimedOffice,
  paginateScriptureVersesByFit,
} from "./scripture-reading.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { initializeTheme, setThemeMode, syncSystemTheme } from "./theme.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { createTimedOfficeOnboardingController } from "./timed-office-onboarding.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";
import { appVersionLabel } from "./version.js?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b";

const APP_ROOT = new URL(".", window.location.href);
const CONTENT_ROOT = APP_ROOT.pathname.endsWith("/web/") ? new URL("../", APP_ROOT) : APP_ROOT;
const PACK_URL = new URL("firmware/circuitpython/readings.active.jsonl?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", CONTENT_ROOT);
const PACK_INDEX_URL = new URL("firmware/circuitpython/readings.active.idx?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", CONTENT_ROOT);
const COLLECTS_URL = new URL("data/collects/collects.json?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", CONTENT_ROOT);
const SCRIPTURE_PACK_URLS = {
  engwebp: new URL("data/scripture/engwebp.json?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", CONTENT_ROOT),
  "eng-kjv": new URL("data/scripture/eng-kjv.json?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", CONTENT_ROOT),
};
const FULL_OFFICE_URLS = {
  riteTwo: new URL("data/daily-office/rite-two.json?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", CONTENT_ROOT),
  index: new URL("dor-engine/daily-office-content.index.json?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", APP_ROOT),
  pack: new URL("dor-engine/daily-office-content.active.jsonl?v=staging-fc8142b75c186768a95cae50d74f6b317dfaa38b", APP_ROOT),
};
const DOUBLE_KEY_WINDOW_MS = 500;
const INSTALL_TOOLTIP_SESSION_KEY = "simple-liturgy.install-tooltip-dismissed";
const screen = document.querySelector("#screen");
const installButton = document.querySelector("#install-button");
const installDialog = document.querySelector("#install-dialog");
const settingsPage = document.querySelector("#settings-page");
const reader = document.querySelector(".reader");
const deviceScreen = document.querySelector("#device-screen");
const themeControls = document.querySelectorAll('input[name="theme"]');
const psalmControls = document.querySelectorAll('input[name="psalm-display"]');
const scriptureControls = document.querySelectorAll('input[name="scripture-mode"]');
const prayerFormatControl = document.querySelector("#full-daily-office-enabled");
const previewSimpleMorningButton = document.querySelector("#preview-simple-morning");
const previewSimpleEveningButton = document.querySelector("#preview-simple-evening");
const previewTraditionalMorningButton = document.querySelector("#preview-traditional-morning");
const previewTraditionalEveningButton = document.querySelector("#preview-traditional-evening");
const prayerFormatStatus = document.querySelector("#prayer-format-status");
const retryFullOfficeButton = document.querySelector("#retry-full-office");
const prayerReminderControls = document.querySelectorAll("[data-prayer-office]");
const createPrayerRemindersButton = document.querySelector("#create-prayer-reminders");
const prayerReminderStatus = document.querySelector("#prayer-reminder-status");
const prayerImportHelp = document.querySelector("#prayer-import-help");
const noondayControl = document.querySelector("#noonday-enabled");
const previewNoondayButton = document.querySelector("#preview-noonday");
const complineControl = document.querySelector("#compline-enabled");
const previewComplineButton = document.querySelector("#preview-compline");
const feastLinksControl = document.querySelector("#feast-links-enabled");
const feastBrowser = document.querySelector("#feast-browser");
const feastList = document.querySelector("#feast-list");
const feastListStatus = document.querySelector("#feast-list-status");
const browseFeastDaysButton = document.querySelector("#browse-feast-days");
const closeFeastBrowserButton = document.querySelector("#close-feast-browser");
const readerMenu = document.querySelector("#reader-menu");
const openReaderButton = document.querySelector("#open-reader-button");
const shareButton = document.querySelector("#share-button");
const shareStatus = document.querySelector("#share-status");
const installTooltip = document.querySelector("#install-tooltip");
const appVersion = document.querySelector("#app-version");
const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
const prayerSchedule = bindPrayerReminderSettings({
  controls: prayerReminderControls,
  button: createPrayerRemindersButton,
  status: prayerReminderStatus,
  importHelp: prayerImportHelp,
  storage: window.localStorage,
  appUrl: canonicalUrl,
});
const installedPwa = window.matchMedia("(display-mode: standalone)").matches
  || window.matchMedia("(display-mode: fullscreen)").matches
  || window.navigator.standalone === true;
document.documentElement.classList.toggle("installed-pwa", installedPwa);
if (installedPwa) document.documentElement.dataset.standalone = "";

function isAppleTouchDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// iOS 27 can keep a home-screen bookmark's old black-translucent chrome even
// after the page updates. Sliding a fixed panel once flips WebKit out of the
// wide top scroll-edge blur; leaving the panel off-screen holds that state.
function kickIosPwaTopBlur() {
  if (!installedPwa || !isAppleTouchDevice() || !document.body) return;
  if (document.querySelector(".ios-pwa-blur-panel")) return;

  const cover = document.createElement("div");
  cover.className = "ios-pwa-blur-cover";
  cover.setAttribute("aria-hidden", "true");
  const panel = document.createElement("div");
  panel.className = "ios-pwa-blur-panel";
  panel.setAttribute("aria-hidden", "true");
  document.body.append(cover, panel);
  void panel.offsetWidth;

  requestAnimationFrame(() => {
    cover.classList.add("is-on");
    panel.classList.add("is-in");
    window.setTimeout(() => {
      cover.classList.remove("is-on");
      panel.classList.remove("is-in");
    }, 450);
  });
}
const installTooltipMedia = window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)");
let installTooltipDismissed = false;
try {
  installTooltipDismissed = window.sessionStorage.getItem(INSTALL_TOOLTIP_SESSION_KEY) === "true";
} catch {}
function syncInstallTooltip() {
  document.documentElement.classList.toggle("install-tooltip-active", !installedPwa && installTooltipMedia.matches && !installTooltipDismissed);
}
syncInstallTooltip();
const previousControl = document.querySelector("#previous-control");
const centerControl = document.querySelector("#center-control");
const nextControl = document.querySelector("#next-control");
let state = createState();
let bundle = null;
let collects = null;
let deferredInstall = null;
let pointerStart = null;
let pointerActivated = false;
let suppressReadingTap = false;
let prayerLayout = null;
let lordsPrayerLayout = null;
let timedOfficeLayout = null;
let scriptureLayout = null;
/** @type {Map<string, string[]>} fitted scripture pages keyed by date:focus:mode */
const scripturePageCache = new Map();

function scripturePageCacheKey(date, focus, mode = scriptureMode) {
  return `${date}:${focus}:${mode}`;
}

function rememberScripturePages(date, focus, pages) {
  if (!date || !focus || !pages?.length) return;
  scripturePageCache.set(scripturePageCacheKey(date, focus), pages);
}

function cachedScripturePages(date, focus) {
  return scripturePageCache.get(scripturePageCacheKey(date, focus)) || null;
}
let observedDeviceSize = "";
let activeLocalDate = null;
let activePsalmOffice = null;
let activeService = "daily";
let prayerFormat = "simple";
let fullOfficeContent = null;
let fullOfficeLoad = null;
let fullOfficeHydration = null;
let fullOfficeHydrated = false;
let fullOfficeError = null;
let fullOfficeOfflineError = null;
let fullOfficeOfflineState = "idle";
let fullOfficePreview = null;
let fullOfficePreviewMarker = null;
let simpleOfficePreview = null;
let simpleOfficePreviewMarker = null;
const fullOfficeDocumentCache = new Map();
let noondayPreview = false;
let noondayPreviewMarker = null;
let complinePreview = false;
let complinePreviewMarker = null;
let lastVerticalKey = null;
let lastVerticalKeyAt = -Infinity;
let loadAttempt = 0;
const readingPackLoader = createReadingPackLoader({
  indexUrl: PACK_INDEX_URL,
  packUrl: PACK_URL,
  parseBundle,
});
const scripturePackLoader = createScripturePackLoader({
  urls: {
    engwebp: SCRIPTURE_PACK_URLS.engwebp.href,
    "eng-kjv": SCRIPTURE_PACK_URLS["eng-kjv"].href,
  },
});
const dailyOfficeLoader = createDailyOfficeDayLoader({
  indexUrl: FULL_OFFICE_URLS.index,
  packUrl: FULL_OFFICE_URLS.pack,
  riteTwoUrl: FULL_OFFICE_URLS.riteTwo,
});

function invalidateLayouts() {
  prayerLayout = null;
  lordsPrayerLayout = null;
  timedOfficeLayout = null;
  scriptureLayout = null;
  scripturePageCache.clear();
}

const themeContext = {
  root: document.documentElement,
  controls: themeControls,
  meta: document.querySelector('meta[name="theme-color"]'),
  storage: window.localStorage,
  media: window.matchMedia("(prefers-color-scheme: dark)"),
  styles: window.getComputedStyle.bind(window),
};
const feastLinksContext = { control: feastLinksControl, storage: window.localStorage };
const psalmContext = { controls: psalmControls, storage: window.localStorage };
const scriptureContext = { controls: scriptureControls, storage: window.localStorage };
const noondayContext = { control: noondayControl, storage: window.localStorage };
const complineContext = { control: complineControl, storage: window.localStorage };
const prayerFormatContext = { control: prayerFormatControl, storage: window.localStorage };
const psalmBoundary = createPsalmBoundaryTimer({
  onBoundary: now => refreshAt(now, false),
});
const noondayBoundary = createNoondayBoundaryTimer({
  onBoundary: now => refreshAt(now, false),
});
const complineBoundary = createComplineBoundaryTimer({
  onBoundary: now => refreshAt(now, false),
});

initializeTheme(themeContext);
initializeFeastLinks(feastLinksContext);
appVersion.textContent = appVersionLabel();
let psalmDisplayMode = initializePsalmPreference(psalmContext);
psalmBoundary.setMode("by-time-of-day");
let scriptureMode = initializeScripturePreference(scriptureContext);
let noondayEnabled = initializeNoondayPreference(noondayContext);
let complineEnabled = initializeComplinePreference(complineContext);
prayerFormat = initializePrayerFormatPreference(prayerFormatContext);
scripturePackLoader.prefetchAll().then(() => {
  if (bundle && collects) render();
});
prayerSchedule.setNoondayEnabled(noondayEnabled);
prayerSchedule.setComplineEnabled(complineEnabled);

function scheduleAt(date = new Date()) {
  return scheduledServiceAt(date, {
    format: prayerFormat,
    noondayEnabled,
    complineEnabled,
  });
}

const initialServiceTime = new Date();
activeService = scheduleAt(initialServiceTime);
syncNoondayPreviewButton(initialServiceTime);
syncComplinePreviewButton(initialServiceTime);
noondayBoundary.setEnabled(true, initialServiceTime);
complineBoundary.setEnabled(true, initialServiceTime);
const timedOfficeOnboarding = createTimedOfficeOnboardingController({
  document,
  storage: window.sessionStorage,
  getEnabled: office => office === "noonday" ? noondayEnabled : complineEnabled,
  canOfferAutomatically: () => settingsPage.hidden && !fullOfficePreview && !simpleOfficePreview && !noondayPreview && !complinePreview,
  enableOffice: enableTimedOffice,
});
let initialTimedOfficeOfferConsumed = false;

function offerInitialTimedOfficeOnboarding() {
  if (initialTimedOfficeOfferConsumed) return false;
  initialTimedOfficeOfferConsumed = true;
  return timedOfficeOnboarding.offerAutomatic(initialServiceTime);
}

function hasFullOfficeDate(date) {
  const context = fullOfficeContent?.appointments.contexts[date];
  if (!context) return false;
  return [context.morning_key, context.evening_key].every(key => (
    fullOfficeContent.appointments.appointments[key]
    || fullOfficeContent.appointments.eves[key]
  ));
}

function serviceWithContentFallback(service, date = localIsoDate()) {
  return isFullOfficeService(service) && !hasFullOfficeDate(date) ? "daily" : service;
}

function fullOfficeMarkerAt(date = new Date()) {
  return `${localIsoDate(date)}:${officePeriodAt(date)}`;
}

function syncPrayerFormatStatus() {
  if (fullOfficeLoad) {
    prayerFormatStatus.textContent = "Preparing the Traditional Rite II offices…";
    retryFullOfficeButton.hidden = true;
    return;
  }
  if (fullOfficeError) {
    prayerFormatStatus.textContent = "Traditional Prayer is temporarily unavailable. Simple Prayer will remain active.";
    retryFullOfficeButton.hidden = false;
    return;
  }
  if (fullOfficeOfflineState === "preparing") {
    prayerFormatStatus.textContent = "Traditional Prayer is active; finishing its offline copy…";
    retryFullOfficeButton.hidden = true;
    return;
  }
  if (fullOfficeOfflineError) {
    prayerFormatStatus.textContent = "Traditional Prayer is active online, but its offline copy could not be completed.";
    retryFullOfficeButton.hidden = false;
    return;
  }
  prayerFormatStatus.textContent = prayerFormat === "full"
    ? `Traditional follows the complete Rite II office automatically${
      fullOfficeOfflineState === "ready" ? ", with the offices ready offline." : "."
    }`
    : "Simple keeps the concise prayer-and-readings backbone.";
  retryFullOfficeButton.hidden = true;
}

async function ensureFullOfficeContentForDate(
  date = new Date(),
  { forceRefresh = false } = {},
) {
  const dateString = typeof date === "string" ? date : localIsoDate(date);
  if (hasFullOfficeDate(dateString) && !forceRefresh) return fullOfficeContent;
  const requestCache = forceRefresh || fullOfficeError ? "reload" : "default";
  fullOfficeError = null;
  fullOfficeOfflineError = null;
  if (forceRefresh) fullOfficeHydrated = false;
  const load = dailyOfficeLoader.loadDay(dateString, { requestCache })
    .then(partial => {
      if (fullOfficeContent) mergeDailyOfficeContent(fullOfficeContent, partial);
      else fullOfficeContent = partial;
      fullOfficeError = null;
      fullOfficeDocumentCache.clear();
      return fullOfficeContent;
    })
    .catch(error => {
      fullOfficeError = error;
      syncPrayerFormatStatus();
      throw error;
    });
  fullOfficeLoad = load;
  syncPrayerFormatStatus();
  try {
    return await load;
  } catch {
    return null;
  } finally {
    if (fullOfficeLoad === load) {
      fullOfficeLoad = null;
      syncPrayerFormatStatus();
    }
  }
}

function beginFullOfficeHydration(today) {
  if (fullOfficeHydrated) return Promise.resolve(fullOfficeContent);
  if (fullOfficeHydration) return fullOfficeHydration;
  fullOfficeOfflineError = null;
  fullOfficeOfflineState = "preparing";
  syncPrayerFormatStatus();
  fullOfficeHydration = loadAroundToday(dailyOfficeLoader, today, {
    onDay: (date, partial) => {
      if (fullOfficeContent) mergeDailyOfficeContent(fullOfficeContent, partial);
      else fullOfficeContent = partial;
      fullOfficeDocumentCache.clear();
      if (dateWithOffset(localIsoDate(), state.offset) === date && bundle && collects) render();
    },
  }).then(async completeContent => {
    if (completeContent) {
      fullOfficeContent = completeContent;
      fullOfficeHydrated = true;
      fullOfficeDocumentCache.clear();
      if (bundle && collects) render();
    }
    try {
      const offlineReady = await cacheFullOfficeForOfflineUse();
      fullOfficeOfflineState = offlineReady ? "ready" : "unsupported";
    } catch (error) {
      fullOfficeOfflineState = "error";
      fullOfficeOfflineError = error;
    }
    return fullOfficeContent;
  }).catch(error => {
    fullOfficeOfflineState = "error";
    fullOfficeOfflineError = error;
    return fullOfficeContent;
  }).finally(() => {
    fullOfficeHydration = null;
    syncPrayerFormatStatus();
  });
  return fullOfficeHydration;
}

function prepareScheduledFullOffice(date = new Date()) {
  if (!isFullOfficeService(scheduleAt(date))) return;
  const today = localIsoDate(date);
  ensureFullOfficeContentForDate(today).then(content => {
    if (bundle && collects) render();
    if (!content) return;
    beginFullOfficeHydration(today);
  });
}

function fullOfficeDocument(service, date) {
  const cacheKey = `${service}:${date}`;
  if (fullOfficeDocumentCache.has(cacheKey)) return fullOfficeDocumentCache.get(cacheKey);
  const day = bundle?.dates.get(date);
  const reading = day ? bundle?.readings.get(day.key) : null;
  const collect = resolvePrayer(collects, day);
  if (!day || !reading || !collect || !hasFullOfficeDate(date)) return null;
  const dailyLessons = lessonValues(reading.lessons);
  const morningLessonCitations = [dailyLessons.OT, dailyLessons.NT, dailyLessons.GS]
    .filter(citation => citation && citation !== "-");
  const document = composeDailyOffice({
    service,
    date,
    day,
    collect,
    riteTwo: fullOfficeContent.riteTwo,
    psalter: fullOfficeContent.psalter,
    appointments: fullOfficeContent.appointments,
    lessonCitations: service === "morning" ? morningLessonCitations : null,
  });
  fullOfficeDocumentCache.set(cacheKey, document);
  while (fullOfficeDocumentCache.size > 8) {
    fullOfficeDocumentCache.delete(fullOfficeDocumentCache.keys().next().value);
  }
  return document;
}

function syncNoondayPreviewButton(date = new Date()) {
  previewNoondayButton.hidden = !shouldShowNoondayPreview(date, noondayEnabled);
}

function syncComplinePreviewButton(date = new Date()) {
  previewComplineButton.hidden = !shouldShowComplinePreview(date, complineEnabled);
}

function exitNoondayPreview(now = new Date()) {
  if (!noondayPreview) return;
  noondayPreview = false;
  noondayPreviewMarker = null;
  activateService(scheduleAt(now));
}

function exitComplinePreview(now = new Date()) {
  if (!complinePreview) return;
  complinePreview = false;
  complinePreviewMarker = null;
  activateService(scheduleAt(now));
}

function exitFullOfficePreview(now = new Date()) {
  if (!fullOfficePreview) return;
  fullOfficePreview = null;
  fullOfficePreviewMarker = null;
  activateService(scheduleAt(now));
}

function exitSimpleOfficePreview(now = new Date()) {
  if (!simpleOfficePreview) return;
  simpleOfficePreview = null;
  simpleOfficePreviewMarker = null;
  activateService(scheduleAt(now));
}

function setSettingsOpen(open) {
  if (open) {
    fullOfficePreviewController.cancel();
    exitFullOfficePreview();
    exitSimpleOfficePreview();
    exitNoondayPreview();
    exitComplinePreview();
    syncNoondayPreviewButton();
    syncComplinePreviewButton();
    syncPrayerFormatStatus();
  }
  document.documentElement.classList.toggle("settings-open", open);
  settingsPage.hidden = !open;
  reader.hidden = open;
  invalidateLayouts();
  setFeastBrowserOpen(false, { focus: false, scroll: false });
  if (open) {
    window.scrollTo({ top: 0, behavior: "auto" });
    openReaderButton.focus({ preventScroll: true });
    return;
  }
  render();
  readerMenu.focus({ preventScroll: true });
}

syncPrayerFormatStatus();
prepareScheduledFullOffice(initialServiceTime);

const feastDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function renderFeastList() {
  const today = localIsoDate();
  feastList.replaceChildren();
  if (!bundle) {
    feastListStatus.textContent = "Feast days will appear when the readings finish loading.";
    return;
  }

  const days = upcomingFeastDays(bundle, today);
  const fragment = document.createDocumentFragment();
  let yearItems = null;
  let activeYear = null;
  for (const day of days) {
    const year = day.date.slice(0, 4);
    if (year !== activeYear) {
      activeYear = year;
      const group = document.createElement("section");
      const heading = document.createElement("h3");
      yearItems = document.createElement("div");
      heading.className = "feast-year-title";
      heading.id = `feast-year-${year}`;
      heading.textContent = year;
      yearItems.className = "feast-year-items";
      group.className = "feast-year-group";
      group.setAttribute("aria-labelledby", heading.id);
      group.append(heading, yearItems);
      fragment.append(group);
    }

    const button = document.createElement("button");
    const iconFrame = document.createElement("span");
    const dateLabel = document.createElement("span");
    const time = document.createElement("time");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const arrow = document.createElement("span");
    button.className = "feast-list-item";
    button.type = "button";
    button.dataset.feastDate = day.date;
    iconFrame.className = "feast-list-icon";
    iconFrame.setAttribute("aria-hidden", "true");
    const iconPath = calendarEventIconAssetPath(bundle.dates.get(day.date));
    if (iconPath) {
      const icon = document.createElement("img");
      icon.src = new URL(iconPath, import.meta.url).href;
      icon.alt = "";
      icon.draggable = false;
      icon.decoding = "async";
      icon.loading = "lazy";
      iconFrame.append(icon);
    }
    dateLabel.className = "feast-list-date";
    time.dateTime = day.date;
    time.textContent = `${day.date === today ? "Today · " : ""}${feastDateFormatter.format(new Date(`${day.date}T12:00:00Z`))}`;
    copy.className = "feast-list-copy";
    title.textContent = day.title;
    detail.textContent = `${day.kind} · ${day.season}`;
    arrow.className = "feast-list-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    dateLabel.append(time);
    copy.append(title, detail);
    button.append(iconFrame, dateLabel, copy, arrow);
    yearItems.append(button);
  }
  feastList.append(fragment);
  feastListStatus.textContent = days.length
    ? `Showing ${days.length} upcoming dates through ${days.at(-1).date.slice(0, 4)}.`
    : "There are no more feast days in the installed calendar pack.";
}

function setFeastBrowserOpen(open, { focus = true, scroll = true } = {}) {
  settingsPage.classList.toggle("feast-browser-open", open);
  feastBrowser.hidden = !open;
  if (open) renderFeastList();
  if (scroll) window.scrollTo({ top: 0, behavior: "auto" });
  if (focus) (open ? closeFeastBrowserButton : browseFeastDaysButton).focus({ preventScroll: true });
}

function deviceSize() {
  return `${deviceScreen.clientWidth}x${deviceScreen.clientHeight}`;
}

function matchingPrayerLayout(view) {
  if (view.focus === "LORDS_PRAYER") return null;
  if (view.service !== "daily" || prayerLayout?.date !== view.date || prayerLayout.deviceSize !== deviceSize()) return null;
  return prayerLayout;
}

function matchingLordsPrayerLayout(view) {
  if (view.service !== "daily" || view.focus !== "LORDS_PRAYER") return null;
  if (lordsPrayerLayout?.date !== view.date || lordsPrayerLayout.deviceSize !== deviceSize()) return null;
  return lordsPrayerLayout;
}

function measuredTimedOfficePages(view) {
  if (!["morning", "evening", "noonday", "compline"].includes(view.service)
    || timedOfficeLayout?.date !== view.date
    || timedOfficeLayout.service !== view.service
    || timedOfficeLayout.deviceSize !== deviceSize()) return {};
  return { [timedOfficeLayout.focus]: timedOfficeLayout.pages };
}

function matchingTimedOfficeLayout(view) {
  return measuredTimedOfficePages(view)[view.focus] ? timedOfficeLayout : null;
}

function measuredScripturePages(view) {
  if (view.service !== "daily"
    || !["OT", "NT", "GS"].includes(view.focus)
    || scriptureLayout?.date !== view.date
    || scriptureLayout.focus !== view.focus
    || scriptureLayout.deviceSize !== deviceSize()) return {};
  return { [scriptureLayout.focus]: scriptureLayout.pages };
}

function matchingScriptureLayout(view) {
  return measuredScripturePages(view)[view.focus] ? scriptureLayout : null;
}

function resetForNewLocalDate(date = new Date()) {
  const currentDate = localIsoDate(date);
  if (activeLocalDate === null) {
    activeLocalDate = currentDate;
    return false;
  }
  const nextState = stateAfterDateChange(state, activeLocalDate, currentDate);
  if (nextState === state) return false;
  activeLocalDate = currentDate;
  state = nextState;
  invalidateLayouts();
  return true;
}

function scripturePackForMode(mode = scriptureMode) {
  const edition = editionForMode(mode);
  return edition ? scripturePackLoader.getCached(edition) : null;
}

function withScripture(view) {
  if (!view || view.error) return view;
  const pack = scripturePackForMode();
  const options = { scriptureMode, pack };
  if (view.service === "daily") {
    let next = applyScriptureToSimpleView(view, options);
    if (!next.scripturePages) return next;
    const scripturePages = { ...next.scripturePages };
    for (const key of Object.keys(scripturePages)) {
      const cached = cachedScripturePages(next.date, key);
      if (!cached?.length || scripturePages[key].unavailable) continue;
      scripturePages[key] = { ...scripturePages[key], pages: cached };
    }
    if (
      scriptureLayout
      && scriptureLayout.date === next.date
      && scriptureLayout.focus === next.focus
      && next.scripturePages?.[next.focus]
      && !next.scripturePages[next.focus].unavailable
    ) {
      scripturePages[next.focus] = {
        ...scripturePages[next.focus],
        pages: scriptureLayout.pages,
      };
    }
    return { ...next, scripturePages };
  }
  if (view.service === "morning" || view.service === "evening") {
    let office = applyScriptureToTimedOffice(view.office, options);
    if (
      timedOfficeLayout
      && timedOfficeLayout.date === view.date
      && timedOfficeLayout.service === view.service
      && timedOfficeLayout.focus === view.focus
      && office?.sections?.[view.focus]?.scriptureVerses
    ) {
      office = {
        ...office,
        sections: {
          ...office.sections,
          [view.focus]: {
            ...office.sections[view.focus],
            pages: timedOfficeLayout.pages,
          },
        },
      };
    }
    return { ...view, office, [view.service]: office };
  }
  return view;
}

function remapFocusAfterScriptureChange() {
  if (!bundle || !collects) return;
  const view = currentView();
  const counts = focusPageCounts(view, {
    ...measuredTimedOfficePages(view),
    ...measuredScripturePages(view),
  });
  if (state.focus && counts[state.focus] != null) {
    state = {
      ...state,
      focusPage: Math.min(state.focusPage || 0, Math.max(0, counts[state.focus] - 1)),
    };
  }
  render();
}

function currentView() {
  const now = new Date();
  const today = localIsoDate(now);
  const requestedService = requestedServiceAt(now);
  const selectedDate = dateWithOffset(today, state.offset);
  const service = serviceWithContentFallback(requestedService, selectedDate);
  if (service !== activeService) activateService(service);
  const viewOptions = {
    service,
    officeDocument: isFullOfficeService(service)
      ? fullOfficeDocument(service, selectedDate)
      : null,
    noondayPreviewRelation: noondayPreview ? noondayPreviewRelation(now) : null,
    complinePreviewRelation: complinePreview ? complinePreviewRelation(now) : null,
  };
  const baseView = withScripture(model(bundle, state, today, collects, viewOptions));
  const prayer = matchingPrayerLayout(baseView);
  if (prayer) {
    return withScripture(model(bundle, state, today, collects, {
      ...viewOptions,
      prayerPages: prayer.pages,
    }));
  }
  const layout = matchingTimedOfficeLayout(baseView);
  if (layout) {
    const pageOption = isFullOfficeService(service)
      ? "officePages"
      : service === "compline"
        ? "complinePages"
        : "noondayPages";
    return withScripture(model(bundle, state, today, collects, {
      ...viewOptions,
      [pageOption]: { [baseView.focus]: layout.pages },
    }));
  }
  return baseView;
}

function requestedServiceAt(date = new Date()) {
  return fullOfficePreview || (simpleOfficePreview
    ? "daily"
    : noondayPreview
      ? "noonday"
      : complinePreview
        ? "compline"
        : scheduleAt(date));
}

function paint(view) {
  reader.classList.toggle("focus-mode", Boolean(view.focus));
  deviceScreen.classList.toggle("has-feast", Boolean(view.feast));
  const feastLinksEnabled = feastLinksControl.checked;
  const psalmOffice = simpleOfficePreview || psalmOfficeAt();
  const previousArtStack = screen.querySelector(".pixel-art-stack");
  screen.innerHTML = screenHtml(view, { feastLinksEnabled, psalmDisplayMode, psalmOffice });
  const loadingService = fullOfficeLoadingService({
    focus: view.focus,
    requestedService: requestedServiceAt(),
    hasContent: hasFullOfficeDate(view.date),
    loading: Boolean(fullOfficeLoad),
  });
  reader.classList.toggle("full-office-loading-active", Boolean(loadingService));
  [previousControl, centerControl, nextControl].forEach(button => {
    button.disabled = Boolean(loadingService);
  });
  if (loadingService) {
    screen.insertAdjacentHTML("beforeend", fullOfficeLoadingHtml(loadingService));
  }
  activeService = view.service || "daily";
  activePsalmOffice = view.service === "daily" ? psalmOffice : null;
  const layout = matchingLordsPrayerLayout(view)
    || matchingScriptureLayout(view)
    || matchingPrayerLayout(view)
    || matchingTimedOfficeLayout(view);
  if (layout?.fontSize) {
    const text = view.focus === "LORDS_PRAYER"
      ? screen.querySelector(".lords-prayer-text")
      : ["OT", "NT", "GS"].includes(view.focus)
        ? screen.querySelector(".scripture-lesson-text")
        : screen.querySelector(".prayer-text");
    text?.style.setProperty("font-size", `${layout.fontSize}px`);
  }
  paintPixelArtStack(screen, view, previousArtStack);
  controlModel(view).forEach((control, index) => {
    const button = [previousControl, centerControl, nextControl][index];
    button.dataset.event = control.event;
    button.querySelector("kbd").textContent = control.key;
    button.querySelector("span").textContent = control.label;
    button.setAttribute("aria-label", control.label);
  });
}

function appendMeasuredContent(probe, candidate) {
  const startsWithEllipsis = candidate.startsWith("...");
  const endsWithEllipsis = candidate.endsWith("...");
  const start = startsWithEllipsis ? 3 : 0;
  const end = endsWithEllipsis ? -3 : undefined;
  const content = candidate.slice(start, end);
  const nodes = [];
  if (startsWithEllipsis) {
    const prefix = document.createElement("span");
    prefix.className = "continuation-ellipsis";
    prefix.textContent = "...";
    nodes.push(prefix);
  }
  nodes.push(document.createTextNode(content));
  if (endsWithEllipsis) {
    const suffix = document.createElement("span");
    suffix.className = "continuation-ellipsis";
    suffix.textContent = "...";
    nodes.push(suffix);
  }
  probe.replaceChildren(...nodes);
}

function largestWholePrayerFont(
  probe,
  prayer,
  availableHeight,
  preferredFontSize,
  renderCandidate = appendMeasuredContent,
  minimumFontSize = Math.min(16, preferredFontSize),
  allowGrow = true,
) {
  const floor = Math.min(minimumFontSize, preferredFontSize);
  const grownCeiling = Math.max(Math.floor(preferredFontSize), Math.min(52, Math.floor(availableHeight / 2)));
  const maximumFontSize = allowGrow ? grownCeiling : Math.floor(preferredFontSize);
  for (let fontSize = maximumFontSize; fontSize >= floor; fontSize -= 1) {
    probe.style.fontSize = `${fontSize}px`;
    renderCandidate(probe, prayer);
    if (probe.scrollHeight <= availableHeight + 0.5) return fontSize;
  }
  return null;
}

function renderTimedOfficeCandidate(probe, candidate, hasNumberedVerses) {
  if (hasNumberedVerses) probe.innerHTML = numberedLiturgicalTextHtml(candidate);
  else probe.innerHTML = timedOfficeTextHtml(candidate);
}

function createMeasurementProbe(text, textStyle, width) {
  const probe = text.cloneNode(false);
  probe.classList.add("prayer-measure");
  probe.style.width = `${width}px`;
  probe.style.fontFamily = textStyle.fontFamily;
  deviceScreen.append(probe);
  return probe;
}

function measuredTimedOfficeTextArea(focus, text, focusStyle, reservedFooterHeight) {
  const focusRect = focus.getBoundingClientRect();
  const textRect = text.getBoundingClientRect();
  return {
    height: timedOfficeAvailableHeight({
      focusBottom: focusRect.bottom,
      paddingBottom: parseFloat(focusStyle.paddingBottom),
      textTop: textRect.top,
      reservedFooterHeight,
    }),
    width: textRect.width,
  };
}

function measuredTimedOfficeTextAreas(
  focus,
  text,
  section,
  focusStyle,
  isPsalm,
  reservedFooterHeight,
  citation,
  scriptureHeading,
) {
  const scriptureMetadata = scriptureHeading
    ? [[".timed-office-scripture-heading", scriptureHeading, "focus-cite timed-office-scripture-heading"]]
    : [];
  const metadata = section.heading
    ? [
      [".timed-office-section-title", section.heading, "timed-office-section-title"],
      [".noonday-subtitle", section.subtitle, "noonday-subtitle timed-office-section-subtitle"],
      [".focus-cite", citation, "focus-cite timed-office-section-cite"],
      ...scriptureMetadata,
    ]
    : [
      [".focus-cite", citation, `focus-cite${isPsalm ? " noonday-psalm-cite" : ""}`],
      [".noonday-subtitle", section.subtitle, "noonday-subtitle"],
      ...scriptureMetadata,
    ];
  const temporaryElements = [];
  const elements = metadata
    .filter(([, value]) => value)
    .map(([selector, value, className]) => {
      const existing = focus.querySelector(selector);
      if (existing) return existing;
      const element = document.createElement("span");
      element.className = className;
      element.textContent = value;
      element.style.visibility = "hidden";
      focus.insertBefore(element, text);
      temporaryElements.push(element);
      return element;
    });
  const originalDisplays = elements.map(element => element.style.display);
  const label = focus.querySelector(".label");
  const savedLabelText = label?.textContent;
  try {
    const firstPage = measuredTimedOfficeTextArea(
      focus,
      text,
      focusStyle,
      reservedFooterHeight,
    );
    elements.forEach(element => {
      element.style.display = "none";
    });
    if (label && citation && (section.numberedVerses || section.scriptureVerses)) {
      label.textContent = `${citation} (2/9)`;
    }
    return [
      firstPage,
      measuredTimedOfficeTextArea(focus, text, focusStyle, reservedFooterHeight),
    ];
  } finally {
    elements.forEach((element, index) => {
      element.style.display = originalDisplays[index];
    });
    if (label && savedLabelText != null) label.textContent = savedLabelText;
    temporaryElements.forEach(element => element.remove());
  }
}

function measuredTimedOfficeLayout(view) {
  const section = (view[view.service] || view.office || view.noonday || view.compline)?.sections?.[view.focus];
  const focus = screen.querySelector(".noonday-focus");
  const text = screen.querySelector(".noonday-text");
  if (!section?.pages || !focus || !text) return null;
  const isOpening = view.focus?.endsWith("_OPENING");
  const isConclusion = view.focus?.endsWith("_CONCLUSION");
  const scripturePresentation = scriptureCitationPresentation(section.footnote);

  let temporaryResponse = null;
  if (section.response && !focus.querySelector(".noonday-response")) {
    temporaryResponse = document.createElement("span");
    temporaryResponse.className = "noonday-response";
    temporaryResponse.textContent = section.response;
    temporaryResponse.style.visibility = "hidden";
    focus.append(temporaryResponse);
  }
  let temporaryScriptureCitation = null;
  const renderedScriptureCitation = focus.querySelector(
    ".timed-office-scripture-heading, .timed-office-scripture-footnote",
  );
  const reserveScriptureCitation = scripturePresentation === "footnote" || isConclusion;
  if (reserveScriptureCitation && section.footnote && !renderedScriptureCitation) {
    temporaryScriptureCitation = document.createElement("span");
    temporaryScriptureCitation.className = `focus-cite timed-office-scripture-${scripturePresentation}`;
    temporaryScriptureCitation.textContent = scripturePresentation === "footnote"
      ? `– ${section.footnote}`
      : section.footnote;
    temporaryScriptureCitation.style.visibility = "hidden";
    focus.append(temporaryScriptureCitation);
  }

  const focusStyle = getComputedStyle(focus);
  const textStyle = getComputedStyle(text);
  const reservedFooterElements = [
    ...focus.querySelectorAll(".noonday-response"),
    ...focus.querySelectorAll(".timed-office-scripture-footnote"),
    ...(temporaryScriptureCitation ? [temporaryScriptureCitation] : []),
  ];
  const reservedFooterHeight = reservedFooterElements.reduce((total, element) => {
    const style = getComputedStyle(element);
    return total
      + element.getBoundingClientRect().height
      + parseFloat(style.marginTop || 0)
      + parseFloat(style.marginBottom || 0);
  }, 0);
  const isPsalm = /_PSALMS?$/.test(view.focus || "");
  const hasNumberedVerses = usesNumberedVerseLayout(section, view.focus || "");
  const citation = view.focus?.endsWith("_PSALMS") ? null : section.citation;
  const scriptureHeading = isOpening && scripturePresentation === "heading"
    ? section.footnote
    : null;
  const hasFirstPageMetadata = Boolean(
    section.heading
    || section.subtitle
    || citation
    || scriptureHeading
  );
  const textAreas = hasFirstPageMetadata
    ? measuredTimedOfficeTextAreas(
      focus,
      text,
      section,
      focusStyle,
      isPsalm,
      reservedFooterHeight,
      citation,
      scriptureHeading,
    )
    : [measuredTimedOfficeTextArea(focus, text, focusStyle, reservedFooterHeight)];
  if (textAreas.some(area => area.height <= 0 || area.width <= 0)) {
    temporaryResponse?.remove();
    temporaryScriptureCitation?.remove();
    return null;
  }

  const probe = createMeasurementProbe(text, textStyle, textAreas[0].width);
  const renderCandidate = (element, candidate) => renderTimedOfficeCandidate(
    element,
    candidate,
    hasNumberedVerses,
  );
  try {
    const preferredFontSize = parseFloat(textStyle.fontSize);
    if (section.preservePages) return { pages: section.pages, fontSize: preferredFontSize };
    const pageHeights = textAreas.map(area => hasNumberedVerses
      ? Math.max(0, area.height - Math.ceil(preferredFontSize * 0.5))
      : area.height);

    probe.style.fontSize = `${preferredFontSize}px`;
    const fits = (candidate, pageIndex) => {
      renderCandidate(probe, candidate);
      return probe.scrollHeight <= pageHeights[Math.min(pageIndex, pageHeights.length - 1)];
    };
    const textPages = section.scriptureVerses?.length
      ? paginateScriptureVersesByFit(section.scriptureVerses, fits)
      : paginateTimedOfficeByFit(
        section.pageGroups || [{ text: section.text }],
        fits,
        { preserveNumberedCallResponse: hasNumberedVerses },
      );
    const pages = section.closingPage ? [...textPages, section.closingPage] : textPages;
    if (section.scriptureVerses?.length) {
      rememberScripturePages(view.date, view.focus, textPages);
    }
    return { pages, fontSize: preferredFontSize };
  } finally {
    probe.remove();
    temporaryResponse?.remove();
    temporaryScriptureCitation?.remove();
  }
}

function renderLordsPrayerCandidate(probe, html) {
  probe.innerHTML = html;
}

function measuredLordsPrayerLayout() {
  const focus = screen.querySelector(".prayer-focus");
  const text = screen.querySelector(".lords-prayer-text");
  const label = focus?.querySelector(".label");
  if (!focus || !text || !label) return null;

  const focusStyle = getComputedStyle(focus);
  const textStyle = getComputedStyle(text);
  const availableHeight = prayerAvailableHeight({
    focusHeight: focus.getBoundingClientRect().height,
    paddingTop: parseFloat(focusStyle.paddingTop),
    paddingBottom: parseFloat(focusStyle.paddingBottom),
    labelHeight: label.getBoundingClientRect().height,
    textMarginTop: parseFloat(textStyle.marginTop),
  });
  const textWidth = text.getBoundingClientRect().width;
  if (availableHeight <= 0 || textWidth <= 0) return null;

  const probe = createMeasurementProbe(text, textStyle, textWidth);
  try {
    const maximumFontSize = parseFloat(textStyle.fontSize);
    const html = prayerLineationHtml(LORDS_PRAYER_TEXT);
    const fontSize = largestWholePrayerFont(
      probe,
      html,
      availableHeight,
      maximumFontSize,
      renderLordsPrayerCandidate,
      12,
      false,
    );
    return { fontSize: fontSize ?? 12 };
  } finally {
    probe.remove();
  }
}

function measuredPrayerLayout(view) {
  const focus = screen.querySelector(".prayer-focus");
  const text = screen.querySelector(".prayer-text");
  const label = focus?.querySelector(".label");
  const feastAbout = focus?.querySelector(".feast-about-link");
  if (!focus || !text || !label) return null;

  const focusStyle = getComputedStyle(focus);
  const textStyle = getComputedStyle(text);
  const feastAboutStyle = feastAbout ? getComputedStyle(feastAbout) : null;
  const focusHeight = focus.getBoundingClientRect().height;
  const labelHeight = label.getBoundingClientRect().height;
  const availableHeight = prayerAvailableHeight({
    focusHeight,
    paddingTop: parseFloat(focusStyle.paddingTop),
    paddingBottom: parseFloat(focusStyle.paddingBottom),
    labelHeight,
    textMarginTop: parseFloat(textStyle.marginTop),
    feastLinkHeight: feastAbout?.getBoundingClientRect().height || 0,
    feastLinkMarginTop: feastAboutStyle ? parseFloat(feastAboutStyle.marginTop) : 0,
    feastLinkMarginBottom: feastAboutStyle ? parseFloat(feastAboutStyle.marginBottom) : 0,
  });
  const textWidth = text.getBoundingClientRect().width;
  if (availableHeight <= 0 || textWidth <= 0) return null;

  const probe = createMeasurementProbe(text, textStyle, textWidth);
  try {
    const maximumFontSize = parseFloat(textStyle.fontSize);
    const wholePrayerFont = largestWholePrayerFont(probe, view.prayer.text, availableHeight, maximumFontSize);
    if (wholePrayerFont !== null) return { pages: [view.prayer.text], fontSize: wholePrayerFont };

    probe.style.fontSize = `${maximumFontSize}px`;
    const pages = paginatePrayerByFit(view.prayer.text, candidate => {
      appendMeasuredContent(probe, candidate);
      return probe.scrollHeight <= availableHeight + 0.5;
    });
    return { pages, fontSize: maximumFontSize };
  } finally {
    probe.remove();
  }
}

function measuredScriptureSimpleLayout(view) {
  const built = view.scripturePages?.[view.focus];
  if (!built?.verses?.length || built.unavailable) return null;
  const focus = screen.querySelector(".prayer-focus, .reading.focus");
  const text = screen.querySelector(".scripture-lesson-text");
  if (!focus || !text) return null;

  const focusStyle = getComputedStyle(focus);
  const textStyle = getComputedStyle(text);
  const citationText = built.citation || view.values?.[view.focus] || "Citation";
  const temporary = [];
  let label = focus.querySelector(".label");
  let citation = focus.querySelector(".focus-cite");
  // Reserve first-page chrome (section label + citation) and continuation chrome
  // (citation-as-title label) even when measuring from the other page.
  if (!label) {
    label = document.createElement("span");
    label.className = "label";
    label.style.visibility = "hidden";
    focus.insertBefore(label, text);
    temporary.push(label);
  }
  if (!citation) {
    citation = document.createElement("span");
    citation.className = "focus-cite";
    citation.style.visibility = "hidden";
    focus.insertBefore(citation, text);
    temporary.push(citation);
  }
  const saved = {
    labelText: label.textContent,
    labelDisplay: label.style.display,
    citeText: citation.textContent,
    citeDisplay: citation.style.display,
  };
  const measure = () => measuredTimedOfficeTextArea(focus, text, focusStyle, 0);
  let textAreas;
  try {
    label.style.display = "";
    label.textContent = "Old Testament (1/9)";
    citation.style.display = "";
    citation.textContent = citationText;
    const firstPage = measure();

    citation.style.display = "none";
    label.textContent = `${citationText} (2/9)`;
    const continuation = measure();
    textAreas = [firstPage, continuation];
  } finally {
    label.textContent = saved.labelText;
    label.style.display = saved.labelDisplay;
    citation.textContent = saved.citeText;
    citation.style.display = saved.citeDisplay;
    temporary.forEach(element => element.remove());
  }
  if (textAreas.some(area => area.height <= 0 || area.width <= 0)) return null;

  const preferredFontSize = parseFloat(textStyle.fontSize);
  const pageHeights = textAreas.map(area => Math.max(0, area.height - Math.ceil(preferredFontSize * 0.5)));
  const probe = createMeasurementProbe(text, textStyle, textAreas[0].width);
  probe.style.fontSize = `${preferredFontSize}px`;
  try {
    const pages = paginateScriptureVersesByFit(built.verses, (candidate, pageIndex) => {
      probe.innerHTML = numberedLiturgicalTextHtml(candidate);
      return probe.scrollHeight <= pageHeights[Math.min(pageIndex, pageHeights.length - 1)];
    });
    return { pages, fontSize: preferredFontSize };
  } finally {
    probe.remove();
  }
}

function render({ previousTimedOfficePages = null } = {}) {
  if (!bundle || !collects) return;
  resetForNewLocalDate();
  let view = currentView();
  paint(view);
  if (view.focus === "LORDS_PRAYER") {
    const layout = measuredLordsPrayerLayout();
    if (!layout?.fontSize) return;
    const previousLayout = lordsPrayerLayout;
    const fontChanged = previousLayout?.fontSize !== layout.fontSize;
    lordsPrayerLayout = { date: view.date, deviceSize: deviceSize(), ...layout };
    if (!fontChanged) return;
    view = currentView();
    paint(view);
    return;
  }
  const measuringPrayer = Boolean(view.focus === "PRAYER" && view.prayer);
  const measuringSimpleScripture = Boolean(
    view.service === "daily"
    && ["OT", "NT", "GS"].includes(view.focus)
    && view.scripturePages?.[view.focus]?.verses?.length
    && !view.scripturePages[view.focus].unavailable
    && !(
      scriptureLayout?.date === view.date
      && scriptureLayout.focus === view.focus
      && scriptureLayout.deviceSize === deviceSize()
      && cachedScripturePages(view.date, view.focus)?.length
    ),
  );
  const layout = measuringPrayer
    ? measuredPrayerLayout(view)
    : measuringSimpleScripture
      ? measuredScriptureSimpleLayout(view)
      : measuredTimedOfficeLayout(view);
  if (!layout?.pages.length) return;
  const { pages } = layout;
  const section = measuringPrayer
    ? view.prayer
    : measuringSimpleScripture
      ? view.scripturePages[view.focus]
      : (view[view.service] || view.office || view.noonday || view.compline).sections[view.focus];
  const changed = pages.length !== section.pages.length || pages.some((page, index) => page !== section.pages[index]);
  const previousLayout = measuringPrayer
    ? prayerLayout
    : measuringSimpleScripture
      ? scriptureLayout
      : timedOfficeLayout;
  const fontChanged = previousLayout?.fontSize !== layout.fontSize;
  const measuredLayout = { date: view.date, deviceSize: deviceSize(), ...layout };
  if (measuringPrayer) prayerLayout = measuredLayout;
  else if (measuringSimpleScripture) {
    scriptureLayout = { focus: view.focus, ...measuredLayout };
    rememberScripturePages(view.date, view.focus, pages);
  } else {
    timedOfficeLayout = { service: view.service, focus: view.focus, ...measuredLayout };
  }
  if (!changed && !fontChanged) return;
  state.focusPage = remapFocusPageAfterLayout(
    state.focusPage,
    previousTimedOfficePages || section.pages,
    pages,
    section.closingPage,
  );
  view = currentView();
  paint(view);
}

function dispatch(event) {
  if (resetForNewLocalDate()) return render();
  const view = currentView();
  const nextState = handle(state, event, {
    focusPageCounts: focusPageCounts(view, {
      ...measuredTimedOfficePages(view),
      ...measuredScripturePages(view),
    }),
    focusOrder: view.focusOrder,
  });
  if (nextState === state) return;
  state = nextState;
  const targetDate = dateWithOffset(localIsoDate(), state.offset);
  const requestedService = requestedServiceAt();
  const needsReadings = !bundle.dates.has(targetDate);
  const needsFullOffice = isFullOfficeService(requestedService) && !hasFullOfficeDate(targetDate);
  if (needsReadings || needsFullOffice) {
    const targetBundle = bundle;
    const targetOffset = state.offset;
    screen.textContent = needsFullOffice ? "Loading Daily Office…" : "Loading readings…";
    Promise.all([
      needsReadings ? readingPackLoader.loadDay(targetDate) : null,
      needsFullOffice ? ensureFullOfficeContentForDate(targetDate) : fullOfficeContent,
    ])
      .then(([partial, content]) => {
        if (bundle !== targetBundle) return;
        if (partial) mergeReadingBundle(bundle, partial);
        if (needsFullOffice && !content) {
          throw fullOfficeError || new Error(`Daily Office for ${targetDate} is unavailable`);
        }
        if (state.offset === targetOffset) render();
      })
      .catch(error => {
        if (bundle === targetBundle && state.offset === targetOffset) showLoadError(error);
      });
    return;
  }
  render();
}

function showLoadError(error) {
  reader.classList.remove("focus-mode");
  deviceScreen.classList.remove("has-feast");
  const title = document.createElement("b");
  const detail = document.createElement("div");
  const retry = document.createElement("button");
  title.textContent = "READINGS UNAVAILABLE";
  detail.className = "meta";
  detail.textContent = String(error.message || error);
  retry.className = "warning";
  retry.id = "retry-load";
  retry.type = "button";
  retry.textContent = "RETRY";
  retry.addEventListener("click", loadPack);
  screen.replaceChildren(title, detail, retry);
}

function cacheCompletePackForOfflineUse() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then(registration => registration.active?.postMessage({ type: "CACHE_COMPLETE_READING_PACK" }))
    .catch(() => {});
}

async function cacheFullOfficeForOfflineUse() {
  if (!("serviceWorker" in navigator) || typeof MessageChannel === "undefined") {
    return false;
  }
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active || navigator.serviceWorker.controller;
  if (!worker) throw new Error("No active service worker is available");
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("Offline Full Daily Office preparation timed out"));
    }, 15000);
    channel.port1.onmessage = event => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.ok) resolve();
      else reject(new Error(event.data?.message || "Offline Full Daily Office preparation failed"));
    };
    worker.postMessage({ type: "CACHE_FULL_DAILY_OFFICE" }, [channel.port2]);
  });
  return true;
}

async function retryFullOfficePreparation() {
  const today = localIsoDate();
  if (!hasFullOfficeDate(today) || fullOfficeError) {
    const content = await ensureFullOfficeContentForDate(today, { forceRefresh: true });
    if (content) beginFullOfficeHydration(today);
    return content;
  }
  fullOfficeOfflineError = null;
  fullOfficeOfflineState = "preparing";
  syncPrayerFormatStatus();
  try {
    const offlineReady = await cacheFullOfficeForOfflineUse();
    fullOfficeOfflineState = offlineReady ? "ready" : "unsupported";
  } catch (error) {
    fullOfficeOfflineState = "error";
    fullOfficeOfflineError = error;
  }
  syncPrayerFormatStatus();
  return fullOfficeContent;
}

async function loadPack() {
  const attempt = ++loadAttempt;
  const today = localIsoDate();
  screen.textContent = "Loading readings…";
  bundle = null;
  collects = new Map();

  fetch(COLLECTS_URL, { priority: "high" })
    .then(response => {
      if (!response.ok) throw new Error(`Prayers could not be loaded (${response.status})`);
      return response.text();
    })
    .then(text => {
      if (attempt !== loadAttempt) return;
      collects = parseCollects(text);
      invalidateLayouts();
      if (bundle) render();
    })
    .catch(error => {
      if (attempt !== loadAttempt) return;
      collects = null;
      showLoadError(error);
    });

  try {
    bundle = await readingPackLoader.loadDay(today);
    if (attempt !== loadAttempt) return;
    render();
    offerInitialTimedOfficeOnboarding();

    loadAroundToday(readingPackLoader, today, {
      onDay: (date, partial) => {
        if (attempt !== loadAttempt) return;
        mergeReadingBundle(bundle, partial);
        if (dateWithOffset(localIsoDate(), state.offset) === date) render();
      },
    }).then(completeBundle => {
      if (attempt !== loadAttempt || !completeBundle) return;
      bundle = completeBundle;
      cacheCompletePackForOfflineUse();
      if (!feastBrowser.hidden) renderFeastList();
      render();
      offerInitialTimedOfficeOnboarding();
    }).catch(() => {});
  } catch (error) {
    try {
      bundle = await readingPackLoader.loadFullBundle();
      if (attempt !== loadAttempt) return;
      cacheCompletePackForOfflineUse();
      render();
      offerInitialTimedOfficeOnboarding();
    } catch (fullPackError) {
      if (attempt === loadAttempt) showLoadError(fullPackError);
    }
  }
}

[previousControl, nextControl].forEach(button => {
  button.addEventListener("click", () => dispatch(button.dataset.event));
});

centerControl.addEventListener("click", () => dispatch(centerControl.dataset.event));

window.addEventListener("keydown", event => {
  if (!settingsPage.hidden || !bundle || !collects || reader.classList.contains("full-office-loading-active") || installDialog.open || timedOfficeOnboarding.isOpen() || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
  if (event.key === "Enter" && event.target instanceof Element && event.target.closest("button, a")) return;
  const verticalKey = event.key === "ArrowUp" || event.key === "ArrowDown";
  const now = performance.now();
  const doublePress = verticalKey && !event.repeat && event.key === lastVerticalKey && now - lastVerticalKeyAt <= DOUBLE_KEY_WINDOW_MS;
  if (!verticalKey || event.repeat || doublePress) {
    lastVerticalKey = null;
    lastVerticalKeyAt = -Infinity;
  } else {
    lastVerticalKey = event.key;
    lastVerticalKeyAt = now;
  }
  const action = keyboardEvent(state.focus, event.key, doublePress);
  if (!action) return;
  event.preventDefault();
  dispatch(action);
});

deviceScreen.addEventListener("click", event => {
  if (event.target.closest(".full-office-loading")) return;
  const fromPointer = pointerActivated;
  pointerActivated = false;
  const link = event.target.closest("a");
  const control = event.target.closest("[data-event]");
  const reading = event.target.closest("[data-reading]");
  const bounds = deviceScreen.getBoundingClientRect();
  const decision = screenClickDecision({
    focus: state.focus,
    clientX: event.clientX,
    screenLeft: bounds.left,
    screenWidth: bounds.width,
  }, {
    suppressed: suppressReadingTap,
    link: Boolean(link),
    controlEvent: control?.dataset.event,
    detail: event.detail,
    fromPointer,
    reading: Boolean(reading),
  });
  if (decision.preventDefault) event.preventDefault();
  if (decision.action === "TODAY" && fullOfficePreview) exitFullOfficePreview();
  if (decision.action === "TODAY" && simpleOfficePreview) exitSimpleOfficePreview();
  if (decision.action === "TODAY" && noondayPreview) exitNoondayPreview();
  if (decision.action === "TODAY" && complinePreview) exitComplinePreview();
  if (decision.action) dispatch(decision.action);
});

deviceScreen.addEventListener("pointerdown", event => {
  if (event.target.closest(".full-office-loading")) return;
  pointerActivated = true;
  pointerStart = { x: event.clientX, y: event.clientY };
});

deviceScreen.addEventListener("pointerup", event => {
  if (pointerStart === null) return;
  const swipe = swipeEvent(pointerStart.x, event.clientX, pointerStart.y, event.clientY);
  pointerStart = null;
  if (!swipe) return;
  suppressReadingTap = true;
  dispatch(focusSwipeEvent(state.focus, swipe));
  requestAnimationFrame(() => { suppressReadingTap = false; });
});

deviceScreen.addEventListener("pointercancel", () => {
  pointerActivated = false;
  pointerStart = null;
});

themeControls.forEach(control => control.addEventListener("change", () => {
  if (!control.checked) return;
  setThemeMode(themeContext, control.value);
  if (bundle && collects) paintPixelArtStack(screen, currentView());
}));

bindFeastLinksPreference({
  ...feastLinksContext,
  invalidateLayout: invalidateLayouts,
  isReady: () => Boolean(bundle && collects),
  render,
});

bindPsalmPreference({
  ...psalmContext,
  onChange: mode => {
    psalmDisplayMode = mode;
    activePsalmOffice = null;
    if (bundle && collects) render();
  },
});

bindScripturePreference({
  ...scriptureContext,
  onChange: mode => {
    scriptureMode = mode;
    invalidateLayouts();
    if (mode !== "off") {
      scripturePackLoader.prefetchAll().then(() => remapFocusAfterScriptureChange());
    }
    remapFocusAfterScriptureChange();
  },
});

function activateService(service) {
  if (service !== activeService) state = { ...state, focus: null, focusPage: 0 };
  activeService = service;
  invalidateLayouts();
}

function activateTimedOfficePreview(office, now = new Date()) {
  fullOfficePreviewController.cancel();
  if (office === "noonday") {
    noondayPreview = true;
    noondayPreviewMarker = noondayPreviewMarkerAt(now, noondayEnabled);
  } else {
    complinePreview = true;
    complinePreviewMarker = complinePreviewMarkerAt(now, complineEnabled);
  }
  activeLocalDate = localIsoDate(now);
  state = createState();
  activateService(office);
  setSettingsOpen(false);
}

function commitFullOfficePreview(office, activatedAt) {
  if (fullOfficePreview !== office || fullOfficePreviewMarker !== fullOfficeMarkerAt(activatedAt)) return;
  if (bundle && collects) render();
}

function beginFullOfficePreview(office, activatedAt) {
  fullOfficePreview = office;
  fullOfficePreviewMarker = fullOfficeMarkerAt(activatedAt);
  activeLocalDate = localIsoDate(activatedAt);
  state = createState();
  activateService(office);
  setSettingsOpen(false);
}

const fullOfficePreviewController = createFullOfficePreviewController({
  load: async activatedAt => {
    const today = localIsoDate(activatedAt);
    const content = await ensureFullOfficeContentForDate(today);
    if (content) beginFullOfficeHydration(today);
    return content;
  },
  begin: beginFullOfficePreview,
  activate: commitFullOfficePreview,
});

async function activateFullOfficePreview(office) {
  const button = office === "morning" ? previewTraditionalMorningButton : previewTraditionalEveningButton;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Loading…";
  const activated = await fullOfficePreviewController.preview(office);
  if (!activated && fullOfficePreview === office && !hasFullOfficeDate(localIsoDate())) {
    exitFullOfficePreview();
    if (bundle && collects) render();
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.textContent = originalLabel;
}

function activateSimpleOfficePreview(office, now = new Date()) {
  fullOfficePreviewController.cancel();
  fullOfficePreview = null;
  fullOfficePreviewMarker = null;
  simpleOfficePreview = office;
  simpleOfficePreviewMarker = fullOfficeMarkerAt(now);
  activeLocalDate = localIsoDate(now);
  state = createState();
  activateService("daily");
  setSettingsOpen(false);
}

function applyPrayerFormat(format, now = new Date()) {
  prayerFormat = format;
  fullOfficeDocumentCache.clear();
  syncPrayerFormatStatus();
  const nextService = scheduleAt(now);
  if (isFullOfficeService(nextService)) prepareScheduledFullOffice(now);
  activateService(serviceWithContentFallback(nextService, localIsoDate(now)));
  if (bundle && collects) render();
}

function applyTimedOfficePreference(office, enabled, now = new Date()) {
  if (office === "noonday") {
    noondayEnabled = Boolean(enabled);
    prayerSchedule.setNoondayEnabled(noondayEnabled);
    syncNoondayPreviewButton(now);
  } else {
    complineEnabled = Boolean(enabled);
    prayerSchedule.setComplineEnabled(complineEnabled);
    syncComplinePreviewButton(now);
  }
  const nextService = scheduleAt(now);
  if (isFullOfficeService(nextService)) prepareScheduledFullOffice(now);
  activateService(serviceWithContentFallback(nextService, localIsoDate(now)));
  if (bundle && collects) render();
}

function enableTimedOffice(office, now) {
  const enabled = office === "noonday"
    ? setNoondayEnabled(noondayContext, true)
    : setComplineEnabled(complineContext, true);
  applyTimedOfficePreference(office, enabled, now);
}

bindNoondayPreference({ ...noondayContext, onChange: enabled => applyTimedOfficePreference("noonday", enabled) });

bindComplinePreference({ ...complineContext, onChange: enabled => applyTimedOfficePreference("compline", enabled) });
bindPrayerFormatPreference({ ...prayerFormatContext, onChange: applyPrayerFormat });

themeContext.media.addEventListener?.("change", () => {
  if (!syncSystemTheme(themeContext)) return;
  if (bundle && collects) paintPixelArtStack(screen, currentView());
});

if ("ResizeObserver" in window) {
  observedDeviceSize = deviceSize();
  new ResizeObserver(() => {
    const nextSize = deviceSize();
    if (nextSize === observedDeviceSize) return;
    observedDeviceSize = nextSize;
    const previousTimedOfficePages = timedOfficeLayout?.pages || null;
    invalidateLayouts();
    render({ previousTimedOfficePages });
  }).observe(deviceScreen);
}

readerMenu.addEventListener("click", () => setSettingsOpen(true));
openReaderButton.addEventListener("click", () => setSettingsOpen(false));
previewNoondayButton.addEventListener("click", () => activateTimedOfficePreview("noonday"));
previewComplineButton.addEventListener("click", () => activateTimedOfficePreview("compline"));
previewSimpleMorningButton.addEventListener("click", () => activateSimpleOfficePreview("morning"));
previewSimpleEveningButton.addEventListener("click", () => activateSimpleOfficePreview("evening"));
previewTraditionalMorningButton.addEventListener("click", () => activateFullOfficePreview("morning"));
previewTraditionalEveningButton.addEventListener("click", () => activateFullOfficePreview("evening"));
retryFullOfficeButton.addEventListener("click", retryFullOfficePreparation);
browseFeastDaysButton.addEventListener("click", () => setFeastBrowserOpen(true));
closeFeastBrowserButton.addEventListener("click", () => setFeastBrowserOpen(false));
feastList.addEventListener("click", event => {
  const button = event.target instanceof Element ? event.target.closest("[data-feast-date]") : null;
  const targetDate = button?.dataset.feastDate;
  if (!targetDate || !bundle || !collects) return;
  const today = localIsoDate();
  activeLocalDate = today;
  state = stateForDate(today, targetDate);
  invalidateLayouts();
  setSettingsOpen(false);
});
installTooltip.addEventListener("click", () => {
  installTooltipDismissed = true;
  try {
    window.sessionStorage.setItem(INSTALL_TOOLTIP_SESSION_KEY, "true");
  } catch {}
  syncInstallTooltip();
});
installTooltipMedia.addEventListener?.("change", syncInstallTooltip);

shareButton.addEventListener("click", async () => {
  const shareData = {
    title: "Simple Liturgy",
    text: "BCP 1979 Daily Office readings and prayers.",
    url: canonicalUrl,
  };
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      shareStatus.textContent = "Share sheet opened.";
    } catch (error) {
      if (error.name !== "AbortError") shareStatus.textContent = "Sharing could not be opened. Please try again.";
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(canonicalUrl);
    shareStatus.textContent = "Link copied to clipboard.";
  } catch {
    shareStatus.textContent = "Sharing is not available in this browser.";
  }
});

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstall = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstall) return installDialog.showModal();
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => { installButton.hidden = true; });
function rescheduleTimeBoundaries(date) {
  psalmBoundary.reschedule(date);
  noondayBoundary.reschedule(date);
  complineBoundary.reschedule(date);
}
function refreshAt(date, rescheduleTimer = true) {
  syncNoondayPreviewButton(date);
  syncComplinePreviewButton(date);
  const scheduledService = scheduleAt(date);
  if (isFullOfficeService(scheduledService)) prepareScheduledFullOffice(date);
  if (fullOfficePreview || simpleOfficePreview) {
    const previewExpired = (fullOfficePreviewMarker || simpleOfficePreviewMarker) !== fullOfficeMarkerAt(date);
    if (previewExpired) exitFullOfficePreview(date);
    if (previewExpired) exitSimpleOfficePreview(date);
    resetForNewLocalDate(date);
    if (bundle && collects) render();
    if (rescheduleTimer) rescheduleTimeBoundaries(date);
    return;
  }
  const previewToExit = timedOfficePreviewToExit({ noondayPreview, complinePreview, scheduledService });
  if (previewToExit === "noonday") exitNoondayPreview(date);
  if (previewToExit === "compline") exitComplinePreview(date);
  if (noondayPreview) {
    refreshNoondayPreview({
      date,
      marker: noondayPreviewMarker,
      enabled: noondayEnabled,
      exit: exitNoondayPreview,
      resetForNewLocalDate,
      render: () => { if (bundle && collects) render(); },
    });
    if (rescheduleTimer) rescheduleTimeBoundaries(date);
    return;
  }
  if (complinePreview) {
    refreshComplinePreview({
      date,
      marker: complinePreviewMarker,
      enabled: complineEnabled,
      exit: exitComplinePreview,
      resetForNewLocalDate,
      render: () => { if (bundle && collects) render(); },
    });
    if (rescheduleTimer) rescheduleTimeBoundaries(date);
    return;
  }
  const dateChanged = resetForNewLocalDate(date);
  const service = serviceWithContentFallback(scheduledService, localIsoDate(date));
  const serviceChanged = service !== activeService;
  if ((dateChanged || serviceChanged) && bundle && collects) {
    activateService(service);
    render();
  }
  activeService = service;
  if (service === "daily") {
    refreshPsalmDisplay({
      date,
      activeOffice: activePsalmOffice,
      resetForNewLocalDate,
      render,
    });
  }
  timedOfficeOnboarding.refresh(date);
  if (rescheduleTimer) rescheduleTimeBoundaries(date);
}
function refreshForCurrentTime() {
  refreshAt(new Date());
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshForCurrentTime();
});
window.addEventListener("focus", refreshForCurrentTime);
window.addEventListener("pageshow", refreshForCurrentTime);

if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .then(registration => {
      const checkForUpdate = () => {
        registration.update().catch(() => {});
      };
      checkForUpdate();
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForUpdate();
      });
    })
    .catch(() => {});
}

loadPack();
kickIosPwaTopBlur();
initializeAnalytics({ document, storage: window.localStorage, trackerWindow: window });
