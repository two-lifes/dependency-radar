// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { GUEST_COOKIE, validGuestId } from "./lib/guest-cookie";
describe("guest identity before launch", () => {
  it("establishes a persistent HttpOnly cookie and forwards it to the page", () => {
    const response = proxy(
      new NextRequest("http://localhost/r/id/dependencies?q=react"),
    );
    const cookie = response.cookies.get(GUEST_COOKIE);
    expect(validGuestId(cookie?.value)).toBe(true);
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 34560000,
    });
    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      `${GUEST_COOKIE}=${cookie?.value}`,
    );
  });
  it("keeps the id across navigation and never creates one for a POST", () => {
    const id = crypto.randomUUID();
    const response = proxy(
      new NextRequest("http://localhost/", {
        headers: { cookie: `${GUEST_COOKIE}=${id}` },
      }),
    );
    expect(response.cookies.get(GUEST_COOKIE)?.value).toBe(id);
    expect(
      proxy(
        new NextRequest("http://localhost/", { method: "POST" }),
      ).cookies.get(GUEST_COOKIE),
    ).toBeUndefined();
  });
  it("retains protected route redirects with query", () => {
    const response = proxy(
      new NextRequest("http://localhost/projects/new?source=github"),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fprojects%2Fnew%3Fsource%3Dgithub",
    );
  });
});
