# Integrations and Environment

## Environment Variables

The app reads Expo public env vars at runtime. Values are not committed here; define them in your local `.env`.

| Variable | Required | Used By | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | `services/supabase.ts` | Supabase project URL for auth and cached customer data |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | `services/supabase.ts` | Supabase anon key |
| `EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE` | No | `context/auth-context.tsx`, `services/auth-flow.ts` | Overrides the cached customer table name; defaults to `portal_customers` |
| `EXPO_PUBLIC_CUSTOMER_API_BASE_URL` | Usually | `services/customer-api.ts`, fallback for policy/agent/files/CSLB services | Base URL for customer lookup API |
| `EXPO_PUBLIC_POLICY_API_BASE_URL` | No | `services/policy-api.ts`, `services/policy-files-api.ts`, `services/agent-api.ts`, `services/cslb-api.ts` | Optional shared base URL for policy-adjacent endpoints |
| `EXPO_PUBLIC_AGENT_API_BASE_URL` | No | `services/agent-api.ts` | Explicit base URL for insured-agent lookup |
| `EXPO_PUBLIC_CSLB_API_BASE_URL` | No | `services/cslb-api.ts` | Explicit base URL for CSLB lookup |
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

### Customer Lookup

- Service: `services/customer-api.ts`
- Endpoint: `GET /getCustomer?Email=<email>`
- Screen usage:
  - auth login screen checks whether the email maps to a customer
  - verify screen refreshes customer data after OTP success

### Policy Lookup

- Service: `services/policy-api.ts`
- Endpoint: `GET /getPolicy?IId=<databaseId>`
- Context usage:
  - `PoliciesProvider` loads live policies after auth hydration

### Agent Lookup

- Service: `services/agent-api.ts`
- Endpoint: `GET /insuredAgents?insuredId=<databaseId>`
- Screen usage:
  - dashboard pulls the assigned agent for the current insured

### CSLB Lookup

- Service: `services/cslb-api.ts`
- Endpoint: `GET /cslb/<insuredId>`
- Hook usage:
  - `useCompanyProfile()` loads and formats CSLB data

### Policy Files Lookup

- Service: `services/policy-files-api.ts`
- Endpoints:
  - `GET /getPolicyFilesListByInsuredId?insuredId=<insuredId>`
  - `GET /getPolicyFilesList?insuredId=<insuredId>&policyId=<policyId>&folderId=<folderId>`
- Screen usage:
  - policy detail screen previews policy-related entries
  - policy files screen powers the breadcrumb-based browser

## Supabase Responsibilities

### Auth

- `sendEmailSignInCode()` calls `supabase.auth.signInWithOtp`.
- `verifyEmailSignInCode()` calls `supabase.auth.verifyOtp`.
- `AuthProvider` listens to `supabase.auth.onAuthStateChange`.
- Sessions persist locally through AsyncStorage.

### Cached Customer Table

- Schema file: `supabase/portal_customers.sql`
- Table purpose:
  - cache customer records returned by the customer lookup API
  - rehydrate customer context after app restart without re-running the customer API immediately
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
  - inserts and updates are allowed for pre-auth sync scenarios

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
