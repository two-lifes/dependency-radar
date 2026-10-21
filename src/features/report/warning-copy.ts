import { MAX_LOCKFILE_BYTES } from "@/server/analysis/parse-lockfile";
import type { ReportWarning } from "@/server/analysis/report-input";
import { lockfileWarningCopy, manifestWarningCopy } from "../check/copy";

// Kept apart from copy.ts: it pulls the lockfile parser in, and only the
// server resolves these texts.
// decisions 28: warnings stored with the report at creation.
export const reportWarningCopy: Record<ReportWarning, string> = {
  workspaces: manifestWarningCopy.workspaces,
  "lockfile-too-large": lockfileWarningCopy["too-large"]({
    code: "too-large",
    maxBytes: MAX_LOCKFILE_BYTES,
  }),
  "lockfile-unsupported": lockfileWarningCopy.unsupported({
    code: "unsupported",
  }),
};
