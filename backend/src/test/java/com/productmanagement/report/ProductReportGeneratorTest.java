package com.productmanagement.report;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class ProductReportGeneratorTest {
    @TempDir Path directory;
    @Test void splitsWorksheetsAtTheirConfiguredBoundaryAndWritesBothJdbcTimestampTypes() throws Exception {
        var jdbc=mock(JdbcTemplate.class);
        var rows=new ArrayList<Map<String,Object>>();
        for(int i=0;i<3;i++){
            var row=new HashMap<String,Object>();row.put("id",UUID.randomUUID());row.put("code","CODE-"+i);row.put("title","=Literal");row.put("price",12.5);row.put("quantity",2);row.put("product_type","GAMES");row.put("status","ACTIVE");
            row.put("created_at",OffsetDateTime.now(ZoneOffset.UTC));row.put("updated_at",java.sql.Timestamp.from(Instant.now()));rows.add(row);
        }
        when(jdbc.queryForList(anyString(),any(Object[].class))).thenReturn(rows);
        var path=directory.resolve("report.xlsx");new ProductReportGenerator(jdbc,3).generate(new ReportRequest(null,null,null,null),path,()->{});
        try(var stream=Files.newInputStream(path);var book=new XSSFWorkbook(stream)){
            assertThat(book.getNumberOfSheets()).isEqualTo(2);
            assertThat(book.getSheetAt(0).getLastRowNum()).isEqualTo(2);
            assertThat(book.getSheetAt(1).getLastRowNum()).isEqualTo(1);
            assertThat(book.getSheetAt(0).getRow(1).getCell(2).getStringCellValue()).isEqualTo("=Literal");
        }
        assertThatThrownBy(()->new ProductReportGenerator(jdbc,1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new ProductReportGenerator(jdbc,1_048_577)).isInstanceOf(IllegalArgumentException.class);
    }
}
