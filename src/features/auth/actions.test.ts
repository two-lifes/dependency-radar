// @vitest-environment node
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendSignInLink } from "./actions";
import { initialSignInLinkState } from "./sign-in-state";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const api = vi.hoisted(() => ({
  signInMagicLink: vi.fn<() => Promise<unknown>>(async () => ({
    status: true,
  })),
}));
vi.mock("@/server/auth/auth", () => ({
  getAuth: () => ({ api }),
  MAGIC_LINK_RATE_LIMITED: "MAGIC_LINK_RATE_LIMITED",
}));

const form = (email: string) => {
  const data = new FormData();
  data.set("email", email);
  data.set("intent", "resend");
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendSignInLink", () => {
  it("sends the link", async () => {
    expect(
      await sendSignInLink(initialSignInLinkState, form("ada@example.com")),
    ).toEqual({ attempt: 1, sent: true });
  });

  it("shows the limit with its wait", async () => {
    api.signInMagicLink.mockRejectedValueOnce(
      new APIError("TOO_MANY_REQUESTS", {
        code: "MAGIC_LINK_RATE_LIMITED",
        message: "Too many requests. Try again in 10 minutes.",
      }),
    );
    expect(
      await sendSignInLink(initialSignInLinkState, form("ada@example.com")),
    ).toEqual({
      attempt: 1,
      error: "Too many requests. Try again in 10 minutes.",
    });
  });

  it("hides other errors behind the generic message", async () => {
    api.signInMagicLink.mockRejectedValueOnce(
      new APIError("INTERNAL_SERVER_ERROR", { message: "smtp: secret host" }),
    );
    expect(
      await sendSignInLink(initialSignInLinkState, form("ada@example.com")),
    ).toEqual({ attempt: 1, error: "Couldn't send the link. Try again." });
  });
});
