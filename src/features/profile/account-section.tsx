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
import { updateName } from "./actions";
import { PROFILE_NAME_MAX, profileCopy } from "./copy";

const copy = profileCopy.account;

// updateName checks the same rule again.
const formSchema = z.object({
  name: z.string().trim().max(PROFILE_NAME_MAX, copy.nameTooLong),
});

type FormValues = z.input<typeof formSchema>;

/** screens 5.13: the name with "Save", the email read-only. */
export function AccountSection({
  name,
  email,
}: {
  name: string;
  email: string;
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
  const nameId = useId();
  const errorId = useId();
  const emailId = useId();
  const unchanged = typed.trim() === name;

  const onValid = ({ name: next }: FormValues) => {
    startTransition(async () => {
      try {
        const { error } = await updateName(next);
        if (error) {
          setError("name", { message: error }, { shouldFocus: true });
          return;
        }
        reset({ name: next.trim() });
        toast({ title: copy.saved });
      } catch (error) {
        console.error("[profile] couldn't save the name", error);
        toast({ title: copy.failed });
      }
    });
  };

  return (
    <SettingsSection title={copy.title}>
      <form
        onSubmit={(event) => void handleSubmit(onValid)(event)}
        noValidate
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <label htmlFor={nameId} className="text-base font-medium">
            {copy.nameLabel}
          </label>
          <Input
            id={nameId}
            autoComplete="name"
            maxLength={PROFILE_NAME_MAX}
            disabled={pending}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? errorId : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <p id={errorId} role="alert" className="text-sm text-danger">
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <label htmlFor={emailId} className="text-base font-medium">
            {copy.emailLabel}
          </label>
          <Input
            id={emailId}
            value={email}
            readOnly
            className="bg-muted text-muted-foreground"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={unchanged || pending}>
            {pending ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
                {profileCopy.saving}
              </>
            ) : (
              profileCopy.save
            )}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
