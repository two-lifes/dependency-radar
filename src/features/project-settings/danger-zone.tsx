"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { DemoHint } from "../demo/demo-hint";
import { DeleteProjectDialog } from "../projects/delete-project-dialog";
import { projectSettingsCopy } from "./copy";

const copy = projectSettingsCopy.danger;

/** screens 5.12 "Danger zone": the same dialog as the dashboard card menu. */
export function DangerZone({
  project,
  demo = false,
}: {
  project: { id: string; name: string };
  /** The shared demo account can't delete projects (plan.md 25). */
  demo?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hintId = useId();

  return (
    <SettingsSection title={copy.title} description={copy.text} danger>
      <div className="grid justify-items-start gap-2">
        <Button
          variant="destructive"
          disabled={demo}
          aria-describedby={demo ? hintId : undefined}
          onClick={() => setOpen(true)}
        >
          <Trash2 aria-hidden />
          {copy.delete}
        </Button>
        {demo ? <DemoHint id={hintId} /> : null}
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
