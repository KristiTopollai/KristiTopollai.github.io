// One object per blog post, newest first.
//
//   slug     folder name under blog/ (the post lives at blog/<slug>/index.html)
//   date     shown as-is, e.g. "2026-09"
//   paper    optional: id from papers.js; that paper gets a "blog" badge linking here
//   links    label → URL, shown after the summary. "read" is the post itself.
//   tail     optional muted text after the links
window.SITE = window.SITE || {};

SITE.posts = [
  {
    slug: "quantization",
    title: "When Small Updates Disappear",
    date: "2026-09",
    paper: "emnlp26",
    summary: "Why low-precision optimizer states ignore small updates, a simple model that predicts how often, a check against seven real models, and an FP32-to-BF16 stochastic-rounding kernel in Triton.",
    links: {
      read: "blog/quantization/",
      code: "https://github.com/KristiTopollai/stochastic-rounding-pytorch",
      paper: "https://arxiv.org/abs/2603.16731"
    },
    tail: "· companion to the EMNLP 2026 paper"
  },
  {
    slug: "adaptive-muon",
    title: "Adaptive Newton–Schulz via Spectral Estimation",
    date: "2026-09",
    paper: "muon",
    summary: "Newton–Schulz can measure the singular-value distribution of its own input: spectral moments from matrices it already forms, a maximum-entropy moment fit, and a Polar Express routine selected for each matrix.",
    links: {
      read: "blog/adaptive-muon/",
      paper: "https://arxiv.org/abs/2609.33047"
    },
    tail: "· companion to a preprint"
  }
];
