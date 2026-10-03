// Who you are. Everything in the header comes from here.
window.SITE = window.SITE || {};

SITE.profile = {
  // The mono identity block, one line each. Plain text or small HTML. The first line is the name,
  // shown a little larger with the violet block after it.
  lines: [
    "<b>Kristi Topollai</b>",
    "New York University",
    "Learning Systems Lab",
    "Advised by Anna Choromanska"
  ],
  status: "5th-year PhD candidate",
  note: "",                          // optional line under the status badge
  // Label → URL. Order is display order. A "#" URL is hidden until you fill it in.
  links: {
    "Scholar": "https://scholar.google.com/citations?user=DKhXMoAAAAAJ",
    "GitHub": "https://github.com/KristiTopollai",
    "LinkedIn": "https://www.linkedin.com/in/kristi-topollai-3854aa298"
  },
  email: "kt2664@nyu.edu",
  location: "New York",
  // Typed out on the home tab.
  intro: "I develop efficient and reliable training methods for large models: hyperparameter-robust optimization, low-precision training, scaling laws, and communication-efficient distributed learning.",
  // Home tab cards, in this order. Each id must be a paper in papers.js; a `figure` adds its knob.
  selected: ["emnlp26", "aistats26"],
  latest: ["warmup", "muon"]
};
