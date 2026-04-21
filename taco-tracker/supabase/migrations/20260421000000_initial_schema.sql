-- Enums
CREATE TYPE restaurant_status AS ENUM ('draft', 'live', 'archived');

CREATE TYPE restaurant_style AS ENUM (
  'authentic_mexican',
  'tex_mex',
  'cal_mex',
  'korean_fusion',
  'other'
);

-- Restaurants table
CREATE TABLE restaurants (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status                  restaurant_status NOT NULL DEFAULT 'draft',
  slug                    TEXT        UNIQUE NOT NULL,
  name_ko                 TEXT        NOT NULL,
  name_en                 TEXT,
  kakao_place_id          TEXT        UNIQUE,
  address_ko              TEXT        NOT NULL,
  address_en              TEXT,
  neighborhood            TEXT,
  lat                     DOUBLE PRECISION NOT NULL,
  lng                     DOUBLE PRECISION NOT NULL,
  phone                   TEXT,
  hours                   JSONB,
  website                 TEXT,
  instagram               TEXT,
  cuisine                 TEXT        NOT NULL DEFAULT 'mexican'
                            CHECK (cuisine IN ('mexican', 'halal', 'vegan', 'vegetarian')),
  style                   restaurant_style,
  dish_tags               TEXT[]      NOT NULL DEFAULT '{}',
  price_band              SMALLINT    CHECK (price_band BETWEEN 1 AND 3),
  curator_rating          NUMERIC(2,1) CHECK (curator_rating BETWEEN 1.0 AND 5.0),
  curator_note_ko         TEXT,
  curator_note_en         TEXT,
  cover_photo_url         TEXT,
  cover_photo_alt_ko      TEXT,
  cover_photo_alt_en      TEXT,
  source                  TEXT        CHECK (source IN ('kakao', 'manual', 'submission')),
  last_verified_at        TIMESTAMPTZ,
  has_vegetarian_options  BOOLEAN,
  has_vegan_options       BOOLEAN,
  is_halal                BOOLEAN,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions table
CREATE TABLE submissions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name     TEXT        NOT NULL,
  location_hint       TEXT,
  notes               TEXT,
  submitter_email     TEXT,
  submitter_name      TEXT,
  submitter_ip_hash   TEXT,
  status              TEXT        NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'reviewed', 'converted', 'rejected')),
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_restaurants_status
  ON restaurants (status);

CREATE INDEX idx_restaurants_lat_lng
  ON restaurants (lat, lng);

CREATE INDEX idx_restaurants_dish_tags
  ON restaurants USING GIN (dish_tags);

CREATE INDEX idx_submissions_status_created
  ON submissions (status, created_at DESC);

-- Auto-update updated_at on restaurants
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
