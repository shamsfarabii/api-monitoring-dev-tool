import {
  captureFields,
  formatCapture,
  isReplayFormat,
  LARGE_OUTPUT_WARNING_THRESHOLD,
  type Field
} from "./format";
import { filterAndSortCaptures, groupCapturesByApi, type ApiCaptureGroup } from "./filters";
import { isBase64Response } from "./format/fields";
import { defaultUserSettings, loadUserSettings, saveUserSettings } from "./settings";
import type { FailedApiCapture, OutputFormat, UserSettings } from "./types";
import { OUTPUT_FORMAT_LABELS } from "./types";

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
const ACCORDION_CHEVRON_SVG =
  '<svg class="accordion-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>';

declare global {
  interface Window {
    receiveCapturedFailures?: (captures: readonly FailedApiCapture[]) => void;
    clearCapturedFailures?: () => void;
  }
}

type PanelState = {
  captures: FailedApiCapture[];
  selectedCaptureId: string | null;
  searchText: string;
  detailSearchText: string;
  settings: UserSettings;
};

const state: PanelState = {
  captures: [],
  selectedCaptureId: null,
  searchText: "",
  detailSearchText: "",
  settings: { ...defaultUserSettings }
};

const summaryElement = getElement("summary", HTMLParagraphElement);
const countPillElement = getElement("count-pill", HTMLSpanElement);
const searchInput = getElement("search-input", HTMLInputElement);
const detailSearchInput = getElement("detail-search-input", HTMLInputElement);
const previewSearchEmptyElement = getElement("preview-search-empty", HTMLParagraphElement);
const listViewModeSelect = getElement("list-view-mode", HTMLSelectElement);
const outcomeFilterSelect = getElement("outcome-filter", HTMLSelectElement);
const methodFilterSelect = getElement("method-filter", HTMLSelectElement);
const sortModeSelect = getElement("sort-mode", HTMLSelectElement);
const requestListElement = getElement("request-list", HTMLDivElement);
const filterEmptyStateElement = getElement("filter-empty-state", HTMLDivElement);
const emptyStateElement = getElement("empty-state", HTMLDivElement);
const selectedStateElement = getElement("selected-state", HTMLDivElement);
const selectedTitleElement = getElement("selected-title", HTMLHeadingElement);
const selectedUrlElement = getElement("selected-url", HTMLParagraphElement);
const previewElement = getElement("preview", HTMLDivElement);
const previewFormatLabel = getElement("preview-format-label", HTMLSpanElement);
const previewCharCount = getElement("preview-char-count", HTMLSpanElement);
const previewNoticesElement = getElement("preview-notices", HTMLDivElement);
const copySelectedButton = getElement("copy-selected-button", HTMLButtonElement);
const clearButton = getElement("clear-button", HTMLButtonElement);
const toastElement = getElement("toast", HTMLDivElement);
const includeButton = getElement("include-button", HTMLButtonElement);
const includeMenu = getElement("include-menu", HTMLDivElement);
const menuBackdrop = getElement("menu-backdrop", HTMLDivElement);
const formatSelect = getElement("format-select", HTMLSelectElement);
const redactSecretsCheckbox = getElement("redact-secrets-checkbox", HTMLInputElement);
const includeEndpointBaseUrlCheckbox = getElement(
  "include-endpoint-base-url-checkbox",
  HTMLInputElement
);
const redactionWarningBanner = getElement("redaction-warning", HTMLDivElement);

const sectionCheckboxes = Array.from(
  includeMenu.querySelectorAll<HTMLInputElement>("input[data-section]")
);

window.receiveCapturedFailures = (captures) => {
  state.captures = [...captures];

  if (state.selectedCaptureId === null) {
    state.selectedCaptureId = state.captures[0]?.id ?? null;
  }

  if (!state.captures.some((capture) => capture.id === state.selectedCaptureId)) {
    state.selectedCaptureId = state.captures[0]?.id ?? null;
  }

  render();
};

searchInput.addEventListener("input", () => {
  state.searchText = searchInput.value.trim().toLowerCase();
  persistAndRender();
});

detailSearchInput.addEventListener("input", () => {
  state.detailSearchText = detailSearchInput.value.trim().toLowerCase();
  renderSelectedCapture();
});

listViewModeSelect.addEventListener("change", () => {
  state.settings.listViewMode = readListViewMode(listViewModeSelect.value);
  persistAndRender();
});

outcomeFilterSelect.addEventListener("change", () => {
  state.settings.outcomeFilter = readOutcomeFilter(outcomeFilterSelect.value);
  persistAndRender();
});

methodFilterSelect.addEventListener("change", () => {
  state.settings.methodFilter = readMethodFilter(methodFilterSelect.value);
  persistAndRender();
});

sortModeSelect.addEventListener("change", () => {
  state.settings.sortMode = readSortMode(sortModeSelect.value);
  persistAndRender();
});

formatSelect.addEventListener("change", () => {
  state.settings.outputFormat = readOutputFormat(formatSelect.value);
  persistAndRender();
});

copySelectedButton.addEventListener("click", () => {
  void copyCapture(getSelectedCapture());
});

clearButton.addEventListener("click", () => {
  window.clearCapturedFailures?.();

  if (window.clearCapturedFailures === undefined) {
    state.captures = [];
    state.selectedCaptureId = null;
    render();
  }
});

redactSecretsCheckbox.addEventListener("change", () => {
  state.settings.redactSecrets = redactSecretsCheckbox.checked;
  persistAndRender();
});

includeEndpointBaseUrlCheckbox.addEventListener("change", () => {
  state.settings.includeEndpointBaseUrl = includeEndpointBaseUrlCheckbox.checked;
  persistAndRender();
});

void bootstrap();

async function bootstrap(): Promise<void> {
  state.settings = await loadUserSettings();
  applySettingsToControls();
  initSectionMenu();
  initAccordionBehavior();
  render();
}

function createAccordionChevron(): HTMLSpanElement {
  const chevron = document.createElement("span");
  chevron.className = "accordion-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = ACCORDION_CHEVRON_SVG;
  return chevron;
}

const accordionOpenState = new Map<string, boolean>();

function getAccordionStateKey(details: HTMLDetailsElement, captureId?: string | null): string | null {
  if (details.classList.contains("request-group")) {
    const title = details.querySelector(".request-title")?.textContent?.trim();
    return title ? `group:${title}` : null;
  }

  if (details.classList.contains("pv-section")) {
    const label = details.querySelector(".pv-label")?.textContent?.trim();
    const id = captureId ?? state.selectedCaptureId;
    if (label === undefined || label.length === 0 || id === null) {
      return null;
    }
    return `pv:${id}:${label}`;
  }

  if (details.classList.contains("accordion-details")) {
    return "preview:clipboard";
  }

  return null;
}

function restoreAccordionOpenState(details: HTMLDetailsElement, captureId?: string | null): void {
  const key = getAccordionStateKey(details, captureId);
  if (key === null || !accordionOpenState.has(key)) {
    return;
  }

  details.open = accordionOpenState.get(key) ?? false;
}

function rememberAccordionOpenState(details: HTMLDetailsElement, captureId?: string | null): void {
  const key = getAccordionStateKey(details, captureId);
  if (key !== null) {
    accordionOpenState.set(key, details.open);
  }
}

function bindAccordionDetails(details: HTMLDetailsElement, captureId?: string | null): void {
  const trigger = details.querySelector(":scope > summary");
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  const syncExpandedState = (): void => {
    details.classList.toggle("is-expanded", details.open);
    trigger.setAttribute("aria-expanded", String(details.open));
    rememberAccordionOpenState(details, captureId);
  };

  restoreAccordionOpenState(details, captureId);

  if (details.dataset.accordionBound !== "true") {
    details.dataset.accordionBound = "true";
    details.addEventListener("toggle", syncExpandedState);

    trigger.addEventListener("click", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, input, select, textarea, label")
      ) {
        return;
      }

      event.preventDefault();
      details.open = !details.open;
    });
  }

  syncExpandedState();
}

function initAccordionBehavior(
  root: ParentNode = document,
  captureId: string | null = state.selectedCaptureId
): void {
  for (const details of root.querySelectorAll<HTMLDetailsElement>(
    "details.accordion-details, details.request-group"
  )) {
    bindAccordionDetails(details, captureId);
  }
}

function initSectionMenu(): void {
  for (const checkbox of sectionCheckboxes) {
    const key = checkbox.dataset.section;

    if (key === undefined || !isSectionKey(key)) {
      continue;
    }

    checkbox.checked = state.settings.sections[key];

    checkbox.addEventListener("change", () => {
      state.settings.sections[key] = checkbox.checked;
      syncEndpointBaseUrlControl();
      void persistAndRender();
    });
  }

  includeButton.addEventListener("click", () => {
    setMenuOpen(isMenuOpen() === false);
  });

  menuBackdrop.addEventListener("click", () => setMenuOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMenuOpen()) {
      setMenuOpen(false);
      includeButton.focus();
    }
  });
}

function applySettingsToControls(): void {
  formatSelect.value = state.settings.outputFormat;
  listViewModeSelect.value = state.settings.listViewMode;
  outcomeFilterSelect.value = state.settings.outcomeFilter;
  methodFilterSelect.value = state.settings.methodFilter;
  sortModeSelect.value = state.settings.sortMode;
  redactSecretsCheckbox.checked = state.settings.redactSecrets;
  includeEndpointBaseUrlCheckbox.checked = state.settings.includeEndpointBaseUrl;
  syncEndpointBaseUrlControl();

  for (const checkbox of sectionCheckboxes) {
    const key = checkbox.dataset.section;
    if (key !== undefined && isSectionKey(key)) {
      checkbox.checked = state.settings.sections[key];
    }
  }
}

function persistAndRender(): void {
  void saveUserSettings(state.settings);
  render();
}

function isMenuOpen(): boolean {
  return includeMenu.hidden === false;
}

function setMenuOpen(open: boolean): void {
  includeMenu.hidden = !open;
  menuBackdrop.hidden = !open;
  includeButton.classList.toggle("active", open);
  includeButton.setAttribute("aria-expanded", String(open));
}

function render(): void {
  const filteredCaptures = getFilteredCaptures();
  const total = state.captures.length;

  countPillElement.hidden = total === 0;
  countPillElement.textContent = total.toString();

  summaryElement.textContent =
    total === 0
      ? "No API calls captured yet."
      : `${filteredCaptures.length} shown · ${total} captured`;

  copySelectedButton.disabled = getSelectedCapture() === null;
  clearButton.disabled = total === 0;

  redactionWarningBanner.hidden = state.settings.redactSecrets;

  renderRequestList(filteredCaptures, total);
  renderSelectedCapture();
  initAccordionBehavior();
}

function renderRequestList(captures: readonly FailedApiCapture[], total: number): void {
  requestListElement.replaceChildren();

  const showFilterEmpty = total > 0 && captures.length === 0;
  filterEmptyStateElement.hidden = !showFilterEmpty;
  requestListElement.hidden = showFilterEmpty;
  requestListElement.classList.toggle(
    "request-list--grouped",
    state.settings.listViewMode === "grouped"
  );

  if (state.settings.listViewMode === "grouped") {
    for (const group of groupCapturesByApi(captures)) {
      requestListElement.append(createRequestGroupElement(group));
    }
    return;
  }

  for (const capture of captures) {
    requestListElement.append(createRequestItem(capture));
  }
}

function createRequestItem(capture: FailedApiCapture, nested = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    capture.id === state.selectedCaptureId ? "request-item selected" : "request-item";

  if (nested) {
    button.classList.add("request-item-nested");
  }

  button.style.setProperty("--row-color", statusColorVar(capture.status));
  button.append(...(nested ? buildNestedRequestItemRows(capture) : buildRequestItemRows(capture)));

  button.addEventListener("click", () => {
    state.selectedCaptureId = capture.id;
    render();
  });

  return button;
}

function createRequestGroupElement(group: ApiCaptureGroup): HTMLElement {
  if (group.captures.length === 1) {
    return createRequestItem(group.captures[0]);
  }

  const representative = group.captures[0];
  const hasSelected = group.captures.some((capture) => capture.id === state.selectedCaptureId);

  const details = document.createElement("details");
  details.className = "request-group accordion-details";
  if (hasSelected) {
    details.open = true;
    details.classList.add("has-selected");
  }

  const summary = document.createElement("summary");
  summary.className = "request-group-summary accordion-trigger";
  summary.style.setProperty("--row-color", statusColorVar(representative.status));

  const topRow = document.createElement("div");
  topRow.className = "request-top";
  topRow.append(createMethodBadge(representative.method));

  const title = document.createElement("span");
  title.className = "request-title";
  title.textContent = getUrlPath(representative.url);
  title.title = representative.url;
  topRow.append(title);

  const count = document.createElement("span");
  count.className = "request-group-count";
  count.textContent = `×${group.captures.length}`;
  topRow.append(count);

  topRow.append(createAccordionChevron());

  const bottomRow = document.createElement("div");
  bottomRow.className = "request-bottom";
  bottomRow.append(createStatusBadge(representative.status, representative.statusText));

  const hostText = getUrlHost(representative.url);
  if (hostText.length > 0) {
    const host = document.createElement("span");
    host.className = "request-host";
    host.textContent = hostText;
    bottomRow.append(host);
  }

  summary.append(topRow, bottomRow);

  const items = document.createElement("div");
  items.className = "request-group-items";

  for (const capture of group.captures) {
    items.append(createRequestItem(capture, true));
  }

  details.append(summary, items);
  return details;
}

function buildRequestItemRows(capture: FailedApiCapture): [HTMLDivElement, HTMLDivElement] {
  const topRow = document.createElement("div");
  topRow.className = "request-top";
  topRow.append(createMethodBadge(capture.method));

  const title = document.createElement("span");
  title.className = "request-title";
  title.textContent = getUrlPath(capture.url);
  title.title = capture.url;
  topRow.append(title);

  const bottomRow = document.createElement("div");
  bottomRow.className = "request-bottom";
  bottomRow.append(createStatusBadge(capture.status, capture.statusText));

  const hostText = getUrlHost(capture.url);
  if (hostText.length > 0) {
    const host = document.createElement("span");
    host.className = "request-host";
    host.textContent = hostText;
    bottomRow.append(host);
  }

  if (capture.durationMs !== null) {
    const meta = document.createElement("span");
    meta.className = "request-meta";
    meta.textContent = formatDuration(capture.durationMs);
    bottomRow.append(meta);
  }

  return [topRow, bottomRow];
}

function buildNestedRequestItemRows(capture: FailedApiCapture): [HTMLDivElement, HTMLDivElement] {
  const topRow = document.createElement("div");
  topRow.className = "request-top";
  topRow.append(createStatusBadge(capture.status, capture.statusText));

  const query = getUrlQuery(capture.url);
  const label = document.createElement("span");
  label.className = "request-title";
  label.textContent = query.length > 0 ? query : capture.startedAt;
  topRow.append(label);

  const bottomRow = document.createElement("div");
  bottomRow.className = "request-bottom";

  if (capture.durationMs !== null) {
    const meta = document.createElement("span");
    meta.className = "request-meta";
    meta.textContent = formatDuration(capture.durationMs);
    bottomRow.append(meta);
  }

  if (query.length > 0) {
    const time = document.createElement("span");
    time.className = "request-host";
    time.textContent = capture.startedAt;
    bottomRow.append(time);
  }

  return [topRow, bottomRow];
}

function renderSelectedCapture(): void {
  const selectedCapture = getSelectedCapture();
  const total = state.captures.length;

  if (total === 0) {
    emptyStateElement.hidden = false;
    emptyStateElement.querySelector("h2")!.textContent = "No API calls captured yet";
    emptyStateElement.querySelector("p")!.textContent =
      "Make API requests in your app, then check the Network panel. Matching API calls will appear here automatically.";
    selectedStateElement.hidden = true;
    selectedTitleElement.replaceChildren();
    selectedUrlElement.textContent = "";
    previewElement.replaceChildren();
    previewElement.hidden = false;
    previewNoticesElement.hidden = true;
    previewNoticesElement.replaceChildren();
    return;
  }

  if (selectedCapture === null) {
    emptyStateElement.hidden = false;
    emptyStateElement.querySelector("h2")!.textContent = "Select an API request";
    emptyStateElement.querySelector("p")!.textContent =
      "Choose a request from the sidebar to preview and copy its details.";
    selectedStateElement.hidden = true;
    return;
  }

  emptyStateElement.hidden = true;
  selectedStateElement.hidden = false;

  const path = document.createElement("span");
  path.className = "selected-path";
  path.textContent = getUrlPathname(selectedCapture.url);

  selectedTitleElement.replaceChildren(
    createStatusBadge(selectedCapture.status, selectedCapture.statusText),
    createMethodBadge(selectedCapture.method),
    path
  );

  const query = getUrlQuery(selectedCapture.url);
  selectedUrlElement.textContent = query;
  selectedUrlElement.hidden = query.length === 0;
  renderPreview(selectedCapture);
}

function renderPreview(capture: FailedApiCapture): void {
  const output = buildCopyOutput(capture);
  const formatLabel = OUTPUT_FORMAT_LABELS[state.settings.outputFormat];
  const searchTerms = getDetailSearchTerms();

  previewFormatLabel.textContent = formatLabel;
  previewCharCount.textContent = `${output.length.toLocaleString()} chars`;

  renderPreviewNotices(output);

  previewElement.replaceChildren();
  previewElement.hidden = false;
  previewSearchEmptyElement.hidden = true;

  const contentNodes: HTMLElement[] = [];
  const overviewSection = createOverviewSection(capture, searchTerms);
  if (overviewSection !== null) {
    contentNodes.push(overviewSection);
  }

  if (output.length === 0) {
    if (contentNodes.length === 0) {
      previewElement.append(createPreviewEmptyState(capture));
    } else {
      previewElement.append(...contentNodes);
    }
    syncPreviewPanelVisibility(contentNodes.length > 0);
    return;
  }

  if (state.settings.outputFormat === "plainText") {
    const fields = captureFields(capture, {
      sections: state.settings.sections,
      redactSecrets: state.settings.redactSecrets,
      includeEndpointBaseUrl: state.settings.includeEndpointBaseUrl
    });

    if (fields.length === 0 && contentNodes.length === 0) {
      previewElement.append(createPreviewEmptyState(capture));
      syncPreviewPanelVisibility(true);
      return;
    }

    const visibleSections = fields
      .map((field) => createSection(field, searchTerms))
      .filter((section): section is HTMLElement => section !== null);

    contentNodes.push(...visibleSections);

    if (contentNodes.length === 0 && searchTerms.length > 0) {
      previewSearchEmptyElement.hidden = false;
      syncPreviewPanelVisibility(false);
      return;
    }

    previewElement.append(...contentNodes);
    syncPreviewPanelVisibility(true);
    return;
  }

  if (matchesDetailSearch(output, searchTerms)) {
    const pre = document.createElement("pre");
    pre.className = "preview-raw";
    appendHighlightedText(pre, output, searchTerms);
    contentNodes.push(pre);
  }

  if (contentNodes.length === 0 && searchTerms.length > 0) {
    previewSearchEmptyElement.hidden = false;
    syncPreviewPanelVisibility(false);
    return;
  }

  if (contentNodes.length === 0) {
    previewElement.append(createPreviewEmptyState(capture));
    syncPreviewPanelVisibility(true);
    return;
  }

  previewElement.append(...contentNodes);
  syncPreviewPanelVisibility(true);
}

function createPreviewEmptyState(capture: FailedApiCapture): HTMLElement {
  const note = document.createElement("p");
  note.className = "pv-empty";

  const hasPayload = capture.requestPayload.trim().length > 0;
  const hasResponse = capture.responseBody.trim().length > 0;
  const base64Response = isBase64Response(capture);

  if (!hasPayload && state.settings.sections.payload) {
    note.textContent =
      "This request has no payload. Turn off the Payload section or choose another request.";
    return note;
  }

  if (base64Response && state.settings.sections.response) {
    note.textContent =
      "Response body is base64-encoded and was omitted. Check the Network panel for the raw body.";
    return note;
  }

  if (!hasResponse && state.settings.sections.response) {
    note.textContent =
      "This request has no response body. Turn off the Response section or inspect headers/status only.";
    return note;
  }

  note.textContent =
    "Nothing selected to copy. Enable sections in Include or switch to a format that includes available data.";
  return note;
}

function renderPreviewNotices(output: string): void {
  previewNoticesElement.replaceChildren();

  const notices: HTMLElement[] = [];

  // if (output.length >= LARGE_OUTPUT_WARNING_THRESHOLD) {
  //   notices.push(
  //     createPreviewNotice(
  //       "warning",
  //       "Large output",
  //       `This preview is ${output.length.toLocaleString()} characters. Copying may be slow or truncated by some apps.`
  //     )
  //   );
  // }

  if (isReplayFormat(state.settings.outputFormat)) {
    notices.push(
      createPreviewNotice(
        "info",
        "Replay notice",
        "Replay snippets may need environment-specific headers or auth."
      )
    );
  }

  if (!state.settings.redactSecrets) {
    notices.push(
      createPreviewNotice(
        "warning",
        "Sensitive data",
        "You are about to copy potentially sensitive data. Redaction is currently disabled."
      )
    );
  }

  previewNoticesElement.hidden = notices.length === 0;
  previewNoticesElement.append(...notices);
}

function createPreviewNotice(
  kind: "warning" | "info",
  title: string,
  message: string
): HTMLElement {
  const notice = document.createElement("div");
  notice.className = `preview-notice preview-notice-${kind}`;
  notice.setAttribute("role", kind === "warning" ? "alert" : "status");
  notice.innerHTML = `<strong>${title}:</strong> ${message}`;
  return notice;
}

function createSection(field: Field, searchTerms: readonly string[]): HTMLElement | null {
  const searchableText = getFieldSearchText(field);

  if (!matchesDetailSearch(searchableText, searchTerms)) {
    return null;
  }

  if (field.kind === "inline") {
    return createInlineSection(field, searchTerms);
  }

  const section = document.createElement("details");
  section.className = "pv-section pv-block accordion-details";
  section.open = true;

  const header = document.createElement("summary");
  header.className = "pv-header accordion-trigger";

  const label = document.createElement("span");
  label.className = "pv-label";
  label.textContent = field.label;
  header.append(label);

  header.append(createCopyButton(field.body));

  header.append(createAccordionChevron());

  section.append(header);

  const body = document.createElement("pre");
  body.className = "pv-body";
  appendHighlightedText(body, field.body, searchTerms);
  section.append(body);

  return section;
}

function createInlineSection(field: Field, searchTerms: readonly string[]): HTMLElement | null {
  if (field.kind !== "inline") {
    return null;
  }

  const section = document.createElement("div");
  section.className = "pv-section pv-inline";

  const header = document.createElement("div");
  header.className = "pv-header";

  const label = document.createElement("span");
  label.className = "pv-label";
  label.textContent = `${field.label}:`;
  header.append(label);

  const value = document.createElement("span");
  value.className = "pv-value";
  appendHighlightedText(value, field.value, searchTerms);
  value.title = field.value;
  header.append(value);

  header.append(createCopyButton(field.value));
  section.append(header);

  return section;
}

function createCopyButton(text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pv-copy";
  button.title = "Copy";
  button.setAttribute("aria-label", "Copy this section");
  button.innerHTML = COPY_ICON;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void copyWithSafetyCheck(text, button);
  });

  return button;
}

function createOverviewSection(
  capture: FailedApiCapture,
  searchTerms: readonly string[]
): HTMLElement | null {
  const rows: Array<[string, Node, string]> = [];

  if (capture.method) {
    rows.push(["Method", createMethodBadge(capture.method), capture.method]);
  }
  if (capture.durationMs !== null) {
    const duration = formatDuration(capture.durationMs);
    rows.push(["Duration", textValue(duration), duration]);
  }
  if (capture.startedAt) {
    rows.push(["Time", textValue(capture.startedAt, true), capture.startedAt]);
  }

  const overviewRows: Array<[HTMLElement, HTMLElement]> = [];
  for (const [label, value, searchableText] of rows) {
    if (!matchesDetailSearch(searchableText, searchTerms)) {
      continue;
    }

    overviewRows.push(overviewRow(label, value, searchableText, searchTerms));
  }

  if (overviewRows.length === 0) {
    return null;
  }

  const section = document.createElement("details");
  section.className = "pv-section pv-block pv-overview accordion-details";

  const header = document.createElement("summary");
  header.className = "pv-header accordion-trigger";

  const label = document.createElement("span");
  label.className = "pv-label";
  label.textContent = "Overview";
  header.append(label);

  header.append(createAccordionChevron());

  section.append(header);

  const body = document.createElement("div");
  body.className = "pv-overview-body";

  const list = document.createElement("dl");
  list.className = "overview";
  for (const [dt, dd] of overviewRows) {
    list.append(dt, dd);
  }
  body.append(list);
  section.append(body);

  return section;
}

function overviewRow(
  label: string,
  value: Node,
  searchableText: string,
  searchTerms: readonly string[]
): [HTMLElement, HTMLElement] {
  const dt = document.createElement("dt");
  appendHighlightedText(dt, label, searchTerms);

  const dd = document.createElement("dd");
  if (value instanceof HTMLElement && value.classList.contains("overview-text")) {
    appendHighlightedText(value, searchableText, searchTerms);
    dd.append(value);
  } else if (value instanceof HTMLElement && value.classList.contains("overview-mono")) {
    appendHighlightedText(value, searchableText, searchTerms);
    dd.append(value);
  } else {
    dd.append(value);
  }

  return [dt, dd];
}

function textValue(text: string, mono = false): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = mono ? "overview-mono" : "overview-text";
  span.textContent = text;
  return span;
}

function buildCopyOutput(capture: FailedApiCapture): string {
  return formatCapture(capture, {
    outputFormat: state.settings.outputFormat,
    sections: state.settings.sections,
    redactSecrets: state.settings.redactSecrets,
    includeEndpointBaseUrl: state.settings.includeEndpointBaseUrl
  });
}

function syncEndpointBaseUrlControl(): void {
  const endpointEnabled = state.settings.sections.endpoint;
  includeEndpointBaseUrlCheckbox.disabled = !endpointEnabled;

  const label = includeEndpointBaseUrlCheckbox.closest("label");
  if (label instanceof HTMLLabelElement) {
    label.classList.toggle("is-disabled", !endpointEnabled);
  }
}

async function copyCapture(capture: FailedApiCapture | undefined | null): Promise<void> {
  if (capture === undefined || capture === null) {
    showToast("No failed API call to copy.");
    return;
  }

  const text = buildCopyOutput(capture);

  if (text.length === 0) {
    showToast("Nothing to copy for the current format and section settings.");
    return;
  }

  await copyWithSafetyCheck(text);
}

async function copyWithSafetyCheck(text: string, button?: HTMLButtonElement): Promise<void> {
  if (!state.settings.redactSecrets) {
    const confirmed = window.confirm(
      "You are about to copy potentially sensitive data.\n\nContinue without redaction?"
    );
    if (!confirmed) {
      return;
    }
  }

  await copyText(text, button);
}

async function copyText(text: string, button?: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);

    if (button !== undefined) {
      button.classList.add("copied");
      button.innerHTML = CHECK_ICON;
      button.title = "Copied";

      window.setTimeout(() => {
        button.classList.remove("copied");
        button.innerHTML = COPY_ICON;
        button.title = "Copy";
      }, 1200);
      return;
    }

    showToast("Copied failed API details.");
  } catch {
    showToast(
      "Clipboard copy failed. Select the preview text and copy manually, or check clipboard permissions."
    );
  }
}

function getFilteredCaptures(): FailedApiCapture[] {
  return filterAndSortCaptures(state.captures, {
    searchText: state.searchText,
    outcomeFilter: state.settings.outcomeFilter,
    methodFilter: state.settings.methodFilter,
    sortMode: state.settings.sortMode
  });
}

function getSelectedCapture(): FailedApiCapture | null {
  return state.captures.find((capture) => capture.id === state.selectedCaptureId) ?? null;
}

function createMethodBadge(method: string): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = `badge method-${methodModifier(method)}`;
  badge.textContent = method.toUpperCase();
  return badge;
}

function createStatusBadge(status: number, statusText: string): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = `badge status-${statusModifier(status)}`;
  badge.textContent = status === 0 ? "ERR" : status.toString();
  badge.title = status === 0 ? "Network error / no response" : `${status} ${statusText}`.trim();
  return badge;
}

function methodModifier(method: string): string {
  const known = ["get", "post", "put", "patch", "delete", "head", "options"];
  const lower = method.toLowerCase();
  return known.includes(lower) ? lower : "other";
}

function statusModifier(status: number): string {
  if (status === 0) {
    return "err";
  }
  if (status >= 500) {
    return "5xx";
  }
  if (status >= 400) {
    return "4xx";
  }
  if (status >= 300) {
    return "3xx";
  }
  if (status >= 200) {
    return "2xx";
  }
  return "other";
}

function statusColorVar(status: number): string {
  return `var(--c-status-${statusModifier(status)})`;
}

function getUrlPath(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return rawUrl;
  }
}

function getUrlPathname(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return rawUrl;
  }
}

function getUrlQuery(rawUrl: string): string {
  try {
    return new URL(rawUrl).search;
  } catch {
    return "";
  }
}

function getUrlHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).host;
  } catch {
    return "";
  }
}

function formatDuration(durationMs: number | null): string {
  return durationMs === null ? "unknown" : `${Math.round(durationMs)}ms`;
}

function showToast(message: string): void {
  toastElement.textContent = message;
  toastElement.classList.add("visible");

  window.setTimeout(() => {
    toastElement.classList.remove("visible");
  }, 2200);
}

function isSectionKey(value: string): value is keyof UserSettings["sections"] {
  return value in state.settings.sections;
}

function readOutputFormat(value: string): OutputFormat {
  const formats: OutputFormat[] = [
    "plainText",
    "markdown",
    "slackCompact",
    "jsonBundle",
    "curl",
    "fetchSnippet"
  ];
  return formats.includes(value as OutputFormat) ? (value as OutputFormat) : "plainText";
}

function readOutcomeFilter(value: string): UserSettings["outcomeFilter"] {
  const options: UserSettings["outcomeFilter"][] = ["all", "succeeded", "failed"];
  return options.includes(value as UserSettings["outcomeFilter"])
    ? (value as UserSettings["outcomeFilter"])
    : "all";
}

function readMethodFilter(value: string): UserSettings["methodFilter"] {
  const options: UserSettings["methodFilter"][] = [
    "all",
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OTHER"
  ];
  return options.includes(value as UserSettings["methodFilter"])
    ? (value as UserSettings["methodFilter"])
    : "all";
}

function readSortMode(value: string): UserSettings["sortMode"] {
  const options: UserSettings["sortMode"][] = ["newest", "oldest", "status", "slowest"];
  return options.includes(value as UserSettings["sortMode"])
    ? (value as UserSettings["sortMode"])
    : "newest";
}

function readListViewMode(value: string): UserSettings["listViewMode"] {
  const options: UserSettings["listViewMode"][] = ["individual", "grouped"];
  return options.includes(value as UserSettings["listViewMode"])
    ? (value as UserSettings["listViewMode"])
    : "individual";
}

function getDetailSearchTerms(): string[] {
  return state.detailSearchText.length > 0 ? [state.detailSearchText] : [];
}

function matchesDetailSearch(text: string, searchTerms: readonly string[]): boolean {
  if (searchTerms.length === 0) {
    return true;
  }

  const lowerText = text.toLowerCase();
  return searchTerms.every((term) => lowerText.includes(term));
}

function getFieldSearchText(field: Field): string {
  return field.kind === "inline" ? `${field.label} ${field.value}` : `${field.label} ${field.body}`;
}

function appendHighlightedText(
  element: HTMLElement,
  text: string,
  searchTerms: readonly string[]
): void {
  element.replaceChildren();

  if (searchTerms.length === 0) {
    element.textContent = text;
    return;
  }

  const lowerText = text.toLowerCase();
  const matchRanges: Array<[number, number]> = [];

  for (const term of searchTerms) {
    let start = 0;
    let index = lowerText.indexOf(term, start);

    while (index !== -1) {
      matchRanges.push([index, index + term.length]);
      start = index + term.length;
      index = lowerText.indexOf(term, start);
    }
  }

  if (matchRanges.length === 0) {
    element.textContent = text;
    return;
  }

  matchRanges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const mergedRanges: Array<[number, number]> = [];
  for (const range of matchRanges) {
    const last = mergedRanges.at(-1);
    if (last === undefined || range[0] > last[1]) {
      mergedRanges.push(range);
      continue;
    }

    last[1] = Math.max(last[1], range[1]);
  }

  let cursor = 0;
  for (const [start, end] of mergedRanges) {
    if (cursor < start) {
      element.append(document.createTextNode(text.slice(cursor, start)));
    }

    const mark = document.createElement("mark");
    mark.className = "search-highlight";
    mark.textContent = text.slice(start, end);
    element.append(mark);
    cursor = end;
  }

  if (cursor < text.length) {
    element.append(document.createTextNode(text.slice(cursor)));
  }
}

function syncPreviewPanelVisibility(hasVisiblePreview: boolean): void {
  const previewPanel = document.getElementById("preview-panel");
  if (!(previewPanel instanceof HTMLElement)) {
    return;
  }

  const searchTerms = getDetailSearchTerms();
  const details = previewPanel.querySelector(".accordion-details");
  if (details instanceof HTMLDetailsElement && searchTerms.length > 0 && hasVisiblePreview) {
    details.open = true;
  }
}

function getElement<T extends HTMLElement>(
  id: string,
  constructor: { new (): T }
): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element: ${id}`);
  }

  return element;
}
