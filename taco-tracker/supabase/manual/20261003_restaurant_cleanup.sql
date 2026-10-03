-- Run once in the Taco Map Supabase SQL Editor after reviewing the affected rows.
-- This archives the joke record and removes non-numeric phone placeholders.
BEGIN;

UPDATE restaurants
SET status = 'archived'
WHERE slug = 'just-some-empty-building'
  AND status <> 'archived';

UPDATE restaurants
SET phone = NULL
WHERE phone = '연락처를 알려주세요';

COMMIT;
