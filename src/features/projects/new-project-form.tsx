"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { NetworkButton, NetworkError } from "../system/network-status";
import { networkCopy } from "../system/network-copy";
import { useNetworkAction } from "../system/use-network-action";
import { isOnline } from "@/lib/use-online-status";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addUploadedFiles,
  type UploadSelection,
} from "../landing/upload-files";
import type { CheckSource } from "../landing/check-form-state";
import { createProject } from "./actions";
import { newProjectCopy as copy, PROJECT_NAME_MAX } from "./copy";
import { GithubRepoList, useGithubRepos } from "./github-repo-list";
import type { RepoRow } from "./github-repos";
import { initialNewProjectState } from "./new-project-state";
import { packageNameFrom } from "./package-name";
import { appendSource, missingManifest, SourceFields } from "./source-fields";
import { useDiscardGuard } from "./use-discard-guard";

// The server checks the same rules (createProject); here they only save a
// round trip. Source contents are checked on the server, as on the landing.
const formSchema = z
  .object({
    source: z.enum(["paste", "upload", "github"]),
    name: z.string().trim().max(PROJECT_NAME_MAX, copy.errors.nameTooLong),
    packageJson: z.string(),
    url: z.string(),
  })
  .refine((form) => form.source === "github" || form.name !== "", {
    path: ["name"],
    message: copy.errors.nameRequired,
  });

type FormValues = z.input<typeof formSchema>;

/**
 * screens 5.11: name and source, then "Create & check". With GitHub connected
 * the "GitHub URL" tab lists the user's repositories (screens 5.11.1).
 */
export function NewProjectForm({
  initialSource = "paste",
  githubConnected = false,
}: {
  initialSource?: CheckSource;
  githubConnected?: boolean;
}) {
  const network = useNetworkAction(createProject);
  const [state, formAction, pending] = useActionState(
    network.action,
    initialNewProjectState,
  );
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: initialSource,
      name: "",
      packageJson: "",
      url: "",
    },
  });
  const [upload, setUpload] = useState<UploadSelection>({});
  // Errors found in the browser (dropped files) before anything is sent.
  const [localError, setLocalError] = useState<string>();
  // A server error stays until the next answer unless the user edits the
  // field it was about; this remembers which answer was dismissed.
  const [dismissedAttempt, setDismissedAttempt] = useState(0);
  // Once the name is typed by hand, package.json no longer replaces it.
  const [nameEdited, setNameEdited] = useState(false);
  // The picked row; typing in the URL field clears it.
  const [selectedRepoUrl, setSelectedRepoUrl] = useState<string>();
  // Own refs rather than RHF's setFocus, which focused nothing after a
  // server answer here.
  const nameRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);

  const nameId = useId();
  const nameErrorId = useId();

  const [source, name, packageJson, url] = useWatch({
    control,
    name: ["source", "name", "packageJson", "url"],
  });
  const dirty =
    name.trim() !== "" ||
    packageJson.trim() !== "" ||
    url.trim() !== "" ||
    Boolean(upload.manifest || upload.lockfile);
  const guard = useDiscardGuard(dirty && !pending);
  const repos = useGithubRepos(githubConnected && source === "github");

  const serverError =
    !pending && state.attempt !== dismissedAttempt ? state.error : undefined;
  const nameError =
    errors.name?.message ??
    (serverError?.field === "name" ? serverError.message : undefined);
  const sourceError =
    localError ??
    (serverError && serverError.field === source
      ? serverError.message
      : undefined);

  // screens 5.1: on error the field takes focus; `attempt` changes on every
  // answer, so a repeated error refocuses too.
  useEffect(() => {
    const field = state.error?.field;
    if (!field) return;
    const target = {
      name: nameRef,
      paste: pasteRef,
      upload: browseRef,
      github: urlRef,
    }[field].current;
    target?.focus();
  }, [state]);

  const clearErrors = () => {
    setLocalError(undefined);
    setDismissedAttempt(state.attempt);
  };

  const suggestName = (packageJson: string) => {
    if (nameEdited) return;
    const name = packageNameFrom(packageJson);
    if (name) setValue("name", name, { shouldValidate: Boolean(errors.name) });
  };

  const onFiles = async (files: File[]) => {
    const result = await addUploadedFiles(upload, files);
    if (result.ok) {
      setUpload(result.selection);
      if (result.selection.manifest)
        suggestName(result.selection.manifest.text);
      clearErrors();
    } else {
      setLocalError(result.message);
      browseRef.current?.focus();
    }
  };

  const onSelectRepo = (repo: RepoRow) => {
    setSelectedRepoUrl(repo.url);
    setValue("url", repo.url);
    if (!nameEdited) {
      setValue("name", repo.name.slice(0, PROJECT_NAME_MAX), {
        shouldValidate: Boolean(errors.name),
      });
    }
    clearErrors();
  };

  const onValid = (form: FormValues) => {
    if (!isOnline() || pending) return;
    const noManifest =
      form.source === "upload" ? missingManifest(upload) : undefined;
    if (noManifest) {
      setLocalError(noManifest);
      browseRef.current?.focus();
      return;
    }
    const formData = new FormData();
    formData.set("name", form.name);
    appendSource(formData, form, upload);
    startTransition(() => formAction(formData));
  };

  const { ref: nameFieldRef, ...nameField } = register("name", {
    onChange: () => {
      setNameEdited(true);
      clearErrors();
    },
  });
  const { ref: pasteFieldRef, ...pasteField } = register("packageJson", {
    onChange: (event: { target: { value: string } }) => {
      suggestName(event.target.value);
      clearErrors();
    },
  });
  const { ref: urlFieldRef, ...urlField } = register("url", {
    onChange: () => {
      setSelectedRepoUrl(undefined);
      clearErrors();
    },
  });

  return (
    <>
      <form
        onSubmit={(event) => void handleSubmit(onValid)(event)}
        noValidate
        aria-label={copy.title}
        className="grid gap-6"
      >
        <div className="grid gap-2">
          <label htmlFor={nameId} className="text-base font-medium">
            {copy.nameLabel}
          </label>
          <Input
            id={nameId}
            autoComplete="off"
            maxLength={PROJECT_NAME_MAX}
            disabled={pending}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
            {...nameField}
            ref={(element) => {
              nameFieldRef(element);
              nameRef.current = element;
            }}
          />
          {nameError ? (
            <p id={nameErrorId} role="alert" className="text-sm text-danger">
              {nameError}
            </p>
          ) : source === "github" ? (
            <p className="text-sm text-muted-foreground">
              {copy.nameHintGithub}
            </p>
          ) : null}
        </div>

        <SourceFields
          legend={copy.sourceLabel}
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
          error={sourceError}
          pending={pending}
          githubExtra={
            <GithubRepoList
              connected={githubConnected}
              state={repos}
              selectedUrl={selectedRepoUrl}
              onSelect={onSelectRepo}
              disabled={pending}
            />
          }
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="secondary">
            <Link href="/projects">{copy.cancel}</Link>
          </Button>
          <NetworkButton type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
                {copy.pending}
              </>
            ) : (
              copy.submit
            )}
          </NetworkButton>
        </div>
        {serverError ? (
          <NetworkButton
            type="submit"
            variant="secondary"
            size="sm"
            disabled={pending}
          >
            {networkCopy.retry}
          </NetworkButton>
        ) : null}
        <NetworkError message={network.error} disabled={pending} />
      </form>

      <Dialog
        open={guard.pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) guard.keep();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.discard.title}</DialogTitle>
            <DialogDescription>{copy.discard.text}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={guard.keep}>
              {copy.discard.keep}
            </Button>
            <Button
              variant="destructive"
              className="bg-danger-soft"
              onClick={guard.discard}
            >
              {copy.discard.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
