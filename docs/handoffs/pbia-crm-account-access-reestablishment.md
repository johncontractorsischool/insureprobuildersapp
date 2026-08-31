# AMS-PBIA CRM account-access re-establishment handoff

Date: August 24, 2026

## Recipient and scope

This is an implementation handoff for the AMS-PBIA API and CRM/admin agents. It describes how the PBIA CRM account page should let an authorized administrator intentionally re-establish access after a mobile user has deleted their account.

This workflow changes the persistent portal-access block only. It does not restore or delete the Supabase user, and it must never delete Momentum, CRM, policy, claim, payment, regulatory, or replica insurance records.

The mobile deletion flow is documented separately in [account-deletion-access-block.md](./account-deletion-access-block.md).

## Required product behavior

The account-page action must be named clearly, for example **Re-establish client access**. It must be visible only when all of these conditions are true:

1. The PBIA access-block record for the normalized email exists.
2. Its persisted status is exactly `BLOCKED`.
3. The signed-in staff member is authorized to re-establish access, currently `SUPER_ADMIN`.

Do not show the button merely because:

- a PBIA customer or agency record exists;
- the user is inactive, archived, suspended, or logged out;
- an email has no current Supabase user;
- the resolver found a retained insurance account; or
- a support case was created without a confirmed account deletion block.

The visibility rule is a user-experience rule only. The API must independently enforce the same status and role checks so a hidden button cannot be bypassed by calling the endpoint directly.

If the status is `REESTABLISHED` or there is no access-block record, the action must not be rendered. The page may show a read-only access status, but it must not offer a re-establishment action.

## Ownership boundary

```text
CRM account page
  -> authenticated AMS-PBIA API session
       -> verify SUPER_ADMIN role
       -> verify access-block status is BLOCKED
       -> change block to REESTABLISHED
       -> write audit event
```

AMS-PBIA owns the access decision and audit trail. Supabase owns authentication and app-account lifecycle. The CRM must not use a Supabase service-role key, an Edge Function token, or a direct database connection from browser code.

If the Supabase Auth user was permanently deleted, re-establishment does not recreate it. The customer must sign in or create the Supabase login again with the same email. Once authenticated, the PBIA resolver may resolve the retained records because the email block is no longer active.

## Existing API contract

The backend already defines this operation:

```http
POST /internal/client-account-access-blocks/reestablish
Content-Type: application/json
Idempotency-Key: <unique-request-key>
Cookie: pbia_session=<authenticated-super-admin-session>

{
  "email": "user@example.com",
  "reason": "IDENTITY_VERIFIED_BY_SUPPORT"
}
```

The current AMS-PBIA controller authenticates this route with the normal PBIA session cookie and requires the `SUPER_ADMIN` role. The re-establishment route does **not** use `X-Internal-Service-Token`; that token is reserved for the Supabase Edge Function’s server-to-server block-creation request.

The endpoint must:

- normalize the email using the same trim/lowercase rules used for client authentication;
- compute the server-side HMAC email key;
- find the existing access-block row;
- return `404` when no block exists;
- change only `BLOCKED` to `REESTABLISHED`;
- be idempotent when the row is already `REESTABLISHED`;
- record the authenticated staff user as `reestablished_by_id`;
- record the supplied bounded reason and timestamp; and
- append an auditable `CLIENT_ACCOUNT_ACCESS_REESTABLISHED` event.

The response must not expose `email_hash` or other internal identifiers that are unnecessary for the CRM page.

Example successful response shape:

```json
{
  "id": "access-block-id",
  "status": "REESTABLISHED",
  "blockedAt": "2026-08-24T22:26:58.000Z",
  "reestablishedAt": "2026-08-24T23:15:00.000Z",
  "reestablishedById": "staff-user-id",
  "reestablishedReason": "IDENTITY_VERIFIED_BY_SUPPORT"
}
```

## Status needed by the account page

The CRM page must obtain the access-block status from a Super Admin-protected API response. Do not infer it from account activity or from Supabase.

Use one of these implementation options:

### Preferred: include status in the account detail response

Add a server-resolved field to the existing PBIA account detail response:

```json
{
  "portalAccess": {
    "status": "BLOCKED",
    "blockedAt": "2026-08-24T22:26:58.000Z",
    "blockedReason": "USER_REQUESTED_DELETION",
    "reestablishedAt": null,
    "reestablishedById": null
  }
}
```

The API should derive the email from the selected PBIA customer/account relationship where possible. Because the current block is email-wide, the response must label the scope as email-wide and must not imply that only one license is affected.

### Alternative: add a dedicated status endpoint

If changing the account detail contract is undesirable, add a Super Admin-only endpoint such as:

```http
GET /internal/client-account-access-blocks/status?email=user%40example.com
Cookie: pbia_session=<authenticated-super-admin-session>
```

Return only a safe status contract:

```json
{
  "status": "BLOCKED",
  "scope": "EMAIL",
  "blockedAt": "2026-08-24T22:26:58.000Z",
  "blockedReason": "USER_REQUESTED_DELETION"
}
```

Use `NOT_FOUND` or a safe equivalent when no block exists. The frontend must never calculate an HMAC or query the access-block table directly.

## CRM page and confirmation modal

When `portalAccess.status === "BLOCKED"`, render a distinct action in the account actions area:

```text
Re-establish client access
```

Clicking it must open a confirmation modal before the API call. The modal should state:

```text
Re-establish access for this email?

This will allow a new authenticated mobile session using this email to access retained PBIA records. Required insurance records are not deleted.
```

Require the administrator to:

- confirm the email shown in the modal;
- select or enter a bounded support reason; and
- explicitly confirm the action.

On success:

- show a success notification;
- refresh the account detail and access status;
- remove or disable the re-establishment button because status is now `REESTABLISHED`;
- show who re-established access and when; and
- advise the customer to sign in again if their Supabase login was deleted.

On failure:

- leave the status unchanged in the UI;
- show a generic actionable error;
- do not claim that access was restored; and
- allow retry only after the API response has been handled safely.

The button must not be rendered for non-Super-Admins. The API must still return `403` for a direct request from any other role.

## Data and audit rules

The re-establishment transaction may update only the access-block row fields needed for the state transition:

```text
status                 BLOCKED -> REESTABLISHED
reestablished_at       current timestamp
reestablished_by_id    authenticated staff user ID
reestablished_reason   bounded support reason
updated_at             current timestamp
```

It must not:

- delete the access-block row;
- remove the original block reason or blocked timestamp;
- modify policy, claim, payment, agency, Momentum, CRM, or replica insurance records;
- create a new insurance customer record; or
- grant access based solely on a client-supplied license number.

Write an audit record containing the actor, access-block ID, transition, reason, and timestamp. Avoid adding raw email or unnecessary insurance data to the audit payload.

## Email-wide scope warning

The current access-block model uses an HMAC of the normalized email as its unique key. Therefore, one block applies to every PBIA account or license associated with that email.

The account page must display this clearly, for example:

```text
Scope: All portal accounts associated with this email
```

If the business requires re-establishing one license while keeping another license blocked, this is a separate schema and API change. It would require a scoped key such as email plus verified license/account identity, updated guard behavior, and new authorization rules. Do not simulate license-specific behavior in the current email-wide endpoint.

## Security requirements

- Use the normal secure PBIA session cookie with `httpOnly`, `secure`, `sameSite`, and CSRF protections appropriate to the existing admin application.
- Require `SUPER_ADMIN` in the API guard, not only in the React/Next.js UI.
- Do not accept `reestablished_by_id` from the browser; derive it from the authenticated session.
- Do not accept an email hash from the browser; derive the HMAC in AMS-PBIA.
- Do not expose `ACCOUNT_ACCESS_BLOCK_SERVICE_TOKEN`, `ACCOUNT_ACCESS_BLOCK_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or any Edge Function secret to the CRM bundle.
- Use a unique `Idempotency-Key` for every user-confirmed request and handle repeated requests safely.
- Do not reveal whether a non-authorized caller’s email corresponds to retained insurance records.
- Log authorization failures and successful transitions without logging secrets or raw sensitive record payloads.

## Required implementation tasks for the AMS-PBIA agent

1. Add a Super Admin-safe access status to the account detail response or implement the dedicated status endpoint.
2. Add the account-page status display and conditional button:
   - render only for `BLOCKED`;
   - hide for `REESTABLISHED` and no-row states;
   - show email-wide scope.
3. Add the confirmation modal and required support-reason input.
4. Wire the action to `POST /internal/client-account-access-blocks/reestablish` using the existing PBIA session and idempotency header.
5. Refresh status after success and handle `403`, `404`, `409`, and `5xx` responses without optimistic access changes.
6. Confirm the API writes the re-establishment audit event and preserves the original block metadata.
7. Add API, repository, and admin UI tests.
8. Update Swagger/API documentation and the admin permission documentation.
9. Verify production secrets and migration state without exposing secret values.

## Acceptance tests

- A `BLOCKED` row causes the account page to show the re-establishment action for a Super Admin.
- A `REESTABLISHED` row does not show the action.
- No access-block row does not show the action.
- A non-Super-Admin cannot see or execute the action successfully.
- The confirmation modal is required before the request is sent.
- A successful request changes the row to `REESTABLISHED`, records actor/reason/time, and writes the audit event.
- Repeating the same operation does not create duplicate state transitions or errors that mislead the administrator.
- A missing block returns `404` and does not create one from the re-establishment endpoint.
- Retained insurance records are unchanged throughout the operation.
- After re-establishment, a newly authenticated user with the same email can resolve retained records, subject to all normal PBIA authorization rules.
- If the Supabase Auth user was deleted, the CRM page explains that re-establishment does not recreate the Supabase login.

## Deployment handoff

The AMS-PBIA agent should report:

- changed API, database, and admin files;
- any new migration name and whether it has been applied to production;
- API and UI tests run and their results;
- the exact role/permission required;
- whether account detail or the dedicated status endpoint was chosen; and
- confirmation that no Supabase or canonical insurance records are deleted by re-establishment.

