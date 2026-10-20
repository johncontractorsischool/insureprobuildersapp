# Policy documents verification gaps

Updated October 20, 2026 for the AMS `insureprobuildersapp-policy-documents-handoff.md` contract.

## Implemented and covered locally

The customer adapter and shared native/web screen use the combined document listing,
source-qualified identity, one-page requests, explicit folder navigation, partial-source
warnings, UUID-aware scope checks, and fresh authorized file-opening URLs. Jest tests
cover HTTP request construction with the real `pbiaRequest` client and mocked fetch,
UI behavior with mocked services, stale requests, retry/close behavior, native temporary-file cleanup, native PDF renderer props, and web iframe/image markup.
Embedded-viewer verification: 414 tests passed across 45 suites. Final targeted cleanup/Expo Go checks also passed. Lint passed without warnings. Web, iOS, and Android JavaScript exports and Expo native-plugin introspection passed. Standalone TypeScript checking retains 24 existing diagnostics outside the document changes. These checks do not establish native compilation, real storage access, or backend deployment.

The subsequent optional external-opening change passed 34 targeted screen/browser tests, including fresh authorization, popup blocking, cancelling pending tabs, preserving exact signed URLs, native browser delegation, retry, and access denial. These tests use mocked browser/native openers; verify actual new-tab and mobile browser behavior during signed-in acceptance.

Desktop-window resizing exposed a route remount at the 960px shell breakpoint. The shell now preserves its route subtree while toggling the sidebar and content width. A regression test failed before the fix and passed afterward, retaining open-document state through 1200px → 390px → 1200px without remounting. All 28 targeted shell/document tests and lint passed. Confirm the real PDF remains visible while resizing the signed-in browser; this check used simulated dimensions rather than a live browser.

## Remaining acceptance

Final pre-commit verification, including the compact document toolbar and resize fix: all 430 tests across 47 suites passed, lint passed, and TypeScript diagnostics matched the 24-error baseline exactly. The toolbar groups Reload/Retry, external opening, and Close above the preview with compact 44px-high buttons. Live browser/device visual verification remains pending.

- Verify the running API includes the AMS combined-list and customer view-URL changes.
  Local app configuration targets `http://localhost:4000`; the handoff says backend
  changes are local and not deployed. Neither source files nor a successful web-page
  response establish the version of that running API.
- In the user's signed-in browser, refresh policy 654345 and confirm both already
  saved PDFs appear. Do not re-upload/delete them to test this.
- Open each saved copy inside MyAccount through the customer endpoint. Verify PDF/image embedding on supported browsers, Close/Reload/Retry controls, and iOS/Android page scrolling/zoom. No authenticated browser session or physical-device acceptance was performed by this implementation. Cross-origin browser PDF failures may require Reload document; native download/render errors offer Retry preview.
- Produce new iOS/Android binaries with the added `react-native-pdf` and `react-native-blob-util` native modules and Expo SDK 54 config plugins. These modules cannot be added to an installed binary by a JavaScript update and are not in Expo Go. Native compilation and store submission have not been performed. App-private preview downloads do not require external-storage permissions; those permissions are explicitly blocked.
- Verify active-policy/account enforcement against real HTTP, partial replica outages,
  and provider-ID deduplication after replica ingestion. Server-side deduplication is
  authoritative; the device only removes repeated stable document keys.
- No additional server, tunnel, simulator, Postman simulation, upload, or migration
  was started: the handoff leaves running services under the user's control. Existing
  Jest checks are retained as the local regression path; live acceptance remains separate.
- Repository-wide TypeScript checking has existing errors in WebView callbacks,
  diagnostics, Supabase Deno functions, and unrelated test mocks. Report these separately
  from changed document code.
