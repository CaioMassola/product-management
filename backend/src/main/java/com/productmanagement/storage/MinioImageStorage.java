package com.productmanagement.storage;

import java.io.ByteArrayInputStream;
import io.minio.*;
import io.minio.errors.ErrorResponseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class MinioImageStorage implements ImageStorage {
    private final String endpoint;
    private final String accessKey;
    private final String secretKey;
    private final String bucket;
    private volatile MinioClient client;

    public MinioImageStorage(@Value("${app.storage.endpoint}") String endpoint,
        @Value("${app.storage.access-key}") String accessKey, @Value("${app.storage.secret-key}") String secretKey,
        @Value("${app.storage.image-bucket}") String bucket) {
        this.endpoint = endpoint; this.accessKey = accessKey; this.secretKey = secretKey; this.bucket = bucket;
    }

    private MinioClient client() {
        if (accessKey.isBlank() || secretKey.isBlank()) throw unavailable();
        if (client == null) synchronized (this) {
            if (client == null) client = MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
        }
        return client;
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        try {
            var storage = client();
            if (!storage.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                try { storage.makeBucket(MakeBucketArgs.builder().bucket(bucket).build()); }
                catch (ErrorResponseException exception) {
                    if (!"BucketAlreadyOwnedByYou".equals(exception.errorResponse().code())) throw exception;
                }
            }
            storage.putObject(PutObjectArgs.builder().bucket(bucket).object(key)
                .stream(new ByteArrayInputStream(content), (long) content.length, -1L).contentType(contentType).build());
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw storageFailure(exception); }
    }

    @Override
    public byte[] get(String key) {
        try (var stream = client().getObject(GetObjectArgs.builder().bucket(bucket).object(key).build())) {
            byte[] content = stream.readNBytes(5 * 1024 * 1024 + 1);
            if (content.length > 5 * 1024 * 1024) throw unavailable();
            return content;
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw storageFailure(exception); }
    }

    @Override
    public void remove(String key) {
        try { client().removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build()); }
        catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw storageFailure(exception); }
    }

    private ResponseStatusException unavailable() { return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Image storage is unavailable"); }
    private ResponseStatusException storageFailure(Exception cause) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Image storage is unavailable", cause);
    }
}
