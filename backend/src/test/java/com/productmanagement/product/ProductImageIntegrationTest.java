package com.productmanagement.product;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;
import com.productmanagement.storage.ImageStorage;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class ProductImageIntegrationTest {
    @Autowired ProductRepository repository;
    @Autowired ProductService products;
    @Autowired ProductImageService images;
    @Autowired MemoryStorage storage;

    @TestConfiguration
    static class StorageConfiguration {
        @Bean @Primary MemoryStorage testImageStorage() { return new MemoryStorage(); }
    }
    static class MemoryStorage implements ImageStorage {
        final Map<String, byte[]> objects = new ConcurrentHashMap<>();
        boolean failUpload;
        public void put(String key, byte[] bytes, String type) {
            objects.put(key, bytes);
            if (failUpload) throw new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE);
        }
        public byte[] get(String key) { return objects.get(key); }
        public void remove(String key) { objects.remove(key); }
    }

    @BeforeEach
    void clear() { repository.deleteAll(); storage.objects.clear(); storage.failUpload = false; }

    @Test
    void uploadsReplacesAndRemovesImagesWithoutRemovingTheProduct() throws Exception {
        var product = product();
        var first = images.upload(product.id(), png());
        assertThat(first.imageKey()).startsWith("products/" + product.id() + "/").endsWith(".png");
        assertThat(images.get(product.id()).contentType()).isEqualTo("image/png");
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(images.get(product.id()).content()))).isNotNull();
        var second = images.upload(product.id(), png());
        assertThat(second.imageKey()).isNotEqualTo(first.imageKey());
        assertThat(storage.objects).hasSize(1).doesNotContainKey(first.imageKey());
        assertThat(images.remove(product.id()).imageKey()).isNull();
        assertThat(storage.objects).isEmpty();
        assertThat(repository.existsById(product.id())).isTrue();
        assertThatThrownBy(() -> images.get(product.id())).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsForgedMimeTypesAndInvalidContentWithoutChangingTheImage() throws Exception {
        var product = product();
        images.upload(product.id(), png());
        String key = products.get(product.id()).imageKey();
        assertThatThrownBy(() -> images.upload(product.id(), new MockMultipartFile("file", "fake.png", "image/png", "not an image".getBytes())))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> images.upload(product.id(), new MockMultipartFile("file", "fake.jpg", "image/jpeg", png().getBytes())))
            .isInstanceOf(ResponseStatusException.class);
        assertThat(products.get(product.id()).imageKey()).isEqualTo(key);
        assertThat(storage.objects).hasSize(1);
    }

    @Test
    void rollsBackReferenceAndCompensatesStorageAfterFailedUpload() throws Exception {
        var product = product();
        var original = images.upload(product.id(), png());
        storage.failUpload = true;
        assertThatThrownBy(() -> images.upload(product.id(), png())).isInstanceOf(ResponseStatusException.class);
        assertThat(products.get(product.id()).imageKey()).isEqualTo(original.imageKey());
        assertThat(storage.objects).hasSize(1).containsKey(original.imageKey());
    }

    @Test
    void rejectsEmptyOversizedAndUnsupportedImages() throws Exception {
        var product = product();
        for (var file : new MockMultipartFile[] {
            new MockMultipartFile("file", new byte[0]),
            new MockMultipartFile("file", "large.png", "image/png", new byte[5 * 1024 * 1024 + 1]),
            new MockMultipartFile("file", "vector.svg", "image/svg+xml", "<svg/>".getBytes())
        }) assertThatThrownBy(() -> images.upload(product.id(), file)).isInstanceOf(ResponseStatusException.class);
        assertThat(storage.objects).isEmpty();
    }

    private ProductResponse product() {
        return products.create(new ProductRequest("IMAGE-1", "Image Test", null, BigDecimal.ZERO, 0, ProductType.GAMES));
    }
    private MockMultipartFile png() throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB), "png", output);
        return new MockMultipartFile("file", "sample.png", "image/png", output.toByteArray());
    }
}
