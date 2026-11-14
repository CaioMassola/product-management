# Asynchronous XLSX exports

## Request and follow an export

Open the product catalog and select **Export XLSX**. The dialog starts with all product types and all product statuses. Category, status and inclusive monetary bounds are optional and combine with AND. The export criteria are independent from the current catalog page, search and filters.

After requesting an export, continue using the application. A persistent **Exports** panel follows the requested IDs through PENDING, PROCESSING, COMPLETED or FAILED. Each active request is checked every three seconds. Polling stops after completion/failure or a connection error; connection errors expose a retry action. The browser remembers tracked IDs across page changes and reloads. Dismissing tracking does not cancel or delete the server-side report.

Completed reports expose a backend download link. Pending, processing and failed reports have no download action. The report center at `/pt-BR/reports` includes complete paginated history, combined filters and read-only details. The floating Exports panel is hidden on that page so it does not cover the table; tracking remains active and the panel returns on other pages.

## API

### POST /api/reports

```json
{
  "productType": "GAMES",
  "productStatus": "ACTIVE",
  "minPrice": 100,
  "maxPrice": 500
}
```

Every property is optional. Use `{}` to include all matching products of both statuses; omit `productStatus` instead of sending the UI filter token `ALL`. Invalid values and inverted bounds return 400 before inserting records. A successful request returns **202 Accepted**, a `Location: /api/reports/{id}` header and a response containing ID, filename, job status, timestamps, frozen criteria, download availability and an optional sanitized error code.

### GET /api/reports/{id}

Returns the persisted job state, or 404 if the report does not exist. Product statuses ACTIVE/INACTIVE and job statuses PENDING/PROCESSING/COMPLETED/FAILED are separate enums.

### GET /api/reports/{id}/download

Returns an XLSX attachment only for COMPLETED reports. Other job states return 409; missing reports return 404; unavailable storage returns 503. The backend streams a private MinIO object without loading the workbook into server memory. Storage keys are not accepted from clients or exposed in response DTOs. This version retains the specified application-wide access model without authentication.

### GET /api/reports

Returns a server-filtered page with `content`, zero-based `page`, `size`, `totalElements`, `totalPages` and `activeCount`. The active count covers all PENDING/PROCESSING jobs independently from the selected filters or page. The central list polls every three seconds while this count is positive and stops when it reaches zero or a query fails. A failed query exposes manual retry. This also follows jobs created outside the current browser or hidden by a COMPLETED filter.

| Query parameter | Meaning |
| --- | --- |
| `name` | Case-insensitive literal substring of the filename; wildcard characters are escaped |
| `status` | PENDING, PROCESSING, COMPLETED or FAILED |
| `productType` | Stable category identifier used by the export |
| `productStatus` | ACTIVE or INACTIVE used by the export |
| `minPrice` | Exact saved lower price bound; omit to leave unrestricted |
| `maxPrice` | Exact saved upper price bound; omit to leave unrestricted |
| `requestedFrom` | Inclusive ISO-8601 request instant |
| `requestedTo` | Exclusive ISO-8601 request instant |
| `page`, `size` | Zero-based page and 1–100 rows; defaults 0 and 25 |
| `sortBy` | filename, requestedAt, status, startedAt or completedAt; default requestedAt |
| `direction` | ASC or DESC; default DESC |

All supplied predicates combine with AND. Omitted criteria do not restrict results, including reports whose export filters are null. Product criteria refer to the frozen report request, not current product values. Monetary bounds match numerically, so 100 and 100.00 are equivalent. A filter does not match an absent saved bound. Page order includes a UUID tiebreaker; nullable sort fields place nulls last.

The interface converts selected local calendar days to an inclusive local start and exclusive midnight after the final day, using calendar arithmetic across daylight-saving changes. Displayed report timestamps use that same browser timezone and the selected interface locale. Inverted dates/prices, invalid enum values and disallowed paging/sorting return 400.

## Persistence and reliability

- Report creation and its outbox event commit in the same PostgreSQL transaction. No RabbitMQ call blocks the request handler.
- Due outbox events are claimed with a dispatch token/lease, then sent as persistent messages to a durable exchange and queue. An event is marked published only after a positive publisher confirmation and successful routing. Failed publications remain pending and retry after ten seconds.
- The consumer atomically claims PENDING reports, increments the attempt count and receives a unique processing token with a two-minute lease. Heartbeats extend ownership every twenty seconds. Already completed, failed or currently owned jobs do not generate another workbook.
- Database/infrastructure failures before a claim use RabbitMQ dead-letter routing with a five-second retry queue. Malformed messages are logged and acknowledged without executing arbitrary payloads.
- Generation/storage failures retry up to three attempts. Retry requests use new transactional outbox events; exhausted reports become FAILED with `REPORT_GENERATION_FAILED`, never internal exception text. Error details remain in server logs.
- A recovery scan finds expired PROCESSING leases every thirty seconds. Updates check both the processing token and lease so an obsolete worker cannot overwrite another attempt's result.
- Each attempt uploads to a distinct report-ID/token object key. Cleanup checks the persisted reference before removing an object, including the ambiguous case in which a database commit succeeds but its acknowledgement is lost. Best-effort cleanup failures are logged and can leave an unreferenced object for maintenance.

The queue names are `product.reports.generate` and `product.reports.generate.retry`. The exchange is `product.reports` with routing key `generate`.

## Workbook generation

Apache POI SXSSF retains a window of 100 rows and compresses its temporary sheet files. Product reads use 500-record UUID keyset batches under a read-only REPEATABLE READ transaction. There is no product pagination limit on the export and no JPA entity cache accumulating exported products. A header-only XLSX is valid when nothing matches. Workbooks split into additional sheets before the Excel row limit.

Columns are ID, code, title, description, BRL price, quantity, stable product-type/status identifiers, optional image reference and UTC creation/update timestamps. Column headings are English; user-provided product text is preserved. Price/quantity/date cells use their proper Excel types. Product strings beginning with formula characters remain literal text cells. Images themselves are not embedded.

Criteria are frozen at request time; product values are read from the processing snapshot. The export does not promise historical product values from the moment the request was created. Workbooks, database resources, upload streams and temporary output files are closed/removed after every attempt.

## Unique filenames

Names retain `PRODUCT_REPORT_YYYYMMDD_HHMMSS.xlsx`, using a backend UTC timestamp. A database row lock allocates a unique whole-second slot even across concurrent application instances. During bursts, allocated name timestamps may run ahead of wall-clock time; the separate `requestedAt` field always records the actual request instant. Distinct UUID/attempt keys additionally isolate storage objects.

## Environment and local operation

Compose supplies `RABBITMQ_HOST`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` and the private `product-reports` bucket setting. Host defaults are RabbitMQ on port 5672 and MinIO on port 9000. The source-built MinIO image is documented in [infra/minio](../infra/minio/README.md).

`REPORT_MESSAGING_ENABLED=false` and `REPORT_SCHEDULING_ENABLED=false` are explicit test/development controls. Normal operation leaves both enabled. There is no automatic in-memory queue or storage fallback when external infrastructure is unavailable.

This checkout's ignored `.env` uses API port **8180** because an unrelated existing service owns 8080. The frontend build points to `http://localhost:8180/api`. The example configuration retains the documented default of 8080; rebuild the frontend after changing its browser-facing API address.

## Verify against real services

With the application running, from the repository root:

```powershell
.\scripts\verify-report-pipeline.ps1 -ApiBaseUrl http://localhost:8180/api
```

The script creates explicit verification products, requests filtered active/inactive/all exports, waits for completion, downloads actual XLSX files and checks their code cells. Outputs are under ignored `backend/target/report-verification/`. Verification products remain as sample records; the script never physically deletes products.

See [validation evidence](VALIDATION.md) for tests, real broker recovery and Docker/browser results.

Implementation references: [publisher confirms and returns](https://docs.spring.io/spring-amqp/reference/amqp/template.html), [SXSSF resource lifecycle](https://poi.apache.org/apidocs/6.0/org/apache/poi/xssf/streaming/SXSSFWorkbook.html), [Apache POI release](https://poi.apache.org/download.html).
