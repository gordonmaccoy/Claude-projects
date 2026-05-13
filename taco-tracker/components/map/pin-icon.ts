export interface PinOptions {
  active: boolean
}

/**
 * Returns SVG markup (string) for a flat taco-wedge pin.
 * Default: terracotta fill, mole-brown outline.
 * Active:  cream fill, terracotta outline (inverted).
 */
export function pinSvg({ active }: PinOptions): string {
  const fill = active ? '#FFFBF2' : '#C84B2F'
  const stroke = active ? '#C84B2F' : '#3B2A1F'
  // Half-disc with a flat bottom — a taco shell silhouette viewed end-on.
  // The two-pixel outline keeps the wedge readable against light map tiles.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path d="M 4 22 A 12 12 0 0 1 28 22 L 28 26 L 4 26 Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/></svg>`
}

/**
 * Returns a data: URI usable as a Kakao MarkerImage src.
 */
export function pinDataUri(opts: PinOptions): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg(opts))
}
