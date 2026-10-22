"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useId, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { DemoHint } from "../demo/demo-hint";
import { renameProject } from "../projects/actions";
import { newProjectCopy, PROJECT_NAME_MAX } from "../projects/copy";
import { projectSettingsCopy as copy } from "./copy";

// The same rules as `/projects/new`; renameProject checks them again.
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, newProjectCopy.errors.nameRequired)
    .max(PROJECT_NAME_MAX, newProjectCopy.errors.nameTooLong),
});

type FormValues = z.input<typeof formSchema>;

/** screens 5.12 "General": the project name with its own "Save". */
export function GeneralSection({
  projectId,
  name,
  demo = false,
}: {
  projectId: string;
  name: string;
  /** A seeded demo project is shared by every visitor (plan.md 26.1). */
  demo?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name },
  });
  const typed = useWatch({ control, name: "name" });
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();
  const unchanged = typed.trim() === name;

  const onValid = ({ name: next }: FormValues) => {
    startTransition(async () => {
      try {
        const { error } = await renameProject(projectId, next);
        if (error) {
          setError("name", { message: error }, { shouldFocus: true });
          return;
        }
        reset({ name: next.trim() });
        toast({ title: copy.general.saved });
      } catch (error) {
        console.error("[settings] couldn't rename a project", error);
        toast({ title: copy.general.failed });
      }
    });
  };

  return (
    <SettingsSection title={copy.general.title}>
      <form
        onSubmit={(event) => void handleSubmit(onValid)(event)}
        noValidate
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <label htmlFor={inputId} className="text-base font-medium">
            {copy.general.nameLabel}
          </label>
          <Input
            id={inputId}
            autoComplete="off"
            maxLength={PROJECT_NAME_MAX}
            disabled={pending || demo}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? errorId : demo ? hintId : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <p id={errorId} role="alert" className="text-sm text-danger">
              {errors.name.message}
            </p>
          ) : null}
          {demo ? <DemoHint id={hintId} /> : null}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={unchanged || pending || demo}>
            {pending ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
                {copy.saving}
              </>
            ) : (
              copy.save
            )}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
