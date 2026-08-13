# PBIA custom push notification handoff

Date: August 11, 2026

## Objective

Allow an authorized PBIA staff member to send one generic, custom push message from an account page in the PBIA Admin app to every active device registered by that customer.

This is the next phase after the mobile app's successful iPhone push smoke test and Supabase device registration. The mobile app already stores signed-in customer devices in `public.portal_push_devices`.

The first release remains deliberately narrow:

- one account at a time;
- one fixed title, `Insure Probuilders`;
- one staff-entered message body;
- all active devices registered under the account's login email;
- no deep links, inbox, campaigns, schedules, templates, Android-specific work, or automated renewal reminders.

## Repository ownership

Two repositories participate in this feature:

| Repository | Responsibility |
| --- | --- |
| `insureprobuildersapp` | Owns the Supabase push-device schema and the proposed Supabase Edge Function that reads device tokens and calls Expo. |
| `PBIA-AMS` | Owns the staff UI, staff authorization, account-to-email resolution, idempotency, durable send record, and invocation of the Edge Function. |

The browser and mobile app must never receive a Supabase secret key, service-role key, Expo access token, or another customer's Expo push token.

## Recommended architecture

```text
PBIA Admin account page
        |
        | authenticated POST + Idempotency-Key
        v
PBIA NestJS API
        |
        | authorize staff, load account, resolve email, claim durable request
        v
Supabase Edge Function: send-customer-push
        |
        | privileged query of active portal_push_devices rows
        v
Expo Push API -> APNs -> customer iPhone
```

The Admin browser calls only PBIA's NestJS API. It does not submit a customer email and does not call Supabase or Expo directly. Nest resolves the email from the selected PBIA account and sends that normalized email to the Edge Function.

Keeping the privileged token query in Supabase centralizes token handling and Expo delivery in one server-side function. PBIA uses a named Supabase secret key for function authentication instead of copying the legacy service-role key. Treat the named key as highly privileged and expose it only to the Nest API runtime.

## Existing mobile and Supabase contract

The schema is defined in `insureprobuildersapp/supabase/portal_push_devices.sql` and has already been applied manually in the Supabase SQL Editor.

Relevant columns are:

```text
user_id
login_email
expo_push_token
platform
project_id
is_active
last_seen_at
```

The unique constraint is `(user_id, expo_push_token)`, and the lookup index is `(lower(login_email), is_active)`. Customer-facing Row Level Security policies allow a signed-in customer to manage only their own rows. The Edge Function will use its server-side admin client to perform the cross-customer lookup.

The mobile app's configured Expo project ID to filter is:

```text
d4d7849a-ade7-4fee-bb49-2c38ec0a3cff
```

No additional Supabase database migration is needed for the custom-send endpoint. Do not re-run the table SQL unless the target environment is missing `portal_push_devices`.

## Public PBIA Admin API contract

Add an authenticated PBIA endpoint:

```http
POST /accounts/:accountId/push-notifications
Content-Type: application/json
Idempotency-Key: <UUID generated once when the modal opens>

{
  "source": "CRM",
  "message": "Your updated policy documents are ready."
}
```

`source` must support the same `CRM | REPLICA` distinction already used by PBIA account pages. The server must load the account through the correct repository and use the account's stored email. Do not accept `customerEmail`, `expoPushToken`, `title`, or arbitrary notification data from the browser.

Validate the request with a shared Zod schema:

- `source`: `CRM` or `REPLICA`;
- `message`: trim, minimum 1 character, maximum 240 characters;
- `Idempotency-Key`: required, trimmed, maximum 128 characters;
- `accountId`: must resolve to a visible, non-deleted account;
- account email: required and normalized with `trim().toLowerCase()`.

Recommended success response:

```json
{
  "requestId": "push-request-id",
  "status": "ACCEPTED",
  "matchedDeviceCount": 1,
  "acceptedCount": 1,
  "sentAt": "2026-08-11T20:00:00.000Z"
}
```

Supported status values for the first release:

- `NO_DEVICE`: the account has no active device for its login email;
- `ACCEPTED`: Expo accepted every message and returned ticket IDs;
- `PARTIAL`: at least one device was accepted and at least one failed;
- `FAILED`: no device message was accepted or the provider call failed.

`NO_DEVICE` should be a normal `200` response so the Admin can show a useful message without treating it as a retryable server outage. A returned Expo ticket means Expo accepted the request; it does not prove the phone displayed it.

Recommended API error mapping:

| Condition | HTTP status |
| --- | ---: |
| Invalid body or missing idempotency key | `400` |
| Staff member lacks permission | `403` |
| Account does not exist | `404` |
| Account has no usable email | `422` |
| Same key reused with different account/message | `409` |
| Edge Function timeout or provider-wide failure | `502` |

## Staff authorization

For the narrow first release, protect the endpoint with:

```ts
@RequirePermission(PermissionResource.Accounts, PermissionAction.Edit)
```

This matches the existing account-edit gate without expanding the permission model. Confirm this product decision before release. If sending notifications must be independently assignable, add a `NOTIFICATIONS` permission resource in a separate permission-model change instead of relying on role-name checks in the UI.

The API remains authoritative. Hiding the button in Next.js is only a usability measure.

## Internal Nest-to-Edge contract

Create a named Supabase secret key for this caller, `pbia_push_sender`. Configure the Edge Function for service-to-service secret authentication and have Nest send the key in the `apikey` header.

```http
POST https://<project-ref>.supabase.co/functions/v1/send-customer-push
apikey: <named Supabase secret key>
Content-Type: application/json

{
  "requestId": "push-request-id",
  "customerEmail": "customer@example.com",
  "message": "Your updated policy documents are ready."
}
```

The Edge Function must accept calls only from the named secret key. With the current Supabase server wrapper, use secret auth `auth: "secret:pbia_push_sender"`; configure this function with `verify_jwt = false` because a named secret key belongs in `apikey`, not `Authorization: Bearer`.

Recommended function response:

```json
{
  "requestId": "push-request-id",
  "matchedDeviceCount": 1,
  "acceptedCount": 1,
  "tickets": [
    {
      "status": "ok",
      "id": "expo-receipt-id"
    }
  ],
  "errors": []
}
```

The response must preserve ticket order but must never return Expo push tokens. Error entries may include a token-independent device row ID so a result can be correlated internally without exposing the token.

## Supabase Edge Function behavior

Suggested source location:

```text
insureprobuildersapp/supabase/functions/send-customer-push/index.ts
```

The handler should:

1. Accept only `POST`.
2. Authenticate the named Supabase secret key.
3. Parse and validate `requestId`, `customerEmail`, and `message`.
4. Normalize the email and trim the message.
5. Query `public.portal_push_devices` for:
   - `lower(login_email) = lower(customerEmail)`;
   - `is_active = true`;
   - `project_id = d4d7849a-ade7-4fee-bb49-2c38ec0a3cff`.
6. Deduplicate identical Expo push tokens before sending.
7. Return `matchedDeviceCount: 0` without calling Expo when no device matches.
8. Build one Expo message per active token.
9. Submit at most 100 messages in one Expo request.
10. Return only counts, ticket IDs, and sanitized errors.
11. Mark a device inactive immediately if its push ticket returns `DeviceNotRegistered`.

The initial Expo payload should remain generic:

```json
{
  "to": "<server-read Expo push token>",
  "title": "Insure Probuilders",
  "body": "<validated staff message>",
  "sound": "default",
  "data": {
    "type": "generic",
    "notificationRequestId": "push-request-id"
  }
}
```

Do not include policy numbers, payment card information, claim details, document names, or other sensitive data in lock-screen content. Notification taps will continue to open the app without deep linking.

## PBIA durable delivery record and idempotency

Sending to Expo is an external mutation. PBIA should claim a durable request before invoking the Edge Function so a browser retry cannot send the same message twice.

Add a Prisma-backed record such as `PushNotificationDelivery` with at least:

```text
id
idempotencyKey (unique)
inputHash
accountId or sourceAccountId
source
recipientEmail
title
body
status
matchedDeviceCount
acceptedCount
expoTicketIds (JSON, nullable)
lastErrorCode (nullable)
lastError (sanitized, nullable)
createdById
createdAt
updatedAt
sentAt (nullable)
```

Do not store Expo push tokens in MySQL. The Supabase device table remains the only token store.

Idempotency behavior should match existing PBIA request patterns:

- same key and same input: return the original result without another Expo call;
- same key and different input: return `409 Conflict`;
- a provider timeout after the durable claim: retain `FAILED` or an explicit retryable status for safe staff review;
- a manual retry must create a deliberate new attempt or use a controlled retry action, never silently duplicate the original send.

This model requires a PBIA MySQL/Prisma migration. Per `PBIA-AMS/AGENTS.md`, migration creation and migration application are separate approval-gated actions. Do not create or apply the migration until the repository owner explicitly approves each action.

Also write or extend the existing `AuditLog` for the actor, account, request ID, final status, and counts. Do not log secrets or tokens. The durable delivery row provides idempotency; the audit row does not replace it.

## PBIA implementation map

Use the existing PBIA architecture instead of putting business logic in the controller or Next.js component.

### Shared contract

Add a focused file such as:

```text
packages/shared/src/push-notifications.ts
```

Export the Zod input schema, response/status types, and any bounded constants. Re-export it through the package's normal public index.

### Supabase integration client

Add:

```text
packages/integrations/src/push-notifications/client.ts
packages/integrations/src/push-notifications/index.ts
```

The client owns the HTTP timeout, `apikey` header, JSON parsing, and safe provider error type. It must not log the key or response tokens. Export it from `packages/integrations/src/index.ts`.

### Database repository

Add the approved Prisma model and a repository under:

```text
packages/database/src/repositories/push-notification-delivery.ts
```

The repository owns claim/find/update operations and the unique-idempotency transaction.

### Nest module

Add a focused module:

```text
apps/api/src/push-notifications/push-notifications.module.ts
apps/api/src/push-notifications/push-notifications.controller.ts
apps/api/src/push-notifications/push-notifications.service.ts
apps/api/src/push-notifications/dto.ts
```

Import it in `apps/api/src/app.module.ts`. The controller should only validate/forward input. The service should authorize the account scope, resolve the correct email for `CRM` or `REPLICA`, claim the durable delivery, invoke the integration client, map results, and write final status.

The existing account retrieval paths are the source of truth:

- CRM accounts: `AccountsRepository.findById` / `AccountsService.getLocal`;
- replica accounts: `ReplicaAccountsRepository.findById` / `AccountsService.get`.

Do not let the staff browser pick a different email than the account email. If later product requirements support multiple contacts, add an API-provided recipient option keyed by an opaque server-issued identifier, similar to PBIA's email recipient patterns.

### Environment configuration

Extend `packages/config/src/index.ts`, `.env.example`, and `docs/development/environment-variables.md` with server-only settings:

```text
SUPABASE_PUSH_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/send-customer-push
SUPABASE_PUSH_SECRET_KEY=<named sb_secret key>
PUSH_NOTIFICATION_TIMEOUT_MS=8000
```

None of these names may start with `NEXT_PUBLIC_`. Do not reuse `SUPABASE_PUBLISHABLE_KEY` for the privileged service-to-service call, and do not copy the Supabase service-role key into PBIA.

The Edge Function receives its database admin credentials from Supabase's hosted secret environment. Its required function environment is:

```text
EXPO_PROJECT_ID=d4d7849a-ade7-4fee-bb49-2c38ec0a3cff
EXPO_ACCESS_TOKEN=<optional; required only when Expo enhanced push security is enabled>
```

Create `pbia_push_sender` under Supabase **Settings → API Keys → Secret keys**. That named key is not an Edge Function environment variable; store its value only in PBIA's server environment as `SUPABASE_PUSH_SECRET_KEY`. The Apple `.p8` key stays in Apple/EAS credentials and does not belong in either repository or runtime environment.

### Admin API client and UI

Add a typed helper in:

```text
apps/admin/lib/api.ts
```

It should call `POST /accounts/:accountId/push-notifications`, send `credentials: "include"`, and include the stable `Idempotency-Key` generated when a send modal opens.

Add a small modal component, for example:

```text
apps/admin/components/send-push-notification-modal.tsx
```

Open it from `apps/admin/components/crm-account-overview.tsx` for both CRM and replica account variants. Follow existing modal and permission patterns.

The modal should show:

- account name and server-known account email as a recipient summary;
- fixed title preview, `Insure Probuilders`;
- message textarea with live `0 / 240` count;
- reminder that the message may appear on the lock screen;
- confirmation action labeled `Send push notification`;
- disabled controls while submitting;
- success states that distinguish accepted, partial, and no registered device;
- a sanitized error plus request ID when available.

Do not display Expo tokens anywhere in PBIA Admin.

## Required tests

Write tests before implementation, following PBIA repository conventions.

### Supabase Edge Function

- rejects missing or invalid named secret authentication;
- rejects invalid email, empty message, and message over 240 characters;
- filters by normalized email, active state, and expected Expo project ID;
- returns zero counts without an Expo call when no token exists;
- deduplicates tokens and constructs the fixed-title generic payload;
- maps success and partial Expo tickets without returning tokens;
- deactivates a token on immediate `DeviceNotRegistered`;
- sanitizes transport errors.

### PBIA API

- controller requires `Accounts / Edit` and passes actor plus idempotency key;
- rejects a missing/oversized idempotency key and invalid message;
- resolves CRM and replica account emails server-side;
- rejects missing account and missing account email;
- claims the durable request before the external call;
- returns the original response for the same key/input;
- returns `409` for the same key with different input;
- maps no-device, accepted, partial, timeout, and provider failure results;
- records sanitized audit and delivery results;
- never includes a token in its response or logs.

### PBIA Admin

- hides the action without `Accounts / Edit` permission;
- enforces message length and prevents double submit;
- reuses one idempotency key for retries of the same modal submission;
- renders accepted, partial, no-device, and error states;
- sends account ID/source/message but never an email or token.

Run the PBIA repository checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Run the mobile checks if any mobile or Supabase-owned source changes:

```bash
npm run lint
npm test -- --runInBand
```

## Manual acceptance test

1. Confirm the physical iPhone is signed in and its row is active in `portal_push_devices`.
2. Confirm the PBIA account email matches the mobile login email after trimming and lowercasing.
3. Open that account in PBIA Admin as a staff user with `Accounts / Edit`.
4. Open the send modal and enter a generic test message.
5. Submit once and record the returned PBIA request ID.
6. Confirm Admin reports one matched and accepted device.
7. Verify the notification with the app in the foreground, background, and fully closed.
8. Submit the exact API request again with the same idempotency key and verify that no second notification is sent.
9. Test an account with no registered device and verify the Admin shows a helpful no-device status.
10. Test a staff user without permission and verify both the hidden UI and API `403`.
11. Confirm logs and database records contain no Expo token or secret.

## Receipts and production follow-up

Expo push tickets indicate acceptance by Expo, not device delivery. Expo recommends checking push receipts later; a receipt with `DeviceNotRegistered` means the corresponding Supabase device row should be made inactive.

Do not block the Admin HTTP request while waiting for receipts. Receipt polling, retry policy, and scheduled cleanup require an ADR in PBIA because they introduce background processing. Until that follow-up ships, label the Admin result `Accepted by push service`, keep the rollout limited, and use the physical-device acceptance test to confirm delivery.

Future work can add:

- a receipt worker and invalid-token cleanup;
- safe transient-error retry with exponential backoff;
- notification history and status UI;
- message templates and category preferences;
- Android/FCM credentials and acceptance testing;
- authenticated deep links and generic lock-screen previews;
- renewal and service-update automation with deduplication.

## Official references

- [Supabase: Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase: Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Expo: Send notifications with the Expo Push Service](https://docs.expo.dev/push-notifications/sending-notifications/)
