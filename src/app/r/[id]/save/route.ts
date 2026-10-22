import { z } from "zod";
import { savedReportPath } from "@/features/report/saved-report";
import { loginPath } from "@/lib/safe-next";
import { getOptionalSession, viewerOf } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { saveGuestReport } from "@/server/db/projects";

export const dynamic = "force-dynamic";

const idSchema = z.uuid();

/**
 * screens 2: `/r/[id]/save` has no UI. Sign-in sends the guest here through
 * `next`, so it is a GET; a route handler and not a page, because a page
 * that writes while rendering would also write when prefetched
 * (decisions 45). Anything but a saved project goes back to the report page,
 * which renders the expired or 404 state with its real status.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const back = `/r/${encodeURIComponent(id)}/dependencies`;
  if (!idSchema.safeParse(id).success) return seeOther(request, back);

  const session = await getOptionalSession();
  if (!session) return seeOther(request, loginPath(`/r/${id}/save`));

  const outcome = await saveGuestReport(getDb(), id, viewerOf(session));
  return seeOther(request, savedReportPath(id, outcome));
}

function seeOther(request: Request, path: string) {
  return Response.redirect(new URL(path, request.url), 303);
}
