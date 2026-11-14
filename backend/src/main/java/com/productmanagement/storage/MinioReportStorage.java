package com.productmanagement.storage;

import java.nio.file.Path;
import io.minio.*;
import io.minio.errors.ErrorResponseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class MinioReportStorage implements ReportStorage {
    private final String endpoint, accessKey, secretKey, bucket;
    private volatile MinioClient client;
    public MinioReportStorage(@Value("${app.storage.endpoint}") String endpoint,
        @Value("${app.storage.access-key}") String accessKey, @Value("${app.storage.secret-key}") String secretKey,
        @Value("${app.storage.report-bucket}") String bucket) {
        this.endpoint = endpoint; this.accessKey = accessKey; this.secretKey = secretKey; this.bucket = bucket;
    }
    private MinioClient client() {
        if (accessKey.isBlank() || secretKey.isBlank()) throw unavailable(null);
        if (client == null) synchronized (this) {
            if (client == null) client = MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
        }
        return client;
    }
    @Override public void upload(String key, Path file) {
        try {
            var storage = client();
            if (!storage.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                try { storage.makeBucket(MakeBucketArgs.builder().bucket(bucket).build()); }
                catch (ErrorResponseException exception) {
                    if (!"BucketAlreadyOwnedByYou".equals(exception.errorResponse().code())) throw exception;
                }
            }
            storage.uploadObject(UploadObjectArgs.builder().bucket(bucket).object(key).filename(file.toString())
                .contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").build());
        } catch (Exception exception) { throw unavailable(exception); }
    }
    @Override public Download open(String key) {
        try {
            var storage = client();
            long size = storage.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build()).size();
            var stream = storage.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
            return new Download(stream, size);
        } catch (Exception exception) { throw unavailable(exception); }
    }
    @Override public void remove(String key) {
        try { client().removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build()); }
        catch (Exception exception) { throw unavailable(exception); }
    }
    private ResponseStatusException unavailable(Exception cause) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Report storage is unavailable", cause);
    }
}
