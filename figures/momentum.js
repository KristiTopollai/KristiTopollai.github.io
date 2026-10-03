// Heavy-ball momentum on an ill-conditioned quadratic, with a β slider.
Figs.register('momentum', function (root) {
  var el = Figs.el, txt = Figs.txt, h = Figs.h;
  var W = 600, H = 200, k = 20, xs = -3.05, xe = 3.05, ys = -1.02, ye = 1.02;
  var F = Figs.svgFigure(root, W, H, 'Heavy-ball momentum trajectory on an ill-conditioned quadratic');
  var b = Figs.range(F.ctl, 'β', 0, 0.95, 0.05, 0.6, function (v) { return (+v).toFixed(2); });
  F.ctl.appendChild(h('span', null, 'η = 0.09 · f = ½(x² + 20y²)'));
  function X(x) { return (x - xs) / (xe - xs) * W; }
  function Y(y) { return H - (y - ys) / (ye - ys) * H; }
  function run(beta, lr, n) {
    var x = -2.6, y = 0.8, vx = 0, vy = 0, pts = [[x, y]], conv = -1;
    for (var i = 0; i < n; i++) { vx = beta * vx - lr * x; vy = beta * vy - lr * k * y; x += vx; y += vy; pts.push([x, y]); if (conv < 0 && Math.abs(x) + Math.abs(y) < 0.05) conv = i + 1; }
    return { pts: pts, conv: conv };
  }
  function poly(pts, cls) { var d = ''; pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }); return el('path', { d: d, 'class': cls }, F.g); }
  function render() {
    Figs.clear(F.g);
    [0.03, 0.12, 0.3, 0.6, 1.1, 1.8, 2.7, 3.8, 5.1].forEach(function (c) { el('ellipse', { cx: X(0), cy: Y(0), rx: Math.sqrt(2 * c) / (xe - xs) * W, ry: Math.sqrt(2 * c / k) / (ye - ys) * H, 'class': 'grid' }, F.g); });
    var beta = +b.input.value; b.output.textContent = b.fmt(beta);
    var ref = run(0, 0.09, 80); poly(ref.pts, 'ref');
    var hb = run(beta, 0.09, 80); poly(hb.pts, 'acc');
    hb.pts.forEach(function (p, i) { if (i % 2 === 0) el('circle', { cx: X(p[0]), cy: Y(p[1]), r: 1.6, 'class': 'accf' }, F.g); });
    el('circle', { cx: X(0), cy: Y(0), r: 2.5, 'class': 'inkf' }, F.g); txt(F.g, X(0) + 8, Y(0) + 4, 'x*', { 'class': 'ink' });
    el('circle', { cx: X(-2.6), cy: Y(0.8), r: 2.5, 'class': 'inkf' }, F.g); txt(F.g, X(-2.6) - 22, Y(0.8) - 8, 'x0', { 'class': 'ink' });
    txt(F.g, W - 8, H - 8, 'grey: β = 0', { 'text-anchor': 'end' });
  }
  b.input.addEventListener('input', render); render();
});
