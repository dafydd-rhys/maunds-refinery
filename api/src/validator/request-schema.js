const VALID_MODES = ["prettify", "clean", "minify", "optimize"];
const VALID_PIPELINE_TYPES = ["clean", "html", "css"];
const VALID_PROFILES = ["safe", "smart", "aggressive"];

export function validateRequest(body) {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  const { html, mode, pipeline } = body;

  // html
  if (typeof html !== "string" || !html.trim()) {
    return "`html` must be a non-empty string";
  }

  // mode / pipeline mutual exclusivity
  if (!mode && !pipeline) {
    return "Either `mode` or `pipeline` must be provided";
  }

  if (mode && pipeline) {
    return "Provide either `mode` or `pipeline`, not both";
  }

  // legacy mode validation
  if (mode) {
    if (!VALID_MODES.includes(mode)) {
      return `Invalid mode "${mode}". Allowed: ${VALID_MODES.join(", ")}`;
    }
  }

  // pipeline validation
  if (pipeline) {
    if (!Array.isArray(pipeline)) {
      return "`pipeline` must be an array";
    }

    if (pipeline.length === 0) {
      return "`pipeline` must contain at least one step";
    }

    for (let i = 0; i < pipeline.length; i++) {
      const step = pipeline[i];

      if (!step || typeof step !== "object") {
        return `Pipeline step ${i} must be an object`;
      }

      const { type, profile, options } = step;

      if (!VALID_PIPELINE_TYPES.includes(type)) {
        return `Invalid pipeline type "${type}" at index ${i}`;
      }

      if (profile && !VALID_PROFILES.includes(profile)) {
        return `Invalid profile "${profile}" at index ${i}`;
      }

      if (options && typeof options !== "object") {
        return `Options for pipeline step ${i} must be an object`;
      }
    }
  }

  return null;
}
