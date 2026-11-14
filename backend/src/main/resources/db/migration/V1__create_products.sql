CREATE TABLE products (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(4000),
    price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    product_type VARCHAR(32) NOT NULL CHECK (product_type IN (
        'ELECTRONICS', 'FURNITURE', 'GAMES', 'COMPUTING', 'APPLIANCES',
        'CLOTHING', 'BOOKS', 'SPORTS', 'BEAUTY', 'HOME_AND_DECOR'
    )),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    image_key VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

-- Reserve codes regardless of case and product status, including concurrent requests.
CREATE UNIQUE INDEX ux_products_code_lower ON products (LOWER(code));
-- Support the default active-products listing with deterministic pagination.
CREATE INDEX ix_products_status_created_id ON products (status, created_at DESC, id);
-- Support category and price-range queries.
CREATE INDEX ix_products_type_price ON products (product_type, price);
