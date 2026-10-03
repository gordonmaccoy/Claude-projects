# Restaurant link and location verification

Public-source checks performed 3 October 2026 (Korea). Scope: 11 questionable Kakao URLs and five map pins. This is not a telephone or on-site inspection.

## Findings

Nine of the 11 Kakao URLs now return HTTP 200 with the expected title. Previous failures were partly temporary. A responding place page does not prove a restaurant remains open.

Vatos Jamsil's operator announced its closure, effective 31 August 2026. Burrito King's current Magok address and Hola Mexico's Hwaseo address differ from the app's records. Both location corrections below use independently published building coordinates, not map-provider API exports. Exact storefront entrances remain unverified.

## Eleven link checks

| Restaurant / slug | Link check | Evidence and action |
| --- | --- | --- |
| Gamsung Taco Hongdae / `place-892514586` | HTTP 200, matching title | [Brand](https://www.instagram.com/gamsungtaco/) includes Hongdae. [Directory](https://www.diningcode.com/profile.php?rid=1teeNcuJ6NA8) matches address and phone. A closed corporate registration is insufficient to establish restaurant closure. Keep. |
| Gamsung Taco Hapjeong / `place-922397405` | HTTP 200, matching title | Existing Korean name and [brand](https://www.instagram.com/gamsungtaco/) agree. Correct English Gamsa to Gamsung; these are different brands. |
| Doce Seoul Forest / `place-927771194` | HTTP 200, matching title | [Polle](https://polle.com/place/2XkvIV/) marks closed; [VisitKorea](https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=694fad82-2102-4083-a841-de8447a10aef) retains listing. [Operator](https://www.instagram.com/doce.seoul/) also covers Gasan, so brand activity does not verify this branch. Flag, keep pending confirmation. |
| Rey del Taco / `place-1912596883` | HTTP 200, matching title | [Operator](https://www.instagram.com/reydeltaco.official/) gives 18 Dongmak-ro 2-gil, matching app. Keep. |
| Mammoth Taco Isu / `place-154934254` | HTTP 200, matching title | [Employer](https://www.albamon.com/jobs/detail-company/pxtsW1ByEyxdsmy_exrnBg%3D%3D) and [location-specific review](https://polle.com/ym35948459/posts/1) corroborate venue historically. No strong closure evidence; current hours remain unverified. Keep. |
| Vatos Jamsil / `place-26854841` | HTTP 200, matching title | [Operator announcement](https://www.instagram.com/p/Dcr6XtVyqrS/), author vatoskorea, posted 30 August 2026, specifies closure on 31 August. Archive this branch only. |
| Burrito Cartel / `place-1800438494` | HTTP 400 on both checks | [Shinsegae announcement](https://www.instagram.com/p/DOFX8abj2Wo/) corroborates brand; [visit report](https://lovelysk.tistory.com/846) mentions possible change to The Taco Booth LAB. Confirm current tenant/name and replacement link. Do not archive solely for HTTP error. |
| Yumi Taco Sharosugil / `place-1918558831` | HTTP 200, matching title | [Employer](https://www.albamon.com/jobs/detail-company/o7dW-C6QeVfYxzcAENJ6DQ%3D%3D) gives same address and September 2026 establishment date. [Business profile](https://www.daangn.com/kr/local-profile/유미타코-샤로수길점-9u18fqbq7wr9/) mentions reopening. Keep. |
| Crazy Taco Seongshin / `place-1307871510` | HTTP 200, matching title | [Operator](https://www.instagram.com/crazytaco_official/) matches address, but [Polle](https://polle.com/place/3nHYtx/) marks closed. Historical opening notice cannot settle current status. Flag, keep pending confirmation. |
| Taco Eats Gwanggyo / `place-483520479` | HTTP 200, matching title | [Directory](https://polle.com/place/2o1MWn/) matches address; [promotional campaign](https://dinnerqueen.net/taste/1297865) corroborates venue. Keep, current hours unverified. |
| Taco Taco Namsa / `place-346172199` | HTTP 400 on both checks | No reliable restaurant-specific operator source located. Building existence does not verify restaurant existence or cuisine. Flag identity, Mexican-food category and operating status. Keep pending check. |

## Five map checks

| Restaurant / slug | Evidence | Action |
| --- | --- | --- |
| My Bomb Taco Pyeongtaek / `place-1646775993` | [MFDS](https://www.foodsafetykorea.go.kr/portal/petKorea.do) gives 77 Godeokgukje-daero, building 301, 2F unit 2119. [Operator](https://www.instagram.com/mybomb_taco/) matches phone. | Keep coordinates; flag approximately 119m entrance discrepancy. |
| Bear's Taco Dongtan / `place-449831974` | [Directory](https://www.diningcode.com/profile.php?rid=h5nGUgEuDUIM) and [place listing](https://www.placeview.co.kr/id/NDQ5ODMxOTc0) match 181 Dongtan-daero, B3. Reviews mention lake-side CU entrance. | Keep coordinates; flag approximately 173m discrepancy. |
| Burrito King / `place-547966883` | [Operator](https://www.instagram.com/burrito_king_magok/) gives 76 Magokjungang-ro. [Employer](https://www.albamon.com/jobs/detail-company/5m_c8pQhxUvrLGKRBixtWw%3D%3D) gives same building and public address coordinates 37.56042014713966, 126.82747381163998. [Business profile](https://www.daangn.com/kr/local-profile/부리또킹-마곡본점-4nnfmka38xpn/) gives 1F unit 124. | Correct stale address; proposed building pin moves approximately 1.61km west. Exact entrance remains flagged. This does not establish the date or circumstances of any move. |
| Standing Taco / `place-1224729560` | [Address directory](https://findby.co.kr/details/17055-414614409264-st-652c0ffff27008be2c6116d9) and [local inventory](https://dining.ayo.pe.kr/restaurant/region/경기/용인시%20처인구/역북동) match 25 Myeongji-ro 16beon-gil, commercial building 2, unit 108. | Keep coordinates; flag approximately 127m discrepancy. Confirm storefront/cuisine; avoid confusion with Yeonhui takoyaki venue. |
| Hola Mexico / `place-1160698851` | [Business listing](https://www.daangn.com/kr/local-profile/올라메히꼬-멕시칸-펍-앤-다이닝-n12thqyi6e8e/) and [August 2026 visit](https://seon86.tistory.com/700) give 7-6 Hwasan-ro 6beon-gil, 1F. [Operator](https://www.instagram.com/hola_mexico_suwon/) identifies Hwaseo/Starfield area. [Building directory](https://findby.co.kr/details/16425-411154328425-st-652c08c7f27008be2c4b90b0) lists venue there, coordinates 37.2856424, 126.9864411. | Correct address; proposed building pin moves approximately 2.25km west. Exact entrance remains flagged. |

## Applying changes

[Prepared SQL](../supabase/manual/20261003_restaurant_verification.sql) contains one archive, two guarded address/pin corrections, one English-name correction and seven unresolved-case review flags. Location updates require the expected old name, address and coordinates; changed rows are skipped. Existing review notes are preserved and reruns do not duplicate notes. Both new building pins retain medium confidence and needs_review=true. Other three pin coordinates remain untouched.

SQL syntax was checked with a PostgreSQL parser. This does not verify live database permissions or affected-row counts. The script has NOT been run against Supabase. Run in Taco Map's SQL Editor and inspect its returned rows. It never deletes records, adds restaurants or changes hours/photos. If no unrelated changes occurred, archiving Jamsil leaves 146 live restaurants.

Remaining physical/telephone checks: Doce Seoul Forest and Crazy Taco status; Burrito Cartel name/link; Taco Taco identity/cuisine/link; precise entrances for the five flagged locations.
