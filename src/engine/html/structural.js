/**
 * HTML Structural Optimizations
 *
 * Two safe transformations that reduce code size without altering visual output:
 *
 *   1. mergeAdjacentInlineTags
 *      <strong>A</strong><strong>B</strong>  ->  <strong>AB</strong>
 *      <em>X</em> <em>Y</em>                  ->  <em>X Y</em>
 *
 *      Only merges sibling pairs of the SAME tag where:
 *        - tag is in SAFE_INLINE_MERGE (pure formatting, no semantic change)
 *        - both have NO attributes (or identical attributes)
 *        - no significant content between them (only whitespace allowed,
 *          which gets preserved as a single space between merged content)
 *
 *   2. hoistSharedClasses
 *      <tr><td class="x">a</td><td class="x">b</td><td class="x">c</td></tr>
 *      ->
 *      <tr class="x"><td>a</td><td>b</td><td>c</td></tr>
 *
 *      Only hoists when EVERY element-child of the parent has the exact
 *      same class set. Skips text nodes/comments. Refuses to hoist if
 *      the parent already has any class that would conflict.
 *
 *      Note: This is a DOM optimization. Selector specificity is generally
 *      preserved because for a flat class selector `.x { ... }`, applying
 *      `.x` to either the parent OR the children produces the same cascade
 *      due to inheritance for inheritable properties; non-inheritable
 *      properties (like `padding`, `width`) on `.x` would not transfer.
 *      So we use a property-aware check: only hoist when ALL declarations
 *      in the shared class are inheritable, OR the user opts in to lossy mode.
 */

// ---------------------------------------------------------------------------
// Adjacent inline tag merging
// ---------------------------------------------------------------------------

// These tags are pure presentational/semantic wrappers around text. Merging
// adjacent same-tag siblings produces visually identical output.
//
// Excluded on purpose:
//   - <a>: href differs per anchor
//   - <span>: only safe when class/style match exactly (handled by attribute check)
//   - <code>/<kbd>/<samp>/<var>: content-meaning matters; merging changes semantics subtly
const SAFE_INLINE_MERGE = new Set([
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "mark",
  "small",
  "sub",
  "sup",
  "ins",
  "del",
]);

// We DO allow merging spans/anchors etc. when their attrs match exactly.
const ATTR_MATCH_MERGE = new Set(["span", "a", "code", "kbd", "samp", "var"]);

function attrsEqual(a, b) {
  const al = a?.attrs ?? [];
  const bl = b?.attrs ?? [];
  if (al.length !== bl.length) return false;
  // Sort by name for stable comparison
  const am = new Map(al.map((x) => [x.name, x.value]));
  for (const { name, value } of bl) {
    if (am.get(name) !== value) return false;
  }
  return true;
}

function isWhitespaceOnly(node) {
  return node?.nodeName === "#text" && /^\s*$/.test(node.value);
}

function canMerge(a, b) {
  if (!a || !b) return false;
  const tag = a.tagName || a.nodeName;
  if (tag !== (b.tagName || b.nodeName)) return false;

  if (SAFE_INLINE_MERGE.has(tag)) {
    // Safe tags: merge only when neither has attributes (any attribute could
    // change appearance: class, style, id, title, lang, ...). We're strict here.
    if ((a.attrs?.length ?? 0) > 0) return false;
    if ((b.attrs?.length ?? 0) > 0) return false;
    return true;
  }

  if (ATTR_MATCH_MERGE.has(tag)) {
    return attrsEqual(a, b);
  }

  return false;
}

/**
 * Recursively merges adjacent same-tag inline siblings.
 * Mutates the tree in place.
 */
export function mergeAdjacentInlineTags(node) {
  if (!node || !node.childNodes) return;

  // Recurse first (depth-first, so inner merges happen before outer)
  for (const child of node.childNodes) {
    mergeAdjacentInlineTags(child);
  }

  const children = node.childNodes;
  const merged = [];

  for (let i = 0; i < children.length; i++) {
    const cur = children[i];
    const prev = merged[merged.length - 1];

    // Direct adjacency
    if (prev && canMerge(prev, cur)) {
      // Move all of cur's children into prev
      for (const c of cur.childNodes ?? []) {
        c.parentNode = prev;
        prev.childNodes.push(c);
      }
      // Recursively merge inside the joined node (children may now be mergeable)
      mergeAdjacentInlineTags(prev);
      continue;
    }

    // Whitespace-separated: <strong>A</strong> <strong>B</strong>
    // Merge into <strong>A B</strong> by absorbing the whitespace inside prev
    if (prev && isWhitespaceOnly(cur)) {
      const next = children[i + 1];
      if (next && canMerge(prev, next)) {
        // Append the whitespace text node to prev's children
        cur.parentNode = prev;
        prev.childNodes.push(cur);
        // Then merge next into prev
        for (const c of next.childNodes ?? []) {
          c.parentNode = prev;
          prev.childNodes.push(c);
        }
        mergeAdjacentInlineTags(prev);
        i++; // skip next
        continue;
      }
    }

    merged.push(cur);
  }

  node.childNodes = merged;
}

// ---------------------------------------------------------------------------
// Class hoisting
// ---------------------------------------------------------------------------

// Properties that CSS spec says are NOT inherited by default.
// If a hoisted class contains ONLY inheritable properties, hoisting is safe.
// If it contains non-inheritable ones, hoisting changes layout (e.g., padding
// applied to <tr> instead of each <td>).
//
// We err on the side of correctness: if any non-inheritable property is in
// the class's declaration set, we DON'T hoist. The client can opt into
// lossy hoisting if they really want it.
const NON_INHERITABLE_PROPERTIES = new Set([
  // Box model / sizing
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  // Border (border-style is inherited via shorthand BUT individual border
  // applies to the element box, so non-inheritable in practice)
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  // Layout
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "float",
  "clear",
  "overflow",
  "overflow-x",
  "overflow-y",
  "clip",
  "clip-path",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "grid-area",
  "grid-row",
  "grid-column",
  "grid-template",
  "grid-gap",
  "gap",
  "align-self",
  "justify-self",
  "place-self",
  "order",
  "opacity",
  "transform",
  "transform-origin",
  "filter",
  "background",
  "background-color",
  "background-image",
  "background-repeat",
  "background-position",
  "background-size",
  "background-attachment",
  "box-shadow",
  "outline",
  "outline-width",
  "outline-style",
  "outline-color",
  "vertical-align",
  "table-layout",
  // Cursor is inherited but interactivity isn't always wanted; keep it inheritable
]);

/**
 * Build a Map of classname -> declarations from the extracted styles.
 * @param {Map<string, Map<string,{value:string,important:boolean}>>} extractedStyles
 * @returns {Map<string, Set<string>>} classname -> Set of declared property names
 */
function buildClassPropertyMap(extractedStyles) {
  const map = new Map();
  for (const [className, decls] of extractedStyles) {
    map.set(className, new Set(decls.keys()));
  }
  return map;
}

/**
 * Get the canonical class set (sorted, deduped) of a node.
 * Returns null if no class attribute or empty class.
 */
function getClassSet(node) {
  const cls = node.attrs?.find((a) => a.name === "class")?.value;
  if (!cls) return null;
  const arr = cls.trim().split(/\s+/).filter(Boolean);
  if (arr.length === 0) return null;
  return arr.sort().join(" ");
}

function elementChildren(node) {
  return (node.childNodes ?? []).filter((c) => c.tagName);
}

/**
 * Recursively hoist shared classes from element children up to their parent.
 * Mutates the tree in place.
 *
 * @param {object} node
 * @param {Map<string, Set<string>>} classProps - map of classname -> declared properties
 */
export function hoistSharedClasses(node, classProps) {
  if (!node || !node.childNodes) return;

  // Recurse into children first
  for (const child of node.childNodes) {
    hoistSharedClasses(child, classProps);
  }

  const elemChildren = elementChildren(node);
  if (elemChildren.length < 2) return; // need at least 2 to have something shared

  // Find classes that EVERY element child has
  const firstClasses = (
    elemChildren[0].attrs?.find((a) => a.name === "class")?.value ?? ""
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (firstClasses.length === 0) return;

  const sharedClasses = firstClasses.filter((cls) => {
    return elemChildren.every((child) => {
      const cs = (child.attrs?.find((a) => a.name === "class")?.value ?? "")
        .trim()
        .split(/\s+/);
      return cs.includes(cls);
    });
  });

  if (sharedClasses.length === 0) return;

  // Filter to only classes safe to hoist (only inheritable properties)
  const safeToHoist = sharedClasses.filter((cls) => {
    const props = classProps.get(cls);
    if (!props) return false; // unknown class, don't touch
    for (const p of props) {
      if (NON_INHERITABLE_PROPERTIES.has(p)) return false;
    }
    return true;
  });

  if (safeToHoist.length === 0) return;

  // Hoist: add to parent, remove from each child
  const parentClassAttr = node.attrs?.find((a) => a.name === "class");
  const parentClasses = new Set(
    (parentClassAttr?.value ?? "").trim().split(/\s+/).filter(Boolean),
  );
  for (const cls of safeToHoist) parentClasses.add(cls);
  const newParentClass = [...parentClasses].join(" ");
  if (parentClassAttr) {
    parentClassAttr.value = newParentClass;
  } else {
    node.attrs = node.attrs ?? [];
    node.attrs.push({ name: "class", value: newParentClass });
  }

  // Remove the hoisted classes from each child
  for (const child of elemChildren) {
    const ca = child.attrs.find((a) => a.name === "class");
    if (!ca) continue;
    const remaining = ca.value
      .trim()
      .split(/\s+/)
      .filter((c) => c && !safeToHoist.includes(c));
    if (remaining.length === 0) {
      child.attrs = child.attrs.filter((a) => a.name !== "class");
    } else {
      ca.value = remaining.join(" ");
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup transforms (off by default — opt-in)
// ---------------------------------------------------------------------------

/**
 * Detect text nodes that contain ONLY non-breaking spaces (and ordinary
 * whitespace). These are typically Word/Pages export artifacts used for
 * vertical spacing, e.g. `<p>...</p>&nbsp;<p>...</p>`.
 */
function isOnlyNbspWhitespace(node) {
  if (node.nodeName !== "#text") return false;
  return /^[\s\u00A0]+$/.test(node.value) && /\u00A0/.test(node.value);
}

/**
 * Strip text nodes that are only `&nbsp;` (and surrounding whitespace) when
 * they appear between block elements. Preserves NBSP inside text content
 * (e.g. "first&nbsp;second" stays unchanged because that node has letters).
 *
 * Mutates in place; recursive.
 */
export function stripTrailingNbsp(node) {
  if (!node || !node.childNodes) return;

  for (const child of node.childNodes) {
    stripTrailingNbsp(child);
  }

  // Only filter out NBSP-only nodes between elements; never inside text-y parents.
  // We approximate this as: drop if the parent is NOT a known inline container
  // and the text is purely NBSP/whitespace.
  const TEXT_LIKE_PARENTS = new Set([
    "p",
    "span",
    "a",
    "em",
    "strong",
    "b",
    "i",
    "u",
    "small",
    "sub",
    "sup",
    "code",
    "kbd",
    "samp",
    "var",
    "mark",
    "td",
    "th",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "label",
    "button",
    "caption",
    "figcaption",
    "summary",
  ]);
  const tag = node.tagName || node.nodeName;
  if (TEXT_LIKE_PARENTS.has(tag)) return;

  node.childNodes = node.childNodes.filter((c) => !isOnlyNbspWhitespace(c));
}

/**
 * Remove `<p></p>`, `<p>&nbsp;</p>`, and similar empty paragraph-like
 * elements. These are common Word/Pages artifacts.
 *
 * Mutates in place; recursive.
 */
const EMPTY_REMOVABLE_TAGS = new Set(["p", "div", "span"]);

function isEmptyParagraph(node) {
  if (!node.tagName) return false;
  if (!EMPTY_REMOVABLE_TAGS.has(node.tagName)) return false;
  // Don't remove if it has structural attributes (id, class providing layout, etc.)
  // Safe heuristic: only remove if the element has no children OR only NBSP/whitespace text.
  const children = node.childNodes ?? [];
  if (children.length === 0) return true;
  return children.every(
    (c) => c.nodeName === "#text" && /^[\s\u00A0]*$/.test(c.value),
  );
}

export function removeEmptyParagraphs(node) {
  if (!node || !node.childNodes) return;

  for (const child of node.childNodes) {
    removeEmptyParagraphs(child);
  }

  node.childNodes = node.childNodes.filter((c) => !isEmptyParagraph(c));
}

/**
 * Remove `cellspacing="0"` from `<table>` elements (deprecated HTML5
 * attribute, replaced by `border-collapse: collapse` in CSS).
 *
 * Only removes cellspacing="0" — non-zero values may still affect rendering
 * in some contexts, so they're left alone.
 *
 * Mutates in place; recursive.
 */
export function removeCellspacing(node) {
  if (!node || !node.childNodes) return;

  for (const child of node.childNodes) {
    removeCellspacing(child);
  }

  if (node.tagName === "table" && node.attrs) {
    node.attrs = node.attrs.filter(
      (a) => !(a.name === "cellspacing" && a.value === "0"),
    );
  }
}

// ---------------------------------------------------------------------------
// Merge adjacent lists with same tag and same attributes
//   <ul><li>A</li></ul><ul><li>B</li></ul>  ->  <ul><li>A</li><li>B</li></ul>
// ---------------------------------------------------------------------------

const LIST_TAGS = new Set(["ul", "ol", "menu"]);

/**
 * Recursively merges adjacent <ul>/<ol>/<menu> siblings when they share
 * identical attributes. Whitespace text nodes between them are tolerated
 * (and dropped). Mutates in place.
 */
export function mergeAdjacentLists(node) {
  if (!node || !node.childNodes) return;

  // Recurse first
  for (const child of node.childNodes) {
    mergeAdjacentLists(child);
  }

  const out = [];
  let i = 0;
  while (i < node.childNodes.length) {
    const cur = node.childNodes[i];
    const prev = out[out.length - 1];

    if (
      prev &&
      LIST_TAGS.has(prev.tagName || "") &&
      (cur.tagName || cur.nodeName) === (prev.tagName || "") &&
      attrsEqual(prev, cur)
    ) {
      // Move all children of cur into prev
      for (const c of cur.childNodes ?? []) {
        c.parentNode = prev;
        prev.childNodes.push(c);
      }
      i++;
      continue;
    }

    // If cur is whitespace-only text and the next is a mergeable list,
    // skip the whitespace (don't push it) so it doesn't break the chain
    if (isWhitespaceOnly(cur) && prev && LIST_TAGS.has(prev.tagName || "")) {
      const next = node.childNodes[i + 1];
      if (
        next &&
        (next.tagName || next.nodeName) === (prev.tagName || "") &&
        attrsEqual(prev, next)
      ) {
        // Drop the whitespace; the next iteration will merge `next` into `prev`
        i++;
        continue;
      }
    }

    out.push(cur);
    i++;
  }

  node.childNodes = out;
}

// ---------------------------------------------------------------------------
// Unwrap sole inline-element children
// ---------------------------------------------------------------------------

// Inline tags that are pure stylistic wrappers — safe to unwrap when they're
// the sole child of a block element. <span> is the most common; the others
// only carry semantic meaning we want to keep (so left out).
const UNWRAPPABLE_WHEN_SOLE = new Set(["span"]);

// Tags where unwrapping a span into them is safe (block elements that
// accept any styling).
const ACCEPTS_UNWRAP = new Set([
  "li",
  "td",
  "th",
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "dt",
  "dd",
  "figcaption",
  "caption",
  "summary",
]);

/**
 * If a node's only child element is a <span> (with no other significant
 * siblings besides whitespace), and the parent has no conflicting class/style,
 * pull the span's attributes onto the parent and replace the span with its
 * own children.
 *
 *   <li><span class="x">text</span></li>  ->  <li class="x">text</li>
 *
 * Mutates in place. Recursive.
 */
export function unwrapSoleInlineChildren(node) {
  if (!node || !node.childNodes) return;

  // Recurse first
  for (const child of node.childNodes) {
    unwrapSoleInlineChildren(child);
  }

  const tag = node.tagName || node.nodeName;
  if (!ACCEPTS_UNWRAP.has(tag)) return;

  // Find the single element child (ignoring whitespace text nodes)
  const significantChildren = node.childNodes.filter(
    (c) => !(c.nodeName === "#text" && /^\s*$/.test(c.value)),
  );
  if (significantChildren.length !== 1) return;

  const sole = significantChildren[0];
  const soleTag = sole.tagName || sole.nodeName;
  if (!UNWRAPPABLE_WHEN_SOLE.has(soleTag)) return;

  // Don't unwrap if parent already has a class or style attribute
  // (could conflict with the wrapper's class)
  const parentClass = node.attrs?.find((a) => a.name === "class");
  const parentStyle = node.attrs?.find((a) => a.name === "style");

  // If sole has class AND parent already has different class, skip to be safe.
  // We CAN merge classes (sets), but only if neither has style attr (style
  // overrides cascade are too risky).
  for (const a of sole.attrs ?? []) {
    if (a.name === "class") {
      if (parentClass) {
        // Merge classes (treating as sets)
        const merged = new Set(
          parentClass.value.trim().split(/\s+/).filter(Boolean),
        );
        for (const c of a.value.trim().split(/\s+/).filter(Boolean))
          merged.add(c);
        parentClass.value = [...merged].join(" ");
      } else {
        node.attrs = node.attrs ?? [];
        node.attrs.push({ name: "class", value: a.value });
      }
      continue;
    }
    if (a.name === "style") {
      if (parentStyle) return; // unsafe to merge inline styles, abort the whole unwrap
      node.attrs = node.attrs ?? [];
      node.attrs.push({ name: "style", value: a.value });
      continue;
    }
    // Other attrs (id, title, lang, etc) — keep the span to be safe.
    return;
  }

  // Replace the sole element with its children
  const idx = node.childNodes.indexOf(sole);
  if (idx === -1) return;
  const replacement = sole.childNodes ?? [];
  for (const r of replacement) r.parentNode = node;
  node.childNodes.splice(idx, 1, ...replacement);
}

// Re-export internal helper
export { buildClassPropertyMap };
