"use client";

import { Loader2 } from "lucide-react";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { NetworkButton, NetworkError } from "../system/network-status";
import { networkCopy } from "../system/network-copy";
import { useNetworkAction } from "../system/use-network-action";
import { isOnline } from "@/lib/use-online-status";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type CheckFormAction,
  type CheckSource,
  initialCheckFormState,
} from "./check-form-state";
import { landingCopy } from "./copy";
import { Dropzone } from "./dropzone";
import { SAMPLE_PACKAGE_JSON } from "./sample-package-json";
import { addUploadedFiles, type UploadSelection } from "./upload-files";
import {
  GuestGithubButton,
  GuestQuotaNotice,
  useGuestQuota,
} from "../guest-quota/guest-quota";

const copy = landingCopy.form;

/** screens 5.1, block 3: the main element of the landing. */
export function CheckForm({ action }: { action: CheckFormAction }) {
  const network = useNetworkAction(action);
  const [state, formAction, pending] = useActionState(
    network.action,
    initialCheckFormState,
  );
  const [source, setSource] = useState<CheckSource>("paste");
  const quota = useGuestQuota();
  const exhausted =
    quota.state.kind !== "account" &&
    (state.code === "guest-quota-exhausted" ||
      (quota.state.kind === "guest" && quota.state.remaining === 0));
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [upload, setUpload] = useState<UploadSelection>({});
  // Errors found in the browser (dropped files) before anything is sent.
  const [localError, setLocalError] = useState<string>();
  // A server error stays until the next answer unless the user edits the
  // input it was about; this remembers which answer was dismissed.
  const [dismissedAttempt, setDismissedAttempt] = useState(0);

  const errorId = useId();
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const serverError =
    !pending &&
    state.attempt !== dismissedAttempt &&
    state.error?.source === source
      ? state.error.message
      : undefined;
  const error = localError ?? serverError;

  const clearErrors = () => {
    setLocalError(undefined);
    setDismissedAttempt(state.attempt);
  };

  const focusField = (target: CheckSource) => {
    const field = {
      paste: pasteRef,
      upload: browseRef,
      github: urlRef,
    }[target].current;
    field?.focus();
  };

  // screens 5.1: on error the field takes focus. `attempt` changes on every
  // answer, so a repeated error refocuses too.
  useEffect(() => {
    if (state.error) focusField(state.error.source);
  }, [state]);

  const onFiles = async (files: File[]) => {
    const result = await addUploadedFiles(upload, files);
    if (result.ok) {
      setUpload(result.selection);
      clearErrors();
    } else {
      setLocalError(result.message);
      focusField("upload");
    }
  };

  // Submitted by hand, not through the form's `action`: the gzipped lockfile
  // is a Blob in state, and a form field can't carry it.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOnline() || quota.blocked || exhausted || pending) return;
    if (source === "upload" && !upload.manifest) {
      setLocalError(
        upload.lockfile
          ? landingCopy.errors.lockfileOnly
          : landingCopy.errors.noManifestFile,
      );
      focusField("upload");
      return;
    }

    const formData = new FormData(event.currentTarget);
    if (source === "upload" && upload.lockfile) {
      formData.set("lockfile", upload.lockfile.gzipped, "package-lock.json.gz");
    }
    startTransition(() => formAction(formData));
  };
  const fieldProps = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  } as const;

  return (
    <form
      onSubmit={onSubmit}
      aria-label={copy.label}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <input type="hidden" name="source" value={source} />
      {source === "upload" ? (
        <input
          type="hidden"
          name="packageJson"
          value={upload.manifest?.text ?? ""}
        />
      ) : null}

      <Tabs
        value={source}
        onValueChange={(value) => {
          setSource(value as CheckSource);
          setLocalError(undefined);
        }}
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
            ref={pasteRef}
            name="packageJson"
            aria-label={copy.pasteLabel}
            placeholder={copy.pastePlaceholder}
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value);
              clearErrors();
            }}
            spellCheck={false}
            disabled={pending}
            className="min-h-40 font-mono text-sm"
            {...fieldProps}
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
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
            disabled={pending}
          />
        </TabsContent>

        <TabsContent value="github" tabIndex={-1} className="grid gap-2">
          <Input
            ref={urlRef}
            name="url"
            type="url"
            inputMode="url"
            aria-label={copy.githubLabel}
            placeholder={copy.githubPlaceholder}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              clearErrors();
            }}
            disabled={pending}
            {...fieldProps}
          />
          <p className="text-sm text-muted-foreground">{copy.githubHint}</p>
        </TabsContent>
      </Tabs>

      {error ? (
        <p id={errorId} role="alert" className="-mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {serverError ? (
        <NetworkButton
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending || quota.blocked || exhausted}
        >
          {networkCopy.retry}
        </NetworkButton>
      ) : null}
      <div className="grid justify-items-center gap-2">
        <GuestQuotaNotice exhausted={exhausted} />
        {exhausted ? (
          <GuestGithubButton />
        ) : (
          <NetworkButton
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending || quota.blocked}
          >
            {pending ? (
              <>
                <Loader2
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
                {copy.pending}
              </>
            ) : (
              copy.submit
            )}
          </NetworkButton>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setSource("paste");
            setPasted(SAMPLE_PACKAGE_JSON);
            clearErrors();
          }}
          className="rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {copy.sample}
        </button>
      </div>
      <NetworkError
        message={network.error}
        disabled={pending || quota.blocked || exhausted}
      />
    </form>
  );
}
