import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

/** One MSW server per test file; unhandled requests fail the test. */
export function setupMswServer() {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}
