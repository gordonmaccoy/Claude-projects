export interface PinOptions {
  active: boolean
}

/**
 * Returns SVG markup (string) for a teardrop map pin with a cream taco-shell
 * accent inside the head and two small garnish dots.
 *
 * Default: terracotta body, mole-brown outline, cream accent.
 * Active:  cream body, terracotta outline, terracotta accent.
 *
 * The point sits at viewBox (16, 30) — used as the anchor when placed
 * on the map (see kakao-map.tsx Point offset).
 */
export function pinSvg({ active }: PinOptions): string {
  const fill = active ? '#FFFBF2' : '#C84B2F'
  const stroke = active ? '#C84B2F' : '#3B2A1F'
  const accent = active ? '#C84B2F' : '#FFFBF2'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path d="M 16 2 C 9 2 4 8 4 14 C 4 22 16 30 16 30 C 16 30 28 22 28 14 C 28 8 23 2 16 2 Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/><path d="M 10 13 Q 16 17 22 13" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><circle cx="12.5" cy="11" r="1" fill="${accent}"/><circle cx="19.5" cy="11" r="1" fill="${accent}"/></svg>`
}

/**
 * Returns a data: URI usable as a Kakao MarkerImage src.
 */
export function pinDataUri(opts: PinOptions): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(pinSvg(opts))
}
