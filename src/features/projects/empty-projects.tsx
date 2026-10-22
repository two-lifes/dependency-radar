import { FolderPlus, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../report/empty-state";
import { projectsCopy } from "./copy";

const copy = projectsCopy.empty;

/**
 * screens 5.10, first visit. "Import from GitHub" and "Connect GitHub" come
 * with the import page (plan task 24.1).
 */
export function EmptyProjects() {
  return (
    <EmptyState
      icon={<FolderPlus className="text-muted-foreground" aria-hidden />}
    >
      <div className="grid gap-1">
        <h2 className="text-md font-semibold">{copy.title}</h2>
        <p className="text-base text-muted-foreground">{copy.text}</p>
      </div>
      <Button asChild>
        <Link href="/projects/new">
          <Plus aria-hidden />
          {projectsCopy.newProject}
        </Link>
      </Button>
    </EmptyState>
  );
}
