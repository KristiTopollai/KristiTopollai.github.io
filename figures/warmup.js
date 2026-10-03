// Warmup as a horizon-dependent hyperparameter, in the paper's two-mode quadratic (Section 3, Theorem 1).
// Gradient descent with linear warmup of W updates to a peak rate η, then constant until the horizon T.
// A low-curvature mode (h_s/h_e = 0.04, as in the paper's Figure 6) and a mode near the stability edge
// (ηh_e close to 2), with initial losses A_s = 1, A_e = 100. Continuous-warmup approximation.
// Left: the schedule. Right: loss at each horizon against W, with a dot at the best W for that horizon.
Figs.register('warmup', function (root) {
  var el = Figs.el, txt = Figs.txt, h = Figs.h;
  var HS = 0.04, AS = 1, AE = 100, HOR = [20, 40, 60, 80, 100], WMAX = 50, LO = -8, HI = 2;
  var W = 800, H = 250, T = 26, B = 212, LA = 46, RA = 318, LB = 392, RB = 786;
  var ctl = h('div', 'ctl'); root.appendChild(ctl);
  // below ηh_e = 2/(1 + h_s/h_e) ≈ 1.923 the optimal warmup shrinks with T, at it stays fixed, above it grows;
  // past 2 the peak rate alone would diverge, and warmup is what keeps the run stable
  var et = Figs.range(ctl, 'peak rate ηhₑ', 1.5, 2.5, 0.005, 1.98, function (v) { return (+v).toFixed(3); });
  et.input.addEventListener('input', function () { et.output.textContent = et.fmt(et.input.value); reset(); });
  var hz = Figs.pills(ctl, 'horizon', HOR.map(function (t) { return [t, String(t)]; }), 60, reset);
  var sl = Figs.range(ctl, 'warmup', 0, WMAX, 0.25, 0, function (v) { return (+v).toFixed(1); });
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Warmup–stable schedule and loss against warmup duration for several horizons in the two-mode quadratic' }, root);
  var g = el('g', {}, svg);

  function rho(a) { return -2 * Math.log(Math.abs(1 - a)); }                         // log-contraction per peak-rate step
  function gw(a) { return 2 * (1 + (1 - a) / a * Math.log(Math.abs(1 - a))); }      // its average over a linear warmup
  function loss(eta, w, t) {
    function m(a) { return Math.exp(-(gw(a) * w + rho(a) * (t - w))); }
    return AS * m(eta * HS) + AE * m(eta);
  }
  function wstar(eta, t) { // Theorem 1: W* = clip(x_η T + c_η, 0, T)
    var as = eta * HS, rs = rho(as), re = rho(eta), ds = rs - gw(as), ae = gw(eta) - re;
    return Math.max(0, Math.min(t, ((rs - re) * t + Math.log(AE * ae / (AS * ds))) / (ds + ae)));
  }
  function XB(w) { return LB + w / WMAX * (RB - LB); }
  function YB(v) { var lg = Math.max(LO, Math.min(HI, Math.log10(v))); return B - (lg - LO) / (HI - LO) * (B - T); }

  function reset() { sl.input.value = Math.round(4 * wstar(+et.input.value, hz.get())) / 4; render(); }
  function render() {
    var eta = +et.input.value, t = hz.get(), w = Math.min(+sl.input.value, t);
    sl.output.textContent = w.toFixed(1);
    Figs.clear(g);

    // left: the schedule over this run, in units of ηh_e; 2 is the stability edge
    function XA(u) { return LA + u / t * (RA - LA); }
    function YA(v) { return B - v / 2.7 * (B - T); }
    [0, 1, 2].forEach(function (v) { el('line', { x1: LA, x2: RA, y1: YA(v), y2: YA(v), 'class': v === 2 ? 'mute' : 'grid' }, g); txt(g, LA - 6, YA(v) + 4, String(v), { 'text-anchor': 'end' }); });
    txt(g, RA, YA(2) + (eta > 1.95 ? 13 : -5), 'stability edge', { 'text-anchor': 'end' }); // keep clear of the plateau
    if (w > 0) el('rect', { x: XA(0), y: T, width: XA(w) - XA(0), height: B - T, 'class': 'band' }, g);
    el('path', { d: Figs.path([[XA(0), YA(0)], [XA(w), YA(eta)], [XA(t), YA(eta)]]), 'class': 'acc' }, g);
    txt(g, LA, T - 10, 'learning rate × curvature', { 'class': 'ink' });
    txt(g, XA(0), H - 26, '0'); txt(g, XA(t), H - 26, String(t), { 'text-anchor': 'end' });
    txt(g, (LA + RA) / 2, H - 12, 'update', { 'text-anchor': 'middle' });
    if (w > 0) txt(g, Math.min(XA(w) + 6, RA - 44), YA(0.6), 'warmup', { 'class': 'acc' });

    // right: loss against warmup at each horizon; longer runs sit lower
    for (var d = LO; d <= HI; d += 2) { el('line', { x1: LB, x2: RB, y1: YB(Math.pow(10, d)), y2: YB(Math.pow(10, d)), 'class': 'grid' }, g); txt(g, LB - 6, YB(Math.pow(10, d)) + 4, d ? '1e' + d : '1', { 'text-anchor': 'end' }); }
    [0, 10, 20, 30, 40, 50].forEach(function (v) { txt(g, XB(v), H - 26, String(v), { 'text-anchor': v === WMAX ? 'end' : (v ? 'middle' : 'start') }); });
    txt(g, (LB + RB) / 2, H - 12, 'warmup W (updates)', { 'text-anchor': 'middle' });
    txt(g, LB, T - 10, 'loss above optimum after T updates, one curve per horizon', { 'class': 'ink' });
    HOR.forEach(function (tt) {
      var on = tt === t, ws = wstar(eta, tt), pts = [];
      for (var ww = 0; ww <= Math.min(tt, WMAX) + 1e-9; ww += 0.1) pts.push([XB(ww), YB(loss(eta, ww, tt))]);
      el('path', { d: Figs.path(pts), 'class': on ? 'acc' : 'ref' }, g);
      el('circle', { cx: XB(ws), cy: YB(loss(eta, ws, tt)), r: on ? 4 : 2.6, 'class': on ? 'accf' : 'inkf' }, g);
      var we = Math.min(tt, WMAX); txt(g, XB(we), YB(loss(eta, we, tt)) - 5, 'T = ' + tt, { 'text-anchor': 'end', 'class': on ? 'acc' : '' }); // at the curve's end
      if (on) el('circle', { cx: XB(w), cy: YB(loss(eta, w, tt)), r: 5, 'class': 'acc' }, g);
    });
  }
  sl.input.addEventListener('input', render);
  reset();
});
