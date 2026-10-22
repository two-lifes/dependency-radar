import { Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { reportCopy } from "@/features/report/copy";
import { ReportSkeleton } from "@/features/report/report-skeleton";
import { ReportView } from "@/features/report/report-view";
import { SystemMessage } from "@/features/system/system-message";
import { isReportExpired } from "@/server/check/report-view";
import { getDb } from "@/server/db/client";
import { getReportMeta } from "@/server/db/report-page";
import { canOpenReport } from "@/server/report-access";
import { getOptionalSession } from "@/server/auth/session";

const idSchema = z.uuid();

/**
 * screens 5.4: guest report, shared by the Dependencies and Vulnerabilities
 * tabs. A signed-in user sees the same report with the app header (screens 1.4).
 */
export default async function GuestReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Checked before the skeleton streams, so these get a real 404 status.
  if (!idSchema.safeParse(id).success) notFound();
  const meta = await getReportMeta(getDb(), id);
  if (!meta) notFound();
  if (meta.projectId !== null) {
    // decisions 45: a saved report is its project's now. The tab page
    // redirects the owner there; everyone else gets the 404.
    if (!(await canOpenReport(meta))) notFound();
    return children;
  }

  if (isReportExpired(meta.expiresAt, new Date())) {
    const copy = reportCopy.expired;
    return (
      <>
        <SiteHeader />
        <SystemMessage
          icon={<Clock />}
          title={copy.title}
          description={copy.description}
        >
          <Button asChild>
            <Link href="/">{copy.action}</Link>
          </Button>
        </SystemMessage>
      </>
    );
  }

  const session = await getOptionalSession();
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<ReportSkeleton />}>
        <ReportView reportId={id} mode={{ kind: "guest", signedIn: !!session }}>
          {children}
        </ReportView>
      </Suspense>
    </>
  );
}
