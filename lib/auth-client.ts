import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL ?? (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3001"),
});

export const signInWithGoogle = async () => {
  return await authClient.signIn.social({
    provider: "google",
  });
};
