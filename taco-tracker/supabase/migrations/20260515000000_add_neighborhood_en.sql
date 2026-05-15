-- Add English neighborhood name column for bilingual search support
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS neighborhood_en TEXT;

-- Populate from the curated translation map
UPDATE restaurants SET neighborhood_en = CASE neighborhood
  WHEN '강남구'   THEN 'Gangnam'
  WHEN '강동구'   THEN 'Gangdong'
  WHEN '강북구'   THEN 'Gangbuk'
  WHEN '강서구'   THEN 'Gangseo'
  WHEN '관악구'   THEN 'Gwanak'
  WHEN '광진구'   THEN 'Gwangjin'
  WHEN '금천구'   THEN 'Geumcheon'
  WHEN '동대문구' THEN 'Dongdaemun'
  WHEN '동작구'   THEN 'Dongjak'
  WHEN '마포구'   THEN 'Mapo'
  WHEN '서대문구' THEN 'Seodaemun'
  WHEN '서초구'   THEN 'Seocho'
  WHEN '성동구'   THEN 'Sangdong'
  WHEN '성북구'   THEN 'Seongbuk'
  WHEN '송파구'   THEN 'Songpa'
  WHEN '영등포구' THEN 'Yeongdong'
  WHEN '용산구'   THEN 'Yongsan'
  WHEN '원미구'   THEN 'Wonmi'
  WHEN '은평구'   THEN 'Eunpyeong'
  WHEN '일산동구' THEN 'Ilsan'
  WHEN '종로구'   THEN 'Jongro'
  WHEN '중구'     THEN 'Junggu'
END
WHERE neighborhood IS NOT NULL;
