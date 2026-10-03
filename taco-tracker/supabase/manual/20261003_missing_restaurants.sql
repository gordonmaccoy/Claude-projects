-- Review docs/missing-restaurants-20261003.md first.
-- Sources checked 2026-10-04 Korea time. Inserts DRAFT records only.
-- Five pins represent the sourced street-address building; Mattdol uses Michelin's
-- publisher location pin, corroborated within about 7m by its building location.
-- No entrance precision, ratings, dietary claims or photo rights are assumed.
-- Escondido floor omitted because official website (1F) conflicts with Michelin
-- and current operator job postings (B1).
-- No existing row is updated. A repeated run inserts no duplicate rows.
-- Requires initial schema plus enrichment tracking and neighborhood_en migrations.
-- Stored curator notes/hours are not yet selected by the existing frontend;
-- add the matching editorial slugs before publishing or wire database editorial data.
BEGIN;

WITH candidates (slug, name_ko, name_en, address_ko, address_base, address_en, neighborhood, neighborhood_en, lat, lng, phone, website, hours, curator_note_en, curator_note_ko, dish_tags, review_reason) AS (
  VALUES
  ('manual-escondido-hannam', '에스콘디도', 'Escondido', '서울 용산구 한남대로20길 61-7', '서울 용산구 한남대로20길 61-7', '61-7, Hannam-daero 20-gil, Yongsan-gu, Seoul', '용산구', 'Yongsan', 37.535124384862, 127.01055184798, '02-2038-8994', 'https://molinoproject.co.kr/escondido', '{"en":"Tue-Sat 17:15-19:15 / 19:30-22:00; reservation required","ko":"화-토 17:15-19:15 / 19:30-22:00, 예약 필수","source_url":"https://molinoproject.co.kr/escondido","checked_at":"2026-10-04","note":"Published source timetable; confirm before visiting."}'::jsonb, 'A reservation-only Mexican tasting-menu restaurant in Hannam. The nine-course menu can be paired with cocktails or agave spirits.', '한남동에서 예약제로 운영하는 멕시칸 코스 레스토랑입니다. 9가지 코스 요리에 칵테일이나 아가베 증류주 페어링을 곁들일 수 있습니다.', ARRAY['taco']::text[], 'Building address coordinate, entrance and photo pending. Floor conflict: operator website 1F; Michelin and operator job postings B1. Floor omitted. Details: https://molinoproject.co.kr/escondido Location: https://jusoga.com/b/1117013100100320048006082/서울특별시-용산구-한남대로20길-61-7-한남동' ),
  ('manual-el-molino-seongsu', '엘몰리노', 'El Molino', '서울 성동구 서울숲2길 19-18 1층', '서울 성동구 서울숲2길 19-18', '1F, 19-18, Seoulsup 2-gil, Seongdong-gu, Seoul', '성동구', 'Seongdong', 37.54744578432, 127.04113709236, '070-7575-0793', 'https://molinoproject.co.kr/elmolino', '{"en":"Tue-Fri 17:00-22:00; Sat-Sun 12:00-15:00 / 17:00-22:00; reservations recommended","ko":"화-금 17:00-22:00 · 토-일 12:00-15:00 / 17:00-22:00. 예약 권장","source_url":"https://molinoproject.co.kr/elmolino","checked_at":"2026-10-04","note":"Published source timetable; confirm before visiting."}'::jsonb, 'A casual Mexican restaurant near Seoul Forest. Its menu ranges from tacos and tostadas to gorditas, aguachile and mole.', '서울숲 근처의 캐주얼 멕시칸 레스토랑입니다. 타코와 토스타다뿐 아니라 고르디타, 아구아칠레, 몰레 등도 선보입니다.', ARRAY['taco']::text[], 'Building address coordinate, entrance and photo pending. Operator page has an erroneous repeated Escondido block; correct El Molino section used. Details: https://molinoproject.co.kr/elmolino Location: https://jusoga.com/b/1120011400106850325027670/서울특별시-성동구-서울숲2길-19-18-성수동1가' ),
  ('manual-la-calle-sindang', '라까예', 'La Calle', '서울 중구 퇴계로85길 42 1층', '서울 중구 퇴계로85길 42', '1F, 42, Toegye-ro 85-gil, Jung-gu, Seoul', '중구', 'Jung', 37.567677081046, 127.01972732216, '070-7776-8777', 'https://molinoproject.co.kr/lacalle', '{"en":"Tue-Fri 17:00-22:00; Sat-Sun 12:00-15:00 / 17:00-22:00; walk-ins only","ko":"화-금 17:00-22:00 · 토-일 12:00-15:00 / 17:00-22:00. 현장 방문만 가능","source_url":"https://molinoproject.co.kr/lacalle","checked_at":"2026-10-04","note":"Published source timetable; confirm before visiting."}'::jsonb, 'A walk-in taqueria inside Sindang Central Market. Its street-style menu includes al pastor, suadero and barbacoa tacos.', '신당 중앙시장 안의 멕시칸 타코 전문점입니다. 알 파스토르, 수아데로, 바르바코아 타코를 선보이며 현장 방문으로 이용합니다.', ARRAY['taco']::text[], 'Building address coordinate, entrance and photo pending. Details: https://molinoproject.co.kr/lacalle Location: https://jusoga.com/b/1114016500104580000002314/서울특별시-중구-퇴계로85길-42-황학동' ),
  ('manual-pescaderia-gyeongdong', '페스카데리아', 'Pescadería', '서울 동대문구 경동시장로10길 51', '서울 동대문구 경동시장로10길 51', '51, Gyeongdongsijang-ro 10-gil, Dongdaemun-gu, Seoul', '동대문구', 'Dongdaemun', 37.581381517515, 127.04356407318, '02-6956-7978', 'https://molinoproject.co.kr/pescaderia', '{"en":"Tue-Sun 17:00-23:00; last order 21:30; walk-ins only","ko":"화-일 17:00-23:00 · 마지막 주문 21:30. 현장 방문만 가능","source_url":"https://molinoproject.co.kr/pescaderia","checked_at":"2026-10-04","note":"Published source timetable; confirm before visiting."}'::jsonb, 'A seafood-focused Mexican restaurant in Gyeongdong Market. Fish tacos, aguachile and seasonal seafood dishes are part of the menu.', '경동시장에 있는 해산물 중심의 멕시칸 레스토랑입니다. 피시 타코, 아구아칠레와 계절 해산물 요리를 선보입니다.', ARRAY['taco']::text[], 'Building address coordinate, floor, entrance and photo pending. Older posts disagree on days; current operator timetable used. Details: https://molinoproject.co.kr/pescaderia Location: https://jusoga.com/b/1123010300104860029034413/서울특별시-동대문구-경동시장로10길-51-제기동' ),
  ('manual-bistro-mexi-itaewon', '비스트로 멕시', 'bistroMEXI', '서울 용산구 이태원로 191 2층', '서울 용산구 이태원로 191', '2F, 191, Itaewon-ro, Yongsan-gu, Seoul', '용산구', 'Yongsan', 37.534747929322, 126.99520929093, '02-797-6855', 'https://mykinc.co.kr/', '{"en":"Sun-Wed 17:00-02:00 next day; Thu 17:00-03:00 next day; Fri-Sat 17:00-04:00 next day; confirm kitchen last order","ko":"일-수 17:00-다음 날 02:00 · 목 17:00-다음 날 03:00 · 금-토 17:00-다음 날 04:00. 주방 마감 시간은 별도 확인","source_url":"https://mykinc.co.kr/","checked_at":"2026-10-04","note":"Published source timetable; confirm before visiting."}'::jsonb, 'An Itaewon Mexican lounge pub with tacos, nachos and guacamole for sharing. Tequila and mezcal feature on its drinks menu, with service extending late into the night.', '이태원의 멕시칸 라운지 펍으로 타코, 나초, 과카몰리 등을 함께 나누기 좋습니다. 테킬라와 메즈칼을 곁들일 수 있으며 늦은 시간까지 운영합니다.', ARRAY['taco', 'nachos', 'guacamole']::text[], 'Building address coordinate, entrance and photo pending. Venue hours extend into next day; kitchen last-order time not verified. Details: https://mykinc.co.kr/ Location: https://jusoga.com/b/1117013000101230026009559/서울특별시-용산구-이태원로-191-이태원동' ),
  ('manual-mattdol-seongsu', '맷돌', 'Mattdol', '서울 성동구 성덕정길 63', '서울 성동구 성덕정길 63', '63, Seongdeokjeong-gil, Seongdong-gu, Seoul', '성동구', 'Seongdong', 37.53808, 127.05065, '010-4886-2928', 'https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/mattdol', '{"en":"Tue-Sat 18:00-21:00; Sun-Mon closed; reservations handled directly by the restaurant","ko":"화-토 18:00-21:00 · 일-월 휴무. 예약은 식당에 직접 문의","source_url":"https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/mattdol","checked_at":"2026-10-04","note":"Published source timetable; confirm before visiting."}'::jsonb, 'A Seongsu Mexican restaurant where chef Chang-yun Lee makes tortillas from masa. Tacos and tostadas combine Mexican techniques with Korea''s seasonal ingredients.', '이창윤 셰프가 마사 반죽으로 토르티야를 만드는 성수동 멕시칸 레스토랑입니다. 한국의 제철 식재료를 타코와 토스타다에 활용합니다.', ARRAY['taco']::text[], 'Michelin publisher location pin independently corroborated by street-address building within about 7 metres; exact entrance, floor and photo pending. Details: https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/mattdol Location: https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/mattdol' )
), inserted AS (
  INSERT INTO public.restaurants (
    status, slug, name_ko, name_en, address_ko, address_en,
    neighborhood, neighborhood_en, lat, lng, phone, website, hours,
    curator_note_en, curator_note_ko, dish_tags, cuisine, source,
    last_verified_at, enrichment_confidence, needs_review, review_reason
  )
  SELECT
    'draft'::restaurant_status, c.slug, c.name_ko, c.name_en,
    c.address_ko, c.address_en, c.neighborhood, c.neighborhood_en,
    c.lat, c.lng, c.phone, c.website, c.hours,
    c.curator_note_en, c.curator_note_ko, c.dish_tags, 'mexican', 'manual',
    TIMESTAMPTZ '2026-10-04 00:00:00+09', 'medium', TRUE, c.review_reason
  FROM candidates c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.slug = c.slug
      OR regexp_replace(lower(coalesce(r.name_en, '')), '[[:space:][:punct:]]', '', 'g')
         = regexp_replace(lower(c.name_en), '[[:space:][:punct:]]', '', 'g')
      OR regexp_replace(r.name_ko, '[[:space:][:punct:]]', '', 'g')
         = regexp_replace(c.name_ko, '[[:space:][:punct:]]', '', 'g')
      OR trim(regexp_replace(r.address_ko, '^서울특별시[[:space:]]+', '서울 '))
         = c.address_base
      OR trim(regexp_replace(r.address_ko, '^서울특별시[[:space:]]+', '서울 '))
         LIKE c.address_base || ' %'
  )
  ON CONFLICT DO NOTHING
  RETURNING slug, name_en, address_ko, status, needs_review
)
SELECT * FROM inserted ORDER BY name_en;

COMMIT;

-- Review saved drafts in the Supabase Table Editor. Publish individually after
-- map/source review; do not bulk-clear needs_review while entrance/photos remain.

