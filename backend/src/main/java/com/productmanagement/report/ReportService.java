package com.productmanagement.report;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReportService {
    private static final DateTimeFormatter NAME_FORMAT = DateTimeFormatter.ofPattern("'PRODUCT_REPORT_'yyyyMMdd_HHmmss'.xlsx'").withZone(ZoneOffset.UTC);
    private final JdbcTemplate jdbc;
    private final ReportRepository repository;
    public ReportService(JdbcTemplate jdbc, ReportRepository repository) { this.jdbc = jdbc; this.repository = repository; }

    @Transactional
    public ReportResponse request(ReportRequest filters) {
        filters.validate();
        Instant now = Instant.now();
        Instant last = jdbc.queryForObject("SELECT last_second FROM report_filename_clock WHERE id = 1 FOR UPDATE", Timestamp.class).toInstant();
        Instant second = now.truncatedTo(ChronoUnit.SECONDS);
        if (!second.isAfter(last)) second = last.plusSeconds(1);
        jdbc.update("UPDATE report_filename_clock SET last_second = ? WHERE id = 1", Timestamp.from(second));
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO reports (id, filename, status, requested_at, product_type, product_status, min_price, max_price)
            VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?)
            """, id, NAME_FORMAT.format(second), Timestamp.from(now),
            filters.productType() == null ? null : filters.productType().name(),
            filters.productStatus() == null ? null : filters.productStatus().name(), filters.minPrice(), filters.maxPrice());
        enqueue(id, now);
        return ReportResponse.from(get(id));
    }

    public ReportRecord get(UUID id) {
        return repository.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReportPageResponse list(ReportSearch filter, Pageable pageable) {
        return ReportPageResponse.from(repository.search(filter, pageable), repository.activeCount());
    }

    @Transactional
    public void failAttempt(UUID id, UUID token) {
        var report = get(id);
        if (report.status() != ReportStatus.PROCESSING || !token.equals(report.processingToken())) return;
        transitionAfterFailure(report, token, false);
    }

    @Transactional
    public void recoverExpired() {
        Instant now = Instant.now();
        for (var report : repository.expired(now)) transitionAfterFailure(report, report.processingToken(), true);
    }

    private void transitionAfterFailure(ReportRecord report, UUID token, boolean expiredOnly) {
        boolean exhausted = report.attempts() >= 3;
        Instant now = Instant.now();
        int changed = jdbc.update("""
            UPDATE reports SET status = ?, completed_at = ?, processing_token = NULL, lease_until = NULL, error_message = ?
            WHERE id = ? AND status = 'PROCESSING' AND processing_token = ?
            """ + (expiredOnly ? " AND lease_until < ?" : ""), arguments(report, token, exhausted, now, expiredOnly));
        if (changed == 1 && !exhausted) enqueue(report.id(), now.plusSeconds(5L * report.attempts()));
    }

    private Object[] arguments(ReportRecord report, UUID token, boolean exhausted, Instant now, boolean expiredOnly) {
        var values = new java.util.ArrayList<Object>();
        values.add(exhausted ? "FAILED" : "PENDING");
        values.add(exhausted ? Timestamp.from(now) : null);
        values.add(exhausted ? "REPORT_GENERATION_FAILED" : null);
        values.add(report.id()); values.add(token);
        if (expiredOnly) values.add(Timestamp.from(now));
        return values.toArray();
    }

    private void enqueue(UUID id, Instant availableAt) {
        jdbc.update("INSERT INTO report_outbox (id, report_id, created_at, available_at) VALUES (?, ?, ?, ?)",
            UUID.randomUUID(), id, Timestamp.from(Instant.now()), Timestamp.from(availableAt));
    }
}
