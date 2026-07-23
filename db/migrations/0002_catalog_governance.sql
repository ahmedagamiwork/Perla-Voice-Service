BEGIN;

CREATE TABLE IF NOT EXISTS catalog_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(240) NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  catalog_version VARCHAR(80),
  product_count INTEGER NOT NULL CHECK (product_count >= 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_sha256)
);

CREATE TABLE IF NOT EXISTS product_price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price_sar NUMERIC(12,2),
  new_price_sar NUMERIC(12,2) NOT NULL,
  source_name VARCHAR(240),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_product_price_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.price_sar IS DISTINCT FROM NEW.price_sar THEN
    INSERT INTO product_price_history(product_id, old_price_sar, new_price_sar, source_name)
    VALUES(NEW.id, CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.price_sar END, NEW.price_sar, NEW.source_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_price_history ON products;
CREATE TRIGGER trg_product_price_history
AFTER INSERT OR UPDATE OF price_sar ON products
FOR EACH ROW EXECUTE FUNCTION log_product_price_change();

CREATE OR REPLACE VIEW voice_product_catalog AS
SELECT p.product_code,
       p.name_ar,
       p.price_sar,
       p.unit_code,
       p.unit_ar,
       c.name_ar AS category_ar,
       p.description_ar,
       p.ingredients_ar,
       p.allergens_ar,
       p.preparation_minutes,
       p.serving_notes_ar,
       p.pronunciation_hint,
       p.is_active,
       COALESCE(jsonb_agg(DISTINCT pa.alias_ar) FILTER (WHERE pa.id IS NOT NULL), '[]'::jsonb) AS aliases_ar
FROM products p
LEFT JOIN categories c ON c.id=p.category_id
LEFT JOIN product_aliases pa ON pa.product_id=p.id
GROUP BY p.id,c.name_ar;

COMMIT;
