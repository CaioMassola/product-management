# Product Management architecture

## Scope and boundaries

A simple monorepo contains a Next.js App Router frontend and a Java 21 Spring Boot REST API. PostgreSQL owns persistent records; RabbitMQ delivers export jobs; private MinIO buckets hold images and completed workbooks. No authentication, user management, physical product deletion, or custom categories are included in version one.

Next.js owns rendering, navigation, forms, theme and locale preferences. React Hook Form and Zod provide immediate validation feedback; Bean Validation and database constraints remain authoritative. TanStack Query owns server-state caching, mutations and report polling. Next.js API routes must not duplicate business logic.

## Directory layout

```text
product-management/
  backend/
    .mvn/wrapper/
    src/main/java/com/productmanagement/
      config/
      product/
      seed/
      shared/
    src/main/resources/db/migration/
    src/test/
  frontend/
    src/
      app/[locale]/
      components/{ui,layout}/
      features/{products,reports}/
      hooks/
      lib/
      providers/
      i18n/
      messages/
      types/
  docs/
  docker-compose.yml
  .env.example
```

Backend packages are organized by feature, with explicit controllers, request/response DTOs, entities, repositories and services inside each feature. Shared configuration and error handling remain small.

## Data model

`products`: UUID ID; case-insensitive unique code; title; optional description; numeric(14,2) price; nonnegative integer quantity; one of ten stable English product type identifiers; ACTIVE/INACTIVE status; optional image object key; UTC creation/update timestamps; optimistic-lock version.

`reports` (stage 4, implemented): UUID ID; unique filename; PENDING/PROCESSING/COMPLETED/FAILED status; requested/started/completed timestamps; nullable product_type, product_status, min_price and max_price filter columns; private file_key/file_size; sanitized error_message; processing token, attempt count and lease expiry for crash recovery. Typed filter columns allow ordinary SQL predicates and avoid JSONB extraction for the required report searches. Report filters are immutable after creation.

`report_outbox` (stage 4, implemented): UUID event ID; report_id foreign key; created_at; available_at; published_at; attempt count; dispatch token/lease. Report creation and its outbox event share a PostgreSQL transaction, preventing lost requests when RabbitMQ is unavailable. `report_filename_clock` serializes allocation of unique second-resolution download names across application instances.

There is no report-to-product foreign key: a report represents a query rather than a product ownership relationship. Matching product values are read at processing time; criteria are frozen at request time. Point-in-time product snapshots at request time are outside the requested scope.

Initial product indexes support exact code uniqueness, the default status/creation listing, and category/price searches. Substring searches initially use parameterized LIKE expressions. Further indexes require observed query plans rather than speculation.

## Product API

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/products | Filtered page, 200 |
| GET | /api/products/{id} | Product, 200 or 404 |
| POST | /api/products | ACTIVE product, 201 and Location |
| PUT | /api/products/{id} | Updated product fields, 200 |
| PATCH | /api/products/{id}/status | Explicit status transition, 200 |

No DELETE route exists. Status is changed through its dedicated endpoint, never implicitly through editing other fields. New products always start ACTIVE, so the creation form must show that status as fixed. Editing exposes the status control through the PATCH operation.

List query: `search`, `productType`, `status`, `minPrice`, `maxPrice`, `page`, `size`, `sortBy`, `direction`. Pages start at zero, default to 25 rows, and cannot exceed 100. Sort fields are allowlisted and include a UUID tiebreaker for stable paging. Status defaults to ACTIVE; `status=ALL` removes the status predicate. ALL is a filter token, never a persisted status.

Search is `(code contains term OR title contains term) AND category AND status AND minimum AND maximum`, omitting unset predicates. Text matching is case-insensitive and escapes wildcard characters. Price ranges are inclusive. The frontend will debounce search, reset paging on filter changes and never load the entire catalog.

Responses use an explicit page DTO. Validation failures use application/problem+json with field errors; conflicts return 409, missing records 404 and invalid input 400. No internal SQL or stack trace is exposed.

## Image API (stage 3)

Implemented POST and DELETE `/api/products/{id}/image` for replacing/removing the image only, plus GET `/api/products/{id}/image` for retrieval. Product deletion remains unsupported. Validate decoded JPEG/PNG content, a 5 MiB limit and a 25-megapixel limit before full decoding; re-encode pixels to remove metadata and appended payloads. WebP is not accepted because the standard Java image decoder does not support it without another codec dependency. Generate object keys on the server and keep buckets private. Upload before associating the object key; compensate failed database writes and remove obsolete objects after commit. Product JSON never accepts arbitrary storage keys. Best-effort cleanup failures are logged and can leave unreferenced storage objects.

## Report API (stages 4 and 5)

| Method | Route | Result |
| --- | --- | --- |
| POST | /api/reports | Persist criteria and enqueue work, 202 and Location |
| GET | /api/reports | Filtered page, 200 |
| GET | /api/reports/{id} | Job state and frozen criteria, 200 |
| GET | /api/reports/{id}/download | Completed XLSX stream, otherwise 409 |

POST accepts optional `productType`, `productStatus`, `minPrice`, `maxPrice`; an empty object includes active and inactive products. Export status defaults to all, independently of the product-list default. Report search uses `name`, processing `status`, `productType`, `productStatus`, `minPrice`, `maxPrice`, `requestedFrom`, `requestedTo` and paging. Minimum/maximum report search fields match the exact persisted lower/upper filter values, not the current catalog. Date boundaries use UTC instants; the UI converts selected local calendar dates to a half-open interval. A read-only REPEATABLE READ transaction keeps the page, filtered total and global active-job count consistent. Filename lookup escapes LIKE wildcard characters and all search values are SQL parameters. Sort columns are allowlisted.

## Asynchronous export

1. Validate criteria and atomically insert a PENDING report plus an outbox event.
2. Publish the event to a durable RabbitMQ queue using publisher confirms. Retry unpublished events after failures; duplicate publication is expected.
3. The consumer atomically claims a report using a processing token and expiring lease. Already completed or actively owned jobs are acknowledged without duplicate generation. Heartbeats retain ownership during long exports.
4. Read products in bounded keyset batches using a consistent database snapshot. Generate an XLSX with SXSSF, numeric price/quantity cells, literal text cells and bounded row memory. Split sheets before the XLSX row limit.
5. Upload to an object key unique to the report ID and processing attempt. Atomically complete only if the worker still owns its lease. Clean unreferenced attempt objects after a failed claim/commit.
6. Acknowledge successful work. Retry transient errors with a bounded policy; exhausted jobs become FAILED with a sanitized error. A recovery task requeues expired leases. Always close cursors/workbooks/streams and delete temporary files.

Download names follow `PRODUCT_REPORT_YYYYMMDD_HHMMSS.xlsx`, generated by the backend in UTC. A locked database clock row allocates a unique whole-second filename slot, so simultaneous requests keep the required format without colliding. During bursts, filename timestamps can run ahead of wall-clock time; requested_at retains the actual request time. Distinct report IDs and attempt object keys additionally prevent storage collisions.

The export UI tracks requested IDs independently of the visible product page, persisting IDs in browser storage. Poll job details while a tracked request is PENDING/PROCESSING; stop on terminal states or connection errors and offer manual retry. The report center additionally uses a global `activeCount` from the paginated API, so hiding an active job with history filters or pagination does not stop updates. Detail observers invalidate history queries when a tracked job finishes. The floating tracking panel is hidden on the full history page while its observers remain active.

## Frontend communication and appearance

Browser requests call the REST API through a typed fetch client and an explicit allowed CORS origin. Server Components currently provide route/layout boundaries; interactive product data is fetched through TanStack Query in Client Components. No server-side backend proxy or duplicate business service runs in Next.js. TanStack Query invalidates affected product queries after mutations; reports will use the same approach when implemented.

Use next-intl locale routes for pt-BR (initial), en and es. All code identifiers, filenames and comments are English. Labels live in separate translation files. Currency remains BRL and dates/numbers follow the selected locale. next-themes persists light/dark preference in the browser.

The supplied Figma file was accessed directly. Its later screens include the expanded product and report filters, export dialog, preferences and dark theme. Retrieve each target frame's full design context and screenshot when implementing it. The specification overrides older controls: no product deletion, no custom categories and no unrequested report retry action.

## Delivery stages

1. Architecture and environment inspection: documented here.
2. Backend and infrastructure: products, constraints, migrations, validation, status transitions, seed, Compose and tests.
3. Product frontend: Next.js layout, reusable controls, list/detail/forms, filters, image integration and status confirmation.
4. Export pipeline: report persistence, transactional outbox, RabbitMQ consumer, SXSSF, MinIO and download.
5. Report center: combined filters, job tracking, selective polling and download feedback.
6. Finish: complete themes/translations, responsive/accessibility review, integration tests and documentation.

All six stages are complete. Validation evidence distinguishes automated tests, real infrastructure checks and browser checks. The explicit seed profile is a one-shot operation: it disables the web server and report consumers/scheduling, then closes the application context after the runner completes. Normal application startup remains a persistent web/consumer process.
