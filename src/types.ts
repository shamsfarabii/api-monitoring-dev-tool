export type Header = {
  name: string;
  value: string;
};

export type FailedApiCapture = {
  id: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number | null;
  startedAt: string;
  requestId: string | null;
  requestHeaders: Header[];
  responseHeaders: Header[];
  requestPayload: string;
  responseBody: string;
  responseEncoding: string;
  responseMimeType: string;
};

export type OutputFormat =
  | "plainText"
  | "markdown"
  | "slackCompact"
  | "jsonBundle"
  | "curl"
  | "fetchSnippet";

export type OutcomeFilter = "all" | "succeeded" | "failed";

export type MethodFilter =
  | "all"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OTHER";

export type SortMode = "newest" | "oldest" | "status" | "slowest";

export type ListViewMode = "individual" | "grouped";

export type CopySections = {
  method: boolean;
  endpoint: boolean;
  status: boolean;
  requestHeaders: boolean;
  payload: boolean;
  responseHeaders: boolean;
  response: boolean;
};

export type UserSettings = {
  outputFormat: OutputFormat;
  redactSecrets: boolean;
  includeEndpointBaseUrl: boolean;
  sections: CopySections;
  outcomeFilter: OutcomeFilter;
  methodFilter: MethodFilter;
  sortMode: SortMode;
  listViewMode: ListViewMode;
};

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  plainText: "Plain Text",
  markdown: "Markdown Bug Report",
  slackCompact: "Slack Compact",
  jsonBundle: "JSON Debug Bundle",
  curl: "cURL Replay",
  fetchSnippet: "fetch() Replay"
};
