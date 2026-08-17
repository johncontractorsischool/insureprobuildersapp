# User Flows

## 1. App Launch and Session Restore

1. `app/_layout.tsx` mounts and installs PBIA global error diagnostics.
2. `AuthProvider` calls `supabase.auth.getSession()`.
3. If a Supabase session exists, the provider stores the session email as both `userEmail` and `pendingEmail`.
4. `AuthProvider` calls `GET /client/my-account/resolve` with the authenticated bearer token.
5. `ACCOUNT_RESOLVED` restores the returned safe account directly. For `LICENSE_REQUIRED`, a previously stored CSLB selector is revalidated through `POST /client/my-account/resolve`; the app never chooses an arbitrary candidate.
6. The cached `portal_customers` table is only a fallback when PBIA is temporarily unavailable. A successful resolver response that requires signup or a new selection does not fall back to a stale cached account.
7. `PoliciesProvider` waits on auth state and, once a PBIA `accountId` exists, requests live policies.

## 2. Landing Screen to Auth Flow

1. `app/index.tsx` is the public landing screen.
2. While auth is hydrating, it shows `LoadingState`.
3. If `isAuthenticated` becomes true, it immediately redirects to `/(tabs)`.
4. If no session exists, the user can:
   - open sign in via `/(auth)/login`
   - open sign up mode via `/(auth)/login?mode=signup`

## 3. Sign In Flow

1. `app/(auth)/login.tsx` collects the email address.
2. The screen calls `sendEmailSignInCode(email)` through Supabase before making any PBIA request.
3. On success:
   - `pendingEmail` is stored in auth context
   - `customer` is cleared so stale profile data does not leak forward
   - the router pushes `/(auth)/verify`
4. If Supabase reports OTP rate limiting:
   - the user is still sent to `verify`
   - the screen passes `hint=rate-limited` so the verify screen can show the right notice and resend cooldown

## 4. Verify OTP Flow

1. `app/(auth)/verify.tsx` requires `pendingEmail`; otherwise it redirects back to login.
2. The user enters a six-digit code via `OTPInput`.
3. `verifyEmailSignInCode(pendingEmail, code)` verifies the code with Supabase.
4. The screen calls authenticated `GET /client/my-account/resolve`; the backend derives the email from the verified Supabase token.
5. For signup, the pending form email must equal the verified email. The app calls `POST /client/signup` only for `SIGNUP_ALLOWED`, then resolves again after creation. Signup data is never sent before OTP verification and is not persisted locally.
6. `ACCOUNT_RESOLVED` returns one safe account without asking for a license.
7. `LICENSE_REQUIRED` replaces the OTP input with a CSLB license input. The app sends the selector to `POST /client/my-account/resolve`; it does not download candidate accounts or compare licenses locally.
8. The resolved account is optionally cached through `persistCustomersForEmail`, converted with `toCustomerProfile`, and committed through `completeSignIn`.
9. The selected CSLB identifier is stored locally so an existing Supabase session can revalidate the same account on a later launch without prompting again.
10. The user is redirected to `/(tabs)`. A resolver failure blocks entry and remains retryable; failure of only the optional Supabase customer-cache write does not block entry.

## 5. Dashboard Hydration Flow

1. `app/(tabs)/index.tsx` reads `customer` and `userEmail` from auth context.
2. The screen builds a display identity card from the best available customer name/email.
3. It derives the PBIA account id from `customer.accountId`.
4. Agent flow:
   - calls `fetchClientAgent(email, accountId)` through `GET /client/agent`
   - uses the returned assigned agent as primary
   - falls back to `portal-config` defaults when the API returns nothing or fails
5. Company flow:
   - `useCompanyProfile()` calls `fetchClientCslb(email, accountId)` through `GET /client/cslb`
   - maps the PBIA CSLB summary into the available license rows and status chips
6. The screen keeps a dashboard skeleton visible for at least three seconds and also waits for agent/company loading to settle.
7. Action cards open:
   - direct external actions for phone, email, and SMS
   - in-app browser for scheduling links and CSLB links
8. Quote and additional-insured actions route to PBIA forms; COI requests use `POST /client/contact-requests`.

## 6. Agent-Published Payment Flow

1. `PaymentsProvider` calls `GET /client/payment-eligibility?accountId={accountId}` after authentication and follows every pagination page.
2. PBIA returns only visible `PUBLISHED` payment demands. An empty list means no payment is currently due.
3. The dashboard renders one **Payment Due** card per returned `demandId`, including the exact amount, due date, purpose, and optional agent message.
4. The payment screen reloads `GET /client/payment-eligibility/{demandId}` with `X-Client-Account-Id` before review and again before submission.
5. The amount and purpose are agent-authored and cannot be changed by the client. Card and ACH reviews display PBIA's server-calculated convenience-fee preview and total; confirmation for a method is unavailable when its preview is missing. ACH currently uses the approved fixed $3.00 fee.
6. Card or ACH submission posts to `/client/payment-eligibility/{demandId}/payments` with the selected account header and one intent-scoped idempotency key. Both request bodies contain the base `amountDue`, not the preview total, because Input1 applies its configured fee.
7. Only `SUCCEEDED` confirms payment. The success screen shows Input1's actual normalized fee and total when receipt details are available. After success, the app clears sensitive fields, refreshes eligibility, and the paid demand disappears.

## 7. Policies Flow

1. `PoliciesProvider` loads policies once the user is authenticated and `customer.accountId` exists.
2. `fetchPoliciesByAccount(email, accountId)` hits `GET /client/policies` and follows all pagination pages.
3. The service normalizes API records into the shared `Policy` shape.
4. `app/(tabs)/policies.tsx` renders filter chips for `All`, `Active`, `Pending`, and `Lapsed`.
5. Selecting a card routes to `/policy/[id]`.

## 8. Policy Detail and File Flow

1. `app/policy/[id].tsx` resolves the selected policy from `PoliciesProvider`.
2. It requests coverage data from `GET /client/policies/:policyId/coverages` using the selected account id.
3. The screen shows the PBIA coverage groups and policy summary.
4. "Browse policy files" routes to `/policy-files` with `accountId`, `policyId`, and `policyNumber`.

## 9. Policy Files Browser Flow

1. `app/policy-files/index.tsx` derives the PBIA account id from route params first, then auth context.
2. Account-level loads use `GET /client/documents`; policy-level loads use `GET /client/policies/:policyId/documents`.
3. Folder traversal supplies `folderId` to the same scoped endpoint.
4. All pagination pages are combined before rendering.
5. The current PBIA response exposes document metadata but no download URL, so the screen reports that download is unavailable.
6. Pull-to-refresh reloads the current document scope.

## 10. Company Detail Flow

1. `app/company/index.tsx` reuses `useCompanyProfile()`.
2. It renders the same summary section as the dashboard, then expands into:
   - business profile
   - classifications
   - bonding groups
   - workers compensation rows
   - personnel groups
3. If CSLB detail content is absent after loading, the screen renders an `EmptyState` instead of blank sections.

## 11. PBIA Forms Flow

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

## 12. Sign Out Flow

1. `app/(tabs)/profile.tsx` calls `signOut()`.
2. `AuthProvider` signs out from Supabase and clears local auth/customer state.
3. The protected tab layout redirects the user back to `/(auth)/login`.

## 13. Failure and Degradation Rules

- Missing `customer.accountId` blocks PBIA policy, agent, CSLB, coverage, document, and contact-request calls and surfaces a user-facing error.
- Agent lookup failure does not break the dashboard; it falls back to env-configured agent info.
- A rejected/expired PBIA bearer token requires Supabase session refresh or a new sign-in; the app never falls back to a caller-supplied email header or static review code.
- PBIA account-resolution failure after OTP success blocks protected data access. Only failure of the optional Supabase customer-cache write is tolerated.
- PBIA WebView failures never throw into the UI intentionally; they log diagnostics and show retryable fallback UI instead.
