# Product Management

Product catalog management with a Next.js App Router frontend and a Java 21 / Spring Boot REST API, following the supplied specification and Figma prototype. Asynchronous XLSX exports run through RabbitMQ and private MinIO storage.

All code identifiers and documentation are English. The frontend supports pt-BR, en and es, with Portuguese as the initial language.

## Features

- Product creation, details, editing, inactivation and reactivation; inactive product codes remain reserved and products are never physically deleted.
- Backend pagination, sorting, debounced search and combined category/status/price filters across ten fixed categories.
- Validated PNG/JPEG product images stored privately in MinIO, with replacement and removal.
- Durable asynchronous XLSX exports through RabbitMQ, streaming workbook generation, retries, crash recovery and completed-file downloads.
- Paginated report history with combined saved-criteria filters, processing details and selective updates even when active jobs are hidden by filters.
- Responsive pt-BR/en/es interface, persisted light/dark themes, accessible confirmations and localized form/error messages.
- PostgreSQL migrations, a controlled idempotent 10,000-product seed, Docker Compose and automated tests.

See [architecture and delivery plan](docs/ARCHITECTURE.md) and [validation evidence](docs/VALIDATION.md).

The validated local application is available at `http://localhost:3000/pt-BR/products`; this checkout uses API port 8180 to avoid an existing application's 8080 port. Local passwords are generated in the ignored `.env`, not committed to source.

Open `http://localhost:3000/pt-BR/reports` for the report center. The sidebar links both product and report pages.

## Requirements

- Docker Desktop with Docker Compose for the full development infrastructure.
- Java 21 and Maven 3.9+ for local backend development. Maven Wrapper is included.
- Node.js 24 LTS and npm for local frontend development.

## Start with Docker

For first-time setup, copy the example configuration from the repository root. Preserve an existing `.env`, especially when database volumes already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Replace the placeholder passwords in `.env`, then run:

```sh
docker compose up -d --build
```

The first build requires internet access. Flyway runs automatically and Hibernate validates the resulting schema. Database, broker and storage data use named volumes. Services are bound to loopback for local development.

| Service | Default address |
| --- | --- |
| Frontend | http://localhost:3000/pt-BR/products |
| Backend API | http://localhost:8080/api/products |
| PostgreSQL | localhost:5433 |
| RabbitMQ | localhost:5672 |
| RabbitMQ management | http://localhost:15672 |
| MinIO API | http://localhost:9000 |
| MinIO console | http://localhost:9001 |

Compose includes Next.js, Spring Boot, PostgreSQL, RabbitMQ and MinIO. MinIO serves private product images and completed reports through the backend; RabbitMQ processes export requests. MinIO is built from a pinned official source release because the former public image reference is unavailable; its initial build downloads Go dependencies. See [MinIO image details](infra/minio/README.md). `NEXT_PUBLIC_API_URL` is the browser-facing API address and is embedded during the frontend build. Rebuild the frontend after changing it. Keep `FRONTEND_ORIGIN` aligned with the actual browser origin, including its port; `localhost` and `127.0.0.1` are different origins.

Stop services while preserving data with `docker compose down`.

## Run the backend locally

Start infrastructure with `docker compose up -d postgres rabbitmq minio`. Set `POSTGRES_PASSWORD` in the current process to the same value used in `.env`. The Maven application does not automatically read the root `.env` file.

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

On Linux/macOS use `sh mvnw spring-boot:run`. Defaults: `DATABASE_URL=jdbc:postgresql://localhost:5433/product_management`, `POSTGRES_USER=product_management`, `SERVER_PORT=8080`, `FRONTEND_ORIGIN=http://localhost:3000`.

For local image uploads also set `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` and, if needed, `MINIO_ENDPOINT` (default `http://localhost:9000`). A private `product-images` bucket is created lazily on the first upload. Application startup does not require MinIO; image operations return 503 if storage is unavailable.

For report processing also set `RABBITMQ_USER` and `RABBITMQ_PASSWORD`; optionally override `RABBITMQ_HOST`, `RABBITMQ_PORT` and `MINIO_REPORT_BUCKET`. Host-run Java processes do not automatically import the root `.env` file. Compose passes these values to the backend automatically.

## Run the frontend locally

From `frontend/`:

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

The development server binds to `127.0.0.1` but can be visited at `http://localhost:3000/pt-BR/products`, matching the default backend CORS origin. If you visit `http://127.0.0.1:3000` instead, set the backend `FRONTEND_ORIGIN` accordingly. Configure `.env.local` with the browser-accessible API URL. There are no Next.js API routes or duplicated backend business services.

Routes: `/pt-BR/products`, `/pt-BR/products/new`, `/pt-BR/products/{id}`, `/pt-BR/products/{id}/edit`, `/pt-BR/reports` and `/pt-BR/settings`; replace `pt-BR` with `en` or `es` for other languages. The header includes language and theme controls. Theme preference persists in browser storage. Dates/numbers follow the selected locale and currency remains BRL. Inter fonts are self-hosted through the application bundle.

Product lookup is debounced by 350 ms. Filtering, paging and sorting run on the backend. New products always start ACTIVE. Inactivation requires a confirmation; inactive products can be reactivated and their codes remain reserved. React Hook Form and Zod provide inline validation in the selected language. The form preserves a newly created product ID if a subsequent image upload fails, so retrying updates that product instead of creating another one.

Going back or cancelling a dirty product form asks before discarding its changes; browser/tab unloads also request confirmation. Confirmation dialogs initially focus Cancel and restore the initiating control when dismissed. Browser tabs have localized page titles and the application icon. Unknown routes show a localized 404 page.

Images accept decoded PNG/JPEG content up to 5 MiB and 25 megapixels. The backend validates actual content, re-encodes pixels, stores only an object key in PostgreSQL and retrieves image content through the API. Replacements compensate failed database writes and remove obsolete objects after commit. Cleanup failures are logged; an interrupted cleanup can leave an unreferenced storage object for later maintenance.

## Generate 10,000 sample products

After migrations have run, from the repository root:

```sh
docker compose run --rm --no-deps backend --spring.profiles.active=seed
```

The seed runs only under the explicit `seed` profile. It inserts 1,000 products per category, 8,000 active and 2,000 inactive overall, varying price/quantity and without images. Codes use the reserved `SEED-00001` through `SEED-10000` namespace. Re-running skips conflicting codes without changing existing products. Inserts execute in batches within a transaction. PostgreSQL must already be healthy. The seed profile disables the web server and report consumers/scheduling; the application context closes after the runner completes, so the command exits without leaving a worker process running.

To verify two real command-line seed runs without touching the application database, run `./scripts/verify-seed.ps1` from the repository root after building the backend image. It creates a uniquely named verification database, checks the final count and removes only that database afterward.

## Product API

```sh
curl -i -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -d '{"code":"GAME-001","title":"Strategy Game","description":"Sample product","price":149.90,"quantity":12,"productType":"GAMES"}'
curl 'http://localhost:8080/api/products?productType=GAMES&status=ACTIVE&minPrice=100&maxPrice=500&page=0&size=25&sortBy=price&direction=ASC'
curl -X PATCH http://localhost:8080/api/products/PRODUCT_ID/status -H "Content-Type: application/json" -d '{"status":"INACTIVE"}'
```

Replace `PRODUCT_ID` with the UUID returned by creation. These curl examples use POSIX shell quoting; use `curl.exe` with equivalent JSON quoting or `Invoke-RestMethod` in PowerShell.

Routes: GET/POST `/api/products`, GET/PUT `/api/products/{id}`, PATCH `/api/products/{id}/status`. There is no product DELETE operation. GET/POST/DELETE `/api/products/{id}/image` retrieve, replace or remove only its optional image. Creation always starts ACTIVE; editing fields preserves status. The dedicated PATCH changes status. Code uniqueness is case-insensitive, including inactive products.

Available types: ELECTRONICS, FURNITURE, GAMES, COMPUTING, APPLIANCES, CLOTHING, BOOKS, SPORTS, BEAUTY, HOME_AND_DECOR.

The default listing shows ACTIVE products. Use `status=INACTIVE` or `status=ALL` as needed. All filled filters combine with AND; search checks code OR title. Price bounds are inclusive, nonnegative and limited to two decimal places. Page size is 1–100; allowed sort fields are code, title, price, quantity, productType, status, createdAt and updatedAt. `direction` is ASC or DESC. Unknown input properties are rejected.

Page responses contain `content`, `page`, `size`, `totalElements` and `totalPages`. Errors use HTTP Problem Details; validation errors also include `code` and per-field `errors`.

## Test and package

```powershell
cd backend
.\mvnw.cmd verify
```

Default tests start a real HTTP server with an isolated in-memory H2 database in PostgreSQL compatibility mode. They cover API behavior but do not certify PostgreSQL migrations or the PostgreSQL-specific seed. See validation notes for those limits and the optional PostgreSQL checks. The PostgreSQL test is explicitly skipped unless its database environment variables are provided.

Frontend checks, from `frontend/`:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Vitest runs validation and critical component-flow tests with React Testing Library. Vitest's internal bundler is used only by the test runner; the application uses Next.js for development, builds and routing.

## Export XLSX

Select **Export XLSX** in the catalog. Choose optional category/status/price filters or leave them empty to include active and inactive products. After submitting, keep using the application while the **Exports** panel follows the job. Download becomes available when processing completes. Tracking survives navigation and reload; dismissing a tracked job does not delete its server record.

API: POST `/api/reports` returns 202, GET `/api/reports` searches paginated history, GET `/api/reports/{id}` follows status, and GET `/api/reports/{id}/download` streams completed files. See [report contracts, reliability and verification](docs/REPORTS.md).

The report center searches filename, processing status, saved product category/status, saved minimum/maximum prices and request dates. All filled filters combine with AND. Monetary fields match the corresponding persisted export bounds; they do not rerun a product query. Calendar end dates include the whole selected day. Click a report filename to inspect its ID, criteria, processing timestamps and failure feedback.

## Final validation

GitHub Actions runs frontend formatting, ESLint, TypeScript, production build and 100% coverage checks, plus backend tests and 100% JaCoCo checks with a disposable PostgreSQL service on each push and pull request. Reports are published as run artifacts. See [CI configuration](.github/workflows/ci.yml).

Automated coverage is now configured for both applications with 100% per-file/per-class thresholds. Run `npm run test:coverage` in `frontend` and `./mvnw.cmd verify` in `backend`. For a complete run with real PostgreSQL in a dedicated temporary database, use `./scripts/verify-backend-coverage.ps1` from the project root. See [coverage commands, reports and scope](docs/COVERAGE.md).

The current suite passed 69 backend tests (including the real PostgreSQL check) and 111 frontend tests, with no skipped tests in the complete verification run and 100% measured coverage in both applications. Production builds, strict TypeScript, formatting and ESLint passed. Stage 6 browser checks covered product/image/report operations with the real Compose services and responsive layouts at 390, 768 and 1440 pixels. Automated axe checks found no WCAG A/AA violations in the main pages under either theme or the tested dialogs; these checks complement the manual keyboard review rather than certify universal accessibility.

See [validation evidence](docs/VALIDATION.md) for the tested scope, controlled seed verification and report recovery behavior. All six development stages are complete.

References: [Figma prototype](https://www.figma.com/design/QUbg3Bdgo7qXJ9BmnpwbIG), [Spring Boot requirements](https://docs.spring.io/spring-boot/system-requirements.html), [PostgreSQL container documentation](https://hub.docker.com/_/postgres).
