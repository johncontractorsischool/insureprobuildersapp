# Integrations and Environment

## Environment Variables

The app reads Expo public env vars at runtime. Values are not committed here; define them in your local `.env`.

| Variable | Required | Used By | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | `services/supabase.ts` | Supabase project URL for auth and cached customer data |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | `services/supabase.ts` | Supabase anon key |
| `EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE` | No | `context/auth-context.tsx`, `services/auth-flow.ts` | Overrides the cached customer table name; defaults to `portal_customers` |
| `EXPO_PUBLIC_SUPABASE_PUSH_DEVICE_TABLE` | No | `services/push-notifications.ts` | Overrides the push-device table name; defaults to `portal_push_devices` |
| `EXPO_PUBLIC_PBIA_API_BASE_URL` | Yes | `services/pbia-client.ts`, `services/payment-api.ts` | PBIA API or trusted gateway base URL for all client portal and payment calls |
| `EXPO_PUBLIC_AGENT_NAME` | No | `services/portal-config.ts` | Fallback dashboard agent name |
| `EXPO_PUBLIC_AGENT_PHONE` | No | `services/portal-config.ts` | Fallback agent phone |
| `EXPO_PUBLIC_AGENT_EMAIL` | No | `services/portal-config.ts` | Fallback agent email |
| `EXPO_PUBLIC_AGENT_SMS_PHONE` | No | `services/portal-config.ts` | Fallback agent SMS number |
| `EXPO_PUBLIC_AGENT_SCHEDULE_URL` | No | `services/portal-config.ts` | Fallback scheduling URL |
| `EXPO_PUBLIC_COMPANY_LICENSE_NUMBER` | No | `services/portal-config.ts` | Fallback company license number |
| `EXPO_PUBLIC_COMPANY_CSLB_URL` | No | `services/portal-config.ts` | Fallback CSLB URL |
| `EXPO_PUBLIC_INTAKE_FORMS_URL` | No | `services/portal-config.ts` | Reserved config slot; currently not consumed by a screen |
| `EXPO_PUBLIC_ISSUE_COI_URL` | No | `services/portal-config.ts`, dashboard | External Issue COI link |

## HTTP Integrations

### PBIA Client Portal

- Shared transport: `services/pbia-client.ts`
- Endpoints:
  - `GET /client/account`
  - `GET /client/account/by-business-email`
  - `POST /client/signup`
  - `GET /client/policies`
  - `GET /client/agent`
  - `GET /client/cslb`
  - `POST /client/cslb/refresh`
  - `GET /client/policies/:policyId/coverages`
  - `GET /client/documents`
  - `GET /client/policies/:policyId/documents`
  - `POST /client/contact-requests`
- Every request requires the current Supabase access token as `Authorization: Bearer <token>`. The shared transport rejects missing sessions and rejects a requested email that differs from the verified session email. It does not send `X-Client-Email` or `X-API-Key`.
- Sign-in sends and verifies the Supabase OTP before account discovery. Signup details remain in memory until OTP verification succeeds, then `POST /client/signup` runs with the authenticated session before the singular primary-email account lookup.
- Profile change, support, feedback, and COI requests use `POST /client/contact-requests`; the app no longer calls an SMTP relay directly.
- PBIA document responses currently provide metadata but no download URL. The app lists the documents and marks download as unavailable rather than constructing a legacy URL.
- Local Android emulator note: `localhost` API base URLs are translated to `10.0.2.2` at runtime so the emulator can reach services running on the Mac host.
- Production build note: do not ship `localhost` API URLs. Use deployed HTTPS API base URLs in the EAS build environment.

### PBIA Mobile Payments

- Service: `services/payment-api.ts`
- Endpoints:
  - `GET /client/payment-eligibility`
  - `GET /client/payment-eligibility/:demandId`
  - `POST /client/payment-eligibility/:demandId/payments`
- Context: `PaymentsProvider` loads visible agent-published demands for the selected `accountId`. PBIA omits drafts, hidden, processing, paid, and cancelled demands.
- Every request includes the Supabase access token as `Authorization: Bearer <token>` and requires the supplied app email to match the session email. Demand reload and submission also include `X-Client-Account-Id`.
- The payment form treats the server `amountDue` and `purpose` as read-only and submits them exactly as published by the agent. Card review requires `cardConvenienceFee` and `cardTotalAmount`; ACH review requires `achConvenienceFee` and `achTotalAmount`. The app displays the selected method's fee and total before confirmation, while still submitting only `amountDue` so Input1 does not apply its fee twice. PBIA currently supplies a percentage-based card preview and a fixed $3.00 ACH preview.
- The configured base URL must use HTTPS outside local development. Loopback HTTP is allowed only for local Expo development; production must use the trusted HTTPS gateway URL.
- For Expo web, PBIA must allow the exact app origin plus `GET`, `POST`, `Authorization`, `Content-Type`, `X-Client-Account-Id`, and `Idempotency-Key` in its CORS policy.
- PBIA validates every bearer token with the same Supabase Auth project and derives the account-scoping email server-side.
- Only a response with `status: "SUCCEEDED"` is treated as a confirmed payment. The success screen displays Input1's normalized actual `convenienceFee`, optional `addOnConvenienceFee`, and `totalCharged` when receipt details are immediately available.
- A `502` is treated as an unconfirmed attempt and is never automatically retried.
- Card and ACH fields remain local to the mounted payment screen, are never persisted, and are cleared after success, failure, or cancellation.
- Native payment screens block screenshots and screen recordings with `expo-screen-capture`; iOS app-switcher previews are also protected.
- Payment idempotency keys are generated with `expo-crypto` and contain no payment credentials.
- Swagger: `${EXPO_PUBLIC_PBIA_API_BASE_URL}/docs`

## Supabase Responsibilities

### Auth

- `sendEmailSignInCode()` calls `supabase.auth.signInWithOtp`.
- `verifyEmailSignInCode()` calls `supabase.auth.verifyOtp`.
- `AuthProvider` listens to `supabase.auth.onAuthStateChange`.
- Sessions persist locally through AsyncStorage.

### Cached Customer Table

- Schema file: `supabase/portal_customers.sql`
- Table purpose:
  - cache PBIA account records returned by `GET /client/account`
  - rehydrate customer context after app restart if the PBIA API is temporarily unavailable
- Important columns:
  - `database_id`
  - `login_email`
  - `insured_id`
  - `customer_id`
  - name/contact columns
  - `source_payload`
  - `updated_at`
- Policies:
  - authenticated users can read rows whose `login_email` matches the auth JWT email
  - inserts and updates require an authenticated JWT whose email matches `login_email`

### Push Device Table

- Schema file: `supabase/portal_push_devices.sql`
- Table purpose:
  - associate an Expo push token with the authenticated customer who registered it
  - retain basic device metadata, active state, and last-seen timestamps for later server-side delivery
- Client behavior:
  - a physical iPhone registers after Supabase auth hydration
  - the app upserts on `(user_id, expo_push_token)` so repeat launches refresh the row
  - the public client uses only the anon key and the customer's authenticated session
- Policies:
  - authenticated users can only select, insert, update, or delete their own rows
  - inserts and updates must also match the email in the auth JWT

## Local Persistence

### Supabase Session Storage

- Backed by AsyncStorage through `@supabase/supabase-js`.
- Configured in `services/supabase.ts`.

### PBIA Diagnostics Storage

- Implemented in `services/pbia-webview-diagnostics.ts`.
- AsyncStorage keys:
  - `pbia-webview-diagnostics-v1`
  - `pbia-webview-active-session-v1`
- Stored data:
  - bounded diagnostic event history
  - one active embedded-session heartbeat record

## External Linking Behavior

- `utils/external-actions.ts` builds `tel:`, `sms:`, and `mailto:` links.
- HTTP/HTTPS links can open in:
  - the device browser / OS handler via `openExternalLink`
  - Expo in-app browser via `openInAppBrowser`
- Dashboard schedule and CSLB actions intentionally use the in-app browser.
- PBIA form "Open Form" also uses the in-app browser.

## PBIA Form Integration

- Form registry: `constants/pbia-forms.ts`
- Base URL: `https://pbia-form-app.vercel.app`
- URL construction:
  - always uses `/forms/<slug>`
  - appends `embed=true`
  - appends a generated `instance` id
- Native strategy:
  - browser-first fallback by default
  - optional embedded WebView for manual retry/testing
- Embedded WebView safety features:
  - load-error retry UI
  - lifecycle diagnostics
  - global JS error hook
  - render-process termination logging

## Fallback Rules Worth Remembering

- Most API services default to `http://localhost:3000` if no env base URL is provided.
- Agent and company cards can still render partial UI using fallback config and notices.
- Missing or invalid HTTP URLs are normalized to `null` by `portal-config` so broken config does not auto-open.
