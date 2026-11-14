package com.productmanagement.report;

import java.time.Instant;
import java.util.UUID;

public record ReportRecord(UUID id, String filename, ReportStatus status, Instant requestedAt,
    Instant startedAt, Instant completedAt, ReportRequest filters, String fileKey, Long fileSize,
    String errorMessage, UUID processingToken, Instant leaseUntil, int attempts) {}
