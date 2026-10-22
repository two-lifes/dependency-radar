import type { CheckSource } from "../landing/check-form-state";

export type ReplaceSourceState = {
  error?: { field: CheckSource; message: string };
  /** Grows on every answer, so the same error twice still refocuses the field. */
  attempt: number;
};

export const initialReplaceSourceState: ReplaceSourceState = { attempt: 0 };
