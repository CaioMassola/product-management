package com.productmanagement.product;

import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/products/{id}/image")
public class ProductImageController {
    private final ProductImageService service;
    public ProductImageController(ProductImageService service) { this.service = service; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductResponse upload(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return service.upload(id, file);
    }

    @GetMapping
    public ResponseEntity<byte[]> get(@PathVariable UUID id) {
        var image = service.get(id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType()))
            .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff").body(image.content());
    }

    @DeleteMapping
    public ProductResponse remove(@PathVariable UUID id) { return service.remove(id); }
}
