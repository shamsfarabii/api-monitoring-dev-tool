import type { FailedApiCapture } from "./types";
import type { CopySections, OutputFormat } from "./types";
import { captureFields, type Field, type FormatContext } from "./format/fields";
import { renderPlain } from "./formatters/plainText";
import { formatMarkdown } from "./formatters/markdown";
import { formatSlackCompact } from "./formatters/slack";
import { formatJsonBundle } from "./formatters/jsonBundle";
import { formatCurl } from "./formatters/curl";
import { formatFetchSnippet } from "./formatters/fetchSnippet";

export type { Field, FormatContext };
export { captureFields };

export const defaultCopySections: CopySections = {
  method: true,
  endpoint: true,
  status: false,
  requestHeaders: false,
  payload: true,
  responseHeaders: false,
  response: true
};

export type FormatOptions = {
  outputFormat: OutputFormat;
  sections: CopySections;
  redactSecrets: boolean;
  includeEndpointBaseUrl: boolean;
};

export const defaultFormatOptions: FormatOptions = {
  outputFormat: "plainText",
  sections: defaultCopySections,
  redactSecrets: true,
  includeEndpointBaseUrl: false
};

export function buildFormatContext(options: FormatOptions): FormatContext {
  return {
    sections: options.sections,
    redactSecrets: options.redactSecrets,
    includeEndpointBaseUrl: options.includeEndpointBaseUrl
  };
}

export function formatCapture(
  capture: FailedApiCapture,
  options: FormatOptions = defaultFormatOptions
): string {
  const context = buildFormatContext(options);

  switch (options.outputFormat) {
    case "plainText":
      return renderPlain(captureFields(capture, context));
    case "markdown":
      return formatMarkdown(capture, context);
    case "slackCompact":
      return formatSlackCompact(capture, context);
    case "jsonBundle":
      return formatJsonBundle(capture, context);
    case "curl":
      return formatCurl(capture, context);
    case "fetchSnippet":
      return formatFetchSnippet(capture, context);
    default:
      return renderPlain(captureFields(capture, context));
  }
}

export function isReplayFormat(format: OutputFormat): boolean {
  return format === "curl" || format === "fetchSnippet";
}

export const LARGE_OUTPUT_WARNING_THRESHOLD = 50_000;
