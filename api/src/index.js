import { Hono } from "hono";
import { processHTML } from "./process";
import { runPipeline } from "./optimizer";
import { validateRequest } from "./validator/request-schema";

//api
const app = new Hono();

app.get("/", (c) => c.text("Maund API is running ✅"));

//main processing endpoint
app.post("/process", async (c) => {
  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const validationError = validateRequest(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const { html, mode, options, pipeline } = body;

  // ✅ Pipeline-based execution
  if (pipeline) {
    const result = await runPipeline(html, pipeline);
    return c.json({
      result: result.html,
      stats: result.stats,
      warnings: result.warnings
    });
  }

  // ✅ Legacy mode-based execution
  const result = await processHTML(html, mode, options);

  if (mode === "optimize" && typeof result === "object") {
    return c.json({
      result: result.html,
      stats: result.stats
    });
  }

  return c.json({
    result,
    stats: {
      before: html.length,
      after: result.length
    }
  });
});

app.post("/preview", async (c) => {
  const { html, mode, options, pipeline } = await c.req.json();

  let output;

  if (pipeline) {
    const result = await runPipeline(html, pipeline);
    output = result.html;
  } else {
    const result = await processHTML(html, mode, options);
    output = typeof result === "object" ? result.html : result;
  }

  return c.html(
    `<html>
      <body style="font-family: system-ui, sans-serif; padding: 16px">
        ${output}
      </body>
    </html>`
  );
});

/**
 * ✅ REQUIRED Cloudflare Workers export
 */
export default {
  fetch: app.fetch
};
