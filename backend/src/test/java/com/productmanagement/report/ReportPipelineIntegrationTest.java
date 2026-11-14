package com.productmanagement.report;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import com.productmanagement.product.*;
import com.productmanagement.storage.ReportStorage;
import com.productmanagement.report.messaging.ReportOutboxDispatcher;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ReportPipelineIntegrationTest {
    @Autowired ReportService reports;
    @Autowired ReportRepository repository;
    @Autowired ReportWorker worker;
    @Autowired ProductService products;
    @Autowired ProductRepository productRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemoryReportStorage storage;
    @Autowired ObjectMapper mapper;
    @LocalServerPort int port;
    private final HttpClient client = HttpClient.newHttpClient();

    @TestConfiguration
    static class StorageConfiguration {
        @Bean @Primary MemoryReportStorage testReportStorage() { return new MemoryReportStorage(); }
    }
    static class MemoryReportStorage implements ReportStorage {
        final Map<String, byte[]> objects = new ConcurrentHashMap<>();
        final List<Path> temporaryPaths = new CopyOnWriteArrayList<>();
        final AtomicInteger uploadCount = new AtomicInteger();
        volatile boolean failUpload;
        public void upload(String key, Path file) {
            try {objects.put(key, Files.readAllBytes(file)); temporaryPaths.add(file); uploadCount.incrementAndGet();}
            catch (Exception exception) {throw new IllegalStateException(exception);}
            if (failUpload) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Private storage details");
        }
        public Download open(String key) {
            byte[] bytes = objects.get(key);
            return new Download(new ByteArrayInputStream(bytes), bytes.length);
        }
        public void remove(String key) {objects.remove(key);}
    }

    @BeforeEach
    void clear() {
        jdbc.update("DELETE FROM report_outbox"); jdbc.update("DELETE FROM reports");
        jdbc.update("UPDATE report_filename_clock SET last_second = ? WHERE id = 1", Timestamp.from(Instant.EPOCH));
        productRepository.deleteAll(); storage.objects.clear(); storage.temporaryPaths.clear();
        storage.uploadCount.set(0); storage.failUpload = false;
    }

    @Test
    void acceptsRequestPersistsOutboxAndDoesNotDownloadPendingReport() throws Exception {
        var response = post("{}");
        assertThat(response.statusCode()).isEqualTo(202);
        var body = mapper.readTree(response.body());
        var id = UUID.fromString(body.get("id").asText());
        assertThat(response.headers().firstValue("Location")).contains("/api/reports/" + id);
        assertThat(body.get("status").asText()).isEqualTo("PENDING");
        assertThat(body.get("downloadAvailable").asBoolean()).isFalse();
        assertThat(body.has("fileKey")).isFalse();
        assertThat(reports.get(id).filters()).isEqualTo(new ReportRequest(null, null, null, null));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM report_outbox WHERE report_id = ? AND published_at IS NULL", Integer.class, id)).isEqualTo(1);
        assertThat(get("/" + id + "/download").statusCode()).isEqualTo(409);
        assertThat(get("/" + UUID.randomUUID()).statusCode()).isEqualTo(404);
    }

    @Test
    void rejectsInvalidCriteriaBeforeCreatingAnyReportOrEvent() throws Exception {
        for (String body : List.of("{\"minPrice\":500,\"maxPrice\":100}", "{\"minPrice\":-1}",
            "{\"maxPrice\":1.001}", "{\"productStatus\":\"ALL\"}", "{\"productType\":\"CUSTOM\"}")) {
            assertThat(post(body).statusCode()).as(body).isEqualTo(400);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM reports", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM report_outbox", Integer.class)).isZero();
    }

    @Test
    void exportsActiveAndInactiveProductsAsLiteralTextAndNumericCellsAndDownloadsTheWorkbook() throws Exception {
        product("ACTIVE-1", "=SUM(1,2)", ProductType.GAMES, "149.90", ProductStatus.ACTIVE);
        product("INACTIVE-1", "Inactive Game", ProductType.GAMES, "249.90", ProductStatus.INACTIVE);
        var report = request(new ReportRequest(null, null, null, null));
        worker.process(report.id());
        var completed = reports.get(report.id());
        assertThat(completed.status()).isEqualTo(ReportStatus.COMPLETED);
        assertThat(completed.startedAt()).isNotNull(); assertThat(completed.completedAt()).isNotNull();
        assertThat(completed.processingToken()).isNull(); assertThat(completed.leaseUntil()).isNull();
        try (var workbook = workbook(completed)) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getLastRowNum()).isEqualTo(2);
            Set<String> statuses = new HashSet<>();
            for (int index = 1; index <= 2; index++) {
                var row = sheet.getRow(index);
                assertThat(row.getCell(2).getCellType()).isEqualTo(CellType.STRING);
                assertThat(row.getCell(4).getCellType()).isEqualTo(CellType.NUMERIC);
                assertThat(row.getCell(5).getCellType()).isEqualTo(CellType.NUMERIC);
                statuses.add(row.getCell(7).getStringCellValue());
            }
            assertThat(statuses).containsExactlyInAnyOrder("ACTIVE", "INACTIVE");
        }
        var download = get("/" + report.id() + "/download");
        assertThat(download.statusCode()).isEqualTo(200);
        assertThat(download.headers().firstValue("Content-Type").orElse("")).contains("spreadsheetml.sheet");
        assertThat(download.headers().firstValue("Content-Disposition").orElse("")).contains(completed.filename());
        assertThat(download.body()).startsWith((byte) 'P', (byte) 'K');
        worker.process(report.id());
        assertThat(storage.uploadCount).hasValue(1);
        assertThat(reports.get(report.id()).attempts()).isEqualTo(1);
        assertThat(storage.temporaryPaths).allMatch(path -> !Files.exists(path));
    }

    @Test
    void combinesCategoryStatusAndPriceAndSupportsInactiveOnlyAndEmptyReports() throws Exception {
        product("G1", "Matching Game", ProductType.GAMES, "150.00", ProductStatus.ACTIVE);
        product("G2", "Inactive Game", ProductType.GAMES, "200.00", ProductStatus.INACTIVE);
        product("G3", "Expensive Game", ProductType.GAMES, "900.00", ProductStatus.ACTIVE);
        product("B1", "Book", ProductType.BOOKS, "150.00", ProductStatus.ACTIVE);
        var filtered = request(new ReportRequest(ProductType.GAMES, ProductStatus.ACTIVE, new BigDecimal("100"), new BigDecimal("500")));
        worker.process(filtered.id());
        try (var workbook = workbook(reports.get(filtered.id()))) {
            assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(1);
            assertThat(workbook.getSheetAt(0).getRow(1).getCell(1).getStringCellValue()).isEqualTo("G1");
        }
        var inactive = request(new ReportRequest(null, ProductStatus.INACTIVE, null, null));
        worker.process(inactive.id());
        try (var workbook = workbook(reports.get(inactive.id()))) {
            assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(1);
            assertThat(workbook.getSheetAt(0).getRow(1).getCell(7).getStringCellValue()).isEqualTo("INACTIVE");
        }
        var empty = request(new ReportRequest(ProductType.BEAUTY, null, null, null));
        worker.process(empty.id());
        try (var workbook = workbook(reports.get(empty.id()))) {assertThat(workbook.getSheetAt(0).getLastRowNum()).isZero();}
        assertThat(reports.get(filtered.id()).filters().productType()).isEqualTo(ProductType.GAMES);
    }

    @Test
    void readsMultipleKeysetBatchesAndExportsBeyondTheCurrentPage() throws Exception {
        var now = Timestamp.from(Instant.now());
        var rows = new ArrayList<Object[]>();
        for (int index = 0; index < 1201; index++) rows.add(new Object[] {UUID.randomUUID(), "BATCH-" + index,
            "Product " + index, new BigDecimal("12.34"), 1, "GAMES", "ACTIVE", now, now});
        jdbc.batchUpdate("INSERT INTO products (id, code, title, price, quantity, product_type, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)", rows);
        var report = request(new ReportRequest(null, null, null, null)); worker.process(report.id());
        try (var workbook = workbook(reports.get(report.id()))) {
            assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(1201);
            Set<String> codes = new HashSet<>();
            workbook.getSheetAt(0).forEach(row -> {if (row.getRowNum() > 0) codes.add(row.getCell(1).getStringCellValue());});
            assertThat(codes).hasSize(1201);
        }
    }

    @Test
    void boundsRetriesSanitizesFailureAndCleansAttemptObjects() throws Exception {
        var report = request(new ReportRequest(null, null, null, null)); storage.failUpload = true;
        for (int attempt = 1; attempt <= 3; attempt++) {
            worker.process(report.id());
            assertThat(reports.get(report.id()).attempts()).isEqualTo(attempt);
            assertThat(reports.get(report.id()).status()).isEqualTo(attempt == 3 ? ReportStatus.FAILED : ReportStatus.PENDING);
        }
        assertThat(reports.get(report.id()).errorMessage()).isEqualTo("REPORT_GENERATION_FAILED");
        assertThat(get("/" + report.id() + "/download").statusCode()).isEqualTo(409);
        worker.process(report.id()); assertThat(storage.uploadCount).hasValue(3);
        assertThat(storage.objects).isEmpty();
        assertThat(storage.temporaryPaths).allMatch(path -> !Files.exists(path));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM report_outbox WHERE report_id = ?", Integer.class, report.id())).isEqualTo(3);
    }

    @Test
    void recoversExpiredWorkAndFencesStaleWorkers() {
        var report = request(new ReportRequest(null, null, null, null)); UUID oldToken = UUID.randomUUID();
        assertThat(repository.claim(report.id(), oldToken, Instant.now().minusSeconds(300))).isTrue();
        assertThat(repository.heartbeat(report.id(), oldToken, Instant.now())).isFalse();
        assertThat(repository.complete(report.id(), oldToken, "old.xlsx", 1, Instant.now())).isFalse();
        reports.recoverExpired(); assertThat(reports.get(report.id()).status()).isEqualTo(ReportStatus.PENDING);
        UUID newToken = UUID.randomUUID(); assertThat(repository.claim(report.id(), newToken, Instant.now())).isTrue();
        reports.failAttempt(report.id(), oldToken);
        assertThat(reports.get(report.id()).status()).isEqualTo(ReportStatus.PROCESSING);
        assertThat(repository.complete(report.id(), oldToken, "old.xlsx", 1, Instant.now())).isFalse();
        assertThat(repository.heartbeat(report.id(), newToken, Instant.now())).isTrue();
    }

    @Test
    void concurrentDeliveriesProduceOnlyOneFile() throws Exception {
        var report = request(new ReportRequest(null, null, null, null));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> worker.process(report.id()));
            var second = executor.submit(() -> worker.process(report.id()));
            first.get(15, TimeUnit.SECONDS); second.get(15, TimeUnit.SECONDS);
        }
        assertThat(reports.get(report.id()).status()).isEqualTo(ReportStatus.COMPLETED);
        assertThat(storage.uploadCount).hasValue(1); assertThat(storage.objects).hasSize(1);
    }

    @Test
    void simultaneousRequestsKeepTheFilenamePatternAndAllocateUniqueNames() throws Exception {
        Set<String> names = new HashSet<>();
        try (var executor = Executors.newFixedThreadPool(4)) {
            var results = new ArrayList<Future<ReportResponse>>();
            for (int index = 0; index < 8; index++) results.add(executor.submit(() -> request(new ReportRequest(null, null, null, null))));
            for (var result : results) {
                String name = result.get(15, TimeUnit.SECONDS).filename();
                assertThat(name).matches("PRODUCT_REPORT_\\d{8}_\\d{6}\\.xlsx"); names.add(name);
            }
        }
        assertThat(names).hasSize(8);
    }

    @Test
    void keepsOutboxPendingDuringBrokerFailureAndMarksOnlyConfirmedPublication() {
        var report = request(new ReportRequest(null, null, null, null));
        var failing = new ReportOutboxDispatcher(jdbc, (event, id) -> {throw new IllegalStateException("Broker offline");});
        failing.dispatch();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM report_outbox WHERE published_at IS NULL", Integer.class)).isEqualTo(1);
        assertThat(reports.get(report.id()).status()).isEqualTo(ReportStatus.PENDING);
        jdbc.update("UPDATE report_outbox SET available_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        var count = new AtomicInteger();
        var succeeding = new ReportOutboxDispatcher(jdbc, (event, id) -> {assertThat(id).isEqualTo(report.id()); count.incrementAndGet();});
        succeeding.dispatch(); succeeding.dispatch();
        assertThat(count).hasValue(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM report_outbox WHERE published_at IS NOT NULL", Integer.class)).isEqualTo(1);
    }

    @Test
    void listsHistoryWithCombinedSavedFiltersAndIndependentActiveCount() throws Exception {
        var target = request(new ReportRequest(ProductType.GAMES, ProductStatus.INACTIVE, new BigDecimal("100"), new BigDecimal("500")));
        request(new ReportRequest(null, null, null, null));
        var completed = request(new ReportRequest(ProductType.BOOKS, ProductStatus.ACTIVE, new BigDecimal("100"), null));
        var token = UUID.randomUUID(); repository.claim(completed.id(), token, Instant.now());
        repository.complete(completed.id(), token, "test.xlsx", 1, Instant.now());
        var all = mapper.readTree(get("").body());
        assertThat(all.get("totalElements").asLong()).isEqualTo(3);
        assertThat(all.get("activeCount").asLong()).isEqualTo(2);
        var matching = mapper.readTree(get("?status=PENDING&productType=GAMES&productStatus=INACTIVE&minPrice=100&maxPrice=500").body());
        assertThat(matching.get("totalElements").asLong()).isEqualTo(1);
        assertThat(matching.get("content").get(0).get("id").asText()).isEqualTo(target.id().toString());
        var hidden = mapper.readTree(get("?status=FAILED").body());
        assertThat(hidden.get("content").size()).isZero();
        assertThat(hidden.get("activeCount").asLong()).isEqualTo(2);
        assertThat(matching.get("content").get(0).get("filters").get("productStatus").asText()).isEqualTo("INACTIVE");
        assertThat(matching.get("content").get(0).has("fileKey")).isFalse();
    }

    @Test
    void matchesStoredMonetaryBoundsRatherThanCurrentProductPrices() throws Exception {
        request(new ReportRequest(null, null, new BigDecimal("100"), new BigDecimal("500")));
        request(new ReportRequest(null, null, new BigDecimal("200"), new BigDecimal("500")));
        request(new ReportRequest(null, null, null, null));
        assertThat(mapper.readTree(get("?minPrice=100&maxPrice=500").body()).get("totalElements").asLong()).isEqualTo(1);
        assertThat(mapper.readTree(get("?maxPrice=500").body()).get("totalElements").asLong()).isEqualTo(2);
        assertThat(mapper.readTree(get("").body()).get("totalElements").asLong()).isEqualTo(3);
    }

    @Test
    void filtersRequestDatesWithInclusiveStartAndExclusiveEnd() throws Exception {
        var start = request(new ReportRequest(null, null, null, null));
        var late = request(new ReportRequest(null, null, null, null));
        var next = request(new ReportRequest(null, null, null, null));
        jdbc.update("UPDATE reports SET requested_at = ? WHERE id = ?", Timestamp.from(Instant.parse("2026-11-13T00:00:00Z")), start.id());
        jdbc.update("UPDATE reports SET requested_at = ? WHERE id = ?", Timestamp.from(Instant.parse("2026-11-13T23:59:59.999999Z")), late.id());
        jdbc.update("UPDATE reports SET requested_at = ? WHERE id = ?", Timestamp.from(Instant.parse("2026-11-14T00:00:00Z")), next.id());
        assertThat(mapper.readTree(get("?requestedFrom=2026-11-13T00:00:00Z&requestedTo=2026-11-14T00:00:00Z").body()).get("totalElements").asLong()).isEqualTo(2);
        assertThat(mapper.readTree(get("?requestedFrom=2026-11-14T00:00:00Z").body()).get("totalElements").asLong()).isEqualTo(1);
        assertThat(mapper.readTree(get("?requestedTo=2026-11-14T00:00:00Z").body()).get("totalElements").asLong()).isEqualTo(2);
    }

    @Test
    void paginatesAndSortsDeterministicallyWhenRequestTimestampsAreEqual() throws Exception {
        for (int index = 0; index < 12; index++) request(new ReportRequest(null, null, null, null));
        jdbc.update("UPDATE reports SET requested_at = ?", Timestamp.from(Instant.parse("2026-11-13T00:00:00Z")));
        var ids = new HashSet<String>();
        for (int page = 0; page < 3; page++) {
            var body = mapper.readTree(get("?size=5&page=" + page).body());
            assertThat(body.get("totalElements").asLong()).isEqualTo(12);
            assertThat(body.get("totalPages").asInt()).isEqualTo(3);
            body.get("content").forEach(item -> assertThat(ids.add(item.get("id").asText())).isTrue());
        }
        assertThat(ids).hasSize(12);
        var ascending = mapper.readTree(get("?sortBy=filename&direction=ASC&size=1").body()).get("content").get(0).get("filename").asText();
        var descending = mapper.readTree(get("?sortBy=filename&direction=DESC&size=1").body()).get("content").get(0).get("filename").asText();
        assertThat(ascending.compareTo(descending)).isNegative();
        assertThat(mapper.readTree(get("?page=999&size=5").body()).get("content").size()).isZero();
    }

    @Test
    void escapesFilenameWildcardsAndKeepsSearchParameterized() throws Exception {
        var report = request(new ReportRequest(null, null, null, null));
        String partial = report.filename().substring(0, 20).toLowerCase(java.util.Locale.ROOT);
        assertThat(mapper.readTree(get("?name=" + partial).body()).get("totalElements").asLong()).isEqualTo(1);
        assertThat(mapper.readTree(get("?name=%25").body()).get("totalElements").asLong()).isZero();
        assertThat(mapper.readTree(get("?name=%27%20OR%201%3D1--").body()).get("totalElements").asLong()).isZero();
        jdbc.update("UPDATE reports SET filename = 'plain.xlsx' WHERE id = ?", report.id());
        assertThat(mapper.readTree(get("?name=_").body()).get("totalElements").asLong()).isZero();
    }

    @Test
    void rejectsInvalidHistoryFiltersPagingAndSortFields() throws Exception {
        for (String query : List.of("?page=-1", "?size=0", "?size=101", "?sortBy=fileKey", "?direction=BAD", "?status=ACTIVE",
            "?productStatus=COMPLETED", "?productType=CUSTOM", "?minPrice=-1", "?maxPrice=0.001", "?minPrice=500&maxPrice=100",
            "?requestedFrom=invalid", "?requestedFrom=2026-11-14T00:00:00Z&requestedTo=2026-11-13T00:00:00Z",
            "?requestedFrom=2026-11-13T00:00:00Z&requestedTo=2026-11-13T00:00:00Z", "?name=" + "x".repeat(201))) {
            assertThat(get(query).statusCode()).as(query).isEqualTo(400);
        }
    }

    private ProductResponse product(String code, String title, ProductType type, String price, ProductStatus status) {
        var product = products.create(new ProductRequest(code, title, "Sample", new BigDecimal(price), 2, type));
        return status == ProductStatus.INACTIVE ? products.changeStatus(product.id(), new StatusRequest(status)) : product;
    }
    private ReportResponse request(ReportRequest filters) {return reports.request(filters);}
    private XSSFWorkbook workbook(ReportRecord report) throws Exception {return new XSSFWorkbook(new ByteArrayInputStream(storage.objects.get(report.fileKey())));}
    private HttpResponse<byte[]> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/reports" + path)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
    }
    private HttpResponse<String> post(String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/reports"))
            .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
