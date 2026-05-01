#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const DEFAULT_URL = "http://localhost:3000/v1/refine";

function printUsage() {
  console.log(`
Usage:
  node test.js <html-file> [options]

Examples:
  node test.js large.html
  node test.js "path\\to\\folder\\test.html"
  node test.js large.html --url http://localhost:3000/v1/refine
  node test.js large.html --out refine-response.json --html-out refined.html
  node test.js large.html --pipeline clean,optimize,condense,prettify
  node test.js large.html --inline-max 300
  node test.js large.html --inline-long-text
  node test.js large.html --no-inline-short
  node test.js large.html --no-collapse-br
  node test.js large.html --no-merge-tags
  node test.js large.html --no-hoist-classes
  node test.js large.html --no-unwrap-spans
  node test.js large.html --no-merge-lists
  node test.js large.html --strip-nbsp --remove-empty-p --remove-cellspacing
  node test.js large.html --class-prefix doc-

Options:
  --url <url>             API endpoint. Default: ${DEFAULT_URL}
  --out <file>            Save full JSON/text response. Default: <input-name>.response.json
  --html-out <file>       Save extracted refined HTML if response has result/html/output.
                          Default: <input-name>.refined.html
  --pipeline <steps>      Comma-separated pipeline.
                          Default: clean,optimize,condense,prettify
  --indent-size <n>       Prettify indent size. Default: 2
  --inline-max <n>        Max inline content length for prettify. Default: 200
  --inline-long-text      Bypass inline-max for inline-only content (keeps long
                          paragraphs on one line regardless of length).
  --no-inline-short       Disable prettify.inlineShortContent
  --no-collapse-br        Disable prettify.collapseConsecutiveBr

  --no-merge-tags         Disable optimizer merging of adjacent same-tag inline
                          elements (<strong>A</strong><strong>B</strong> stays split)
  --no-hoist-classes      Disable hoisting of shared sibling classes to parent
                          (e.g. all <td class="x"> -> <tr class="x">)
  --no-unwrap-spans       Disable unwrapping of sole <span> children
                          (<li><span class="x">A</span></li> stays wrapped)
  --no-merge-lists        Disable merging of adjacent <ul>/<ol> with same attrs
  --no-descriptive-names  Use opaque .mr-c001 names for ALL classes
                          (instead of hybrid descriptive .mr-text-center)
  --class-prefix <p>      Set class prefix for generated classes. Default: 'mr-'
  --no-extract            Disable optimize.extractInlineStyles

  --strip-nbsp            Strip &nbsp; between block elements
                          (Word/Pages export artifact). NBSP inside text is preserved.
  --remove-empty-p        Remove <p></p> and <p>&nbsp;</p>
  --remove-cellspacing    Strip cellspacing="0" attribute (HTML5 deprecated)

  --pretty-response       Pretty-print JSON response file
  --help                  Show this help
`);
}

function parseArgs(argv) {
  const args = {
    htmlFile: null,
    url: DEFAULT_URL,
    out: null,
    htmlOut: null,
    pipeline: ["clean", "optimize", "condense", "prettify"],
    extractInlineStyles: true,
    prettyResponse: false,

    // Optimizer options
    mergeAdjacentTags: true,
    hoistSharedClasses: true,
    unwrapSoleSpans: true,
    mergeAdjacentLists: true,
    descriptiveNames: true,
    classPrefix: "doc-",

    // Cleanup options (off by default)
    stripTrailingNbsp: false,
    removeEmptyParagraphs: false,
    removeCellspacing: false,

    // Prettify options
    indentSize: 2,
    inlineShortContent: true,
    inlineMaxLength: 200,
    inlineLongText: true,
    collapseConsecutiveBr: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      return args;
    }

    if (arg === "--url") {
      args.url = argv[++i];
      continue;
    }

    if (arg === "--out") {
      args.out = argv[++i];
      continue;
    }

    if (arg === "--html-out") {
      args.htmlOut = argv[++i];
      continue;
    }

    if (arg === "--pipeline") {
      args.pipeline = String(argv[++i] || "")
        .split(",")
        .map((step) => step.trim())
        .filter(Boolean);
      continue;
    }

    if (arg === "--indent-size") {
      args.indentSize = Number(argv[++i]);
      continue;
    }

    if (arg === "--inline-max") {
      args.inlineMaxLength = Number(argv[++i]);
      continue;
    }

    if (arg === "--inline-long-text") {
      args.inlineLongText = true;
      continue;
    }

    if (arg === "--no-inline-short") {
      args.inlineShortContent = false;
      continue;
    }

    if (arg === "--no-collapse-br") {
      args.collapseConsecutiveBr = false;
      continue;
    }

    if (arg === "--no-merge-tags") {
      args.mergeAdjacentTags = false;
      continue;
    }

    if (arg === "--no-hoist-classes") {
      args.hoistSharedClasses = false;
      continue;
    }

    if (arg === "--no-unwrap-spans") {
      args.unwrapSoleSpans = false;
      continue;
    }

    if (arg === "--no-merge-lists") {
      args.mergeAdjacentLists = false;
      continue;
    }

    if (arg === "--no-descriptive-names") {
      args.descriptiveNames = false;
      continue;
    }

    if (arg === "--class-prefix") {
      args.classPrefix = argv[++i];
      continue;
    }

    if (arg === "--no-extract") {
      args.extractInlineStyles = false;
      continue;
    }

    if (arg === "--strip-nbsp") {
      args.stripTrailingNbsp = true;
      continue;
    }

    if (arg === "--remove-empty-p") {
      args.removeEmptyParagraphs = true;
      continue;
    }

    if (arg === "--remove-cellspacing") {
      args.removeCellspacing = true;
      continue;
    }

    if (arg === "--pretty-response") {
      args.prettyResponse = true;
      continue;
    }

    if (!args.htmlFile) {
      args.htmlFile = arg;
      continue;
    }

    throw new Error(`Unknown extra argument: ${arg}`);
  }

  return args;
}

function defaultOutputName(inputPath, suffix) {
  const name = basename(inputPath, extname(inputPath));
  return `${name}${suffix}`;
}

function buildPayload(html, args) {
  return {
    html,
    pipeline: args.pipeline,
    options: {
      optimize: {
        optimizeInlineStyles: true,
        optimizeStyleBlocks: true,
        removeEmptyAttrs: true,
        extractInlineStyles: args.extractInlineStyles,
        minifyCss: true,
        mergeAdjacentTags: args.mergeAdjacentTags,
        hoistSharedClasses: args.hoistSharedClasses,
        unwrapSoleSpans: args.unwrapSoleSpans,
        mergeAdjacentLists: args.mergeAdjacentLists,
        descriptiveNames: args.descriptiveNames,
        classPrefix: args.classPrefix,
        stripTrailingNbsp: args.stripTrailingNbsp,
        removeEmptyParagraphs: args.removeEmptyParagraphs,
        removeCellspacing: args.removeCellspacing,
      },
      condense: {
        collapseWhitespace: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeOptionalTags: false,
        collapseBooleanAttributes: true,
      },
      prettify: {
        indentSize: args.indentSize,
        indentChar: " ",
        maxPreserveNewlines: 1,
        endWithNewline: true,
        inlineShortContent: args.inlineShortContent,
        inlineMaxLength: args.inlineMaxLength,
        inlineLongText: args.inlineLongText,
        collapseConsecutiveBr: args.collapseConsecutiveBr,
      },
    },
  };
}

function findHtmlResult(responseJson) {
  if (!responseJson || typeof responseJson !== "object") return null;

  if (typeof responseJson.result === "string") return responseJson.result;
  if (typeof responseJson.html === "string") return responseJson.html;
  if (typeof responseJson.output === "string") return responseJson.output;

  if (typeof responseJson.data?.result === "string") {
    return responseJson.data.result;
  }

  if (typeof responseJson.data?.html === "string") {
    return responseJson.data.html;
  }

  if (typeof responseJson.data?.output === "string") {
    return responseJson.data.output;
  }

  return null;
}

function validateArgs(args) {
  if (!args.htmlFile) {
    throw new Error("Missing HTML file path.");
  }

  if (!Number.isFinite(args.indentSize) || args.indentSize < 0) {
    throw new Error(
      "--indent-size must be a number greater than or equal to 0.",
    );
  }

  if (!Number.isFinite(args.inlineMaxLength) || args.inlineMaxLength < 0) {
    throw new Error(
      "--inline-max must be a number greater than or equal to 0.",
    );
  }

  const validSteps = new Set(["clean", "optimize", "condense", "prettify"]);
  const invalidSteps = args.pipeline.filter((step) => !validSteps.has(step));

  if (invalidSteps.length > 0) {
    throw new Error(`Invalid pipeline step(s): ${invalidSteps.join(", ")}`);
  }

  if (args.pipeline.length === 0) {
    throw new Error("Pipeline cannot be empty.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  validateArgs(args);

  const htmlPath = resolve(args.htmlFile);
  const outPath = resolve(
    args.out || defaultOutputName(htmlPath, ".response.json"),
  );
  const htmlOutPath = resolve(
    args.htmlOut || defaultOutputName(htmlPath, ".refined.html"),
  );

  console.log(`Reading HTML: ${htmlPath}`);

  const html = await readFile(htmlPath, "utf8");
  const payload = buildPayload(html, args);
  const body = JSON.stringify(payload);

  console.log(`Input HTML characters: ${html.length.toLocaleString()}`);
  console.log(
    `Request JSON bytes: ${Buffer.byteLength(body).toLocaleString()}`,
  );
  console.log(`Pipeline: ${args.pipeline.join(" -> ")}`);
  console.log("Optimizer:");
  console.log(`  extractInlineStyles:    ${args.extractInlineStyles}`);
  console.log(`  mergeAdjacentTags:      ${args.mergeAdjacentTags}`);
  console.log(`  hoistSharedClasses:     ${args.hoistSharedClasses}`);
  console.log(`  unwrapSoleSpans:        ${args.unwrapSoleSpans}`);
  console.log(`  mergeAdjacentLists:     ${args.mergeAdjacentLists}`);
  console.log(`  descriptiveNames:       ${args.descriptiveNames}`);
  console.log(`  classPrefix:            "${args.classPrefix}"`);
  console.log("Cleanup:");
  console.log(`  stripTrailingNbsp:      ${args.stripTrailingNbsp}`);
  console.log(`  removeEmptyParagraphs:  ${args.removeEmptyParagraphs}`);
  console.log(`  removeCellspacing:      ${args.removeCellspacing}`);
  console.log("Prettify:");
  console.log(`  inlineShortContent:     ${args.inlineShortContent}`);
  console.log(`  inlineMaxLength:        ${args.inlineMaxLength}`);
  console.log(`  inlineLongText:         ${args.inlineLongText}`);
  console.log(`  collapseConsecutiveBr:  ${args.collapseConsecutiveBr}`);
  console.log(`POST ${args.url}`);

  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
    },
    body,
  });

  const responseText = await response.text();

  let responseJson = null;

  try {
    responseJson = JSON.parse(responseText);
  } catch {
    // Non-JSON responses are still saved below.
  }

  const responseToWrite =
    responseJson && args.prettyResponse
      ? `${JSON.stringify(responseJson, null, 2)}\n`
      : responseText;

  await writeFile(outPath, responseToWrite, "utf8");

  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Saved response: ${outPath}`);

  if (!response.ok) {
    if (response.status === 413) {
      console.error(
        "Request body was too large. Increase express.json({ limit: '25mb' }) in your server setup.",
      );
    }

    if (responseJson?.error) {
      console.error(
        `API error: ${responseJson.error.code || "UNKNOWN"} - ${
          responseJson.error.message || "No message"
        }`,
      );
    } else {
      console.error(responseText.slice(0, 1000));
    }

    process.exit(1);
  }

  const refinedHtml = findHtmlResult(responseJson);

  if (refinedHtml) {
    await writeFile(htmlOutPath, refinedHtml, "utf8");

    console.log(`Saved refined HTML: ${htmlOutPath}`);
    console.log(
      `Output HTML characters: ${refinedHtml.length.toLocaleString()}`,
    );

    if (html.length > 0) {
      const reduction =
        ((html.length - refinedHtml.length) / html.length) * 100;
      console.log(`Character reduction: ${reduction.toFixed(2)}%`);
    }

    const inLines = html.split("\n").length;
    const outLines = refinedHtml.split("\n").length;
    if (inLines > 0) {
      const lineReduction = ((inLines - outLines) / inLines) * 100;
      console.log(
        `Line reduction: ${inLines} -> ${outLines} (${lineReduction.toFixed(2)}%)`,
      );
    }
  } else {
    console.log(
      "No result/html/output string found in response, so no refined HTML file was written.",
    );
  }
}

main().catch((error) => {
  console.error("Test request failed:");
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
