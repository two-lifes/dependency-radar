import { redirect } from "next/navigation";

/** screens 2: `/r/[id]` opens the Dependencies tab, keeping the query. */
export default async function ReportIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of [value ?? []].flat()) query.append(key, item);
  }
  const search = query.toString();
  redirect(
    `/r/${encodeURIComponent(id)}/dependencies${search ? `?${search}` : ""}`,
  );
}
