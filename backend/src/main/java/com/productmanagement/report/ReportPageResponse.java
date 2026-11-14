package com.productmanagement.report;

import java.util.List;
import org.springframework.data.domain.Page;

public record ReportPageResponse(List<ReportResponse> content, int page, int size, long totalElements,
    int totalPages, long activeCount) {
    public static ReportPageResponse from(Page<ReportRecord> page, long activeCount) {
        return new ReportPageResponse(page.getContent().stream().map(ReportResponse::from).toList(),
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), activeCount);
    }
}
