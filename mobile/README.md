# BuyWise Mobile

React Native (Expo SDK 57, Expo Router) client for the BuyWise FastAPI + Supabase backend.
Phase 1: auth, session persistence, API client, 5-tab shell, Dashboard.
Phase 2: Transactions (list, quick add, detail, edit, delete).
Phase 3: Budget and Goals.

The rules every change follows are in [`../BUYWISE_MOBILE_GUIDE.md`](../BUYWISE_MOBILE_GUIDE.md).

## Run

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. `EXPO_PUBLIC_API_URL` must be the PC's
   **LAN IP** (`ipconfig`), not `127.0.0.1`: a phone cannot reach the PC's loopback.
   Use an `https://` URL for anything but local development: a release build should never talk to the API over cleartext.
3. Start the backend so the phone can reach it (from the repo root):
   `uv run uvicorn ai_service.main:app --reload --host 0.0.0.0`
4. `npx expo start`, then scan the QR code with Expo Go, or press `w` for the web build.

Notes:
- Phone and PC must be on the same network, and the network must allow device-to-device traffic.
  Campus Wi-Fi often does not; use a phone hotspot instead.
- If Expo advertises the wrong adapter (VPN/VirtualBox), set `REACT_NATIVE_PACKAGER_HOSTNAME` to the LAN IP.
- Supabase email confirmation must be off (or a real SMTP configured) for sign-up to return a session.
  Otherwise the app shows "Check your email".

## Checks

`npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo-doctor`

`npm test` runs the pure logic in `src/lib/*.test.ts` (money parsing, dates, ledger grouping and
diffing, the transaction form, error wording) with Node's built-in test runner. Those modules are
import-free (or import siblings with an explicit `.ts` extension) so they need no test framework.

## Layout

- `src/app/`: Expo Router routes (`(auth)`, `(tabs)`, `settings`, `reports`, `add-transaction`, `transaction/[id]`)
- `src/lib/`: everything that is not UI
  - `api.ts`: the typed API client (screens never call it directly) and `errors.ts`: how a failure becomes friendly text
  - `queries.ts` / `mutations.ts`: the only way screens read and write server data, including cache keys and invalidation
  - `money.ts`, `dates.ts`, `ledger.ts`, `transactionForm.ts`: pure logic with tests
- `src/providers/`: `AuthProvider`
- `src/ui/`: greybox primitives. Only this folder reads `theme.ts`, so the real design can replace it without touching screens.
