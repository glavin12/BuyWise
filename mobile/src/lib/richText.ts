// Template syntax for RichText (DESIGN.md §3): prose with inline data chips.
//   "Up {mint:+₹17,860} this month. {hi@budget:₹4,860} is ready."
// `{kind:text}` is a chip; `{kind@link:text}` is a chip the screen makes tappable by `link`.
// React Native cannot pad or round nested <Text>, so RichText lays out one piece per
// word or chip in a wrapping row; `space` says whether a space follows the piece.

export const CHIP_KINDS = ["dark", "hi", "mint", "coral"] as const;
export type ChipKind = (typeof CHIP_KINDS)[number];

export type RichPiece =
  | { kind: "word"; text: string; space: boolean }
  | { kind: ChipKind; text: string; space: boolean; link?: string };

const CHIP = /\{(dark|hi|mint|coral)(?:@(\w+))?:([^{}]+)\}/g;

export function parseRich(template: string): RichPiece[] {
  const pieces: RichPiece[] = [];
  const words = (text: string) => {
    // A space at the start of this text belongs after the previous piece.
    if (/^\s/.test(text) && pieces.length) pieces[pieces.length - 1].space = true;
    for (const m of text.matchAll(/(\S+)(\s*)/g)) pieces.push({ kind: "word", text: m[1], space: m[2] !== "" });
  };
  let last = 0;
  for (const m of template.matchAll(CHIP)) {
    words(template.slice(last, m.index));
    pieces.push({ kind: m[1] as ChipKind, text: m[3], space: false, ...(m[2] ? { link: m[2] } : {}) });
    last = m.index + m[0].length;
  }
  words(template.slice(last));
  return pieces;
}

/** Makes a value safe to interpolate into a template (a payee named "{x}" stays text). */
export function escapeRich(value: string): string {
  return value.replace(/[{}]/g, (c) => (c === "{" ? "（" : "）"));
}
