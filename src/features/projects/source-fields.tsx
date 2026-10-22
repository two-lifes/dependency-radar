"use client";

import { type ComponentProps, type ReactNode, type Ref, useId } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CheckSource } from "../landing/check-form-state";
import { landingCopy } from "../landing/copy";
import { Dropzone } from "../landing/dropzone";
import type { UploadSelection } from "../landing/upload-files";

const copy = landingCopy.form;

export type SourceValues = {
  source: CheckSource;
  packageJson: string;
  url: string;
};

/**
 * The three sources of the landing as a form section: `/projects/new` and
 * "Replace source" in project settings (screens 5.11, 5.12). The parent owns
 * the form state; this only lays the fields out. `githubExtra` goes under the
 * URL field: the repository list, only on `/projects/new` (decisions 48).
 */
export function SourceFields({
  legend,
  source,
  onSourceChange,
  pasteProps,
  urlProps,
  upload,
  onFiles,
  onRemove,
  browseRef,
  error,
  pending,
  githubExtra,
}: {
  legend: string;
  source: CheckSource;
  onSourceChange: (source: CheckSource) => void;
  pasteProps: ComponentProps<"textarea">;
  urlProps: ComponentProps<"input">;
  upload: UploadSelection;
  onFiles: (files: File[]) => void;
  onRemove: (kind: keyof UploadSelection) => void;
  browseRef: Ref<HTMLButtonElement>;
  error?: string;
  pending: boolean;
  githubExtra?: ReactNode;
}) {
  const errorId = useId();
  const fieldProps = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  } as const;

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-base font-medium">{legend}</legend>
      <Tabs
        value={source}
        onValueChange={(value) => onSourceChange(value as CheckSource)}
      >
        <TabsList>
          <TabsTrigger value="paste">{copy.tabs.paste}</TabsTrigger>
          <TabsTrigger value="upload">{copy.tabs.upload}</TabsTrigger>
          <TabsTrigger value="github">{copy.tabs.github}</TabsTrigger>
        </TabsList>

        {/* Every panel holds a field, so the panel itself is no Tab stop
            (WAI-ARIA tabs pattern); Radix makes it one by default. */}
        <TabsContent value="paste" tabIndex={-1}>
          <Textarea
            aria-label={copy.pasteLabel}
            placeholder={copy.pastePlaceholder}
            spellCheck={false}
            disabled={pending}
            className="min-h-40 font-mono text-sm"
            {...fieldProps}
            {...pasteProps}
          />
        </TabsContent>

        <TabsContent value="upload" tabIndex={-1}>
          <Dropzone
            selection={upload}
            onFiles={onFiles}
            onRemove={onRemove}
            browseRef={browseRef}
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
            disabled={pending}
          />
        </TabsContent>

        <TabsContent value="github" tabIndex={-1} className="grid gap-2">
          <Input
            type="url"
            inputMode="url"
            aria-label={copy.githubLabel}
            placeholder={copy.githubPlaceholder}
            disabled={pending}
            {...fieldProps}
            {...urlProps}
          />
          <p className="text-sm text-muted-foreground">{copy.githubHint}</p>
          {githubExtra}
        </TabsContent>
      </Tabs>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** The upload tab needs package.json; a lockfile alone is not a project. */
export function missingManifest(upload: UploadSelection): string | undefined {
  if (upload.manifest) return undefined;
  return upload.lockfile
    ? landingCopy.errors.lockfileOnly
    : landingCopy.errors.noManifestFile;
}

/** The fields of the chosen source, as the Server Actions read them. */
export function appendSource(
  formData: FormData,
  { source, packageJson, url }: SourceValues,
  upload: UploadSelection,
): void {
  formData.set("source", source);
  if (source === "github") formData.set("url", url);
  else if (source === "paste") formData.set("packageJson", packageJson);
  else {
    formData.set("packageJson", upload.manifest?.text ?? "");
    if (upload.lockfile) {
      formData.set("lockfile", upload.lockfile.gzipped, "package-lock.json.gz");
    }
  }
}
