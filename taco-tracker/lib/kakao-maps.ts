// Minimal type ambient declaration so we can reference window.kakao without
// pulling in @types/kakao-maps (which doesn't exist as a first-party package).
declare global {
  interface Window {
    kakao: {
      maps: KakaoMapsNamespace
    }
  }
}

export interface KakaoMapsNamespace {
  load: (callback: () => void) => void
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Marker: new (options: { position: KakaoLatLng; image?: KakaoMarkerImage; map?: KakaoMap }) => KakaoMarker
  MarkerImage: new (src: string, size: KakaoSize, options?: { offset?: KakaoPoint }) => KakaoMarkerImage
  Size: new (w: number, h: number) => KakaoSize
  Point: new (x: number, y: number) => KakaoPoint
  MarkerClusterer: new (options: KakaoClustererOptions) => KakaoClusterer
  CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay
  event: {
    addListener: (target: unknown, type: string, handler: (...args: unknown[]) => void) => void
    removeListener: (target: unknown, type: string, handler: (...args: unknown[]) => void) => void
  }
}

export interface KakaoLatLng { getLat(): number; getLng(): number }
export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void
  isEmpty(): boolean
  getSouthWest(): KakaoLatLng
  getNorthEast(): KakaoLatLng
}
export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void
  setCenter(latlng: KakaoLatLng): void
  setLevel(level: number): void
  getLevel(): number
  getBounds(): KakaoLatLngBounds
  relayout(): void
}
export interface KakaoMarker {
  setMap(map: KakaoMap | null): void
  setImage(image: KakaoMarkerImage): void
  getPosition(): KakaoLatLng
}
export interface KakaoMarkerImage { _brand: 'KakaoMarkerImage' }
export interface KakaoSize { _brand: 'KakaoSize' }
export interface KakaoPoint { _brand: 'KakaoPoint' }
export interface KakaoClustererOptions {
  map: KakaoMap
  averageCenter?: boolean
  minLevel?: number
  styles?: Array<Record<string, string>>
}
export interface KakaoClusterer {
  addMarkers(markers: KakaoMarker[]): void
  clear(): void
}

export interface KakaoCustomOverlayOptions {
  position: KakaoLatLng
  content: HTMLElement | string
  xAnchor?: number
  yAnchor?: number
  map?: KakaoMap | null
  zIndex?: number
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void
  setPosition(latlng: KakaoLatLng): void
  getPosition(): KakaoLatLng
  setContent(content: HTMLElement | string): void
}

let mapsPromise: Promise<KakaoMapsNamespace> | null = null

/**
 * Loads the Kakao Maps SDK once. Subsequent calls return the cached promise.
 * Resolves to `window.kakao.maps`. Rejects if the env var is missing or the
 * script fails to load. Browser-only (rejects on the server).
 */
export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao Maps can only load in the browser'))
  }
  if (mapsPromise) return mapsPromise

  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  if (!key) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_KAKAO_JS_KEY'))
  }

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-kakao-sdk]') as HTMLScriptElement | null
    if (existing && window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao.maps))
      return
    }
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=clusterer`
    script.async = true
    script.dataset.kakaoSdk = 'true'
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao.maps))
    }
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK'))
    document.head.appendChild(script)
  })
  return mapsPromise
}
