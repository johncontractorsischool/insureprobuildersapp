# Testing and Validation

This project now has a centralized test harness under `tests/` so contributors and agents can run one command and quickly see where regressions are concentrated. The setup is intended to be practical for a React Native Expo app: test business logic heavily, test screen behavior at the boundaries that matter, and isolate native or network dependencies with explicit mocks.

## Test Stack

- `jest` is the test runner
- `jest-expo` provides the Expo-aware preset
- `@testing-library/react-native` drives component and screen assertions
- `react-test-renderer` supports the React Native test environment

## Folder Strategy

All automated tests live in the root `tests/` folder. That keeps validation discoverable and gives agents one place to inspect when looking for failures, missing coverage, or existing patterns.

Current structure:

- `tests/screens/` covers route-level behavior and navigation outcomes
- `tests/context/` covers provider state, async hydration, and mutations
- `tests/services/` covers API wrappers, URL construction, and error handling
- `tests/components/` covers higher-risk reusable UI logic
- `tests/hooks/` covers standalone hook behavior
- `tests/mocks/` stores reusable mocks for framework integrations
- `tests/factories.ts` centralizes realistic mock data creation
- `tests/setup.ts` installs global mocks and shared test environment behavior

## What The Suite Covers

The current suite focuses on the app paths that are most likely to break in normal development:

- auth state transitions and session hydration
- OTP login and verification flows
- policy list loading and policy file navigation
- company profile hook behavior
- PBIA form launch and diagnostic helpers
- service-layer request construction and fallback logic

This is intentionally not snapshot-heavy. The tests favor visible behavior, state transitions, navigation side effects, and network-boundary assertions over brittle implementation details.

## Running Validation

- `npm run lint` checks TypeScript/Expo lint rules
- `npm test` runs the full Jest suite from the single `tests/` folder
- `npm run test:coverage` generates a coverage report so weak areas are obvious

Coverage output is written to `coverage/` and is ignored by Git.

## Maintenance Rules

- Add new tests under `tests/`, not beside production files
- Mirror the app structure when creating new test subfolders
- Mock framework or network edges at the boundary, not deep inside the logic under test
- Prefer factory helpers over ad hoc inline mock objects when data shapes are reused
- When a bug is fixed, add or extend a test that would have caught it
- Keep the suite fast enough to run before every handoff

## Gaps To Expect

The suite is a strong foundation, not a claim that every screen is exhaustively covered. Coverage reports currently point to remaining gaps in less critical or still-evolving areas such as some dashboard paths, company screens, and a few scaffold-derived components. Those gaps are visible by design so future work can target them deliberately.
