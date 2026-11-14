package com.productmanagement.product;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ProductService {
    private final ProductRepository repository;

    public ProductService(ProductRepository repository) { this.repository = repository; }

    public Page<ProductResponse> list(ProductFilter filter, Pageable pageable) {
        filter.validate();
        return repository.findAll(filter.specification(), pageable).map(ProductResponse::from);
    }

    public ProductResponse get(UUID id) { return ProductResponse.from(find(id)); }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        if (repository.existsByCodeIgnoreCase(request.code().strip())) throw duplicateCode();
        return ProductResponse.from(repository.saveAndFlush(new Product(request)));
    }

    @Transactional
    public ProductResponse update(UUID id, ProductRequest request) {
        var product = find(id);
        if (repository.existsByCodeIgnoreCaseAndIdNot(request.code().strip(), id)) throw duplicateCode();
        product.update(request);
        return ProductResponse.from(repository.saveAndFlush(product));
    }

    @Transactional
    public ProductResponse changeStatus(UUID id, StatusRequest request) {
        var product = find(id);
        product.changeStatus(request.status());
        return ProductResponse.from(repository.saveAndFlush(product));
    }

    private Product find(UUID id) {
        return repository.findById(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    private ResponseStatusException duplicateCode() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Product code is already reserved");
    }
}
