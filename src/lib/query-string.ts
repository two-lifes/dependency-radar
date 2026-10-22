export type PageSearchParams = Record<string, string | string[] | undefined>;

/** Next.js page `searchParams` back to `?…`, or "" when there are none. */
export function queryString(searchParams: PageSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of [value ?? []].flat()) query.append(key, item);
  }
  const search = query.toString();
  return search ? `?${search}` : "";
}
