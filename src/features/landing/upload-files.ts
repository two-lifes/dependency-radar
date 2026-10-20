import { detectLockfile } from "@/server/analysis/detect-lockfile";
import { MAX_LOCKFILE_BYTES } from "@/server/analysis/parse-lockfile";
import { MAX_MANIFEST_BYTES } from "@/server/analysis/parse-manifest";
import { manifestErrorCopy } from "../check/copy";
import { landingCopy } from "./copy";

export type UploadSelection = {
  manifest?: { name: string; text: string };
  /** Compressed on selection, so submitting stays instant. */
  lockfile?: { name: string; gzipped: Blob };
};

export type UploadResult =
  { ok: true; selection: UploadSelection } | { ok: false; message: string };

/** Anything over this is never read: not even a lockfile is that large. */
const MAX_READ_BYTES = MAX_LOCKFILE_BYTES;

/**
 * Adds dropped or browsed files to the selection. Files are told apart by
 * content, not name: `package (1).json` from Downloads is still package.json.
 */
export async function addUploadedFiles(
  current: UploadSelection,
  files: readonly File[],
  compress: (text: string) => Promise<Blob> = gzipText,
): Promise<UploadResult> {
  if (files.length > 2) {
    return { ok: false, message: landingCopy.errors.tooManyFiles };
  }
  const selection = { ...current };
  let manifestInBatch = false;
  for (const file of files) {
    if (file.size > MAX_READ_BYTES) {
      return {
        ok: false,
        message: manifestErrorCopy["too-large"]({
          code: "too-large",
          maxBytes: MAX_MANIFEST_BYTES,
        }),
      };
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      return { ok: false, message: landingCopy.errors.unreadableFile };
    }

    const lockfileFormat = detectLockfile(text);
    if (lockfileFormat === "npm") {
      try {
        selection.lockfile = { name: file.name, gzipped: await compress(text) };
      } catch {
        return { ok: false, message: landingCopy.errors.unreadableFile };
      }
    } else if (lockfileFormat) {
      return {
        ok: false,
        message: manifestErrorCopy.lockfile({
          code: "lockfile",
          format: lockfileFormat,
        }),
      };
    } else if (manifestInBatch) {
      return { ok: false, message: landingCopy.errors.twoManifests };
    } else {
      // A later drop replaces the earlier package.json.
      selection.manifest = { name: file.name, text };
      manifestInBatch = true;
    }
  }
  return { ok: true, selection };
}

/**
 * package-lock.json reaches 10 MB, over Vercel's 4.5 MB request body limit;
 * gzip shrinks JSON about tenfold. The server inflates and parses it
 * (decisions 28).
 */
export async function gzipText(text: string): Promise<Blob> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}
