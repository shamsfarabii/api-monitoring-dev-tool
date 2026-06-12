import type { FailedApiCapture } from "../types";
import type { FormatContext } from "../format/fields";
import {
  formatBodyOrNull,
  getEndpointDisplay,
  getQueryParams,
  isBase64Response,
  responseBodyOrNull
} from "../format/fields";
import { formatHeadersBlock } from "../format/headers";

export function formatMarkdown(capture: FailedApiCapture, context: FormatContext): string {
  const { sections, redactSecrets: redact, includeEndpointBaseUrl } = context;
  const lines: string[] = ["# API Failure Report", ""];

  if (sections.endpoint) {
    const endpoint = getEndpointDisplay(capture.url, includeEndpointBaseUrl);
    const endpointLabel = includeEndpointBaseUrl ? "URL" : "URL path";
    lines.push("## Endpoint", "", `- **${endpointLabel}:** \`${endpoint}\``);

    const query = getQueryParams(capture.url, redact);
    if (query.length > 0) {
      lines.push("", "### Query params", "");
      for (const [key, value] of query) {
        lines.push(`- \`${key}\`: ${value}`);
      }
    }
    lines.push("");
  }

  if (sections.method) {
    lines.push("## Method", "", `\`${capture.method}\``, "");
  }

  if (sections.status) {
    lines.push("## Status & timing", "");
    lines.push(`- **Status:** ${capture.status}${capture.statusText ? ` ${capture.statusText}` : ""}`);
    if (capture.durationMs !== null) {
      lines.push(`- **Duration:** ${Math.round(capture.durationMs)}ms`);
    }
    if (capture.startedAt) {
      lines.push(`- **Timestamp:** ${capture.startedAt}`);
    }
    if (capture.requestId) {
      lines.push(`- **Request ID:** \`${capture.requestId}\``);
    }
    lines.push("");
  }

  if (sections.requestHeaders && capture.requestHeaders.length > 0) {
    lines.push(
      "## Request headers",
      "",
      "```json",
      formatHeadersBlock(capture.requestHeaders, redact),
      "```",
      ""
    );
  }

  if (sections.payload) {
    const payload = formatBodyOrNull(capture.requestPayload, redact);
    if (payload !== null) {
      lines.push("## Payload", "", fenceForBody(payload), "");
    }
  }

  if (sections.responseHeaders && capture.responseHeaders.length > 0) {
    lines.push(
      "## Response headers",
      "",
      "```json",
      formatHeadersBlock(capture.responseHeaders, redact),
      "```",
      ""
    );
  }

  if (sections.response) {
    if (isBase64Response(capture)) {
      lines.push("## Response", "", "_Response body omitted (base64 encoded)._", "");
    } else {
      const response = responseBodyOrNull(capture, redact);
      if (response !== null) {
        lines.push("## Response", "", fenceForBody(response), "");
      }
    }
  }

  return lines.join("\n").trim();
}

function fenceForBody(body: string): string {
  const language = looksLikeJson(body) ? "json" : "text";
  return `\`\`\`${language}\n${body}\n\`\`\``;
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
