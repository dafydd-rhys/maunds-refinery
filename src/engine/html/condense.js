/**
 * HTML Condenser (Minifier)
 *
 * Custom implementation — no external libs.
 * Uses parse5 for AST, then custom serializer that:
 *   - Collapses normal whitespace in text nodes without destroying &nbsp;
 *   - Removes comments
 *   - Removes optional closing tags
 *   - Removes boolean attribute values
 *   - Removes redundant attributes (type="text" on inputs, etc.)
 */

import { parse } from "parse5";

export const DEFAULT_CONDENSE_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  removeRedundantAttributes: true,
  removeOptionalTags: false, // conservative default; currently not implemented
  collapseBooleanAttributes: true,
};

// Attributes that are redundant at their default value
const REDUNDANT_ATTRS = new Map([
  ["input:type", "text"],
  ["script:type", "text/javascript"],
  ["style:type", "text/css"],
  ["link:type", "text/css"],
  ["form:method", "get"],
  ["a:target", "_self"],
]);

// Boolean attributes (value="value" or value="" can be just the name)
const BOOLEAN_ATTRS = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "readonly",
  "required",
  "reversed",
  "selected",
  "typemustmatch",
]);

// Whitespace-significant elements
const PRESERVE_WHITESPACE = new Set(["pre", "textarea", "script", "style"]);

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function condenseNode(node, opts) {
  if (node.nodeName === "#comment") {
    return opts.removeComments ? null : node;
  }

  if (node.nodeName === "#text") {
    if (!opts.collapseWhitespace) return node;

    const parent = node.parentNode;
    if (parent && PRESERVE_WHITESPACE.has(parent.nodeName)) return node;

    // Collapse normal HTML whitespace only.
    // Do NOT use /\s+/g because it includes U+00A0 / &nbsp;.
    node.value = collapseNormalWhitespace(node.value);

    // Drop pure normal-whitespace text nodes.
    // Do NOT use .trim() because it treats U+00A0 as whitespace.
    if (!trimNormalWhitespace(node.value)) return null;

    return node;
  }

  // Document/fragment/doctype nodes: just recurse, no attrs/tag work
  if (
    node.nodeName === "#document" ||
    node.nodeName === "#document-fragment" ||
    node.nodeName === "#documentType"
  ) {
    if (node.childNodes) {
      node.childNodes = node.childNodes
        .map((c) => condenseNode(c, opts))
        .filter(Boolean);
    }

    return node;
  }

  if (!node.attrs) return node;

  const tag = node.tagName || node.nodeName;

  // Process attributes
  node.attrs = node.attrs.filter((attr) => {
    // Remove empty removable attributes
    if (opts.removeEmptyAttributes && attr.value === "") {
      // Don't remove boolean attrs; they are valid empty
      if (BOOLEAN_ATTRS.has(attr.name)) return true;
      return false;
    }

    // Remove redundant default attributes
    if (opts.removeRedundantAttributes) {
      const key = `${tag}:${attr.name}`;
      if (REDUNDANT_ATTRS.get(key) === attr.value.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // Collapse boolean attributes: checked="checked" -> checked
  if (opts.collapseBooleanAttributes) {
    for (const attr of node.attrs) {
      if (BOOLEAN_ATTRS.has(attr.name)) {
        attr.value = "";
      }
    }
  }

  // Recurse into children
  if (node.childNodes) {
    node.childNodes = node.childNodes
      .map((c) => condenseNode(c, opts))
      .filter(Boolean);
  }

  // Recurse into template content
  if (node.content) {
    node.content.childNodes = (node.content.childNodes || [])
      .map((c) => condenseNode(c, opts))
      .filter(Boolean);
  }

  return node;
}

// ---------------------------------------------------------------------------
// Custom minified serializer
// - Boolean attrs render as just the name, no =""
// - Void elements render as <br>, not <br />
// - U+00A0 serializes back to &nbsp;
// ---------------------------------------------------------------------------
function serializeMin(node) {
  if (!node) return "";

  if (node.nodeName === "#text") return escapeText(node.value);
  if (node.nodeName === "#comment") return `<!--${node.data}-->`;
  if (node.nodeName === "#documentType") return "<!DOCTYPE html>";

  if (node.nodeName === "#document" || node.nodeName === "#document-fragment") {
    return (node.childNodes || []).map(serializeMin).join("");
  }

  const tag = node.tagName || node.nodeName;

  const attrs = (node.attrs || [])
    .map((attr) => {
      if (BOOLEAN_ATTRS.has(attr.name)) return ` ${attr.name}`;
      if (attr.value === "") return ` ${attr.name}`;

      // Use unquoted value if it contains no special chars
      if (/^[a-zA-Z0-9._-]+$/.test(attr.value)) {
        return ` ${attr.name}=${attr.value}`;
      }

      return ` ${attr.name}="${escapeAttr(attr.value)}"`;
    })
    .join("");

  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrs}>`;
  }

  // <template> uses node.content instead of normal childNodes
  if (tag === "template" && node.content) {
    return `<${tag}${attrs}>${serializeMin(node.content)}</${tag}>`;
  }

  const children = (node.childNodes || []).map(serializeMin).join("");

  return `<${tag}${attrs}>${children}</${tag}>`;
}

function escapeText(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/\u00A0/g, "&nbsp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/\u00A0/g, "&nbsp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function trimNormalWhitespace(str) {
  return str.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, "");
}

function collapseNormalWhitespace(str) {
  return str.replace(/[ \t\r\n\f]+/g, " ");
}

export function condenseHtml(html, options = {}) {
  const opts = { ...DEFAULT_CONDENSE_OPTIONS, ...options };
  const doc = parse(html);

  condenseNode(doc, opts);

  return trimNormalWhitespace(serializeMin(doc));
}
