package com.productmanagement.report;

import java.time.Instant;
import java.util.UUID;

public record ReportResponse(UUID id, String filename, ReportStatus status, Instant requestedAt,
    Instant startedAt, Instant completedAt, ReportRequest filters, boolean downloadAvailable, String errorMessage) {
    public static ReportResponse from(ReportRecord report) {
        return new ReportResponse(report.id(), report.filename(), report.status(), report.requestedAt(),
            report.startedAt(), report.completedAt(), report.filters(), report.status() == ReportStatus.COMPLETED,
            report.errorMessage());
    }
}
