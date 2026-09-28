import { COMPLINE_END_HOUR } from "./compline-preference.js?v=staging-e2413448ca2960a67ac33e756724e7c866fdde39";
import { localIsoDate, scheduledServiceAt } from "./office-schedule.js?v=staging-e2413448ca2960a67ac33e756724e7c866fdde39";

const DISMISSAL_KEY_PREFIX = "simple-liturgy.timed-office-onboarding";

const OFFICE_COPY = {
  noonday: {
    title: "Make room for Noonday Prayer?",
    description: "Show Noonday Prayer automatically from 10 a.m. to 2 p.m. Manage it anytime in Settings.",
    enableLabel: "Turn on Noonday Prayer",
  },
  compline: {
    title: "Make room for Compline?",
    description: "Show Compline automatically from 9 p.m. to 4 a.m. Manage it anytime in Settings.",
    enableLabel: "Turn on Compline",
  },
};

function dismissalKey(office) {
  return `${DISMISSAL_KEY_PREFIX}.${office}`;
}

function dismissalPeriodAt(office, date) {
  if (office !== "compline" || date.getHours() >= COMPLINE_END_HOUR) {
    return localIsoDate(date);
  }
  const evening = new Date(date);
  evening.setDate(evening.getDate() - 1);
  return localIsoDate(evening);
}

export function shouldOfferTimedOfficeOnboarding({
  office,
  date = new Date(),
  enabled,
  dismissed = false,
}) {
  if (enabled || !OFFICE_COPY[office]) return false;
  return !dismissed && scheduledServiceAt(date) === office;
}

export function timedOfficeOnboardingCopy(office) {
  return OFFICE_COPY[office] ? { ...OFFICE_COPY[office] } : null;
}

export function isTimedOfficeOnboardingDismissed(storage, office, date = new Date()) {
  try {
    return storage.getItem(dismissalKey(office)) === dismissalPeriodAt(office, date);
  } catch {
    return false;
  }
}

export function dismissTimedOfficeOnboarding(storage, office, date = new Date()) {
  try {
    storage.setItem(dismissalKey(office), dismissalPeriodAt(office, date));
  } catch {}
}

export function createTimedOfficeOnboardingController({
  document,
  storage,
  now = () => new Date(),
  getEnabled,
  canOfferAutomatically = () => true,
  enableOffice,
}) {
  const dialog = document.querySelector("#timed-office-onboarding");
  const form = document.querySelector("#timed-office-onboarding form");
  const installDialog = document.querySelector("#install-dialog");
  const title = document.querySelector("#timed-office-onboarding-title");
  const description = document.querySelector("#timed-office-onboarding-description");
  const enableButton = document.querySelector("#enable-timed-office");
  let pendingRequest = null;
  let retryAfterInstall = null;

  function isEligible(office, date) {
    return shouldOfferTimedOfficeOnboarding({
      office,
      date,
      enabled: getEnabled(office),
      dismissed: isTimedOfficeOnboardingDismissed(storage, office, date),
    });
  }

  function show(office, date = now()) {
    const copy = timedOfficeOnboardingCopy(office);
    title.textContent = copy.title;
    description.textContent = copy.description;
    enableButton.textContent = copy.enableLabel;
    dialog.returnValue = "";
    pendingRequest = { office, offeredAt: date };
    dialog.showModal();
    return true;
  }

  function offerAutomatic(date = now()) {
    if (!canOfferAutomatically() || dialog.open) return false;
    const office = scheduledServiceAt(date);
    if (!OFFICE_COPY[office] || scheduledServiceAt(now()) !== office || getEnabled(office)
        || isTimedOfficeOnboardingDismissed(storage, office, date)) return false;
    if (installDialog.open) {
      retryAfterInstall = date;
      return false;
    }
    return show(office, date);
  }

  function refresh(date = now()) {
    if (dialog.open && pendingRequest && !isEligible(pendingRequest.office, date)) {
      pendingRequest = null;
      dialog.close();
    }
    return false;
  }

  function finishPendingRequest(action, date = now()) {
    const request = pendingRequest;
    pendingRequest = null;
    if (!request) return false;
    if (action === "enable") {
      enableOffice(request.office, date);
    } else {
      dismissTimedOfficeOnboarding(storage, request.office, request.offeredAt);
    }
    return true;
  }

  form.addEventListener("submit", event => {
    const action = event.submitter?.value;
    if (action !== "enable" && action !== "dismiss") return;
    event.preventDefault();
    finishPendingRequest(action);
    dialog.close(action);
  });

  dialog.addEventListener("close", () => {
    finishPendingRequest(dialog.returnValue);
  });

  installDialog.addEventListener("close", () => {
    const entryDate = retryAfterInstall;
    retryAfterInstall = null;
    if (entryDate) offerAutomatic(entryDate);
  });

  return {
    isOpen: () => dialog.open,
    offerAutomatic,
    refresh,
  };
}
