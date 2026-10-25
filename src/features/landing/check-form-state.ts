export type CheckSource = "paste" | "upload" | "github";

export type CheckFormState = {
  code?: "guest-quota-exhausted";
  remaining?: 0;
  error?: { source: CheckSource; message: string };
  /** Grows on every answer, so the same error twice still refocuses the field. */
  attempt: number;
};

export const initialCheckFormState: CheckFormState = { attempt: 0 };

export type CheckFormAction = (
  state: CheckFormState,
  formData: FormData,
) => Promise<CheckFormState>;
