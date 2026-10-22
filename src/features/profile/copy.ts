/** screens 5.13: a profile name is at most this long, like a project's. */
export const PROFILE_NAME_MAX = 60;

// screens 5.13
export const profileCopy = {
  nav: { label: "Settings", profile: "Profile" },
  title: "Profile",
  save: "Save",
  saving: "Saving…",
  account: {
    title: "Account",
    nameLabel: "Name",
    nameTooLong: `Use ${PROFILE_NAME_MAX} characters or fewer.`,
    saved: "Name saved",
    failed: "Couldn't save the name. Try again.",
    emailLabel: "Email",
  },
  github: {
    title: "GitHub",
    connectedAs: (login: string) => `Connected as @${login}`,
    connected: "Connected to GitHub",
    connect: "Connect GitHub",
    connecting: "Redirecting…",
    hint: "Connect GitHub to import your repositories.",
    failed:
      "Couldn't connect GitHub. It may already be connected to another account.",
  },
  theme: {
    title: "Theme",
    label: "Theme",
    options: { light: "Light", dark: "Dark", system: "System" },
  },
  danger: {
    title: "Danger zone",
    text: "Deleting your account removes all your projects and their check history. This can't be undone.",
    delete: "Delete account",
    dialogTitle: "Delete account?",
    dialogText: "This permanently deletes your account and all your projects.",
    confirmLabel: (email: string) => `Type ${email} to confirm`,
    confirm: "Delete account",
    cancel: "Cancel",
    deleting: "Deleting…",
    failed: "Couldn't delete the account. Try again.",
    reauth: "For security, sign in again to delete your account.",
    signInAgain: "Sign in again",
    done: "Account deleted",
  },
} as const;
