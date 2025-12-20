import { parseFragment, serialize } from "parse5";
import { HtmlCleaner } from "../../cleaner/html-cleaner";
import { CssOptimizer } from "./css-optimizer";

export class HtmlOptimizer {
  constructor() {
    this.cleaner = new HtmlCleaner();
    this.cssOptimizer = new CssOptimizer();
  }

  /**
   * PIPELINE ENTRY POINT
   */
  async run(html, options = {}) {
    const stats = {
      inlineStylesOptimized: 0,
      bytesBefore: html.length,
      bytesAfter: 0,
      bytesSaved: 0,
    };

    let workingHTML = html;

    if (options.optimizeHTML !== false) {
      workingHTML = this.cleaner.clean(workingHTML);
    }

    if (options.optimizeCSS === false) {
      stats.bytesAfter = workingHTML.length;
      stats.bytesSaved = stats.bytesBefore - stats.bytesAfter;
      return { html: workingHTML, stats, warnings: [] };
    }

    const fragment = parseFragment(workingHTML);
    const inlineStyleAttrs = [];
    let combinedCSS = "";

    HtmlOptimizer.walk(fragment, (node) => {
      // <style> blocks
      if (node.nodeName === "style" && node.childNodes?.[0]?.value) {
        combinedCSS += node.childNodes[0].value;
        node.childNodes[0].value = "";
      }

      // inline styles
      if (options.optimizeInlineCSS !== false && node.attrs) {
        const styleAttr = node.attrs.find(a => a.name === "style");
        if (styleAttr && styleAttr.value.trim()) {
          inlineStyleAttrs.push(styleAttr);
        }
      }
    });

    // Inline CSS optimization
    for (const styleAttr of inlineStyleAttrs) {
      const result = await this.cssOptimizer.runDeclarations(
        styleAttr.value,
        options
      );

      if (result.css.trim()) {
        styleAttr.value = result.css;
        stats.inlineStylesOptimized++;
      } else {
        styleAttr.name = null;
      }
    }

    // <style> block optimization
    if (combinedCSS.trim()) {
      const cssResult = await this.cssOptimizer.runStylesheet(
        combinedCSS,
        options
      );

      fragment.childNodes.unshift({
        nodeName: "style",
        tagName: "style",
        attrs: [],
        namespaceURI: "http://www.w3.org/1999/xhtml",
        childNodes: [{ nodeName: "#text", value: cssResult.css }]
      });
    }

    const resultHTML = serialize(fragment);

    stats.bytesAfter = resultHTML.length;
    stats.bytesSaved = stats.bytesBefore - stats.bytesAfter;

    return { html: resultHTML, stats, warnings: [] };
  }

  static walk(node, cb) {
    if (!node) return;
    cb(node);
    if (node.childNodes) {
      for (const child of node.childNodes) {
        HtmlOptimizer.walk(child, cb);
      }
    }
  }
}
