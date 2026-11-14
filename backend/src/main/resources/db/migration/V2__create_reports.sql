CREATE TABLE reports (
    id UUID PRIMARY KEY,
    filename VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    product_type VARCHAR(32) CHECK (product_type IN ('ELECTRONICS', 'FURNITURE', 'GAMES', 'COMPUTING', 'APPLIANCES', 'CLOTHING', 'BOOKS', 'SPORTS', 'BEAUTY', 'HOME_AND_DECOR')),
    product_status VARCHAR(16) CHECK (product_status IN ('ACTIVE', 'INACTIVE')),
    min_price NUMERIC(14,2) CHECK (min_price >= 0),
    max_price NUMERIC(14,2) CHECK (max_price >= 0),
    file_key VARCHAR(512),
    file_size BIGINT CHECK (file_size >= 0),
    error_message VARCHAR(200),
    processing_token UUID,
    lease_until TIMESTAMP WITH TIME ZONE,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price),
    CHECK (status <> 'COMPLETED' OR (file_key IS NOT NULL AND file_size IS NOT NULL AND completed_at IS NOT NULL)),
    CHECK (status <> 'PROCESSING' OR (processing_token IS NOT NULL AND lease_until IS NOT NULL))
);

-- Allocate unique second-resolution names while preserving the required filename format.
CREATE TABLE report_filename_clock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_second TIMESTAMP WITH TIME ZONE NOT NULL
);
INSERT INTO report_filename_clock (id, last_second) VALUES (1, '1970-01-01 00:00:00+00');

CREATE TABLE report_outbox (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES reports(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER NOT NULL DEFAULT 0,
    dispatch_token UUID,
    dispatch_lease_until TIMESTAMP WITH TIME ZONE
);

-- Default report history and status queries.
CREATE INDEX ix_reports_requested_id ON reports (requested_at DESC, id);
CREATE INDEX ix_reports_status_requested ON reports (status, requested_at DESC);
-- Recovery scans and bounded due-event dispatch.
CREATE INDEX ix_reports_status_lease ON reports (status, lease_until);
CREATE INDEX ix_report_outbox_due ON report_outbox (published_at, available_at);
