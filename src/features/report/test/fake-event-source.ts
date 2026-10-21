import { act } from "@testing-library/react";

/** Stands in for the browser EventSource; stub it with `vi.stubGlobal`. */
export class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;
  closed = false;
  private listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** A frame from the server. */
  send(type: string, data: object) {
    this.dispatch(type, new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  /** A connection problem; `closed` means the browser gave up. */
  fail(closed: boolean) {
    this.readyState = closed
      ? FakeEventSource.CLOSED
      : FakeEventSource.CONNECTING;
    this.dispatch("error", new Event("error"));
  }

  private dispatch(type: string, event: Event) {
    act(() => {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    });
  }
}
