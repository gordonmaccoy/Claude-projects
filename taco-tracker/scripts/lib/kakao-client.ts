const KAKAO_API_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json'
const SEOUL_RECT = '126.734086,37.413294,127.269311,37.715133'
const MAX_PAGE = 45
const PAGE_SIZE = 15

export interface KakaoPlace {
  id: string
  place_name: string
  phone: string
  address_name: string
  road_address_name: string
  x: string // longitude
  y: string // latitude
  place_url: string
  category_name: string
}

interface KakaoSearchResponse {
  documents: KakaoPlace[]
  meta: {
    total_count: number
    pageable_count: number
    is_end: boolean
  }
}

export function parseKakaoResponse(json: KakaoSearchResponse): {
  places: KakaoPlace[]
  isEnd: boolean
} {
  return {
    places: json.documents,
    isEnd: json.meta.is_end,
  }
}

export async function fetchPage(
  query: string,
  page: number,
  apiKey: string
): Promise<{ places: KakaoPlace[]; isEnd: boolean }> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    size: String(PAGE_SIZE),
    rect: SEOUL_RECT,
  })
  const res = await fetch(`${KAKAO_API_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  })
  if (!res.ok) {
    throw new Error(`Kakao API error: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as KakaoSearchResponse
  return parseKakaoResponse(json)
}

export async function fetchAllPlaces(
  query: string,
  apiKey: string
): Promise<KakaoPlace[]> {
  const all: KakaoPlace[] = []
  for (let page = 1; page <= MAX_PAGE; page++) {
    const { places, isEnd } = await fetchPage(query, page, apiKey)
    all.push(...places)
    if (isEnd) break
  }
  return all
}
