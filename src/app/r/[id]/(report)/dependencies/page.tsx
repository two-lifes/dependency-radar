import { DependencyTable } from "@/features/report/dependency-table";
import { redirectSavedReport } from "@/features/report/saved-report-redirect";
import type { PageSearchParams } from "@/lib/query-string";

/** screens 5.5; a guest report gets the "Save project" hint. */
export default async function DependenciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  await redirectSavedReport(id, "dependencies", await searchParams);
  return <DependencyTable saveHint />;
}
