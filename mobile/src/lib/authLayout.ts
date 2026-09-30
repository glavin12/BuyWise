// The arithmetic of the signed-out frame (ui/AuthLayout.tsx): how much room the sheet leaves for the
// wordmark and the login hero. Import-free so `npm test` can run it.

export const HERO = { width: 390, height: 372, min: 262 }; // login_hero.svg's viewBox; `min` is the shortest crop that keeps the pot's lid in view
export const WORDMARK = 26; // the height of the "BUYWISE" row above the hero
export const OVERLAP = 8; // the sheet covers the hero's last 8
export const MAX_WIDTH = 480; // wider screens get a centred column, so the hero never stretches
const SHEET_BODY = 390; // Main.html's 410-tall sheet without its 20 of bottom padding

/**
 * `top` is the room the frame keeps for the status bar, `bottom` the sheet's bottom padding. The
 * wordmark's row (`lead`) gives way first, then the hero's sky (`height` is cropped from the top),
 * never below `min`: a short phone scrolls instead of losing the pot.
 */
export function heroFit(windowWidth: number, windowHeight: number, top: number, bottom: number) {
  const width = Math.min(windowWidth, MAX_WIDTH);
  const scale = width / HERO.width;
  const natural = HERO.height * scale;
  const room = windowHeight - top - SHEET_BODY - bottom + OVERLAP;
  const lead = Math.round(Math.min(WORDMARK, Math.max(0, room - natural)));
  const height = Math.round(Math.max(HERO.min * scale, Math.min(natural, room - lead)));
  return { width, lead, height };
}
