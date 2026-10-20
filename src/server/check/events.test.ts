import { describe, expect, it } from "vitest";
import { encodeSseEvent, SSE_PING } from "./events";

describe("encodeSseEvent", () => {
  it("names the event and puts the rest in data", () => {
    expect(encodeSseEvent({ type: "progress", checked: 3, total: 10 })).toBe(
      'event: progress\ndata: {"checked":3,"total":10}\n\n',
    );
  });

  it("keeps multi-line strings on one data line", () => {
    const frame = encodeSseEvent({
      type: "done",
      status: "failed",
      failureReason: "internal-error",
      retryAt: "line1\nline2",
    });
    const lines = frame.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]?.slice("data: ".length) ?? "")).toEqual({
      status: "failed",
      failureReason: "internal-error",
      retryAt: "line1\nline2",
    });
  });

  it("encodes an event without payload as an empty object", () => {
    expect(encodeSseEvent({ type: "error" })).toBe(
      "event: error\ndata: {}\n\n",
    );
  });
});

describe("SSE_PING", () => {
  it("is a comment frame", () => {
    expect(SSE_PING.startsWith(":")).toBe(true);
    expect(SSE_PING.endsWith("\n\n")).toBe(true);
  });
});
