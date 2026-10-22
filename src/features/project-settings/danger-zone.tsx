"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "../projects/delete-project-dialog";
import { projectSettingsCopy } from "./copy";

const copy = projectSettingsCopy.danger;

/** screens 5.12 "Danger zone": the same dialog as the dashboard card menu. */
export function DangerZone({
  project,
}: {
  project: { id: string; name: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <SettingsSection title={copy.title} description={copy.text} danger>
      <div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          {copy.delete}
        </Button>
      </div>
      <DeleteProjectDialog
        project={open ? project : null}
        onOpenChange={setOpen}
        // The dialog shows "Project deleted" itself.
        onDeleted={() => router.push("/projects")}
      />
    </SettingsSection>
  );
}
