import beautify from "js-beautify";
import { DEFAULT_PRETTIFY_OPTIONS } from "./defaults";

export class HtmlPrettifier {
  prettify(html, options = {}) {
    // Only allow known options (security + predictability)
    const safeOptions = this.filterOptions(options);

    return beautify.html(html, {
      ...DEFAULT_PRETTIFY_OPTIONS,
      ...safeOptions,
    });
  }

  filterOptions(options) {
    const allowed = Object.keys(DEFAULT_PRETTIFY_OPTIONS);
    const cleaned = {};

    for (const key of allowed) {
      if (options[key] !== undefined) {
        cleaned[key] = options[key];
      }
    }

    return cleaned;
  }
}
