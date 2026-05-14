export interface PinOptions {
  active: boolean
}

/**
 * Returns SVG markup (string) for a teardrop map pin.
 * Default: terracotta fill, mole-brown outline.
 * Active:  cream fill, terracotta outline (inverted).
 *
 * The point sits at viewBox (16, 30) — used as the anchor when placed
 * on the map (see kakao-map.tsx Point offset). Reserved space inside
 * the pin head is for a future rating number (Phase 2).
 */
export function pinSvg({ active }: PinOptions): string {
  const fill = active ? '#FFFBF2' : '#C84B2F'
  const stroke = active ? '#C84B2F' : '#3B2A1F'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path d="M 16 2 C 9 2 4 8 4 14 C 4 22 16 30 16 30 C 16 30 28 22 28 14 C 28 8 23 2 16 2 Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/></svg>`
}

/**
 * Returns a data: URI usable as a Kakao MarkerImage src.
 */
export function pinDataUri(opts: PinOptions): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg(opts))
}
