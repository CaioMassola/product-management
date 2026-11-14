package com.productmanagement.product;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProductResponse(UUID id, String code, String title, String description,
    BigDecimal price, int quantity, ProductType productType, ProductStatus status,
    String imageKey, Instant createdAt, Instant updatedAt) {
    public static ProductResponse from(Product product) {
        return new ProductResponse(product.getId(), product.getCode(), product.getTitle(),
            product.getDescription(), product.getPrice(), product.getQuantity(),
            product.getProductType(), product.getStatus(), product.getImageKey(),
            product.getCreatedAt(), product.getUpdatedAt());
    }
}
