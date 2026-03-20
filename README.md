# Maunds Refinery API

Maunds Refinery is an API-first HTML refinery that cleans, prettifies, condenses, and optimizes HTML markup.  
It is designed to be **safe by default**, **deterministic**, and suitable for **automated pipelines**, **CMS sanitization**, and **production builds**.

---

## Features

- Clean malformed or inconsistent HTML
- Prettify markup with stable formatting
- Condense (minify) HTML safely
- Optimize HTML and inline / embedded CSS
- Deterministic output for identical inputs
- Individual endpoints for each stage
- Master refinery endpoint for full pipelines
- Zero semantic changes by default

---

## Base URL

```
https://api.maunds-refinery.com/v1
```

---

## Authentication

Authentication is optional depending on deployment.

```http
Authorization: Bearer YOUR_API_KEY
```

---

## Content Type

All requests and responses use:

```
Content-Type: application/json
```

---

## Common Input Schema

All endpoints accept the following request body unless otherwise specified.

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "options": {}
}
```

### Fields

| Field | Type | Required | Description |
|-----|------|----------|-------------|
| `html` | string | ✅ | Raw HTML input |
| `options` | object | ❌ | Endpoint-specific configuration |

---

## Endpoints Overview

| Endpoint | Description |
|--------|-------------|
| `POST /clean` | Normalize and clean HTML |
| `POST /prettify` | Format HTML for readability |
| `POST /condense` | Minify HTML safely |
| `POST /optimize` | Optimize HTML and CSS |
| `POST /refine` | Run full refinery pipeline |

---

## POST /clean

Cleans malformed HTML, fixes unclosed tags, and normalizes document structure.

### Request

```json
{
  "html": "<div><p>Broken"
}
```

### Response

```json
{
  "result": "<div><p>Broken</p></div>"
}
```

---

## POST /prettify

Formats HTML using stable, configurable indentation and line handling.

### Default Prettify Options

```ts
export const DEFAULT_PRETTIFY_OPTIONS = {
  indent_size: 2,
  indent_char: " ",
  max_preserve_newlines: 1,
  preserve_newlines: true,
  wrap_line_length: 0,
  end_with_newline: false,
};
```

### Request

```json
{
  "html": "<div><span>Test</span></div>",
  "options": {
    "indent_size": 4
  }
}
```

---

## POST /condense

Minifies HTML by removing unnecessary characters while preserving behavior.

### Default Minify Options

```ts
export const DEFAULT_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  removeRedundantAttributes: true,
  removeOptionalTags: false,
  minifyCSS: true,
  minifyJS: false,
  keepClosingSlash: true,
};
```

> ⚠ `removeOptionalTags` is disabled by default due to potential breakage.

---

## POST /optimize

Performs structural and CSS optimizations while maintaining semantic equivalence.

### Default Optimizer Options

```ts
export const DEFAULT_OPTIMIZER_OPTIONS = {
  optimizeHTML: true,
  optimizeCSS: true,
  optimizeInlineCSS: true,
  mergeLonghand: true,
};
```

---

## Optimization Rules

### Removable Attributes (Empty Only)

```ts
export const REMOVABLE_ATTRIBUTES = [
  "style",
  "class",
  "id",
  "data-reactid",
];
```

### Safe Self-Closing Tags

```ts
export const SAFE_TAGS = [
  "img",
  "input",
  "br",
  "hr",
  "meta",
  "link"
];
```

---

## POST /refine (Master Pipeline)

Runs multiple refinery stages in a configurable order.

### Request

```json
{
  "html": "<div>   <span>Test</span> </div>",
  "pipeline": ["clean", "optimize", "condense"],
  "options": {
    "condense": {
      "removeComments": true
    }
  }
}
```

### Response

```json
{
  "result": "<div><span>Test</span></div>",
  "steps_applied": ["clean", "optimize", "condense"]
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_HTML",
    "message": "Input HTML could not be parsed"
  }
}
```

### Common Error Codes

| Code | Description |
|-----|-------------|
| `INVALID_HTML` | HTML parsing failed |
| `MISSING_HTML` | No HTML provided |
| `INVALID_PIPELINE` | Unknown pipeline step |
| `RATE_LIMITED` | Too many requests |

---

## Status Codes

| Code | Meaning |
|-----|--------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 422 | Unprocessable entity |
| 500 | Internal server error |

---

## Safety & Guarantees

- No semantic HTML changes
- Deterministic output
- UTF-8 safe
- Framework-aware attribute handling
- Conservative defaults

---

## Use Cases

- CI / build pipelines
- CMS sanitization
- Static site generation
- Email HTML cleanup
- Code formatting tools

---

## Versioning

The API is versioned via URL.

- Current: `/v1`
- Breaking changes will be released under `/v2`

---

## License

MIT

---
