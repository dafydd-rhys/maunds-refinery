export const PROFILES = {
  safe: {
    html: {
      optimizeHTML: true,
      optimizeCSS: true,
      optimizeInlineCSS: true
    },
    css: {
      mergeLonghand: true,
      inheritLift: false,
      dedupeInherited: false
    }
  },

  smart: {
    html: {
      optimizeHTML: true,
      optimizeCSS: true,
      optimizeInlineCSS: true
    },
    css: {
      mergeLonghand: true,
      inheritLift: false,
      dedupeInherited: true
    }
  },

  aggressive: {
    html: {
      optimizeHTML: true,
      optimizeCSS: true,
      optimizeInlineCSS: true
    },
    css: {
      mergeLonghand: true,
      inheritLift: true,
      dedupeInherited: true
    }
  }
};
