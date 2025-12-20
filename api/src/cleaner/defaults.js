// Rules that are SAFE to remove
export const REMOVABLE_ATTRIBUTES = [
  "style",        // only if empty
  "class",        // only if empty
  "id",           // only if empty
  "data-reactid",
];

// Self-closing tags we should NOT strip
export const SAFE_TAGS = [
  "img",
  "input",
  "br",
  "hr",
  "meta",
  "link"
];
