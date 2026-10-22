"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { removeProject } from "./actions";
import { projectsCopy } from "./copy";

const copy = projectsCopy.delete;

/** screens 6: deleting is irreversible, so the name has to be typed in. */
export function DeleteProjectDialog({
  project,
  onOpenChange,
  onDeleted,
}: {
  /** The project to delete; null keeps the dialog closed. */
  project: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (projectId: string) => void;
}) {
  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      {project ? (
        <DialogContent>
          {/* Keyed so the typed name resets for each project. */}
          <DeleteForm
            key={project.id}
            project={project}
            onDeleted={() => {
              onDeleted(project.id);
              onOpenChange(false);
            }}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DeleteForm({
  project,
  onDeleted,
}: {
  project: { id: string; name: string };
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const matches = typed.trim() === project.name;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) return;
    startTransition(async () => {
      try {
        const { ok } = await removeProject(project.id);
        if (!ok) throw new Error("Project not deleted");
        toast({ title: copy.done });
        onDeleted();
      } catch (error) {
        console.error("[dashboard] couldn't delete a project", error);
        toast({ title: copy.failed });
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.text(project.name)}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <label htmlFor={inputId} className="text-base font-medium">
          {copy.confirmLabel(project.name)}
        </label>
        <Input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={pending}>
            {copy.cancel}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant="destructive"
          className="bg-danger-soft"
          disabled={!matches || pending}
        >
          {pending ? (
            <>
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
              {copy.deleting}
            </>
          ) : (
            copy.confirm
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
