export type SignInLinkState = {
  error?: string;
  /** Grows on every answer, so the same error twice still refocuses the field. */
  attempt: number;
  /** Set when a resend succeeded (check-email page). */
  sent?: boolean;
};

export const initialSignInLinkState: SignInLinkState = { attempt: 0 };

export type SignInLinkAction = (
  state: SignInLinkState,
  formData: FormData,
) => Promise<SignInLinkState>;
