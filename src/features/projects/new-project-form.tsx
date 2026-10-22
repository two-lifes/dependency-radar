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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CheckSource } from "../landing/check-form-state";
import { landingCopy } from "../landing/copy";
import { Dropzone } from "../landing/dropzone";
import {
  addUploadedFiles,
  type UploadSelection,
} from "../landing/upload-files";
import { createProject } from "./actions";
import { newProjectCopy as copy, PROJECT_NAME_MAX } from "./copy";
import { initialNewProjectState } from "./new-project-state";
import { packageNameFrom } from "./package-name";
import { useDiscardGuard } from "./use-discard-guard";

const sourceCopy = landingCopy.form;

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

/** screens 5.11: name and source, then "Create & check". */
export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(
    createProject,
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
    defaultValues: { source: "paste", name: "", packageJson: "", url: "" },
  });
  const [upload, setUpload] = useState<UploadSelection>({});
  // Errors found in the browser (dropped files) before anything is sent.
  const [localError, setLocalError] = useState<string>();
  // A server error stays until the next answer unless the user edits the
  // field it was about; this remembers which answer was dismissed.
  const [dismissedAttempt, setDismissedAttempt] = useState(0);
  // Once the name is typed by hand, package.json no longer replaces it.
  const [nameEdited, setNameEdited] = useState(false);
  // Own refs rather than RHF's setFocus, which focused nothing after a
  // server answer here.
  const nameRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);

  const nameId = useId();
  const nameErrorId = useId();
  const sourceErrorId = useId();

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

  const onValid = (form: FormValues) => {
    if (form.source === "upload" && !upload.manifest) {
      setLocalError(
        upload.lockfile
          ? landingCopy.errors.lockfileOnly
          : landingCopy.errors.noManifestFile,
      );
      browseRef.current?.focus();
      return;
    }
    const formData = new FormData();
    formData.set("source", form.source);
    formData.set("name", form.name);
    if (form.source === "github") formData.set("url", form.url);
    else if (form.source === "paste") {
      formData.set("packageJson", form.packageJson);
    } else {
      formData.set("packageJson", upload.manifest?.text ?? "");
      if (upload.lockfile) {
        formData.set(
          "lockfile",
          upload.lockfile.gzipped,
          "package-lock.json.gz",
        );
      }
    }
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
    onChange: clearErrors,
  });
  const sourceFieldProps = {
    "aria-invalid": sourceError ? true : undefined,
    "aria-describedby": sourceError ? sourceErrorId : undefined,
  } as const;

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

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-base font-medium">
            {copy.sourceLabel}
          </legend>
          <Tabs
            value={source}
            onValueChange={(value) => {
              setValue("source", value as CheckSource);
              setLocalError(undefined);
            }}
          >
            <TabsList>
              <TabsTrigger value="paste">{sourceCopy.tabs.paste}</TabsTrigger>
              <TabsTrigger value="upload">{sourceCopy.tabs.upload}</TabsTrigger>
              <TabsTrigger value="github">{sourceCopy.tabs.github}</TabsTrigger>
            </TabsList>

            {/* Every panel holds a field, so the panel itself is no Tab stop
                (WAI-ARIA tabs pattern); Radix makes it one by default. */}
            <TabsContent value="paste" tabIndex={-1}>
              <Textarea
                aria-label={sourceCopy.pasteLabel}
                placeholder={sourceCopy.pastePlaceholder}
                spellCheck={false}
                disabled={pending}
                className="min-h-40 font-mono text-sm"
                {...sourceFieldProps}
                {...pasteField}
                ref={(element) => {
                  pasteFieldRef(element);
                  pasteRef.current = element;
                }}
              />
            </TabsContent>

            <TabsContent value="upload" tabIndex={-1}>
              <Dropzone
                selection={upload}
                onFiles={(files) => void onFiles(files)}
                onRemove={(kind) => {
                  setUpload((current) => ({ ...current, [kind]: undefined }));
                  clearErrors();
                }}
                browseRef={browseRef}
                invalid={Boolean(sourceError)}
                describedBy={sourceError ? sourceErrorId : undefined}
                disabled={pending}
              />
            </TabsContent>

            <TabsContent value="github" tabIndex={-1} className="grid gap-2">
              <Input
                type="url"
                inputMode="url"
                aria-label={sourceCopy.githubLabel}
                placeholder={sourceCopy.githubPlaceholder}
                disabled={pending}
                {...sourceFieldProps}
                {...urlField}
                ref={(element) => {
                  urlFieldRef(element);
                  urlRef.current = element;
                }}
              />
              <p className="text-sm text-muted-foreground">
                {sourceCopy.githubHint}
              </p>
            </TabsContent>
          </Tabs>
          {sourceError ? (
            <p id={sourceErrorId} role="alert" className="text-sm text-danger">
              {sourceError}
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="secondary">
            <Link href="/projects">{copy.cancel}</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
                {copy.pending}
              </>
            ) : (
              copy.submit
            )}
          </Button>
        </div>
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
