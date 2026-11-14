package com.productmanagement.report;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ProductReportGenerator {
    private static final String[] HEADERS = {"ID", "Code", "Title", "Description", "Price (BRL)", "Quantity", "Product Type", "Status", "Image Reference", "Created At (UTC)", "Updated At (UTC)"};
    private static final int BATCH_SIZE = 500;
    private static final int MAX_SHEET_ROWS = 1_048_576;
    private final JdbcTemplate jdbc;
    private final int sheetRowLimit;
    @org.springframework.beans.factory.annotation.Autowired
    public ProductReportGenerator(JdbcTemplate jdbc) { this(jdbc, MAX_SHEET_ROWS); }
    ProductReportGenerator(JdbcTemplate jdbc, int sheetRowLimit) {
        if (sheetRowLimit < 2 || sheetRowLimit > MAX_SHEET_ROWS) throw new IllegalArgumentException("Invalid worksheet row limit");
        this.jdbc = jdbc; this.sheetRowLimit = sheetRowLimit;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public void generate(ReportRequest filters, Path destination, Runnable ensureOwnership) throws IOException {
        filters.validate();
        try (var workbook = new SXSSFWorkbook(100)) {
            workbook.setCompressTempFiles(true);
            var headerStyle = workbook.createCellStyle();
            var font = workbook.createFont(); font.setBold(true); headerStyle.setFont(font);
            var moneyStyle = workbook.createCellStyle(); moneyStyle.setDataFormat(workbook.createDataFormat().getFormat("\"R$\" #,##0.00"));
            var dateStyle = workbook.createCellStyle(); dateStyle.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd hh:mm:ss"));
            Sheet sheet = sheet(workbook, 1, headerStyle);
            int rowIndex = 1, sheetNumber = 1;
            UUID lastId = null;
            while (true) {
                ensureOwnership.run();
                var arguments = new ArrayList<Object>();
                var conditions = new ArrayList<String>();
                if (filters.productType() != null) {conditions.add("product_type = ?"); arguments.add(filters.productType().name());}
                if (filters.productStatus() != null) {conditions.add("status = ?"); arguments.add(filters.productStatus().name());}
                if (filters.minPrice() != null) {conditions.add("price >= ?"); arguments.add(filters.minPrice());}
                if (filters.maxPrice() != null) {conditions.add("price <= ?"); arguments.add(filters.maxPrice());}
                if (lastId != null) {conditions.add("id > ?"); arguments.add(lastId);}
                String sql = "SELECT * FROM products" + (conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions)) + " ORDER BY id LIMIT " + BATCH_SIZE;
                List<java.util.Map<String, Object>> batch = jdbc.queryForList(sql, arguments.toArray());
                if (batch.isEmpty()) break;
                for (var product : batch) {
                    if (rowIndex == sheetRowLimit) {sheet = sheet(workbook, ++sheetNumber, headerStyle); rowIndex = 1;}
                    var row = sheet.createRow(rowIndex++);
                    text(row, 0, product.get("id")); text(row, 1, product.get("code"));
                    text(row, 2, product.get("title")); text(row, 3, product.get("description"));
                    row.createCell(4).setCellValue(((Number) product.get("price")).doubleValue()); row.getCell(4).setCellStyle(moneyStyle);
                    row.createCell(5).setCellValue(((Number) product.get("quantity")).intValue());
                    text(row, 6, product.get("product_type")); text(row, 7, product.get("status"));
                    text(row, 8, product.get("image_key"));
                    date(row, 9, product.get("created_at"), dateStyle); date(row, 10, product.get("updated_at"), dateStyle);
                    lastId = (UUID) product.get("id");
                }
                if (batch.size() < BATCH_SIZE) break;
            }
            ensureOwnership.run();
            try (var output = Files.newOutputStream(destination)) { workbook.write(output); }
        }
    }

    private Sheet sheet(SXSSFWorkbook workbook, int number, CellStyle headerStyle) {
        var sheet = workbook.createSheet("Products " + number);
        var row = sheet.createRow(0);
        for (int index = 0; index < HEADERS.length; index++) {
            row.createCell(index).setCellValue(HEADERS[index]); row.getCell(index).setCellStyle(headerStyle);
            sheet.setColumnWidth(index, (index == 3 ? 50 : index == 2 || index == 8 ? 35 : 23) * 256);
        }
        sheet.createFreezePane(0, 1);
        sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.length - 1));
        return sheet;
    }
    private void text(Row row, int index, Object value) {
        // Always use literal text cells, including values starting with '=', '+', '-' or '@'.
        row.createCell(index, CellType.STRING).setCellValue(value == null ? "" : value.toString());
    }
    private void date(Row row, int index, Object value, CellStyle style) {
        java.time.Instant instant = value instanceof java.time.OffsetDateTime offset ? offset.toInstant() : ((Timestamp) value).toInstant();
        row.createCell(index).setCellValue(LocalDateTime.ofInstant(instant, ZoneOffset.UTC));
        row.getCell(index).setCellStyle(style);
    }
}
