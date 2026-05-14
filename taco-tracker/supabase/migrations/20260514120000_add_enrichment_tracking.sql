-- Enrichment tracking columns populated by scripts/scrape-kakao.ts
ALTER TABLE restaurants
  ADD COLUMN photo_candidates       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN enrichment_confidence  TEXT
    CHECK (enrichment_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN needs_review           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN review_reason          TEXT;

-- Partial index for the curator review workflow:
-- "show me only rows that need review" stays fast as the table grows.
CREATE INDEX idx_restaurants_needs_review
  ON restaurants (needs_review)
  WHERE needs_review = TRUE;
