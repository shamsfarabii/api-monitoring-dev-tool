export const sensitiveKeyPattern =
  /authorization|cookie|set-cookie|token|secret|password|passwd|api[-_]?key|apikey|session|jwt|bearer|x-api-key/i;

export function isSensitiveKey(key: string): boolean {
  return sensitiveKeyPattern.test(key);
}

export function redactUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactUnknown);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : redactUnknown(nestedValue)
      ])
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
