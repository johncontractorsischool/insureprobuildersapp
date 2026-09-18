# PBIA client payment visibility backend handoff

## September 18, 2026: full and financed premium checkout

The shared native/web checkout now supports `FULL_PREMIUM` and `FINANCED_PREMIUM`
for agent-published Premium demands in `FIXED` or `TERM_OPTIONS` mode. The existing
card/ACH form, Supabase authentication, account headers, endpoints, and environment
configuration are reused. Premium Audit installments and non-premium demands
retain their existing request path.

- Eligibility may include `premiumPaymentOffer`, `pricingVersion`, `financing` (`fullPremium`,
  `downPayment`, `paymentCount`, `paymentAmount`), and separate
  `financedCardConvenienceFee`, `financedCardTotalAmount`,
  `financedAchConvenienceFee`, and `financedAchTotalAmount` fields. Coverage terms
  carry their own financing and fee previews. Malformed pricing is rejected.
- Honor the saved offer across every policy line: `FULL_PREMIUM_ONLY` hides
  financing even when terms are saved; `BOTH` offers full payment plus financing
  when valid; `FINANCED_PREMIUM_ONLY` offers only financing. Opening, reloading,
  and changing coverage term select Full when allowed, otherwise Financed.
  Show the Premium Payment choice section only when both options are available.
  A single allowed option is selected automatically; financed-only monthly terms
  remain visible in the payment summary and review.
  Financed-only without valid terms or a pricing version shows unavailable
  pricing and blocks payment. Unknown offers and malformed pricing are rejected.
  Historical missing/null offers retain BOTH semantics; they are never rewritten
  to the new-record Full-only default. Monthly amounts remain exactly as saved.
- The customer chooses premium structure independently from coverage duration
  and card/ACH. Financed checkout collects only the down payment plus its fee.
  The finance company handles the agreement and later monthly payments; the app
  creates no recurring charge or installment schedule.
- Versioned requests send `premiumPaymentOption` and the exact `pricingVersion`,
  plus `paymentOptionId` for a selected coverage term. They omit client prices,
  purpose, and financing terms. Legacy responses without a version continue to
  use the original full-payment payload, unless explicitly financed-only (blocked).
  The offer itself is never submitted. Billing state abbreviations are normalized
  to full US state names; missing/unknown states require correction.
  The State field uses a standard dropdown on web and a selection list on native,
  containing the 50 states plus District of Columbia. Option values and submitted
  `card.region`/`ach.region` are full names. The field is locked during review,
  eligibility checks, and submission.
- Review and confirmation recheck the offer, version, selected pricing, monthly terms,
  and fee previews. Changed pricing requires another review. Submission
  fingerprints include the choice, version, and term. A synchronous submission
  lock prevents duplicate taps; changing choices cannot clear an uncertain
  payment block. Selection errors/conflicts reload eligibility. Network failures
  and malformed success responses remain uncertain rather than becoming retries.
- Financed receipts say **Down payment received**, show actual returned amounts and
  charges, and refresh eligibility. Null receipt totals are never replaced with
  estimated fees. Account summaries still count each demand once and exclude
  future finance-company collections. Financed-only dashboard and checkout demand
  cards use the down payment (the lowest available term down payment before term
  selection). Account totals exclude unavailable prices rather than substituting
  full premium. Unavailable requests remain visible for refresh/agent follow-up.

The AMS-PBIA build brief is
`docs/api/insureprobuildersapp-premium-payment-build-handoff.md`, accompanied by
`docs/api/mobile-premium-payment-options-handoff.md`. Its latest development
verification reports pricing migration `20260918160131_add_premium_payment_options`
was applied, while offer migration `20260918190250_add_premium_payment_offer` was
unapplied. The matching API release is not confirmed deployed.
Fixture tests do not establish deployment or schema readiness. Verify the target
API contract after the backend migration/deployment is separately coordinated;
then validate iOS, Android, and web against that environment. No real payment is
part of local automated verification.

Run `npm test -- --runInBand`, `npx tsc --noEmit`, and `npm run lint`. Focused
coverage lives in the payment API, payment screen, payments context, and account
payment utility suites.

## Original payment visibility handoff

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
