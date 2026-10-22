import type { CheckSource } from "../landing/check-form-state";

export type NewProjectField = "name" | CheckSource;

export type NewProjectState = {
  error?: { field: NewProjectField; message: string };
  /** Grows on every answer, so the same error twice still refocuses the field. */
  attempt: number;
};

export const initialNewProjectState: NewProjectState = { attempt: 0 };
