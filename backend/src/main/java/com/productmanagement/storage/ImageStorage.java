package com.productmanagement.storage;

public interface ImageStorage {
    void put(String key, byte[] content, String contentType);
    byte[] get(String key);
    void remove(String key);
}
