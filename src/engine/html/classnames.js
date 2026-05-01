/**
 * Descriptive class name generator for extracted inline styles.
 *
 * Generates Tailwind-style names based on the most "defining" property
 * in a declaration set, with priority ordering. Collisions get a -2, -3 suffix.
 *
 *   { color: #f00 }                              -> .text-f00
 *   { display: flex; padding: 4px }              -> .flex
 *   { text-align: center; font-size: 8pt }       -> .text-center
 *   { border: 1px solid #000 }                   -> .border
 *   { font-size: 8pt }                           -> .fs-8pt
 *
 * Two different rules may produce the same primary name; collisions get
 * suffixed: .text-center, .text-center-2, .text-center-3.
 */

// Property priority — earlier entries win when a rule has multiple properties.
// The first property in this list that's present in the rule becomes the
// name driver. Properties not in this list fall through to the bottom.
const PROPERTY_PRIORITY = [
  // Layout (most defining)
  "display",
  "position",
  "float",
  "flex-direction",
  "grid-template",
  // Visual identity
  "background",
  "background-color",
  "background-image",
  "border",
  "border-radius",
  "box-shadow",
  // Color
  "color",
  // Typography
  "font",
  "font-family",
  "font-weight",
  "font-style",
  "font-size",
  "line-height",
  "letter-spacing",
  // Alignment
  "text-align",
  "vertical-align",
  // Box
  "width",
  "height",
  "max-width",
  "min-height",
  "margin",
  "padding",
  // Other
  "opacity",
  "transform",
  "transition",
  "cursor",
  "z-index",
];

// Map from property name to abbreviated prefix used in the class name.
const PROPERTY_ABBREVIATIONS = {
  display: { prefix: null, useValue: true }, // .flex, .block, .inline
  position: { prefix: null, useValue: true }, // .absolute, .relative
  float: { prefix: "float" }, // .float-left
  "flex-direction": { prefix: "flex" }, // .flex-row
  "grid-template": { prefix: "grid" },
  background: { prefix: "bg" },
  "background-color": { prefix: "bg" },
  "background-image": { prefix: "bg-img" },
  border: { prefix: null, valueIs: "border" }, // .border (when present)
  "border-radius": { prefix: "rounded" },
  "box-shadow": { prefix: "shadow" },
  color: { prefix: "text" },
  font: { prefix: "font" },
  "font-family": { prefix: "ff" },
  "font-weight": { prefix: "fw" },
  "font-style": { prefix: "fs" },
  "font-size": { prefix: "fs" },
  "line-height": { prefix: "lh" },
  "letter-spacing": { prefix: "tracking" },
  "text-align": { prefix: "text" },
  "vertical-align": { prefix: "align" },
  width: { prefix: "w" },
  height: { prefix: "h" },
  "max-width": { prefix: "max-w" },
  "min-height": { prefix: "min-h" },
  margin: { prefix: "m" },
  padding: { prefix: "p" },
  opacity: { prefix: "opacity" },
  transform: { prefix: "transform" },
  transition: { prefix: "transition" },
  cursor: { prefix: "cursor" },
  "z-index": { prefix: "z" },
};

/**
 * Sanitize a CSS value into something class-name friendly.
 *   "#f00"      -> "f00"
 *   "8pt"       -> "8pt"
 *   "1px solid black" -> "1px"  (just the first token)
 *   "rgba(0,0,0,.5)"  -> "rgba"
 *   ".5"        -> "50"   (decimals lose dot)
 *   "auto"      -> "auto"
 */
function sanitizeValue(value) {
  let v = value.trim().toLowerCase();
  // Take the first whitespace-separated token (so "1px solid #000" -> "1px")
  v = v.split(/\s+/)[0];
  // Strip parens content
  v = v.replace(/\([^)]*\)/, "");
  // Drop the # from hex
  v = v.replace(/^#/, "");
  // Replace dots in decimals (.5 -> 5)
  v = v.replace(/^\./, "");
  v = v.replace(/\./g, "_");
  // Strip leading/trailing underscores/dashes
  v = v.replace(/^[-_]+|[-_]+$/g, "");
  // Replace any remaining non-alphanumeric with dash
  v = v.replace(/[^a-z0-9-]/g, "-");
  v = v.replace(/-+/g, "-");
  v = v.replace(/^-|-$/g, "");
  return v || "x";
}

/**
 * Pick the defining property from a declarations Map.
 * Returns the property name, or null if the Map is empty.
 */
function pickDefiningProperty(decls) {
  if (decls.size === 0) return null;
  // Find the highest-priority property present
  for (const prop of PROPERTY_PRIORITY) {
    if (decls.has(prop)) return prop;
  }
  // Fallback: just return the first declared property
  return decls.keys().next().value;
}

/**
 * Build a base class name (before collision handling) from declarations.
 * @param {Map<string, {value:string, important:boolean}>} decls
 * @returns {string}
 */
function buildBaseName(decls) {
  const prop = pickDefiningProperty(decls);
  if (!prop) return "x";

  const value = decls.get(prop).value;
  const config = PROPERTY_ABBREVIATIONS[prop];

  if (!config) {
    // Unknown property — just use the property name as the class
    return prop.replace(/[^a-z0-9-]/gi, "-");
  }

  // Some properties: just use the value as the name (like .flex, .absolute)
  if (config.useValue) {
    return sanitizeValue(value);
  }

  // Border-style: .border without a value when it's just "border: ..."
  if (config.valueIs === "border") {
    return "border";
  }

  // Otherwise: prefix-value form
  if (config.prefix) {
    const valuePart = sanitizeValue(value);
    return `${config.prefix}-${valuePart}`;
  }

  return sanitizeValue(value);
}

// ---------------------------------------------------------------------------
// Generator with collision tracking
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {string} [options.prefix="mr-"]      - prefix for opaque/multi-property names
 * @param {boolean} [options.descriptive=true] - if false, ALL classes get opaque names
 * @param {string} [options.opaqueFormat="c"]  - opaque body format: "c001", "c002" -> .mr-c001
 */
export function createDescriptiveNameGenerator(options = {}) {
  const { prefix = "mr-", descriptive = true, opaqueFormat = "c" } = options;

  // Map from base name -> next suffix number to use.
  // First use of a base name gets no suffix; second gets -2; third -3 etc.
  const usageCount = new Map();

  // Counter for opaque names (multi-property rules)
  let opaqueCounter = 0;

  return function generateName(decls) {
    // Hybrid strategy:
    //   - 1 declaration => descriptive name (.fs-8pt, .text-center)
    //     - because the name is honest: it captures the entire rule
    //   - 2+ declarations => opaque name (.mr-c001)
    //     - because no descriptive name can capture multiple properties
    //       without lying about what's in the rule
    const isMultiProp = decls.size > 1;

    if (isMultiProp || !descriptive) {
      opaqueCounter += 1;
      const id = String(opaqueCounter).padStart(3, "0");
      return `${prefix}${opaqueFormat}${id}`;
    }

    // Single-property rule: build a descriptive name
    const base = `${prefix}${buildBaseName(decls)}`;
    const count = usageCount.get(base) ?? 0;
    usageCount.set(base, count + 1);
    if (count === 0) return base;
    return `${base}-${count + 1}`;
  };
}
