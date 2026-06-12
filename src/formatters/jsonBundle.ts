import type { FailedApiCapture } from "../types";
import type { FormatContext } from "../format/fields";
import {
  captureFields,
  formatBodyOrNull,
  getEndpointDisplay,
  getQueryParams,
  isBase64Response,
  responseBodyOrNull
} from "../format/fields";
import { headersToRecord } from "../format/headers";

export function formatJsonBundle(capture: FailedApiCapture, context: FormatContext): string {
  const { sections, redactSecrets: redact, includeEndpointBaseUrl } = context;
  const bundle: Record<string, unknown> = {};

  if (sections.endpoint) {
    bundle.endpoint = {
      path: getEndpointDisplay(capture.url, includeEndpointBaseUrl),
      url: capture.url,
      queryParams: Object.fromEntries(getQueryParams(capture.url, redact))
    };
  }

  if (sections.method) {
    bundle.method = capture.method;
  }

  if (sections.status) {
    bundle.status = {
      code: capture.status,
      text: capture.statusText,
      durationMs: capture.durationMs,
      startedAt: capture.startedAt,
      requestId: capture.requestId
    };
  }

  if (sections.requestHeaders && capture.requestHeaders.length > 0) {
    bundle.requestHeaders = headersToRecord(capture.requestHeaders, redact);
  }

  if (sections.payload) {
    const payload = formatBodyOrNull(capture.requestPayload, redact);
    if (payload !== null) {
      bundle.payload = parseJsonOrString(payload);
    }
  }

  if (sections.responseHeaders && capture.responseHeaders.length > 0) {
    bundle.responseHeaders = headersToRecord(capture.responseHeaders, redact);
  }

  if (sections.response) {
    if (isBase64Response(capture)) {
      bundle.response = { omitted: true, reason: "base64 encoded" };
    } else {
      const response = responseBodyOrNull(capture, redact);
      if (response !== null) {
        bundle.response = parseJsonOrString(response);
      }
    }
  }

  if (Object.keys(bundle).length === 0) {
    const fields = captureFields(capture, context);
    if (fields.length === 0) {
      return "{}";
    }
  }

  return JSON.stringify(bundle, null, 2);
}

function parseJsonOrString(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
