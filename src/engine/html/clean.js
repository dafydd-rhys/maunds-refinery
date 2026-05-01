import { parse, serialize, parseFragment } from "parse5";

/**
 * Cleans HTML by round-tripping through parse5 (HTML5 spec parser).
 * Fixes: unclosed tags, bad nesting, missing html/head/body, invalid attributes.
 */
export function cleanHtml(html, { fragment = false } = {}) {
  try {
    const doc = fragment ? parseFragment(html) : parse(html);

    return serialize(doc);
  } catch (err) {
    throw Object.assign(new Error("Input HTML could not be parsed"), {
      code: "INVALID_HTML",
    });
  }
}
