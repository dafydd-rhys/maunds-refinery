
import { HtmlCleaner } from "./cleaner/html-cleaner";
import { HtmlPrettifier } from "./prettifier/html-prettifier";
import { HtmlMinifier } from "./minifier/html-minifier";
import { HtmlOptimizer } from "./optimizer/optimizers/html-optimizer";

const cleaner = new HtmlCleaner();
const prettifier = new HtmlPrettifier();
const minifier = new HtmlMinifier();
const optimizer = new HtmlOptimizer();

export async function processHTML(html, mode, options = {}) {
  switch (mode) {
    case "prettify":
      return prettifier.prettify(html, options);

    case "minify":
      return minifier.minify(html, options);

    case "clean": {
      return cleaner.clean(html);
    }

    case "optimize": {
      const { html: optimized, stats } = await optimizer.optimize(html, options);
      return { result: optimized, stats };
    }
 
    default:
      throw new Error("Invalid mode");
  }
}
