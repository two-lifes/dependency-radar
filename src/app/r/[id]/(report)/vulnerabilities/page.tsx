import { redirectSavedReport } from "@/features/report/saved-report-redirect";
import { VulnerabilityList } from "@/features/report/vulnerability-list";
import type { PageSearchParams } from "@/lib/query-string";

/** screens 5.6 */
export default async function VulnerabilitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  await redirectSavedReport(id, "vulnerabilities", await searchParams);
  return <VulnerabilityList />;
}
