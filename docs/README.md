# Documentation Hub

This `docs/` folder is the project's documentation home. It is organized so a new contributor can start with the app architecture, follow the major runtime flows, then drill into the full repository reference.

## Start Here

- [Architecture Overview](architecture/app-overview.md): app purpose, route tree, state ownership, and major runtime behavior
- [User Flows](architecture/user-flows.md): step-by-step navigation, auth, data hydration, and failure handling
- [Integrations and Environment](architecture/integrations-and-env.md): env vars, APIs, Supabase usage, AsyncStorage keys, and external actions
- [Testing and Validation](architecture/testing-and-validation.md): Jest setup, test folder strategy, coverage workflow, and maintenance expectations
- [Repository Map](reference/repository-map.md): every tracked folder and file with its purpose and current role
- [PBIA MyAccount Resolution API Handoff](reference/pbia-myaccount-resolution-api-handoff.md): backend specification for authenticated account resolution during sign-in and sign-up
- [Push Notifications](handoffs/push-notifications.md): iPhone smoke-test setup and deferred notification roadmap
- [PBIA Custom Push Notification Handoff](reference/pbia-custom-push-notification-handoff.md): secured Admin-to-Nest-to-Supabase design for sending a generic message to one customer's registered devices
- [Digital Business Card Handoff](handoffs/digital-business-card.md): implementation specification for the Expo card builder, public QR landing page, contact sharing, and wallet integrations

## Documentation Rules

- Update these docs when adding routes, services, env vars, or shared modules.
- Keep file-purpose notes accurate; mark leftover or unused scaffold files clearly instead of removing that context.
- Prefer linking back into this folder from future docs rather than scattering standalone markdown files across the repo.
