import {
  buildReportInput,
  type ReportInput,
} from "@/server/analysis/report-input";
import type { NewGuestReport } from "@/server/db/reports";
import { readUploadedLockfile } from "@/server/lockfile-upload";
import { landingCopy } from "../landing/copy";
import { manifestMessage, readRepoInput } from "./read-repo";

/** The three sources of the landing form, also used by `/projects/new`. */
export type SourceForm =
  | { source: "paste"; packageJson: string }
  | { source: "upload"; packageJson: string; lockfile?: Blob }
  | { source: "github"; url: string };

/** The report a submitted source becomes, or a screens 5.1 message. */
export async function prepareReport(
  form: SourceForm,
): Promise<
  { ok: true; report: NewGuestReport } | { ok: false; message: string }
> {
  if (form.source !== "github") {
    if (form.packageJson.trim() === "") {
      return {
        ok: false,
        message:
          form.source === "paste"
            ? landingCopy.errors.emptyPaste
            : landingCopy.errors.noManifestFile,
      };
    }
    const lockfile =
      form.source === "upload" && form.lockfile
        ? await readUploadedLockfile(form.lockfile)
        : undefined;
    const result = buildReportInput({
      packageJson: form.packageJson,
      lockfile,
    });
    if (!result.ok) {
      return { ok: false, message: manifestMessage(result.error) };
    }
    const input: ReportInput = result.value;
    return { ok: true, report: { source: form.source, input } };
  }

  const read = await readRepoInput(form.url);
  if (!read.ok) return { ok: false, message: read.error };
  const { input, repoUrl } = read.value;
  return { ok: true, report: { source: "github", repoUrl, input } };
}
