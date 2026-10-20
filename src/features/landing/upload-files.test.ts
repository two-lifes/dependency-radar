// @vitest-environment node
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { addUploadedFiles, gzipText } from "./upload-files";

const manifestText = JSON.stringify({
  dependencies: { react: "^19.0.0" },
});
const lockText = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { name: "app" },
    "node_modules/react": { version: "19.1.0" },
    "node_modules/scheduler": { version: "0.25.0" },
  },
});

const file = (name: string, text: string) => new File([text], name);

describe("addUploadedFiles", () => {
  it("tells package.json and package-lock.json apart by content", async () => {
    const result = await addUploadedFiles({}, [
      file("package-lock (1).json", lockText),
      file("package (1).json", manifestText),
    ]);

    if (!result.ok) throw new Error(result.message);
    expect(result.selection.manifest).toEqual({
      name: "package (1).json",
      text: manifestText,
    });
    expect(result.selection.lockfile?.name).toBe("package-lock (1).json");
    const gzipped = result.selection.lockfile?.gzipped;
    if (!gzipped) throw new Error("lockfile not compressed");
    expect(gunzipSync(await gzipped.arrayBuffer()).toString("utf8")).toBe(
      lockText,
    );
  });

  it("replaces package.json from an earlier drop", async () => {
    const first = await addUploadedFiles({}, [file("a.json", manifestText)]);
    if (!first.ok) throw new Error("first drop failed");

    const second = await addUploadedFiles(first.selection, [
      file("b.json", manifestText),
    ]);

    expect(second.ok && second.selection.manifest?.name).toBe("b.json");
  });

  it("rejects two package.json files in one drop", async () => {
    const result = await addUploadedFiles({}, [
      file("a.json", manifestText),
      file("b.json", manifestText),
    ]);

    expect(result).toEqual({
      ok: false,
      message: "Drop one package.json at a time.",
    });
  });

  it("rejects more than two files", async () => {
    const result = await addUploadedFiles({}, [
      file("a.json", manifestText),
      file("b.json", lockText),
      file("c.json", "{}"),
    ]);

    expect(result.ok).toBe(false);
  });

  it("rejects pnpm and yarn lockfiles", async () => {
    const result = await addUploadedFiles({}, [
      file("pnpm-lock.yaml", "lockfileVersion: '9.0'\n"),
    ]);

    expect(result).toEqual({
      ok: false,
      message: "This is a lockfile. Paste package.json instead.",
    });
  });
});

describe("gzipText", () => {
  it("produces gzip the server can inflate", async () => {
    const text = "x".repeat(10_000);
    const gzipped = await gzipText(text);

    expect(gzipped.size).toBeLessThan(text.length / 10);
    expect(gunzipSync(await gzipped.arrayBuffer()).toString("utf8")).toBe(text);
  });
});
