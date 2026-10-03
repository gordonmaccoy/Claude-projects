// Original Taco Map copy, based on the linked restaurant or tourism source.
// Keep entries tied to a venue slug so they never appear on a different branch.
export interface EditorialEntry {
  intro: { en: string; ko: string }
  hours?: { en: string; ko: string }
  sourceUrl: string
  checkedAt: string
}

export const editorialBySlug: Record<string, EditorialEntry> = {
  'place-20885402': {
    intro: {
      en: 'A small Sangsu taco spot where food is made to order. Stop in for a warm taco or pick up something to take away.',
      ko: '상수역 근처의 작은 타코 식당입니다. 주문 후 음식을 만들며 포장해서 즐기기에도 좋습니다.',
    },
    hours: {
      en: 'Tue–Sat 11:30–21:00 · Sun 11:30–20:00 · Mon closed',
      ko: '화–토 11:30–21:00 · 일 11:30–20:00 · 월 휴무',
    },
    sourceUrl: 'https://english.visitseoul.net/restaurants/Gusto-Taco-EN/ENP014790',
    checkedAt: '2026-10-03',
  },
  'place-21535686': {
    intro: {
      en: 'Vatos in Itaewon brings Korean flavors into Mexican favorites. Its casual menu includes nachos and other dishes for sharing.',
      ko: '이태원의 바토스는 멕시코 음식에 한국적인 맛을 더합니다. 나초 등 함께 나누기 좋은 메뉴를 선보입니다.',
    },
    hours: {
      en: 'Mon–Thu 11:30–23:00 · Fri–Sat 11:30–24:00 · Sun: confirm with restaurant',
      ko: '월–목 11:30–23:00 · 금–토 11:30–24:00 · 일요일은 식당에 확인',
    },
    sourceUrl: 'https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=47144',
    checkedAt: '2026-10-03',
  },
  'place-457395048': {
    intro: {
      en: 'A compact taco shop just outside Euljiro 3-ga Station. Seating is limited, so takeaway is a useful option; ask when ordering if you prefer your food without cilantro.',
      ko: '을지로3가역 바로 근처에 자리한 작은 타코 가게입니다. 좌석이 많지 않아 포장도 좋은 선택이며, 고수를 원하지 않으면 주문할 때 요청할 수 있습니다.',
    },
    hours: {
      en: '11:30–21:00 · Operating days: confirm with restaurant',
      ko: '11:30–21:00 · 영업 요일은 식당에 확인',
    },
    sourceUrl: 'https://english.visitseoul.net/restaurants/oldiestaco/ENPhsowxr',
    checkedAt: '2026-10-04',
  },
  'place-8111953': {
    intro: {
      en: 'An Itaewon Mexican and Tex-Mex restaurant serving the neighborhood since 2005. Alongside tacos, its menu includes dishes such as tamales and mole enchiladas, with fresh-fruit margaritas to match.',
      ko: '2005년부터 이태원에서 멕시코 음식과 텍스멕스 요리를 선보이는 식당입니다. 타코 외에도 타말레와 몰레 엔칠라다 등 다양한 요리와 생과일 마르가리타를 즐길 수 있습니다.',
    },
    sourceUrl: 'https://www.tacoamigokorea.com/restaurant',
    checkedAt: '2026-10-04',
  },
  'place-1130537615': {
    intro: {
      en: 'Mexicali in Gwangjin focuses on the flavors of northern Mexico, making tortillas and salsa in-house. Fish tacos, shrimp tacos and beef quesadillas are among the dishes on its menu.',
      ko: '광진구의 멕시칼리는 토르티야와 살사를 직접 만들며 멕시코 북부의 맛을 선보입니다. 피시 타코, 새우 타코, 소고기 퀘사디아 등을 메뉴에서 만나볼 수 있습니다.',
    },
    sourceUrl: 'https://access.visitkorea.or.kr/food/detail.do?cotId=18c9f385-c878-4da5-a9fb-2ec8775e93ea',
    checkedAt: '2026-10-04',
  },
  'place-607192266': {
    intro: {
      en: 'GOD EAT’s Yeonnam branch serves Mexican-inspired fusion food in a relaxed setting. The menu is also available to take away if you would rather enjoy your meal outdoors.',
      ko: '갓잇 연남점은 편안한 분위기에서 멕시코풍 퓨전 음식을 선보입니다. 메뉴를 포장할 수 있어 야외에서 식사를 즐기고 싶을 때도 들르기 좋습니다.',
    },
    hours: {
      en: 'Mon–Fri 11:00–15:00, 16:30–21:30 · Sat–Sun 11:00–21:30',
      ko: '월–금 11:00–15:00, 16:30–21:30 · 토–일 11:00–21:30',
    },
    sourceUrl: 'https://english.visitseoul.net/restaurants/God-Eat-EN/ENP019365',
    checkedAt: '2026-10-04',
  },
  'place-1227821834': {
    intro: {
      en: 'Find this Cuchara branch on the basement level of Mecenatpolis near Hapjeong Station. The brand’s menu spans burritos, bowls, tacos and salads, with ingredients you can combine to suit your tastes.',
      ko: '합정역 근처 메세나폴리스 지하에 있는 쿠차라 매장입니다. 부리또, 볼, 타코, 샐러드에 취향에 맞는 재료를 조합해 한 끼를 즐길 수 있습니다.',
    },
    hours: {
      en: 'Daily 10:30–21:00',
      ko: '매일 10:30–21:00',
    },
    sourceUrl: 'https://cuchara.co.kr/store-hapjeong-station',
    checkedAt: '2026-10-04',
  },
  'place-1662014547': {
    intro: {
      en: 'This Cuchara branch is in the basement of Samsung’s Seocho office building. Choose from the brand’s burritos, bowls, tacos and salads, then build a combination around the ingredients you enjoy.',
      ko: '삼성전자 서초사옥 지하에 있는 쿠차라 매장입니다. 부리또, 볼, 타코, 샐러드 중에서 원하는 메뉴를 고르고 좋아하는 재료로 조합해 즐길 수 있습니다.',
    },
    sourceUrl: 'https://cuchara.co.kr/store-samsung-seocho',
    checkedAt: '2026-10-04',
  },
  "manual-escondido-hannam": {
    "intro": {
      "en": "A reservation-only Mexican tasting-menu restaurant in Hannam. The nine-course menu can be paired with cocktails or agave spirits.",
      "ko": "한남동에서 예약제로 운영하는 멕시칸 코스 레스토랑입니다. 9가지 코스 요리에 칵테일이나 아가베 증류주 페어링을 곁들일 수 있습니다."
    },
    "hours": {
      "en": "Tue-Sat 17:15-19:15 / 19:30-22:00; reservation required",
      "ko": "화-토 17:15-19:15 / 19:30-22:00, 예약 필수"
    },
    "sourceUrl": "https://molinoproject.co.kr/escondido",
    "checkedAt": "2026-10-04"
  },
  "manual-el-molino-seongsu": {
    "intro": {
      "en": "A casual Mexican restaurant near Seoul Forest. Its menu ranges from tacos and tostadas to gorditas, aguachile and mole.",
      "ko": "서울숲 근처의 캐주얼 멕시칸 레스토랑입니다. 타코와 토스타다뿐 아니라 고르디타, 아구아칠레, 몰레 등도 선보입니다."
    },
    "hours": {
      "en": "Tue-Fri 17:00-22:00; Sat-Sun 12:00-15:00 / 17:00-22:00; reservations recommended",
      "ko": "화-금 17:00-22:00 · 토-일 12:00-15:00 / 17:00-22:00. 예약 권장"
    },
    "sourceUrl": "https://molinoproject.co.kr/elmolino",
    "checkedAt": "2026-10-04"
  },
  "manual-la-calle-sindang": {
    "intro": {
      "en": "A walk-in taqueria inside Sindang Central Market. Its street-style menu includes al pastor, suadero and barbacoa tacos.",
      "ko": "신당 중앙시장 안의 멕시칸 타코 전문점입니다. 알 파스토르, 수아데로, 바르바코아 타코를 선보이며 현장 방문으로 이용합니다."
    },
    "hours": {
      "en": "Tue-Fri 17:00-22:00; Sat-Sun 12:00-15:00 / 17:00-22:00; walk-ins only",
      "ko": "화-금 17:00-22:00 · 토-일 12:00-15:00 / 17:00-22:00. 현장 방문만 가능"
    },
    "sourceUrl": "https://molinoproject.co.kr/lacalle",
    "checkedAt": "2026-10-04"
  },
  "manual-pescaderia-gyeongdong": {
    "intro": {
      "en": "A seafood-focused Mexican restaurant in Gyeongdong Market. Fish tacos, aguachile and seasonal seafood dishes are part of the menu.",
      "ko": "경동시장에 있는 해산물 중심의 멕시칸 레스토랑입니다. 피시 타코, 아구아칠레와 계절 해산물 요리를 선보입니다."
    },
    "hours": {
      "en": "Tue-Sun 17:00-23:00; last order 21:30; walk-ins only",
      "ko": "화-일 17:00-23:00 · 마지막 주문 21:30. 현장 방문만 가능"
    },
    "sourceUrl": "https://molinoproject.co.kr/pescaderia",
    "checkedAt": "2026-10-04"
  },
  "manual-bistro-mexi-itaewon": {
    "intro": {
      "en": "An Itaewon Mexican lounge pub with tacos, nachos and guacamole for sharing. Tequila and mezcal feature on its drinks menu, with service extending late into the night.",
      "ko": "이태원의 멕시칸 라운지 펍으로 타코, 나초, 과카몰리 등을 함께 나누기 좋습니다. 테킬라와 메즈칼을 곁들일 수 있으며 늦은 시간까지 운영합니다."
    },
    "hours": {
      "en": "Sun-Wed 17:00-02:00 next day; Thu 17:00-03:00 next day; Fri-Sat 17:00-04:00 next day; confirm kitchen last order",
      "ko": "일-수 17:00-다음 날 02:00 · 목 17:00-다음 날 03:00 · 금-토 17:00-다음 날 04:00. 주방 마감 시간은 별도 확인"
    },
    "sourceUrl": "https://mykinc.co.kr/",
    "checkedAt": "2026-10-04"
  },
  "manual-mattdol-seongsu": {
    "intro": {
      "en": "A Seongsu Mexican restaurant where chef Chang-yun Lee makes tortillas from masa. Tacos and tostadas combine Mexican techniques with Korea's seasonal ingredients.",
      "ko": "이창윤 셰프가 마사 반죽으로 토르티야를 만드는 성수동 멕시칸 레스토랑입니다. 한국의 제철 식재료를 타코와 토스타다에 활용합니다."
    },
    "hours": {
      "en": "Tue-Sat 18:00-21:00; Sun-Mon closed; reservations handled directly by the restaurant",
      "ko": "화-토 18:00-21:00 · 일-월 휴무. 예약은 식당에 직접 문의"
    },
    "sourceUrl": "https://guide.michelin.com/kr/en/seoul-capital-area/kr-seoul/restaurant/mattdol",
    "checkedAt": "2026-10-04"
  },
}
