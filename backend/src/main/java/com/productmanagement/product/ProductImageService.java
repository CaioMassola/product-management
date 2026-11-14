package com.productmanagement.product;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import com.productmanagement.storage.ImageStorage;

@Service
@Transactional(readOnly = true)
public class ProductImageService {
    public record ImageContent(byte[] content, String contentType) {}
    private static final Logger log = LoggerFactory.getLogger(ProductImageService.class);
    private final ProductRepository repository;
    private final ImageStorage storage;
    private final ProductImageValidator validator;

    public ProductImageService(ProductRepository repository, ImageStorage storage, ProductImageValidator validator) {
        this.repository = repository; this.storage = storage; this.validator = validator;
    }

    @Transactional
    public ProductResponse upload(UUID id, MultipartFile file) {
        var product = find(id);
        var image = validator.validate(file);
        String key = "products/" + id + "/" + UUID.randomUUID() + "." + image.extension();
        String oldKey = product.getImageKey();
        // Register compensation before uploading, including an uncertain network outcome.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) cleanup(oldKey); else cleanup(key);
            }
        });
        storage.put(key, image.content(), image.contentType());
        product.changeImage(key);
        return ProductResponse.from(repository.saveAndFlush(product));
    }

    @Transactional
    public ProductResponse remove(UUID id) {
        var product = find(id);
        String oldKey = product.getImageKey();
        product.changeImage(null);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { cleanup(oldKey); }
        });
        return ProductResponse.from(repository.saveAndFlush(product));
    }

    public ImageContent get(UUID id) {
        String key = find(id).getImageKey();
        if (key == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product image not found");
        return new ImageContent(storage.get(key), key.endsWith(".png") ? "image/png" : "image/jpeg");
    }

    private Product find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    private void cleanup(String key) {
        if (key == null) return;
        try { storage.remove(key); }
        catch (Exception exception) { log.warn("Could not remove unreferenced image object {}", key, exception); }
    }
}
