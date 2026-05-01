export function validateHtml(req, res, next) {
  const { html } = req.body;
  if (html === undefined || html === null) {
    return res
      .status(400)
      .json({ error: { code: "MISSING_HTML", message: "No HTML provided" } });
  }
  if (typeof html !== "string") {
    return res.status(400).json({
      error: { code: "INVALID_HTML", message: "html must be a string" },
    });
  }
  next();
}
