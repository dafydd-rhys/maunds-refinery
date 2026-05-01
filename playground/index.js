/* =================================================================
   CONFIG
   ================================================================= */
const API_URL =
  location.protocol === "file:" || !location.host
    ? "http://localhost:3000/v1/refine"
    : `${location.origin}/v1/refine`;

/* =================================================================
   FLAG SCHEMA
   ================================================================= */
const FLAG_SCHEMA = [
  {
    title: "pipeline",
    flags: [
      {
        id: "pipeline",
        type: "tags",
        label: "stages",
        default: ["clean", "optimize", "condense", "prettify"],
        choices: ["clean", "optimize", "condense", "prettify"],
      },
    ],
  },
  {
    title: "optimize",
    flags: [
      {
        id: "extractInlineStyles",
        type: "bool",
        label: "extract.styles",
        default: true,
        cli: "--extract",
        invert: true,
      },
      {
        id: "minifyCss",
        type: "bool",
        label: "minify.css",
        default: true,
      },
      {
        id: "mergeAdjacentTags",
        type: "bool",
        label: "merge.tags",
        default: true,
        cli: "--no-merge-tags",
        invert: true,
      },
      {
        id: "hoistSharedClasses",
        type: "bool",
        label: "hoist.classes",
        default: true,
        cli: "--no-hoist-classes",
        invert: true,
      },
      {
        id: "unwrapSoleSpans",
        type: "bool",
        label: "unwrap.spans",
        default: true,
        cli: "--no-unwrap-spans",
        invert: true,
      },
      {
        id: "mergeAdjacentLists",
        type: "bool",
        label: "merge.lists",
        default: false,
        cli: "--no-merge-lists",
        invert: true,
      },
      {
        id: "descriptiveNames",
        type: "bool",
        label: "descriptive.names",
        default: true,
        cli: "--no-descriptive-names",
        invert: true,
      },
      {
        id: "classPrefix",
        type: "text",
        label: "class.prefix",
        default: "s-",
        cli: "--class-prefix",
      },
    ],
  },
  {
    title: "cleanup",
    flags: [
      {
        id: "stripTrailingNbsp",
        type: "bool",
        label: "strip.nbsp",
        default: false,
        cli: "--strip-nbsp",
      },
      {
        id: "removeEmptyParagraphs",
        type: "bool",
        label: "remove.empty.p",
        default: false,
        cli: "--remove-empty-p",
      },
      {
        id: "removeCellspacing",
        type: "bool",
        label: "remove.cellspacing",
        default: false,
        cli: "--remove-cellspacing",
      },
    ],
  },
  {
    title: "prettify",
    flags: [
      {
        id: "indentSize",
        type: "num",
        label: "indent.size",
        default: 2,
        min: 0,
        max: 8,
        cli: "--indent-size",
      },
      {
        id: "inlineMaxLength",
        type: "num",
        label: "inline.max",
        default: 200,
        min: 0,
        max: 5000,
        cli: "--inline-max",
      },
      {
        id: "inlineLongText",
        type: "bool",
        label: "inline.long.text",
        default: true,
        cli: "--inline-long-text",
      },
      {
        id: "inlineShortContent",
        type: "bool",
        label: "inline.short.content",
        default: true,
        cli: "--no-inline-short",
        invert: true,
      },
      {
        id: "collapseConsecutiveBr",
        type: "bool",
        label: "collapse.br",
        default: true,
        cli: "--no-collapse-br",
        invert: true,
      },
    ],
  },
  {
    title: "condense",
    flags: [
      {
        id: "collapseWhitespace",
        type: "bool",
        label: "collapse.whitespace",
        default: true,
        cli: "--no-collapse-whitespace",
        invert: true,
      },
      {
        id: "removeComments",
        type: "bool",
        label: "remove.comments",
        default: true,
        cli: "--keep-comments",
        invert: true,
      },
      {
        id: "removeRedundantAttributes",
        type: "bool",
        label: "remove.redundant.attrs",
        default: true,
        cli: "--keep-redundant-attrs",
        invert: true,
      },
      {
        id: "collapseBooleanAttributes",
        type: "bool",
        label: "collapse.bool.attrs",
        default: true,
        cli: "--no-collapse-bool-attrs",
        invert: true,
      },
    ],
  },
];

/* =================================================================
   PRESETS
   Each preset is a partial flag override; missing keys keep current value.
   ================================================================= */
const PRESETS = {
  safe: {
    label: "safe",
    note: "minimal transforms",
    flags: {
      pipeline: ["clean", "prettify"],
      extractInlineStyles: false,
      minifyCss: false,
      mergeAdjacentTags: false,
      hoistSharedClasses: false,
      unwrapSoleSpans: false,
      mergeAdjacentLists: false,
      descriptiveNames: true,
      classPrefix: "mr-",
      stripTrailingNbsp: false,
      removeEmptyParagraphs: false,
      removeCellspacing: false,
      indentSize: 2,
      inlineMaxLength: 200,
      inlineLongText: false,
      inlineShortContent: true,
      collapseConsecutiveBr: false,
      collapseWhitespace: false,
      removeComments: false,
      removeRedundantAttributes: false,
      collapseBooleanAttributes: false,
    },
  },

  recommended: {
    label: "recommended",
    note: "balanced defaults",
    flags: {
      pipeline: ["clean", "optimize", "condense", "prettify"],
      extractInlineStyles: true,
      minifyCss: true,
      mergeAdjacentTags: true,
      hoistSharedClasses: true,
      unwrapSoleSpans: true,
      mergeAdjacentLists: false,
      descriptiveNames: true,
      classPrefix: "s-",
      stripTrailingNbsp: false,
      removeEmptyParagraphs: false,
      removeCellspacing: false,
      indentSize: 2,
      inlineMaxLength: 200,
      inlineLongText: true,
      inlineShortContent: true,
      collapseConsecutiveBr: true,
      collapseWhitespace: false,
      removeComments: true,
      removeRedundantAttributes: true,
      collapseBooleanAttributes: true,
    },
  },

  dangerous: {
    label: "dangerous",
    note: "maximum reduction",
    flags: {
      pipeline: ["clean", "optimize", "condense", "prettify"],
      extractInlineStyles: true,
      minifyCss: true,
      mergeAdjacentTags: true,
      hoistSharedClasses: true,
      unwrapSoleSpans: true,
      mergeAdjacentLists: true,
      descriptiveNames: true,
      classPrefix: "mr-",
      stripTrailingNbsp: true,
      removeEmptyParagraphs: true,
      removeCellspacing: true,
      indentSize: 0,
      inlineMaxLength: 5000,
      inlineLongText: true,
      inlineShortContent: true,
      collapseConsecutiveBr: true,
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      collapseBooleanAttributes: true,
    },
  },

  oneLine: {
    label: "one-line",
    note: "single-line html",
    flags: {
      pipeline: ["clean", "optimize", "condense"],
      extractInlineStyles: true,
      minifyCss: true,
      mergeAdjacentTags: true,
      hoistSharedClasses: true,
      unwrapSoleSpans: true,
      mergeAdjacentLists: true,
      descriptiveNames: false,
      classPrefix: "c",
      stripTrailingNbsp: false,
      removeEmptyParagraphs: false,
      removeCellspacing: true,
      indentSize: 0,
      inlineMaxLength: 5000,
      inlineLongText: true,
      inlineShortContent: true,
      collapseConsecutiveBr: true,
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      collapseBooleanAttributes: true,
    },
  },

  readable: {
    label: "readable",
    note: "review-friendly",
    flags: {
      pipeline: ["clean", "optimize", "prettify"],
      extractInlineStyles: true,
      minifyCss: false,
      mergeAdjacentTags: true,
      hoistSharedClasses: true,
      unwrapSoleSpans: true,
      mergeAdjacentLists: true,
      descriptiveNames: true,
      classPrefix: "mr-",
      stripTrailingNbsp: false,
      removeEmptyParagraphs: false,
      removeCellspacing: false,
      indentSize: 2,
      inlineMaxLength: 120,
      inlineLongText: false,
      inlineShortContent: true,
      collapseConsecutiveBr: true,
      collapseWhitespace: false,
      removeComments: false,
      removeRedundantAttributes: false,
      collapseBooleanAttributes: false,
    },
  },

  classDemo: {
    label: "class-demo",
    note: "show extraction",
    flags: {
      pipeline: ["clean", "optimize", "prettify"],
      extractInlineStyles: true,
      minifyCss: false,
      mergeAdjacentTags: false,
      hoistSharedClasses: true,
      unwrapSoleSpans: false,
      mergeAdjacentLists: false,
      descriptiveNames: true,
      classPrefix: "demo-",
      stripTrailingNbsp: false,
      removeEmptyParagraphs: false,
      removeCellspacing: false,
      indentSize: 2,
      inlineMaxLength: 160,
      inlineLongText: false,
      inlineShortContent: true,
      collapseConsecutiveBr: false,
      collapseWhitespace: false,
      removeComments: false,
      removeRedundantAttributes: false,
      collapseBooleanAttributes: false,
    },
  },

  emailSafe: {
    label: "email-safe",
    note: "keep inline styles",
    flags: {
      pipeline: ["clean", "optimize", "prettify"],
      extractInlineStyles: false,
      minifyCss: false,
      mergeAdjacentTags: false,
      hoistSharedClasses: false,
      unwrapSoleSpans: false,
      mergeAdjacentLists: false,
      descriptiveNames: true,
      classPrefix: "mr-",
      stripTrailingNbsp: false,
      removeEmptyParagraphs: false,
      removeCellspacing: false,
      indentSize: 2,
      inlineMaxLength: 200,
      inlineLongText: true,
      inlineShortContent: true,
      collapseConsecutiveBr: false,
      collapseWhitespace: false,
      removeComments: false,
      removeRedundantAttributes: false,
      collapseBooleanAttributes: false,
    },
  },

  wordClean: {
    label: "word-clean",
    note: "doc export cleanup",
    flags: {
      pipeline: ["clean", "optimize", "condense", "prettify"],
      extractInlineStyles: true,
      minifyCss: false,
      mergeAdjacentTags: true,
      hoistSharedClasses: true,
      unwrapSoleSpans: true,
      mergeAdjacentLists: true,
      descriptiveNames: true,
      classPrefix: "doc-",
      stripTrailingNbsp: true,
      removeEmptyParagraphs: true,
      removeCellspacing: true,
      indentSize: 2,
      inlineMaxLength: 180,
      inlineLongText: false,
      inlineShortContent: true,
      collapseConsecutiveBr: true,
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      collapseBooleanAttributes: true,
    },
  },
};

/* =================================================================
   STATE
   ================================================================= */
const state = {
  flags: {},
  lastResult: null,
  lastJson: null,
  lastInputSize: 0,
  lastOutputSize: 0,
  lastInputLines: 0,
  lastOutputLines: 0,
  currentTab: "input",
  activePreset: null,
};

function applySchemaDefaults() {
  for (const section of FLAG_SCHEMA) {
    for (const f of section.flags) {
      state.flags[f.id] = JSON.parse(JSON.stringify(f.default));
    }
  }
}
applySchemaDefaults();

const DEFAULT_HTML_URL = "./test.html";

async function loadDefaultHtml() {
  const inputEl = document.getElementById("inputArea");

  try {
    const resp = await fetch(DEFAULT_HTML_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();
    inputEl.value = html;

    document.getElementById("statIn").textContent =
      `in: ${html.length.toLocaleString()} ch / ${html.split("\n").length} lines`;

    document.getElementById("barBefore").textContent =
      `before · ${html.length.toLocaleString()}`;

    if (state.currentTab === "previewInput") {
      renderInputPreview();
    }
  } catch (err) {
    showError(`could not load ${DEFAULT_HTML_URL}: ${err.message}`);
  }
}

/* =================================================================
   FLAG PAD RENDER
   ================================================================= */
function renderFlagPad() {
  const root = document.getElementById("flagpad");
  // remove any existing flag-section but keep the presets bar
  const existing = root.querySelectorAll(".generated-flag-section");
  existing.forEach((el) => el.remove());

  for (const section of FLAG_SCHEMA) {
    const sec = document.createElement("div");
    sec.className = "flag-section generated-flag-section";

    const title = document.createElement("div");
    title.className = "flag-section-title";
    title.textContent = section.title;
    title.onclick = () => sec.classList.toggle("collapsed");

    const content = document.createElement("div");
    content.className = "flag-section-content";

    for (const f of section.flags) {
      content.appendChild(renderFlag(f));
    }

    sec.appendChild(title);
    sec.appendChild(content);
    root.appendChild(sec);
  }
}

function renderFlag(f) {
  if (f.type === "bool") return renderBoolFlag(f);
  if (f.type === "num") return renderNumFlag(f);
  if (f.type === "text") return renderTextFlag(f);
  if (f.type === "tags") return renderTagsFlag(f);
  return document.createTextNode("");
}

function renderBoolFlag(f) {
  const row = document.createElement("label");
  row.className = "flag";
  row.dataset.flagId = f.id;
  if (state.flags[f.id]) row.classList.add("on");

  const label = document.createElement("span");
  label.className = "flag-label";
  label.textContent = f.label;

  const stateEl = document.createElement("span");
  stateEl.className = "flag-state";
  stateEl.textContent = state.flags[f.id] ? "[ON]" : "[off]";

  row.onclick = () => {
    state.flags[f.id] = !state.flags[f.id];
    row.classList.toggle("on", state.flags[f.id]);
    stateEl.textContent = state.flags[f.id] ? "[ON]" : "[off]";
    onFlagsChanged();
  };

  row.append(label, stateEl);
  return row;
}

function renderNumFlag(f) {
  const row = document.createElement("div");
  row.className = "flag-num";
  row.dataset.flagId = f.id;

  const label = document.createElement("label");
  label.textContent = f.label;

  const input = document.createElement("input");
  input.type = "number";
  input.min = f.min ?? 0;
  if (f.max != null) input.max = f.max;
  input.value = state.flags[f.id];
  input.oninput = () => {
    const v = Number(input.value);
    if (Number.isFinite(v)) {
      state.flags[f.id] = v;
      onFlagsChanged();
    }
  };

  row.append(label, input);
  return row;
}

function renderTextFlag(f) {
  const row = document.createElement("div");
  row.className = "flag-text";
  row.dataset.flagId = f.id;

  const label = document.createElement("label");
  label.textContent = f.label;

  const input = document.createElement("input");
  input.type = "text";
  input.value = state.flags[f.id];
  input.oninput = () => {
    state.flags[f.id] = input.value;
    onFlagsChanged();
  };

  row.append(label, input);
  return row;
}

function renderTagsFlag(f) {
  const row = document.createElement("div");
  row.dataset.flagId = f.id;
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "4px";
  row.style.padding = "4px 0";

  for (const choice of f.choices) {
    const tag = document.createElement("span");
    tag.style.padding = "3px 8px";
    tag.style.fontSize = "10px";
    tag.style.cursor = "pointer";
    tag.style.userSelect = "none";
    tag.style.transition = "all 0.1s";
    tag.style.letterSpacing = "1px";
    const isOn = state.flags[f.id].includes(choice);
    applyTagStyle(tag, isOn);
    tag.textContent = choice;
    tag.onclick = () => {
      const idx = state.flags[f.id].indexOf(choice);
      if (idx === -1) state.flags[f.id].push(choice);
      else state.flags[f.id].splice(idx, 1);
      state.flags[f.id].sort(
        (a, b) => f.choices.indexOf(a) - f.choices.indexOf(b),
      );
      applyTagStyle(tag, state.flags[f.id].includes(choice));
      onFlagsChanged();
    };
    row.appendChild(tag);
  }
  return row;
}

function applyTagStyle(tag, on) {
  if (on) {
    tag.style.background = "var(--surface-2)";
    tag.style.border = "1px solid var(--accent)";
    tag.style.color = "var(--accent)";
  } else {
    tag.style.background = "transparent";
    tag.style.border = "1px dashed var(--dimmer)";
    tag.style.color = "var(--dimmer)";
  }
}

/* =================================================================
   PRESETS
   ================================================================= */
function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;

  // reset all flags to schema defaults first, then apply preset overrides
  applySchemaDefaults();
  for (const [key, val] of Object.entries(preset.flags)) {
    state.flags[key] = JSON.parse(JSON.stringify(val));
  }

  state.activePreset = name;
  renderFlagPad();
  refreshPresetButtons();
  onFlagsChanged();
  toast(`preset: ${preset.label}`);
}

function refreshPresetButtons() {
  for (const btn of document.querySelectorAll(".preset-btn")) {
    btn.classList.toggle("active", btn.dataset.preset === state.activePreset);
  }
}

function resetFlags() {
  applySchemaDefaults();
  state.activePreset = null;
  renderFlagPad();
  refreshPresetButtons();
  onFlagsChanged();
  toast("flags reset to defaults");
}

/* Whenever flags change manually (not via preset), clear active preset */
function onFlagsChanged() {
  // detect if current state still matches the active preset
  if (state.activePreset && !flagsMatchPreset(state.activePreset)) {
    state.activePreset = null;
    refreshPresetButtons();
  }
  updateCli();
}

function flagsMatchPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) return false;
  // a preset is considered "active" if every key it sets matches state
  for (const [key, val] of Object.entries(preset.flags)) {
    if (JSON.stringify(state.flags[key]) !== JSON.stringify(val)) return false;
  }
  return true;
}

function setupStaticFlagSections() {
  for (const section of document.querySelectorAll(".flag-section")) {
    const title = section.querySelector(".flag-section-title");
    if (!title) continue;

    title.onclick = () => section.classList.toggle("collapsed");
  }
}

/* =================================================================
   CLI COMMAND PREVIEW
   ================================================================= */
function buildCliCommand() {
  const parts = ['<span class="cmd">node refine.js test.html</span>'];

  for (const section of FLAG_SCHEMA) {
    for (const f of section.flags) {
      if (!f.cli) continue;
      const v = state.flags[f.id];

      if (f.type === "bool") {
        if (f.invert) {
          if (f.default === true && v === false) {
            parts.push(`<span class="flag">${f.cli}</span>`);
          } else if (f.default === false && v === true) {
            parts.push(`<span class="flag">${f.cli}</span>`);
          }
        } else {
          if (v === true) parts.push(`<span class="flag">${f.cli}</span>`);
        }
      } else if (f.type === "num") {
        if (v !== f.default)
          parts.push(`<span class="flag">${f.cli} ${v}</span>`);
      } else if (f.type === "text") {
        if (v !== f.default)
          parts.push(`<span class="flag">${f.cli} ${v}</span>`);
      }
    }
  }

  const pipe = state.flags.pipeline;
  if (pipe && pipe.join(",") !== "clean,optimize,condense,prettify") {
    parts.push(`<span class="flag">--pipeline ${pipe.join(",")}</span>`);
  }

  return parts.join(" ");
}

function buildCliPlain() {
  const tmp = document.createElement("div");
  tmp.innerHTML = buildCliCommand();
  return tmp.textContent;
}

function updateCli() {
  document.getElementById("cliCmd").innerHTML = buildCliCommand()
    .replace(/^<span class="cmd">/, "")
    .replace(/<\/span>$/, "");
}

/* =================================================================
   PAYLOAD BUILDER
   ================================================================= */
function buildPayload(html) {
  const f = state.flags;
  return {
    html,
    pipeline: f.pipeline,
    options: {
      optimize: {
        optimizeInlineStyles: true,
        optimizeStyleBlocks: true,
        removeEmptyAttrs: true,
        extractInlineStyles: f.extractInlineStyles,
        minifyCss: f.minifyCss,
        mergeAdjacentTags: f.mergeAdjacentTags,
        hoistSharedClasses: f.hoistSharedClasses,
        unwrapSoleSpans: f.unwrapSoleSpans,
        mergeAdjacentLists: f.mergeAdjacentLists,
        descriptiveNames: f.descriptiveNames,
        classPrefix: f.classPrefix,
        stripTrailingNbsp: f.stripTrailingNbsp,
        removeEmptyParagraphs: f.removeEmptyParagraphs,
        removeCellspacing: f.removeCellspacing,
      },
      condense: {
        collapseWhitespace: f.collapseWhitespace,
        removeComments: f.removeComments,
        removeEmptyAttributes: true,
        removeRedundantAttributes: f.removeRedundantAttributes,
        removeOptionalTags: false,
        collapseBooleanAttributes: f.collapseBooleanAttributes,
      },
      prettify: {
        indentSize: f.indentSize,
        indentChar: " ",
        maxPreserveNewlines: 1,
        endWithNewline: true,
        inlineShortContent: f.inlineShortContent,
        inlineMaxLength: f.inlineMaxLength,
        inlineLongText: f.inlineLongText,
        collapseConsecutiveBr: f.collapseConsecutiveBr,
      },
    },
  };
}

/* =================================================================
   API CALL
   ================================================================= */
async function refine() {
  const html = document.getElementById("inputArea").value;
  if (!html.trim()) {
    showError("input is empty. paste some html first.");
    return;
  }

  const btn = document.getElementById("runBtn");
  btn.classList.add("busy");
  btn.disabled = true;
  btn.textContent = "refining...";
  hideError();

  state.lastInputSize = html.length;
  state.lastInputLines = html.split("\n").length;
  const t0 = performance.now();

  try {
    const payload = buildPayload(html);
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    const elapsed = performance.now() - t0;

    if (!resp.ok || json.error) {
      const msg = json.error
        ? `${json.error.code || "ERROR"}: ${json.error.message}`
        : `HTTP ${resp.status}`;
      showError(msg);
      setStatus("err", `last run failed (${elapsed.toFixed(0)}ms)`);
      return;
    }

    state.lastResult = json.result || "";
    state.lastJson = json;
    state.lastOutputSize = state.lastResult.length;
    state.lastOutputLines = state.lastResult
      ? state.lastResult.split("\n").length
      : 0;

    renderOutput();
    updateStats(elapsed);
    setStatus("ok", `last run ok · ${elapsed.toFixed(0)}ms`);
    switchTab("output");
  } catch (err) {
    showError(
      `network error: ${err.message}. is the server running on ${API_URL}?`,
    );
    setStatus("err", "connection failed");
  } finally {
    btn.classList.remove("busy");
    btn.disabled = false;
    btn.textContent = "►► refine ◄◄";
  }
}

/* =================================================================
   OUTPUT RENDER
   ================================================================= */
function renderOutput() {
  const out = state.lastResult || "";
  document.getElementById("outputArea").textContent = out;
  document.getElementById("outputBadge").textContent = out
    ? `${out.split("\n").length}L`
    : "—";

  // populate output preview iframe
  populatePreview("previewOutFrame", out);
  document.getElementById("previewOutEmpty").style.display = out
    ? "none"
    : "flex";
  document.getElementById("previewOutFrame").style.display = out
    ? "block"
    : "none";

  renderClassList(out);

  document.getElementById("jsonArea").textContent = state.lastJson
    ? JSON.stringify(state.lastJson, null, 2)
    : "";
}

/* Use srcdoc so we get a same-origin-ish sandbox without a separate file */
function populatePreview(frameId, html) {
  const frame = document.getElementById(frameId);
  if (!frame) return;
  // srcdoc is the cleanest way; sandbox attribute on the iframe restricts it
  frame.srcdoc = html || "";
}

function renderClassList(html) {
  const root = document.getElementById("cssArea");
  root.innerHTML = "";

  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) {
    root.innerHTML =
      '<div class="empty">// no &lt;style&gt; block in output</div>';
    document.getElementById("cssBadge").textContent = "0";
    return;
  }

  const css = styleMatch[1];
  const ruleRe = /\.([\w-]+)\s*\{([^}]*)\}/g;
  const rules = [];
  let m;
  while ((m = ruleRe.exec(css))) {
    rules.push({ name: m[1], body: m[2].trim() });
  }

  document.getElementById("cssBadge").textContent = rules.length;

  if (rules.length === 0) {
    root.innerHTML = '<div class="empty">// no class rules found</div>';
    return;
  }

  const counts = new Map();
  for (const r of rules) {
    const re = new RegExp(`class="[^"]*\\b${r.name}\\b[^"]*"`, "g");
    const matches = html.match(re);
    counts.set(r.name, matches ? matches.length : 0);
  }

  const heading = document.createElement("h3");
  heading.textContent = `classes (${rules.length})`;
  root.appendChild(heading);

  for (const r of rules) {
    const row = document.createElement("div");
    row.className = "class-row";

    const name = document.createElement("span");
    name.className = "class-name";
    name.textContent = `.${r.name}`;

    const rule = document.createElement("span");
    rule.className = "class-rule";
    rule.textContent = r.body.replace(/;\s*/g, "; ");
    rule.title = r.body;
    rule.style.overflow = "hidden";
    rule.style.textOverflow = "ellipsis";
    rule.style.whiteSpace = "nowrap";

    const count = document.createElement("span");
    count.className = "class-count";
    count.textContent = `×${counts.get(r.name)}`;

    row.append(name, rule, count);
    root.appendChild(row);
  }
}

/* =================================================================
   STATS
   ================================================================= */
function updateStats(elapsedMs) {
  const inSize = state.lastInputSize;
  const outSize = state.lastOutputSize;
  const inLines = state.lastInputLines;
  const outLines = state.lastOutputLines;

  document.getElementById("statIn").textContent =
    `in: ${inSize.toLocaleString()} ch / ${inLines} lines`;
  document.getElementById("statOut").textContent =
    `out: ${outSize.toLocaleString()} ch / ${outLines} lines`;

  const charReduction = inSize > 0 ? ((inSize - outSize) / inSize) * 100 : 0;
  const reductionEl = document.getElementById("statReduction");
  reductionEl.textContent = `char red: ${charReduction >= 0 ? "−" : "+"}${Math.abs(charReduction).toFixed(1)}%`;
  reductionEl.className = charReduction >= 0 ? "ok" : "err";

  const lineReduction =
    inLines > 0 ? ((inLines - outLines) / inLines) * 100 : 0;
  const lineReductionEl = document.getElementById("statLineReduction");
  lineReductionEl.textContent = `line red: ${lineReduction >= 0 ? "−" : "+"}${Math.abs(lineReduction).toFixed(1)}%`;
  lineReductionEl.className = lineReduction >= 0 ? "ok" : "err";

  document.getElementById("statTime").textContent =
    `time: ${elapsedMs.toFixed(0)}ms`;

  // char bar
  const before = document.getElementById("barBefore");
  const after = document.getElementById("barAfter");
  before.textContent = `before · ${inSize.toLocaleString()}`;
  after.textContent = `after · ${outSize.toLocaleString()}`;
  const charPct =
    inSize > 0 ? Math.max(0, Math.min(100, (outSize / inSize) * 100)) : 0;
  after.style.width = charPct + "%";

  // line bar
  const lineBefore = document.getElementById("lineBarBefore");
  const lineAfter = document.getElementById("lineBarAfter");
  lineBefore.textContent = `before · ${inLines.toLocaleString()} lines`;
  lineAfter.textContent = `after · ${outLines.toLocaleString()} lines`;
  const linePct =
    inLines > 0 ? Math.max(0, Math.min(100, (outLines / inLines) * 100)) : 0;
  lineAfter.style.width = linePct + "%";
}

/* =================================================================
   TABS
   ================================================================= */
const TAB_PANES = {
  input: "inputArea",
  "preview-in": "previewInPane",
  output: "outputArea",
  "preview-out": "previewOutPane",
  css: "cssArea",
  json: "jsonArea",
};

function switchTab(tab) {
  state.currentTab = tab;
  for (const el of document.querySelectorAll(".tab")) {
    el.classList.toggle("active", el.dataset.tab === tab);
  }
  for (const [tabName, paneId] of Object.entries(TAB_PANES)) {
    const el = document.getElementById(paneId);
    if (!el) continue;
    el.style.display = tabName === tab ? "" : "none";
  }
  // when switching to preview-in, refresh from current input
  if (tab === "preview-in") {
    populatePreview(
      "previewInFrame",
      document.getElementById("inputArea").value,
    );
  }
}

/* =================================================================
   ACTIONS
   ================================================================= */
function copyOutput() {
  if (!state.lastResult) {
    toast("nothing to copy yet");
    return;
  }
  navigator.clipboard.writeText(state.lastResult);
  toast("copied to clipboard");
}

function copyCli() {
  navigator.clipboard.writeText(buildCliPlain());
  toast("cli copied");
}

function downloadHtml() {
  if (!state.lastResult) {
    toast("run refine first");
    return;
  }
  const blob = new Blob([state.lastResult], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "refined.html";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("downloaded refined.html");
}

/* =================================================================
   UI HELPERS
   ================================================================= */
function showError(msg) {
  const el = document.getElementById("errorBanner");
  el.textContent = "✗ " + msg;
  el.classList.add("show");
}
function hideError() {
  document.getElementById("errorBanner").classList.remove("show");
}

function setStatus(kind, msg) {
  const el = document.getElementById("lastRunStatus");
  el.textContent = msg;
  el.className = kind === "ok" ? "ok" : kind === "err" ? "err" : "";
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* =================================================================
   THEME
   ================================================================= */
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  for (const btn of document.querySelectorAll("[data-theme-set]")) {
    btn.classList.toggle("active", btn.dataset.themeSet === t);
  }
  localStorage.setItem("mr-theme", t);
}

/* =================================================================
   BOOT
   ================================================================= */
function boot() {
  // theme
  const savedTheme = localStorage.getItem("mr-theme") || "vaporwave";
  setTheme(savedTheme);

  for (const btn of document.querySelectorAll("[data-theme-set]")) {
    btn.onclick = () => setTheme(btn.dataset.themeSet);
  }

  // flag pad
  renderFlagPad();
  setupStaticFlagSections();
  updateCli();

  // presets
  for (const btn of document.querySelectorAll(".preset-btn")) {
    btn.onclick = () => applyPreset(btn.dataset.preset);
  }

  // reset
  document.getElementById("resetBtn").onclick = resetFlags;

  // tabs
  for (const el of document.querySelectorAll(".tab")) {
    el.onclick = () => switchTab(el.dataset.tab);
  }

  // run
  document.getElementById("runBtn").onclick = refine;

  // actions
  document.getElementById("copyBtn").onclick = copyOutput;
  document.getElementById("copyCli").onclick = copyCli;
  document.getElementById("downloadBtn").onclick = downloadHtml;

  // input change updates stats only
  const inputEl = document.getElementById("inputArea");
  loadDefaultHtml();
  inputEl.addEventListener("input", () => {
    document.getElementById("statIn").textContent =
      `in: ${inputEl.value.length.toLocaleString()} ch / ${inputEl.value.split("\n").length} lines`;
    document.getElementById("barBefore").textContent =
      `before · ${inputEl.value.length.toLocaleString()}`;
    document.getElementById("lineBarBefore").textContent =
      `before · ${inputEl.value.split("\n").length.toLocaleString()} lines`;
  });

  // initial stats
  document.getElementById("statIn").textContent =
    `in: ${inputEl.value.length.toLocaleString()} ch / ${inputEl.value.split("\n").length} lines`;
  document.getElementById("barBefore").textContent =
    `before · ${inputEl.value.length.toLocaleString()}`;
  document.getElementById("lineBarBefore").textContent =
    `before · ${inputEl.value.split("\n").length.toLocaleString()} lines`;

  // keyboard shortcut
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      refine();
    }
  });
}

boot();
