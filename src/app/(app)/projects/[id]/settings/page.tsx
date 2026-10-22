import { notFound } from "next/navigation";
import { z } from "zod";
import { authCopy } from "@/features/auth/copy";
import { StubPage } from "@/features/auth/stub-page";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getProjectReportMeta } from "@/server/db/projects";

const idSchema = z.uuid();

// Project settings come in plan task 24; the dashboard menu links here now.
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { user } = await requireSession();
  if (!(await getProjectReportMeta(getDb(), id, user.id))) notFound();
  return <StubPage title={authCopy.stub.projectSettings} />;
}
