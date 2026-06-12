import type { Header } from "../types";
import { isSensitiveKey } from "./redaction";

const curlFetchExcludedHeaders =
  /^(cookie|origin|referer|user-agent|sec-.*|proxy-.*|host|content-length|connection|keep-alive|transfer-encoding)$/i;

export function redactHeaderValue(name: string, value: string, redact: boolean): string {
  if (redact && isSensitiveKey(name)) {
    return "[REDACTED]";
  }

  return value;
}

export function filterReplayHeaders(
  headers: readonly Header[],
  redact: boolean,
  includeUnsafeAuth: boolean
): Header[] {
  return headers.filter((header) => {
    const lowerName = header.name.toLowerCase();

    if (curlFetchExcludedHeaders.test(lowerName)) {
      return false;
    }

    if (!includeUnsafeAuth && lowerName === "authorization") {
      return false;
    }

    if (redact && isSensitiveKey(header.name)) {
      return true;
    }

    return true;
  }).map((header) => ({
    name: header.name,
    value: redactHeaderValue(header.name, header.value, redact)
  }));
}

export function formatHeadersBlock(headers: readonly Header[], redact: boolean): string {
  return JSON.stringify(
    headers.map((header) => ({
      name: header.name,
      value: redactHeaderValue(header.name, header.value, redact)
    })),
    null,
    2
  );
}

export function headersToRecord(headers: readonly Header[], redact: boolean): Record<string, string> {
  const record: Record<string, string> = {};

  for (const header of headers) {
    record[header.name] = redactHeaderValue(header.name, header.value, redact);
  }

  return record;
}

export function shellEscapeSingleQuotes(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function jsStringLiteral(value: string): string {
  return JSON.stringify(value);
}
