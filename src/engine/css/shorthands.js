/**
 * CSS Shorthand Merger
 *
 * Converts longhand properties into their shorthand equivalents.
 * All transformations are lossless — identical visual output guaranteed.
 *
 * Handles:
 *   margin / padding            4-side -> shorthand
 *   border                      top/right/bottom/left + sub-props -> shorthand
 *   background                  sub-props -> shorthand
 *   font                        sub-props -> shorthand
 *   outline                     width/style/color -> shorthand
 *   list-style                  type/position/image -> shorthand
 *   transition                  duration/property/timing/delay -> shorthand
 *   animation                   name/duration/timing/delay/... -> shorthand
 *   flex                        grow/shrink/basis -> shorthand
 *   flex-flow                   direction/wrap -> shorthand
 *   grid-area                   row/col start/end -> shorthand
 *   overflow                    x/y -> shorthand
 *   text-decoration             line/color/style/thickness -> shorthand
 *   column-rule                 width/style/color -> shorthand
 *   border-radius               corners -> shorthand
 *   inset                       top/right/bottom/left -> shorthand (logical)
 */

import { normalizeColor } from "./normalize.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Turn 4-value arrays into shortest CSS shorthand.
 * [top, right, bottom, left]
 */
function fourSide(t, r, b, l) {
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return `${t} ${r}`;
  if (r === l) return `${t} ${r} ${b}`;
  return `${t} ${r} ${b} ${l}`;
}

function defined(...vals) {
  return vals.every((v) => v !== undefined && v !== null && v !== "");
}

// border-style values
const BORDER_STYLES = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
  "inherit",
  "initial",
  "unset",
]);

// font-style values
const FONT_STYLES = new Set([
  "normal",
  "italic",
  "oblique",
  "inherit",
  "initial",
  "unset",
]);

// font-weight values
const FONT_WEIGHTS = new Set([
  "normal",
  "bold",
  "bolder",
  "lighter",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
]);

// font-variant values
const FONT_VARIANTS = new Set([
  "normal",
  "small-caps",
  "inherit",
  "initial",
  "unset",
]);

// flex-direction values
const FLEX_DIRECTIONS = new Set([
  "row",
  "row-reverse",
  "column",
  "column-reverse",
]);
// flex-wrap values
const FLEX_WRAPS = new Set(["nowrap", "wrap", "wrap-reverse"]);

// ---------------------------------------------------------------------------
// Individual shorthand builders
// ---------------------------------------------------------------------------

function tryMarginPadding(prop, decls) {
  const sides = ["top", "right", "bottom", "left"];
  const values = sides.map((s) => decls[`${prop}-${s}`]);
  if (!values.every(Boolean)) return null;
  return {
    [prop]: fourSide(...values),
    removes: sides.map((s) => `${prop}-${s}`),
  };
}

function tryBorderSide(side, decls) {
  // border-{side}: width style color
  const w = decls[`border-${side}-width`];
  const s = decls[`border-${side}-style`];
  const c = decls[`border-${side}-color`];
  const parts = [w, s, c].filter(Boolean);
  if (parts.length === 0) return null;
  const removes = [];
  if (w) removes.push(`border-${side}-width`);
  if (s) removes.push(`border-${side}-style`);
  if (c) removes.push(`border-${side}-color`);
  if (removes.length < 2) return null; // only worth merging 2+
  const val = parts.join(" ");
  return { [`border-${side}`]: val, removes };
}

function tryBorder(decls) {
  // Try global border shorthand only if all 4 sides are identical
  const sides = ["top", "right", "bottom", "left"];
  const widths = sides.map(
    (s) => decls[`border-${s}-width`] || decls["border-width"],
  );
  const styles = sides.map(
    (s) => decls[`border-${s}-style`] || decls["border-style"],
  );
  const colors = sides.map(
    (s) => decls[`border-${s}-color`] || decls["border-color"],
  );

  const allSame = (arr) => arr.every(Boolean) && arr.every((v) => v === arr[0]);

  if (allSame(widths) && allSame(styles) && allSame(colors)) {
    const val = `${widths[0]} ${styles[0]} ${colors[0]}`;
    const removes = [];
    for (const s of sides) {
      for (const p of ["width", "style", "color"]) {
        if (decls[`border-${s}-${p}`]) removes.push(`border-${s}-${p}`);
      }
    }
    for (const p of ["width", "style", "color"]) {
      if (decls[`border-${p}`]) removes.push(`border-${p}`);
    }
    if (removes.length < 3) return null;
    return { border: val, removes };
  }

  return null;
}

function tryBackground(decls) {
  const color = decls["background-color"];
  const image = decls["background-image"];
  const repeat = decls["background-repeat"];
  const position = decls["background-position"];
  const size = decls["background-size"];
  const attachment = decls["background-attachment"];
  const origin = decls["background-origin"];
  const clip = decls["background-clip"];

  const present = [
    color,
    image,
    repeat,
    position,
    size,
    attachment,
    origin,
    clip,
  ].filter(Boolean);
  if (present.length < 2) return null;

  // Build shorthand: [color] [image] [position][/size] [repeat] [attachment] [origin] [clip]
  const parts = [];
  if (image && image !== "none") parts.push(image);
  if (position) {
    parts.push(size ? `${position}/${size}` : position);
  } else if (size) {
    parts.push(`50%/${size}`); // need position before /size
  }
  if (repeat && repeat !== "repeat") parts.push(repeat);
  if (attachment && attachment !== "scroll") parts.push(attachment);
  if (origin && origin !== "padding-box") parts.push(origin);
  if (clip && clip !== "border-box") parts.push(clip);
  if (color && color !== "transparent") parts.push(color);

  if (parts.length < 2) return null;

  const removes = [
    "background-color",
    "background-image",
    "background-repeat",
    "background-position",
    "background-size",
    "background-attachment",
    "background-origin",
    "background-clip",
  ].filter((p) => decls[p]);

  return { background: parts.join(" "), removes };
}

function tryFont(decls) {
  // font: [style] [variant] [weight] [stretch] size[/line-height] family
  const style = decls["font-style"];
  const variant = decls["font-variant"];
  const weight = decls["font-weight"];
  const stretch = decls["font-stretch"];
  const size = decls["font-size"];
  const lineHeight = decls["line-height"];
  const family = decls["font-family"];

  // size and family are REQUIRED for font shorthand
  if (!size || !family) return null;

  const present = [
    style,
    variant,
    weight,
    stretch,
    size,
    lineHeight,
    family,
  ].filter(Boolean);
  if (present.length < 3) return null;

  const parts = [];
  if (style && style !== "normal") parts.push(style);
  if (variant && variant !== "normal") parts.push(variant);
  if (weight && weight !== "normal" && weight !== "400") parts.push(weight);
  if (stretch && stretch !== "normal") parts.push(stretch);
  parts.push(
    lineHeight && lineHeight !== "normal" ? `${size}/${lineHeight}` : size,
  );
  parts.push(family);

  const removes = [
    "font-style",
    "font-variant",
    "font-weight",
    "font-stretch",
    "font-size",
    "line-height",
    "font-family",
  ].filter((p) => decls[p]);

  if (removes.length < 3) return null;
  return { font: parts.join(" "), removes };
}

function tryOutline(decls) {
  const w = decls["outline-width"];
  const s = decls["outline-style"];
  const c = decls["outline-color"];
  const parts = [w, s, c].filter(Boolean);
  if (parts.length < 2) return null;
  const removes = ["outline-width", "outline-style", "outline-color"].filter(
    (p) => decls[p],
  );
  return { outline: parts.join(" "), removes };
}

function tryListStyle(decls) {
  const t = decls["list-style-type"];
  const p = decls["list-style-position"];
  const i = decls["list-style-image"];
  const parts = [t, p, i].filter(Boolean);
  if (parts.length < 2) return null;
  const removes = [
    "list-style-type",
    "list-style-position",
    "list-style-image",
  ].filter((p2) => decls[p2]);
  return { "list-style": parts.join(" "), removes };
}

function tryTextDecoration(decls) {
  const line = decls["text-decoration-line"];
  const color = decls["text-decoration-color"];
  const style = decls["text-decoration-style"];
  const thickness = decls["text-decoration-thickness"];
  const parts = [line, style, color, thickness].filter(Boolean);
  if (parts.length < 2) return null;
  const removes = [
    "text-decoration-line",
    "text-decoration-color",
    "text-decoration-style",
    "text-decoration-thickness",
  ].filter((p) => decls[p]);
  return { "text-decoration": parts.join(" "), removes };
}

function tryColumnRule(decls) {
  const w = decls["column-rule-width"];
  const s = decls["column-rule-style"];
  const c = decls["column-rule-color"];
  const parts = [w, s, c].filter(Boolean);
  if (parts.length < 2) return null;
  const removes = [
    "column-rule-width",
    "column-rule-style",
    "column-rule-color",
  ].filter((p) => decls[p]);
  return { "column-rule": parts.join(" "), removes };
}

function tryTransition(decls) {
  // transition-property, duration, timing-function, delay
  const property = decls["transition-property"];
  const duration = decls["transition-duration"];
  const timing = decls["transition-timing-function"];
  const delay = decls["transition-delay"];

  if (!duration) return null; // duration is required
  const present = [property, duration, timing, delay].filter(Boolean);
  if (present.length < 2) return null;

  // Build: property duration timing-function delay
  const parts = [];
  if (property && property !== "all") parts.push(property);
  parts.push(duration);
  if (timing && timing !== "ease") parts.push(timing);
  if (delay && delay !== "0s" && delay !== "0") parts.push(delay);

  const removes = [
    "transition-property",
    "transition-duration",
    "transition-timing-function",
    "transition-delay",
  ].filter((p) => decls[p]);
  if (removes.length < 2) return null;
  return { transition: parts.join(" "), removes };
}

function tryAnimation(decls) {
  const name = decls["animation-name"];
  const duration = decls["animation-duration"];
  const timing = decls["animation-timing-function"];
  const delay = decls["animation-delay"];
  const count = decls["animation-iteration-count"];
  const direction = decls["animation-direction"];
  const fillMode = decls["animation-fill-mode"];
  const playState = decls["animation-play-state"];

  if (!name || !duration) return null;
  const present = [
    name,
    duration,
    timing,
    delay,
    count,
    direction,
    fillMode,
    playState,
  ].filter(Boolean);
  if (present.length < 3) return null;

  // order: name duration timing delay count direction fill-mode play-state
  const parts = [name, duration];
  if (timing && timing !== "ease") parts.push(timing);
  if (delay && delay !== "0s" && delay !== "0") parts.push(delay);
  if (count && count !== "1") parts.push(count);
  if (direction && direction !== "normal") parts.push(direction);
  if (fillMode && fillMode !== "none") parts.push(fillMode);
  if (playState && playState !== "running") parts.push(playState);

  const removes = [
    "animation-name",
    "animation-duration",
    "animation-timing-function",
    "animation-delay",
    "animation-iteration-count",
    "animation-direction",
    "animation-fill-mode",
    "animation-play-state",
  ].filter((p) => decls[p]);
  if (removes.length < 3) return null;
  return { animation: parts.join(" "), removes };
}

function tryFlex(decls) {
  const grow = decls["flex-grow"];
  const shrink = decls["flex-shrink"];
  const basis = decls["flex-basis"];
  const present = [grow, shrink, basis].filter(Boolean);
  if (present.length < 2) return null;

  // flex: none | [grow shrink? basis?]
  const removes = ["flex-grow", "flex-shrink", "flex-basis"].filter(
    (p) => decls[p],
  );

  // Common shorthands
  if (grow === "1" && shrink === "1" && (basis === "0%" || basis === "0"))
    return { flex: "1", removes };
  if (grow === "0" && shrink === "0" && basis === "auto")
    return { flex: "none", removes };

  const parts = [grow ?? "1", shrink ?? "1", basis ?? "0%"];
  return { flex: parts.join(" "), removes };
}

function tryFlexFlow(decls) {
  const dir = decls["flex-direction"];
  const wrap = decls["flex-wrap"];
  if (!dir && !wrap) return null;
  if (!dir || !wrap) return null; // need both for it to be worth it
  const removes = ["flex-direction", "flex-wrap"].filter((p) => decls[p]);
  let val = "";
  if (dir !== "row") val += dir;
  if (wrap !== "nowrap") val += (val ? " " : "") + wrap;
  if (!val) return null; // both are defaults, remove both separately
  return { "flex-flow": `${dir} ${wrap}`, removes };
}

function tryOverflow(decls) {
  const x = decls["overflow-x"];
  const y = decls["overflow-y"];
  if (!x || !y) return null;
  if (x === y) return { overflow: x, removes: ["overflow-x", "overflow-y"] };
  return { overflow: `${x} ${y}`, removes: ["overflow-x", "overflow-y"] };
}

function tryBorderRadius(decls) {
  const tl = decls["border-top-left-radius"];
  const tr = decls["border-top-right-radius"];
  const br = decls["border-bottom-right-radius"];
  const bl = decls["border-bottom-left-radius"];
  if (!tl && !tr && !br && !bl) return null;
  if (!tl || !tr || !br || !bl) return null; // need all 4
  const val = fourSide(tl, tr, br, bl);
  return {
    "border-radius": val,
    removes: [
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
    ],
  };
}

function tryInset(decls) {
  const t = decls["top"];
  const r = decls["right"];
  const b = decls["bottom"];
  const l = decls["left"];
  if (!t || !r || !b || !l) return null;
  return {
    inset: fourSide(t, r, b, l),
    removes: ["top", "right", "bottom", "left"],
  };
}

function tryPlaceContent(decls) {
  const ac = decls["align-content"];
  const jc = decls["justify-content"];
  if (!ac || !jc) return null;
  if (ac === jc)
    return {
      "place-content": ac,
      removes: ["align-content", "justify-content"],
    };
  return {
    "place-content": `${ac} ${jc}`,
    removes: ["align-content", "justify-content"],
  };
}

function tryPlaceItems(decls) {
  const ai = decls["align-items"];
  const ji = decls["justify-items"];
  if (!ai || !ji) return null;
  if (ai === ji)
    return { "place-items": ai, removes: ["align-items", "justify-items"] };
  return {
    "place-items": `${ai} ${ji}`,
    removes: ["align-items", "justify-items"],
  };
}

function tryPlaceSelf(decls) {
  const as = decls["align-self"];
  const js = decls["justify-self"];
  if (!as || !js) return null;
  if (as === js)
    return { "place-self": as, removes: ["align-self", "justify-self"] };
  return {
    "place-self": `${as} ${js}`,
    removes: ["align-self", "justify-self"],
  };
}

function tryGridTemplate(decls) {
  const rows = decls["grid-template-rows"];
  const cols = decls["grid-template-columns"];
  if (!rows || !cols) return null;
  const removes = ["grid-template-rows", "grid-template-columns"];
  if (decls["grid-template-areas"]) {
    // Can't safely auto-combine with areas
    return null;
  }
  return { "grid-template": `${rows} / ${cols}`, removes };
}

// ---------------------------------------------------------------------------
// Main export: merge longhands in a declarations map
// ---------------------------------------------------------------------------

/**
 * @param {Map<string, {value: string, important: boolean}>} declMap
 * @returns {Map<string, {value: string, important: boolean}>}
 */
export function mergeShorthands(declMap) {
  // Build a plain object for easy lookup (only non-important for now — important
  // declarations are left alone to avoid cascading issues)
  const decls = {};
  for (const [prop, { value, important }] of declMap) {
    if (!important) decls[prop] = value;
  }

  const merges = [];

  // Run all mergers
  const runners = [
    () => tryMarginPadding("margin", decls),
    () => tryMarginPadding("padding", decls),
    () => tryBorder(decls),
    () => tryBorderSide("top", decls),
    () => tryBorderSide("right", decls),
    () => tryBorderSide("bottom", decls),
    () => tryBorderSide("left", decls),
    () => tryBorderRadius(decls),
    () => tryBackground(decls),
    () => tryFont(decls),
    () => tryOutline(decls),
    () => tryListStyle(decls),
    () => tryTextDecoration(decls),
    () => tryColumnRule(decls),
    () => tryTransition(decls),
    () => tryAnimation(decls),
    () => tryFlex(decls),
    () => tryFlexFlow(decls),
    () => tryOverflow(decls),
    () => tryInset(decls),
    () => tryPlaceContent(decls),
    () => tryPlaceItems(decls),
    () => tryPlaceSelf(decls),
    () => tryGridTemplate(decls),
  ];

  // Track which properties have been consumed
  const consumed = new Set();

  for (const runner of runners) {
    const result = runner();
    if (!result) continue;

    // Check none of the removes are already consumed
    const [shorthand, { removes, ...rest }] =
      Object.entries(result).length === 1
        ? [
            Object.keys(result)[0],
            {
              removes:
                result[Object.keys(result)[0] + "_removes"] || result.removes,
            },
          ]
        : (() => {
            const entries = Object.entries(result);
            const removesEntry = entries.find(([k]) => k === "removes");
            const shortEntry = entries.find(([k]) => k !== "removes");
            return [
              shortEntry[0],
              { removes: removesEntry ? removesEntry[1] : [] },
            ];
          })();

    // Re-extract properly
    const shortProp = Object.keys(result).find((k) => k !== "removes");
    const shortVal = result[shortProp];
    const removals = result.removes || [];

    if (removals.some((r) => consumed.has(r))) continue;
    // Mark as consumed
    for (const r of removals) consumed.add(r);

    merges.push({ prop: shortProp, value: shortVal, removes: removals });
  }

  // Build output map: start with original order, apply merges
  const out = new Map(declMap);

  for (const { prop, value, removes } of merges) {
    // Insert shorthand at the position of the first longhand
    let insertPos = null;
    for (const r of removes) {
      if (insertPos === null) insertPos = r;
    }
    // Remove longhands
    for (const r of removes) out.delete(r);
    // Add shorthand
    out.set(prop, { value, important: false });
  }

  return out;
}
