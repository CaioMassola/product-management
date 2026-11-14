package com.productmanagement.product;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "products")
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, unique = true, length = 64)
    private String code;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(length = 4000)
    private String description;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal price;
    @Column(nullable = false)
    private int quantity;
    @Enumerated(EnumType.STRING) @Column(name = "product_type", nullable = false, length = 32)
    private ProductType productType;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private ProductStatus status = ProductStatus.ACTIVE;
    @Column(name = "image_key", length = 512)
    private String imageKey;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version
    private long version;

    protected Product() {}

    public Product(ProductRequest request) { update(request); }

    public void update(ProductRequest request) {
        code = request.code().strip();
        title = request.title().strip();
        description = request.description();
        price = request.price();
        quantity = request.quantity();
        productType = request.productType();
    }

    public void changeStatus(ProductStatus status) { this.status = status; }

    public void changeImage(String key) { this.imageKey = key; }

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public BigDecimal getPrice() { return price; }
    public int getQuantity() { return quantity; }
    public ProductType getProductType() { return productType; }
    public ProductStatus getStatus() { return status; }
    public String getImageKey() { return imageKey; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
