export const CALENDAR_FILENAME = "simple-liturgy-prayer-reminders.ics";

export const PRAYER_TIME_OPTIONS = Object.freeze({
  morning: Object.freeze(["off", "05:00", "06:00", "07:00", "08:00"]),
  noonday: Object.freeze(["off", "11:00", "12:00", "13:00"]),
  evening: Object.freeze(["off", "18:00", "19:00", "20:00", "21:00"]),
  compline: Object.freeze(["off", "21:00", "22:00", "23:00"]),
});

const OFFICE_DETAILS = Object.freeze({
  morning: Object.freeze({ label: "Morning Prayer", storageKey: "simple-liturgy.prayer-reminders.morning" }),
  noonday: Object.freeze({ label: "Noonday Prayer", storageKey: "simple-liturgy.prayer-reminders.noonday" }),
  evening: Object.freeze({ label: "Evening Prayer", storageKey: "simple-liturgy.prayer-reminders.evening" }),
  compline: Object.freeze({ label: "Compline", storageKey: "simple-liturgy.prayer-reminders.compline" }),
});

function validSelection(office, value) {
  return PRAYER_TIME_OPTIONS[office]?.includes(value) ? value : "off";
}

export function loadPrayerSelections(storage) {
  return Object.fromEntries(Object.keys(OFFICE_DETAILS).map(office => {
    try {
      return [office, validSelection(office, storage?.getItem(OFFICE_DETAILS[office].storageKey))];
    } catch {
      return [office, "off"];
    }
  }));
}

export function savePrayerSelection(storage, office, value) {
  if (!OFFICE_DETAILS[office] || validSelection(office, value) !== value) return null;
  try {
    if (typeof storage?.setItem !== "function") return { value, persisted: false };
    storage.setItem(OFFICE_DETAILS[office].storageKey, value);
    return { value, persisted: true };
  } catch {
    return { value, persisted: false };
  }
}

export function escapeIcsText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const segments = [];
  let segment = "";
  let octets = 0;

  for (const character of line) {
    const characterOctets = encoder.encode(character).length;
    if (octets + characterOctets > 75 && segment) {
      segments.push(segment);
      segment = ` ${character}`;
      octets = 1 + characterOctets;
    } else {
      segment += character;
      octets += characterOctets;
    }
  }
  segments.push(segment);
  return segments.join("\r\n");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateTime(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function utcDateTime(date) {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function normalizeAppUrl(value) {
  const candidate = String(value);
  if (/[\r\n]/.test(candidate)) throw new TypeError("appUrl must be a valid HTTP(S) URL");
  let normalized;
  try {
    normalized = new URL(candidate);
  } catch {
    throw new TypeError("appUrl must be a valid HTTP(S) URL");
  }
  if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
    throw new TypeError("appUrl must be a valid HTTP(S) URL");
  }
  return normalized.href;
}

function nextOccurrence(now, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const occurrence = new Date(now);
  occurrence.setHours(hours, minutes, 0, 0);
  if (occurrence.getTime() < now.getTime()) occurrence.setDate(occurrence.getDate() + 1);
  return occurrence;
}

function defaultUidFactory() {
  const exportId = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return office => `${exportId}-${office}@simpleliturgy.com`;
}

function eventLines({ office, time, now, appUrl, dtstamp, uidFactory }) {
  const { label } = OFFICE_DETAILS[office];
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uidFactory(office))}`,
    `DTSTAMP:${utcDateTime(dtstamp)}`,
    `DTSTART:${localDateTime(nextOccurrence(now, time))}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    `SUMMARY:${escapeIcsText(`${label} — Simple Liturgy`)}`,
    `DESCRIPTION:${escapeIcsText(`Pray with Simple Liturgy: ${appUrl}`)}`,
    `URL:${appUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(label)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
  ];
}

export function buildPrayerCalendar({
  selections,
  now = new Date(),
  appUrl = "https://simpleliturgy.com/",
  dtstamp = new Date(),
  uidFactory = defaultUidFactory(),
}) {
  const selected = Object.keys(OFFICE_DETAILS)
    .map(office => [office, validSelection(office, selections?.[office])])
    .filter(([, time]) => time !== "off");
  if (!selected.length) return null;
  const normalizedAppUrl = normalizeAppUrl(appUrl);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Simple Liturgy//Prayer Reminders//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const [office, time] of selected) {
    lines.push(...eventLines({ office, time, now, appUrl: normalizedAppUrl, dtstamp, uidFactory }));
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function bindPrayerReminderSettings({
  controls,
  button,
  status,
  importHelp,
  storage,
  appUrl,
  buildCalendar = buildPrayerCalendar,
  handoffCalendar = handoffPrayerCalendar,
}) {
  const controlList = Array.from(controls);
  const controlsByOffice = new Map(controlList.map(control => [control.dataset.prayerOffice, control]));
  const selectedValues = () => Object.fromEntries(controlList
    .filter(control => !control.disabled)
    .map(control => [control.dataset.prayerOffice, control.value]));
  const savedSelections = loadPrayerSelections(storage);
  for (const control of controlList) {
    control.value = savedSelections[control.dataset.prayerOffice];
    control.addEventListener("change", () => {
      const result = savePrayerSelection(storage, control.dataset.prayerOffice, control.value);
      importHelp.hidden = true;
      status.textContent = result?.persisted
        ? "Prayer times saved. Create a new calendar file when you’re ready."
        : "Prayer times are set for this session, but your browser couldn’t save them for next time.";
    });
  }

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    importHelp.hidden = true;
    const calendar = buildCalendar({
      selections: selectedValues(),
      appUrl,
    });
    if (!calendar) {
      status.textContent = "Choose at least one prayer time.";
      return;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Preparing…";
    try {
      const result = await handoffCalendar(calendar);
      if (result.status === "download_requested") {
        status.textContent = "Calendar file download requested. Check your downloads, then open it with a compatible calendar.";
        importHelp.hidden = false;
      } else {
        status.textContent = "The calendar file couldn’t be prepared. Please try again.";
      }
    } catch {
      status.textContent = "The calendar file couldn’t be prepared. Please try again.";
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Create calendar reminders";
    }
  });

  const setOfficeVisibility = (office, enabled) => {
    const control = controlsByOffice.get(office);
    const row = control?.closest("[data-prayer-reminder-row]");
    if (!control || !row) return;
    const visible = Boolean(enabled);
    control.disabled = !visible;
    row.hidden = !visible;
  };

  const evening = controlsByOffice.get("evening");
  const ninePm = Array.from(evening?.options || []).find(option => option.value === "21:00");
  const setComplineEnabled = enabled => {
    const complineEnabled = Boolean(enabled);
    const resetEvening = complineEnabled && evening?.value === "21:00";

    if (resetEvening) evening.value = "off";
    if (complineEnabled) ninePm?.remove();
    else if (ninePm && !Array.from(evening?.options || []).includes(ninePm)) evening.add(ninePm);
    setOfficeVisibility("compline", complineEnabled);

    if (resetEvening) {
      const result = savePrayerSelection(storage, "evening", "off");
      importHelp.hidden = true;
      status.textContent = "Evening Prayer was turned off because Compline begins at 9 p.m. If you previously imported that reminder, delete the old 9 p.m. event from your calendar before creating a replacement."
        + (result?.persisted ? "" : " This change is only set for this session.");
    }
  };

  return {
    setNoondayEnabled: enabled => setOfficeVisibility("noonday", enabled),
    setComplineEnabled,
  };
}

export async function handoffPrayerCalendar(calendarText, {
  documentObject = globalThis.document,
  URLObject = globalThis.URL,
  BlobConstructor = globalThis.Blob,
  setTimer = globalThis.setTimeout,
} = {}) {
  let objectUrl = null;
  try {
    const blob = new BlobConstructor([calendarText], { type: "text/calendar;charset=utf-8" });
    objectUrl = URLObject.createObjectURL(blob);
    const link = documentObject.createElement("a");
    link.href = objectUrl;
    link.download = CALENDAR_FILENAME;
    link.style.display = "none";
    documentObject.body.append(link);
    link.click();
    link.remove();
    setTimer(() => URLObject.revokeObjectURL(objectUrl), 0);
    return { status: "download_requested" };
  } catch {
    if (objectUrl) URLObject?.revokeObjectURL?.(objectUrl);
    return { status: "failed" };
  }
}
