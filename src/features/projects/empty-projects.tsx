import { FolderPlus, GitBranch, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../report/empty-state";
import { projectsCopy } from "./copy";

const copy = projectsCopy.empty;

/**
 * screens 5.10, first visit: with GitHub connected "Import from GitHub" leads,
 * otherwise "New project" and a way to connect GitHub.
 */
export function EmptyProjects({
  githubConnected = false,
}: {
  githubConnected?: boolean;
}) {
  return (
    <EmptyState
      icon={<FolderPlus className="text-muted-foreground" aria-hidden />}
    >
      <div className="grid gap-1">
        <h2 className="text-md font-semibold">{copy.title}</h2>
        <p className="text-base text-muted-foreground">{copy.text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {githubConnected ? (
          <Button asChild>
            <Link href="/projects/new?source=github">
              <GitBranch aria-hidden />
              {projectsCopy.importFromGithub}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant={githubConnected ? "secondary" : "primary"}>
          <Link href="/projects/new">
            <Plus aria-hidden />
            {projectsCopy.newProject}
          </Link>
        </Button>
      </div>
      {githubConnected ? null : (
        <Link
          href="/settings/profile"
          className="rounded-sm text-sm text-brand-text underline-offset-4 hover:underline"
        >
          {projectsCopy.connectGithub}
        </Link>
      )}
    </EmptyState>
  );
}
