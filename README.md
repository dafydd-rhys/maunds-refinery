# Maunds Refinery API

An API-first HTML refinery that **cleans**, **prettifies**, **condenses**, and **optimizes** HTML markup with deep CSS intelligence.

The optimizer makes the **exact same visual output** but reduces character count and improves readability. All transformations are lossless — semantic and visual equivalence is guaranteed.

Example Test: returned HTML visually is identical and easier to read
```
Input HTML characters: 88,670
Request JSON bytes: 93,523
Pipeline: clean -> optimize -> condense -> prettify

optimize: 
  optimizeInlineStyles: true,
  optimizeStyleBlocks: true,
  removeEmptyAttrs: true,
  extractInlineStyles: args.extractInlineStyles,
  minifyCss: true,
  mergeAdjacentTags: args.mergeAdjacentTags,
  hoistSharedClasses: args.hoistSharedClasses,
  unwrapSoleSpans: args.unwrapSoleSpans,
      
condense: 
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  removeRedundantAttributes: true,
  removeOptionalTags: false,
  collapseBooleanAttributes: true,

prettify: 
  indentSize: args.indentSize,
  indentChar: " ",
  maxPreserveNewlines: 1,
  endWithNewline: true,
  inlineShortContent: args.inlineShortContent,
  inlineMaxLength: args.inlineMaxLength,
  inlineLongText: args.inlineLongText,
  collapseConsecutiveBr: args.collapseConsecutiveBr,
  
POST http://localhost:3000/v1/refine
Status: 200 OK
Saved response: path/to/X
Saved refined HTML: path/to/Y
Output HTML characters: 78,668
Character reduction: 11.28%
Line reduction: 985 -> 638 (35.23%)
```

## What's different about v2

Built from scratch. No third-party CSS optimizers, no `html-minifier`, no `js-beautify`. Three external libraries are used **only for parsing**:

- `parse5` — HTML5-spec AST parser/serializer
- `css-tree` — CSS tokenizer
- `express` — HTTP server

Everything else — value normalization, shorthand merging, minification, prettification, style extraction — is custom-built and tunable.

---

## Installation

```bash
npm install
npm start             # listens on port 3000 (or PORT env)
```

Health check: `GET /health`

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/clean` | Fix malformed HTML (parse5 round-trip) |
| `POST` | `/v1/prettify` | Indent/format HTML for readability |
| `POST` | `/v1/condense` | Minify HTML (whitespace, comments, redundant attrs, booleans) |
| `POST` | `/v1/optimize` | Apply CSS optimizer to inline styles + `<style>` blocks |
| `POST` | `/v1/optimize/css` | Optimize a raw CSS string (no HTML wrapper) |
| `POST` | `/v1/refine` | Run a configurable multi-stage pipeline |

All endpoints take JSON. HTML endpoints expect `{ "html": "...", "options": {...} }`. The CSS-only endpoint expects `{ "css": "...", "options": {...} }`.

---

## The CSS optimizer — what it actually does

### 1. Value normalization

Every CSS value passes through a normalizer that produces the shortest form with identical meaning:

| Input | Output |
|-------|--------|
| `margin-top: 0px` | `margin-top: 0` |
| `padding-left: 0%` | `padding-left: 0` |
| `opacity: 0.5` | `opacity: .5` |
| `transition-duration: 0.30s` | `transition-duration: .3s` |
| `font-size: 1.50em` | `font-size: 1.5em` |
| `color: rgb(255,0,0)` | `color: #f00` |
| `color: black` | `color: #000` |
| `background: #FFFFFF` | `background: #fff` |
| `box-shadow: 0 0 5px rgb(0,0,0)` | `box-shadow: 0 0 5px #000` |

Color tokens are normalized **even when embedded inside shorthand values** like `border`, `background`, `box-shadow`, and gradient functions.

### 2. Longhand → shorthand merging

When a rule contains a complete set of related longhands, they collapse into the shortest equivalent shorthand:

| Longhands | Shorthand |
|-----------|-----------|
| `margin-top:4px; margin-right:4px; margin-bottom:4px; margin-left:4px` | `margin: 4px` |
| `margin-top:10px; margin-right:20px; margin-bottom:10px; margin-left:20px` | `margin: 10px 20px` |
| All 12 `border-{side}-{prop}` set to same values | `border: 1px solid #f00` |
| `border-top-left-radius`, `top-right`, `bottom-right`, `bottom-left` | `border-radius: 4px 8px` |
| `font-style/variant/weight/size/line-height/family` | `font: italic 700 16px/1.5 Arial` |
| `flex-grow:1; flex-shrink:1; flex-basis:0%` | `flex: 1` |
| `transition-property/duration/timing/delay` | `transition: opacity .3s ease-in-out` |
| `animation-name/duration/timing/iteration-count` | `animation: rotate 1s linear infinite` |
| `background-color/image/repeat/position/size/...` | `background: ...` |
| `outline-width/style/color` | `outline: 2px solid #00f` |
| `text-decoration-line/color/style/thickness` | `text-decoration: ...` |
| `column-rule-width/style/color` | `column-rule: ...` |
| `list-style-type/position/image` | `list-style: ...` |
| `overflow-x:hidden; overflow-y:hidden` | `overflow: hidden` |
| `top/right/bottom/left` | `inset: ...` |
| `align-content + justify-content` (when equal) | `place-content: center` |
| `align-items + justify-items` | `place-items: ...` |
| `align-self + justify-self` | `place-self: ...` |
| `grid-template-rows + grid-template-columns` | `grid-template: rows / cols` |
| `flex-direction + flex-wrap` | `flex-flow: ...` |

The merger refuses to combine when defaults could differ across longhands (e.g., partial `font-*` without `font-size` and `font-family`), and never merges `!important` declarations to avoid cascading issues.

### 3. Empty-attribute cleanup

Empty `class`, `id`, `style`, `data-reactid` are dropped.

### 4. Inline style extraction → `<style>` block

When `extractInlineStyles: true`:

- Every element's `style="..."` is normalized + merged
- Identical declaration sets are **deduplicated** — multiple elements with the same styles share one auto-generated class (`.r-0000`, `.r-0001`, ...)
- The generated CSS is injected into `<head><style>...</style></head>`

**Before:**
```html
<h1 style="margin:0 0 8px;color:#222;font:bold 24px Arial">Title</h1>
<p style="margin:0 0 8px;color:#222;font:14px/1.5 Arial">A</p>
<p style="margin:0 0 8px;color:#222;font:14px/1.5 Arial">B</p>
```

**After (`extractInlineStyles: true, minifyCss: true`):**
```html
<head><style>.r-0000{margin:0 0 8px;color:#222;font:bold 24px Arial}.r-0001{margin:0 0 8px;color:#222;font:14px/1.5 Arial}</style></head>
<h1 class="r-0000">Title</h1>
<p class="r-0001">A</p>
<p class="r-0001">B</p>
```

---

## Endpoint details

### `POST /v1/clean`

```json
{ "html": "<div><p>Broken<span>nested" }
```
→ `<html><head></head><body><div><p>Broken<span>nested</span></p></div></body></html>`

### `POST /v1/prettify`

Options: `indentSize` (default 2), `indentChar` (default `" "`), `endWithNewline` (default false).

### `POST /v1/condense`

```json
{
  "collapseWhitespace": true,
  "removeComments": true,
  "removeEmptyAttributes": true,
  "removeRedundantAttributes": true,
  "removeOptionalTags": false,
  "collapseBooleanAttributes": true
}
```

The custom serializer outputs:
- Boolean attrs as bare names: `<input disabled>` (not `disabled=""`)
- Unquoted simple values: `class=foo` (not `class="foo"`)
- `<!DOCTYPE html>` preserved
- `<pre>`, `<textarea>`, `<script>`, `<style>` content untouched

### `POST /v1/optimize`

```json
{
  "optimizeInlineStyles": true,
  "optimizeStyleBlocks": true,
  "removeEmptyAttrs": true,
  "extractInlineStyles": false,
  "minifyCss": false
}
```

Set `extractInlineStyles: true` to hoist all inline styles into a deduplicated `<style>` block.

### `POST /v1/optimize/css`

Pure CSS in/out:
```json
{ "css": "...", "options": { "minify": true } }
```

### `POST /v1/refine`

Composable pipeline:
```json
{
  "html": "...",
  "pipeline": ["clean", "optimize", "condense"],
  "options": {
    "optimize": { "extractInlineStyles": true, "minifyCss": true },
    "condense": { "removeComments": true }
  }
}
```

Valid steps: `clean`, `prettify`, `condense`, `optimize`. Steps run in array order.

---

## Errors

```json
{ "error": { "code": "MISSING_HTML", "message": "..." } }
```

| Code | Status | Meaning |
|------|--------|---------|
| `MISSING_HTML` | 400 | No `html` field |
| `MISSING_CSS` | 400 | No `css` field |
| `INVALID_HTML` | 422 | Couldn't parse |
| `INVALID_CSS` | 422 | Couldn't parse |
| `INVALID_PIPELINE` | 400 | Unknown step name |
| `INVALID_JSON` | 400 | Malformed body |
| `NOT_FOUND` | 404 | Bad path |
| `INTERNAL_ERROR` | 500 | Unexpected |

---

## Project layout

```
src/
├── index.js                          # express setup
├── middleware/
│   ├── validateHtml.js
│   └── errorHandler.js
├── routes/
│   └── index.js                      # all endpoint handlers
└── engine/
    ├── css/
    │   ├── normalize.js              # values, units, colors, !important
    │   ├── shorthands.js             # 24 longhand→shorthand mergers
    │   └── transform.js              # parse + transform CSS strings
    └── html/
        ├── clean.js                  # parse5 round-trip
        ├── prettify.js               # custom indenter
        ├── condense.js               # custom minifier + serializer
        └── transform.js              # AST walker, style extraction
```

## License

MIT
