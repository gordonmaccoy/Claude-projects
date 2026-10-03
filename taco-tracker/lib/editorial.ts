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
}
