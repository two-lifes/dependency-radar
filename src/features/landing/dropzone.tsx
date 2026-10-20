"use client";

import { FileJson, Upload, X } from "lucide-react";
import { type DragEvent, type Ref, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { landingCopy } from "./copy";
import type { UploadSelection } from "./upload-files";

const copy = landingCopy.form;

/** Native drag & drop plus a "browse" button for keyboard and touch users. */
export function Dropzone({
  selection,
  onFiles,
  onRemove,
  browseRef,
  invalid,
  describedBy,
  disabled,
}: {
  selection: UploadSelection;
  onFiles: (files: File[]) => void;
  onRemove: (kind: keyof UploadSelection) => void;
  browseRef: Ref<HTMLButtonElement>;
  invalid: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    onFiles([...event.dataTransfer.files]);
  };

  const files = (["manifest", "lockfile"] as const).flatMap((kind) => {
    const file = selection[kind];
    return file ? [{ kind, name: file.name }] : [];
  });

  return (
    <div className="grid gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-4 py-6 text-center text-base text-muted-foreground transition-colors duration-150 ease-out",
          dragging && "border-brand bg-brand-soft",
          invalid && "border-danger",
        )}
      >
        <Upload className="size-5" aria-hidden="true" />
        <p>
          {copy.dropzone}{" "}
          <button
            ref={browseRef}
            type="button"
            disabled={disabled}
            aria-describedby={describedBy}
            onClick={() => inputRef.current?.click()}
            className="rounded-sm font-medium text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {copy.browse}
          </button>
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            onFiles([...(event.target.files ?? [])]);
            // Same file picked again after removal must fire change again.
            event.target.value = "";
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className="grid gap-1">
          {files.map(({ kind, name }) => (
            <li
              key={kind}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              <FileJson
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate font-mono">{name}</span>
              <span className="text-muted-foreground">
                · {copy.fileKind[kind]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                aria-label={copy.removeFile(name)}
                disabled={disabled}
                onClick={() => onRemove(kind)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
