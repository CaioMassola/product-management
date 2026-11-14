# Validation evidence

## Coverage verification — November 14, 2026

- Frontend: 110 passing tests; V8 measured 622/622 statements, 527/527 branches, 241/241 functions and 579/579 lines. All 47 executable application files reached 100%, enforced per file.
- Backend: 69 passing tests, zero failures/errors/skips with real PostgreSQL enabled in a new dedicated temporary database. JaCoCo measured 100% instructions, branches, methods, lines and classes across 41 classes; all per-class coverage checks passed. Coverage data starts fresh on every JVM test run.
- PostgreSQL verification created and removed only its randomly named coverage database. Application products were preserved.
- Strict TypeScript, ESLint, formatting verification and production build passed.
- Tests include image codec boundaries, storage exceptions, concurrent lazy-client initialization, duplicate-code handling, absent image records, report lookup/download contracts, outbox claim races, stale processing tokens, healthy/failed heartbeats, lease loss at different processing phases, uncertain completion commits, cleanup failures, worksheet rollover and seed behavior.
- Error helper methods now return typed exceptions that callers explicitly throw. This makes exceptional control flow clear to both Java and coverage instrumentation; HTTP statuses and feedback remain the same. A package-private worksheet row limit allows bounded rollover tests while the public production constructor retains Excel's 1,048,576-row limit.
- See [coverage usage and scope](COVERAGE.md) for commands and reports. Earlier stage totals below are historical snapshots.

## Stage 2

- Spring Boot 4.1.2 dependencies resolved from Maven Central.
- Java sources compile with `--release 21`; the available local runtime is Java 26.0.1. The Docker build/runtime target Java 21.
- Nine HTTP integration tests passed with a random-port Spring Boot server and H2 in PostgreSQL compatibility mode: create/default status, inactivation/reactivation and persistence, code reservation, combined filters/paging, literal wildcard search, invalid inputs, invalid filters/status, editing without implicit status changes, missing resources, unsupported DELETE and structured validation errors.
- Final Maven `verify` completed successfully and produced the executable backend JAR. Test summary: 10 discovered, 9 passed, 1 optional PostgreSQL test skipped.
- `docker compose --env-file .env.example config --quiet` passed configuration validation; this does not verify image pulls or service startup.
- An optional PostgreSQL integration test verifies the real Flyway migration, 10,000-row seed, category distribution, inactive/active counts, seed idempotence and database constraints. It runs only when `PRODUCT_MANAGEMENT_TEST_DATABASE_URL` is explicitly supplied.
- Docker daemon was unavailable in this session. PostgreSQL migrations, the PostgreSQL-specific seed, container startup and RabbitMQ/MinIO availability have not been verified at runtime.
- H2 tests do not substitute for those PostgreSQL checks. Frontend, image storage and report processing are not implemented in stage 2.

## Stage 3

- Next.js production build completed successfully with standalone output. TypeScript strict checks and ESLint passed.
- Frontend: 15 passing tests covering monetary/form validation, default ACTIVE requests, combined search/category/status/price filtering, inactivation confirmation, API connection errors, required-field validation and retry after partial image-upload failure without duplicate creation.
- Backend: Maven `verify` passed. Latest summary: 16 discovered, 15 passed, 1 optional PostgreSQL test skipped. New coverage includes image validation, replacement/removal, rollback compensation, image-specific CORS and rejection of product status in creation payloads.
- The MinIO SDK integration compiles. Image service tests use an in-memory storage adapter to exercise real transactions and validation; they do not certify MinIO server behavior.
- Browser verification used the actual Spring Boot API on an explicitly temporary H2 database. Verified create, edit, detail, confirmation before inactivation, reactivation, combined filters, pt-BR/en/es switching, theme persistence across reload, mobile navigation, form errors and cancellation confirmation with keyboard focus/Escape.
- Compared the desktop product screen at 1440 x 900 with the latest Figma light/dark references. Inter is bundled locally, colors/layout follow the reference and Lucide replaces decorative prototype glyphs. Product status defaults to ACTIVE and separate monetary bounds follow the specification. Table rows reflect actual API data instead of prototype sample rows.
- Browser checks at 390 x 844 found no document-level horizontal overflow on product list or form pages; tables have their own horizontal scrolling region. Confirmation dialogs trap focus and close with Escape.
- The final inspected product page had no browser console errors. Dependency audit reported zero known vulnerabilities after applying the scoped development dependency override.
- Updated Compose configuration passed `docker compose --env-file .env.example config --quiet` with all five declared services.
- Docker daemon remained unavailable. Container builds/startup, PostgreSQL migrations/seed and actual MinIO upload/download remain unverified. The temporary browser database is not persistent and is not a production fallback.
- XLSX exports and the report center remain future stages. Their controls are disabled rather than simulating completed exports.

## Stage 4

- Backend verification: **27 tests passed, zero failures/errors/skips**, including the PostgreSQL test enabled with explicit local test credentials. Frontend: **19 tests passed**; ESLint, strict TypeScript and production build passed.
- New backend coverage includes 202 requests and transactional outbox persistence, invalid criteria, default export of active/inactive products, combined filters, inactive-only and empty exports, actual XLSX cell types, 1,201-row multi-batch export, completed download, bounded retries, sanitized failures, temporary file/object cleanup, expired-lease recovery, stale-worker fencing, concurrent deliveries, concurrent filename allocation and publisher confirms/returns.
- New frontend coverage includes independent ALL-status defaults, empty-filter requests, monetary range rejection, frozen combined request payloads, translated request failures, persistent tracking and completion-only download controls.
- Started Docker Desktop and provisioned the project's PostgreSQL, RabbitMQ and source-built MinIO. The former public MinIO image was unavailable; `infra/minio/Dockerfile` now builds the pinned official source release. All three infrastructure containers passed their health checks.
- Applied both Flyway migrations to real PostgreSQL 18.7. The isolated PostgreSQL test inserted 10,000 seed products, verified rerunning inserted zero duplicates and generated/read back a 10,000-product XLSX. Its random test schema was removed afterward.
- Real pipeline verification passed through the running API, RabbitMQ and MinIO for active-filtered, inactive-only and unfiltered reports. Downloaded files were opened as ZIP/XLSX and their product codes verified by `scripts/verify-report-pipeline.ps1`.
- Real broker outage test: stopped only this project's RabbitMQ, accepted an export request in **92 ms** with status PENDING, restarted the broker and observed the same report complete successfully.
- Built and started all five Compose services, including Next.js standalone output and the backend on Temurin **Java 21.0.13**. Repeated the real export/download script successfully against the containerized backend.
- Production-browser verification: export dialog defaults, combined request, job completion, actual browser download, tracking after reload, dark theme and mobile layout. The dialog measures 878 x 666 pixels on desktop, matching the current Figma frame; at 390 x 844 it scrolls internally with no document-level horizontal overflow. The inspected production page had zero console errors/warnings.
- An additional 6.5-second browser observation after completion recorded zero report polling requests.
- This checkout uses ignored local configuration for API port **8180**, preserving the unrelated price-alert-bot on 8080. Local service credentials are generated in the ignored `.env` file and were not printed or committed.
- Explicit verification sample products and completed reports remain in the development database. No products were physically deleted. Source paths, logs and downloaded workbooks used for verification are documented in `docs/REPORTS.md`.
- The full report-history page and its list/filter endpoint remain stage 5. The export dialog, durable processing, per-report status endpoint and downloads are implemented.

## Stage 5

- Automated checks: **33 backend tests and 27 frontend tests passed** (60 total). The backend run enabled the PostgreSQL integration check and had no skipped tests. Frontend ESLint, strict TypeScript and the Next.js production build passed.
- New backend coverage verifies history paging/sorting with equal timestamps, combined processing/product criteria, exact saved monetary bounds, inclusive-start/exclusive-end request dates, escaped filename wildcards, parameterized lookup, invalid enums/prices/dates/paging/sorting and the global active count when result filters hide unfinished work.
- New frontend coverage verifies displayed frozen criteria (including a zero lower price), completed-only downloads, combined query payloads, whole-calendar-day bounds, unavailable download states, safe failure text, processing details, keyboard focus restoration after closing details and selective polling with an empty filtered page.
- Deployed the updated backend and standalone Next.js frontend to the existing local Compose services. Real PostgreSQL-backed history queries returned the expected saved criteria and completed attachment downloads.
- Production-browser checks covered 10-row paging with a disjoint second page, filtering on a complete local day in America/Sao_Paulo, adding a new report from the center, its ALL-status export default, automatic insertion into history, processing details and a real XLSX browser download.
- Paused only the project's RabbitMQ and created a PENDING report outside the current browser. With the central filter set to COMPLETED, the API reported `activeCount=1` while returning only completed rows; the browser made two list polling requests over 6.5 seconds. After restoring RabbitMQ, the same job completed, the count reached zero and a subsequent 6.5-second observation recorded zero list polling requests.
- Verified pt-BR/en/es central headings and controls, active sidebar navigation, mobile navigation and no document-level horizontal overflow at 390 x 844. The table scrolls within its own container. Floating job tracking is hidden on the full history page while its query observers remain active.
- Existing report-processing, uniqueness, seed and product tests remain passing. No schema migration was needed: stage 4 already persisted the searchable criteria and relevant ordering/status indexes.
- A pre-existing `/favicon.ico` 404 remains for the final polish stage; the verified report flows had no application JavaScript failure.
- Stage 6 remains the comprehensive visual/accessibility and documentation finish. Report history, filters, paging, processing details, selective updates and downloads are implemented.

## Stage 6 / final review

- Final automated verification passed **33 backend tests with zero skips** (real PostgreSQL enabled) and **32 frontend tests**, for **65 passing tests**. ESLint, strict TypeScript and production builds passed.
- The accessibility audit found and corrected secondary-text contrast in light mode and primary text/button contrast in dark mode. Secondary light text now has 4.78:1 contrast on inset backgrounds; dark primary text has 5.54:1 on inset backgrounds; dark primary buttons retain white labels at 4.85:1. Shared tokens preserve the reference layout and palette while satisfying the requested contrast support.
- axe-core browser scans found zero WCAG A/AA violations on products, new-product form, report center and preferences in both light and dark modes (eight page/theme combinations). Tested inactivation and export dialogs also had zero findings. These automated checks do not replace all manual accessibility review or constitute certification.
- Confirmation dialogs now initially focus Cancel, prevent dismissal during an in-flight mutation and return focus when dismissed. New regression tests cover focus behavior, busy state and structural accessibility. Browser verification confirmed Escape/focus restoration and safe draft preservation/discard through the product form's Back and Cancel controls.
- New tests verify Portuguese comma-decimal editing with a numeric API payload. Browser checks confirmed pt-BR/es comma placeholders, en decimal-point placeholders, localized page titles, selected-theme ARIA state and a localized HTTP 404 response.
- The code-native SVG icon is bundled by Next.js; `/favicon.ico` redirects to it and returned HTTP 200 with the correct image type. The favicon error recorded in stage 5 is resolved.
- Responsive checks found no document-level horizontal overflow on the four main pages at 390, 768 and 1440 pixels. Tables retain their own horizontal scroll region.
- Verified real PNG image upload, replacement (16-pixel fixture to 32-pixel fixture), retrieval and removal through the browser, Spring Boot and MinIO. All image mutations returned 200 and the product record remained after image removal. Inactivation/reactivation also passed against the real API.
- Corrected one-shot seed operation after adding background report consumers. The seed profile now disables web/report runtime work and the main method closes its context afterward. `scripts/verify-seed.ps1` ran the actual Java 21 container command twice in a uniquely named temporary database: first run inserted 10,000, second inserted zero, final count stayed 10,000, both commands exited and the verification database was dropped. Application records were untouched by this check.
- `npm start` now launches the generated standalone server with copied static assets, matching the configured build output. A temporary local production instance on port 3100 served the translated page, Inter CSS and application icon successfully; that verification process was stopped afterward.
- Updated operational documentation preserves existing environment files and records local API port 8180, seed execution, data persistence, report behavior and tested limits. All six stages are complete; the five local Compose services are retained for use.

## Optional PostgreSQL check

Provide an isolated test database, then set these process environment variables before running `mvnw.cmd verify`:

```text
PRODUCT_MANAGEMENT_TEST_DATABASE_URL=jdbc:postgresql://localhost:5433/product_management_test
PRODUCT_MANAGEMENT_TEST_DATABASE_USER=product_management
PRODUCT_MANAGEMENT_TEST_DATABASE_PASSWORD=<local test password>
```

The test creates a random `pm_test_...` schema, applies the actual migration and removes only that schema afterward. The configured user needs schema creation permission. It does not run against PostgreSQL unless explicitly enabled.
