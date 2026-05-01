/**
 * CSS Value Normalizer
 * Handles: units, colors, zero stripping, quote normalization, redundant values
 * No external libraries — pure transformation logic.
 */

// ---------------------------------------------------------------------------
// Color normalization
// ---------------------------------------------------------------------------

const NAMED_TO_HEX = {
  black: "#000",
  white: "#fff",
  red: "#f00",
  lime: "#0f0",
  blue: "#00f",
  yellow: "#ff0",
  cyan: "#0ff",
  magenta: "#f0f",
  silver: "#c0c0c0",
  gray: "#808080",
  grey: "#808080",
  maroon: "#800000",
  olive: "#808000",
  green: "#008000",
  purple: "#800080",
  teal: "#008080",
  navy: "#000080",
  orange: "#ffa500",
  coral: "#ff7f50",
  salmon: "#fa8072",
  gold: "#ffd700",
  khaki: "#f0e68c",
  violet: "#ee82ee",
  indigo: "#4b0082",
  brown: "#a52a2a",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  lavender: "#e6e6fa",
  linen: "#faf0e6",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  snow: "#fffafa",
  tan: "#d2b48c",
  thistle: "#d8bfd8",
  wheat: "#f5deb3",
  crimson: "#dc143c",
  fuchsia: "#f0f",
  aqua: "#0ff",
  transparent: "transparent",
};

function normalizeHex(hex) {
  // #rrggbb -> #rgb if possible
  if (hex.length === 7) {
    const r1 = hex[1],
      r2 = hex[2],
      g1 = hex[3],
      g2 = hex[4],
      b1 = hex[5],
      b2 = hex[6];
    if (r1 === r2 && g1 === g2 && b1 === b2) {
      return `#${r1}${g1}${b1}`;
    }
  }
  return hex.toLowerCase();
}

function rgbToHex(r, g, b) {
  const hex = [r, g, b]
    .map((v) => {
      const h = Math.round(Math.max(0, Math.min(255, v))).toString(16);
      return h.length === 1 ? "0" + h : h;
    })
    .join("");
  return normalizeHex(`#${hex}`);
}

export function normalizeColor(value) {
  const v = value.trim().toLowerCase();

  // Already short hex
  if (/^#[0-9a-f]{3}$/.test(v)) return v;

  // Long hex
  if (/^#[0-9a-f]{6}$/.test(v)) return normalizeHex(v);

  // rgb()/rgba()
  const rgb = v.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgb) {
    const [, r, g, b, a] = rgb;
    if (a !== undefined && parseFloat(a) < 1) {
      // Keep rgba with normalized alpha
      const alpha = parseFloat(a);
      const aStr = alpha === 0 ? "0" : String(parseFloat(alpha.toFixed(3)));
      return `rgba(${r},${g},${b},${aStr})`;
    }
    return rgbToHex(+r, +g, +b);
  }

  // hsl() — leave as-is but normalize whitespace
  const hsl = v.match(/^hsla?\(/);
  if (hsl) return v.replace(/\s*,\s*/g, ",").replace(/\s+/g, " ");

  // Named color
  if (NAMED_TO_HEX[v]) return NAMED_TO_HEX[v];

  return value.trim();
}

// ---------------------------------------------------------------------------
// Unit / numeric normalization
// ---------------------------------------------------------------------------

const COLOR_PROPERTIES = new Set([
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
  "caret-color",
  "column-rule-color",
  "text-emphasis-color",
]);

// ---------------------------------------------------------------------------
// Normalize ALL color tokens within a value string (for shorthand values
// like `background`, `border`, `box-shadow` where colors are mixed with other tokens)
// ---------------------------------------------------------------------------
const COLOR_NAMES = Object.keys(NAMED_TO_HEX).join("|");
const COLOR_TOKEN_RE = new RegExp(
  // hex (#fff or #ffffff or #ffffffff)
  "#[0-9a-fA-F]{3,8}\\b" +
    "|" +
    // rgb/rgba/hsl/hsla
    "(?:rgba?|hsla?)\\([^)]+\\)" +
    "|" +
    // named colors (word-bounded)
    "\\b(?:" +
    COLOR_NAMES +
    ")\\b",
  "gi",
);

function normalizeColorTokens(value) {
  return value.replace(COLOR_TOKEN_RE, (match) => normalizeColor(match));
}

export function normalizeValue(prop, value) {
  if (
    !value ||
    value === "initial" ||
    value === "inherit" ||
    value === "unset" ||
    value === "revert"
  ) {
    return value;
  }

  const v = value.trim();

  // Color properties
  if (COLOR_PROPERTIES.has(prop.toLowerCase())) {
    return normalizeColor(v);
  }

  // For properties whose values can contain colors (background, border, box-shadow,
  // text-shadow, outline, gradient functions, etc.), normalize embedded color tokens.
  let working = normalizeColorTokens(v);

  // Normalize numeric tokens
  return (
    working
      // Remove leading zeros: 0.5 -> .5
      .replace(/\b0+(\.\d+)/g, "$1")
      // Remove redundant zero units: 0px 0em 0rem 0% 0vh 0vw etc -> 0
      .replace(
        /\b0(px|em|rem|vh|vw|vmin|vmax|pt|pc|cm|mm|in|ex|ch|fr|deg|rad|turn|ms|s)\b/gi,
        "0",
      )
      .replace(/\b0%/g, "0")
      // Trailing zeros after decimal: 1.50px -> 1.5px, .30s -> .3s
      .replace(/(\d*\.\d*?[1-9])0+([a-z%]*)\b/gi, "$1$2")
      // Pure trailing-zero decimal: 1.00px -> 1px, 1.0px -> 1px
      .replace(/(\d+)\.0+([a-z%]*)\b/gi, "$1$2")
      // 0.x with leading zero already stripped but this catches .X0 trailing
      .replace(/^0\.0+([a-z%]*)\b/gi, "0$1")
      // Normalize quotes: double -> single (shorter in most cases)
      .replace(/"([^"]+)"/g, (_, inner) =>
        inner.includes("'") ? `"${inner}"` : `'${inner}'`,
      )
  );
}

// ---------------------------------------------------------------------------
// Declaration-level importance / !important handling
// ---------------------------------------------------------------------------
export function parseImportant(value) {
  const m = value.match(/^(.*?)\s*!important\s*$/i);
  if (m) return { value: m[1].trim(), important: true };
  return { value: value.trim(), important: false };
}
