// One object per paper. Newest first is not required; the page sorts by year.
//
//   id       short unique key, used by posts.js (paper: "...") and profile.js (selected)
//   status   "accepted" | "review" | "workshop" | "thesis"; "review" shows as "preprint", with no venue
//   conf     the conference shown next to the year in the papers tab, e.g. "ICML"
//   detail   optional line under the title, e.g. "HiLD workshop" or "main conference"
//   note     optional extra label appended to the detail, e.g. "oral"
//   venue    full venue shown on the home-page cards, e.g. "AISTATS 2026"
//   links    label → URL; label is shown as-is. Common: paper, arxiv, code, preprint, slides, talk
//            a "#" URL is hidden until you fill it in
//   figure   optional: name of an interactive figure registered in figures/*.js
//   blurb    optional: one or two sentences shown on the home-page card
//   bibtex   optional: the BibTeX entry between backticks, shown by a "bibtex" button. Paste it from
//            Google Scholar or arXiv; write any backslash as \\ (e.g. {\\"o} for ö)
window.SITE = window.SITE || {};

SITE.papers = [
  {
    id: "warmup",
    title: "Balancing Early Performance Sacrifices with Long-Term Gains: Scaling Learning-Rate Warmup Duration Across Training Horizons",
    authors: ["K. Topollai", "A. Choromanska"],
    year: 2026,
    status: "review",
    links: { arxiv: "https://arxiv.org/abs/2609.33041" },
    bibtex: `@article{topollai2026balancing,
  title   = {Balancing Early Performance Sacrifices with Long-Term Gains: Scaling Learning-Rate Warmup Duration Across Training Horizons},
  author  = {Topollai, Kristi and Choromanska, Anna},
  journal = {arXiv preprint arXiv:2609.33041},
  year    = {2026}
}`,
    figure: "warmup",
    blurb: "Everyone warms up the learning rate, and almost everyone picks the length by habit. The right warmup is not a constant: it grows with how long you train and how hard you push the peak rate. It gets its own scaling law, which predicts it for long runs from a few short ones."
  },
  {
    id: "muon",
    title: "Cost-free Spectral Estimation for Adaptive Newton–Schulz in Matrix Optimizers",
    authors: ["K. Topollai", "A. Choromanska"],
    year: 2026,
    status: "review",
    links: { arxiv: "https://arxiv.org/abs/2609.33047" },
    bibtex: `@article{topollai2026costfree,
  title   = {Cost-free Spectral Estimation for Adaptive {Newton--Schulz} in Matrix Optimizers},
  author  = {Topollai, Kristi and Choromanska, Anna},
  journal = {arXiv preprint arXiv:2609.33047},
  year    = {2026}
}`,
    figure: "polar",
    blurb: "Muon sends every layer through the same fixed orthogonalization recipe. The recipe's own intermediate products already reveal each matrix's spectrum, so it can tailor itself to every layer, every few steps, at no extra cost."
  },
  {
    id: "emnlp26",
    title: "Understanding Quantization of Optimizer States in LLM Pre-training: Dynamics of State Staleness and Effectiveness of State Resets",
    authors: ["K. Topollai", "A. Choromanska"],
    venue: "EMNLP 2026",
    conf: "EMNLP",
    detail: "main conference",
    year: 2026,
    status: "accepted",
    links: { arxiv: "https://arxiv.org/abs/2603.16731" },
    bibtex: `@inproceedings{topollai2026understanding,
  title     = {Understanding Quantization of Optimizer States in {LLM} Pre-training: Dynamics of State Staleness and Effectiveness of State Resets},
  author    = {Topollai, Kristi and Choromanska, Anna},
  booktitle = {Proceedings of the 2026 Conference on Empirical Methods in Natural Language Processing},
  year      = {2026}
}`,
    figure: "quant",
    blurb: "Low-precision optimizer states save memory, but small updates get rounded away and the state quietly freezes. A simple model predicts when it happens and how often, and explains why well-timed resets bring the state back to life."
  },
  {
    id: "aistats26",
    title: "Adaptive Memory Momentum via a Model-Based Framework for Deep Learning Optimization",
    authors: ["K. Topollai", "A. Choromanska"],
    venue: "AISTATS 2026",
    conf: "AISTATS",
    year: 2026,
    status: "accepted",
    links: { paper: "#", arxiv: "https://arxiv.org/abs/2510.04988", talk: "#" },
    bibtex: `@inproceedings{topollai2026adaptive,
  title     = {Adaptive Memory Momentum via a Model-Based Framework for Deep Learning Optimization},
  author    = {Topollai, Kristi and Choromanska, Anna},
  booktitle = {Proceedings of the 29th International Conference on Artificial Intelligence and Statistics},
  year      = {2026}
}`,
    figure: "momentum",
    blurb: "Momentum is set to 0.9 and never touched again. Adaptive memory lets the optimizer decide how much of its past to trust at every step, from a simple two-plane model of the loss, with nothing extra to tune."
  },
  {
    id: "hild-restart",
    title: "Outer-Momentum Restarting in High-Dimensional Two-Phase Optimization",
    authors: ["K. Topollai", "A. Ma", "T. Dimlioglu", "S. J. Tay", "A. Choromanska"],
    venue: "ICML 2026 HiLD workshop",
    conf: "ICML",
    detail: "HiLD workshop",
    year: 2026,
    status: "workshop",
    links: { arxiv: "https://arxiv.org/abs/2605.28585" },
    bibtex: `@inproceedings{topollai2026outer,
  title     = {Outer-Momentum Restarting in High-Dimensional Two-Phase Optimization},
  author    = {Topollai, Kristi and Ma, Allan and Dimlioglu, Tolga and Tay, Sui Jiet and Choromanska, Anna},
  booktitle = {ICML 2026 Workshop on High-dimensional Learning Dynamics (HiLD)},
  year      = {2026}
}`
  },
  {
    id: "hild-localsgd",
    title: "Worker Disagreement Reveals Sharp Directions in Local SGD",
    authors: ["T. Dimlioglu", "K. Topollai", "A. Choromanska"],
    venue: "ICML 2026 HiLD workshop",
    conf: "ICML",
    detail: "HiLD workshop",
    year: 2026,
    status: "workshop",
    links: { arxiv: "https://arxiv.org/abs/2605.27739" },
    bibtex: `@inproceedings{dimlioglu2026worker,
  title     = {Worker Disagreement Reveals Sharp Directions in Local {SGD}},
  author    = {Dimlioglu, Tolga and Topollai, Kristi and Choromanska, Anna},
  booktitle = {ICML 2026 Workshop on High-dimensional Learning Dynamics (HiLD)},
  year      = {2026}
}`
  },
  {
    id: "ai4law",
    title: "Streamlining Industrial Contract Management with Retrieval-Augmented LLMs",
    authors: ["K. Topollai", "T. Dimlioglu", "A. Choromanska", "S. Odie", "R. Hui"],
    venue: "ICML 2026 AI4Law workshop",
    conf: "ICML",
    detail: "AI4Law workshop",
    year: 2026,
    status: "workshop",
    links: { arxiv: "https://arxiv.org/abs/2511.14671" },
    bibtex: `@inproceedings{topollai2026streamlining,
  title     = {Streamlining Industrial Contract Management with Retrieval-Augmented {LLMs}},
  author    = {Topollai, Kristi and Dimlioglu, Tolga and Choromanska, Anna and Odie, Simon and Hui, Reginald},
  booktitle = {ICML 2026 AI4Law Workshop},
  year      = {2026}
}`
  },
  {
    id: "aaai26",
    title: "Self-Supervised Representation Learning with JEPA for Automotive LiDAR Object Detection",
    authors: ["H. Zhu", "Z. Dong", "K. Topollai", "B. Sha", "A. Choromanska"],
    venue: "AAAI 2026",
    conf: "AAAI",
    year: 2026,
    status: "accepted",
    links: { paper: "https://ojs.aaai.org/index.php/AAAI/article/view/38402", arxiv: "https://arxiv.org/abs/2501.04969", code: "https://github.com/HaoranZhuExplorer/adljepa" },
    bibtex: `@inproceedings{zhu2026self,
  title     = {Self-Supervised Representation Learning with Joint Embedding Predictive Architecture for Automotive {LiDAR} Object Detection},
  author    = {Zhu, Haoran and Dong, Zhenyuan and Topollai, Kristi and Sha, Beiyao and Choromanska, Anna},
  booktitle = {Proceedings of the AAAI Conference on Artificial Intelligence},
  volume    = {40},
  number    = {16},
  pages     = {13925--13933},
  year      = {2026},
  doi       = {10.1609/aaai.v40i16.38402}
}`
  },
  {
    id: "cvprw25",
    title: "Task-Level Contrastiveness for Cross-Domain Few-Shot Learning",
    authors: ["K. Topollai", "A. Choromanska"],
    venue: "CVPR 2025 DG-EBF workshop",
    conf: "CVPR",
    detail: "DG-EBF workshop",
    year: 2025,
    status: "workshop",
    note: "oral",
    links: { paper: "https://openaccess.thecvf.com/content/CVPR2025W/DG-EBF/html/Topollai_Task-Level_Contrastiveness_for_Cross-Domain_Few-Shot_Learning_CVPRW_2025_paper.html", arxiv: "https://arxiv.org/abs/2510.03509" },
    bibtex: `@inproceedings{topollai2025task,
  title     = {Task-Level Contrastiveness for Cross-Domain Few-Shot Learning},
  author    = {Topollai, Kristi and Choromanska, Anna},
  booktitle = {Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR) Workshops},
  pages     = {6555--6565},
  year      = {2025}
}`
  },
  {
    id: "thesis",
    title: "Neural Networks for Value Function Approximation in Markov Infinite-Horizon Optimal Stopping Problems",
    authors: ["K. Topollai", "G. Moustakides"],
    venue: "BSc thesis, University of Patras",
    conf: "thesis",
    detail: "BSc, University of Patras",
    year: 2022,
    status: "thesis",
    links: {}
  }
];
