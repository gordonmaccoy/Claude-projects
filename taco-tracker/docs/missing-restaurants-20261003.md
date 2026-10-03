# Six missing Seoul restaurants

Sources reviewed 4 October 2026, Korea time. This is a prepared addition set, not a claim that Supabase has been changed. All six were absent by name and street address from the captured 148-record Taco Map inventory. No ratings, dietary assurances, prices or photos have been invented.

The accompanying SQL adds **draft** records and leaves existing records unchanged. Each draft is marked `needs_review = true`. The coordinates identify the street-address building, except Mattdol, whose Michelin publisher pin is independently within about 7 metres of that building coordinate. They do not establish a particular doorway. All six need an original or owner-authorized photo before a visually complete launch. Existing clean photo placeholders can handle the empty photo fields.

The current app reads introductions and hours from `lib/editorial.ts`, rather than `curator_note_*` and `hours` in Supabase. The SQL preserves researched copy in those database columns; root should also add the matching manual slugs to editorial data when these listings are published. Running this SQL alone does not make the six restaurants public.

## Publication recommendation

All six are reasonable to publish for discovery after root review: their Mexican-food identity and street address are supported by the operator or Michelin, and every saved position has an independently matched building location. Building coordinates and missing photos are not reasons to hide an otherwise verified venue. Use the existing neutral photo fallback and preserve the review flags for later entrance/photo work. The script retains draft status so root can explicitly decide the publication state in the combined update.

| Venue | Recommended discovery status | Rationale |
| --- | --- | --- |
| Escondido | Live with review flag | Operator and Michelin agree on restaurant, street and phone. Building pin is independently matched. Omitting the disputed floor prevents misleading directions. |
| El Molino | Live with review flag | Correct operator section identifies Mexican menu, address, phone and service schedule. Building address matches coordinates. |
| La Calle | Live with review flag | Operator establishes street tacos, Sindang street address and phone; operator recruiting confirms Korean name/address. Building pin matches. |
| Pescadería | Live with review flag | Current operator page establishes seafood Mexican menu, exact street address, phone and schedule. Building pin matches; floor can stay omitted. |
| bistroMEXI | Live with review flag | Operator identifies Mexican lounge pub, full 2F address, phone and venue timetable. The overnight kitchen cutoff is unknown, so do not label those venue hours as food-service availability. |
| Mattdol | Live with review flag | Michelin establishes Mexican cuisine, exact address, phone and timetable; its publisher pin is independently corroborated by the same building address. |

## Ready draft records

| Restaurant | Manual slug | Korean address | Phone | Latitude | Longitude | Remaining review |
| --- | --- | --- | --- | --- | --- | --- |
| Escondido / 에스콘디도 | `manual-escondido-hannam` | 서울 용산구 한남대로20길 61-7 | 02-2038-8994 | 37.535124384862 | 127.01055184798 | Floor conflict: operator website says 1F, Michelin and current operator job listings say B1. Floor deliberately omitted. |
| El Molino / 엘몰리노 | `manual-el-molino-seongsu` | 서울 성동구 서울숲2길 19-18 1층 | 070-7575-0793 | 37.54744578432 | 127.04113709236 | Building coordinate; entrance and owner photo pending. |
| La Calle / 라까예 | `manual-la-calle-sindang` | 서울 중구 퇴계로85길 42 1층 | 070-7776-8777 | 37.567677081046 | 127.01972732216 | Building coordinate; entrance and owner photo pending. |
| Pescadería / 페스카데리아 | `manual-pescaderia-gyeongdong` | 서울 동대문구 경동시장로10길 51 | 02-6956-7978 | 37.581381517515 | 127.04356407318 | Building coordinate; floor, entrance and owner photo pending. |
| bistroMEXI / 비스트로 멕시 | `manual-bistro-mexi-itaewon` | 서울 용산구 이태원로 191 2층 | 02-797-6855 | 37.534747929322 | 126.99520929093 | Building coordinate; entrance and owner photo pending. |
| Mattdol / 맷돌 | `manual-mattdol-seongsu` | 서울 성동구 성덕정길 63 | 010-4886-2928 | 37.53808 | 127.05065 | Michelin publisher pin corroborated by building location; entrance, floor and owner photo pending. |

## Original introductions and sourced hours

### Escondido

English: A reservation-only Mexican tasting-menu restaurant in Hannam. The nine-course menu can be paired with cocktails or agave spirits.

한국어: 한남동에서 예약제로 운영하는 멕시칸 코스 레스토랑입니다. 9가지 코스 요리에 칵테일이나 아가베 증류주 페어링을 곁들일 수 있습니다.

Hours: Tue-Sat 17:15-19:15 / 19:30-22:00; reservation required. The source only publishes Tue-Sat service; it does not explicitly state closure days, so do not manufacture a Sunday/Monday closure field.

영업시간: 화-토 17:15-19:15 / 19:30-22:00, 예약 필수.

Details and schedule: <https://molinoproject.co.kr/escondido>

Address/phone corroboration and floor discrepancy: <https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/escondido>

Operator's B1 job posting: <https://www.jobkorea.co.kr/Recruit/GI_Read/50070236>

Building coordinates: <https://jusoga.com/b/1117013100100320048006082/서울특별시-용산구-한남대로20길-61-7-한남동>

### El Molino

English: A casual Mexican restaurant near Seoul Forest. Its menu ranges from tacos and tostadas to gorditas, aguachile and mole.

한국어: 서울숲 근처의 캐주얼 멕시칸 레스토랑입니다. 타코와 토스타다뿐 아니라 고르디타, 아구아칠레, 몰레 등도 선보입니다.

Hours: Tue-Fri 17:00-22:00; Sat-Sun 12:00-15:00 / 17:00-22:00. Reservations recommended. Monday is not explicitly listed as closed by this operator page.

영업시간: 화-금 17:00-22:00 · 토-일 12:00-15:00 / 17:00-22:00. 예약 권장.

Details and schedule: <https://molinoproject.co.kr/elmolino>

Source quality note: the page's first rendered block incorrectly repeats Escondido's copy and contact details. The El Molino section explicitly gives Seoul Forest, 19-18 Seoulsup 2-gil, 070-7575-0793 and its own schedule. The draft uses that correct section. Older tourism and third-party schedules differ; the operator schedule takes precedence, but visitors should confirm service before travelling.

Building coordinates: <https://jusoga.com/b/1120011400106850325027670/서울특별시-성동구-서울숲2길-19-18-성수동1가>

### La Calle

English: A walk-in taqueria inside Sindang Central Market. Its street-style menu includes al pastor, suadero and barbacoa tacos.

한국어: 신당 중앙시장 안의 멕시칸 타코 전문점입니다. 알 파스토르, 수아데로, 바르바코아 타코를 선보이며 현장 방문으로 이용합니다.

Hours: Tue-Fri 17:00-22:00; Sat-Sun 12:00-15:00 / 17:00-22:00; walk-ins only. Monday is not explicitly listed as closed by the operator page.

영업시간: 화-금 17:00-22:00 · 토-일 12:00-15:00 / 17:00-22:00. 현장 방문만 가능.

Details and schedule: <https://molinoproject.co.kr/lacalle>

Korean brand spelling corroborated by the operator's job posting: <https://www.jobkorea.co.kr/Recruit/GI_Read/49698282>

Building coordinates: <https://jusoga.com/b/1114016500104580000002314/서울특별시-중구-퇴계로85길-42-황학동>

### Pescadería

English: A seafood-focused Mexican restaurant in Gyeongdong Market. Fish tacos, aguachile and seasonal seafood dishes are part of the menu.

한국어: 경동시장에 있는 해산물 중심의 멕시칸 레스토랑입니다. 피시 타코, 아구아칠레와 계절 해산물 요리를 선보입니다.

Hours: Tue-Sun 17:00-23:00; last order 21:30; walk-ins only. Older posts report different operating days; use the operator's current published timetable, with a confirmation caveat.

영업시간: 화-일 17:00-23:00 · 마지막 주문 21:30. 현장 방문만 가능.

Details and schedule: <https://molinoproject.co.kr/pescaderia>

Building coordinates: <https://jusoga.com/b/1123010300104860029034413/서울특별시-동대문구-경동시장로10길-51-제기동>

### bistroMEXI

English: An Itaewon Mexican lounge pub with tacos, nachos and guacamole for sharing. Tequila and mezcal feature on its drinks menu, with service extending late into the night.

한국어: 이태원의 멕시칸 라운지 펍으로 타코, 나초, 과카몰리 등을 함께 나누기 좋습니다. 테킬라와 메즈칼을 곁들일 수 있으며 늦은 시간까지 운영합니다.

Hours: Sun-Wed 17:00-02:00 next day; Thu 17:00-03:00 next day; Fri-Sat 17:00-04:00 next day. These are venue hours, not verified kitchen last-order times.

영업시간: 일-수 17:00-다음 날 02:00 · 목 17:00-다음 날 03:00 · 금-토 17:00-다음 날 04:00. 주방 마감 시간은 별도 확인.

Details and schedule: <https://mykinc.co.kr/>, section ABOUT BISTRO MEXI.

Building coordinates: <https://jusoga.com/b/1117013000101230026009559/서울특별시-용산구-이태원로-191-이태원동>

### Mattdol

English: A Seongsu Mexican restaurant where chef Chang-yun Lee makes tortillas from masa. Tacos and tostadas combine Mexican techniques with Korea's seasonal ingredients.

한국어: 이창윤 셰프가 마사 반죽으로 토르티야를 만드는 성수동 멕시칸 레스토랑입니다. 한국의 제철 식재료를 타코와 토스타다에 활용합니다.

Hours: Tue-Sat 18:00-21:00; Sun-Mon closed, as explicitly listed by Michelin. Reservations are handled directly by the restaurant.

영업시간: 화-토 18:00-21:00 · 일-월 휴무. 예약은 식당에 직접 문의.

Details, schedule and publisher location pin: <https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/mattdol>

Korean name: <https://guide.michelin.com/kr/ko/seoul-capital-area/kr-seoul/restaurant/mattdol>

Independent building location: <https://jusoga.com/b/1120011400103050000009707/서울특별시-성동구-성덕정길-63-성수동1가>, 37.538023774978 / 127.05068635122.

## Applying and publishing

1. Review the six candidates and source links.
2. Run `supabase/manual/20261003_missing_restaurants.sql` in the correct Taco Map Supabase project. It inserts drafts only and returns the rows actually inserted. A repeat run inserts zero duplicate rows.
3. Inspect each map position and resolve Escondido's floor conflict. Add a photo that Taco Map is authorized to use. Do not copy the operator's or Michelin's images automatically.
4. Add these introductions and hours to the editorial display, or separately update the app to read the database editorial fields.
5. Publish reviewed drafts individually. The SQL deliberately includes no automatic `status = 'live'` update.

The SQL duplicate check blocks a same slug, normalized English name, normalized Korean name or same street address. This is intentionally conservative: a legitimate new tenant at an existing address must be reviewed manually rather than silently duplicated. Exact entrance precision should not be claimed for the road-address building coordinates.

## Root integration review, 4 October 2026

All six identities and building locations were reviewed against the cited sources. The recommended execution file is now `supabase/manual/20261004_directory_update.sql`: it inserts the six as live records while retaining review flags, applies the existing-record corrections and never promotes or overwrites a pre-existing draft automatically. The earlier standalone script remains a draft-only staging option. All six matching introductions and source schedules are included in `lib/editorial.ts`, so they display after the live inserts. New venues use neutral photo placeholders until authorized photos are available. Escondido has no inferred taco dish tag.
