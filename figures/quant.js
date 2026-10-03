// A stored BF16 value receives the same small update every step, as in Figure 1 of the blog post.
// Nearest rounding sends an update below half a grid step straight back to the old value, so the state
// never moves. Stochastic rounding moves a full step with probability (update / step), so on average it
// keeps up with the exact sum. Values stay in [1.25, 2), where the BF16 grid step is 2^-7.
Figs.register('quant', function (root) {
  var el = Figs.el, txt = Figs.txt;
  var W = 800, H = 270, L = 46, R = 92, T = 26, B = 222, N = 100, START = 1.25, U = Math.pow(2, -7), PATHS = 6;
  var F = Figs.svgFigure(root, W, H, 'A BF16 value receiving the same small update every step, with nearest and stochastic rounding');
  var upd = Figs.range(F.ctl, 'update size', 0.05, 0.95, 0.05, 0.3, function (v) { return (+v).toFixed(2) + ' of a grid step'; });
  upd.input.addEventListener('input', render);

  // fixed random draws, so moving the slider changes the update and not the luck
  var seed = 7; function uni() { seed = (seed * 1664525 + 1013904223) % 4294967296; return (seed + 0.5) / 4294967296; }
  var draws = []; for (var p = 0; p < PATHS; p++) { var d = []; for (var t = 0; t < N; t++) d.push(uni()); draws.push(d); }
  function round(x, u) { // to the BF16 grid in [1, 2); u = null for nearest (ties to even), else a uniform draw
    var n = Math.floor(x / U), f = x / U - n;
    var up = u == null ? (f > 0.5 || (f === 0.5 && n % 2 === 1)) : u < f;
    return (up ? n + 1 : n) * U;
  }
  function X(t) { return L + t / N * (W - L - R); }

  function render() {
    var dlt = +upd.input.value; upd.output.textContent = upd.fmt(dlt);
    var inc = dlt * U, exact = [], near = [], sto = [], v, t, p;
    for (t = 0; t <= N; t++) exact.push(START + t * inc);
    for (v = START, t = 0; t <= N; t++) { near.push(v); v = round(v + inc, null); }
    for (p = 0; p < PATHS; p++) { var s = []; for (v = START, t = 0; t <= N; t++) { s.push(v); v = round(v + inc, draws[p][t % N]); } sto.push(s); }
    var top = Math.max(exact[N], Math.max.apply(null, sto.map(function (s) { return s[N]; }))) + U, bot = START - U;
    function Y(y) { return B - (y - bot) / (top - bot) * (B - T); }

    var g = F.g; Figs.clear(g);
    // y axis in grid steps above the start; every BF16 grid line is drawn when there are few enough to see
    var span = Math.round((top - START) / U), tick = [1, 2, 5, 10, 20, 25].find(function (s) { return span / s <= 6; }) || 50;
    var dense = span <= 24;
    for (var k = -1; k <= span; k++) {
      var y = START + k * U, labeled = k >= 0 && k % tick === 0;
      if (dense || labeled) el('line', { x1: L, x2: W - R, y1: Y(y), y2: Y(y), 'class': 'grid' }, g);
      if (labeled) txt(g, L - 6, Y(y) + 4, k ? '+' + k : '0', { 'text-anchor': 'end' });
    }
    [0, 25, 50, 75, 100].forEach(function (t) { txt(g, X(t), H - 18, t ? String(t) : 'update 0', { 'text-anchor': t ? (t === N ? 'end' : 'middle') : 'start' }); });
    txt(g, L, T - 10, 'same small update every step, stored in BF16 · y: grid steps above the start' + (dense ? ' (gray: the grid)' : ''), { 'class': 'ink' });

    function pts(a) { return a.map(function (y, t) { return [X(t), Y(y)]; }); }
    for (p = 1; p < PATHS; p++) el('path', { d: Figs.path(pts(sto[p])), 'class': 'acc', 'stroke-opacity': 0.25, 'stroke-width': 1.2 }, g);
    el('path', { d: Figs.path(pts(exact)), 'class': 'mute' }, g);
    el('path', { d: Figs.path(pts(near)), 'class': 'ink' }, g);
    el('path', { d: Figs.path(pts(sto[0])), 'class': 'acc' }, g);

    // end labels, nudged apart when the lines finish close together
    var ends = [[exact[N], 'exact', null], [near[N], 'nearest', 'ink'], [sto[0][N], 'stochastic', 'acc']].map(function (e) { return { y: Y(e[0]), s: e[1], c: e[2] }; });
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    ends.forEach(function (e) { txt(g, W - R + 8, e.y + 4, e.s, e.c ? { 'class': e.c } : {}); });

    var gain = function (a) { return Math.round((a[N] - START) / U); };
    txt(g, L, H - 2, 'after ' + N + ' updates, in grid steps: exact +' + (N * dlt).toFixed(0) + ' · nearest +' + gain(near) + ' · stochastic +' + gain(sto[0]), {});
  }
  render();
});
