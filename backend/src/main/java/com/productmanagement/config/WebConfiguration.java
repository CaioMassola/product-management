package com.productmanagement.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final String frontendOrigin;

    public WebConfiguration(@Value("${app.frontend-origin}") String frontendOrigin) {
        this.frontendOrigin = frontendOrigin;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/products/*/image").allowedOrigins(frontendOrigin)
            .allowedMethods("GET", "POST", "DELETE", "OPTIONS").allowedHeaders("Content-Type");
        registry.addMapping("/api/**").allowedOrigins(frontendOrigin)
            .allowedMethods("GET", "POST", "PUT", "PATCH", "OPTIONS")
            .allowedHeaders("Content-Type").exposedHeaders("Location");
    }
}
