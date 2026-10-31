/** Only accept an authorization code returned to our own callback. Never accept URL tokens. */
export function oauthCode(url: string, redirectTo: string): string {
  const callback = new URL(url);
  const expected = new URL(redirectTo);
  if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname) {
    throw new Error("Unexpected Google sign-in callback.");
  }
  if (callback.searchParams.has("error") || callback.hash) {
    throw new Error("Google sign-in was not completed. Please try again.");
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("Google sign-in returned no code. Please try again.");
  return code;
}
