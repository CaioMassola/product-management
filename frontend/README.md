# Product Management frontend

Next.js App Router, React, TypeScript strict, Tailwind CSS, TanStack Query, React Hook Form, Zod, next-intl, next-themes and Lucide. Radix Dialog provides accessible confirmations and the mobile navigation drawer. Inter fonts are bundled locally.

## Development

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` to customize `NEXT_PUBLIC_API_URL`. Open `http://localhost:3000/pt-BR/products` with the backend running at the configured address. An unavailable API produces an explicit connection error and retry control; there is no demo-data fallback in the application.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm start` after building for a local production server. The launcher copies the built static assets into the standalone directory and starts Next.js's generated server, binding to loopback by default. Set `PORT` or `PRODUCT_MANAGEMENT_HOST` explicitly when another binding is needed, and align backend CORS with the actual browser origin. Docker uses its own standalone startup. `NEXT_PUBLIC_API_URL` is embedded during the build and must reference the browser-accessible backend, not a Docker-internal hostname.

## Organization

- `src/app/[locale]`: server route/layout components.
- `src/components`: reusable controls, accessible dialogs, layout and preferences.
- `src/features/products`: typed API calls, query hooks, validation and product screens.
- `src/features/reports`: export dialog, persistent job tracking, history filters/paging, report details and completion-only downloads.
- `src/i18n` and `src/messages`: routing and pt-BR/en/es translations.
- `src/lib`: shared HTTP/error handling.
- `src/providers`: query cache, theme provider and localized notifications.

Application state is backed by Spring Boot. No Next.js API route implements business rules. The frontend never retrieves all products to filter or paginate them locally. See the root README for product API and image contracts.

The report center is available at `/pt-BR/reports` (also `/en/reports` and `/es/reports`). Its filters and paging execute in the backend. History updates while the API reports any active work, even if its rows are outside the visible page or filters, and stops when the active count reaches zero. Request dates use local calendar boundaries converted to ISO instants; displayed report timestamps use the same browser timezone.

The final interface includes localized page titles and 404/error states, a code-native application icon, locale-aware money inputs, selected-theme state and keyboard-friendly confirmations. Light-theme secondary text and dark-theme text/button colors use separate tokens to maintain AA contrast while retaining the reference palette. axe-core supports structural regression checks and the browser accessibility audit; actual contrast checks run in the browser, not jsdom.

## Code formatting

Coverage is available with `npm run test:coverage`. It requires 100% statements, branches, functions and lines per application file and generates `coverage/index.html`. See [coverage scope and backend commands](../docs/COVERAGE.md).

Run `npm run format` to format the frontend and `npm run format:check` to verify it. The formatter applies Prettier followed by ESLint's project-specific spacing rules: two-space indentation, spaces inside named imports, single quotes, every JSX property on a separate line, and blank lines between logical blocks, helper functions and rendering returns. The recommended VS Code Prettier and ESLint extensions apply the same sequence on save when this frontend folder is opened as the workspace.

## Dependency notes

The lockfile records exact resolved versions. A scoped minimatch override applies the patched release to the TypeScript ESLint dependency tree; lint and tests were checked with that override. Vitest uses its own bundler internally for tests; the application runtime and build use Next.js.
