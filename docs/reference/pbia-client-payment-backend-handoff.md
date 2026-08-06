# PBIA client payment visibility backend handoff

Date: August 6, 2026

## Objective

Make every agent-published client payment demand returned by PBIA's mobile eligibility API conform to the documented contract so the mobile app can render its **Payment due** card.

This is a PBIA backend task. Do not weaken the mobile response validator or calculate the amount due in the mobile app.

## Reproduced behavior

The client account resolves successfully:

- Client email: `william@contractorsischool.com`
- Account ID: `75A222CA-22DA-419E-8CA4-4B16F78A1AB2`
- Account status: `ACTIVE`

The following request succeeds:

```http
GET /client/payment-eligibility?accountId=75A222CA-22DA-419E-8CA4-4B16F78A1AB2&page=1&pageSize=50
Authorization: Bearer <Supabase access token>
```

It returns two visible demands:

- `$20`, `PUBLISHED`, `DUE`, due `2026-08-19`
- `$1`, `PUBLISHED`, `DUE`, due `2026-08-20`

Both records have the correct account ID, `showPaymentToClient=true` eligibility, positive `amountDue`, `paymentState=DUE`, and `paymentNeeded=true`. However, both records omit `purpose`.

CORS is not the blocker. A preflight from `http://localhost:8081` returns `204` and permits `authorization,x-client-email`.

## Root cause

The published-demand repository filter is correct. It returns only demands matching:

```text
sourceAccountId = selected client account
status = PUBLISHED
showPaymentToClient = true
```

The failure occurs while mapping a stored `ClientPaymentDemand` into `ClientPaymentEligibility`.

The backend's eligibility mapper returns `amountDue`, dates, status, and message, but does not return:

```ts
purpose: demand.purpose
```

The backend shared `ClientPaymentEligibility` type also omits `purpose`, even though the PBIA handoff documentation includes it and payment submission requires the submitted purpose to equal the demand purpose.

The mobile app validates every eligibility row before using it. Its accepted purposes are:

```text
PREMIUM
DOWN_PAYMENT
INSTALLMENT
POLICY_FEE
OTHER
```

Because `purpose` is absent, the mobile app rejects the entire eligibility page as an unexpected response, clears its payment records, and displays no payment card.

## Required PBIA backend changes

1. Update `apps/api/src/client-payments/client-payments.service.ts`.

   Add the stored demand purpose to the object returned by the eligibility mapper:

   ```ts
   purpose: demand.purpose,
   ```

2. Update `packages/shared/src/client-payments.ts`.

   - Import the existing `PaymentPurpose` enum/type.
   - Add the following required field to `ClientPaymentEligibility`:

   ```ts
   purpose: PaymentPurpose;
   ```

3. Update the focused service test.

   In `apps/api/src/client-payments/client-payments.service.test.ts`, assert that a demand with `purpose: "DOWN_PAYMENT"` produces eligibility containing:

   ```ts
   purpose: "DOWN_PAYMENT"
   ```

4. Verify the API documentation and Swagger response model remain consistent with `docs/api/mobile-payments-handoff.md`.

5. Restart the PBIA API after building so port `4010` is serving the new code rather than a stale process.

## Required tests

Run the repository-prescribed equivalents of:

```bash
pnpm --filter api test -- client-payments.service.test.ts
pnpm typecheck
pnpm lint
```

Also run the appropriate formatting check for the changed files.

Do not submit a real Input1 card or ACH payment as part of this fix.

## API acceptance criteria

The list endpoint must return `purpose` on every row:

```json
{
  "data": [
    {
      "demandId": "example-demand-id",
      "source": "REPLICA",
      "accountId": "75A222CA-22DA-419E-8CA4-4B16F78A1AB2",
      "recordId": "example-record-id",
      "recordType": "QUOTE",
      "status": "PUBLISHED",
      "premium": 20,
      "paidAmount": 0,
      "amountDue": 20,
      "purpose": "DOWN_PAYMENT",
      "paymentState": "DUE",
      "paymentNeeded": true,
      "missing": [],
      "dueDate": "2026-08-19",
      "clientMessage": null
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1,
  "totalPages": 1
}
```

Acceptance checks:

- `GET /client/payment-eligibility` includes `purpose` for every returned demand.
- `GET /client/payment-eligibility/{demandId}` includes the same `purpose`.
- The purpose is read from the durable demand and is not inferred from record type or premium.
- Draft, hidden, processing, paid, and cancelled demands remain excluded.
- Account ownership and `X-Client-Account-Id` checks remain unchanged.
- Existing payment submission validation still requires body `purpose` to match the stored demand.
- After an API restart and mobile refresh, both published demands appear as separate **Payment due** cards.

## Recommended follow-up

The mobile dashboard currently hides payment-loading and contract errors because it renders only `payableRecords`. A separate mobile improvement should display `paymentsError` or a retry state on the dashboard. That follow-up is not a substitute for fixing the PBIA response contract.

PBIA now validates the Supabase bearer token and derives the client email server-side. Production still requires deployment configuration for the same Supabase project plus the authentication and payment acceptance checks documented in the current PBIA handoff.
