package com.productmanagement.report;

import java.net.URI;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.Instant;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import com.productmanagement.product.ProductStatus;
import com.productmanagement.product.ProductType;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.productmanagement.storage.ReportStorage;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportService service;
    private final ReportStorage storage;
    public ReportController(ReportService service, ReportStorage storage) { this.service = service; this.storage = storage; }

    @GetMapping
    public ReportPageResponse list(
        @RequestParam(required = false) String name,
        @RequestParam(required = false) ReportStatus status,
        @RequestParam(required = false) ProductType productType,
        @RequestParam(required = false) ProductStatus productStatus,
        @RequestParam(required = false) BigDecimal minPrice,
        @RequestParam(required = false) BigDecimal maxPrice,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant requestedFrom,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant requestedTo,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(defaultValue = "requestedAt") String sortBy,
        @RequestParam(defaultValue = "DESC") Sort.Direction direction
    ) {
        if (page < 0 || size < 1 || size > 100 || !ReportRepository.SORT_FIELDS.containsKey(sortBy)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid report pagination or sort field");
        }
        return service.list(new ReportSearch(name, status, productType, productStatus, minPrice, maxPrice,
            requestedFrom, requestedTo), PageRequest.of(page, size, Sort.by(direction, sortBy)));
    }

    @PostMapping
    public ResponseEntity<ReportResponse> request(@Valid @RequestBody ReportRequest filters) {
        var report = service.request(filters);
        return ResponseEntity.accepted().location(URI.create("/api/reports/" + report.id())).body(report);
    }
    @GetMapping("/{id}")
    public ReportResponse get(@PathVariable UUID id) { return ReportResponse.from(service.get(id)); }

    @GetMapping("/{id}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable UUID id) {
        var report = service.get(id);
        if (report.status() != ReportStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Report is not ready for download");
        }
        var file = storage.open(report.fileKey());
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .contentLength(file.size()).cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(report.filename()).build().toString())
            .header("X-Content-Type-Options", "nosniff").body(new InputStreamResource(file.stream()));
    }
}
