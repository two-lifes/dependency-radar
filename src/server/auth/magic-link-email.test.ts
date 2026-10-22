import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMagicLinkEmail,
  isEmailSignInEnabled,
  sendMagicLinkEmail,
} from "./magic-link-email";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const url = "https://radar.example/api/auth/magic-link/verify?token=a&b=1";
const link = { email: "dev@example.com", url };

afterEach(() => {
  vi.restoreAllMocks();
  send.mockReset();
});

describe("buildMagicLinkEmail", () => {
  it("has the link and says when it expires", () => {
    const email = buildMagicLinkEmail(url);
    expect(email.subject).toBe("Your Dependency Radar sign-in link");
    expect(email.text).toContain(url);
    expect(email.text).toContain("expires in 15 minutes");
    expect(email.html).toContain(
      'href="https://radar.example/api/auth/magic-link/verify?token=a&amp;b=1"',
    );
    expect(email.html).toContain("expires in 15 minutes");
  });
});

describe("isEmailSignInEnabled", () => {
  it.each([
    [{ NODE_ENV: "development" }, true],
    [{ NODE_ENV: "production", MOCK_EXTERNAL: "1" }, true],
    [
      {
        NODE_ENV: "production",
        RESEND_API_KEY: "key",
        EMAIL_FROM: "radar@example.com",
      },
      true,
    ],
    [{ NODE_ENV: "production" }, false],
    [{ NODE_ENV: "production", RESEND_API_KEY: "key" }, false],
  ])("%j → %s", (env, expected) => {
    expect(isEmailSignInEnabled(env)).toBe(expected);
  });
});

describe("sendMagicLinkEmail", () => {
  it("logs the link in development without a Resend key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendMagicLinkEmail(link, { NODE_ENV: "development" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(url));
    expect(send).not.toHaveBeenCalled();
  });

  it("logs the link with MOCK_EXTERNAL=1 even when a key is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendMagicLinkEmail(link, {
      NODE_ENV: "production",
      MOCK_EXTERNAL: "1",
      RESEND_API_KEY: "key",
      EMAIL_FROM: "radar@example.com",
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("fails in production without a Resend key", async () => {
    await expect(
      sendMagicLinkEmail(link, { NODE_ENV: "production" }),
    ).rejects.toThrow("RESEND_API_KEY");
  });

  it("sends through Resend when configured", async () => {
    send.mockResolvedValue({ data: { id: "1" }, error: null });
    await sendMagicLinkEmail(link, {
      NODE_ENV: "production",
      RESEND_API_KEY: "key",
      EMAIL_FROM: "radar@example.com",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "radar@example.com",
        to: "dev@example.com",
        subject: "Your Dependency Radar sign-in link",
      }),
    );
  });

  it("throws when Resend returns an error", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", statusCode: 422, message: "bad" },
    });
    await expect(
      sendMagicLinkEmail(link, {
        NODE_ENV: "production",
        RESEND_API_KEY: "key",
        EMAIL_FROM: "radar@example.com",
      }),
    ).rejects.toThrow("validation_error");
  });
});
