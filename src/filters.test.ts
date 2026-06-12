import { describe, expect, it } from "vitest";
import {
  filterAndSortCaptures,
  getApiGroupKey,
  groupCapturesByApi,
  isFailedApiStatus
} from "./filters";
import type { FailedApiCapture } from "./types";

const baseCapture: FailedApiCapture = {
  id: "capture-id",
  method: "GET",
  url: "https://api.example.com/v1/users",
  status: 200,
  statusText: "OK",
  durationMs: 120,
  startedAt: "2026-06-10T12:00:00.000Z",
  requestId: null,
  requestHeaders: [],
  responseHeaders: [],
  requestPayload: "",
  responseBody: "{}",
  responseEncoding: "",
  responseMimeType: "application/json"
};

describe("isFailedApiStatus", () => {
  it("treats 4xx, 5xx, and network errors as failed", () => {
    expect(isFailedApiStatus(404)).toBe(true);
    expect(isFailedApiStatus(500)).toBe(true);
    expect(isFailedApiStatus(0)).toBe(true);
  });

  it("treats successful responses as non-failed", () => {
    expect(isFailedApiStatus(200)).toBe(false);
    expect(isFailedApiStatus(301)).toBe(false);
  });
});

describe("filterAndSortCaptures outcome filter", () => {
  const captures: FailedApiCapture[] = [
    { ...baseCapture, id: "ok", status: 200, statusText: "OK" },
    { ...baseCapture, id: "redirect", status: 301, statusText: "Moved Permanently" },
    { ...baseCapture, id: "client-error", status: 404, statusText: "Not Found" },
    { ...baseCapture, id: "server-error", status: 500, statusText: "Internal Server Error" },
    { ...baseCapture, id: "network-error", status: 0, statusText: "Failed" }
  ];

  it("returns all captures when outcome filter is all", () => {
    const filtered = filterAndSortCaptures(captures, {
      searchText: "",
      outcomeFilter: "all",
      methodFilter: "all",
      sortMode: "newest"
    });

    expect(filtered.map((capture) => capture.id)).toEqual([
      "ok",
      "redirect",
      "client-error",
      "server-error",
      "network-error"
    ]);
  });

  it("returns only succeeded captures", () => {
    const filtered = filterAndSortCaptures(captures, {
      searchText: "",
      outcomeFilter: "succeeded",
      methodFilter: "all",
      sortMode: "newest"
    });

    expect(filtered.map((capture) => capture.id)).toEqual(["ok", "redirect"]);
  });

  it("returns only failed captures", () => {
    const filtered = filterAndSortCaptures(captures, {
      searchText: "",
      outcomeFilter: "failed",
      methodFilter: "all",
      sortMode: "newest"
    });

    expect(filtered.map((capture) => capture.id)).toEqual([
      "client-error",
      "server-error",
      "network-error"
    ]);
  });
});

describe("groupCapturesByApi", () => {
  it("groups captures by method and endpoint path", () => {
    const captures: FailedApiCapture[] = [
      { ...baseCapture, id: "a1", method: "GET", url: "https://api.example.com/v1/users?page=1" },
      { ...baseCapture, id: "a2", method: "GET", url: "https://api.example.com/v1/users?page=2" },
      { ...baseCapture, id: "b1", method: "POST", url: "https://api.example.com/v1/users" }
    ];

    expect(getApiGroupKey(captures[0])).toBe("GET https://api.example.com/v1/users");

    const groups = groupCapturesByApi(captures);
    expect(groups).toHaveLength(2);
    expect(groups[0].captures.map((capture) => capture.id)).toEqual(["a1", "a2"]);
    expect(groups[1].captures.map((capture) => capture.id)).toEqual(["b1"]);
  });
});
