import { Router } from "express";
import { cleanHtml } from "../engine/html/clean.js";
import {
  prettifyHtml,
  DEFAULT_PRETTIFY_OPTIONS,
} from "../engine/html/prettify.js";
import {
  condenseHtml,
  DEFAULT_CONDENSE_OPTIONS,
} from "../engine/html/condense.js";
import { transformHtml } from "../engine/html/transform.js";
import { transformCss } from "../engine/css/transform.js";

// ---------------------------------------------------------------------------
// /v1/clean
// ---------------------------------------------------------------------------
export const cleanRouter = Router();
cleanRouter.post("/", (req, res) => {
  try {
    res.json({ result: cleanHtml(req.body.html, req.body.options || {}) });
  } catch (err) {
    res.status(422).json({
      error: { code: err.code || "INVALID_HTML", message: err.message },
    });
  }
});

// ---------------------------------------------------------------------------
// /v1/prettify
// ---------------------------------------------------------------------------
export const prettifyRouter = Router();
prettifyRouter.post("/", (req, res) => {
  try {
    const options = req.body.options || {};
    res.json({
      result: prettifyHtml(req.body.html, options),
      options_used: { ...DEFAULT_PRETTIFY_OPTIONS, ...options },
    });
  } catch (err) {
    res
      .status(422)
      .json({ error: { code: "INVALID_HTML", message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// /v1/condense
// ---------------------------------------------------------------------------
export const condenseRouter = Router();
condenseRouter.post("/", (req, res) => {
  try {
    const options = req.body.options || {};
    res.json({
      result: condenseHtml(req.body.html, options),
      options_used: { ...DEFAULT_CONDENSE_OPTIONS, ...options },
    });
  } catch (err) {
    res
      .status(422)
      .json({ error: { code: "INVALID_HTML", message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// /v1/optimize
// Default: optimizes inline styles + style blocks.
// With extractInlineStyles: true -> hoists inline styles to <style> block.
// ---------------------------------------------------------------------------
export const optimizeRouter = Router();

// CSS-only sub-route — no HTML required, bypasses validateHtml middleware
optimizeRouter.post("/css", (req, res) => {
  const { css, options = {} } = req.body || {};
  if (!css || typeof css !== "string") {
    return res.status(400).json({
      error: { code: "MISSING_CSS", message: "No css string provided" },
    });
  }
  try {
    res.json({ result: transformCss(css, options) });
  } catch (err) {
    res
      .status(422)
      .json({ error: { code: "INVALID_CSS", message: err.message } });
  }
});

export const DEFAULT_OPTIMIZE_OPTIONS = {
  optimizeInlineStyles: true,
  optimizeStyleBlocks: true,
  removeEmptyAttrs: true,
  extractInlineStyles: false,
  minifyCss: false,
};

optimizeRouter.post("/", (req, res) => {
  try {
    const options = req.body.options || {};
    const merged = { ...DEFAULT_OPTIMIZE_OPTIONS, ...options };
    res.json({
      result: transformHtml(req.body.html, merged),
      options_used: merged,
    });
  } catch (err) {
    res
      .status(422)
      .json({ error: { code: "INVALID_HTML", message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// /v1/optimize/css  (CSS-only endpoint)
// ---------------------------------------------------------------------------
export const optimizeCssRouter = Router();
optimizeCssRouter.post("/", (req, res) => {
  const { css, options = {} } = req.body || {};
  if (!css || typeof css !== "string") {
    return res.status(400).json({
      error: { code: "MISSING_CSS", message: "No css string provided" },
    });
  }
  try {
    res.json({ result: transformCss(css, options) });
  } catch (err) {
    res
      .status(422)
      .json({ error: { code: "INVALID_CSS", message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// /v1/refine  (master pipeline)
// ---------------------------------------------------------------------------
export const refineRouter = Router();

const VALID_STEPS = ["clean", "prettify", "condense", "optimize"];

const STEP_HANDLERS = {
  clean: (html, opts) => cleanHtml(html, opts),
  prettify: (html, opts) => prettifyHtml(html, opts),
  condense: (html, opts) => condenseHtml(html, opts),
  optimize: (html, opts) =>
    transformHtml(html, { ...DEFAULT_OPTIMIZE_OPTIONS, ...opts }),
};

refineRouter.post("/", async (req, res) => {
  const {
    html,
    pipeline = ["clean", "optimize", "condense"],
    options = {},
  } = req.body;

  const invalidSteps = (Array.isArray(pipeline) ? pipeline : []).filter(
    (s) => !VALID_STEPS.includes(s),
  );
  if (invalidSteps.length > 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_PIPELINE",
        message: `Unknown step(s): ${invalidSteps.join(", ")}. Valid: ${VALID_STEPS.join(", ")}`,
      },
    });
  }

  try {
    let current = html;
    const steps_applied = [];
    for (const step of pipeline) {
      current = STEP_HANDLERS[step](current, options[step] || {});
      steps_applied.push(step);
    }
    res.json({ result: current, steps_applied });
  } catch (err) {
    res.status(422).json({
      error: { code: err.code || "INVALID_HTML", message: err.message },
    });
  }
});
