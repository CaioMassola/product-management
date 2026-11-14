package com.productmanagement.product;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Locale;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

public record ProductFilter(String search, ProductType productType, ProductStatus status,
                            BigDecimal minPrice, BigDecimal maxPrice) {
    public void validate() {
        if ((minPrice != null && (minPrice.signum() < 0 || minPrice.scale() > 2 || minPrice.precision() - minPrice.scale() > 12))
            || (maxPrice != null && (maxPrice.signum() < 0 || maxPrice.scale() > 2 || maxPrice.precision() - maxPrice.scale() > 12))
            || (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid price range");
        }
        if (search != null && search.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search must have at most 200 characters");
        }
    }

    public Specification<Product> specification() {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (search != null && !search.isBlank()) {
                var term = "%" + search.strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("code")), term, '\\'),
                    cb.like(cb.lower(root.get("title")), term, '\\')));
            }
            if (productType != null) predicates.add(cb.equal(root.get("productType"), productType));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (minPrice != null) predicates.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            if (maxPrice != null) predicates.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
