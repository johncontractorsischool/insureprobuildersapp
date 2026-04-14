# User Flows

## 1. App Launch and Session Restore

1. `app/_layout.tsx` mounts and installs PBIA global error diagnostics.
2. `AuthProvider` calls `supabase.auth.getSession()`.
3. If a Supabase session exists, the provider stores the session email as both `userEmail` and `pendingEmail`.
4. `AuthProvider` then queries the cached `portal_customers` table by `login_email` to recover the best matching customer profile.
5. `PoliciesProvider` waits on auth state and, once a customer `databaseId` exists, requests live policies.

## 2. Landing Screen to Auth Flow

1. `app/index.tsx` is the public landing screen.
2. While auth is hydrating, it shows `LoadingState`.
3. If `isAuthenticated` becomes true, it immediately redirects to `/(tabs)`.
4. If no session exists, the user can:
   - open sign in via `/(auth)/login`
   - open sign up mode via `/(auth)/login?mode=signup`

## 3. Sign In Flow

1. `app/(auth)/login.tsx` collects the email address.
2. The screen first calls `fetchCustomersByEmail(email)` to verify the email maps to at least one customer record.
3. If no record is returned, sign-in stops before sending OTP.
4. If a record exists, the screen calls `sendEmailSignInCode(email)` through Supabase.
5. On success:
   - `pendingEmail` is stored in auth context
   - `customer` is cleared so stale profile data does not leak forward
   - the router pushes `/(auth)/verify`
6. If Supabase reports OTP rate limiting:
   - the user is still sent to `verify`
   - the screen passes `hint=rate-limited` so the verify screen can show the right notice and resend cooldown

## 4. Verify OTP Flow

1. `app/(auth)/verify.tsx` requires `pendingEmail`; otherwise it redirects back to login.
2. The user enters a six-digit code via `OTPInput`.
3. `verifyEmailSignInCode(pendingEmail, code)` verifies the code with Supabase.
4. After a successful verification, the screen tries to refresh customer data by calling `fetchCustomersByEmail(verifiedEmail)`.
5. If customer records are returned:
   - they are persisted into Supabase with `persistCustomersForEmail`
   - the best active customer is converted with `toCustomerProfile`
6. `completeSignIn(email, customerProfile)` updates auth context.
7. The user is redirected to `/(tabs)`.
8. If customer sync fails after OTP verification, sign-in still completes so auth is not blocked by a secondary lookup failure.

## 5. Dashboard Hydration Flow

1. `app/(tabs)/index.tsx` reads `customer` and `userEmail` from auth context.
2. The screen builds a display identity card from the best available customer name/email.
3. It derives an insured lookup id using:
   - `customer.databaseId` first
   - then `customer.insuredId` as fallback
4. Agent flow:
   - calls `fetchInsuredAgentsByInsuredDatabaseId`
   - uses the first returned agent as primary
   - falls back to `portal-config` defaults when the API returns nothing or fails
5. Company flow:
   - `useCompanyProfile()` calls `fetchCslbLicenseByInsuredId(customer.insuredId)`
   - maps CSLB data into summary rows, status chips, business rows, bonds, workers-comp rows, and personnel
6. The screen keeps a dashboard skeleton visible for at least three seconds and also waits for agent/company loading to settle.
7. Action cards open:
   - direct external actions for phone, email, and SMS
   - in-app browser for scheduling links and CSLB links
8. Bottom actions route to:
   - `/forms`
   - external Issue COI URL from env config

## 6. Policies Flow

1. `PoliciesProvider` loads policies once the user is authenticated and `customer.databaseId` exists.
2. `fetchPoliciesByInsuredDatabaseId(databaseId)` hits `/getPolicy?IId=...`.
3. The service normalizes API records into the shared `Policy` shape.
4. `app/(tabs)/policies.tsx` renders filter chips for `All`, `Active`, `Pending`, and `Lapsed`.
5. Selecting a card routes to `/policy/[id]`.

## 7. Policy Detail and File Flow

1. `app/policy/[id].tsx` resolves the selected policy from `PoliciesProvider`.
2. It separately requests policy-file entries with `fetchPolicyFilesListByInsuredId`.
3. It filters those file records so only items matching the selected policy id or policy number remain.
4. The screen shows:
   - coverage summary
   - insured summary
   - billing summary
   - a preview list of recent matching file/folder entries
5. "Browse policy files" routes to `/policy-files` with `insuredId`, `policyId`, and `policyNumber`.

## 8. Policy Files Browser Flow

1. `app/policy-files/index.tsx` derives the insured id from route params first, then auth context.
2. Initial load calls `fetchPolicyFilesListByInsuredId`.
3. Root items are filtered to the selected policy when route params are present.
4. When the user taps a folder:
   - the screen calls `fetchPolicyFilesList({ insuredId, policyId, folderId })`
   - a new breadcrumb level is pushed into local state
5. When the user taps a file:
   - the screen chooses `fileUrl`, then `downloadUrl`, then `url`
   - the file opens in the in-app browser if a usable URL exists
6. Pull-to-refresh reloads the current breadcrumb level.

## 9. Company Detail Flow

1. `app/company/index.tsx` reuses `useCompanyProfile()`.
2. It renders the same summary section as the dashboard, then expands into:
   - business profile
   - classifications
   - bonding groups
   - workers compensation rows
   - personnel groups
3. If CSLB detail content is absent after loading, the screen renders an `EmptyState` instead of blank sections.

## 10. PBIA Forms Flow

1. `app/forms/index.tsx` renders form sections from `PBIA_FORMS`.
2. Tapping a form routes to `/forms/[slug]`.
3. `app/forms/[slug].tsx` resolves the form metadata from `constants/pbia-forms.ts`.
4. Native behavior:
   - default path is browser-first fallback
   - "Open Form" opens an in-app browser
   - "Try Embedded Form" mounts `PbiaFormWebView`
5. Web behavior:
   - the screen embeds `PbiaFormWebView` immediately
6. Diagnostics flow:
   - the screen logs open events
   - it reads the latest stored PBIA diagnostic entries
   - it alerts the user if a previous embedded session appears to have crashed before app restart

## 11. Sign Out Flow

1. `app/(tabs)/profile.tsx` calls `signOut()`.
2. `AuthProvider` signs out from Supabase and clears local auth/customer state.
3. The protected tab layout redirects the user back to `/(auth)/login`.

## 12. Failure and Degradation Rules

- Missing `customer.databaseId` blocks live policy loading and surfaces a user-facing error.
- Missing `customer.insuredId` blocks CSLB loading and can also block some policy-file flows.
- Agent lookup failure does not break the dashboard; it falls back to env-configured agent info.
- Customer sync failure after OTP success does not cancel the authenticated session.
- PBIA WebView failures never throw into the UI intentionally; they log diagnostics and show retryable fallback UI instead.
