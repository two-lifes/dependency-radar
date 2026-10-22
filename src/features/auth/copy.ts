// screens 5.2, 5.3 and 4.2
export const authCopy = {
  login: {
    title: "Sign in to Dependency Radar",
    saveHint: "Sign in to save your report.",
    github: "Continue with GitHub",
    githubPending: "Redirecting…",
    or: "or",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    submit: "Send sign-in link",
    pending: "Sending…",
    noPasswords: "No passwords. We'll email you a magic link.",
    // decisions 41: shown while the server can't send email yet.
    emailSoon: "Coming soon",
    emailSoonHint: "Email sign-in is coming soon. Use GitHub for now.",
  },
  errors: {
    invalidEmail: "Enter a valid email address.",
    sendFailed: "Couldn't send the link. Try again.",
    github: "GitHub sign-in was cancelled or failed. Try again.",
    linkExpired: "This link has expired. Request a new one.",
  },
  checkEmail: {
    title: "Check your inbox",
    sentTo: "We sent a sign-in link to",
    expires: "It expires in 15 minutes.",
    resend: "Resend link",
    resendIn: (seconds: number) => `Resend link (${seconds}s)`,
    resending: "Sending…",
    resent: "We sent a new link.",
    differentEmail: "Use a different email",
  },
  email: {
    subject: "Your Dependency Radar sign-in link",
    greeting: "Sign in to Dependency Radar",
    action: "Sign in",
    expires: "This link expires in 15 minutes and can be used once.",
    ignore: "If you didn't ask for it, you can ignore this email.",
  },
  header: {
    home: "Dependency Radar projects",
    account: "Account menu",
    settings: "Settings",
    theme: "Theme",
    themes: { light: "Light", dark: "Dark", system: "System" },
    signOut: "Sign out",
  },
} as const;
