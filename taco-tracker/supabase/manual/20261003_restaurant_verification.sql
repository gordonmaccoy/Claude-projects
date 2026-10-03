-- Run in Taco Map Supabase SQL Editor. Evidence: docs/restaurant-verification-20261003.md
-- One archive, two guarded location corrections, one name correction, seven review flags.
-- Pins below locate corroborated buildings; storefront entrances remain unverified.
BEGIN;

-- Operator announced closure effective 2026-08-31.
UPDATE public.restaurants SET status = 'archived'
WHERE slug = 'place-26854841' AND name_ko = '바토스 잠실점'
  AND address_ko = '서울 송파구 올림픽로 240' AND status = 'live'
RETURNING slug, name_en, status;

UPDATE public.restaurants SET name_en = 'Gamsung Taco (Hapjeong)'
WHERE slug = 'place-922397405' AND name_ko = '감성타코&그릴 합정점'
  AND name_en = 'Gamsa Taco (Hapjeong)'
RETURNING slug, name_en;

-- Operator address plus employer-published building coordinates.
UPDATE public.restaurants
SET address_ko = '서울 강서구 마곡중앙로 76 1층 124호', address_en = NULL,
    lat = 37.56042014713966, lng = 126.82747381163998,
    instagram = COALESCE(NULLIF(instagram, ''), 'https://www.instagram.com/burrito_king_magok/'),
    needs_review = TRUE, enrichment_confidence = 'medium',
    review_reason = CONCAT_WS('; ', NULLIF(review_reason, ''),
      'Audit 2026-10-03: Magok address corroborated; building pin corrected; exact storefront entrance remains unverified')
WHERE slug = 'place-547966883' AND name_ko = '부리또킹'
  AND address_ko = '서울 강서구 공항대로41길 34'
  AND ABS(lat - 37.5592794883264) < 0.00001
  AND ABS(lng - 126.845711960951) < 0.00001 AND status = 'live'
RETURNING slug, name_en, address_ko, lat, lng, needs_review;

-- Current Hwaseo address corroborated; Findby supplies building coordinate.
UPDATE public.restaurants
SET address_ko = '경기 수원시 팔달구 화산로6번길 7-6 1층', address_en = NULL,
    lat = 37.2856424, lng = 126.9864411,
    instagram = COALESCE(NULLIF(instagram, ''), 'https://www.instagram.com/hola_mexico_suwon/'),
    needs_review = TRUE, enrichment_confidence = 'medium',
    review_reason = CONCAT_WS('; ', NULLIF(review_reason, ''),
      'Audit 2026-10-03: Hwaseo relocation corroborated; building pin corrected; exact storefront entrance remains unverified')
WHERE slug = 'place-1160698851' AND name_ko = '올라메히꼬'
  AND address_ko = '경기 수원시 팔달구 신풍로23번길 59 1층'
  AND ABS(lat - 37.2836864649882) < 0.00001
  AND ABS(lng - 127.011722048307) < 0.00001 AND status = 'live'
RETURNING slug, name_en, address_ko, lat, lng, needs_review;

-- Keep uncertain venues live. Preserve prior notes and do not duplicate audit notes.
WITH review_flags(slug, expected_name_ko, note) AS (
  VALUES
    ('place-927771194', '도쎄멕시칸', 'Audit 2026-10-03: Seoul Forest branch has conflicting closure information; confirm branch-specific operating status'),
    ('place-1307871510', '크레이지타코', 'Audit 2026-10-03: Seongshin branch has conflicting closure information; confirm current operating status'),
    ('place-1800438494', '부리또 카르텔', 'Audit 2026-10-03: Kakao URL returns HTTP 400; possible tenant/name change to The Taco Booth LAB needs confirmation'),
    ('place-346172199', '타코타코', 'Audit 2026-10-03: Kakao URL returns HTTP 400; confirm Namsa venue identity, Mexican-food category and operating status'),
    ('place-1646775993', '마이밤타코 평택고덕점', 'Audit 2026-10-03: Address corroborated; approximately 119m pin discrepancy needs storefront entrance verification'),
    ('place-449831974', '베어스타코 동탄호수점', 'Audit 2026-10-03: Address corroborated; approximately 173m pin discrepancy needs lake-side entrance verification'),
    ('place-1224729560', '스탠딩타코', 'Audit 2026-10-03: Address corroborated; approximately 127m pin discrepancy needs storefront and Mexican-food category verification')
)
UPDATE public.restaurants AS r
SET needs_review = TRUE,
    review_reason = CASE WHEN POSITION(f.note IN COALESCE(r.review_reason, '')) > 0
      THEN r.review_reason ELSE CONCAT_WS('; ', NULLIF(r.review_reason, ''), f.note) END
FROM review_flags AS f
WHERE r.slug = f.slug AND r.name_ko = f.expected_name_ko AND r.status = 'live'
  AND (NOT r.needs_review OR POSITION(f.note IN COALESCE(r.review_reason, '')) = 0)
RETURNING r.slug, r.name_en, r.status, r.needs_review, r.review_reason;

COMMIT;

-- Resulting state. Zero updated rows may mean guarded data changed or script was run.
SELECT slug, name_en, status, address_ko, lat, lng, needs_review, review_reason
FROM public.restaurants WHERE slug IN (
  'place-892514586', 'place-922397405', 'place-927771194', 'place-1912596883',
  'place-154934254', 'place-26854841', 'place-1800438494', 'place-1918558831',
  'place-1307871510', 'place-483520479', 'place-346172199', 'place-1646775993',
  'place-449831974', 'place-547966883', 'place-1224729560', 'place-1160698851'
) ORDER BY name_en, slug;
