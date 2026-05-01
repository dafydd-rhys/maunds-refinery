/**
 * CSS Parser / Serializer
 *
 * Uses css-tree ONLY for tokenization and AST parsing.
 * All transformation logic is our own (normalize.js, shorthands.js).
 */

import * as csstree from "css-tree";
import { normalizeValue, normalizeColor, parseImportant } from "./normalize.js";
import { mergeShorthands } from "./shorthands.js";
import { removeDeadDeclarations } from "./dead-code.js";

// ---------------------------------------------------------------------------
// Parse a CSS declaration block string into an ordered Map
// e.g. "color: red; margin-top: 0px" ->
//   Map { 'color' -> {value:'#f00', important:false}, ... }
// ---------------------------------------------------------------------------
export function parseDeclarations(cssText) {
  const map = new Map();
  if (!cssText || !cssText.trim()) return map;

  // Wrap in a fake rule so css-tree can parse it
  const wrapped = `x{${cssText}}`;
  let ast;
  try {
    ast = csstree.parse(wrapped, { parseValue: false, onParseError: () => {} });
  } catch {
    return map; // unparseable — return empty, caller keeps original
  }

  csstree.walk(ast, (node) => {
    if (node.type === "Declaration") {
      const prop = node.property.toLowerCase().trim();
      const rawValue = csstree.generate(node.value);
      const { value: val, important } = parseImportant(
        rawValue + (node.important ? " !important" : ""),
      );
      const normalized = normalizeValue(prop, val);
      map.set(prop, { value: normalized, important });
    }
  });

  return map;
}

// ---------------------------------------------------------------------------
// Serialize a declarations Map back to a CSS string
// ---------------------------------------------------------------------------
export function serializeDeclarations(map, { minify = false } = {}) {
  const sep = minify ? ";" : ";\n  ";
  const prefix = minify ? "" : "  ";
  const parts = [];

  for (const [prop, { value, important }] of map) {
    const imp = important ? " !important" : "";
    parts.push(`${prefix}${prop}:${minify ? "" : " "}${value}${imp}`);
  }

  if (parts.length === 0) return "";
  return minify ? parts.join(";") : parts.join(";\n  ");
}

// ---------------------------------------------------------------------------
// Parse a full CSS stylesheet string into a structured list of rules
// ---------------------------------------------------------------------------
export function parseStylesheet(css) {
  const rules = [];
  let ast;
  try {
    ast = csstree.parse(css, { parseValue: false, onParseError: () => {} });
  } catch {
    return null;
  }

  csstree.walk(ast, {
    visit: "Rule",
    enter(node) {
      const selector = csstree.generate(node.prelude).trim();
      const declarations = parseDeclarations(
        csstree.generate(node.block).replace(/^{|}$/g, ""),
      );
      rules.push({ type: "rule", selector, declarations });
    },
  });

  csstree.walk(ast, {
    visit: "Atrule",
    enter(node) {
      const name = node.name;
      const prelude = node.prelude ? csstree.generate(node.prelude).trim() : "";

      if (node.block && node.block.type === "Block") {
        const innerRules = [];
        csstree.walk(node.block, {
          visit: "Rule",
          enter(innerNode) {
            const sel = csstree.generate(innerNode.prelude).trim();
            const decls = parseDeclarations(
              csstree.generate(innerNode.block).replace(/^{|}$/g, ""),
            );
            innerRules.push({ selector: sel, declarations: decls });
          },
        });
        rules.push({ type: "atrule", name, prelude, rules: innerRules });
      } else {
        const raw = csstree.generate(node);
        rules.push({ type: "atrule-simple", raw });
      }
    },
  });

  // Handle top-level declarations (not inside a rule) -- comments etc.
  return rules;
}

// ---------------------------------------------------------------------------
// Optimize a declarations Map:
//   1. Remove default/no-op values
//   2. Normalize values
//   3. Merge longhands to shorthands
// ---------------------------------------------------------------------------

const REMOVABLE_DEFAULTS = new Map([
  // These are initial values that have no visual effect when omitted
  // (only safe to remove when we're sure they're not overriding something)
]);

export function optimizeDeclarations(map, options = {}) {
  const { mergeIntoShorthands = true, removeDeadCode = true } = options;

  // Step 1: Normalize all values
  let working = new Map();
  for (const [prop, { value, important }] of map) {
    working.set(prop, { value: normalizeValue(prop, value), important });
  }

  // Step 2: Drop no-op declarations and conversion-tool artifacts
  if (removeDeadCode) {
    working = removeDeadDeclarations(working);
  }

  // Step 3: Merge longhands into shorthands
  if (mergeIntoShorthands) {
    return mergeShorthands(working);
  }
  return working;
}

// ---------------------------------------------------------------------------
// Transform a full CSS string
// ---------------------------------------------------------------------------
export function transformCss(css, options = {}) {
  const { minify = false, mergeShorthands: doMerge = true } = options;

  const rules = parseStylesheet(css);
  if (!rules) return css; // parse failed — return original

  const lines = [];

  for (const rule of rules) {
    if (rule.type === "atrule-simple") {
      lines.push(rule.raw);
      continue;
    }

    if (rule.type === "atrule") {
      const header = `@${rule.name}${rule.prelude ? " " + rule.prelude : ""}`;
      if (minify) {
        const inner = rule.rules
          .map((r) => {
            const opts = optimizeDeclarations(r.declarations, {
              mergeIntoShorthands: doMerge,
            });
            return `${r.selector}{${serializeDeclarations(opts, { minify: true })}}`;
          })
          .join("");
        lines.push(`${header}{${inner}}`);
      } else {
        lines.push(`${header} {`);
        for (const r of rule.rules) {
          const opts = optimizeDeclarations(r.declarations, {
            mergeIntoShorthands: doMerge,
          });
          const body = serializeDeclarations(opts, { minify: false });
          lines.push(`  ${r.selector} {\n    ${body.trim()}\n  }`);
        }
        lines.push("}");
      }
      continue;
    }

    // Regular rule
    const opts = optimizeDeclarations(rule.declarations, {
      mergeIntoShorthands: doMerge,
    });
    const body = serializeDeclarations(opts, { minify });

    if (minify) {
      lines.push(`${rule.selector}{${body}}`);
    } else {
      lines.push(`${rule.selector} {\n  ${body}\n}`);
    }
  }

  return minify ? lines.join("") : lines.join("\n\n");
}

// ---------------------------------------------------------------------------
// Transform an inline style= string
// ---------------------------------------------------------------------------
export function transformInlineStyle(style, options = {}) {
  const map = parseDeclarations(style);
  if (map.size === 0) return style;
  const opts = optimizeDeclarations(map, {
    mergeIntoShorthands: options.mergeShorthands ?? true,
  });
  return serializeDeclarations(opts, { minify: true });
}
