# Push Notifications

## Current Milestone: Basic iPhone Push Notification

Start with one end-to-end iPhone push test using Expo's Push Notification Tool, then persist each signed-in customer's Expo token in Supabase. This milestone still excludes automated sending, an inbox, preferences, Android, and renewal reminders.

### Implementation

- Install `expo-notifications` and `expo-device`.
- Add the Expo notifications config plugin.
- Configure APNs credentials through EAS for `com.johncontractorsischool.insureprobuilders`.
- On a physical iPhone development build:
  - request notification permission;
  - obtain an Expo push token using the configured EAS project ID;
  - display notifications received while the app is open; and
  - report permission, device, configuration, and registration problems without crashing.
- Show a development-only Push Test card on the Account screen with registration status, the token, and a Copy Token button.
- Notification taps only open the app. Deep linking is deferred.
- Send the test through the [Expo Push Notification Tool](https://expo.dev/notifications) with:
  - title: `Insure Probuilders`
  - body: `Push notifications are working.`

### Verification

1. Create and install an EAS development build on a physical iPhone.
2. Sign in, grant notification permission, and copy the token from Account.
3. Send the test notification and verify it while the app is open, backgrounded, and fully closed.
4. Deny permission once and confirm Account shows a helpful status.
5. Run `npm run lint` and `npm test -- --runInBand`.

### Supabase Device Registration

Apply `supabase/portal_push_devices.sql` in the Supabase SQL Editor before testing token persistence. After a signed-in customer grants permission and the app obtains an Expo token, the app automatically upserts that token into `portal_push_devices` using the authenticated Supabase session.

Each row records the authenticated user ID and login email, Expo project and token, basic device metadata, active state, and last-seen timestamps. Row Level Security restricts customers to their own rows. The app never uses a service-role key.

Registration is idempotent: later app launches refresh the same row's device metadata and `last_seen_at` timestamp. Permission denial and save failures do not block sign-in or crash the app. During development, successful registration also displays `Saved to Supabase for this signed-in customer.` on the Push Test card. Sending notifications from Supabase is intentionally deferred.

The next implementation phase is specified in the [PBIA custom push notification handoff](../reference/pbia-custom-push-notification-handoff.md). It connects the PBIA Admin account screen to a secured NestJS endpoint and Supabase Edge Function without exposing privileged keys or device tokens to the browser.

### APNs Credential Setup

The native code and app configuration are stored in this repository, but APNs credentials live in the Expo/Apple accounts and cannot be committed. Before building:

1. Sign in to the Expo account that owns EAS project `d4d7849a-ade7-4fee-bb49-2c38ec0a3cff`.
2. Run `eas credentials --platform ios` and configure a Push Notifications key for the existing bundle identifier.
3. Run `eas build --profile development --platform ios` and register the physical test device when prompted.

## Deferred Roadmap

Once the basic delivery test is reliable, revisit:

- Android and FCM support.
- Automated or bulk sending beyond the secured one-customer Edge Function handoff.
- An in-app notification inbox and unread badge.
- Renewal reminders 60, 30, and 7 days before expiration.
- Staff-triggered service updates.
- Category preferences, delivery receipts, retries, and invalid-token cleanup.
- Generic lock-screen copy with authenticated policy deep links.

For the larger design, notifications should be durable in the app, use server-only credentials, support multiple devices, respect category preferences, deduplicate renewal reminders, and remove tokens when Expo reports `DeviceNotRegistered`.

## Assumptions

- The first acceptance target is one physical iPhone; simulators are not supported.
- Test notifications are sent manually through Expo's web tool.
- The Push Test card is excluded from production builds.
- APNs/EAS account configuration must be completed by an authorized account owner.
