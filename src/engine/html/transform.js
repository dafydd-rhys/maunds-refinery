/**
 * HTML Transformer
 *
 * Uses parse5 for HTML AST only.
 * All CSS transformations use our own engine.
 *
 * Capabilities:
 *   - Optimize inline style= attributes (normalize + merge shorthands)
 *   - Extract inline styles to <style> block (auto-generated class names)
 *   - Remove empty removable attributes
 *   - Optimize <style> block contents
 *   - Clean up redundant whitespace in text nodes
 */

import { parse, serialize, parseFragment } from "parse5";
import {
  transformCss,
  transformInlineStyle,
  parseDeclarations,
  serializeDeclarations,
  optimizeDeclarations,
} from "../css/transform.js";
import {
  mergeAdjacentInlineTags,
  hoistSharedClasses,
  unwrapSoleInlineChildren,
  mergeAdjacentLists,
  stripTrailingNbsp as stripTrailingNbspTransform,
  removeEmptyParagraphs as removeEmptyParagraphsTransform,
  removeCellspacing as removeCellspacingTransform,
  buildClassPropertyMap,
} from "./structural.js";
import { createDescriptiveNameGenerator } from "./classnames.js";

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

const REMOVABLE_EMPTY_ATTRS = new Set(["class", "id", "style", "data-reactid"]);

function getAttr(node, name) {
  return node.attrs?.find((a) => a.name === name)?.value ?? null;
}

function setAttr(node, name, value) {
  const existing = node.attrs?.find((a) => a.name === name);
  if (existing) {
    existing.value = value;
  } else {
    node.attrs = node.attrs || [];
    node.attrs.push({ name, value });
  }
}

function removeAttr(node, name) {
  if (node.attrs) node.attrs = node.attrs.filter((a) => a.name !== name);
}

function hasAttr(node, name) {
  return node.attrs?.some((a) => a.name === name) ?? false;
}

// ---------------------------------------------------------------------------
// Class name generator for inline style extraction
// (See ./classnames.js — produces .text-center, .fs-8pt, .bg-fff style names
// with collision suffixes like .text-center-2)
// ---------------------------------------------------------------------------

// Legacy fallback generator (sequential .r-NNNN names). Kept for backward
// compatibility / opt-out via the `descriptiveNames: false` option.
let classCounter = 0;
function generateLegacyClassName() {
  const id = (classCounter++).toString(36).padStart(4, "0");
  return `r-${id}`;
}
function resetLegacyCounter() {
  classCounter = 0;
}

// ---------------------------------------------------------------------------
// Tree walker
// ---------------------------------------------------------------------------

function walkNodes(node, visitor) {
  visitor(node);
  if (node.childNodes) {
    for (const child of node.childNodes) walkNodes(child, visitor);
  }
  if (node.content) {
    walkNodes(node.content, visitor);
  }
}

// ---------------------------------------------------------------------------
// Find or create <head>
// ---------------------------------------------------------------------------

function findOrCreateHead(document) {
  let head = null;
  walkNodes(document, (node) => {
    if (node.nodeName === "head") head = node;
  });
  if (!head) {
    // Create a minimal head
    head = {
      nodeName: "head",
      tagName: "head",
      attrs: [],
      namespaceURI: "http://www.w3.org/1999/xhtml",
      childNodes: [],
      parentNode: document,
    };
    document.childNodes.unshift(head);
  }
  return head;
}

// ---------------------------------------------------------------------------
// Core optimizer pass
// ---------------------------------------------------------------------------

/**
 * @param {string} html
 * @param {object} options
 * @param {boolean} [options.optimizeInlineStyles=true]   - merge shorthands in style=
 * @param {boolean} [options.optimizeStyleBlocks=true]    - transform <style> contents
 * @param {boolean} [options.removeEmptyAttrs=true]       - drop empty class/id/style
 * @param {boolean} [options.extractInlineStyles=false]   - hoist inline styles to <style>
 * @param {boolean} [options.minifyCss=false]             - minify CSS in style blocks
 * @param {boolean} [options.mergeAdjacentTags=true]      - merge <strong>A</strong><strong>B</strong>
 * @param {boolean} [options.hoistSharedClasses=true]     - lift shared sibling classes to parent
 * @param {boolean} [options.unwrapSoleSpans=true]        - <li><span class=x>A</span></li> → <li class=x>A</li>
 * @param {boolean} [options.mergeAdjacentLists=true]     - merge <ul>+<ul> with same attrs into one
 * @param {boolean} [options.descriptiveNames=true]       - use .mr-text-center vs .mr-c001 hybrid naming
 * @param {string}  [options.classPrefix="mr-"]           - prefix for all generated classes
 *
 * Cleanup options (off by default — opt in for aggressive transforms):
 * @param {boolean} [options.stripTrailingNbsp=false]     - drop &nbsp; between block elements (Word/Pages artifact)
 * @param {boolean} [options.removeEmptyParagraphs=false] - drop <p></p> and <p>&nbsp;</p>
 * @param {boolean} [options.removeCellspacing=false]     - drop cellspacing="0" (deprecated HTML5)
 * @param {boolean} [options.dropConversionArtifacts=true]- strip mso-*, --inside-* etc (already on by default in CSS)
 *
 * @param {boolean} [options.isFragment=false]            - parse as fragment, not full doc
 */
export function transformHtml(html, options = {}) {
  const {
    optimizeInlineStyles = true,
    optimizeStyleBlocks = true,
    removeEmptyAttrs = true,
    extractInlineStyles = false,
    minifyCss = false,
    mergeAdjacentTags = true,
    hoistSharedClasses: doHoist = true,
    unwrapSoleSpans = true,
    mergeAdjacentLists: doMergeLists = true,
    descriptiveNames = true,
    // Cleanup options (off by default)
    stripTrailingNbsp = false,
    removeEmptyParagraphs = false,
    removeCellspacing = false,
    isFragment = false,
  } = options;

  resetLegacyCounter();
  const descriptiveGenerator = descriptiveNames
    ? createDescriptiveNameGenerator({
        prefix: options.classPrefix ?? "mr-",
        descriptive: true,
      })
    : null;
  const generateClassName = (decls) => {
    if (descriptiveGenerator) return descriptiveGenerator(decls);
    return generateLegacyClassName();
  };

  // Parse
  const document = isFragment ? parseFragment(html) : parse(html);

  // Collect extracted styles: Map<className, declarationsMap>
  const extractedStyles = new Map();

  // Pass 1: Walk all element nodes
  walkNodes(document, (node) => {
    if (!node.attrs) return;

    // --- Remove empty removable attributes ---
    if (removeEmptyAttrs) {
      for (const attrName of REMOVABLE_EMPTY_ATTRS) {
        const attr = node.attrs.find((a) => a.name === attrName);
        if (attr && attr.value.trim() === "") {
          removeAttr(node, attrName);
        }
      }
    }

    // --- Optimize <style> block ---
    if (optimizeStyleBlocks && node.nodeName === "style") {
      const textChild = node.childNodes?.find((c) => c.nodeName === "#text");
      if (textChild && textChild.value) {
        try {
          textChild.value = transformCss(textChild.value, {
            minify: minifyCss,
            mergeShorthands: true,
          });
        } catch {
          // leave as-is
        }
      }
      return;
    }

    // --- Inline style optimization / extraction ---
    const styleAttr = node.attrs.find((a) => a.name === "style");
    if (!styleAttr || !styleAttr.value.trim()) return;

    if (extractInlineStyles) {
      // Hoist to <style> block
      const decls = parseDeclarations(styleAttr.value);
      if (decls.size === 0) return;

      const optimized = optimizeDeclarations(decls, {
        mergeIntoShorthands: true,
      });

      // Reuse class if exact same declarations already extracted
      let foundClass = null;
      for (const [cls, existingDecls] of extractedStyles) {
        if (mapsEqual(optimized, existingDecls)) {
          foundClass = cls;
          break;
        }
      }

      const className = foundClass ?? generateClassName(optimized);
      if (!foundClass) extractedStyles.set(className, optimized);

      // Add class to element
      const existingClass = getAttr(node, "class") || "";
      const classes = existingClass.trim().split(/\s+/).filter(Boolean);
      if (!classes.includes(className)) classes.push(className);
      setAttr(node, "class", classes.join(" "));

      // Remove the inline style
      removeAttr(node, "style");
    } else if (optimizeInlineStyles) {
      // Optimize in-place
      try {
        const optimized = transformInlineStyle(styleAttr.value, {
          mergeShorthands: true,
        });
        styleAttr.value = optimized;
      } catch {
        // leave as-is
      }
    }
  });

  // Pass 2: If we extracted styles, inject a <style> block into <head>
  if (extractInlineStyles && extractedStyles.size > 0) {
    const cssLines = [];
    for (const [className, decls] of extractedStyles) {
      const body = serializeDeclarations(decls, { minify: minifyCss });
      if (minifyCss) {
        cssLines.push(`.${className}{${body}}`);
      } else {
        cssLines.push(`.${className} {\n  ${body}\n}`);
      }
    }
    const cssContent = cssLines.join(minifyCss ? "" : "\n");

    const styleNode = {
      nodeName: "style",
      tagName: "style",
      attrs: [],
      namespaceURI: "http://www.w3.org/1999/xhtml",
      childNodes: [
        {
          nodeName: "#text",
          value: cssContent,
          parentNode: null,
        },
      ],
    };
    styleNode.childNodes[0].parentNode = styleNode;

    if (!isFragment) {
      const head = findOrCreateHead(document);
      head.childNodes.push(styleNode);
    } else {
      // For fragments, prepend the style node
      document.childNodes.unshift(styleNode);
    }
  }

  // Pass 3: Merge adjacent same-tag inline siblings
  // (<strong>A</strong><strong>B</strong> -> <strong>AB</strong>)
  if (mergeAdjacentTags) {
    mergeAdjacentInlineTags(document);
  }

  // Pass 3b: Unwrap sole <span> children into their block parents
  // (<li><span class="x">A</span></li> -> <li class="x">A</li>)
  // This MUST run before hoisting so the lifted class can then be hoisted further.
  if (unwrapSoleSpans) {
    unwrapSoleInlineChildren(document);
  }

  // Pass 4: Hoist shared classes from siblings to parent
  // Only hoists classes whose declarations contain only inheritable properties.
  if (doHoist) {
    // Build property maps: from extracted styles AND from existing <style> blocks
    const classProps = buildClassPropertyMap(extractedStyles);

    // Also scan any existing <style> blocks for class definitions so we can
    // hoist pre-existing classes too.
    walkNodes(document, (n) => {
      if (n.nodeName !== "style" || !n.childNodes) return;
      const text = n.childNodes.find((c) => c.nodeName === "#text")?.value;
      if (!text) return;
      // Cheap parse: find ".name { ... }" blocks
      const ruleRe = /\.([\w-]+)\s*\{([^}]*)\}/g;
      let m;
      while ((m = ruleRe.exec(text))) {
        const [, name, body] = m;
        const props = new Set();
        for (const decl of body.split(";")) {
          const colon = decl.indexOf(":");
          if (colon === -1) continue;
          props.add(decl.slice(0, colon).trim().toLowerCase());
        }
        if (!classProps.has(name)) classProps.set(name, props);
      }
    });

    hoistSharedClasses(document, classProps);
  }

  // Pass 5: Merge adjacent <ul>/<ol> with identical attributes.
  // Run AFTER hoisting so hoisted classes can match on adjacent lists.
  if (doMergeLists) {
    mergeAdjacentLists(document);
  }

  // Pass 6: Cleanup transforms (off by default — opt in)
  if (stripTrailingNbsp) {
    stripTrailingNbspTransform(document);
  }
  if (removeEmptyParagraphs) {
    removeEmptyParagraphsTransform(document);
  }
  if (removeCellspacing) {
    removeCellspacingTransform(document);
  }

  return serialize(document);
}

// ---------------------------------------------------------------------------
// Deep equality for declaration Maps
// ---------------------------------------------------------------------------
function mapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (!bv) return false;
    if (bv.value !== v.value || bv.important !== v.important) return false;
  }
  return true;
}
