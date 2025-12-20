import { PROFILES } from "./profiles";
import { HtmlOptimizer } from "./optimizers/html-optimizer";
import { HtmlCleaner } from "../cleaner/html-cleaner";

const htmlOptimizer = new HtmlOptimizer();

const OPTIMIZERS = {
  html: htmlOptimizer,
  css: htmlOptimizer,
  clean: new HtmlCleaner()
};

export async function runPipeline(html, pipeline = []) {
  let currentHTML = html;
  const stats = [];
  const warnings = [];

  for (const step of pipeline) {
    const { type, profile = "safe", options = {} } = step;

    const optimizer = OPTIMIZERS[type];
    if (!optimizer) {
      throw new Error(`Unknown optimizer type: ${type}`);
    }

    // ✅ Resolve profile → options
    const profileConfig = PROFILES[profile];
    if (!profileConfig) {
      throw new Error(`Unknown profile: ${profile}`);
    }

    const resolvedOptions = {
      ...(profileConfig[type] ?? {}),
      ...options // allow user overrides
    };

    if (type === "clean") {
      currentHTML = optimizer.clean(currentHTML);
      stats.push({ type: "clean" });
      continue;
    }

    const result = await optimizer.run(currentHTML, resolvedOptions);

    currentHTML = result.html;

    if (result.stats) stats.push({ type, profile, ...result.stats });
    if (result.warnings?.length) warnings.push(...result.warnings);
  }

  return { html: currentHTML, stats, warnings };
}
