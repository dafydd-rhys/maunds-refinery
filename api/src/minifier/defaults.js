export const DEFAULT_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  removeRedundantAttributes: true,
  removeOptionalTags: false, // dangerous if true
  minifyCSS: true,
  minifyJS: false,           // safer default
  keepClosingSlash: true,
};
