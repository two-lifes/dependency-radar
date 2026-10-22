import { EmptyProjects } from "@/features/projects/empty-projects";
import { ProjectGrid } from "@/features/projects/project-grid";
import { ProjectsLayout } from "@/features/projects/projects-layout";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listProjects } from "@/server/db/projects";

/** screens 5.10: the dashboard (MVP: the simple one). */
export default async function ProjectsPage() {
  const { user } = await requireSession();
  const projects = await listProjects(getDb(), user.id);
  return (
    <ProjectsLayout>
      {projects.length === 0 ? (
        <EmptyProjects />
      ) : (
        <ProjectGrid projects={projects} />
      )}
    </ProjectsLayout>
  );
}
