# BuyWise Mobile

React Native (Expo SDK 57, Expo Router) client for the BuyWise FastAPI + Supabase backend.
Phase 1: auth, session persistence, API client, 5-tab shell, Dashboard.

## Run

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. `EXPO_PUBLIC_API_URL` must be the PC's
   **LAN IP** (`ipconfig`), not `127.0.0.1`: a phone cannot reach the PC's loopback.
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

`npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`

## Layout

- `src/app/`: Expo Router routes (`(auth)`, `(tabs)`, `settings`, `reports`, `add-transaction`)
- `src/lib/`: Supabase client, API client (`api.ts`), shared types and formatting
- `src/providers/`: `AuthProvider`
- `src/ui/`: greybox primitives. Only this folder reads `theme.ts`, so the real design can replace it without touching screens.
