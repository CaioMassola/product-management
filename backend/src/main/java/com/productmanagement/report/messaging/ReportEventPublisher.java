package com.productmanagement.report.messaging;

import java.util.UUID;

public interface ReportEventPublisher {
    void publish(UUID eventId, UUID reportId) throws Exception;
}
