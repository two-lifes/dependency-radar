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
  const project = await params.then(({ id }) => loadProjectSettings(id));
  const demo = !project.editable;

  return (
    <ProjectSettingsLayout projectId={project.id}>
      <GeneralSection projectId={project.id} name={project.name} demo={demo} />
      <SourceSection
        nextCheckAt={project.nextCheckAt}
        projectId={project.id}
        source={project.source}
        repoUrl={project.repoUrl}
        demo={demo}
      />
      <DangerZone
        project={{ id: project.id, name: project.name }}
        demo={demo}
      />
    </ProjectSettingsLayout>
  );
}
