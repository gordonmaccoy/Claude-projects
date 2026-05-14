'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  loadKakaoMaps,
  type KakaoMapsNamespace,
  type KakaoMap as KakaoMapInstance,
  type KakaoMarker,
  type KakaoClusterer,
  type KakaoCustomOverlay,
} from '@/lib/kakao-maps'
import { pinDataUri } from './pin-icon'
import { RestaurantPopover } from './restaurant-popover'
import type { Restaurant } from '@/lib/restaurants'

interface Props {
  restaurants: Restaurant[]
  restaurantById: Map<string, Restaurant>
  activeId: string | null
  locale: 'ko' | 'en'
  onPinClick: (id: string) => void
  onPopoverClose: () => void
}

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }
const SEOUL_LEVEL = 8

export function KakaoMap({
  restaurants,
  restaurantById,
  activeId,
  locale,
  onPinClick,
  onPopoverClose,
}: Props) {
  const t = useTranslations('listing')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const namespaceRef = useRef<KakaoMapsNamespace | null>(null)
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map())
  const clustererRef = useRef<KakaoClusterer | null>(null)
  const overlayRef = useRef<KakaoCustomOverlay | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showLoading, setShowLoading] = useState(false)
  const [overlayContainer, setOverlayContainer] = useState<HTMLElement | null>(null)

  // Delay loading indicator to avoid flash
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

    clusterer.clear()
    markersRef.current.clear()

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

  // Manage popover CustomOverlay lifecycle
  useEffect(() => {
    if (status !== 'ready') return
    const maps = namespaceRef.current
    const map = mapRef.current
    if (!maps || !map) return

    // Tear down previous overlay (if any)
    if (overlayRef.current) {
      overlayRef.current.setMap(null)
      overlayRef.current = null
    }
    setOverlayContainer(null)

    if (activeId === null) return
    const marker = markersRef.current.get(activeId)
    if (!marker) return

    const container = document.createElement('div')
    const overlay = new maps.CustomOverlay({
      position: marker.getPosition(),
      content: container,
      xAnchor: 0.5,
      yAnchor: 1.1,
      zIndex: 5,
      map,
    })
    overlayRef.current = overlay
    setOverlayContainer(container)

    return () => {
      overlay.setMap(null)
      if (overlayRef.current === overlay) overlayRef.current = null
    }
  }, [activeId, status])

  const activeRestaurant = activeId !== null ? restaurantById.get(activeId) ?? null : null

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
      {overlayContainer && activeRestaurant
        ? createPortal(
            <RestaurantPopover
              restaurant={activeRestaurant}
              locale={locale}
              onClose={onPopoverClose}
            />,
            overlayContainer
          )
        : null}
    </div>
  )
}
