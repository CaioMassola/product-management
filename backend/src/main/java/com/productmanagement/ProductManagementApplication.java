package com.productmanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.env.Profiles;

@SpringBootApplication
public class ProductManagementApplication {
    public static void main(String[] args) {
        var context = SpringApplication.run(ProductManagementApplication.class, args);
        if (context.getEnvironment().acceptsProfiles(Profiles.of("seed"))) context.close();
    }
}
