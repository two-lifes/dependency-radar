import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { z } from "zod";
import { ReportSkeleton } from "@/features/report/report-skeleton";
import { ReportView } from "@/features/report/report-view";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getProjectReportMeta } from "@/server/db/projects";

const idSchema = z.uuid();

/**
 * screens 5.4: a project's report, the same view as a guest report. Someone
 * else's project is a 404 like a missing one, so it doesn't reveal that the
 * project exists.
 */
export default async function ProjectReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Checked before the skeleton streams, so these get a real 404 status.
  if (!idSchema.safeParse(id).success) notFound();
  const { user } = await requireSession();
  const project = await getProjectReportMeta(getDb(), id, user.id);
  if (!project) notFound();

  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportView
        reportId={project.reportId}
        mode={{
          kind: "project",
          projectId: project.projectId,
          name: project.name,
        }}
      >
        {children}
      </ReportView>
    </Suspense>
  );
}
