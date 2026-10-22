import { redirect } from "next/navigation";
import { type PageSearchParams, queryString } from "@/lib/query-string";

/** screens 2: `/projects/[id]` opens the Dependencies tab, keeping the query. */
export default async function ProjectIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  redirect(
    `/projects/${encodeURIComponent(id)}/dependencies${queryString(await searchParams)}`,
  );
}
