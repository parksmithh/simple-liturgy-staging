const FULL_OFFICE_SERVICES = new Set(["morning", "evening"]);
const FULL_OFFICE_LOADING_CELLS_HTML = Array.from(
  { length: 16 },
  () => '<span class="full-office-loading-cell"></span>',
).join("");

export function isFullOfficeService(service) {
  return FULL_OFFICE_SERVICES.has(service);
}

export function fullOfficeLoadingService({
  focus,
  requestedService,
  hasContent,
  loading,
}) {
  if (focus || hasContent || !loading || !isFullOfficeService(requestedService)) return null;
  return requestedService;
}

export function fullOfficeLoadingHtml(service) {
  const label = service === "evening" ? "Evening Prayer" : "Morning Prayer";
  return `
    <section class="full-office-loading" role="status" aria-live="polite" aria-label="${label} is loading">
      <p class="full-office-loading-title">${label}</p>
      <div class="full-office-loading-bar" aria-hidden="true">${FULL_OFFICE_LOADING_CELLS_HTML}</div>
      <p class="full-office-loading-copy">Loading the Daily Office liturgy...</p>
    </section>
  `;
}

export function createFullOfficePreviewController({
  load,
  begin = () => {},
  activate,
  now = () => new Date(),
}) {
  let generation = 0;

  return {
    cancel() {
      generation += 1;
    },

    async preview(service) {
      const requestGeneration = ++generation;
      const activatedAt = now();
      const contentPromise = load(activatedAt);
      begin(service, activatedAt);
      const content = await contentPromise;
      if (!content || requestGeneration !== generation) return false;
      activate(service, activatedAt);
      return true;
    },
  };
}
