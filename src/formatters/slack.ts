import type { FailedApiCapture } from "../types";
import type { FormatContext } from "../format/fields";
import { formatBodyOrNull, getEndpointDisplay, shortResponseSummary } from "../format/fields";

export function formatSlackCompact(capture: FailedApiCapture, context: FormatContext): string {
  const { sections, redactSecrets: redact, includeEndpointBaseUrl } = context;
  const lines: string[] = [];

  if (sections.method || sections.endpoint || sections.status) {
    const method = sections.method ? capture.method.toUpperCase() : null;
    const endpoint = sections.endpoint
      ? getEndpointDisplay(capture.url, includeEndpointBaseUrl)
      : null;
    const status = sections.status
      ? capture.status === 0
        ? "ERR"
        : `${capture.status}${capture.statusText ? ` ${capture.statusText}` : ""}`
      : null;

    const headline = [method, endpoint, status].filter((part) => part !== null).join(" · ");
    if (headline.length > 0) {
      lines.push(headline);
    }
  }

  if (sections.status && capture.requestId) {
    lines.push(`Request ID: ${capture.requestId}`);
  }

  if (sections.status && capture.durationMs !== null) {
    lines.push(`Duration: ${Math.round(capture.durationMs)}ms`);
  }

  if (sections.response || sections.status) {
    const summary = shortResponseSummary(capture, redact);
    lines.push(summary.includes("\n") ? `Error:\n${summary}` : `Error: ${summary}`);
  }

  if (sections.payload) {
    const payload = formatBodyOrNull(capture.requestPayload, redact);
    if (payload !== null) {
      lines.push(payload.includes("\n") ? `Payload:\n${payload}` : `Payload: ${payload}`);
    }
  }

  return lines.join("\n");
}
