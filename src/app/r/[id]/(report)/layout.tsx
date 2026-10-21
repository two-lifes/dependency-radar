import { Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { z } from "zod";
import { GuestHeader } from "@/components/guest-header";
import { Button } from "@/components/ui/button";
import { reportCopy } from "@/features/report/copy";
import { ReportSkeleton } from "@/features/report/report-skeleton";
import { ReportView } from "@/features/report/report-view";
import { SystemMessage } from "@/features/system/system-message";
import { isReportExpired } from "@/server/check/report-view";
import { getDb } from "@/server/db/client";
import { getReportMeta } from "@/server/db/report-page";

const idSchema = z.uuid();

/** screens 5.4: guest report, shared by the Dependencies and Vulnerabilities tabs. */
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

  if (isReportExpired(meta.expiresAt, new Date())) {
    const copy = reportCopy.expired;
    return (
      <>
        <GuestHeader />
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

  return (
    <>
      <GuestHeader />
      <Suspense fallback={<ReportSkeleton />}>
        <ReportView reportId={id}>{children}</ReportView>
      </Suspense>
    </>
  );
}
