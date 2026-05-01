/**
 * CSS Dead Declaration Removal
 *
 * Drops declarations whose value matches the property's CSS initial value
 * (the value the browser uses when no rule applies). These declarations
 * have no visual effect and just bloat the stylesheet.
 *
 * Examples removed:
 *   color: #000             (browser default for most contexts is black-ish; SAFE only in body context)
 *   font-style: normal      (initial value)
 *   font-weight: normal     (initial value)
 *   font-weight: 400        (alias for normal)
 *   text-decoration: none   (initial value)
 *   font-variant: normal    (initial value)
 *
 * Note: We're conservative. `color: #000` is NOT a true initial value
 * (initial is `canvastext`/`black` depending on context), and removing it
 * could change rendering if a parent's color is different. We only remove
 * values that are PROVABLY no-ops.
 */

// Map of property -> set of values that are equivalent to the initial value.
// We only include values that are 100% no-ops regardless of context.
const NOOP_VALUES = new Map([
  ["font-style", new Set(["normal"])],
  ["font-variant", new Set(["normal"])],
  ["font-weight", new Set(["normal", "400"])],
  ["font-stretch", new Set(["normal"])],
  ["text-decoration", new Set(["none"])],
  ["text-decoration-line", new Set(["none"])],
  ["text-transform", new Set(["none"])],
  ["letter-spacing", new Set(["normal"])],
  ["word-spacing", new Set(["normal"])],
  ["white-space", new Set(["normal"])],
  ["vertical-align", new Set(["baseline"])],
  ["list-style-type", new Set(["disc"])], // ul default
  ["list-style-position", new Set(["outside"])],
  ["list-style-image", new Set(["none"])],
  ["border-style", new Set(["none"])],
  ["border-width", new Set(["medium"])], // unusual but valid
  ["outline-style", new Set(["none"])],
  ["background-image", new Set(["none"])],
  ["background-repeat", new Set(["repeat"])],
  ["background-attachment", new Set(["scroll"])],
  ["background-position", new Set(["0% 0%", "0 0", "left top"])],
  ["background-size", new Set(["auto", "auto auto"])],
  ["overflow", new Set(["visible"])],
  ["overflow-x", new Set(["visible"])],
  ["overflow-y", new Set(["visible"])],
  ["position", new Set(["static"])],
  ["float", new Set(["none"])],
  ["clear", new Set(["none"])],
  ["visibility", new Set(["visible"])],
  ["opacity", new Set(["1"])],
  ["transform", new Set(["none"])],
  ["transition", new Set(["all 0s ease 0s", "0s"])],
  ["animation", new Set(["none 0s ease 0s 1 normal none running"])],
  ["box-shadow", new Set(["none"])],
  ["text-shadow", new Set(["none"])],
  ["filter", new Set(["none"])],
  ["backdrop-filter", new Set(["none"])],
  ["clip-path", new Set(["none"])],
  ["mix-blend-mode", new Set(["normal"])],
  ["isolation", new Set(["auto"])],
  ["object-fit", new Set(["fill"])],
  ["pointer-events", new Set(["auto"])],
  ["user-select", new Set(["auto"])],
  ["resize", new Set(["none"])],
  ["empty-cells", new Set(["show"])],
  ["table-layout", new Set(["auto"])],
  ["caption-side", new Set(["top"])],
  ["direction", new Set(["ltr"])],
  ["unicode-bidi", new Set(["normal"])],
  ["writing-mode", new Set(["horizontal-tb"])],
]);

// Properties that look like conversion-tool artifacts (Word, Pages, etc.)
// and can typically be removed unless explicitly preserved.
const ARTIFACT_PROPERTY_PATTERNS = [
  /^--inside-[hv]$/, // .docx table conversion artifacts
  /^mso-/, // Microsoft Office artifacts
  /^-xv-/, // Opera vendor extension
];

/**
 * Check if a value is "no-op" - matches the CSS initial value for the property.
 */
function isNoopValue(prop, value) {
  const v = value.trim().toLowerCase();
  // Strip !important first - never drop !important declarations even if value is initial
  if (/!important\s*$/i.test(v)) return false;

  const noops = NOOP_VALUES.get(prop.toLowerCase());
  if (!noops) return false;
  return noops.has(v);
}

/**
 * Check if a property name looks like a conversion-tool artifact.
 */
function isArtifactProperty(prop) {
  return ARTIFACT_PROPERTY_PATTERNS.some((re) => re.test(prop));
}

/**
 * Remove declarations that have no visual effect from a declarations Map.
 *
 * @param {Map<string, {value:string, important:boolean}>} declMap
 * @param {object} [options]
 * @param {boolean} [options.removeNoopValues=true]    - drop e.g. font-style:normal
 * @param {boolean} [options.removeArtifacts=true]     - drop --inside-h, mso-*, etc.
 * @returns {Map<string, {value:string, important:boolean}>}
 */
export function removeDeadDeclarations(declMap, options = {}) {
  const { removeNoopValues = true, removeArtifacts = true } = options;

  const out = new Map();
  for (const [prop, decl] of declMap) {
    if (decl.important) {
      // Never strip !important declarations
      out.set(prop, decl);
      continue;
    }
    if (removeArtifacts && isArtifactProperty(prop)) continue;
    if (removeNoopValues && isNoopValue(prop, decl.value)) continue;
    out.set(prop, decl);
  }
  return out;
}
