import { complineServiceAt } from "./compline-preference.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";
import { noondayServiceAt } from "./noonday-preference.js?v=staging-6e407f1601ea49b90c16d572c4409a52d8cbf9d7";

export function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function officePeriodAt(date = new Date()) {
  const hour = date.getHours();
  if (hour < 10) return "morning";
  if (hour < 14) return "midday";
  if (hour < 21) return "evening";
  return "night";
}

function scheduleOptions(optionsOrNoondayEnabled, complineEnabled) {
  if (optionsOrNoondayEnabled && typeof optionsOrNoondayEnabled === "object") {
    return {
      format: optionsOrNoondayEnabled.format === "full" ? "full" : "simple",
      noondayEnabled: Boolean(optionsOrNoondayEnabled.noondayEnabled),
      complineEnabled: Boolean(optionsOrNoondayEnabled.complineEnabled),
    };
  }
  return {
    format: "simple",
    noondayEnabled: optionsOrNoondayEnabled ?? true,
    complineEnabled: complineEnabled ?? true,
  };
}

export function scheduledServiceAt(date = new Date(), optionsOrNoondayEnabled = true, legacyComplineEnabled = true) {
  const options = scheduleOptions(optionsOrNoondayEnabled, legacyComplineEnabled);
  const noondayService = noondayServiceAt(date, options.noondayEnabled);
  if (noondayService !== "daily") return noondayService;
  const complineService = complineServiceAt(date, options.complineEnabled);
  if (complineService !== "daily") return complineService;
  if (options.format !== "full") return "daily";
  const period = officePeriodAt(date);
  if (period === "morning" || period === "midday") return "morning";
  return "evening";
}

export function timedOfficePreviewToExit({ noondayPreview, complinePreview, scheduledService }) {
  if (complinePreview && scheduledService === "noonday") return "compline";
  if (noondayPreview && scheduledService === "compline") return "noonday";
  return null;
}
