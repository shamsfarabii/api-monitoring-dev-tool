import type { FailedApiCapture } from "../types";
import type { FormatContext } from "../format/fields";
import { formatBodyOrNull } from "../format/fields";
import { filterReplayHeaders, shellEscapeSingleQuotes } from "../format/headers";

export function formatCurl(capture: FailedApiCapture, context: FormatContext): string {
  const { sections, redactSecrets: redact } = context;
  const includeUnsafeAuth = redact === false;
  const parts: string[] = ["curl", "-X", capture.method, shellEscapeSingleQuotes(capture.url)];

  if (sections.requestHeaders) {
    const headers = filterReplayHeaders(capture.requestHeaders, redact, includeUnsafeAuth);
    for (const header of headers) {
      parts.push("-H", shellEscapeSingleQuotes(`${header.name}: ${header.value}`));
    }
  }

  if (sections.payload) {
    const body = formatBodyOrNull(capture.requestPayload, redact);
    if (body !== null) {
      const payloadForCurl = unwrapJsonString(body);
      parts.push("-d", shellEscapeSingleQuotes(payloadForCurl));
    }
  }

  parts.push("--compressed");

  return parts.join(" ");
}

function unwrapJsonString(formattedBody: string): string {
  try {
    return JSON.stringify(JSON.parse(formattedBody) as unknown);
  } catch {
    return formattedBody;
  }
}
