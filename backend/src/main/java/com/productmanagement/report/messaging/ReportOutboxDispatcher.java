package com.productmanagement.report.messaging;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = {"app.reports.messaging-enabled", "app.reports.scheduling-enabled"}, havingValue = "true", matchIfMissing = true)
public class ReportOutboxDispatcher {
    private static final Logger log = LoggerFactory.getLogger(ReportOutboxDispatcher.class);
    private final JdbcTemplate jdbc;
    private final ReportEventPublisher publisher;
    public ReportOutboxDispatcher(JdbcTemplate jdbc, ReportEventPublisher publisher) { this.jdbc = jdbc; this.publisher = publisher; }

    @Scheduled(fixedDelayString = "${app.reports.dispatch-delay-ms:2000}", initialDelay = 3000)
    public void dispatch() {
        Instant now = Instant.now();
        var events = jdbc.queryForList("""
            SELECT id, report_id FROM report_outbox WHERE published_at IS NULL AND available_at <= ?
                AND (dispatch_lease_until IS NULL OR dispatch_lease_until < ?) ORDER BY available_at LIMIT 10
            """, Timestamp.from(now), Timestamp.from(now));
        for (var event : events) {
            UUID id = (UUID) event.get("id"), reportId = (UUID) event.get("report_id"), token = UUID.randomUUID();
            int claimed = jdbc.update("""
                UPDATE report_outbox SET dispatch_token = ?, dispatch_lease_until = ?, attempts = attempts + 1
                WHERE id = ? AND published_at IS NULL AND (dispatch_lease_until IS NULL OR dispatch_lease_until < ?)
                """, token, Timestamp.from(Instant.now().plusSeconds(60)), id, Timestamp.from(Instant.now()));
            if (claimed != 1) continue;
            try {
                publisher.publish(id, reportId);
                jdbc.update("UPDATE report_outbox SET published_at = ?, dispatch_token = NULL, dispatch_lease_until = NULL WHERE id = ? AND dispatch_token = ?",
                    Timestamp.from(Instant.now()), id, token);
            } catch (Exception exception) {
                jdbc.update("""
                    UPDATE report_outbox SET available_at = ?, dispatch_token = NULL, dispatch_lease_until = NULL
                    WHERE id = ? AND dispatch_token = ?
                    """, Timestamp.from(Instant.now().plusSeconds(10)), id, token);
                log.warn("Report outbox event {} remains pending after dispatch failure: {}", id, exception.getClass().getSimpleName());
            }
        }
    }
}
