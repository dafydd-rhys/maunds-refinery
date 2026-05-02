import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanRouter,
  prettifyRouter,
  condenseRouter,
  optimizeRouter,
  refineRouter,
} from "./routes/index.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { validateHtml } from "./middleware/validateHtml.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "25mb" }));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization",
    );

    if (req.method === "OPTIONS") return res.sendStatus(204);

    next();
  });

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  app.use("/v1/clean", validateHtml, cleanRouter);
  app.use("/v1/prettify", validateHtml, prettifyRouter);
  app.use("/v1/condense", validateHtml, condenseRouter);

  app.use("/v1/optimize", (req, res, next) => {
    if (req.path === "/css") {
      return optimizeRouter.handle(req, res, next);
    }

    validateHtml(req, res, () => {
      optimizeRouter.handle(req, res, next);
    });
  });

  app.use("/v1/refine", validateHtml, refineRouter);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0",
    });
  });

  const playgroundDir = path.resolve(__dirname, "..", "playground");

  app.use("/playground", express.static(playgroundDir));

  app.get("/", (_req, res) => {
    res.redirect("/playground");
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
      },
    });
  });

  app.use(errorHandler);

  return app;
}

export default createApp;
