# Repository Map

This file explains every tracked folder and file in the repo and calls out whether each item is part of the active app, infrastructure, or leftover Expo scaffold.

## Root

- `AGENTS.md`: repository-specific coding instructions for human and AI contributors.
- `README.md`: top-level project introduction and quick-start links into `docs/`.
- `app.json`: Expo app configuration, app icons, splash image, routing plugin, and typed-route/react-compiler flags.
- `eas.json`: EAS build profile configuration for development, preview, and production builds.
- `eslint.config.js`: Expo flat-config ESLint setup, currently only ignoring `dist/*`.
- `jest.config.cjs`: Jest configuration for the centralized `tests/` suite, path aliases, and coverage collection.
- `package.json`: npm scripts, runtime dependencies, and dev dependencies.
- `package-lock.json`: npm lockfile; generated dependency snapshot that should not be hand-edited.
- `tsconfig.json`: strict TypeScript config with the `@/*` path alias.

## `app/`

- `app/`: Expo Router route tree and screen entrypoints.
- `app/_layout.tsx`: root stack layout; wraps the app in auth and policy providers and registers PBIA diagnostics.
- `app/index.tsx`: public landing page with hero content and auth entry buttons.

### `app/(auth)/`

- `app/(auth)/`: unauthenticated route group.
- `app/(auth)/_layout.tsx`: redirects authenticated users to tabs and hides auth headers.
- `app/(auth)/login.tsx`: sign-in and sign-up screen; sign-in is live, sign-up is currently local validation only.
- `app/(auth)/verify.tsx`: OTP verification screen, resend cooldown, customer sync, and sign-in completion.

### `app/(tabs)/`

- `app/(tabs)/`: authenticated tab group.
- `app/(tabs)/_layout.tsx`: guards tabs behind auth and configures the bottom tab bar.
- `app/(tabs)/index.tsx`: dashboard screen with account summary, assigned agent, company snapshot, and quick actions.
- `app/(tabs)/policies.tsx`: policy list screen with status filters and navigation to policy detail.
- `app/(tabs)/profile.tsx`: account screen with local-only preference toggles, contact-us shortcut, and sign out.

### `app/company/`

- `app/company/`: company-detail route group.
- `app/company/index.tsx`: expanded CSLB company details screen built from `useCompanyProfile()`.

### `app/forms/`

- `app/forms/`: PBIA intake-form routes.
- `app/forms/index.tsx`: categorized list of PBIA forms from the shared registry.
- `app/forms/[slug].tsx`: form detail screen with browser-first native fallback, embedded WebView option, and diagnostics viewer.

### `app/policy/`

- `app/policy/`: policy drill-down route group.
- `app/policy/[id].tsx`: policy detail screen with coverage, billing, insured summary, and filtered policy-file preview.

### `app/policy-files/`

- `app/policy-files/`: policy-file browser route group.
- `app/policy-files/index.tsx`: breadcrumb-driven folder/file browser backed by the policy-files API.

## `assets/`

- `assets/`: bundled static assets.

### `assets/images/`

- `assets/images/`: icons, splash assets, brand imagery, and agent photos.
- `assets/images/android-icon-background.png`: Android adaptive-icon background image referenced by `app.json`.
- `assets/images/android-icon-foreground.png`: extra Android foreground asset currently not referenced in `app.json`.
- `assets/images/android-icon-monochrome.png`: Android monochrome adaptive-icon asset referenced by `app.json`.
- `assets/images/ariesapcar.jpg`: active dashboard headshot for agent Aries Apcar.
- `assets/images/ariesapcar3.jpg`: unused alternate Aries Apcar image.
- `assets/images/cindycardenas.jpg`: active dashboard headshot for agent Cindy Cardenas.
- `assets/images/favicon.png`: web favicon referenced by `app.json`.
- `assets/images/icon.png`: older Expo icon asset currently not referenced by `app.json`.
- `assets/images/markflorea.jpg`: active dashboard headshot for agent Mark Florea.
- `assets/images/partial-react-logo.png`: Expo starter asset; not used by the portal screens.
- `assets/images/patricianegrete.jpg`: active dashboard headshot for agent Patricia Negrete.
- `assets/images/pbiaicon.png`: extra PBIA brand asset currently unused in code.
- `assets/images/pbiaicon.svg`: SVG version of the PBIA icon, currently unused in the app runtime.
- `assets/images/pbialogo.png`: main portal logo used by `BrandMark` and Expo app icon config.
- `assets/images/react-logo.png`: Expo starter asset; unused.
- `assets/images/react-logo@2x.png`: Expo starter asset; unused.
- `assets/images/react-logo@3x.png`: Expo starter asset; unused.
- `assets/images/splash-icon.png`: splash-screen image referenced by `app.json`.

## `components/`

- `components/`: shared UI building blocks.
- `components/app-button.tsx`: shared button component with `primary`, `secondary`, `ghost`, and `danger` variants.
- `components/app-input.tsx`: labeled text-input wrapper with icon, helper text, and error handling.
- `components/brand-mark.tsx`: logo + wordmark component for landing and auth screens.
- `components/empty-state.tsx`: reusable empty/error card with optional action button.
- `components/external-link.tsx`: Expo starter helper for opening links in an in-app browser on native; currently unused.
- `components/haptic-tab.tsx`: Expo starter tab-button helper that adds iOS haptics; currently unused.
- `components/hello-wave.tsx`: Expo starter animated wave component; currently unused.
- `components/loading-state.tsx`: reusable loading/skeleton card.
- `components/otp-input.tsx`: multi-cell OTP input with paste-like digit spreading and backspace focus behavior.
- `components/parallax-scroll-view.tsx`: Expo starter parallax container built on Reanimated; currently unused.
- `components/pbia-form-webview.tsx`: hardened PBIA WebView wrapper with diagnostics, retry UI, optional bridge, and process-failure logging.
- `components/policy-card.tsx`: summary card for policies in the policies tab.
- `components/screen-container.tsx`: standard screen shell with Safe Area handling, width constraints, scroll option, and decorative background glows.
- `components/section-header.tsx`: consistent section heading with optional action link.
- `components/summary-card.tsx`: generic summary metric card; currently unused by live screens.
- `components/themed-text.tsx`: Expo starter themed text helper; only used by the `components/ui/` starter components.
- `components/themed-view.tsx`: Expo starter themed view helper; only used by the `components/ui/` starter components.

### `components/ui/`

- `components/ui/`: Expo starter UI helpers that are not part of the current portal screens.
- `components/ui/collapsible.tsx`: expandable content container using themed starter components.
- `components/ui/icon-symbol.ios.tsx`: iOS SF Symbols wrapper for the starter icon abstraction.
- `components/ui/icon-symbol.tsx`: Android/web Material Icons fallback for the starter icon abstraction.

## `constants/`

- `constants/`: shared design tokens and static registries.
- `constants/pbia-forms.ts`: PBIA form slug registry, titles, URL builders, and slug lookup helpers.
- `constants/theme.ts`: design tokens for colors, spacing, typography, shadows, layout widths, and compatibility color exports.

## `context/`

- `context/`: React context providers for cross-screen state.
- `context/auth-context.tsx`: session hydration, auth state, pending email, cached customer profile, and sign-out handling.
- `context/policies-context.tsx`: authenticated policy loading, refresh behavior, and policy error state.

## `data/`

- `data/`: local sample data and stubs.
- `data/mock-policies.ts`: hard-coded sample policies; useful for development reference but not wired into the live provider flow.

## `docs/`

- `docs/`: canonical project documentation folder.
- `docs/README.md`: docs index that points readers to architecture, flows, integrations, and repository reference.

### `docs/architecture/`

- `docs/architecture/`: runtime and integration documentation.
- `docs/architecture/app-overview.md`: high-level architecture, route tree, state ownership, and major app behavior.
- `docs/architecture/integrations-and-env.md`: env vars, API endpoints, Supabase usage, AsyncStorage keys, and external-link behavior.
- `docs/architecture/user-flows.md`: end-to-end auth, dashboard, policy, company, forms, and sign-out flows.

### `docs/reference/`

- `docs/reference/`: detailed repository reference materials.
- `docs/reference/repository-map.md`: file-by-file and folder-by-folder explanation of the tracked repo.

## `hooks/`

- `hooks/`: shared React hooks.
- `hooks/use-color-scheme.ts`: thin native re-export of React Native's color-scheme hook.
- `hooks/use-color-scheme.web.ts`: web-safe color-scheme hook that waits for client hydration before trusting the browser value.
- `hooks/use-company-profile.ts`: CSLB data loader and formatter for dashboard/company detail UI.
- `hooks/use-theme-color.ts`: Expo starter helper for themed color lookup; mainly used by leftover themed components.

## `scripts/`

- `scripts/`: local utility scripts.
- `scripts/reset-project.js`: legacy Expo scaffold reset script that can wipe or archive starter folders and recreate a blank `app/`.

## `services/`

- `services/`: integrations, network clients, and service-layer helpers.
- `services/agent-api.ts`: insured-agent API client used by the dashboard.
- `services/auth-flow.ts`: auth helpers for OTP send/verify, customer persistence, and customer-profile mapping.
- `services/cslb-api.ts`: CSLB API client plus payload normalization and CSLB URL builder.
- `services/customer-api.ts`: customer lookup client by email address.
- `services/pbia-webview-diagnostics.ts`: AsyncStorage-backed PBIA diagnostic logging, active-session recovery, and global JS error capture.
- `services/policy-api.ts`: policy lookup client plus normalization into the shared `Policy` type.
- `services/policy-files-api.ts`: policy-files API client plus response parsing for both root and folder requests.
- `services/portal-config.ts`: env-backed fallback config for agent, company, and action URLs.
- `services/supabase.ts`: singleton Supabase client factory with AsyncStorage-backed auth persistence.

## `supabase/`

- `supabase/`: SQL and related backend setup artifacts for the portal's Supabase side.
- `supabase/portal_customers.sql`: creates the cached customer table and row-level-security policies used by auth/customer hydration.

## `types/`

- `types/`: shared TypeScript model definitions.
- `types/customer.ts`: customer and customer-lookup shapes.
- `types/policy-file.ts`: policy-file API response shapes and folder/file model.
- `types/policy.ts`: normalized policy model used across UI and services.

## `tests/`

- `tests/`: centralized professional test suite covering services, contexts, hooks, components, and critical route screens.
- `tests/factories.ts`: shared test data builders for customers, policies, and policy files.
- `tests/setup.ts`: global Jest setup for AsyncStorage, safe-area mocks, icon stubs, and common test environment defaults.

### `tests/components/`

- `tests/components/`: component-level tests for shared UI and integration wrappers.
- `tests/components/pbia-form-webview.test.tsx`: verifies PBIA WebView session startup, bridge navigation, and retry behavior.

### `tests/context/`

- `tests/context/`: provider tests for cross-screen state containers.
- `tests/context/auth-context.test.tsx`: covers session hydration, completeSignIn, and signOut behavior.
- `tests/context/policies-context.test.tsx`: covers policy loading and missing-database-id handling.

### `tests/hooks/`

- `tests/hooks/`: hook-focused tests for derived state and service formatting.
- `tests/hooks/use-company-profile.test.tsx`: covers CSLB mapping, status chips, and fallback behavior.

### `tests/mocks/`

- `tests/mocks/`: reusable test doubles and support mocks.
- `tests/mocks/expo-router.tsx`: reusable Expo Router mock helper kept for future tests, even though some screen tests now inline their router mocks.

### `tests/screens/`

- `tests/screens/`: route-screen tests for the highest-signal user flows.
- `tests/screens/login-screen.test.tsx`: covers sign-in success, missing-account validation, and OTP rate-limit routing.
- `tests/screens/policies-screen.test.tsx`: covers policy filtering and policy-detail navigation.
- `tests/screens/policy-files-screen.test.tsx`: covers folder traversal and file-open actions in the policy-files browser.
- `tests/screens/verify-screen.test.tsx`: covers OTP verification, login redirect, and rate-limit hint messaging.

### `tests/services/`

- `tests/services/`: unit tests for env normalization, payload mapping, and diagnostic persistence.
- `tests/services/cslb-api.test.ts`: covers CSLB URL building and payload normalization.
- `tests/services/pbia-webview-diagnostics.test.ts`: covers diagnostic storage, recovery, and clearing behavior.
- `tests/services/policy-api.test.ts`: covers policy payload mapping and invalid-format handling.
- `tests/services/policy-files-api.test.ts`: covers file response parsing and missing-id validation.
- `tests/services/portal-config.test.ts`: covers env-driven fallback configuration normalization.

## `utils/`

- `utils/`: small pure helpers and side-effect wrappers.
- `utils/external-actions.ts`: phone/email/SMS link builders and safe external/in-app browser open helpers.
- `utils/format.ts`: currency, date, datetime, and customer-name formatting helpers.

## Cross-Cutting Notes

- Active runtime-critical areas:
  - `app/`
  - `context/`
  - `services/`
  - `hooks/use-company-profile.ts`
  - `constants/`
  - core shared components in `components/`
- Leftover scaffold areas still tracked for reference:
  - `components/external-link.tsx`
  - `components/haptic-tab.tsx`
  - `components/hello-wave.tsx`
  - `components/parallax-scroll-view.tsx`
  - `components/summary-card.tsx`
  - `components/themed-text.tsx`
  - `components/themed-view.tsx`
  - `components/ui/*`
  - `data/mock-policies.ts`
  - several unused image assets in `assets/images/`
