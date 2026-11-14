package com.productmanagement.seed;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.productmanagement.product.ProductType;

@Component
@Profile("seed")
public class ProductSeedRunner implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(ProductSeedRunner.class);
    private final JdbcTemplate jdbc;

    public ProductSeedRunner(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    @Transactional
    public void run(String... args) {
        var types = ProductType.values();
        String[] titles = {"Wireless Headphones", "Office Chair", "Strategy Game", "Mechanical Keyboard",
            "Coffee Maker", "Cotton Shirt", "Programming Handbook", "Training Ball", "Face Cream", "Table Lamp"};
        var now = java.sql.Timestamp.from(Instant.now());
        int inserted = 0;
        for (int batch = 0; batch < 20; batch++) {
            var rows = new java.util.ArrayList<Object[]>(500);
            for (int offset = 1; offset <= 500; offset++) {
                int index = batch * 500 + offset;
                int type = (index - 1) % types.length;
                rows.add(new Object[] {UUID.randomUUID(), "SEED-%05d".formatted(index),
                    titles[type] + " " + index, "Sample " + types[type].name().toLowerCase(java.util.Locale.ROOT)
                    + " product, model " + index, BigDecimal.valueOf((index * 7919L) % 500000, 2),
                    (index * 37) % 501, types[type].name(), ((index - 1) / 10) % 5 == 0 ? "INACTIVE" : "ACTIVE", now, now});
            }
            int[] results = jdbc.batchUpdate("""
                INSERT INTO products (id, code, title, description, price, quantity, product_type, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
                """, rows);
            for (int result : results) if (result > 0) inserted += result;
        }
        log.info("Product seed completed: {} products inserted; existing records preserved", inserted);
    }
}
