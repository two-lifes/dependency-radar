// @vitest-environment node
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MAX_LOCKFILE_BYTES } from "./analysis/parse-lockfile";
import { readUploadedLockfile } from "./lockfile-upload";

const gzipped = (text: string) => new Blob([gzipSync(text)]);

describe("readUploadedLockfile", () => {
  it("reads top-level packages from a gzipped lockfile", async () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "app" },
        "node_modules/react": { version: "19.1.0" },
      },
    });

    expect(await readUploadedLockfile(gzipped(lockfile))).toEqual({
      ok: true,
      value: { react: { version: "19.1.0" } },
    });
  });

  it("stops inflating past the lockfile limit", async () => {
    // Compresses to a few KB: the archive is small, the content is not.
    const bomb = gzipped(" ".repeat(MAX_LOCKFILE_BYTES + 1));

    expect(await readUploadedLockfile(bomb)).toEqual({
      ok: false,
      error: { code: "too-large", maxBytes: MAX_LOCKFILE_BYTES },
    });
  });

  it("treats data that isn't gzip as an unusable lockfile", async () => {
    expect(await readUploadedLockfile(new Blob(["{}"]))).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("treats a v1 lockfile as unsupported", async () => {
    const v1 = JSON.stringify({ lockfileVersion: 1, dependencies: {} });

    expect(await readUploadedLockfile(gzipped(v1))).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });
});
