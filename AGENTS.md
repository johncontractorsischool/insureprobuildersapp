# AGENTS.md

## Purpose

This file gives human and automated coding agents the minimum context needed to work safely and consistently in this repository.

## Project Overview

- Project name: `insureprobuilders`
- Type: Expo + React Native app with Expo Router
- Language: TypeScript with `strict` mode enabled
- Package manager: `npm` (`package-lock.json` is committed)
- Routing: file-based routing under `app/`

## Core Stack

- `expo`
- `react`
- `react-native`
- `expo-router`
- `@react-navigation/*`
- `typescript`
- `eslint-config-expo`

## Common Commands

- Install dependencies: `npm install`
- Start dev server: `npm run start`
- Run on iOS simulator: `npm run ios`
- Run on Android emulator/device: `npm run android`
- Run on web: `npm run web`
- Lint: `npm run lint`
- Reset starter app scaffold: `npm run reset-project`

## Repository Layout

- `app/`: Expo Router screens and route groups
- `app/(auth)/`: authentication flow screens
- `app/(tabs)/`: primary tabbed application screens
- `app/policy/[id].tsx`: policy detail route
- `components/`: reusable UI building blocks
- `constants/`: shared constants, including app theme
- `context/`: React context providers and hooks
- `data/`: local mock data
- `hooks/`: reusable React hooks
- `types/`: shared TypeScript types
- `utils/`: formatting and small utility helpers
- `scripts/`: local project scripts

## Architecture Notes

- The root app shell is defined in `app/_layout.tsx`.
- Authentication state is managed in `context/auth-context.tsx`.
- The visual system is centralized in `constants/theme.ts`.
- Path aliases use `@/*`, so prefer imports like `@/components/app-button`.
- The app currently appears to use local/mock data rather than a live backend.

## Coding Conventions

- Keep changes in TypeScript and React Native style consistent with surrounding code.
- Prefer functional React components.
- Preserve strict typing; do not weaken types to bypass errors.
- Reuse existing theme tokens from `constants/theme.ts` instead of hardcoding new colors, spacing, or typography when possible.
- Prefer shared components over duplicating UI patterns.
- Use the existing `@/` import alias for internal imports where appropriate.
- Keep files focused; avoid large unrelated refactors in the same change.

## Agent Workflow

- Read the relevant files before editing.
- Check for uncommitted changes before making edits and avoid overwriting user work.
- Make the smallest reasonable change that solves the task.
- Update related types, imports, and usages together.
- Run targeted verification after changes when possible.
- If a requested change depends on unclear product behavior, call out the assumption in your final summary.

## Verification Expectations

- Minimum verification for most changes: `npm run lint`
- For UI changes, also validate the affected route in Expo if the environment allows it.
- If you cannot run verification, say so explicitly.

## Notes For Future Contributors

- This repository currently has user changes in progress at times; do not revert unrelated edits.
- There is no dedicated automated test suite configured yet beyond linting, so be cautious with behavioral changes.
- Prefer adding documentation here when new workflows, environments, or deployment steps are introduced.
