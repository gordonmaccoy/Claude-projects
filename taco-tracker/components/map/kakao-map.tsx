'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  loadKakaoMaps,
  type KakaoMapsNamespace,
  type KakaoMap as KakaoMapInstance,
  type KakaoMarker,
  type KakaoClusterer,
} from '@/lib/kakao-maps'
import { pinDataUri } from './pin-icon'

interface MapRestaurant {
  id: string
  lat: number
  lng: number
}

interface Props {
  restaurants: MapRestaurant[]
  activeId: string | null
  onPinClick: (id: string) => void
}

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }
const SEOUL_LEVEL = 8

export function KakaoMap({ restaurants, activeId, onPinClick }: Props) {
  const t = useTranslations('listing')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const namespaceRef = useRef<KakaoMapsNamespace | null>(null)
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map())
  const clustererRef = useRef<KakaoClusterer | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showLoading, setShowLoading] = useState(false)

  // Delay the loading state so it doesn't flash on fast loads
  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setShowLoading(true), 500)
    return () => clearTimeout(timer)
  }, [status])

  // Load SDK and create the map once
  useEffect(() => {
    let cancelled = false
    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        namespaceRef.current = maps
        mapRef.current = new maps.Map(containerRef.current, {
          center: new maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          level: SEOUL_LEVEL,
        })
        clustererRef.current = new maps.MarkerClusterer({
          map: mapRef.current,
          averageCenter: true,
          minLevel: 5,
          styles: [
            {
              width: '40px',
              height: '40px',
              background: '#C84B2F',
              color: '#FFFBF2',
              borderRadius: '20px',
              textAlign: 'center',
              lineHeight: '40px',
              fontWeight: '700',
              fontSize: '14px',
            },
          ],
        })
        setStatus('ready')
      })
      .catch((err) => {
        console.error('Kakao Maps load failed:', err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Sync markers with restaurants prop
  useEffect(() => {
    if (status !== 'ready') return
    const maps = namespaceRef.current
    const map = mapRef.current
    const clusterer = clustererRef.current
    if (!maps || !map || !clusterer) return

    // Clear old markers
    clusterer.clear()
    markersRef.current.clear()

    // Build new markers
    const defaultImage = new maps.MarkerImage(
      pinDataUri({ active: false }),
      new maps.Size(32, 32),
      { offset: new maps.Point(16, 30) }
    )
    const newMarkers: KakaoMarker[] = []
    for (const r of restaurants) {
      const position = new maps.LatLng(r.lat, r.lng)
      const marker = new maps.Marker({ position, image: defaultImage })
      maps.event.addListener(marker, 'click', () => onPinClick(r.id))
      markersRef.current.set(r.id, marker)
      newMarkers.push(marker)
    }
    clusterer.addMarkers(newMarkers)

    // Fit bounds to markers, or fall back to Seoul-wide
    if (newMarkers.length > 0) {
      const bounds = new maps.LatLngBounds()
      for (const m of newMarkers) bounds.extend(m.getPosition())
      if (!bounds.isEmpty()) map.setBounds(bounds, 40, 40, 40, 40)
    } else {
      map.setCenter(new maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng))
      map.setLevel(SEOUL_LEVEL)
    }
  }, [restaurants, status, onPinClick])

  // Sync active marker styling
  useEffect(() => {
    if (status !== 'ready') return
    const maps = namespaceRef.current
    if (!maps) return

    const defaultImage = new maps.MarkerImage(
      pinDataUri({ active: false }),
      new maps.Size(32, 32),
      { offset: new maps.Point(16, 30) }
    )
    const activeImage = new maps.MarkerImage(
      pinDataUri({ active: true }),
      new maps.Size(40, 40),
      { offset: new maps.Point(20, 38) }
    )

    for (const [id, marker] of markersRef.current.entries()) {
      marker.setImage(id === activeId ? activeImage : defaultImage)
    }
  }, [activeId, status])

  if (status === 'error') {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-muted bg-bg p-4 text-sm text-muted">
        {t('mapUnavailable')}
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[400px] w-full overflow-hidden rounded-md bg-bg">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && showLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80 text-sm text-muted">
          Loading map…
        </div>
      ) : null}
    </div>
  )
}
