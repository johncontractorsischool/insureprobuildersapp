# Digital Business Card — Expo Implementation Handoff

## Purpose

Add a subtle digital-business-card feature to the Insure Probuilders Expo app. An authenticated contractor can create a polished public card from their profile information, preview it as they edit, publish it, and share its link or QR code. A homeowner can scan the QR code and open the card without signing in or installing the app.

This handoff recreates the behavior proven in the web prototype while translating it to this repository's Expo Router architecture and green Insure Probuilders visual system. It is an implementation specification, not a request to copy the prototype's Next.js or CSS code directly.

## Product Positioning

The feature should feel useful but secondary to the insurance portal.

- Do not add a fourth bottom tab.
- Add a compact **Digital business card** panel to the Account/Profile screen.
- Show `Not set up`, `Draft`, or `Live` status in that panel.
- Use **Create card** before setup and **Manage card** after setup.
- Open a dedicated stack screen for the editor, preview, and share experience.
- Keep the existing profile, support, and logout actions unchanged.

Recommended placement in `screens/routes/tabs/profile-screen.tsx`:

- Mobile: immediately after the account card and before the support card.
- Desktop web: under the account card in the main column.

## Reference Prototype

The working browser prototype is in the sibling repository:

- `/Users/johnmccants/Desktop/contractor-success/app/screens/digital-card.tsx`
- `/Users/johnmccants/Desktop/contractor-success/app/lib/demo-state.tsx`
- `/Users/johnmccants/Desktop/contractor-success/app/globals.css`

The prototype demonstrates:

1. A single recommended template.
2. A live-editing form and card preview.
3. Image upload with file-size validation.
4. Required-field, email, and website validation.
5. A share screen with public URL, copy action, QR code, and preview.
6. A public card with Call, Email, Website, and configurable primary action.

The Expo version should preserve that workflow while using `theme`, `AppButton`, `AppInput`, `ScreenContainer`, `Ionicons`, and native platform actions from this repository.

## V1 Scope

### Included

- One Insure Probuilders-branded template.
- Three logical steps: **Template**, **Details**, and **Share**.
- Form fields:
  - profile photo or company logo
  - full name
  - professional title
  - company name
  - phone
  - email
  - website
  - short bio, maximum 240 characters
  - service area
  - primary action: `Request a quote`, `Call now`, or `Send an email`
- Prefill from the authenticated `Customer` where values exist.
- Live preview while editing.
- Draft persistence on the device.
- Explicit publish/update action.
- Public, unauthenticated card URL.
- Copy link and native share-sheet actions.
- QR code preview and QR image sharing.
- Public Call, Email, Website, and primary-action controls.
- A native **Save to contacts** action.
- Apple Wallet and Google Wallet entry points after server-side issuer configuration is complete.

### Not included in V1

- Multiple visual templates.
- Custom colors, fonts, or layout editing.
- Lead tracking or QR scan analytics.
- Custom domains per contractor.
- NFC exchange.
- Contact imports without user confirmation.
- Client-side wallet signing or client-bundled signing credentials.

## User Flow

### First-time setup

1. Contractor opens **Account**.
2. Contractor taps **Create card** in the Digital business card panel.
3. The Template step explains the single Insure Probuilders template and shows a populated preview.
4. Contractor taps **Use this template**.
5. The Details step starts with name, company, email, phone, and website values derived from `useAuth().customer`.
6. Contractor adds the remaining fields and optionally selects a photo/logo.
7. Preview updates immediately as fields change.
8. Contractor taps **Save and create card**.
9. Validation runs. A successful save publishes the card and opens Share.
10. The Share step displays the live URL, QR code, preview, and sharing actions.

### Returning contractor

1. The Account panel displays `Live` and the last-updated date.
2. **Manage card** opens directly on Share.
3. Contractor can preview, share, add to a wallet, or tap **Edit details**.
4. Saving an edited live card updates the existing slug rather than creating a new URL.

### Public visitor

1. Visitor scans the QR code or opens the shared HTTPS URL.
2. The card renders without authentication.
3. Visitor can call, email, visit the contractor website, invoke the primary action, or save the contractor to contacts.
4. Invalid or unpublished slugs show a branded not-found state without exposing account data.

## Navigation and Route Design

Add these Expo Router entrypoints:

```text
app/
  digital-card/
    index.tsx               # authenticated builder/manage route
    index.web.tsx           # optional desktop wrapper if needed
  card/
    [slug].tsx              # native preview/deep-link fallback
    [slug].web.tsx          # public browser landing page
```

Keep route files thin and place screen code under:

```text
screens/routes/digital-card/
  digital-card-screen.tsx
  public-digital-card-screen.tsx
```

Register `digital-card/index` in `screens/routes/layouts/root-layout-screen.tsx` with:

- header shown
- title `Digital Business Card`
- existing background and tint tokens

The `/card/[slug]` route must remain public. Do not add it to the protected tab group and do not redirect unauthenticated visitors to login.

The current Expo web configuration uses `web.output: "single"`. The production host must therefore rewrite unknown paths such as `/card/acme-builders-a1b2` to the exported `index.html`; otherwise QR deep links will 404 before Expo Router loads.

## Suggested File Plan

```text
app/digital-card/index.tsx
app/digital-card/index.web.tsx
app/card/[slug].tsx
app/card/[slug].web.tsx
screens/routes/digital-card/digital-card-screen.tsx
screens/routes/digital-card/public-digital-card-screen.tsx
components/digital-card/digital-card-preview.tsx
components/digital-card/digital-card-entry-panel.tsx
components/digital-card/digital-card-stepper.tsx
components/digital-card/digital-card-share-actions.tsx
context/digital-card-context.tsx
hooks/use-digital-card-draft.ts
services/digital-card-api.ts
types/digital-card.ts
utils/digital-card-validation.ts
utils/digital-card-links.ts
supabase/digital_business_cards.sql
supabase/functions/digital-card-apple-wallet/
supabase/functions/digital-card-google-wallet/
tests/screens/digital-card-screen.test.tsx
tests/screens/public-digital-card-screen.test.tsx
tests/context/digital-card-context.test.tsx
tests/services/digital-card-api.test.ts
tests/utils/digital-card-validation.test.ts
```

Do not create every abstraction on day one if it has only one consumer. The important boundaries are shared preview UI, state/API ownership, validation, and wallet signing.

## Data Model

Use a stable generated slug. Do not hardcode a person's name as the prototype does, and do not change the slug when the contractor edits their name or company.

```ts
export type DigitalCardPrimaryAction = 'quote' | 'call' | 'email';
export type DigitalCardStatus = 'draft' | 'published';

export type DigitalBusinessCard = {
  id: string;
  ownerId: string;
  slug: string;
  templateId: 'insurepro-classic';
  status: DigitalCardStatus;
  imageUrl: string | null;
  fullName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  serviceArea: string;
  primaryAction: DigitalCardPrimaryAction;
  publishedAt: string | null;
  updatedAt: string;
};

export type DigitalCardDraft = Omit<
  DigitalBusinessCard,
  'id' | 'ownerId' | 'imageUrl' | 'publishedAt' | 'updatedAt'
> & {
  localImageUri: string | null;
  imageUrl: string | null;
};
```

### Prefill mapping

| Card field | Existing source | Fallback |
| --- | --- | --- |
| `fullName` | `customer.fullName` | first + last name |
| `company` | `customer.commercialName` | empty |
| `phone` | `customer.cellPhone` | `customer.phone` |
| `email` | `customer.email` | authenticated `userEmail` |
| `website` | `customer.website` | empty |
| `serviceArea` | customer city/state | empty |
| title, bio, image, primary action | card record/draft | sensible empty/default values |

Prefill only when creating the first draft. Later profile changes must not silently overwrite a published card.

## Persistence and Backend

### Device draft

Use the existing AsyncStorage dependency for unfinished edits. Suggested key:

```text
digital-business-card-draft-v1:<customer-database-id>
```

Persist normalized form data and the local image URI. Clear the draft only after the published record and image upload both succeed. If the local image URI no longer resolves, retain the form data and ask the user to choose the image again.

### Published record

Use Supabase for the shared source of truth. A recommended `digital_business_cards` table contains:

- `id uuid primary key`
- `owner_id uuid not null references auth.users(id)`
- `slug text unique not null`
- `template_id text not null`
- `status text not null`
- all public display fields
- `image_path text null`
- `published_at timestamptz null`
- `created_at` and `updated_at`

Recommended row-level security:

- authenticated owner can select, insert, and update their own row
- anonymous and authenticated users can select only `status = 'published'`
- no anonymous insert, update, or delete
- one active card per owner for V1

Generate the slug once on the server using a normalized business/name prefix plus a random suffix, for example `acme-builders-a1b2`. The random suffix prevents collisions and makes casual enumeration harder.

### Image storage

Create a dedicated Supabase Storage bucket such as `digital-card-media`.

- Accept JPEG, PNG, or WebP only.
- Enforce a 2 MB client limit and a server/storage policy limit.
- Store files under `<owner-id>/<card-id>/<generated-filename>`.
- Replace old images only after the new upload succeeds.
- Delete abandoned replacements asynchronously.
- A published card needs a durable public image URL or a public rendering service; short-lived signed URLs are not suitable for wallet passes.

## State Ownership

Add `DigitalCardProvider` inside `AuthProvider` in the root layout so the Account panel and builder share load/publish state.

Recommended context contract:

```ts
type DigitalCardContextValue = {
  card: DigitalBusinessCard | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  publish: (draft: DigitalCardDraft) => Promise<DigitalBusinessCard>;
  update: (draft: DigitalCardDraft) => Promise<DigitalBusinessCard>;
};
```

Keep transient form fields and the active wizard step local to `DigitalCardScreen`. The provider owns only persisted server state and its request lifecycle.

On sign-out, clear in-memory card state. Namespace the AsyncStorage draft by customer id so another insured profile cannot see it.

## UI Specification

### Account entry panel

- Small ID-card icon using `Ionicons`.
- Title: `Digital business card`.
- Supporting text: `Create a shareable profile clients can open from a QR code.`
- Status chip: `Not set up`, `Draft`, or `Live`.
- One secondary action: `Create card` or `Manage card`.
- Reuse `theme.colors`, spacing, radii, typography, and surface shadow.

### Template step

- One recommended card named `Insure Pro Classic`.
- Short list of benefits: mobile optimized, direct contact actions, QR sharing.
- Card preview populated from customer data.
- Primary action: `Use this template`.
- Do not render a fake template carousel.

### Details step

- Render inside `ScreenContainer` with `keyboardAware` enabled.
- Group fields into Identity and Contact/action sections.
- Reuse `AppInput`; add a multiline variant only if needed.
- Use `expo-image-picker` for the photo/logo selector.
- Show image requirements before selection and display recoverable permission errors.
- Preview can sit below the form on phones and beside the form on wide web/tablet layouts.
- Save action remains reachable when the keyboard is open.

Validation rules:

- full name and company are required
- at least one valid contact method: phone or email
- validate email only when present
- website is optional, but when present must normalize to an `https://` URL
- bio maximum is 240 characters
- image type and size must be checked before upload
- trim values before persistence
- show one summary error plus field-level messages where applicable

### Share step

- Published status and last-updated timestamp.
- Read-only public URL.
- `Copy link` using `expo-clipboard`.
- `Share card` using React Native's `Share.share`.
- QR rendered from the final HTTPS URL.
- `Share QR image` by capturing the QR component and opening the native share sheet.
- `Preview public card`.
- `Edit details`.
- Wallet actions when configured.

Never encode a localhost URL, app-only deep link, email address, or raw contact record in the QR code. Encode the durable public HTTPS card URL.

### Public card

- Must be mobile-first and visually branded, but should not render the authenticated app shell or bottom tabs.
- Display image/initials, name, title, company, bio, service area, and trust/brand label.
- Call, Email, and Website actions use existing helpers from `utils/external-actions.ts` where possible.
- Hide actions whose values are blank; never render placeholder links such as `#`.
- Primary `quote` action should route to the appropriate public quote experience, not an authenticated-only screen.
- Include `Save to contacts`.
- Include a short `Created with Insure Probuilders` footer.
- Set web metadata for the contractor/company so shared links have useful titles and descriptions.

## Native Packages

Install through `npx expo install` so versions align with Expo SDK 54.

Suggested packages:

- `expo-image-picker` — photo/logo selection
- `expo-clipboard` — copy public URL
- `react-native-svg` and `react-native-qrcode-svg` — QR rendering
- `react-native-view-shot` — convert the QR view to an image
- `expo-sharing` — share the captured QR image
- `expo-contacts` — present the native add-contact form

The standard React Native `Share` and existing `expo-linking` helpers cover link sharing and contact actions. Avoid adding a large third-party state or form library for this isolated workflow.

Add the image-picker permission text through the Expo config/plugin and verify it appears correctly in the generated iOS and Android projects.

## Save to Contacts

On native, call `Contacts.presentFormAsync` with a prefilled contact and let the user confirm the save. Do not write directly to contacts without a visible confirmation flow.

Suggested mapping:

- contact name: `fullName`
- organization: `company`
- job title: `title`
- phone: `phone`
- email: `email`
- URL: public card URL and contractor website
- note: service area and short bio

On web, generate and download a `.vcf` file with the same values. Escape newlines, commas, semicolons, and backslashes according to the vCard format. Do not put untrusted text into raw HTML.

## Apple Wallet and Google Wallet

Wallet support is part of the target experience but must be implemented as a server-backed integration.

### Apple Wallet

- Use a generic Apple Wallet pass.
- The pass should show contractor/company identity and a QR barcode containing the public card URL.
- Add-to-wallet flow first requests a short-lived installation URL, then opens that URL with the system browser. The URL returns a signed `.pkpass` with `Content-Type: application/vnd.apple.pkpass`.
- Store the Apple Pass Type ID, Team ID, signing certificate, private key, and certificate password only as server secrets.
- Never include these values in `EXPO_PUBLIC_*`, `app.json`, the JS bundle, or the repository.
- Open the returned pass URL with the system handler/Safari on iOS so the user sees Apple's confirmation UI.

### Google Wallet

- Use a Google Wallet Generic Pass.
- The pass should include the public card URL as its QR barcode and link back to the card.
- A server/Edge Function creates or references the class/object, signs the save JWT with the service-account credential, and returns the `https://pay.google.com/gp/v/save/<signed-jwt>` URL.
- Store issuer id and service-account credentials as server secrets.
- Demo passes remain test-only until the issuer receives publishing access.

### Wallet API contract

Suggested endpoints:

```text
POST /functions/v1/digital-card-apple-wallet-link
body: { cardId: string }
response: { addUrl: string } # short-lived, opaque installation URL

GET <addUrl>
response: signed application/vnd.apple.pkpass payload

POST /functions/v1/digital-card-google-wallet
body: { cardId: string }
response: { saveUrl: string }
```

The authenticated POST functions must:

- derive ownership from the authenticated Supabase user, not a submitted owner id
- load only the caller's published card
- validate that the public URL uses the approved host
- avoid logging credentials, signed JWTs, certificates, or full contact records
- return stable user-facing error codes for missing configuration and issuance failure

The Apple `addUrl` must expire quickly, be single-purpose, contain no raw contact data, and authorize only delivery of the already-approved pass. This indirection lets Safari/Wallet download the pass without placing the user's long-lived Supabase bearer token in a browser URL.

Device-aware presentation:

- iOS: show **Add to Apple Wallet** first; optionally show Google Wallet as a secondary action when supported.
- Android: show **Add to Google Wallet**.
- Web/other: show the relevant buttons when the user agent supports the flow, otherwise retain link, QR, share, and contact actions.

Do not block card publishing or sharing when wallet providers are unavailable.

## Environment and Configuration

Add only public, non-secret values to Expo runtime configuration:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_DIGITAL_CARD_BASE_URL` | Canonical public origin, for example `https://cards.example.com` |
| `EXPO_PUBLIC_DIGITAL_CARD_TABLE` | Optional table override; default `digital_business_cards` |
| `EXPO_PUBLIC_DIGITAL_CARD_MEDIA_BUCKET` | Optional bucket override; default `digital-card-media` |
| `EXPO_PUBLIC_ENABLE_WALLET_BUTTONS` | Feature flag for UI availability after server setup |

Wallet secrets belong in the server/Edge Function secret manager, never in Expo public environment variables.

Fail closed when `EXPO_PUBLIC_DIGITAL_CARD_BASE_URL` is missing or not HTTPS in production: allow draft editing, but disable publish/QR/wallet actions and explain the configuration issue.

## Accessibility and Platform Behavior

- Give every `Pressable` a meaningful accessibility role and label.
- Keep touch targets at least 44 by 44 points.
- Announce save, publish, copy, and error outcomes.
- Preserve logical focus order on web.
- Label the setup steps and indicate the current step.
- Do not rely on color alone for status.
- Support dynamic text without clipping the preview's contact actions.
- Respect safe areas and keyboard insets.
- Use platform-native confirmation UI for Contacts and Wallet.
- Confirm that phone, email, website, and share actions work on both iOS and Android.

## Error and Offline Behavior

- Loading the Account screen must not fail if the card request fails; show a retryable panel state.
- Draft edits remain available offline through AsyncStorage.
- Publishing requires connectivity and must not clear the draft on failure.
- Image upload and card update should behave as one user-visible operation. If the image succeeds but the row update fails, retain enough state to retry without forcing another image selection.
- Public-card failures should distinguish not found/unpublished from temporary network failure.
- Wallet failures should fall back to normal link/QR sharing.

## Implementation Sequence

### Phase 1 — Local feature shell

1. Add types, validation, draft hook, and prefill mapping.
2. Add Account entry panel and protected stack route.
3. Build the single template, details form, live preview, and local Share step.
4. Add QR, copy, native share, and image selection.
5. Add native Save to contacts.

### Phase 2 — Publishing and public web card

1. Add Supabase schema, RLS, storage policies, and service wrapper.
2. Add provider load/publish/update behavior.
3. Add unauthenticated `/card/[slug]` route and branded not-found state.
4. Configure the production web host for SPA route fallback and HTTPS.
5. Replace local/demo URLs with the canonical public URL.

### Phase 3 — Wallet issuance

1. Configure Apple Pass Type ID and signing certificate.
2. Configure Google Wallet issuer, class, service account, and test users.
3. Implement and test the two server functions.
4. Enable device-aware wallet buttons behind the feature flag.
5. Request/verify production publishing access before general release.

## Testing Plan

### Unit tests

- prefill mapping and fallback order
- email, website, phone, bio, and required-field validation
- URL normalization
- stable slug handling
- AsyncStorage draft key isolation
- public-action URL builders
- API payload mapping and error normalization

### Component and screen tests

- Account panel shows the correct status/action
- new user starts on Template
- published user opens on Share
- template advances to Details
- editing updates the preview
- invalid fields block publish and show accessible errors
- successful publish advances to Share
- copy and share receive the final HTTPS URL
- edit preserves the existing slug
- public card hides missing actions
- unpublished/not-found public card shows the safe empty state
- wallet controls stay hidden or disabled when configuration is unavailable

### Device QA

Test on at least:

- current iPhone simulator and one physical iPhone
- current Android emulator and one physical Android device
- narrow mobile web and desktop web

Verify:

- image permission denied, allowed, replaced, and oversized cases
- keyboard does not cover the save action
- QR scans from a second physical device
- public route opens without authentication
- phone, email, website, quote, share, contact, and wallet actions
- card survives app restart and account reauthentication
- no private card is readable through the anonymous Supabase client
- no horizontal overflow on web
- no secrets or signed wallet tokens appear in logs

Run at minimum:

```bash
npm run lint
npm test
```

For a production release, also run the existing Expo/EAS preview-build workflow for iOS and Android before enabling the feature flag.

## Acceptance Criteria

- The Account tab contains a subtle Digital business card panel and no new bottom tab.
- A contractor can complete the template/details/share flow on iOS and Android.
- Existing customer data prefills the first draft without overwriting later card edits.
- Drafts survive an app restart.
- Publishing produces one stable, public HTTPS URL per contractor.
- The QR code opens that URL on a device that is not authenticated and does not have the app.
- The public card provides only valid, configured actions.
- Contractors can copy/share the link, share the QR, and open the native add-contact form.
- Apple/Google Wallet buttons appear only when their server integrations are configured.
- Wallet credentials never enter the mobile bundle or repository.
- Anonymous users can read published cards only; owners can edit only their own cards.
- Lint and tests pass, and the feature is manually verified on iOS, Android, and web.

## Open Product Decisions

Resolve these before Phase 2 is considered final:

1. What is the canonical public-card domain?
2. Where should `Request a quote` send a homeowner who is not authenticated?
3. Should contractor email and phone both be public by default, or should each have a visibility toggle?
4. Should a contractor be able to unpublish their card while keeping the same slug?
5. Which organization owns the Apple Developer pass certificate and Google Wallet issuer account?
6. Is the Insure Probuilders trust label purely branded, or does it represent a verified eligibility/status rule?

The safe defaults are: explicit publish consent, contact fields visible only when the contractor provides them, stable slug on unpublish/republish, and wallet buttons disabled until issuer ownership is confirmed.
