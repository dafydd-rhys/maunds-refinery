export { cleanHtml } from "./engine/html/clean.js";

export {
  prettifyHtml,
  DEFAULT_PRETTIFY_OPTIONS,
} from "./engine/html/prettify.js";

export {
  condenseHtml,
  DEFAULT_CONDENSE_OPTIONS,
} from "./engine/html/condense.js";

export { transformHtml } from "./engine/html/transform.js";

export {
  transformCss,
  parseDeclarations,
  serializeDeclarations,
  parseStylesheet,
  optimizeDeclarations,
  transformInlineStyle,
} from "./engine/css/transform.js";

export { createDescriptiveNameGenerator } from "./engine/html/classnames.js";

export {
  normalizeColor,
  normalizeValue,
  parseImportant,
} from "./engine/css/normalize.js";

export { mergeShorthands } from "./engine/css/shorthands.js";

export { removeDeadDeclarations } from "./engine/css/dead-code.js";

export {
  mergeAdjacentInlineTags,
  hoistSharedClasses,
  stripTrailingNbsp,
  removeEmptyParagraphs,
  removeCellspacing,
  mergeAdjacentLists,
  unwrapSoleInlineChildren,
  buildClassPropertyMap,
} from "./engine/html/structural.js";
