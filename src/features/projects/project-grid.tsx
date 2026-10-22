"use client";

import { useState } from "react";
import {
  cardStatus,
  type DashboardProject,
  needsFirstCheck,
} from "@/server/analysis/dashboard-card";
import { displayStatus } from "./check-queue";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectCard } from "./project-card";
import { useCheckQueue } from "./use-check-queue";

/** screens 5.10: the cards and the dashboard's check queue. */
export function ProjectGrid({ projects }: { projects: DashboardProject[] }) {
  const { queue, checkNow, forget } = useCheckQueue(
    projects.filter(needsFirstCheck).map((project) => project.id),
  );
  const [deleting, setDeleting] = useState<DashboardProject | null>(null);

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id} className="grid">
            <ProjectCard
              project={project}
              status={displayStatus(
                cardStatus(project),
                queue.items.find((item) => item.projectId === project.id),
                queue.paused,
              )}
              onCheckNow={() => checkNow(project.id)}
              onDelete={() => setDeleting(project)}
            />
          </li>
        ))}
      </ul>
      <DeleteProjectDialog
        project={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onDeleted={forget}
      />
    </>
  );
}
