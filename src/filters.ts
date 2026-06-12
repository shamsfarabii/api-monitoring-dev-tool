import type {
  FailedApiCapture,
  MethodFilter,
  OutcomeFilter,
  SortMode
} from "./types";

export type ApiCaptureGroup = {
  key: string;
  captures: FailedApiCapture[];
};

const knownMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function filterAndSortCaptures(
  captures: readonly FailedApiCapture[],
  input: {
    searchText: string;
    outcomeFilter: OutcomeFilter;
    methodFilter: MethodFilter;
    sortMode: SortMode;
  }
): FailedApiCapture[] {
  const filtered = captures.filter((capture) => {
    if (!matchesOutcomeFilter(capture, input.outcomeFilter)) {
      return false;
    }

    if (!matchesMethodFilter(capture, input.methodFilter)) {
      return false;
    }

    if (input.searchText.length === 0) {
      return true;
    }

    const searchableText = [
      capture.method,
      capture.url,
      capture.status.toString(),
      capture.statusText,
      capture.requestId ?? ""
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(input.searchText);
  });

  return sortCaptures(filtered, input.sortMode);
}

export function isFailedApiStatus(status: number): boolean {
  return status >= 400 || status === 0;
}

function matchesOutcomeFilter(capture: FailedApiCapture, outcomeFilter: OutcomeFilter): boolean {
  switch (outcomeFilter) {
    case "all":
      return true;
    case "succeeded":
      return !isFailedApiStatus(capture.status);
    case "failed":
      return isFailedApiStatus(capture.status);
    default:
      return true;
  }
}

function matchesMethodFilter(capture: FailedApiCapture, methodFilter: MethodFilter): boolean {
  if (methodFilter === "all") {
    return true;
  }

  if (methodFilter === "OTHER") {
    return !knownMethods.has(capture.method.toUpperCase());
  }

  return capture.method.toUpperCase() === methodFilter;
}

export function getApiGroupKey(capture: FailedApiCapture): string {
  const method = capture.method.toUpperCase();

  try {
    const url = new URL(capture.url);
    return `${method} ${url.origin}${url.pathname}`;
  } catch {
    return `${method} ${capture.url}`;
  }
}

export function groupCapturesByApi(
  captures: readonly FailedApiCapture[]
): ApiCaptureGroup[] {
  const groups = new Map<string, FailedApiCapture[]>();
  const order: string[] = [];

  for (const capture of captures) {
    const key = getApiGroupKey(capture);
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, [capture]);
      order.push(key);
      continue;
    }

    existing.push(capture);
  }

  return order.map((key) => ({
    key,
    captures: groups.get(key) ?? []
  }));
}

function sortCaptures(captures: readonly FailedApiCapture[], sortMode: SortMode): FailedApiCapture[] {
  const sorted = [...captures];

  switch (sortMode) {
    case "newest":
      return sorted;
    case "oldest":
      return sorted.reverse();
    case "status":
      return sorted.sort((left, right) => left.status - right.status);
    case "slowest":
      return sorted.sort((left, right) => {
        const leftDuration = left.durationMs ?? -1;
        const rightDuration = right.durationMs ?? -1;
        return rightDuration - leftDuration;
      });
    default:
      return sorted;
  }
}
