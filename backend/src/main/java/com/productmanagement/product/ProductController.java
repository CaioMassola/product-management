package com.productmanagement.product;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.productmanagement.shared.PageResponse;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private static final Set<String> SORT_FIELDS = Set.of("code", "title", "price", "quantity", "productType", "status", "createdAt", "updatedAt");
    private final ProductService service;

    public ProductController(ProductService service) { this.service = service; }

    @GetMapping
    public PageResponse<ProductResponse> list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) ProductType productType,
        @RequestParam(defaultValue = "ACTIVE") String status,
        @RequestParam(required = false) BigDecimal minPrice,
        @RequestParam(required = false) BigDecimal maxPrice,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(defaultValue = "createdAt") String sortBy,
        @RequestParam(defaultValue = "DESC") Sort.Direction direction
    ) {
        if (page < 0 || size < 1 || size > 100 || !SORT_FIELDS.contains(sortBy)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination or sort field");
        }
        ProductStatus productStatus;
        try { productStatus = "ALL".equals(status) ? null : ProductStatus.valueOf(status); }
        catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid product status");
        }
        var filter = new ProductFilter(search, productType, productStatus, minPrice, maxPrice);
        var sort = Sort.by(direction, sortBy).and(Sort.by("id"));
        return PageResponse.from(service.list(filter, PageRequest.of(page, size, sort)));
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        var product = service.create(request);
        return ResponseEntity.created(URI.create("/api/products/" + product.id())).body(product);
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable UUID id, @Valid @RequestBody ProductRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public ProductResponse changeStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(id, request);
    }
}
