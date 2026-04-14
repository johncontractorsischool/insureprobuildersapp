# App Overview

## Purpose

The app is a contractor-facing customer portal. Its main job is to authenticate a user by email, identify the matching insured/customer record, and then present policy, company, agent, and intake-form workflows in a mobile-friendly interface.

## Primary User Capabilities

- Restore an existing Supabase session when the app opens
- Request a one-time email code and verify it
- View account-holder identity details
- View assigned agent contact methods and scheduling links
- View a CSLB-based company summary and detailed company records
- Browse active, pending, and lapsed policies
- Drill into policy billing and related policy-file records
- Launch PBIA intake forms, defaulting to the device browser on native platforms

## Runtime Architecture

### App Shell

- `app/_layout.tsx` is the root shell.
- It installs PBIA global error diagnostics on mount.
- It wraps the router in `AuthProvider` and `PoliciesProvider`.
- It defines the stack screens for the auth group, tab group, company, policy detail, policy files, and forms.

### Route Tree

```text
app/
  _layout.tsx
  index.tsx
  (auth)/
    _layout.tsx
    login.tsx
    verify.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    policies.tsx
    profile.tsx
  company/
    index.tsx
  policy/
    [id].tsx
  policy-files/
    index.tsx
  forms/
    index.tsx
    [slug].tsx
```

### State Ownership

- `context/auth-context.tsx`
  - Owns session restoration, authenticated email, pending email, and selected customer profile.
  - Hydrates customer data from Supabase after session restore and on auth-state changes.
- `context/policies-context.tsx`
  - Owns policy list loading and refresh behavior.
  - Depends on `customer.databaseId` from auth context.
- `hooks/use-company-profile.ts`
  - Owns CSLB company-detail loading and formatting for both dashboard and company detail screens.
- `services/pbia-webview-diagnostics.ts`
  - Owns AsyncStorage-based diagnostics and recovery tracking for embedded PBIA WebViews.

## UI System

- `constants/theme.ts` is the central design token file.
- Screens consistently render inside `components/screen-container.tsx`.
- Shared controls such as `AppButton`, `AppInput`, `OTPInput`, `SectionHeader`, `EmptyState`, and `LoadingState` keep styles aligned across routes.

## Data Sources

- Supabase Auth:
  - Sends and verifies email OTP codes.
  - Persists the signed-in session via AsyncStorage.
- Supabase `portal_customers` table:
  - Caches customer records keyed by `login_email`.
  - Lets the app hydrate customer data after session restore.
- Env-configured HTTP APIs:
  - Customer lookup
  - Policy lookup
  - Agent lookup
  - CSLB lookup
  - Policy files lookup
- Static assets:
  - App branding
  - Agent headshots
  - Expo app icons/splash assets

## Important Behavioral Notes

- Auth is email-based only; there is no password flow.
- The sign-up tab is a UI-only placeholder right now. It validates fields locally and shows a notice but does not call a backend endpoint.
- The dashboard is intentionally skeleton-gated for a minimum of three seconds to avoid a quick flash of partially hydrated content.
- Native PBIA forms default to the device browser because embedded WebView sessions have previously caused app reloads while typing.
- The embedded PBIA WebView is still available behind a "Try Embedded Form" action for debugging and fallback testing.

## Error Handling Strategy

- Auth screens surface user-friendly errors for invalid email, OTP failures, and rate limiting.
- Policy, company, and file screens degrade to `EmptyState` or inline notices rather than crashing.
- Dashboard agent/company modules fall back to configured env data or explanatory notices when APIs fail.
- PBIA diagnostics are written to AsyncStorage so unexpected WebView failures can be inspected after restart.

## Known Placeholders and Legacy Pieces

- `data/mock-policies.ts` is currently sample data only and is not used by live screens.
- Several Expo starter components and image assets remain in the repo but are not part of the current portal runtime.
- `portalConfig.actions.intakeFormsUrl` exists in config but is not currently consumed by a screen.
