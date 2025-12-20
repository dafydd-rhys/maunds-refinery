import postcss from "postcss";
import mergeLonghand from "postcss-merge-longhand";
import normalizeWhitespace from "postcss-normalize-whitespace";

export class CssOptimizer {
  /**
   * Optimize inline style declarations
   * Example input: "padding-top:10px; padding-left:10px"
   *
   * Options used:
   * - mergeLonghand      (safe/smart/aggressive)
   * - dedupeDuplicates   (smart/aggressive)
   * - removeOverridden   (aggressive)
   */
  async runDeclarations(cssText, options = {}) {
    const warnings = [];

    // 1️⃣ Pre-process declarations at string level (profile-specific)
    const preprocessed = this.preprocessDeclarations(cssText, options);

    // 2️⃣ Wrap in a fake selector so PostCSS can parse it
    const wrapped = `.x{${preprocessed}}`;

    const plugins = [];

    if (options.mergeLonghand !== false) {
      plugins.push(mergeLonghand());
    }

    plugins.push(normalizeWhitespace());

    const result = await postcss(plugins).process(wrapped, {
      from: undefined
    });

    const optimized = result.css.replace(/^\.x\{|\}$/g, "");

    // Aggressive flag: informational for consumers
    if (options.removeOverridden) {
      warnings.push(
        "Aggressive CSS optimization applied: overridden declarations removed in inline style"
      );
    }

    return {
      css: optimized,
      warnings
    };
  }

  /**
   * Optimize full <style> blocks
   * For now this is simpler: we only do structural optimizations,
   * not cross-rule inheritance refactors.
   */
  async runStylesheet(cssText, options = {}) {
    const warnings = [];
    const plugins = [];

    if (options.mergeLonghand !== false) {
      plugins.push(mergeLonghand());
    }

    plugins.push(normalizeWhitespace());

    const result = await postcss(plugins).process(cssText, {
      from: undefined
    });

    if (options.removeOverridden) {
      warnings.push(
        "Aggressive CSS optimization applied to <style> block (overrides may have been simplified)"
      );
    }

    return {
      css: result.css,
      warnings
    };
  }

  /**
   * String-level pre-processing of declarations for smart / aggressive
   *
   * - safe: just returns cssText as-is
   * - smart: remove exact duplicate declarations (same prop + same value)
   * - aggressive: additionally remove declarations that are overridden later
   */
  preprocessDeclarations(cssText, options = {}) {
    const raw = cssText || "";
    const parts = raw
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean);

    const decls = [];

    for (const part of parts) {
      const [propRaw, ...rest] = part.split(":");
      if (!rest.length) continue;

      const prop = propRaw.trim();
      const value = rest.join(":").trim();
      if (!prop || !value) continue;

      decls.push({ prop, value });
    }

    // If no advanced behavior requested, return as-is
    if (!options.dedupeDuplicates && !options.removeOverridden) {
      return decls.map((d) => `${d.prop}:${d.value}`).join(";");
    }

    let processed = decls;

    // 1️⃣ SMART: remove exact duplicate "prop:value" pairs (keep the last one)
    if (options.dedupeDuplicates) {
      const seen = new Set();
      const result = [];

      for (let i = processed.length - 1; i >= 0; i--) {
        const d = processed[i];
        const key = `${d.prop}:${d.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(d);
        }
      }

      processed = result.reverse();
    }

    // 2️⃣ AGGRESSIVE: remove declarations that are overridden later for same prop
    if (options.removeOverridden) {
      const seenProps = new Set();
      const result = [];

      for (let i = processed.length - 1; i >= 0; i--) {
        const d = processed[i];
        if (!seenProps.has(d.prop)) {
          seenProps.add(d.prop);
          result.push(d);
        }
      }

      processed = result.reverse();
    }

    return processed.map((d) => `${d.prop}:${d.value}`).join(";");
  }
}
