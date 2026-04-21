import type { KakaoPlace } from './kakao-client'

export interface RestaurantDraft {
  kakao_place_id: string
  slug: string
  name_ko: string
  address_ko: string
  neighborhood: string | null
  lat: number
  lng: number
  phone: string | null
  cuisine: string
  source: string
  status: string
}

export function generateSlug(place: KakaoPlace): string {
  return `place-${place.id}`
}

export function extractNeighborhood(address: string): string | null {
  const match = address.match(/(\S+구)/)
  return match ? match[1] : null
}

export function normalize(place: KakaoPlace): RestaurantDraft {
  const address = place.road_address_name || place.address_name
  return {
    kakao_place_id: place.id,
    slug: generateSlug(place),
    name_ko: place.place_name,
    address_ko: address,
    neighborhood: extractNeighborhood(address),
    lat: parseFloat(place.y),
    lng: parseFloat(place.x),
    phone: place.phone || null,
    cuisine: 'mexican',
    source: 'kakao',
    status: 'draft',
  }
}
