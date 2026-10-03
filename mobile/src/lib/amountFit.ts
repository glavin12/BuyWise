// How big the Quick Add amount may be drawn so a long figure still fits on one line. Import-free so `npm test` can run it.

const ADVANCE_EM = 0.5; // Barlow Semi Condensed Bold digits measure 0.476 em; 0.5 leaves room for letterSpacing and the point

/** The largest font size <= `max` (and >= `min`) at which `chars` characters fit in `width`; `max` until `width` is measured. */
export function fitFontSize(chars: number, width: number, max: number, min = 36): number {
  if (!(width > 0)) return max;
  return Math.max(min, Math.min(max, Math.floor(width / (Math.max(chars, 1) * ADVANCE_EM))));
}
