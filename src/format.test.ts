import { describe, expect, it } from "vitest";
import { formatCapture, defaultFormatOptions } from "./format";
import { isSensitiveKey, redactUnknown } from "./format/redaction";
import { formatHeadersBlock, filterReplayHeaders } from "./format/headers";
import { formatBody } from "./format/fields";
import type { FailedApiCapture } from "./types";

const sampleCapture: FailedApiCapture = {
  id: "test-id",
  method: "POST",
  url: "https://api.example.com/v1/users?api_key=secret123&page=1",
  status: 500,
  statusText: "Internal Server Error",
  durationMs: 842,
  startedAt: "2026-06-10T12:00:00.000Z",
  requestId: "req-abc-123",
  requestHeaders: [
    { name: "Authorization", value: "Bearer top-secret" },
    { name: "Content-Type", value: "application/json" },
    { name: "Cookie", value: "session=abc" },
    { name: "X-Request-Id", value: "req-abc-123" }
  ],
  responseHeaders: [{ name: "Set-Cookie", value: "sid=xyz" }],
  requestPayload: JSON.stringify({
    email: "user@example.com",
    password: "hunter2",
    profile: { apiKey: "nested-secret" }
  }),
  responseBody: JSON.stringify({ error: "boom", token: "resp-token" }),
  responseEncoding: "",
  responseMimeType: "application/json"
};

describe("redaction", () => {
  it("redacts sensitive header names", () => {
    const output = formatHeadersBlock(sampleCapture.requestHeaders, true);
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("top-secret");
    expect(output).not.toContain("session=abc");
    expect(output).toContain("application/json");
  });

  it("redacts sensitive query param keys", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      sections: { ...defaultFormatOptions.sections, method: false, status: false, payload: false, requestHeaders: false, responseHeaders: false, response: false }
    });
    expect(output).toContain("api_key: [REDACTED]");
    expect(output).toContain("page: 1");
    expect(output).not.toContain("secret123");
  });

  it("redacts nested JSON body keys", () => {
    const redacted = redactUnknown(JSON.parse(sampleCapture.requestPayload) as unknown);
    expect(redacted).toEqual({
      email: "user@example.com",
      password: "[REDACTED]",
      profile: { apiKey: "[REDACTED]" }
    });
  });

  it("matches required sensitive key patterns", () => {
    expect(isSensitiveKey("authorization")).toBe(true);
    expect(isSensitiveKey("x-api-key")).toBe(true);
    expect(isSensitiveKey("set-cookie")).toBe(true);
    expect(isSensitiveKey("page")).toBe(false);
  });
});

describe("plain text output", () => {
  it("renders labeled sections", () => {
    const output = formatCapture(sampleCapture, defaultFormatOptions);
    expect(output).toContain("Method: POST");
    expect(output).toContain("/v1/users");
    expect(output).toContain("boom");
    expect(output).not.toContain("top-secret");
    expect(output).not.toContain("Status:");
    expect(output).not.toContain("Request ID:");
  });

  it("includes base URL in endpoint when enabled", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      includeEndpointBaseUrl: true
    });
    expect(output).toContain("API endpoint: https://api.example.com/v1/users");
    expect(output).not.toContain("API endpoint: /v1/users");
  });
});

describe("markdown output", () => {
  it("includes headings and fenced blocks", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      outputFormat: "markdown"
    });
    expect(output).toContain("# API Failure Report");
    expect(output).toContain("**URL path:** `/v1/users`");
    expect(output).toContain("## Payload");
    expect(output).toContain("```json");
    expect(output).not.toContain("hunter2");
  });

  it("uses full origin in endpoint when base URL is enabled", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      outputFormat: "markdown",
      includeEndpointBaseUrl: true
    });
    expect(output).toContain("**URL:** `https://api.example.com/v1/users`");
    expect(output).not.toContain("**URL path:**");
  });
});

describe("slack compact output", () => {
  it("stays short and readable", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      outputFormat: "slackCompact"
    });
    expect(output).toContain("POST");
    expect(output).toContain("/v1/users");
    expect(output).toContain("Error:");
    expect(output).not.toContain("Request headers");
    expect(output).not.toContain("top-secret");
  });
});

describe("json debug bundle output", () => {
  it("exports structured JSON with redaction", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      outputFormat: "jsonBundle"
    });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed.method).toBe("POST");
    expect(parsed.endpoint).toEqual(
      expect.objectContaining({ path: "/v1/users" })
    );
    expect(parsed.response).toEqual(expect.objectContaining({ error: "boom" }));
    expect(parsed.status).toBeUndefined();
    expect(output).not.toContain("top-secret");
    expect(output).not.toContain("hunter2");
  });
});

describe("curl generation", () => {
  it("generates a shell-safe curl command", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      outputFormat: "curl"
    });
    expect(output.startsWith("curl -X POST ")).toBe(true);
    expect(output).toContain("-d ");
    expect(output).not.toContain("Cookie:");
    expect(output).not.toContain("top-secret");
    expect(output).not.toContain("user-agent");
  });

  it("excludes authorization from replay headers when redaction is enabled", () => {
    const headers = filterReplayHeaders(sampleCapture.requestHeaders, true, false);
    expect(headers.some((header) => header.name.toLowerCase() === "authorization")).toBe(false);
    expect(headers.some((header) => header.name.toLowerCase() === "cookie")).toBe(false);
  });
});

describe("fetch snippet generation", () => {
  it("generates a fetch call with method and body", () => {
    const output = formatCapture(sampleCapture, {
      ...defaultFormatOptions,
      outputFormat: "fetchSnippet"
    });
    expect(output).toContain("fetch(");
    expect(output).toContain('method: "POST"');
    expect(output).toContain("body:");
    expect(output).not.toContain("top-secret");
  });
});

describe("body formatting", () => {
  it("includes the full body without truncation", () => {
    const longBody = "x".repeat(5000);
    expect(formatBody(longBody, false)).toBe(longBody);
  });

  it("includes long bodies in formatted output", () => {
    const longBody = "y".repeat(5000);
    const capture: FailedApiCapture = {
      ...sampleCapture,
      requestPayload: longBody,
      responseBody: ""
    };

    const output = formatCapture(capture, {
      ...defaultFormatOptions,
      sections: {
        ...defaultFormatOptions.sections,
        method: false,
        endpoint: false,
        status: false,
        requestHeaders: false,
        responseHeaders: false,
        response: false
      }
    });

    expect(output).toContain(longBody);
  });
});

describe("malformed JSON body fallback", () => {
  it("falls back to raw text for invalid JSON payloads", () => {
    const capture: FailedApiCapture = {
      ...sampleCapture,
      requestPayload: "not-json{{{",
      responseBody: "plain-text-error"
    };

    const output = formatCapture(capture, defaultFormatOptions);
    expect(output).toContain("not-json{{{");
    expect(output).toContain("plain-text-error");
  });
});

describe("base64 response omission", () => {
  it("omits base64 response bodies in plain text", () => {
    const capture: FailedApiCapture = {
      ...sampleCapture,
      responseEncoding: "base64",
      responseBody: "aGVsbG8="
    };

    const output = formatCapture(capture, defaultFormatOptions);
    expect(output).toContain("[base64 response body omitted]");
    expect(output).not.toContain("aGVsbG8=");
  });
});
