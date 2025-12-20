import { minify } from "html-minifier-terser";
import { DEFAULT_MINIFY_OPTIONS } from "./defaults";

export class HtmlMinifier {
  async minify(html, options = {}) {
    const safeOptions = this.filterOptions(options);

    return await minify(html, {
      ...DEFAULT_MINIFY_OPTIONS,
      ...safeOptions,
    });
  }

  filterOptions(options) {
    const allowed = Object.keys(DEFAULT_MINIFY_OPTIONS);
    const cleaned = {};

    for (const key of allowed) {
      if (options[key] !== undefined) {
        cleaned[key] = options[key];
      }
    }

    return cleaned;
  }
}
