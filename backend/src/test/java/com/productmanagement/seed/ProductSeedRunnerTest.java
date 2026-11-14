package com.productmanagement.seed;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class ProductSeedRunnerTest {
    @Test void generatesTenThousandUniqueProductsInBoundedBatchesAndSkipsConflicts() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        List<Object[]> all = new ArrayList<>();
        when(jdbc.batchUpdate(anyString(), org.mockito.ArgumentMatchers.<List<Object[]>>any())).thenAnswer(call -> {
            List<Object[]> rows = call.getArgument(1);
            assertThat(rows).hasSize(500);
            all.addAll(rows);
            int[] results = new int[rows.size()];
            Arrays.fill(results, 1); results[0] = 0;
            return results;
        });
        new ProductSeedRunner(jdbc).run();
        assertThat(all).hasSize(10000);
        assertThat(all.stream().map(row -> row[1]).distinct().count()).isEqualTo(10000);
        assertThat(all.stream().filter(row -> row[7].equals("ACTIVE")).count()).isEqualTo(8000);
        assertThat(all.stream().filter(row -> row[7].equals("INACTIVE")).count()).isEqualTo(2000);
        assertThat(all.stream().map(row -> row[6]).distinct().count()).isEqualTo(10);
        verify(jdbc, times(20)).batchUpdate(contains("ON CONFLICT DO NOTHING"), org.mockito.ArgumentMatchers.<List<Object[]>>any());
    }
}
