import { redirect } from "next/navigation";
import { type PageSearchParams, queryString } from "@/lib/query-string";
import { getDb } from "@/server/db/client";
import { getReportMeta } from "@/server/db/report-page";
import { canOpenReport } from "@/server/report-access";

/**
 * decisions 45: the guest link of a saved report takes its owner to the same
 * tab of the project, with the filters. Lives in the tab pages because the
 * layout doesn't see the query; the layout answers 404 to everyone else.
 */
export async function redirectSavedReport(
  reportId: string,
  tab: "dependencies" | "vulnerabilities",
  searchParams: PageSearchParams,
): Promise<void> {
  const meta = await getReportMeta(getDb(), reportId);
  if (meta?.projectId && (await canOpenReport(meta))) {
    redirect(`/projects/${meta.projectId}/${tab}${queryString(searchParams)}`);
  }
}
