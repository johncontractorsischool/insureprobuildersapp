# Documentation Hub

This `docs/` folder is the project's documentation home. It is organized so a new contributor can start with the app architecture, follow the major runtime flows, then drill into the full repository reference.

## Start Here

- [Architecture Overview](architecture/app-overview.md): app purpose, route tree, state ownership, and major runtime behavior
- [User Flows](architecture/user-flows.md): step-by-step navigation, auth, data hydration, and failure handling
- [Integrations and Environment](architecture/integrations-and-env.md): env vars, APIs, Supabase usage, AsyncStorage keys, and external actions
- [Testing and Validation](architecture/testing-and-validation.md): Jest setup, test folder strategy, coverage workflow, and maintenance expectations
- [Repository Map](reference/repository-map.md): every tracked folder and file with its purpose and current role

## Documentation Rules

- Update these docs when adding routes, services, env vars, or shared modules.
- Keep file-purpose notes accurate; mark leftover or unused scaffold files clearly instead of removing that context.
- Prefer linking back into this folder from future docs rather than scattering standalone markdown files across the repo.
