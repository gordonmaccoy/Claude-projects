# Taco Map editorial verification

Source check completed 2026-10-04, Korea time. This filename follows the directory audit batch date of 2026-10-03.

Six existing venues received original English and Korean introductions. Three received source-supported hours. Existing Gusto Taco and Vatos Itaewon entries remain unchanged. Sources describe venues; these checks are not owner-confirmed live availability guarantees.

| Venue and exact slug | Source and address match | Hours added | Limitations |
| --- | --- | --- | --- |
| Oldies Tacos, Euljiro main branch, `place-457395048` | [Visit Seoul](https://english.visitseoul.net/restaurants/oldiestaco/ENPhsowxr), 3 Chungmuro 4-gil, Jung-gu | 11:30–21:00 | Source edited 2025-09-12; specific operating days not provided. The adjacent second branch `place-794675173` receives no copied hours or editorial entry. |
| Taco Amigo, `place-8111953` | [Operator](https://www.tacoamigokorea.com/restaurant), 13 Hoenamu-ro, Yongsan-gu | None | Operator page contains inconsistent am/pm notation, including Monday 4:00am and Wednesday–Saturday 12:00pm closing. Do not interpret or publish these times without confirmation. Intro uses its history, menu examples and fresh-fruit margarita information. |
| Mexi Cali, `place-1130537615` | [Korea Tourism Organization accessibility guide](https://access.visitkorea.or.kr/food/detail.do?cotId=18c9f385-c878-4da5-a9fb-2ec8775e93ea), 634 Cheonho-daero, Gwangjin-gu | None | Source revised 2026-07-15 and supports northern-Mexican focus, house-made tortillas/salsa and menu examples; hours are not stated. No accessibility claims copied into Taco Map. |
| GOD EAT Yeonnam, `place-607192266` | [Visit Seoul](https://english.visitseoul.net/restaurants/God-Eat-EN/ENP019365), 161-13 Seongmisan-ro, Mapo-gu | Mon–Fri 11:00–15:00 and 16:30–21:30; Sat–Sun 11:00–21:30 | Source revised 2026-07-02 and explicitly lists every-day operation. Hours apply to Yeonnam only, not the chain's other branches. No unsupported health or speed claims included. |
| Cuchara Hapjeong Station, `place-1227821834` | [Operator branch page](https://cuchara.co.kr/store-hapjeong-station), Mecenatpolis basement B152, Seogyo-dong 490, Mapo-gu; [operator brand page](https://www.cuchara.co.kr/about-cuchara) for menu/choice format | Daily 10:30–21:00 | Branch page address and daily hours available from the operator page's indexed search text, crawled four days before this check. Direct fetch returned HTTP 403. No last-order time inferred. Recheck directly when feasible. |
| Cuchara Samsung Seocho office, `place-1662014547` | [Operator branch page](https://cuchara.co.kr/store-samsung-seocho), basement B112, Samsung Seocho office, Seocho-dong 1320-10; [operator brand page](https://www.cuchara.co.kr/about-cuchara) for menu/choice format | None | Branch identity/address available from indexed operator search text, crawled four days before check; direct fetch returned HTTP 403. No schedule inferred from third-party blogs or another branch. Existing English inventory label “Samseong” is ambiguous; editorial copy specifies Seocho office. |

## Evidence references for review

- Oldies: web source `turn75view1`, lines 178–196.
- Taco Amigo: web source `turn79view0`, lines 3–6 and 23–34.
- Mexicali: web source `turn86view0`, lines 4 and 46–48.
- GOD EAT Yeonnam: web source `turn88view1`, lines 151 and 182–208.
- Cuchara Hapjeong: operator indexed source `turn89search1`; menu format `turn89search2` and `turn90search1`.
- Cuchara Samsung Seocho: operator indexed source `turn89search0`; menu format `turn89search2` and `turn90search1`.

No Kakao Local API data, third-party review text, ratings or images were copied. HTTP errors were not interpreted as restaurant closures. Hours omitted where ambiguous or unverified. Existing detail rendering already supports an introduction without hours through optional `EditorialEntry.hours`.
