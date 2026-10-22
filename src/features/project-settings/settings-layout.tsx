import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { projectSettingsCopy as copy } from "./copy";

/** screens 5.12: "← Back to report", then the sections, up to 720px wide. */
export function ProjectSettingsLayout({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-180 gap-6 px-4 pt-8 pb-16 sm:px-6">
      <div className="grid gap-2">
        <Link
          href={`/projects/${projectId}/dependencies`}
          className="inline-flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {copy.back}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
      </div>
      {children}
    </main>
  );
}
