// Shared helpers for the interactive figures. Each figure file calls Figs.register(name, fn).
// A figure is mounted into any element with data-fig="name". Controls and colors are styled
// by .fig in site.css, so new figures match without extra CSS.
window.Figs = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var kinds = {};
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(n, at, p) { var e = document.createElementNS(NS, n); for (var k in at) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; }
  function txt(p, x, y, s, at) { var t = el('text', Object.assign({ x: x, y: y }, at || {}), p); t.textContent = s; return t; }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function range(ctl, label, min, max, step, val, fmt) {
    var lab = h('label'); lab.appendChild(document.createTextNode(label));
    var inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
    var out = document.createElement('output'); out.textContent = fmt(val);
    lab.appendChild(inp); lab.appendChild(out); ctl.appendChild(lab);
    return { input: inp, output: out, fmt: fmt };
  }
  function check(ctl, label, on) {
    var lab = h('label'); var inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = on;
    lab.appendChild(inp); lab.appendChild(document.createTextNode(label)); ctl.appendChild(lab); return inp;
  }
  // A row of mutually exclusive buttons. opts: [[value, text], ...]. Returns { get: () => value }.
  function pills(ctl, label, opts, val, onChange) {
    var wrap = h('span', 'pills'); if (label) wrap.appendChild(h('span', null, label));
    opts.forEach(function (o) {
      var b = h('button', o[0] === val ? 'on' : null, o[1]); b.type = 'button';
      b.addEventListener('click', function () {
        val = o[0]; wrap.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); onChange(val);
      });
      wrap.appendChild(b);
    });
    ctl.appendChild(wrap); return { get: function () { return val; } };
  }
  // Path through points [[x, y], ...] already in pixel space; nulls break the line.
  function path(pts) { var d = '', pen = false; pts.forEach(function (p) { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); pen = true; }); return d; }
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  function cssVar(root, name, fb) { var v = getComputedStyle(root).getPropertyValue(name).trim(); return v || fb; }

  // Standard skeleton: a control row and an SVG with a viewBox.
  function svgFigure(root, W, H, label) {
    var ctl = h('div', 'ctl'); root.appendChild(ctl);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label }, root);
    var g = el('g', {}, svg);
    return { ctl: ctl, svg: svg, g: g };
  }

  return {
    el: el, txt: txt, h: h, range: range, check: check, pills: pills, path: path, clear: clear, cssVar: cssVar, svgFigure: svgFigure, REDUCE: REDUCE,
    register: function (name, fn) { kinds[name] = fn; },
    mountAll: function (scope) {
      (scope || document).querySelectorAll('[data-fig]').forEach(function (r) {
        if (r.dataset.mounted) return;
        var fn = kinds[r.dataset.fig];
        if (!fn) { console.warn('no figure registered as', r.dataset.fig); return; }
        r.dataset.mounted = '1'; fn(r);
      });
    }
  };
})();
