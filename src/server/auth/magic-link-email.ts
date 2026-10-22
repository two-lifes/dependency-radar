import { Resend } from "resend";
import { authCopy } from "@/features/auth/copy";

const copy = authCopy.email;

export type MagicLinkEmail = {
  subject: string;
  text: string;
  html: string;
};

export function buildMagicLinkEmail(url: string): MagicLinkEmail {
  const href = escapeHtml(url);
  return {
    subject: copy.subject,
    text: [copy.greeting, "", url, "", copy.expires, copy.ignore].join("\n"),
    // No colors or web fonts: mail clients ignore the site's theme anyway.
    html: [
      `<p><strong>${copy.greeting}</strong></p>`,
      `<p><a href="${href}">${copy.action}</a></p>`,
      `<p>${copy.expires}<br>${copy.ignore}</p>`,
    ].join(""),
  };
}

type SendEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NODE_ENV?: string;
  MOCK_EXTERNAL?: string;
};

/** Locally and in e2e the link goes to the server log instead of an inbox. */
function logsLinkOnly(env: SendEnv): boolean {
  return (
    env.MOCK_EXTERNAL === "1" ||
    (env.NODE_ENV !== "production" && !env.RESEND_API_KEY)
  );
}

/**
 * Production without Resend (no verified domain yet) can't send the link, so
 * `/login` offers GitHub only instead of a form that always fails.
 */
export function isEmailSignInEnabled(env: SendEnv = process.env): boolean {
  return logsLinkOnly(env) || Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/**
 * Throws when the email isn't sent, so Better Auth fails the request and the
 * form shows an error.
 */
export async function sendMagicLinkEmail(
  { email, url }: { email: string; url: string },
  env: SendEnv = process.env,
): Promise<void> {
  if (logsLinkOnly(env)) {
    console.warn(`[auth] sign-in link for ${email}: ${url}`);
    return;
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error(
      "RESEND_API_KEY and EMAIL_FROM must be set. See .env.example.",
    );
  }

  const message = buildMagicLinkEmail(url);
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to: email,
    ...message,
  });
  if (error) {
    throw new Error(`Resend: ${error.name} (${error.statusCode ?? "network"})`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
