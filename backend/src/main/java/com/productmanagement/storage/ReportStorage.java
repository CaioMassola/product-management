package com.productmanagement.storage;

import java.io.InputStream;
import java.nio.file.Path;

public interface ReportStorage {
    record Download(InputStream stream, long size) {}
    void upload(String key, Path file);
    Download open(String key);
    void remove(String key);
}
