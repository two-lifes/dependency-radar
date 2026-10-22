import { DangerZone } from "@/features/project-settings/danger-zone";
import { GeneralSection } from "@/features/project-settings/general-section";
import { loadProjectSettings } from "@/features/project-settings/load-project";
import { ProjectSettingsLayout } from "@/features/project-settings/settings-layout";
import { SourceSection } from "@/features/project-settings/source-section";
import { requireSession } from "@/server/auth/session";
import { isDemoUser } from "@/server/demo/demo-user";

/** screens 5.12; access is checked by the layout (decisions 45). */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, { user }] = await Promise.all([
    params.then(({ id }) => loadProjectSettings(id)),
    requireSession(),
  ]);

  return (
    <ProjectSettingsLayout projectId={project.id}>
      <GeneralSection projectId={project.id} name={project.name} />
      <SourceSection
        projectId={project.id}
        source={project.source}
        repoUrl={project.repoUrl}
      />
      <DangerZone
        project={{ id: project.id, name: project.name }}
        demo={isDemoUser(user.id)}
      />
    </ProjectSettingsLayout>
  );
}
