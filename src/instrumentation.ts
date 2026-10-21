export async function register() {
  // plan.md assumption 2: e2e and local demos run without npm and OSV.
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.MOCK_EXTERNAL === "1"
  ) {
    const [{ setupServer }, { mockHandlers }] = await Promise.all([
      import("msw/node"),
      import("./server/sources/mock/handlers"),
    ]);
    // Postgres and Next's own requests pass through untouched.
    setupServer(...mockHandlers).listen({ onUnhandledFrame: "bypass" });
    console.warn("[mock] npm and OSV are mocked (MOCK_EXTERNAL=1)");
  }
}
