# PBIA MyAccount account-resolution API handoff

Date: August 17, 2026

## Objective

Add a purpose-built, authenticated PBIA API contract for resolving the CRM account associated with a verified MyAccount user during sign-in and sign-up.

This is an `AMS-PBIA` backend task. The Expo app should no longer need to download every email-matched account and compare license numbers locally. Do not change the existing broad account-ownership rules or automatically prefer the primary business-email record.

## Reproduced behavior

The mobile app currently calls:

```http
GET /client/account?page=1&pageSize=50
Authorization: Bearer <Supabase access token>
```

After verifying an OTP, `screens/routes/auth/verify-screen.tsx` counts the returned records. It opens the only account automatically or asks for a license number when more than one record is returned. The license comparison currently happens on the device.

A read-only replica check on August 17, 2026 confirmed that `william@contractorsischool.com` matches three distinct, deduplicated CRM accounts:

- `Test Inc` through the primary business email;
- `John Test Company` through a secondary email or active contact; and
- `testing company landscaping` through a secondary email or active contact.

This is not duplicate pagination data. The current SQL matcher deduplicates account IDs. Therefore, the mobile app correctly enters the multiple-account branch under the existing ownership definition.

It would be incorrect to solve this by using only `GET /client/account/by-business-email`. That endpoint would select `Test Inc` for this reproduced case, recreating the original wrong-account problem.

## Current backend behavior

Relevant `AMS-PBIA` files:

- `apps/api/src/client-portal/client-portal.controller.ts`
- `apps/api/src/client-portal/client-portal.service.ts`
- `apps/api/src/client-portal/dto.ts`
- `apps/api/src/client-portal/client-portal.controller.test.ts`
- `apps/api/src/client-portal/client-portal.service.test.ts`
- `packages/integrations/src/sql-server/reader.ts`
- `packages/integrations/test/sql-server-reader.test.ts`

`ClientPortalService.listAccounts()` uses `ReplicaService.listAccountsByEmail()` with the default `ACCOUNT_OR_CONTACT` scope. The corresponding SQL considers:

- `TruckingCompanies.EMail`;
- `TruckingCompanies.EMail2`;
- `TruckingCompanies.EMail3`;
- active `TruckingCompanyContacts.BusinessEMail`; and
- active `TruckingCompanyContacts.PersonalEMail`.

Deleted accounts are excluded, inactive contacts are excluded, email comparison is trimmed and case-insensitive, and account IDs are deduplicated through a primary-key table variable.

`GET /client/account/by-business-email` intentionally uses the narrower `ACCOUNT_BUSINESS` scope and is not a replacement for MyAccount resolution.

## Required API contract

Add two guarded operations on one purpose-specific route. The exact route name can follow repository conventions, but this handoff recommends:

```http
GET /client/my-account/resolve
POST /client/my-account/resolve
```

Both operations must remain behind `ClientAuthGuard`. The backend must derive the email from `@ClientUser() client: ClientPrincipal`; neither operation may accept an email in the query string, request body, or a trusted-looking custom header.

### Initial resolution

`GET /client/my-account/resolve` determines the next MyAccount step using the authenticated email and the existing `ACCOUNT_OR_CONTACT` eligibility rules.

No eligible account:

```json
{
  "status": "SIGNUP_ALLOWED",
  "matchCount": 0
}
```

Exactly one eligible account:

```json
{
  "status": "ACCOUNT_RESOLVED",
  "matchCount": 1,
  "account": {
    "id": "insured-1",
    "legalName": "Client Builders",
    "dba": null,
    "email": "client@example.com",
    "phone": "5551112222",
    "licenseNumber": "1144038",
    "status": "ACTIVE",
    "entityType": "LLC",
    "agentId": "agent-1",
    "agent": null,
    "policyCount": 1
  }
}
```

More than one eligible account:

```json
{
  "status": "LICENSE_REQUIRED",
  "matchCount": 3
}
```

For the multiple-account response, do not return candidate account names, IDs, license numbers, contact records, or other replica fields. The response should reveal only that selection is required and the number of eligible accounts.

### License-based selection

`POST /client/my-account/resolve` accepts only the selection identifier:

```json
{
  "licenseNumber": "1144038"
}
```

It must search only accounts already eligible for the authenticated email.

Exactly one eligible account matching the submitted identifier returns:

```json
{
  "status": "ACCOUNT_RESOLVED",
  "matchCount": 3,
  "account": {
    "id": "insured-1",
    "legalName": "Client Builders",
    "dba": null,
    "email": "client@example.com",
    "phone": "5551112222",
    "licenseNumber": "1144038",
    "status": "ACTIVE",
    "entityType": "LLC",
    "agentId": "agent-1",
    "agent": null,
    "policyCount": 1
  }
}
```

Use the existing `safeAccount()` shape for the resolved account so this endpoint does not expose contacts, notes, documents, private replica fields, or SQL metadata.

Expected failures:

- `400 Bad Request` for a missing, blank, or invalidly sized identifier;
- `404 Not Found` with a generic message when the identifier does not match an account eligible for the authenticated email;
- `409 Conflict` when more than one eligible account has the same identifier, with a message directing the user to PBIA support; and
- `503 Service Unavailable` when the replica is unavailable.

Do not disclose whether the submitted license exists on an account outside the authenticated email scope.

## Selection and eligibility rules

Implement these rules explicitly:

1. Normalize the authenticated email using the existing `clientPaymentEmailSchema` path.
2. Preserve the current broad `ACCOUNT_OR_CONTACT` candidate scope so downstream ownership checks and sign-in resolution agree.
3. Treat distinct CRM account IDs as distinct candidates. Do not collapse accounts by name, license, primary email, or company status.
4. Return `ACCOUNT_RESOLVED` automatically only when the eligible candidate count is exactly one.
5. Do not prefer a primary-email match over a secondary-email or active-contact match when multiple accounts are eligible.
6. Perform license matching on the backend and require exactly one result.
7. Normalize the identifier consistently on input and stored data. At minimum, trim and compare case-insensitively. Do not introduce fuzzy, substring, or prefix matching.
8. Do not silently truncate selection to the first page. Either add a bounded, parameterized resolver query to the replica reader or page through the complete eligible set before deciding.

### Important CSLB data caveat

The existing replica projection defines `licenseNumber` as:

```sql
COALESCE(NULLIF(LTRIM(RTRIM(tc.MC_Number)), ''), contractorLicense.licenseNumber)
```

The mobile prompt says **CSLB License Number**, but the current expression prefers `MC_Number` when both values exist. Before implementing selection, confirm the intended MyAccount identifier with the product owner and encode it explicitly.

For the current requirement, the selection input is intended to be the CSLB license number. A resolver-specific internal CSLB field or expression is preferable to accidentally validating only `MC_Number`. Keep any internal selection value out of the multiple-account response, application logs, and error messages. Add tests for an account containing both an MC number and a CSLB value.

## Sign-up behavior

The resolver supports the sign-up decision but does not replace `POST /client/signup`.

- The app may continue to signup only after resolution returns `SIGNUP_ALLOWED`.
- `POST /client/signup` must independently repeat the email-existence check immediately before creating the request. Do not trust an earlier resolver response; this prevents a race or a client bypass.
- Any existing primary, secondary, or active-contact match should continue to block creation under the current ownership rules.
- The signup body email must continue to equal the authenticated `ClientPrincipal.email`.
- Preserve the existing idempotency-key requirement.

If the product owner wants contact-only matches not to block signup, that is a separate authorization-policy change and must not be inferred as part of this task.

## Security and operational requirements

- Keep `@Public()` plus `@UseGuards(ClientAuthGuard)` consistent with the other client-portal routes; `@Public()` must not make the route unauthenticated because the controller guard is authoritative here.
- Never accept `x-client-email` as identity and never trust a body/query email.
- Parameterize all SQL inputs. Do not interpolate an email or license value into SQL text.
- Do not log raw license numbers or access tokens.
- Apply the repository's existing request-throttling pattern to repeated selection failures. A license number is an account selector, not a substitute for the verified email OTP.
- Preserve generic ownership failures so callers cannot enumerate accounts outside their email scope.
- Keep the existing `/client/account` and `/client/account/by-business-email` routes unchanged for compatibility while the mobile app migrates.
- Do not mutate the CRM replica; this feature is read-only.

## Required backend changes

1. In `apps/api/src/client-portal/dto.ts`, add a validated DTO for the POST body. Use a non-empty string with a conservative maximum length consistent with existing license fields.
2. In `apps/api/src/client-portal/client-portal.controller.ts`, add the guarded GET and POST handlers and Swagger summaries. Both handlers pass only `client.email` plus the validated license input to the service.
3. In `apps/api/src/client-portal/client-portal.service.ts`, add initial-resolution and license-selection methods. Reuse `safeAccount()` and the existing email/replica guards.
4. In `packages/integrations/src/sql-server/reader.ts`, add or extend a parameterized reader query if needed to resolve by authenticated email plus the canonical CSLB identifier without returning all candidates to the client. Preserve the existing account/contact ownership SQL and ID deduplication.
5. Update the replica service facade only if the new reader operation requires it.
6. Add focused controller, service, and SQL-builder tests.
7. Update Swagger/API documentation with the response union and status codes.

Avoid changing `/client/account` response semantics as part of this implementation. The new endpoint should own MyAccount decision-making without destabilizing policy, document, payment, agent, or CSLB routes that already use account ownership checks.

## Required tests

At minimum, cover:

- zero candidates returns `SIGNUP_ALLOWED`;
- one primary-email candidate returns `ACCOUNT_RESOLVED`;
- one secondary-email candidate returns `ACCOUNT_RESOLVED`;
- one active-contact candidate returns `ACCOUNT_RESOLVED`;
- multiple distinct candidates returns `LICENSE_REQUIRED` without candidate data;
- a primary plus contact match does not automatically prefer the primary account;
- a valid license selects exactly one account from the authenticated email scope;
- a license belonging only to another email scope returns the same generic `404` as an unknown license;
- duplicate eligible license values return `409` rather than selecting the first row;
- blank and overlong values return `400`;
- email and license comparisons follow the documented normalization;
- inactive contacts and deleted accounts remain excluded;
- an account reachable through multiple matching fields remains one candidate;
- the replica-unavailable path returns `503`;
- signup still rejects when any eligible email association already exists;
- the controller never accepts a request-provided email; and
- SQL remains parameterized and contains no submitted identifier literal.

If the canonical identifier is CSLB, include a case where `MC_Number` and the CSLB custom field are both populated and prove that the CSLB input selects the account.

## Verification commands

Run from `AMS-PBIA`:

```bash
pnpm --filter @pbia/api test -- client-portal.service.test.ts client-portal.controller.test.ts
pnpm --filter @pbia/integrations test -- sql-server-reader.test.ts
pnpm --filter @pbia/api typecheck
pnpm --filter @pbia/integrations typecheck
pnpm lint
pnpm format:check
```

Also perform a read-only local API smoke test with a valid Supabase client token:

1. Confirm a single-match email returns `ACCOUNT_RESOLVED` without requiring a license.
2. Confirm the reproduced multi-match email returns `LICENSE_REQUIRED`.
3. Confirm a valid eligible CSLB number selects the intended account.
4. Confirm an invalid CSLB number receives the generic failure and no candidate data.
5. Confirm `POST /client/signup` remains blocked for an email with any eligible account association.

Do not print or commit Supabase access tokens, SQL credentials, full live license values, or other secrets during verification.

## Mobile integration status

The Expo app integration is implemented locally in `insureprobuildersapp`:

- OTP completion calls the new resolver GET;
- the license input renders only for `LICENSE_REQUIRED`;
- license selection uses the resolver POST instead of comparing downloaded account records locally;
- signup continues only for `SIGNUP_ALLOWED`;
- only the resolved safe account profile is cached; and
- session restoration calls the resolver GET, then revalidates the stored CSLB selector through POST only when multiple accounts still exist.

Likely mobile touchpoints:

- `services/customer-api.ts`
- `screens/routes/auth/verify-screen.tsx`
- `context/auth-context.tsx`
- the related auth and customer API tests

End-to-end manual verification still requires the updated local PBIA API process and the Expo app to run together.

## Acceptance criteria

- MyAccount sign-in/sign-up decision-making uses the new purpose-built authenticated endpoint.
- A verified email with no eligible account may proceed to signup.
- A verified email with exactly one eligible account opens that account without asking for a license.
- A verified email with multiple eligible accounts receives a license prompt.
- The license is matched server-side only within accounts authorized by the verified email.
- Primary business email is not used as an implicit tiebreaker.
- Multiple-account responses do not expose candidate records or license values.
- Existing account ownership checks and signup conflict checks remain intact.
- Focused tests, typechecks, lint, formatting, and a read-only smoke test pass.
