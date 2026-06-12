import type { FailedApiCapture } from "../types";
import type { CopySections } from "../types";
import { formatHeadersBlock } from "./headers";
import { isSensitiveKey, redactUnknown } from "./redaction";
export type Field =
  | { kind: "inline"; label: string; value: string }
  | { kind: "block"; label: string; body: string };

export type FormatContext = {
  sections: CopySections;
  redactSecrets: boolean;
  includeEndpointBaseUrl: boolean;
};

export function getEndpointPath(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return rawUrl;
  }
}

export function getEndpointDisplay(rawUrl: string, includeBaseUrl: boolean): string {
  try {
    const url = new URL(rawUrl);
    if (includeBaseUrl) {
      return `${url.origin}${url.pathname}`;
    }
    return url.pathname;
  } catch {
    return rawUrl;
  }
}

export function getQueryParams(rawUrl: string, redact: boolean): Array<[string, string]> {
  try {
    const url = new URL(rawUrl);
    return Array.from(url.searchParams.entries()).map(
      ([key, value]): [string, string] => [
        key,
        redact && isSensitiveKey(key) ? "[REDACTED]" : value
      ]
    );
  } catch {
    return [];
  }
}

export function formatBody(rawBody: string, redact: boolean): string {
  try {
    const parsedBody = JSON.parse(rawBody.trim()) as unknown;
    const prepared = redact ? redactUnknown(parsedBody) : parsedBody;
    return JSON.stringify(prepared, null, 2);
  } catch {
    return rawBody;
  }
}

export function formatBodyOrNull(rawBody: string, redact: boolean): string | null {
  if (rawBody.trim().length === 0) {
    return null;
  }

  return formatBody(rawBody, redact);
}

export function responseBodyOrNull(capture: FailedApiCapture, redact: boolean): string | null {
  if (capture.responseEncoding === "base64") {
    return null;
  }

  return formatBodyOrNull(capture.responseBody, redact);
}

export function isBase64Response(capture: FailedApiCapture): boolean {
  return capture.responseEncoding === "base64";
}

export function captureFields(capture: FailedApiCapture, context: FormatContext): Field[] {
  const { sections, redactSecrets: redact, includeEndpointBaseUrl } = context;
  const fields: Field[] = [];

  if (sections.endpoint) {
    const endpoint = getEndpointDisplay(capture.url, includeEndpointBaseUrl);
    if (endpoint.length > 0) {
      fields.push({ kind: "inline", label: "API endpoint", value: endpoint });
    }

    const query = getQueryParams(capture.url, redact);
    if (query.length > 0) {
      fields.push({
        kind: "block",
        label: "Query params",
        body: query.map(([key, value]) => `${key}: ${value}`).join("\n")
      });
    }
  }

  if (sections.method && capture.method) {
    fields.push({ kind: "inline", label: "Method", value: capture.method });
  }

  if (sections.status) {
    fields.push({
      kind: "inline",
      label: "Status",
      value: `${capture.status}${capture.statusText ? ` ${capture.statusText}` : ""}`
    });

    if (capture.durationMs !== null) {
      fields.push({
        kind: "inline",
        label: "Duration",
        value: `${Math.round(capture.durationMs)}ms`
      });
    }
    if (capture.startedAt) {
      fields.push({ kind: "inline", label: "Time", value: capture.startedAt });
    }
    if (capture.requestId) {
      fields.push({ kind: "inline", label: "Request ID", value: capture.requestId });
    }
  }

  if (sections.requestHeaders && capture.requestHeaders.length > 0) {
    fields.push({
      kind: "block",
      label: "Request headers",
      body: formatHeadersBlock(capture.requestHeaders, redact)
    });
  }

  if (sections.payload) {
    const body = formatBodyOrNull(capture.requestPayload, redact);
    if (body !== null) {
      fields.push({ kind: "block", label: "Payload", body });
    }
  }

  if (sections.responseHeaders && capture.responseHeaders.length > 0) {
    fields.push({
      kind: "block",
      label: "Response headers",
      body: formatHeadersBlock(capture.responseHeaders, redact)
    });
  }

  if (sections.response) {
    if (isBase64Response(capture)) {
      fields.push({
        kind: "inline",
        label: "Response",
        value: "[base64 response body omitted]"
      });
    } else {
      const body = formatBodyOrNull(capture.responseBody, redact);
      if (body !== null) {
        fields.push({ kind: "block", label: "Response", body });
      }
    }
  }

  return fields;
}

export function shortResponseSummary(capture: FailedApiCapture, redact: boolean): string {
  if (capture.status === 0) {
    return capture.statusText || "Network error";
  }

  if (isBase64Response(capture)) {
    return "[base64 response omitted]";
  }

  const body = formatBodyOrNull(capture.responseBody, redact);
  if (body === null) {
    return capture.statusText || "No response body";
  }

  return body;
}
