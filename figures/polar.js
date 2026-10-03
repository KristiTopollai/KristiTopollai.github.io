// Spectral estimation for Newton–Schulz, on real momentum spectra (figures/polar-data.js).
// Top: where the singular values live, from an SVD and from the maximum-entropy fit to the 41
// moments the iteration exposes for free. Bottom: the response after K steps of Polar Express designed
// for [1e-5, 1] (fixed) and for [ρ̂, 1] (selected from the fitted spectrum), i.e. where a singular value
// σ lands, drawn as a line on a dense grid.
Figs.register('polar', function (root) {
  var el = Figs.el, txt = Figs.txt, h = Figs.h, D = window.POLAR_DATA;
  var W = 800, H = 320, L = 46, R = 14, T1 = 30, B1 = 112, T2 = 152, B2 = 276;
  var F = Figs.svgFigure(root, W, H, 'Momentum spectrum, its moment fit, and Newton–Schulz responses before and after selection');
  var mat = Figs.pills(F.ctl, 'matrix', D.m.map(function (m, i) { return [i, m.label]; }), 3, render); // opens on MLP up
  var K = Figs.range(F.ctl, 'iterations K', 4, 10, 1, 5, function (v) { return v; });
  K.input.addEventListener('input', render);

  // Polar Express (Amsel et al.): greedy minimax odd quintics, each iteration designed for the
  // previous one's output interval. Same coefficients as the paper's candidate set.
  function quintic(l, u) {
    if (l / u >= 1 - 5e-6) return [15 / 8 / u, -10 / 8 / Math.pow(u, 3), 3 / 8 / Math.pow(u, 5)];
    var q = (3 * l + u) / 4, r = (l + 3 * u) / 4, E = Infinity, old = null, s = [0, 0, 0, 0];
    for (var it = 0; it < 100 && (old === null || Math.abs(old - E) > 1e-15); it++) {
      old = E;
      s = solve4([[l, l * l * l, Math.pow(l, 5), 1], [q, q * q * q, Math.pow(q, 5), -1], [r, r * r * r, Math.pow(r, 5), 1], [u, u * u * u, Math.pow(u, 5), -1]]);
      E = s[3];
      var d = Math.sqrt(9 * s[1] * s[1] - 20 * s[0] * s[2]);
      q = Math.sqrt((-3 * s[1] - d) / (10 * s[2])); r = Math.sqrt((-3 * s[1] + d) / (10 * s[2]));
    }
    return [s[0], s[1], s[2]];
  }
  function solve4(A) { // A x = 1, Gaussian elimination with pivoting
    var M = A.map(function (row) { return row.concat([1]); }), n = 4, i, j, k;
    for (i = 0; i < n; i++) {
      var p = i; for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      var tmp = M[i]; M[i] = M[p]; M[p] = tmp;
      for (k = i + 1; k < n; k++) { var f = M[k][i] / M[i][i]; for (j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
    }
    var x = [0, 0, 0, 0];
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }
  var cache = {};
  function routine(l, k) {
    var key = l + '|' + k; if (cache[key]) return cache[key];
    var u = 1, out = [];
    for (var i = 0; i < k; i++) {
      var c = quintic(l, u), pl = c[0] * l + c[1] * l * l * l + c[2] * Math.pow(l, 5), pu = c[0] * u + c[1] * u * u * u + c[2] * Math.pow(u, 5), sc = 2 / (pl + pu);
      c = [c[0] * sc, c[1] * sc, c[2] * sc]; out.push(c);
      l = c[0] * l + c[1] * l * l * l + c[2] * Math.pow(l, 5); u = 2 - l;
    }
    return (cache[key] = out);
  }
  function resp(cs, x) { for (var i = 0; i < cs.length; i++) { var c = cs[i], x2 = x * x; x = x * (c[0] + x2 * (c[1] + c[2] * x2)); } return x; }

  function X(v) { return L + (Math.log10(v) + 5) / 5 * (W - L - R); }
  function Y2(v) { return B2 - Math.min(v, 2.05) / 2.05 * (B2 - T2); }
  function e(v) { if (v <= 0) return '< 1e-6'; if (v >= 0.01) return v.toFixed(v >= 0.1 ? 3 : 4); var s = v.toExponential(1).split('e'); return s[0] + 'e' + s[1]; }

  function render() {
    var m = D.m[mat.get()], k = +K.input.value, sel = m.K[k], rho = sel[0];
    K.output.textContent = k;
    Figs.clear(F.g); var g = F.g;
    var top = Math.max.apply(null, m.svd.concat(m.fit)) * 1.1;
    function Y1(v) { return B1 - v / top * (B1 - T1); }
    for (var d = -5; d <= 0; d++) {
      el('line', { x1: X(Math.pow(10, d)), x2: X(Math.pow(10, d)), y1: T1, y2: B1, 'class': 'grid' }, g);
      el('line', { x1: X(Math.pow(10, d)), x2: X(Math.pow(10, d)), y1: T2, y2: B2, 'class': 'grid' }, g);
      txt(g, X(Math.pow(10, d)), H - 22, d === 0 ? '1' : '1e' + d, { 'text-anchor': d === 0 ? 'end' : (d === -5 ? 'start' : 'middle') });
    }
    txt(g, (X(1e-5) + X(1)) / 2, H - 6, 'singular value σ / ‖M‖F', { 'text-anchor': 'middle' });
    el('line', { x1: L, x2: W - R, y1: B1, y2: B1, 'class': 'grid' }, g);
    [0, 1, 2].forEach(function (v) { el('line', { x1: L, x2: W - R, y1: Y2(v), y2: Y2(v), 'class': v === 1 ? 'mute' : 'grid' }, g); txt(g, L - 6, Y2(v) + 4, String(v), { 'text-anchor': 'end' }); });

    // spectrum: SVD histogram and moment fit
    var lx = m.x.map(function (v) { return Math.log10(v); }), bw = (lx[lx.length - 1] - lx[0]) / (lx.length - 1);
    m.svd.forEach(function (v, i) {
      if (v <= 0) return;
      var x0 = X(Math.pow(10, lx[i] - bw / 2)), x1 = X(Math.pow(10, lx[i] + bw / 2));
      el('rect', { x: Math.max(L, x0) + 0.5, y: Y1(v), width: Math.max(0, x1 - Math.max(L, x0) - 1), height: B1 - Y1(v), 'class': 'bar' }, g);
    });
    el('path', { d: Figs.path(m.fit.map(function (v, i) { return [X(m.x[i]), Y1(v)]; })), 'class': 'acc' }, g);
    txt(g, L, T1 - 10, m.label + ' momentum, layer 5, step 16k: density of singular values', { 'class': 'ink' });
    el('rect', { x: W - R - 322, y: T1 - 18, width: 10, height: 10, 'class': 'bar' }, g); txt(g, W - R - 307, T1 - 10, 'SVD');
    el('line', { x1: W - R - 272, x2: W - R - 256, y1: T1 - 13, y2: T1 - 13, 'class': 'acc' }, g); txt(g, W - R, T1 - 10, 'fit from 41 moments, no extra matmuls', { 'text-anchor': 'end', 'class': 'acc' });

    // the K-step response P_K(σ / s): where a singular value σ lands; the target is 1. Drawn as the min-max
    // envelope of each pixel column, so it is a line where the response is smooth and a band where it
    // oscillates faster than a pixel. It stops at σ = s, the largest possible singular value.
    var fixed = routine(1e-5, k), chosen = routine(rho, k), cols = 420, sub = 24, x0 = -5, x1 = Math.log10(Math.min(1, m.s));
    function envelope(cs) {
      var up = [], lo = [];
      for (var c = 0; c < cols; c++) {
        var mn = Infinity, mx = -Infinity;
        for (var j = 0; j <= sub; j++) {
          var y = resp(cs, Math.pow(10, x0 + (x1 - x0) * (c + j / sub) / cols) / m.s);
          if (y < mn) mn = y; if (y > mx) mx = y;
        }
        var px = X(Math.pow(10, x0 + (x1 - x0) * (c + 0.5) / cols));
        up.push([px, Y2(mx)]); lo.unshift([px, Y2(mn)]);
      }
      return Figs.path(up.concat(lo)) + 'Z';
    }
    el('path', { d: envelope(fixed), 'class': 'inkf', 'fill-opacity': 0.16, stroke: 'currentColor', 'stroke-opacity': 0.4, 'stroke-width': 1, 'stroke-linejoin': 'round', style: 'color: var(--fi)' }, g);
    el('path', { d: envelope(chosen), 'class': 'accf', 'fill-opacity': 0.35, stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round', style: 'color: var(--fa)' }, g);
    txt(g, L, T2 - 10, 'where σ lands after K = ' + k + ' steps (target 1)', { 'class': 'ink' });
    el('line', { x1: W - R - 350, x2: W - R - 334, y1: T2 - 14, y2: T2 - 14, 'class': 'ink', 'stroke-opacity': 0.4, 'stroke-width': 1.2 }, g); txt(g, W - R - 328, T2 - 10, 'fixed [1e-5, 1]');
    el('line', { x1: W - R - 206, x2: W - R - 190, y1: T2 - 14, y2: T2 - 14, 'class': 'acc' }, g); txt(g, W - R, T2 - 10, 'selected [ρ̂, 1], ρ̂ = ' + e(rho), { 'text-anchor': 'end', 'class': 'acc' });

  }
  render();
});
