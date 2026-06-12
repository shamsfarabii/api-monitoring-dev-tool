import type { FailedApiCapture } from "../types";
import type { FormatContext } from "../format/fields";
import { formatBodyOrNull } from "../format/fields";
import { filterReplayHeaders, jsStringLiteral } from "../format/headers";

export function formatFetchSnippet(capture: FailedApiCapture, context: FormatContext): string {
  const { sections, redactSecrets: redact } = context;
  const includeUnsafeAuth = redact === false;
  const lines: string[] = ["fetch(" + jsStringLiteral(capture.url) + ", {"];

  lines.push(`  method: ${jsStringLiteral(capture.method)},`);

  if (sections.requestHeaders) {
    const headers = filterReplayHeaders(capture.requestHeaders, redact, includeUnsafeAuth);
    if (headers.length > 0) {
      lines.push("  headers: {");
      for (const header of headers) {
        lines.push(`    ${jsStringLiteral(header.name)}: ${jsStringLiteral(header.value)},`);
      }
      lines.push("  },");
    }
  }

  if (sections.payload) {
    const body = formatBodyOrNull(capture.requestPayload, redact);
    if (body !== null) {
      const payloadLiteral = toFetchBodyLiteral(body);
      lines.push(`  body: ${payloadLiteral},`);
    }
  }

  lines.push("});");

  return lines.join("\n");
}

function toFetchBodyLiteral(formattedBody: string): string {
  try {
    const parsed = JSON.parse(formattedBody) as unknown;
    return `JSON.stringify(${JSON.stringify(parsed, null, 2).split("\n").join("\n  ")})`;
  } catch {
    return jsStringLiteral(formattedBody);
  }
}
