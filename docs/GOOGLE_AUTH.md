# Google sign-in

Both clients offer **Continue with Google** on login and sign-up. Email/password still works. Google creates a Supabase user on first sign-in; the existing authenticated profile API creates BuyWise's profile and defaults. The backend accepts the same Supabase JWT regardless of sign-in provider. No database migration is needed.

## Supabase and Google configuration

1. In Google Cloud, use a Web application OAuth client. Its authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback` (copy the exact value from Supabase's Google provider panel).
2. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and save that client's ID and secret. These credentials stay in Supabase; neither app needs the Google secret in an environment file.
3. In Supabase **Authentication → URL Configuration → Redirect URLs**, add the callback addresses you use:

   | Client | Callback |
   |---|---|
   | Installed iOS/Android app or development build | `buywise://auth/callback` |
   | Next.js local development | `http://localhost:3000/auth/callback` |
   | Next.js using the loopback IP | `http://127.0.0.1:3000/auth/callback` |
   | Expo web local development | `http://localhost:8081/auth/callback` |
   | Deployed Next.js or Expo web | `https://<your-web-host>/auth/callback` |

   Use exact production callbacks. Keep existing allowed URLs. Set Supabase's Site URL to your production web origin when it exists. A missing allowed callback can cause Supabase to return to the Site URL instead.
4. If Google's consent screen is in Testing, add your testers in Google Cloud's Audience settings. Make the application available to the intended audience before release.

The Google provider was verified enabled through the current project's public Auth settings on 2026-10-28. The dashboard's redirect allowlist still needs verification; the browser session was signed out. The production web address was not available during implementation.

## Client behavior

- **Next.js:** the browser Supabase client starts PKCE sign-in and stores its verifier in cookies. `/auth/callback` is public in the session middleware, exchanges the returned code using the server client, stores session cookies and redirects to `/chat`. Missing, rejected or expired codes return to `/login?auth_error=google`. Redirects use fixed relative destinations so reverse proxies cannot send the browser to an internal hostname. Provider errors and codes are not displayed.
- **Mobile:** `expo-web-browser` opens the system auth browser, returning to the existing `buywise` scheme. The Supabase client uses PKCE and SecureStore. `pkceCrypto.native.ts` supplies the secure random generator and SHA-256 digest Supabase needs on Hermes using `expo-crypto`; browsers use their own WebCrypto. The public `auth/callback` screen also handles returns after the app restarts. A repeated delivery of the same code joins the same exchange. Closing the browser leaves the form usable.
- **Expo web:** uses a full-page redirect and the mobile client's callback route. Hosting must serve the Expo single-page application for `/auth/callback` too.

## Running and checking

Install mobile dependencies with `npm ci` from `mobile/`. Google sign-in requires a development or installed native build because Expo Go cannot register the app's custom return scheme. Build a new binary after adding `expo-web-browser` and `expo-crypto`; for local Android development use `npx expo run:android` with the Android development tools configured. Email/password remains available in Expo Go.

Checks:

- Mobile: `npm test`, `npx tsc --noEmit`, `npm run lint`.
- Web callback: from `frontend/`, `node --test tests/auth-callback.test.mjs`.
- Web types: from `frontend/`, `npx tsc --noEmit`.

Before release, complete Google sign-in on both clients, confirm a new user's profile initializes, reopen the app to check persistence, sign out, and test cancellation and an existing email account. The web Google sign-in page and callback failure path were checked in a browser; completing consent and device sign-in are pending.
