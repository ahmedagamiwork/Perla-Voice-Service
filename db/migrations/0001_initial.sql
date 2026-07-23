BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name_ar VARCHAR(160) NOT NULL,
  normalized_name_ar VARCHAR(160) NOT NULL,
  voice_pronunciation VARCHAR(160),
  city_ar VARCHAR(120),
  phone VARCHAR(40),
  whatsapp VARCHAR(40),
  transfer_phone VARCHAR(40),
  address_ar TEXT,
  map_url TEXT,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Riyadh',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(160) NOT NULL UNIQUE,
  normalized_name_ar VARCHAR(160) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code VARCHAR(40) NOT NULL UNIQUE,
  name_ar VARCHAR(240) NOT NULL,
  normalized_name_ar VARCHAR(240) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price_sar NUMERIC(12,2) NOT NULL CHECK (price_sar >= 0),
  unit_code VARCHAR(40) NOT NULL,
  unit_ar VARCHAR(80) NOT NULL,
  description_ar TEXT,
  ingredients_ar TEXT,
  allergens_ar TEXT,
  preparation_minutes INTEGER CHECK (preparation_minutes IS NULL OR preparation_minutes >= 0),
  serving_notes_ar TEXT,
  pronunciation_hint VARCHAR(240),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_name VARCHAR(240),
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alias_ar VARCHAR(240) NOT NULL,
  normalized_alias_ar VARCHAR(240) NOT NULL,
  pronunciation_hint VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, normalized_alias_ar)
);

CREATE TABLE IF NOT EXISTS branch_product_availability (
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  availability_status VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('available','unavailable','unknown')),
  availability_note_ar TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(branch_id, product_id)
);

CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  note_ar VARCHAR(240),
  UNIQUE(branch_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS business_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key VARCHAR(80) NOT NULL UNIQUE,
  title_ar VARCHAR(200) NOT NULL,
  content_ar TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_conversation_id VARCHAR(200),
  channel VARCHAR(30) NOT NULL DEFAULT 'voice',
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  caller_phone_hash CHAR(64),
  language_code VARCHAR(20),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary_ar TEXT,
  outcome VARCHAR(40),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_external ON conversations(external_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at DESC);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(32) NOT NULL UNIQUE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  request_type VARCHAR(40) NOT NULL,
  customer_name_enc TEXT,
  customer_phone_enc TEXT,
  customer_phone_hash CHAR(64),
  details_ar TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','assigned','in_progress','resolved','cancelled')),
  assigned_to VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_phone_hash ON service_requests(customer_phone_hash);

CREATE TABLE IF NOT EXISTS order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(32) NOT NULL UNIQUE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  customer_name_enc TEXT,
  customer_phone_enc TEXT,
  customer_phone_hash CHAR(64),
  fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_type IN ('pickup','delivery')),
  requested_date DATE,
  requested_time TIME,
  delivery_address_enc TEXT,
  notes_ar TEXT,
  estimated_total_sar NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_total_sar >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','needs_review','approved','rejected','expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_draft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_draft_id UUID NOT NULL REFERENCES order_drafts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_code_snapshot VARCHAR(40) NOT NULL,
  product_name_snapshot VARCHAR(240) NOT NULL,
  unit_snapshot VARCHAR(80) NOT NULL,
  unit_price_snapshot NUMERIC(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  line_total_sar NUMERIC(12,2) NOT NULL CHECK (line_total_sar >= 0),
  notes_ar TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_drafts_status ON order_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_drafts_phone_hash ON order_drafts(customer_phone_hash);

CREATE TABLE IF NOT EXISTS tool_audit (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  tool_name VARCHAR(100) NOT NULL,
  client_label VARCHAR(100),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  arguments_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_audit_created ON tool_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_audit_tool ON tool_audit(tool_name, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  changes_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_normalized_name ON products(normalized_name_ar);
CREATE INDEX IF NOT EXISTS idx_product_aliases_normalized ON product_aliases(normalized_alias_ar);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, is_active);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON service_requests;
CREATE TRIGGER trg_service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_order_drafts_updated_at ON order_drafts;
CREATE TRIGGER trg_order_drafts_updated_at BEFORE UPDATE ON order_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
