import { DangerZone } from "@/features/project-settings/danger-zone";
import { GeneralSection } from "@/features/project-settings/general-section";
import { loadProjectSettings } from "@/features/project-settings/load-project";
import { ProjectSettingsLayout } from "@/features/project-settings/settings-layout";
import { SourceSection } from "@/features/project-settings/source-section";

/** screens 5.12; access is checked by the layout (decisions 45). */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const project = await loadProjectSettings((await params).id);

  return (
    <ProjectSettingsLayout projectId={project.id}>
      <GeneralSection projectId={project.id} name={project.name} />
      <SourceSection
        projectId={project.id}
        source={project.source}
        repoUrl={project.repoUrl}
      />
      <DangerZone project={{ id: project.id, name: project.name }} />
    </ProjectSettingsLayout>
  );
}
