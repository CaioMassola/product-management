package com.productmanagement.report;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.reports.scheduling-enabled", havingValue = "true", matchIfMissing = true)
public class ReportRecovery {
    private final ReportService service;
    public ReportRecovery(ReportService service) { this.service = service; }
    @Scheduled(fixedDelayString = "${app.reports.recovery-delay-ms:30000}", initialDelay = 10000)
    public void recover() { service.recoverExpired(); }
}
