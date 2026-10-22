import { createAuthClient } from "better-auth/react";

// Same origin as the app, so no baseURL. Only GitHub sign-in and sign-out run
// in the browser; the email link is sent by a Server Action.
export const authClient = createAuthClient();
