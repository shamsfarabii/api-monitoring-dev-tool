import {
  type CopySections,
  type MethodFilter,
  type OutputFormat,
  type ListViewMode,
  type SortMode,
  type OutcomeFilter,
  type UserSettings
} from "./types";
import { defaultCopySections } from "./format";

const settingsStorageKey = "failed-api-copier:settings";
const legacySectionsStorageKey = "failed-api-copier:sections";

const outputFormats: readonly OutputFormat[] = [
  "plainText",
  "markdown",
  "slackCompact",
  "jsonBundle",
  "curl",
  "fetchSnippet"
];

const outcomeFilters: readonly OutcomeFilter[] = ["all", "succeeded", "failed"];
const methodFilters: readonly MethodFilter[] = [
  "all",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OTHER"
];
const sortModes: readonly SortMode[] = ["newest", "oldest", "status", "slowest"];
const listViewModes: readonly ListViewMode[] = ["individual", "grouped"];

export const defaultUserSettings: UserSettings = {
  outputFormat: "plainText",
  redactSecrets: true,
  includeEndpointBaseUrl: false,
  sections: { ...defaultCopySections },
  outcomeFilter: "all",
  methodFilter: "all",
  sortMode: "newest",
  listViewMode: "individual"
};

export async function loadUserSettings(): Promise<UserSettings> {
  const stored = await readStoredSettings();
  const migrated = migrateLegacySections(stored);
  return validateUserSettings(migrated);
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const validated = validateUserSettings(settings);

  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [settingsStorageKey]: validated });
      return;
    }
  } catch {
    // Fall through to localStorage.
  }

  try {
    localStorage.setItem(settingsStorageKey, JSON.stringify(validated));
  } catch {
    // Persisting preferences is best-effort.
  }
}

function migrateLegacySections(stored: unknown): unknown {
  if (stored !== null && typeof stored === "object") {
    return stored;
  }

  try {
    const legacyRaw = localStorage.getItem(legacySectionsStorageKey);
    if (legacyRaw === null) {
      return null;
    }

    const legacy = JSON.parse(legacyRaw) as Record<string, unknown>;
    const { redactSecrets, ...sections } = legacy;

    return {
      sections,
      redactSecrets: typeof redactSecrets === "boolean" ? redactSecrets : true
    };
  } catch {
    return null;
  }
}

async function readStoredSettings(): Promise<unknown> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const result = await chrome.storage.local.get(settingsStorageKey);
      const value = result[settingsStorageKey];
      if (value !== undefined) {
        return value;
      }
    }
  } catch {
    // Fall through to localStorage.
  }

  try {
    const raw = localStorage.getItem(settingsStorageKey);
    if (raw === null) {
      return null;
    }

    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function validateUserSettings(value: unknown): UserSettings {
  if (!isRecord(value)) {
    return { ...defaultUserSettings };
  }

  return {
    outputFormat: isOutputFormat(value.outputFormat)
      ? value.outputFormat
      : defaultUserSettings.outputFormat,
    redactSecrets:
      typeof value.redactSecrets === "boolean"
        ? value.redactSecrets
        : defaultUserSettings.redactSecrets,
    includeEndpointBaseUrl:
      typeof value.includeEndpointBaseUrl === "boolean"
        ? value.includeEndpointBaseUrl
        : defaultUserSettings.includeEndpointBaseUrl,
    sections: validateCopySections(value.sections),
    outcomeFilter: readOutcomeFilter(value),
    methodFilter: isMethodFilter(value.methodFilter)
      ? value.methodFilter
      : defaultUserSettings.methodFilter,
    sortMode: isSortMode(value.sortMode) ? value.sortMode : defaultUserSettings.sortMode,
    listViewMode: isListViewMode(value.listViewMode)
      ? value.listViewMode
      : defaultUserSettings.listViewMode
  };
}

function validateCopySections(value: unknown): CopySections {
  if (!isRecord(value)) {
    return { ...defaultCopySections };
  }

  return {
    method: typeof value.method === "boolean" ? value.method : defaultCopySections.method,
    endpoint: typeof value.endpoint === "boolean" ? value.endpoint : defaultCopySections.endpoint,
    status: typeof value.status === "boolean" ? value.status : defaultCopySections.status,
    requestHeaders:
      typeof value.requestHeaders === "boolean"
        ? value.requestHeaders
        : defaultCopySections.requestHeaders,
    payload: typeof value.payload === "boolean" ? value.payload : defaultCopySections.payload,
    responseHeaders:
      typeof value.responseHeaders === "boolean"
        ? value.responseHeaders
        : defaultCopySections.responseHeaders,
    response: typeof value.response === "boolean" ? value.response : defaultCopySections.response
  };
}

function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === "string" && outputFormats.includes(value as OutputFormat);
}

function readOutcomeFilter(value: Record<string, unknown>): OutcomeFilter {
  if (isOutcomeFilter(value.outcomeFilter)) {
    return value.outcomeFilter;
  }

  const legacyStatusFilter = value.statusFilter;
  if (legacyStatusFilter === "4xx" || legacyStatusFilter === "5xx" || legacyStatusFilter === "network") {
    return "failed";
  }

  return defaultUserSettings.outcomeFilter;
}

function isOutcomeFilter(value: unknown): value is OutcomeFilter {
  return typeof value === "string" && outcomeFilters.includes(value as OutcomeFilter);
}

function isMethodFilter(value: unknown): value is MethodFilter {
  return typeof value === "string" && methodFilters.includes(value as MethodFilter);
}

function isSortMode(value: unknown): value is SortMode {
  return typeof value === "string" && sortModes.includes(value as SortMode);
}

function isListViewMode(value: unknown): value is ListViewMode {
  return typeof value === "string" && listViewModes.includes(value as ListViewMode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
