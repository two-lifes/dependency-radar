import { ProjectsLayout } from "@/features/projects/projects-layout";
import { ProjectsSkeleton } from "@/features/projects/projects-skeleton";

export default function ProjectsLoading() {
  return (
    <ProjectsLayout>
      <ProjectsSkeleton />
    </ProjectsLayout>
  );
}
