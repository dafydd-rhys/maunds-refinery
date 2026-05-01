/**
 * HTML Prettifier
 *
 * Custom indentation formatter. No external libs.
 * Uses parse5 to get a clean AST, then re-serializes with proper indentation.
 */

import { parse, serialize } from "parse5";

// Tags that should not have their content indented (inline elements, void elements)
const INLINE_ELEMENTS = new Set([
  "a",
  "abbr",
  "acronym",
  "b",
  "bdo",
  "big",
  "br",
  "button",
  "cite",
  "code",
  "dfn",
  "em",
  "i",
  "img",
  "input",
  "kbd",
  "label",
  "map",
  "object",
  "output",
  "q",
  "samp",
  "select",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "textarea",
  "time",
  "tt",
  "u",
  "var",
]);

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

// Tags where whitespace is significant; don't reformat content
const PRE_LIKE = new Set(["pre", "script", "style", "textarea"]);

export const DEFAULT_PRETTIFY_OPTIONS = {
  indentSize: 2,
  indentChar: " ",
  maxPreserveNewlines: 1,
  endWithNewline: false,

  // When true, block elements containing only short inline content
  // (text, inline elements, comments) stay on one line:
  //   <p>Hello <em>world</em></p>
  // When false, every child gets its own line.
  inlineShortContent: true,

  // Max character length for content to be kept inline.
  // Only applies when inlineShortContent is true.
  // Longer content wraps to multiple lines.
  // Set to 0 or Infinity to never wrap inline-only content.
  inlineMaxLength: 200,

  // When true, ignore inlineMaxLength entirely for blocks containing only
  // inline content. Useful for keeping long paragraphs on one line.
  inlineLongText: false,

  // Collapse runs of <br> tags onto a single line:
  //   <br><br><br>
  // instead of three separate lines.
  collapseConsecutiveBr: true,
};

function makeIndent(level, { indentSize, indentChar }) {
  return indentChar.repeat(indentSize * level);
}

function serializeAttrs(attrs) {
  if (!attrs || attrs.length === 0) return "";

  return (
    " " +
    attrs
      .map((attr) => {
        if (attr.value === "") return attr.name;
        return `${attr.name}="${escapeAttr(attr.value)}"`;
      })
      .join(" ")
  );
}

function prettifyNode(node, level, opts, out) {
  const indent = makeIndent(level, opts);

  if (node.nodeName === "#text") {
    const text = node.value;

    // Do NOT use .trim(); it treats U+00A0 / &nbsp; as whitespace.
    const trimmed = trimNormalWhitespace(text);

    // Skip ordinary whitespace-only text nodes, but preserve NBSP-only nodes.
    if (!trimmed) return;

    const escaped = escapeText(trimmed);

    // If this text node is only NBSPs, append it to the previous line
    // instead of putting &nbsp; on its own line.
    if (isOnlyNbsp(trimmed) && out.length > 0) {
      out[out.length - 1] += escaped;
      return;
    }

    out.push(`${indent}${escaped}`);
    return;
  }

  if (node.nodeName === "#comment") {
    const comment = trimNormalWhitespace(node.data);
    out.push(`${indent}<!-- ${comment} -->`);
    return;
  }

  if (node.nodeName === "#document" || node.nodeName === "#document-fragment") {
    const doctype = node.childNodes?.find(
      (c) => c.nodeName === "#documentType",
    );

    if (doctype) {
      out.push("<!DOCTYPE html>");
    }

    for (const child of node.childNodes || []) {
      if (child.nodeName !== "#documentType") {
        prettifyNode(child, level, opts, out);
      }
    }

    return;
  }

  const tag = node.tagName || node.nodeName;
  if (!tag) return;

  const attrsStr = serializeAttrs(node.attrs);
  const children = node.childNodes || [];

  // Void elements
  if (VOID_ELEMENTS.has(tag)) {
    out.push(`${indent}<${tag}${attrsStr}>`);
    return;
  }

  // Pre-like elements: preserve content as-is.
  // parse5 serialize should preserve the semantics; normalize NBSP output
  // back to &nbsp; for consistency with this formatter.
  if (PRE_LIKE.has(tag)) {
    const inner = normalizeSerializedHtml(serialize({ childNodes: children }));
    out.push(`${indent}<${tag}${attrsStr}>${inner}</${tag}>`);
    return;
  }

  // Inline elements with simple text content: keep on one line
  if (INLINE_ELEMENTS.has(tag)) {
    const rawInner = children
      .map((child) => {
        if (child.nodeName === "#text") return escapeText(child.value);
        return normalizeSerializedHtml(serialize({ childNodes: [child] }));
      })
      .join("");

    const inner = trimNormalWhitespace(rawInner);

    out.push(`${indent}<${tag}${attrsStr}>${inner}</${tag}>`);
    return;
  }

  // Block elements with no children
  if (children.length === 0) {
    out.push(`${indent}<${tag}${attrsStr}></${tag}>`);
    return;
  }

  // Block elements with only inline content:
  // text + inline elements + comments.
  if (opts.inlineShortContent) {
    const isInlineContent = (child) =>
      child.nodeName === "#text" ||
      child.nodeName === "#comment" ||
      INLINE_ELEMENTS.has(child.tagName || child.nodeName);

    const allInline = children.every(isInlineContent);

    if (allInline) {
      const inner = children
        .map((child) => {
          if (child.nodeName === "#text") {
            return escapeText(child.value);
          }

          if (child.nodeName === "#comment") {
            return `<!-- ${trimNormalWhitespace(child.data)} -->`;
          }

          return normalizeSerializedHtml(serialize({ childNodes: [child] }));
        })
        .join("");

      // Do NOT use /\s+/g or .trim(); both treat U+00A0 as whitespace.
      const collapsed = trimNormalWhitespace(collapseNormalWhitespace(inner));
      const limit = opts.inlineLongText
        ? Infinity
        : (opts.inlineMaxLength ?? 80);

      if (collapsed.length < limit) {
        out.push(`${indent}<${tag}${attrsStr}>${collapsed}</${tag}>`);
        return;
      }
    }
  } else {
    // Without inlineShortContent, still collapse pure-text-only content if short.
    const allText = children.every((child) => child.nodeName === "#text");

    if (allText) {
      const text = trimNormalWhitespace(
        children.map((child) => escapeText(child.value)).join(""),
      );

      if (text.length < (opts.inlineMaxLength ?? 80)) {
        out.push(`${indent}<${tag}${attrsStr}>${text}</${tag}>`);
        return;
      }
    }
  }

  // Block element with mixed/block children: indent
  out.push(`${indent}<${tag}${attrsStr}>`);

  const childIndent = makeIndent(level + 1, opts);

  let i = 0;

  while (i < children.length) {
    const child = children[i];

    // Group consecutive <br> tags onto one line
    if (
      opts.collapseConsecutiveBr &&
      (child.tagName || child.nodeName) === "br"
    ) {
      const brs = [];

      while (
        i < children.length &&
        (children[i].tagName || children[i].nodeName) === "br"
      ) {
        brs.push(children[i]);
        i++;
      }

      if (brs.length > 1) {
        out.push(`${childIndent}${brs.map(() => "<br>").join("")}`);
        continue;
      }

      // Single <br> falls through to normal handling.
      i--;
    }

    prettifyNode(child, level + 1, opts, out);
    i++;
  }

  out.push(`${indent}</${tag}>`);
}

function trimNormalWhitespace(str) {
  return str.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, "");
}

function collapseNormalWhitespace(str) {
  return str.replace(/[ \t\r\n\f]+/g, " ");
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

function normalizeSerializedHtml(str) {
  return str.replace(/\u00A0/g, "&nbsp;");
}

function isOnlyNbsp(str) {
  return /^\u00A0+$/.test(str);
}

export function prettifyHtml(html, options = {}) {
  const opts = { ...DEFAULT_PRETTIFY_OPTIONS, ...options };
  const doc = parse(html);
  const lines = [];

  prettifyNode(doc, 0, opts, lines);

  const result = lines.join("\n");

  return opts.endWithNewline ? result + "\n" : result;
}
