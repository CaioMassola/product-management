package com.productmanagement.report;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import com.productmanagement.storage.ReportStorage;

@Component
public class ReportWorker {
    private static final Logger log = LoggerFactory.getLogger(ReportWorker.class);
    private final ReportRepository repository;
    private final ReportService service;
    private final ProductReportGenerator generator;
    private final ReportStorage storage;
    private final ScheduledExecutorService reportHeartbeatExecutor;
    public ReportWorker(ReportRepository repository, ReportService service, ProductReportGenerator generator,
        ReportStorage storage, ScheduledExecutorService reportHeartbeatExecutor) {
        this.repository = repository; this.service = service; this.generator = generator;
        this.storage = storage; this.reportHeartbeatExecutor = reportHeartbeatExecutor;
    }

    public void process(UUID id) {
        UUID token = UUID.randomUUID();
        if (!repository.claim(id, token, Instant.now())) return;
        var ownershipLost = new AtomicBoolean(false);
        var heartbeat = reportHeartbeatExecutor.scheduleAtFixedRate(() -> {
            try {if (!repository.heartbeat(id, token, Instant.now())) ownershipLost.set(true);}
            catch (Exception exception) { ownershipLost.set(true); log.warn("Report heartbeat failed for {}", id, exception); }
        }, 20, 20, TimeUnit.SECONDS);
        String key = "reports/" + id + "/" + token + ".xlsx";
        Path temporary = null;
        try {
            var report = service.get(id);
            temporary = Files.createTempFile("product-report-", ".xlsx");
            generator.generate(report.filters(), temporary, () -> {
                if (ownershipLost.get()) throw new IllegalStateException("Report processing lease lost");
            });
            if (ownershipLost.get()) throw new IllegalStateException("Report processing lease lost");
            storage.upload(key, temporary);
            if (ownershipLost.get() || !repository.complete(id, token, key, Files.size(temporary), Instant.now())) {
                throw new IllegalStateException("Report processing lease lost before completion");
            }
            log.info("Report {} completed on attempt {}", id, report.attempts());
        } catch (Exception exception) {
            log.warn("Report generation attempt failed for {}", id, exception);
            cleanupUnreferenced(id, key);
            service.failAttempt(id, token);
        } finally {
            heartbeat.cancel(false);
            if (temporary != null) try {Files.deleteIfExists(temporary);}
            catch (Exception exception) { log.warn("Could not remove temporary report file {}", temporary, exception); }
        }
    }

    private void cleanupUnreferenced(UUID id, String key) {
        try {
            // A completion commit can succeed even if its acknowledgement is lost.
            // Retain the file if the database references it, or if its state cannot be checked.
            if (repository.find(id).map(report -> key.equals(report.fileKey())).orElse(false)) return;
            storage.remove(key);
        } catch (Exception exception) { log.warn("Could not clean unreferenced report object {}", key, exception); }
    }
}
