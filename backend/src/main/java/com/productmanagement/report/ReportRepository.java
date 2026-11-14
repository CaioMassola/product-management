package com.productmanagement.report;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import com.productmanagement.product.ProductStatus;
import com.productmanagement.product.ProductType;

@Repository
public class ReportRepository {
    public static final Map<String, String> SORT_FIELDS = Map.of("filename", "filename", "requestedAt", "requested_at",
        "status", "status", "startedAt", "started_at", "completedAt", "completed_at");
    private final JdbcTemplate jdbc;
    public ReportRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static Instant instant(ResultSet row, String name) throws SQLException {
        var timestamp = row.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant();
    }
    private static final RowMapper<ReportRecord> MAPPER = (row, number) -> {
        String type = row.getString("product_type"), status = row.getString("product_status");
        return new ReportRecord(row.getObject("id", UUID.class), row.getString("filename"),
            ReportStatus.valueOf(row.getString("status")), instant(row, "requested_at"), instant(row, "started_at"),
            instant(row, "completed_at"), new ReportRequest(type == null ? null : ProductType.valueOf(type),
            status == null ? null : ProductStatus.valueOf(status), row.getBigDecimal("min_price"), row.getBigDecimal("max_price")),
            row.getString("file_key"), row.getObject("file_size", Long.class), row.getString("error_message"),
            row.getObject("processing_token", UUID.class), instant(row, "lease_until"), row.getInt("attempts"));
    };

    public Optional<ReportRecord> find(UUID id) {
        return jdbc.query("SELECT * FROM reports WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public Page<ReportRecord> search(ReportSearch filter, Pageable pageable) {
        filter.validate();
        var predicates = new ArrayList<String>();
        var values = new ArrayList<Object>();
        if (filter.name() != null && !filter.name().isBlank()) {
            predicates.add("LOWER(filename) LIKE ? ESCAPE '!'");
            values.add("%" + filter.name().strip().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
        }
        if (filter.status() != null) {predicates.add("status = ?"); values.add(filter.status().name());}
        if (filter.productType() != null) {predicates.add("product_type = ?"); values.add(filter.productType().name());}
        if (filter.productStatus() != null) {predicates.add("product_status = ?"); values.add(filter.productStatus().name());}
        if (filter.minPrice() != null) {predicates.add("min_price = ?"); values.add(filter.minPrice());}
        if (filter.maxPrice() != null) {predicates.add("max_price = ?"); values.add(filter.maxPrice());}
        if (filter.requestedFrom() != null) {predicates.add("requested_at >= ?"); values.add(Timestamp.from(filter.requestedFrom()));}
        if (filter.requestedTo() != null) {predicates.add("requested_at < ?"); values.add(Timestamp.from(filter.requestedTo()));}
        String where = predicates.isEmpty() ? "" : " WHERE " + String.join(" AND ", predicates);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM reports" + where, Long.class, values.toArray());
        var ordering = new ArrayList<String>();
        for (var order : pageable.getSort()) {
            String column = SORT_FIELDS.get(order.getProperty());
            if (column == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid report sort field");
            ordering.add(column + " " + order.getDirection().name() + " NULLS LAST");
        }
        ordering.add("id ASC");
        values.add(pageable.getPageSize()); values.add(pageable.getOffset());
        var records = jdbc.query("SELECT * FROM reports" + where + " ORDER BY " + String.join(", ", ordering) + " LIMIT ? OFFSET ?", MAPPER, values.toArray());
        return new PageImpl<>(records, pageable, total);
    }

    public long activeCount() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM reports WHERE status IN ('PENDING', 'PROCESSING')", Long.class);
    }

    public List<ReportRecord> expired(Instant now) {
        return jdbc.query("SELECT * FROM reports WHERE status = 'PROCESSING' AND lease_until < ? ORDER BY lease_until LIMIT 50", MAPPER, Timestamp.from(now));
    }

    public boolean claim(UUID id, UUID token, Instant now) {
        return jdbc.update("""
            UPDATE reports SET status = 'PROCESSING', started_at = COALESCE(started_at, ?),
                processing_token = ?, lease_until = ?, attempts = attempts + 1, error_message = NULL
            WHERE id = ? AND status = 'PENDING' AND attempts < 3
            """, Timestamp.from(now), token, Timestamp.from(now.plusSeconds(120)), id) == 1;
    }

    public boolean heartbeat(UUID id, UUID token, Instant now) {
        return jdbc.update("""
            UPDATE reports SET lease_until = ? WHERE id = ? AND status = 'PROCESSING'
                AND processing_token = ? AND lease_until >= ?
            """, Timestamp.from(now.plusSeconds(120)), id, token, Timestamp.from(now)) == 1;
    }

    public boolean complete(UUID id, UUID token, String key, long size, Instant now) {
        return jdbc.update("""
            UPDATE reports SET status = 'COMPLETED', completed_at = ?, file_key = ?, file_size = ?,
                processing_token = NULL, lease_until = NULL, error_message = NULL
            WHERE id = ? AND status = 'PROCESSING' AND processing_token = ? AND lease_until >= ?
            """, Timestamp.from(now), key, size, id, token, Timestamp.from(now)) == 1;
    }
}
