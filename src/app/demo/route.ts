export const dynamic = "force-dynamic";

/** Historical route: never creates a session or seeds data. */
export async function GET() {
  return new Response(null, { status: 404 });
}
