import { EmptyProjects } from "@/features/projects/empty-projects";
import { ProjectGrid } from "@/features/projects/project-grid";
import { ProjectsLayout } from "@/features/projects/projects-layout";
import { requireSession } from "@/server/auth/session";
import { getGithubAccountId } from "@/server/db/accounts";
import { getDb } from "@/server/db/client";
import { listProjects } from "@/server/db/projects";

/** screens 5.10: the dashboard (MVP: the simple one). */
export default async function ProjectsPage() {
  const { user } = await requireSession();
  const db = getDb();
  const [projects, githubAccountId] = await Promise.all([
    listProjects(db, user.id),
    getGithubAccountId(db, user.id),
  ]);
  const githubConnected = githubAccountId !== undefined;
  return (
    <ProjectsLayout
      githubConnected={githubConnected}
      actions={projects.length > 0}
    >
      {projects.length === 0 ? (
        <EmptyProjects githubConnected={githubConnected} />
      ) : (
        <ProjectGrid projects={projects} />
      )}
    </ProjectsLayout>
  );
}
