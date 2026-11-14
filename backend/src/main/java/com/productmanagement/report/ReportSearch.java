package com.productmanagement.report;

import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.productmanagement.product.ProductStatus;
import com.productmanagement.product.ProductType;

public record ReportSearch(String name, ReportStatus status, ProductType productType, ProductStatus productStatus,
    BigDecimal minPrice, BigDecimal maxPrice, Instant requestedFrom, Instant requestedTo) {
    public void validate() {
        new ReportRequest(productType, productStatus, minPrice, maxPrice).validate();
        if (name != null && name.length() > 200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report name search must have at most 200 characters");
        if (requestedFrom != null && requestedTo != null && !requestedFrom.isBefore(requestedTo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request start must precede the exclusive end");
        }
    }
}
