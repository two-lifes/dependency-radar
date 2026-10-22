// @vitest-environment node
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER } from "@/server/demo/demo-user";
import { deleteAccount, updateName } from "./actions";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const signedIn = vi.hoisted(() => ({
  user: { id: "u1", email: "Ada@example.com" },
}));
vi.mock("@/server/auth/session", () => ({
  requireSession: async () => signedIn,
}));
const api = vi.hoisted(() => ({
  updateUser: vi.fn(async () => ({ status: true })),
  deleteUser: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/server/auth/auth", () => ({ getAuth: () => ({ api }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateName", () => {
  it("saves a trimmed name, empty included", async () => {
    expect(await updateName("  Ada Lovelace ")).toEqual({});
    expect(api.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: "Ada Lovelace" } }),
    );
    expect(await updateName("   ")).toEqual({});
    expect(api.updateUser).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: { name: "" } }),
    );
  });

  it("rejects a name over 60 characters", async () => {
    expect(await updateName("x".repeat(61))).toEqual({
      error: "Use 60 characters or fewer.",
    });
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it("reports a failed update", async () => {
    api.updateUser.mockRejectedValueOnce(new Error("db down"));
    expect(await updateName("Ada")).toEqual({
      error: "Couldn't save the name. Try again.",
    });
  });
});

describe("deleteAccount", () => {
  it("never deletes the demo account", async () => {
    const real = signedIn.user;
    signedIn.user = { id: DEMO_USER.id, email: DEMO_USER.email };
    try {
      expect(await deleteAccount(DEMO_USER.email)).toEqual({
        error: "failed",
      });
      expect(api.deleteUser).not.toHaveBeenCalled();
    } finally {
      signedIn.user = real;
    }
  });

  it("deletes nothing when the email doesn't match", async () => {
    expect(await deleteAccount("eve@example.com")).toEqual({
      error: "mismatch",
    });
    expect(api.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the account and opens the landing, ignoring email case", async () => {
    await expect(deleteAccount(" ada@EXAMPLE.com ")).rejects.toThrow(
      "redirect:/?account-deleted=1",
    );
    expect(api.deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({ body: {} }),
    );
  });

  it("asks to sign in again when the session is too old", async () => {
    api.deleteUser.mockRejectedValueOnce(
      APIError.from("BAD_REQUEST", {
        code: "SESSION_EXPIRED",
        message: "Session expired. Re-authenticate to perform this action.",
      }),
    );
    expect(await deleteAccount("ada@example.com")).toEqual({
      error: "reauth",
    });
  });

  it("reports any other failure", async () => {
    api.deleteUser.mockRejectedValueOnce(new Error("db down"));
    expect(await deleteAccount("ada@example.com")).toEqual({
      error: "failed",
    });
  });
});
