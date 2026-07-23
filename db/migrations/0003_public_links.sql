BEGIN;

CREATE TABLE IF NOT EXISTS public_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_key VARCHAR(80) NOT NULL UNIQUE,
  title_ar VARCHAR(200) NOT NULL,
  url TEXT NOT NULL,
  link_type VARCHAR(40) NOT NULL DEFAULT 'general'
    CHECK (link_type IN ('official_hub','whatsapp','instagram','tiktok','snapchat','map','ordering','general')),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_links_active_order
  ON public_links(is_active, sort_order, link_key);

DROP TRIGGER IF EXISTS trg_public_links_updated_at ON public_links;
CREATE TRIGGER trg_public_links_updated_at
  BEFORE UPDATE ON public_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
