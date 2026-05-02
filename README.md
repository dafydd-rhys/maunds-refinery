# Maunds Refinery

Maunds Refinery is an HTML and CSS refinement engine exposed through an Express API. It cleans malformed HTML, optimizes inline and embedded CSS, extracts repeated inline styles into reusable classes, performs conservative structural simplifications, condenses output for size, and can prettify the final document for readability.

The project is designed for HTML produced by editors, converters, document tools, and manual copy-paste workflows where markup is valid enough to parse but bloated with repeated inline styles, redundant attributes, excessive whitespace, adjacent wrapper tags, repeated lists, and conversion artifacts.

> **Important:** Maunds Refinery is an optimizer and formatter, not a security sanitizer. Do not use its output as proof that user-supplied HTML is safe to render in a privileged context.

---

## Table of Contents

1. [Core Capabilities](#core-capabilities)
2. [Architecture Overview](#architecture-overview)
3. [Repository Structure](#repository-structure)
4. [Request Flow](#request-flow)
5. [API Endpoints](#api-endpoints)
6. [Pipeline System](#pipeline-system)
7. [HTML Engine](#html-engine)
8. [CSS Engine](#css-engine)
9. [Class Name Generation](#class-name-generation)
10. [Configuration Reference](#configuration-reference)
11. [Examples](#examples)
12. [Error Handling](#error-handling)
13. [Safety and Correctness Notes](#safety-and-correctness-notes)
14. [Known Implementation Notes](#known-implementation-notes)
15. [Testing Recommendations](#testing-recommendations)
16. [Development Notes](#development-notes)

---

## Core Capabilities

Maunds Refinery provides several independent but composable transformations:

- **HTML cleaning** through `parse5` round-tripping.
- **HTML prettification** with custom indentation and inline-content handling.
- **HTML condensing** through a custom minified serializer.
- **Inline style optimization** by parsing and normalizing CSS declarations.
- **Style extraction** from repeated inline `style` attributes into generated CSS classes.
- **Embedded `<style>` block optimization**.
- **Structural HTML optimization**, including adjacent inline tag merging, sole-span unwrapping, safe class hoisting, and adjacent list merging.
- **CSS value normalization**, including colors, zero units, decimal values, and quote normalization.
- **CSS shorthand merging** for common longhand groups such as margin, padding, border, font, background, transition, flex, overflow, and grid-template.
- **Dead declaration removal** for provably redundant CSS declarations and common conversion artifacts.

---

## Architecture Overview

At a high level, the system is split into three layers:

```text
HTTP API layer
  └─ Express routers and middleware

HTML engine
  ├─ clean
  ├─ prettify
  ├─ condense
  ├─ transform / optimize
  ├─ structural transforms
  └─ class name generation

CSS engine
  ├─ declaration parsing / serialization
  ├─ value normalization
  ├─ shorthand merging
  └─ dead declaration removal
```

The API layer does not implement transformation logic directly. It validates request shape, merges endpoint defaults with request options, invokes the relevant engine function, and returns either a `result` string or a structured error object.

The HTML engine uses `parse5` for parsing and serialization-compatible ASTs. The project deliberately keeps transformation logic custom and explicit rather than delegating all optimization to a third-party minifier.

The CSS engine uses `css-tree` for CSS parsing/tokenization in the CSS transform module, while normalization, shorthand merging, and dead-code removal are implemented in local modules.

---

## Repository Structure

The uploaded files imply the following project layout:

```text
src/
  routes/
    index.js                 # Express routers for /v1/* endpoints

  middleware/
    validateHtml.js          # Validates req.body.html for HTML endpoints
    errorHandler.js          # Handles invalid JSON and unexpected errors

  engine/
    html/
      clean.js               # parse5 clean / normalize pass
      prettify.js            # custom HTML formatter
      condense.js            # custom HTML minifier / condenser
      transform.js           # HTML optimizer and inline-style extractor
      structural.js          # structural DOM optimizations
      classnames.js          # generated class name strategy

    css/
      transform.js           # CSS parse/serialize/optimize orchestration
      normalize.js           # CSS value normalization
      shorthands.js          # longhand-to-shorthand merging
      dead-code.js           # no-op / artifact declaration removal
```

### Module Summary

| Module                       | Responsibility                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `routes/index.js`            | Defines `/v1/clean`, `/v1/prettify`, `/v1/condense`, `/v1/optimize`, `/v1/optimize/css`, and `/v1/refine` routers. |
| `middleware/validateHtml.js` | Rejects missing or non-string `html` request bodies.                                                               |
| `middleware/errorHandler.js` | Converts invalid JSON and unexpected errors into structured JSON responses.                                        |
| `engine/html/clean.js`       | Parses and serializes HTML through `parse5` to normalize malformed markup.                                         |
| `engine/html/prettify.js`    | Produces readable indented HTML using a custom AST serializer.                                                     |
| `engine/html/condense.js`    | Produces compact HTML using a custom minifying serializer.                                                         |
| `engine/html/transform.js`   | Optimizes HTML, inline styles, style blocks, extracted classes, and structural patterns.                           |
| `engine/html/structural.js`  | Contains DOM-level simplification passes.                                                                          |
| `engine/html/classnames.js`  | Generates descriptive or opaque class names for extracted styles.                                                  |
| `engine/css/transform.js`    | Parses CSS declaration blocks/stylesheets and coordinates CSS optimization.                                        |
| `engine/css/normalize.js`    | Normalizes colors, numbers, zero units, and quoted values.                                                         |
| `engine/css/shorthands.js`   | Merges eligible CSS longhands into shorthand declarations.                                                         |
| `engine/css/dead-code.js`    | Removes provably no-op declarations and common converter artifacts.                                                |

---

## Request Flow

A typical `/v1/refine` request follows this path:

```text
Client request
  ↓
Express route
  ↓
HTML validation middleware, if mounted by the parent app
  ↓
Pipeline validation
  ↓
Step 1: clean / optimize / condense / prettify
  ↓
Step 2: clean / optimize / condense / prettify
  ↓
...
  ↓
JSON response: { result, steps_applied }
```

Each pipeline step receives the output from the previous step. This means ordering is significant. For example:

```text
clean → optimize → condense
```

produces compact optimized output, while:

```text
clean → optimize → condense → prettify
```

produces optimized output that is readable but no longer maximally compact.

---

## API Endpoints

All endpoints expect JSON request bodies and return JSON responses.

### `POST /v1/clean`

Cleans and normalizes HTML by parsing and serializing through `parse5`.

#### Request

```json
{
  "html": "<p><strong>Hello</p>",
  "options": {
    "fragment": false
  }
}
```

#### Response

```json
{
  "result": "<html><head></head><body><p><strong>Hello</strong></p></body></html>"
}
```

#### Options

| Option     |    Type | Default | Description                                           |
| ---------- | ------: | ------: | ----------------------------------------------------- |
| `fragment` | boolean | `false` | Parse as an HTML fragment instead of a full document. |

---

### `POST /v1/prettify`

Formats HTML with indentation and line breaks.

#### Request

```json
{
  "html": "<!DOCTYPE html><html><body><p>Hello <strong>world</strong></p></body></html>",
  "options": {
    "indentSize": 2,
    "inlineShortContent": true,
    "inlineMaxLength": 200,
    "endWithNewline": true
  }
}
```

#### Response

```json
{
  "result": "<!DOCTYPE html>\n<html>\n  <head></head>\n  <body>\n    <p>Hello <strong>world</strong></p>\n  </body>\n</html>\n",
  "options_used": {
    "indentSize": 2,
    "indentChar": " ",
    "maxPreserveNewlines": 1,
    "endWithNewline": true,
    "inlineShortContent": true,
    "inlineMaxLength": 200,
    "inlineLongText": false,
    "collapseConsecutiveBr": true
  }
}
```

---

### `POST /v1/condense`

Minifies HTML using a custom serializer.

#### Request

```json
{
  "html": "<html><body><input type=\"text\" disabled=\"disabled\"></body></html>",
  "options": {
    "collapseWhitespace": true,
    "removeComments": true,
    "collapseBooleanAttributes": true
  }
}
```

#### Response

```json
{
  "result": "<html><head></head><body><input disabled></body></html>",
  "options_used": {
    "collapseWhitespace": true,
    "removeComments": true,
    "removeEmptyAttributes": true,
    "removeRedundantAttributes": true,
    "removeOptionalTags": false,
    "collapseBooleanAttributes": true
  }
}
```

---

### `POST /v1/optimize`

Optimizes HTML without necessarily minifying it. This endpoint handles inline styles, embedded style blocks, generated classes, and structural transformations.

#### Request

```json
{
  "html": "<p style=\"margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;color:red\">Hello</p>",
  "options": {
    "optimizeInlineStyles": true,
    "extractInlineStyles": true,
    "minifyCss": true,
    "mergeAdjacentTags": true,
    "unwrapSoleSpans": true,
    "mergeAdjacentLists": true,
    "descriptiveNames": true,
    "classPrefix": "mr-"
  }
}
```

#### Response

```json
{
  "result": "<html><head><style>.mr-c001{margin:0;color:#f00}</style></head><body><p class=\"mr-c001\">Hello</p></body></html>",
  "options_used": {
    "optimizeInlineStyles": true,
    "optimizeStyleBlocks": true,
    "removeEmptyAttrs": true,
    "extractInlineStyles": true,
    "minifyCss": true
  }
}
```

The exact class name depends on the generated declaration set and class naming options.

---

### `POST /v1/optimize/css`

Optimizes a CSS string directly.

Depending on how the parent Express app mounts routers, this may be available either through the nested `/v1/optimize/css` route or through a separately mounted CSS router.

#### Request

```json
{
  "css": ".box { margin-top: 0px; margin-right: 0px; margin-bottom: 0px; margin-left: 0px; color: red; }",
  "options": {
    "minify": true,
    "mergeShorthands": true
  }
}
```

#### Response

```json
{
  "result": ".box{margin:0;color:#f00}"
}
```

---

### `POST /v1/refine`

Runs a configurable sequence of pipeline steps.

#### Request

```json
{
  "html": "<!DOCTYPE html><html><body><p style=\"color:red\">Hello</p></body></html>",
  "pipeline": ["clean", "optimize", "condense", "prettify"],
  "options": {
    "optimize": {
      "extractInlineStyles": true,
      "minifyCss": true,
      "descriptiveNames": true,
      "classPrefix": "mr-"
    },
    "condense": {
      "collapseWhitespace": true,
      "removeComments": true
    },
    "prettify": {
      "indentSize": 2,
      "endWithNewline": true
    }
  }
}
```

#### Response

```json
{
  "result": "<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>\n",
  "steps_applied": ["clean", "optimize", "condense", "prettify"]
}
```

#### Valid Pipeline Steps

| Step       | Description                                   |
| ---------- | --------------------------------------------- |
| `clean`    | Parse and serialize through `parse5`.         |
| `optimize` | Optimize styles, classes, and HTML structure. |
| `condense` | Minify HTML.                                  |
| `prettify` | Format HTML for readability.                  |

Default route pipeline:

```json
["clean", "optimize", "condense"]
```

---

## Pipeline System

The pipeline system is intentionally simple:

```js
const VALID_STEPS = ["clean", "prettify", "condense", "optimize"];
```

Each step maps to one handler:

```text
clean    → cleanHtml(html, opts)
prettify → prettifyHtml(html, opts)
condense → condenseHtml(html, opts)
optimize → transformHtml(html, { ...DEFAULT_OPTIMIZE_OPTIONS, ...opts })
```

Each step receives its options from:

```json
{
  "options": {
    "stepName": {
      "option": "value"
    }
  }
}
```

For example:

```json
{
  "pipeline": ["clean", "optimize", "prettify"],
  "options": {
    "optimize": {
      "extractInlineStyles": true
    },
    "prettify": {
      "indentSize": 4
    }
  }
}
```

### Recommended Pipeline Patterns

| Goal                        | Pipeline                                                 |
| --------------------------- | -------------------------------------------------------- |
| Normalize only              | `clean`                                                  |
| Readable HTML               | `clean → prettify`                                       |
| Smallest practical HTML     | `clean → optimize → condense`                            |
| Optimized but readable HTML | `clean → optimize → condense → prettify`                 |
| Style extraction preview    | `clean → optimize → prettify`                            |
| Conservative formatting     | `clean → prettify` with structural optimization disabled |

---

## HTML Engine

### Cleaning

`cleanHtml()` is the simplest pass. It uses `parse5` to parse a document or fragment, then serializes it back to HTML.

It is useful for:

- fixing unclosed tags,
- normalizing bad nesting,
- adding missing `html`, `head`, and `body` elements for full documents,
- producing a stable AST-compatible baseline for later passes.

### Prettifying

`prettifyHtml()` parses HTML into a `parse5` tree and serializes it manually with indentation.

Key behaviours:

- text nodes are escaped safely,
- comments are rendered as `<!-- comment -->`,
- void elements are emitted without closing tags,
- `pre`, `script`, `style`, and `textarea` preserve their inner content,
- inline elements are usually kept on one line,
- blocks containing only short inline content can remain on one line,
- consecutive `<br>` tags can be collapsed onto a single line.

Whitespace handling deliberately avoids JavaScript `.trim()` in sensitive areas because `.trim()` treats `U+00A0` non-breaking spaces as ordinary whitespace. The code instead uses helpers that trim only normal HTML whitespace.

### Condensing

`condenseHtml()` performs a minification-style pass over a parsed document.

It can:

- remove comments,
- collapse normal whitespace in text nodes,
- preserve whitespace in `pre`, `textarea`, `script`, and `style`,
- remove empty non-boolean attributes,
- remove redundant default attributes,
- collapse boolean attributes,
- serialize void elements without XHTML-style slashes,
- serialize `U+00A0` as `&nbsp;`.

### HTML Optimization

`transformHtml()` is the main optimization pass. It performs the following broad phases:

1. Parse the input as a full document or fragment.
2. Remove empty removable attributes.
3. Optimize embedded `<style>` blocks.
4. Optimize or extract inline `style` attributes.
5. Inject generated CSS into `<head>` or prepend it to a fragment.
6. Merge adjacent inline tags.
7. Unwrap sole `<span>` children where safe.
8. Hoist shared classes where inheritance rules make it safe.
9. Merge adjacent lists with identical attributes.
10. Run optional cleanup transforms.
11. Serialize through `parse5`.

---

## CSS Engine

The CSS engine is split into focused passes so behaviour is easier to reason about.

### Declaration Parsing and Serialization

The CSS transform layer parses declaration blocks into ordered maps:

```text
Map<property, { value, important }>
```

This allows transformations to preserve declaration order where practical while still making value-level changes.

### Value Normalization

`normalize.js` handles:

- named colors to hex, for example `red` to `#f00`,
- long hex to short hex where possible,
- `rgb()` / `rgba()` normalization,
- color tokens inside compound values such as `border` and `box-shadow`,
- zero unit removal, for example `0px` to `0`,
- decimal simplification, for example `1.50px` to `1.5px`,
- double-quote to single-quote normalization when safe.

### Dead Declaration Removal

`dead-code.js` removes declarations that are provably no-ops, such as:

- `font-style: normal`,
- `font-weight: normal`,
- `text-decoration: none`,
- `letter-spacing: normal`,
- `position: static`,
- `transform: none`,
- `box-shadow: none`.

It also removes common conversion-tool artifacts such as:

- `mso-*`,
- `--inside-h`,
- `--inside-v`,
- `-xv-*`.

Important declarations are preserved even if they appear redundant.

### Shorthand Merging

`shorthands.js` merges supported longhands into shorter declarations where sufficient information is available.

Supported groups include:

- `margin`,
- `padding`,
- `border`,
- `border-radius`,
- `background`,
- `font`,
- `outline`,
- `list-style`,
- `text-decoration`,
- `column-rule`,
- `transition`,
- `animation`,
- `flex`,
- `flex-flow`,
- `overflow`,
- `inset`,
- `place-content`,
- `place-items`,
- `place-self`,
- `grid-template`.

The merger avoids `!important` declarations to reduce cascade risk.

---

## Class Name Generation

When `extractInlineStyles` is enabled, repeated inline style declarations are moved into generated CSS classes.

The generated class naming strategy is handled by `classnames.js`.

### Hybrid Naming Strategy

The generator uses a hybrid strategy:

- single-property declaration sets can receive descriptive names,
- multi-property declaration sets receive opaque sequential names.

Examples:

```text
color: #f00                  → .mr-text-f00
font-size: 8pt               → .mr-fs-8pt
text-align: center           → .mr-text-center
margin: 0; color: #f00       → .mr-c001
```

This avoids misleading names for multi-property rules. For example, a class named `.text-center` should not secretly contain `padding`, `margin`, and `font-size`.

### Collision Handling

If multiple single-property rules produce the same base name, suffixes are added:

```text
.mr-text-center
.mr-text-center-2
.mr-text-center-3
```

### Legacy Naming

When `descriptiveNames` is disabled, the HTML transform falls back to sequential opaque names such as:

```text
.r-0000
.r-0001
.r-0002
```

---

## Configuration Reference

### Optimize Options

| Option                  |    Type | Default | Description                                                                            |
| ----------------------- | ------: | ------: | -------------------------------------------------------------------------------------- |
| `optimizeInlineStyles`  | boolean |  `true` | Optimize inline `style` attributes in place.                                           |
| `optimizeStyleBlocks`   | boolean |  `true` | Optimize CSS inside `<style>` elements.                                                |
| `removeEmptyAttrs`      | boolean |  `true` | Remove empty `class`, `id`, `style`, and `data-reactid` attributes.                    |
| `extractInlineStyles`   | boolean | `false` | Move inline styles into generated classes and inject a `<style>` block.                |
| `minifyCss`             | boolean | `false` | Minify generated and optimized CSS.                                                    |
| `mergeAdjacentTags`     | boolean |  `true` | Merge safe adjacent inline tags.                                                       |
| `hoistSharedClasses`    | boolean |  `true` | Hoist classes shared by all element children when inheritance makes it safe.           |
| `unwrapSoleSpans`       | boolean |  `true` | Replace sole wrapper spans with their contents and move safe attributes to the parent. |
| `mergeAdjacentLists`    | boolean |  `true` | Merge adjacent compatible `ul`, `ol`, or `menu` elements.                              |
| `descriptiveNames`      | boolean |  `true` | Use descriptive names for single-property extracted classes.                           |
| `classPrefix`           |  string | `"mr-"` | Prefix for generated descriptive and opaque class names.                               |
| `stripTrailingNbsp`     | boolean | `false` | Remove standalone `&nbsp;` spacing artifacts outside text-like parents.                |
| `removeEmptyParagraphs` | boolean | `false` | Remove empty `p`, `div`, and `span` nodes with only whitespace or NBSP content.        |
| `removeCellspacing`     | boolean | `false` | Remove `cellspacing="0"` from tables.                                                  |
| `isFragment`            | boolean | `false` | Parse as an HTML fragment instead of a full document.                                  |

### Condense Options

| Option                      |    Type | Default | Description                                           |
| --------------------------- | ------: | ------: | ----------------------------------------------------- |
| `collapseWhitespace`        | boolean |  `true` | Collapse normal whitespace in text nodes.             |
| `removeComments`            | boolean |  `true` | Remove HTML comments.                                 |
| `removeEmptyAttributes`     | boolean |  `true` | Remove empty non-boolean attributes.                  |
| `removeRedundantAttributes` | boolean |  `true` | Remove known redundant default attributes.            |
| `removeOptionalTags`        | boolean | `false` | Declared but not currently implemented.               |
| `collapseBooleanAttributes` | boolean |  `true` | Render boolean attributes as just the attribute name. |

### Prettify Options

| Option                  |    Type | Default | Description                                                              |
| ----------------------- | ------: | ------: | ------------------------------------------------------------------------ |
| `indentSize`            |  number |     `2` | Number of indentation characters per level.                              |
| `indentChar`            |  string |   `" "` | Character used for indentation.                                          |
| `maxPreserveNewlines`   |  number |     `1` | Present in defaults; not currently used by the formatter implementation. |
| `endWithNewline`        | boolean | `false` | Append a final newline to the result.                                    |
| `inlineShortContent`    | boolean |  `true` | Keep blocks with short inline-only content on one line.                  |
| `inlineMaxLength`       |  number |   `200` | Maximum inline-only content length before wrapping.                      |
| `inlineLongText`        | boolean | `false` | Ignore `inlineMaxLength` for inline-only content.                        |
| `collapseConsecutiveBr` | boolean |  `true` | Render consecutive `<br>` elements on one line.                          |

### CSS Options

| Option            |    Type | Default | Description                                                       |
| ----------------- | ------: | ------: | ----------------------------------------------------------------- |
| `minify`          | boolean | `false` | Produce compact CSS output.                                       |
| `mergeShorthands` | boolean |  `true` | Merge eligible longhand declarations into shorthand declarations. |

---

## Examples

### 1. Clean malformed HTML

Request:

```json
{
  "html": "<ul><li>One<li>Two</ul>"
}
```

Possible result:

```html
<html>
  <head></head>
  <body>
    <ul>
      <li>One</li>
      <li>Two</li>
    </ul>
  </body>
</html>
```

### 2. Extract repeated inline styles

Input:

```html
<p style="font-size:16px;color:red">One</p>
<p style="font-size:16px;color:red">Two</p>
```

Request options:

```json
{
  "extractInlineStyles": true,
  "minifyCss": true,
  "classPrefix": "mr-"
}
```

Possible output:

```html
<html>
  <head>
    <style>
      .mr-c001 {
        font-size: 16px;
        color: #f00;
      }
    </style>
  </head>
  <body>
    <p class="mr-c001">One</p>
    <p class="mr-c001">Two</p>
  </body>
</html>
```

### 3. Merge adjacent inline tags

Input:

```html
<p><strong>I</strong><strong> agree</strong><strong>.</strong></p>
```

Possible output after optimization:

```html
<p><strong>I agree.</strong></p>
```

### 4. Merge adjacent lists

Input:

```html
<ul>
  <li>One</li>
</ul>
<ul>
  <li>Two</li>
</ul>
```

Possible output:

```html
<ul>
  <li>One</li>
  <li>Two</li>
</ul>
```

### 5. Condense boolean attributes

Input:

```html
<input type="text" disabled="disabled" checked="checked" />
```

Possible output:

```html
<input disabled checked />
```

---

## Error Handling

The API returns structured error payloads.

### Missing HTML

```json
{
  "error": {
    "code": "MISSING_HTML",
    "message": "No HTML provided"
  }
}
```

### Invalid HTML Body Type

```json
{
  "error": {
    "code": "INVALID_HTML",
    "message": "html must be a string"
  }
}
```

### Invalid Pipeline

```json
{
  "error": {
    "code": "INVALID_PIPELINE",
    "message": "Unknown step(s): example. Valid: clean, prettify, condense, optimize"
  }
}
```

### Invalid JSON

```json
{
  "error": {
    "code": "INVALID_JSON",
    "message": "Request body is not valid JSON"
  }
}
```

### Unexpected Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## Safety and Correctness Notes

### This is not an HTML sanitizer

The engine can preserve scripts, event handler attributes, dangerous URLs, and other executable or unsafe markup. If output is rendered from untrusted users, run it through a dedicated sanitizer appropriate for your threat model.

### `parse5` normalizes full documents

When parsing as a full document, missing `html`, `head`, and `body` elements are inserted. Use fragment mode where you explicitly want a partial snippet.

### `&nbsp;` receives special treatment

Several functions intentionally avoid `.trim()` and broad `\s` replacement because those treat non-breaking spaces as ordinary whitespace. The engine tries to preserve content NBSPs while optionally removing standalone spacing artifacts.

### Structural optimizations are conservative

Class hoisting checks whether a class contains non-inheritable properties before moving it from children to a parent. This avoids layout changes such as moving `padding` or `border` from individual cells to a row.

### CSS parsing failures fall back safely

When CSS parsing fails, the relevant functions generally return the original CSS or style string rather than throwing away potentially meaningful content.

### `!important` declarations are protected

Dead-code removal and shorthand merging avoid destructive handling of `!important` declarations, because changes can alter cascade behaviour.

---

## Known Implementation Notes

These are useful maintenance notes observed from the current source.

### Doctype handling in the prettifier

`parse5` represents `<!DOCTYPE html>` with:

```js
node.nodeName === "#documentType";
```

The prettifier should check `#documentType`, not `#document-type`. If it checks the wrong value, the doctype may be serialized as a fake element:

```html
<#documentType></#documentType>
```

Minimal fix:

```diff
- c.nodeName === "#document-type"
+ c.nodeName === "#documentType"
```

and:

```diff
- child.nodeName !== "#document-type"
+ child.nodeName !== "#documentType"
```

### `removeOptionalTags` is declared but not implemented

`DEFAULT_CONDENSE_OPTIONS` includes `removeOptionalTags`, but the condenser does not currently remove optional closing tags. This is fine as a conservative default, but the README and API consumers should treat it as reserved.

### `maxPreserveNewlines` is declared but not implemented

`DEFAULT_PRETTIFY_OPTIONS` includes `maxPreserveNewlines`, but the formatter does not currently preserve input newlines based on this option.

### Duplicate CSS routes

The route file exposes CSS optimization in two ways:

- `optimizeRouter.post("/css", ...)`
- `optimizeCssRouter.post("/", ...)`

This is acceptable if the parent app intentionally mounts both, but it should be documented in server setup to avoid confusion.

### Imported CSS transform module must exist separately

The HTML transform imports CSS helpers from `../css/transform.js`. Ensure the repository contains that CSS transform module alongside `normalize.js`, `shorthands.js`, and `dead-code.js`.

---

## Testing Recommendations

Use fixtures that cover both visual-preservation and size-reduction scenarios.

### HTML parser and serializer tests

- `<!DOCTYPE html>` remains `<!DOCTYPE html>`.
- Missing `html`, `head`, and `body` are handled consistently.
- Fragment mode does not force full document wrappers.
- Void elements serialize without closing tags.
- Comments are preserved or removed based on options.

### Whitespace tests

- Normal whitespace collapses in regular text nodes.
- `&nbsp;` is preserved inside real text content.
- `pre`, `textarea`, `script`, and `style` contents are not reformatted destructively.
- Standalone NBSP artifacts are removed only when the relevant cleanup option is enabled.

### CSS tests

- `red` becomes `#f00`.
- `rgb(255, 0, 0)` becomes `#f00`.
- `0px` becomes `0`.
- Four margin or padding longhands become one shorthand.
- `!important` declarations are not removed or incorrectly merged.
- Invalid CSS falls back to the original text.

### Inline extraction tests

- Identical style declarations reuse the same generated class.
- Different declarations generate different classes.
- Single-property declarations receive descriptive names where enabled.
- Multi-property declarations receive opaque names.
- Existing classes are preserved when generated classes are added.

### Structural optimization tests

- Adjacent `strong`, `em`, `b`, and `i` siblings merge safely.
- Adjacent `span` elements merge only when attributes match.
- Adjacent lists merge only when tag names and attributes match.
- Sole wrapper spans unwrap into `li`, `td`, `p`, headings, and other accepted parents.
- Shared class hoisting occurs only for inheritable declaration sets.

### API tests

- Missing `html` returns `MISSING_HTML`.
- Non-string `html` returns `INVALID_HTML`.
- Unknown pipeline steps return `INVALID_PIPELINE`.
- Invalid JSON returns `INVALID_JSON`.
- Each endpoint returns `result` on success.

---

## Development Notes

### Suggested dependencies

The uploaded source imports the following runtime dependencies:

```text
express
parse5
css-tree
```

### Suggested server mounting

A typical Express setup would look like this:

```js
import express from "express";
import {
  cleanRouter,
  prettifyRouter,
  condenseRouter,
  optimizeRouter,
  optimizeCssRouter,
  refineRouter,
} from "./routes/index.js";
import { validateHtml } from "./middleware/validateHtml.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(express.json({ limit: "2mb" }));

app.use("/v1/clean", validateHtml, cleanRouter);
app.use("/v1/prettify", validateHtml, prettifyRouter);
app.use("/v1/condense", validateHtml, condenseRouter);
app.use("/v1/optimize", validateHtml, optimizeRouter);
app.use("/v1/optimize-css", optimizeCssRouter);
app.use("/v1/refine", validateHtml, refineRouter);

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Maunds Refinery listening on http://localhost:3000");
});
```

If `/v1/optimize/css` is mounted through `optimizeRouter`, ensure the global `validateHtml` middleware does not block CSS-only requests. One common approach is to mount `/v1/optimize/css` before applying HTML validation to `/v1/optimize`.

### Recommended presets

For a UI or playground, these presets map well to the current engine:

#### Safe

```json
{
  "pipeline": ["clean", "prettify"],
  "options": {
    "optimize": {
      "extractInlineStyles": false,
      "mergeAdjacentTags": false,
      "hoistSharedClasses": false,
      "unwrapSoleSpans": false,
      "mergeAdjacentLists": false
    }
  }
}
```

#### Recommended

```json
{
  "pipeline": ["clean", "optimize", "condense", "prettify"],
  "options": {
    "optimize": {
      "optimizeInlineStyles": true,
      "optimizeStyleBlocks": true,
      "extractInlineStyles": true,
      "minifyCss": true,
      "mergeAdjacentTags": true,
      "hoistSharedClasses": true,
      "unwrapSoleSpans": true,
      "mergeAdjacentLists": true,
      "descriptiveNames": true,
      "classPrefix": "mr-"
    }
  }
}
```

#### Dangerous / Aggressive

```json
{
  "pipeline": ["clean", "optimize", "condense"],
  "options": {
    "optimize": {
      "extractInlineStyles": true,
      "minifyCss": true,
      "stripTrailingNbsp": true,
      "removeEmptyParagraphs": true,
      "removeCellspacing": true
    },
    "condense": {
      "collapseWhitespace": true,
      "removeComments": true,
      "removeEmptyAttributes": true,
      "removeRedundantAttributes": true,
      "collapseBooleanAttributes": true
    }
  }
}
```

### Contribution guidelines

When adding new transforms:

1. Prefer small, isolated passes over large multi-purpose functions.
2. Preserve invalid or unparseable CSS rather than deleting it.
3. Treat `!important` as cascade-sensitive.
4. Avoid whitespace operations that accidentally remove `&nbsp;`.
5. Add fixtures before broadening an optimization.
6. Keep lossy transformations opt-in.
7. Document new options in this README and in endpoint defaults.

---

## Project Summary

Maunds Refinery is best understood as a structured HTML cleanup and optimization pipeline. Its strongest use case is reducing noisy generated markup while retaining readable, inspectable output. The system is modular enough to support conservative formatting, aggressive minification, or a balanced workflow that extracts repeated inline styles into classes and then prettifies the result for review.

##MIT License

Copyright (c) 2026 Dafydd-Rhys

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...
