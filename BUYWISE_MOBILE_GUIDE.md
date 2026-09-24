# BuyWise Mobile Development Guide

## Purpose
Build BuyWise as a production-quality mobile app using **React Native + Expo + TypeScript**. Keep the app simple, modular, secure, responsive, and easy to extend.

## Stack
- React Native + Expo
- TypeScript
- Expo Router for navigation
- TanStack Query for server state/cache
- SecureStore for sensitive session/token data
- FastAPI backend / existing BuyWise APIs
- Supabase where already used by the project
- Reusable components and centralized design tokens

## Project Principles
1. **Do not over-engineer.** Prefer simple solutions until the project actually needs more complexity.
2. **Type everything.** Avoid `any` unless there is a documented reason.
3. **Keep UI separate from API logic.** Screens should call hooks/services, not contain raw API requests everywhere.
4. **Never trust the client.** Backend authorization and validation remain mandatory.
5. **Reuse components.** Do not duplicate buttons, inputs, cards, spacing, colors, or typography.
6. **Do not break existing functionality.** Inspect the current project before changing architecture or dependencies.
7. **Mobile-first UX.** Design for touch, small screens, keyboard behavior, safe areas, and Android back navigation.

## Suggested Structure
```text
app/
  _layout.tsx
  (auth)/
    login.tsx
    register.tsx
  (app)/
    _layout.tsx
    index.tsx
    expenses.tsx
    add-expense.tsx
    budgets.tsx
    wishlist.tsx
    profile.tsx
components/
hooks/
services/
  api.ts
  auth.ts
store/
types/
utils/
constants/
assets/
```

## Navigation & Auth
- Public routes: login/register/forgot-password.
- Protected routes: dashboard, expenses, budgets, wishlist, profile.
- Restore the session when the app starts.
- Store sensitive session/token data with secure storage.
- Handle expired/invalid sessions centrally.
- Logout must clear local auth state and sensitive stored data.
- Never rely only on hiding a screen for authorization; the backend must enforce access.

## Every Data Screen Must Handle
```text
Loading → Success → Empty → Error
```
Also consider:
- Pull-to-refresh
- Retry after failure
- Slow/no internet
- Stale cached data
- App returning from background

## API Rules
- Centralize API configuration and base URL.
- Centralize authentication headers/interceptors.
- Keep API calls in services/hooks, not scattered across UI components.
- Use typed request/response models.
- Convert backend errors into user-friendly messages.
- Never expose secrets, database credentials, service-role keys, or private backend credentials in the mobile app.
- Never accept a client-provided `user_id` as proof of identity.

## BuyWise Core Flows
Prioritize these before advanced AI features:
1. App startup + session restore
2. Login/register/logout
3. Dashboard
4. Expense list
5. Add expense
6. Edit/delete expense
7. Budget tracking
8. Profile/settings

Later:
- Receipt scanning
- Analytics
- Budget alerts
- Wishlist intelligence
- AI recommendations
- Push notifications
- Deep links
- Offline enhancements

## Mobile UX Rules
- Respect safe areas, status bars, notches, and home indicators.
- Forms must work when the keyboard is open.
- Use appropriate scroll behavior for forms and long lists.
- Use `FlatList`/virtualized lists for large collections.
- Support Android back navigation correctly.
- Buttons and interactive elements must have comfortable touch targets.
- Avoid hard-coded screen dimensions and fragile absolute positioning.
- Test different screen sizes and font scaling.
- Keep animations subtle and purposeful.

## Financial Data Rules
- Treat money as precise values; avoid careless floating-point arithmetic.
- Prefer smallest currency units (for example paise) or a proper decimal representation at the backend.
- Validate amounts, dates, categories, and required fields.
- Do not log sensitive financial information.
- A user must never be able to read or modify another user's financial data.

## Permissions
Ask for permissions **only when the feature needs them**.
Examples:
- Camera → when scanning a receipt
- Photos → when selecting a receipt image
- Notifications → when enabling reminders/alerts
Explain why a permission is needed and handle denial gracefully.

## Error Handling
Never show raw technical errors such as:
```text
AxiosError: Request failed with status code 422
```
Show a useful message such as:
```text
We couldn't add this expense. Please check the details and try again.
```
Log technical details only in appropriate development/crash-reporting contexts, without sensitive data.

## Performance
- Avoid unnecessary re-renders.
- Cache server data where useful.
- Do not refetch the same data repeatedly without a reason.
- Optimize large images.
- Avoid huge `ScrollView`s for large data sets.
- Prefer memoization only when it solves a measured/reasonable problem.

## Accessibility
- Give interactive elements meaningful accessibility labels/roles.
- Maintain readable contrast.
- Support text scaling where practical.
- Do not communicate important information only through color.

## Security Checklist
- HTTPS only in production.
- Secure storage for sensitive session/token data.
- Backend authorization for every protected resource.
- Validate all input on the backend.
- No secrets in source code or client bundles.
- No sensitive data in logs.
- Clear sensitive state on logout.

## Development Workflow
Before changing code:
1. Inspect the existing project structure and current implementation.
2. Reuse existing patterns/components before creating new ones.
3. Make the smallest clean change that solves the task.
4. Run type-check/lint/tests relevant to the change.
5. Check Android behavior for navigation, keyboard, permissions, and back handling.
6. Do not introduce a new library when the current stack can solve the problem cleanly.

## Definition of Done
A feature is not complete when the happy-path UI works. It is complete when:
- Loading state works
- Success state works
- Empty state works
- Error state works
- Validation works
- Offline/failure behavior is reasonable
- Auth/authorization is correct
- Keyboard/safe-area behavior works
- Android back behavior works
- Types/lint/tests pass
- Existing functionality still works

## Claude Code Instruction
When implementing a task, first inspect the relevant files and understand the existing architecture. Then propose the smallest change, implement it consistently with this guide, and verify the result. Do not rewrite unrelated code, do not add unnecessary dependencies, and do not assume backend behavior without checking the existing API/client code.
