import type { ReactNode } from "react";
import { loadProjectSettings } from "@/features/project-settings/load-project";

/**
 * Checks access before `loading.tsx` streams the skeleton: a 404 found in the
 * page would come too late for the status code.
 */
export default async function ProjectSettingsAccess({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  await loadProjectSettings((await params).id);
  return children;
}
