"use client";

import { FileJson, GitBranch, Loader2 } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { SettingsSection } from "@/components/settings-section";
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
import { githubErrorCopy } from "../check/copy";
import { DemoHint } from "../demo/demo-hint";
import type { CheckSource } from "../landing/check-form-state";
import { landingCopy } from "../landing/copy";
import {
  addUploadedFiles,
  type UploadSelection,
} from "../landing/upload-files";
import { replaceSource } from "../projects/actions";
import { projectsCopy } from "../projects/copy";
import {
  appendSource,
  missingManifest,
  SourceFields,
  type SourceValues,
} from "../projects/source-fields";
import { projectSettingsCopy } from "./copy";
import { initialReplaceSourceState } from "./replace-source-state";

const copy = projectSettingsCopy.source;

const emptyForm: SourceValues = { source: "paste", packageJson: "", url: "" };

/**
 * screens 5.12 "Source": the current source and "Replace source", the same
 * three options as the landing, confirmed before a new check starts.
 */
export function SourceSection({
  projectId,
  source,
  repoUrl,
  demo = false,
}: {
  projectId: string;
  source: CheckSource;
  repoUrl: string | null;
  /** A seeded demo project is shared by every visitor (plan.md 26.1). */
  demo?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const hintId = useId();

  return (
    <SettingsSection title={copy.title}>
      <CurrentSource source={source} repoUrl={repoUrl} />
      {editing ? (
        <ReplaceSourceForm
          projectId={projectId}
          onCancel={() => {
            setEditing(false);
            // The form is gone; focus goes back to what opened it.
            requestAnimationFrame(() => replaceRef.current?.focus());
          }}
        />
      ) : (
        <div className="grid justify-items-start gap-2">
          <Button
            ref={replaceRef}
            variant="secondary"
            disabled={demo}
            aria-describedby={demo ? hintId : undefined}
            onClick={() => setEditing(true)}
          >
            {copy.replace}
          </Button>
          {demo ? <DemoHint id={hintId} /> : null}
        </div>
      )}
    </SettingsSection>
  );
}

function CurrentSource({
  source,
  repoUrl,
}: {
  source: CheckSource;
  repoUrl: string | null;
}) {
  const Icon = source === "github" ? GitBranch : FileJson;
  return (
    <div className="grid gap-1">
      <p className="text-sm text-muted-foreground">{copy.current}</p>
      <p className="flex min-w-0 items-center gap-2 text-base">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {source === "github" && repoUrl ? (
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate font-mono text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {repoUrl.replace(/^https:\/\//, "")}
          </a>
        ) : (
          <span className="truncate">
            {projectsCopy.card.source[source === "upload" ? "upload" : "paste"]}
          </span>
        )}
      </p>
    </div>
  );
}

function ReplaceSourceForm({
  projectId,
  onCancel,
}: {
  projectId: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    replaceSource.bind(null, projectId),
    initialReplaceSourceState,
  );
  const { register, handleSubmit, setValue, control } = useForm<SourceValues>({
    defaultValues: emptyForm,
  });
  const source = useWatch({ control, name: "source" });
  const [upload, setUpload] = useState<UploadSelection>({});
  const [localError, setLocalError] = useState<string>();
  // As in the new project form: a server error stays until the field changes.
  const [dismissedAttempt, setDismissedAttempt] = useState(0);
  // The submitted fields wait here while the confirmation is open.
  const [confirming, setConfirming] = useState<FormData | null>(null);

  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);

  const serverError =
    !pending && state.attempt !== dismissedAttempt ? state.error : undefined;
  const error =
    localError ??
    (serverError && serverError.field === source
      ? serverError.message
      : undefined);

  // screens 5.1: on error the field takes focus.
  useEffect(() => {
    const field = state.error?.field;
    if (!field) return;
    const target = { paste: pasteRef, upload: browseRef, github: urlRef }[field]
      .current;
    target?.focus();
  }, [state]);

  const clearErrors = () => {
    setLocalError(undefined);
    setDismissedAttempt(state.attempt);
  };

  const onFiles = async (files: File[]) => {
    const result = await addUploadedFiles(upload, files);
    if (result.ok) {
      setUpload(result.selection);
      clearErrors();
    } else {
      setLocalError(result.message);
      browseRef.current?.focus();
    }
  };

  const onValid = (form: SourceValues) => {
    // Empty fields are caught here, so the confirmation never leads to an
    // error that was known before it.
    const empty = emptySource(form, upload);
    if (empty) {
      setLocalError(empty);
      const target = { paste: pasteRef, upload: browseRef, github: urlRef }[
        form.source
      ].current;
      target?.focus();
      return;
    }
    const formData = new FormData();
    appendSource(formData, form, upload);
    setConfirming(formData);
  };

  const confirm = () => {
    if (!confirming) return;
    const formData = confirming;
    setConfirming(null);
    startTransition(() => formAction(formData));
  };

  const { ref: pasteFieldRef, ...pasteField } = register("packageJson", {
    onChange: clearErrors,
  });
  const { ref: urlFieldRef, ...urlField } = register("url", {
    onChange: clearErrors,
  });

  return (
    <>
      <form
        onSubmit={(event) => void handleSubmit(onValid)(event)}
        noValidate
        aria-label={copy.replace}
        className="grid gap-4"
      >
        <SourceFields
          legend={copy.newSource}
          source={source}
          onSourceChange={(value) => {
            setValue("source", value);
            setLocalError(undefined);
          }}
          pasteProps={{
            ...pasteField,
            ref: (element: HTMLTextAreaElement | null) => {
              pasteFieldRef(element);
              pasteRef.current = element;
            },
          }}
          urlProps={{
            ...urlField,
            ref: (element: HTMLInputElement | null) => {
              urlFieldRef(element);
              urlRef.current = element;
            },
          }}
          upload={upload}
          onFiles={(files) => void onFiles(files)}
          onRemove={(kind) => {
            setUpload((current) => ({ ...current, [kind]: undefined }));
            clearErrors();
          }}
          browseRef={browseRef}
          error={error}
          pending={pending}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
                {copy.pending}
              </>
            ) : (
              projectSettingsCopy.save
            )}
          </Button>
        </div>
      </form>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.confirm.title}</DialogTitle>
            <DialogDescription>{copy.confirm.text}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{copy.confirm.cancel}</Button>
            </DialogClose>
            <Button onClick={confirm}>{copy.confirm.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function emptySource(
  { source, packageJson, url }: SourceValues,
  upload: UploadSelection,
): string | undefined {
  if (source === "upload") return missingManifest(upload);
  if (source === "paste") {
    return packageJson.trim() === ""
      ? landingCopy.errors.emptyPaste
      : undefined;
  }
  return url.trim() === ""
    ? githubErrorCopy["invalid-url"]({ code: "invalid-url" })
    : undefined;
}
