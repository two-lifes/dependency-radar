import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { projectsCopy } from "./copy";

/** screens 5.10, item 1: the title and "New project" over every state. */
export function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-320 grid-cols-1 gap-6 px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {projectsCopy.title}
        </h1>
        <Button asChild>
          <Link href="/projects/new">
            <Plus aria-hidden />
            {projectsCopy.newProject}
          </Link>
        </Button>
      </div>
      {children}
    </main>
  );
}
