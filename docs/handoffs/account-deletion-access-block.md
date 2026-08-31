# Account deletion retention and access-block handoff

Date: August 24, 2026

## Recipient

This is an implementation handoff for the `AMS-PBIA` API agent. Supabase owns the mobile account lifecycle and deletion of the authentication user/app-owned data. The Expo app owns the deletion UI and invokes the Supabase Edge Function. `AMS-PBIA` owns only the persistent access block and the server-side authorization decision that protects retained insurance records.

## Objective

When a customer deletes their app account:

1. The customer's login and app-owned data are deleted.
2. Insurance policy, claim, payment, regulatory, and other legally required source records remain unchanged.
3. The retained source records cannot automatically restore app access if the same email later creates a new login.
4. Access can be intentionally re-established only through an authorized support or administrative workflow.

The access block must be enforced by `AMS-PBIA`, not by React Native state, AsyncStorage, or a hidden UI flag.

## System ownership boundary

The implementation must preserve this ownership model:

```text
Expo app
  -> Supabase Edge Function
       -> create/confirm AMS-PBIA access block
       -> delete Supabase app-owned data
       -> delete Supabase Auth user
       -> leave PBIA/insurance records unchanged
```

### Supabase owns

- OTP login and email verification;
- the authenticated mobile user;
- mobile sessions and refresh tokens;
- app-owned profile/cache, signup, push-device, and digital-card data; and
- account deletion through the server-only `auth.admin.deleteUser()` operation.

The Expo app must never receive or contain a `service_role` key. The Edge Function is the only component that may use that key for Auth administration. Supabase documents `auth.admin.deleteUser()` as a server-only operation; its default hard-delete behavior removes the Auth user and refresh-token/session rows, while the optional soft-delete form is not reversible. [Supabase `deleteUser` documentation](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)

### AMS-PBIA owns

- the durable deletion/access-block record;
- rejection of blocked users on every protected `/client/*` route;
- the authorized re-establishment workflow; and
- all insurance-data authorization and retrieval.

AMS-PBIA must not delete the Supabase user, Supabase app data, Momentum/CRM records, read-only replica records, or canonical insurance agency records. It should receive a private service-to-service request from the Edge Function to create or confirm the access block, then enforce that block on client API requests.

### Canonical insurance systems own

The agency, policy, claim, payment, regulatory, Momentum, CRM, and replica records remain unchanged under this flow. They are retained outside the deleted mobile account because the agency is legally required to maintain them.

## Existing JWT window

Deleting the Auth user invalidates refresh tokens and removes the session rows, but an already-issued access JWT remains cryptographically valid until its `exp` time. Supabase explicitly documents this behavior. [Supabase user-management documentation](https://supabase.com/docs/guides/auth/managing-user-data)

Therefore, AMS-PBIA must enforce the deletion block immediately on every protected client request. Do not rely only on the deleted Auth row or on the app waiting for the JWT to expire. If the API already validates the JWT `session_id`, it may additionally verify that the session still exists; the deletion block remains the required cross-system authorization check.

## Deletion semantics (mandatory)

For this feature, **Delete account** has the following exact meaning:

| Record or relationship | Deletion behavior | Clarification |
| --- | --- | --- |
| Supabase authentication login | **Delete** | Remove the authentication user and invalidate the app login/session. A later login with the same email must not automatically restore access. |
| Mobile/app profile and app-owned data | **Delete** | Remove app-owned profile/cache rows, signup drafts, push-device associations, digital-card records/media, and similar data that is not legally required to retain. |
| PBIA customer/portal association | **Revoke portal access; do not expose it** | Remove or mark the app-facing association as `REVOKED`/`DELETED` according to the PBIA schema. It must not be returned by client resolution or protected client routes. Keep only the minimum audit/deletion-lock data needed to enforce the block. |
| Canonical PBIA/insurance agency record | **Do not delete** | Do not delete the insurance agency/customer record, policy, claim, payment, regulatory, Momentum, CRM, or read-only replica records that the agency is legally required to retain. These records remain outside the deleted app account. |

The PBIA customer/portal association is an access relationship, not permission to delete the canonical insurance agency record. If a PBIA `Account`, `ExternalReference`, or similar row is also the legal system-of-record insurance entity, it must remain intact; only its active portal access/association may be revoked.

The successful user-facing result should communicate this distinction:

```text
Your account and app access have been deleted. Required insurance records are retained.
```

Do not describe the operation as deleting the entire customer, agency, or insurance record. Do not claim that legally required records were removed.

## Current behavior and gap

The Expo app currently verifies an email OTP and then calls:

```http
GET /client/my-account/resolve
Authorization: Bearer <Supabase access token>
```

`AMS-PBIA` resolves the authenticated email against the read-only insurance/Momentum replica. The resolver can therefore find an insurance account even after the app login and Supabase portal cache have been removed.

The app's OTP request currently allows a new email user to be created when no authentication user exists. A deleted email could therefore create a new authentication identity and receive the retained insurance account again unless the PBIA API has a persistent access block.

Relevant Expo files:

- `services/account-deletion-api.ts`: invokes the `delete-account` Edge Function.
- `supabase/functions/delete-account/index.ts`: deletes app-owned Supabase data and the authentication user; it intentionally leaves Momentum/CRM insurance records untouched.
- `services/auth-flow.ts`: sends OTP sign-in requests and currently permits new email users.
- `screens/routes/auth/verify-screen.tsx`: calls `GET /client/my-account/resolve` after OTP verification.

Relevant `AMS-PBIA` files:

- `apps/api/src/client-portal/client-portal.controller.ts`
- `apps/api/src/client-portal/client-portal.service.ts`
- `apps/api/src/client-portal/client-portal.service.test.ts`
- `apps/api/src/client-portal/client-portal.controller.test.ts`
- the existing Prisma schema and migration directory

## Required design

### Persistent access-block record

Add a PBIA-owned table, for example `client_account_access_blocks`, to the PBIA database. The record must survive deletion of Supabase portal rows and must not be stored only in a cache.

Recommended fields:

```text
id                 UUID primary key
email_hash         CHAR(64) unique, indexed
status             BLOCKED | REESTABLISHED
blocked_at         timestamp with time zone
blocked_reason     bounded string, nullable
reestablished_at   timestamp with time zone, nullable
reestablished_by   UUID/string, nullable
created_at         timestamp with time zone
updated_at         timestamp with time zone
```

Store an HMAC-SHA-256 of the normalized email rather than another raw email copy. The HMAC key must be a server-only deployment secret, for example `ACCOUNT_ACCESS_BLOCK_HMAC_SECRET`; do not use a plain unsalted email hash. Normalize with the same trim/lowercase rules used by the existing client email schema.

The unique key makes the block operation idempotent. A blocked record must remain effective until an authorized re-establishment operation explicitly changes its status.

### API enforcement

Add a shared access-block check to the authenticated client portal boundary. The check must derive the email from the validated Supabase bearer token and must not trust a client-supplied email header or body field.

At minimum, enforce the block before:

- `GET /client/my-account/resolve`
- `POST /client/my-account/resolve`
- `POST /client/signup`
- `GET /client/account`
- `GET /client/policies`
- `GET /client/agent`
- `GET /client/documents`
- all client payment, contact-request, CSLB, policy-file, and policy-coverage routes

Prefer a shared `ClientAccessBlockGuard` or common service check so a newly added `/client/*` route cannot accidentally bypass the rule. The check must run before replica lookup, PBIA cache lookup, or any response containing insurance data.

For a blocked account, return a generic response such as:

```http
403 Forbidden
```

```json
{
  "code": "ACCOUNT_ACCESS_BLOCKED",
  "message": "This account is unavailable. Contact support if you need to re-establish access."
}
```

Do not return the retained account, policy count, license number, or any information that confirms which insurance records matched the email.

### Internal deletion-lock contract

The deletion service must create the PBIA access block before deleting the authentication user. Add a private, service-to-service operation following repository conventions, for example:

```http
POST /internal/client-account-access-blocks
X-Internal-Service-Token: <server-only token>
Content-Type: application/json

{
  "email": "normalized-user@example.com",
  "reason": "USER_REQUESTED_DELETION"
}
```

Requirements:

- Keep the route off the public client API surface.
- Require a server-only service token or equivalent workload identity.
- Compute and store the HMAC in `AMS-PBIA`; do not accept a client-supplied hash as authoritative.
- Make repeated requests idempotent.
- Do not delete or modify Momentum/CRM/replica insurance records.
- Fail closed: if the block cannot be created, the deletion service must not proceed with deleting the authentication user.

The corresponding Supabase Edge Function will call this operation before removing Supabase-owned app data or the Auth user. AMS-PBIA must not call `auth.admin.deleteUser()` and must not become the owner of Supabase credentials. If the block cannot be created or confirmed, the Edge Function must fail closed and leave the Auth user/app data intact so the request can be retried safely.

Configure these server-only Edge Function secrets for that call:

```text
SUPABASE_SERVICE_ROLE_KEY
PBIA_INTERNAL_API_BASE_URL
PBIA_INTERNAL_SERVICE_TOKEN
```

`PBIA_INTERNAL_SERVICE_TOKEN` must equal the AMS-PBIA `ACCOUNT_ACCESS_BLOCK_SERVICE_TOKEN` value. None of these values may use an `EXPO_PUBLIC_` prefix or be included in the Expo bundle.

### Re-establishment workflow

The AMS-PBIA API exposes a private, audited administrative operation to re-establish access. The CRM account-page integration, including the rule that the action is shown only for a persisted `BLOCKED` row, is specified in [pbia-crm-account-access-reestablishment.md](./pbia-crm-account-access-reestablishment.md).

```http
POST /internal/client-account-access-blocks/reestablish
Content-Type: application/json
Idempotency-Key: <unique-request-key>
Cookie: pbia_session=<authenticated-super-admin-session>

{
  "email": "normalized-user@example.com",
  "reason": "IDENTITY_VERIFIED_BY_SUPPORT"
}
```

Only an authenticated `SUPER_ADMIN` may call it. Record who re-established access and why. Do not expose this operation to the mobile app or unauthenticated browsers. `X-Internal-Service-Token` is reserved for the Supabase Edge Function's block-creation request and must not be exposed to the CRM browser.

After re-establishment, the existing email resolver may again match the retained insurance records and rebuild the app cache for the newly authenticated user.

## OTP and sign-in coordination

The PBIA API check after OTP verification is mandatory and is the security boundary. It prevents a newly created authentication identity from opening the retained account.

As a follow-up, the app may move OTP sending behind a server/Edge Function that checks the block first, so blocked users do not receive an unnecessary code. Do not rely on a client-only preflight: an attacker can bypass the app bundle and call the API directly.

If a blocked user reaches OTP verification before the preflight change exists, the PBIA resolver must still return `403 ACCOUNT_ACCESS_BLOCKED`, and the app must clear the session and show the generic unavailable-access message.

## Deletion ordering and failure handling

Use this sequence:

1. Normalize and validate the authenticated email from the bearer token.
2. Create or confirm the PBIA access block.
3. Delete Supabase-owned portal/app data and the authentication user.
4. Leave legally required insurance records untouched.
5. Return a successful deletion response only after steps 2–3 complete.

If step 2 fails, do not delete the authentication user. If step 3 partially fails, retain the block and return a retryable error so a later attempt cannot restore access while cleanup is incomplete. The operation must be idempotent.

## Security and privacy requirements

- Never trust an email supplied by the mobile client when deciding which account is authenticated; derive it from the verified bearer token.
- Never expose the HMAC key, service token, service-role key, or raw internal error details to the app.
- Do not use a client-side flag, cached state, or deleted Supabase row as the access block.
- Prevent blocked users from receiving insurance records through every protected client route, not only account resolution.
- Keep audit data bounded and avoid retaining more personal data than required to enforce the block.
- Preserve Momentum/CRM and legally required insurance records exactly as required by the existing retention policy.

## Required tests

Add focused tests for:

1. Creating a block is idempotent for the same normalized email.
2. A blocked email receives `403 ACCOUNT_ACCESS_BLOCKED` from `GET /client/my-account/resolve` even when the replica contains a matching insurance account.
3. A blocked email receives the same denial from `POST /client/my-account/resolve`, `/client/signup`, and representative policy/payment routes.
4. An unrelated, unblocked email continues to resolve normally.
5. Re-establishing access changes the status and allows resolution again, with an audit actor and reason.
6. Internal block/re-establish routes reject missing or invalid service authentication.
7. Deletion-lock creation is idempotent and is required before account cleanup proceeds.
8. No test or implementation mutates Momentum/CRM or replica insurance records.
9. Migration rollback/status checks pass according to the repository's production migration process.

## Acceptance criteria

- A deleted user cannot open retained insurance records by creating a new authentication identity with the same email.
- Every protected PBIA client route enforces the block server-side.
- The retained insurance source records remain unchanged.
- The block can be intentionally cleared only by an authorized, audited re-establishment workflow.
- The deletion service fails safely if PBIA cannot create the block.
- API docs and error contracts describe `ACCOUNT_ACCESS_BLOCKED` without leaking account existence or retained-record details.
- The AMS-PBIA agent reports migration name, changed files, tests run, deployment-secret requirements, and any required Expo-side follow-up.
