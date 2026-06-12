import type { FailedApiCapture, Header } from "./types";

type RawDevtoolsRequest = {
  getContent: (callback: (content: string, encoding: string) => void) => void;
  request?: unknown;
  response?: unknown;
  startedDateTime?: unknown;
  time?: unknown;
  _resourceType?: unknown;
};

type PanelWindow = Window & {
  receiveCapturedFailures?: (captures: readonly FailedApiCapture[]) => void;
  clearCapturedFailures?: () => void;
};

const maxCapturedRequests = 100;
const captures: FailedApiCapture[] = [];

let panelWindow: PanelWindow | null = null;

chrome.devtools.panels.create(
  "API এর যত কাহিনী",
  "icons/panel.svg",
  "panel.html",
  (panel) => {
    panel.onShown.addListener((shownWindow) => {
      panelWindow = shownWindow as PanelWindow;
      panelWindow.clearCapturedFailures = clearCapturedFailures;
      publishCaptures();
    });

    panel.onHidden.addListener(() => {
      panelWindow = null;
    });
  }
);

chrome.devtools.network.onRequestFinished.addListener((finishedRequest) => {
  void handleFinishedRequest(finishedRequest);
});

async function handleFinishedRequest(input: unknown): Promise<void> {
  if (!isRawDevtoolsRequest(input)) {
    return;
  }

  const captureBase = createCaptureBase(input);

  if (captureBase === null) {
    return;
  }

  const responseContent = await getResponseContent(input);

  const capture: FailedApiCapture = {
    ...captureBase,
    responseBody: responseContent.content,
    responseEncoding: responseContent.encoding
  };

  captures.unshift(capture);

  if (captures.length > maxCapturedRequests) {
    captures.length = maxCapturedRequests;
  }

  publishCaptures();
}

function createCaptureBase(
  networkRequest: RawDevtoolsRequest
): Omit<FailedApiCapture, "responseBody" | "responseEncoding"> | null {
  if (!isRecord(networkRequest.request) || !isRecord(networkRequest.response)) {
    return null;
  }

  const method = readString(networkRequest.request.method);
  const url = readString(networkRequest.request.url);
  const status = readNumber(networkRequest.response.status);

  if (method === null || url === null || status === null) {
    return null;
  }

  const requestHeaders = normalizeHeaders(networkRequest.request.headers);
  const responseHeaders = normalizeHeaders(networkRequest.response.headers);
  const responseMimeType = readNestedString(networkRequest.response.content, "mimeType") ?? "";
  const requestPayload = readNestedString(networkRequest.request.postData, "text") ?? "";
  const statusText = readString(networkRequest.response.statusText) ?? "";
  const startedAt = readString(networkRequest.startedDateTime) ?? new Date().toISOString();
  const durationMs = readNumber(networkRequest.time);
  const resourceType = readString(networkRequest._resourceType) ?? "";

  if (!isFetchOrXhrRequest(resourceType)) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    method,
    url,
    status,
    statusText,
    durationMs,
    startedAt,
    requestId: findRequestId([...requestHeaders, ...responseHeaders]),
    requestHeaders,
    responseHeaders,
    requestPayload,
    responseMimeType
  };
}

function isFetchOrXhrRequest(resourceType: string): boolean {
  const lowerResourceType = resourceType.toLowerCase();
  return lowerResourceType === "xhr" || lowerResourceType === "fetch";
}

function getResponseContent(
  networkRequest: RawDevtoolsRequest
): Promise<{ content: string; encoding: string }> {
  return new Promise((resolve) => {
    try {
      networkRequest.getContent((content, encoding) => {
        resolve({
          content: content ?? "",
          encoding: encoding ?? ""
        });
      });
    } catch {
      resolve({
        content: "[Unable to read response body]",
        encoding: ""
      });
    }
  });
}

function publishCaptures(): void {
  panelWindow?.receiveCapturedFailures?.(captures);
}

function clearCapturedFailures(): void {
  captures.length = 0;
  publishCaptures();
}

function normalizeHeaders(headers: unknown): Header[] {
  if (!Array.isArray(headers)) {
    return [];
  }

  return headers.flatMap((header): Header[] => {
    if (!isRecord(header)) {
      return [];
    }

    const name = readString(header.name);
    const value = readString(header.value);

    if (name === null || value === null) {
      return [];
    }

    return [{ name, value }];
  });
}

function findRequestId(headers: readonly Header[]): string | null {
  return (
    findHeaderValue(headers, "x-request-id") ??
    findHeaderValue(headers, "x-correlation-id") ??
    findHeaderValue(headers, "traceparent") ??
    null
  );
}

function findHeaderValue(headers: readonly Header[], targetName: string): string | null {
  const match = headers.find((header) => header.name.toLowerCase() === targetName.toLowerCase());
  return match?.value ?? null;
}

function isRawDevtoolsRequest(value: unknown): value is RawDevtoolsRequest {
  return isRecord(value) && typeof value.getContent === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNestedString(parent: unknown, key: string): string | null {
  if (!isRecord(parent)) {
    return null;
  }

  return readString(parent[key]);
}
