import { GitBranch, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { projectsCopy } from "./copy";

/**
 * screens 5.10, item 1: the title, "Import from GitHub" (with GitHub
 * connected) and "New project" over every state. Loading and error don't know
 * the connection yet, so they show "New project" only.
 */
export function ProjectsLayout({
  githubConnected = false,
  children,
}: {
  githubConnected?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-320 grid-cols-1 gap-6 px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {projectsCopy.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          {githubConnected ? (
            <Button asChild variant="secondary">
              <Link href="/projects/new?source=github">
                <GitBranch aria-hidden />
                {projectsCopy.importFromGithub}
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/projects/new">
              <Plus aria-hidden />
              {projectsCopy.newProject}
            </Link>
          </Button>
        </div>
      </div>
      {children}
    </main>
  );
}
