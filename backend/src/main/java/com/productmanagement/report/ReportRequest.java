package com.productmanagement.report;

import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import com.productmanagement.product.ProductFilter;
import com.productmanagement.product.ProductStatus;
import com.productmanagement.product.ProductType;

public record ReportRequest(ProductType productType, ProductStatus productStatus,
    @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal minPrice,
    @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal maxPrice) {
    public void validate() { new ProductFilter(null, productType, productStatus, minPrice, maxPrice).validate(); }
}
