import { describe, expect, it } from "vitest";
import {
  displayStatus,
  initialQueue,
  itemsToStart,
  type QueueAction,
  type QueueState,
  reduceQueue,
} from "./check-queue";

const run = (actions: QueueAction[], state: QueueState = initialQueue) =>
  actions.reduce(reduceQueue, state);
const ids = (state: QueueState) => itemsToStart(state).map((i) => i.projectId);

describe("dashboard check queue", () => {
  it("starts projects in the order they were added, two at a time", () => {
    let state = run([{ type: "sync", projectIds: ["a", "b", "c"] }]);
    expect(ids(state)).toEqual(["a", "b"]);

    state = run(
      [
        { type: "starting", projectId: "a" },
        { type: "starting", projectId: "b" },
      ],
      state,
    );
    expect(ids(state)).toEqual([]);

    state = run(
      [
        { type: "started", projectId: "a", checkId: "ca" },
        { type: "settled", projectId: "b" },
      ],
      state,
    );
    expect(ids(state)).toEqual(["c"]);
  });

  it("puts Check now first, as a fresh check", () => {
    const state = run([
      { type: "sync", projectIds: ["a", "b"] },
      { type: "check-now", projectId: "z" },
    ]);
    expect(itemsToStart(state)).toEqual([
      { projectId: "z", fresh: true, phase: "waiting" },
      { projectId: "a", fresh: false, phase: "waiting" },
    ]);
  });

  it("moves a waiting project to the front on Check now", () => {
    const state = run([
      { type: "sync", projectIds: ["a", "b", "c"] },
      { type: "check-now", projectId: "c" },
    ]);
    expect(state.items.map((i) => i.projectId)).toEqual(["c", "a", "b"]);
  });

  it("ignores Check now while the project's check is starting or running", () => {
    const before = run([
      { type: "sync", projectIds: ["a"] },
      { type: "starting", projectId: "a" },
    ]);
    expect(run([{ type: "check-now", projectId: "a" }], before)).toBe(before);
  });

  it("tracks progress of a running check", () => {
    const state = run([
      { type: "sync", projectIds: ["a"] },
      { type: "starting", projectId: "a" },
      { type: "started", projectId: "a", checkId: "ca" },
      { type: "progress", projectId: "a", checked: 3, total: 10 },
    ]);
    expect(state.items[0]).toMatchObject({
      phase: "running",
      checkId: "ca",
      checked: 3,
      total: 10,
    });
  });

  it("pauses the whole queue on the rate limit and retries in order", () => {
    let state = run([
      { type: "sync", projectIds: ["a", "b"] },
      { type: "starting", projectId: "a" },
      { type: "limited", projectId: "a", until: 1000, retryAfterSeconds: 600 },
    ]);
    expect(state.paused).toEqual({ until: 1000, retryAfterSeconds: 600 });
    expect(ids(state)).toEqual([]);

    state = run([{ type: "resume" }], state);
    expect(ids(state)).toEqual(["a", "b"]);
  });

  it("doesn't queue a settled project again until Check now", () => {
    let state = run([
      { type: "sync", projectIds: ["a"] },
      { type: "settled", projectId: "a" },
      { type: "sync", projectIds: ["a"] },
    ]);
    expect(state.items).toEqual([]);

    state = run([{ type: "check-now", projectId: "a" }], state);
    expect(ids(state)).toEqual(["a"]);
  });

  it("keeps a sync from adding a project twice", () => {
    const state = run([
      { type: "sync", projectIds: ["a"] },
      { type: "sync", projectIds: ["a", "b"] },
    ]);
    expect(state.items.map((i) => i.projectId)).toEqual(["a", "b"]);
  });
});

describe("displayStatus", () => {
  const checked = { kind: "checked", at: new Date(0) } as const;

  it("keeps the loaded status outside the queue", () => {
    expect(displayStatus(checked, undefined, null)).toBe(checked);
  });

  it("shows Queued until the stream starts, then progress", () => {
    expect(
      displayStatus(
        checked,
        { projectId: "a", fresh: true, phase: "starting" },
        null,
      ),
    ).toEqual({ kind: "queued" });
    expect(
      displayStatus(
        checked,
        {
          projectId: "a",
          fresh: true,
          phase: "running",
          checkId: "c",
          checked: 2,
          total: 5,
        },
        null,
      ),
    ).toEqual({ kind: "checking", percent: 40 });
  });

  it("shows the rate limit on waiting projects while the queue is paused", () => {
    expect(
      displayStatus(
        { kind: "queued" },
        { projectId: "a", fresh: false, phase: "waiting" },
        { until: 0, retryAfterSeconds: 300 },
      ),
    ).toEqual({ kind: "limited", retryAfterSeconds: 300 });
  });
});
