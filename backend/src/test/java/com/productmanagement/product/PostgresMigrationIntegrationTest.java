package com.productmanagement.product;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import com.productmanagement.seed.ProductSeedRunner;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "PRODUCT_MANAGEMENT_TEST_DATABASE_URL", matches = ".+")
class PostgresMigrationIntegrationTest {
    @Test
    void migratesAndSeedsIdempotentlyWithDatabaseConstraints() throws Exception {
        String schema = "pm_test_" + UUID.randomUUID().toString().replace("-", "");
        var dataSource = new DriverManagerDataSource(
            System.getenv("PRODUCT_MANAGEMENT_TEST_DATABASE_URL"),
            System.getenv("PRODUCT_MANAGEMENT_TEST_DATABASE_USER"),
            System.getenv("PRODUCT_MANAGEMENT_TEST_DATABASE_PASSWORD"));
        var admin = new JdbcTemplate(dataSource);
        try {
            Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").load().migrate();
            var isolated = new DriverManagerDataSource(dataSource.getUrl(), dataSource.getUsername(), dataSource.getPassword()) {
                @Override
                public java.sql.Connection getConnection() throws java.sql.SQLException {
                    var connection = super.getConnection();
                    connection.setSchema(schema);
                    return connection;
                }
            };
            var jdbc = new JdbcTemplate(isolated);
            var seed = new ProductSeedRunner(jdbc);
            seed.run();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM products", Long.class)).isEqualTo(10000L);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE status = 'ACTIVE'", Long.class)).isEqualTo(8000L);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE image_key IS NOT NULL", Long.class)).isZero();
            for (var type : ProductType.values()) {
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE product_type = ?", Long.class, type.name())).isEqualTo(1000L);
            }
            jdbc.update("UPDATE products SET title = 'Preserved title' WHERE code = 'SEED-00001'");
            seed.run();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM products", Long.class)).isEqualTo(10000L);
            assertThat(jdbc.queryForObject("SELECT title FROM products WHERE code = 'SEED-00001'", String.class)).isEqualTo("Preserved title");
            var reportFile = java.nio.file.Files.createTempFile("postgres-product-report-", ".xlsx");
            try {
                new com.productmanagement.report.ProductReportGenerator(jdbc).generate(
                    new com.productmanagement.report.ReportRequest(null, null, null, null), reportFile, () -> {});
                try (var input = java.nio.file.Files.newInputStream(reportFile);
                     var workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook(input)) {
                    assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(10000);
                }
            } finally {java.nio.file.Files.deleteIfExists(reportFile);}
            assertThatThrownBy(() -> jdbc.update("UPDATE products SET code = 'seed-00001' WHERE code = 'SEED-00002'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.update("UPDATE products SET status = 'DELETED' WHERE code = 'SEED-00001'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.update("UPDATE products SET price = -1 WHERE code = 'SEED-00001'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbc.update("UPDATE products SET quantity = -1 WHERE code = 'SEED-00001'"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        } finally {
            // Only the randomly named test schema is removed; existing application data is untouched.
            admin.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }
}
