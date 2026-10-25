"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import type { ErrorInfo } from "next/error";
import { NetworkButton as Button } from "@/features/system/network-status";
import { projectSettingsCopy as copy } from "@/features/project-settings/copy";
import { ProjectSettingsLayout } from "@/features/project-settings/settings-layout";
import { EmptyState } from "@/features/report/empty-state";

// "Couldn't load project settings. Retry"; details are never shown.
export default function ProjectSettingsError({
  retry,
}: Pick<ErrorInfo, "retry">) {
  const { id } = useParams<{ id: string }>();
  return (
    <ProjectSettingsLayout projectId={id}>
      <EmptyState
        icon={<TriangleAlert className="text-muted-foreground" aria-hidden />}
      >
        <p role="alert" className="text-base">
          {copy.error.title}
        </p>
        <Button variant="secondary" onClick={retry}>
          <RotateCw aria-hidden />
          {copy.error.retry}
        </Button>
      </EmptyState>
    </ProjectSettingsLayout>
  );
}
