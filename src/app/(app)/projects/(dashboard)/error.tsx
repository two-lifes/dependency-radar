"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import type { ErrorInfo } from "next/error";
import { NetworkButton as Button } from "@/features/system/network-status";
import { projectsCopy } from "@/features/projects/copy";
import { ProjectsLayout } from "@/features/projects/projects-layout";
import { EmptyState } from "@/features/report/empty-state";

// screens 5.10: "Couldn't load projects. Retry"; details are never shown.
export default function ProjectsError({ retry }: Pick<ErrorInfo, "retry">) {
  return (
    <ProjectsLayout>
      <EmptyState
        icon={<TriangleAlert className="text-muted-foreground" aria-hidden />}
      >
        <p role="alert" className="text-base">
          {projectsCopy.error.title}
        </p>
        <Button variant="secondary" onClick={retry}>
          <RotateCw aria-hidden />
          {projectsCopy.error.retry}
        </Button>
      </EmptyState>
    </ProjectsLayout>
  );
}
