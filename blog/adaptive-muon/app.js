/* Interactive figures for "Adaptive Muon via Spectral Estimation".  Requires window.DATA (data.js) and Plotly. */
(function () {
  const D = window.DATA;
  const C = { truth: '#1b1f24', est: '#2a6ebb', meas: '#6d4bd6', van: '#c8453d', orc: '#3a8f5c', gray: '#8a949e', band: 'rgba(120,130,140,0.25)' };
  const FAM = { q: '#2a6ebb', k: '#5aa0d8', v: '#173f7d', o: '#0e9f8f', mlp_up: '#b5179e', mlp_gate: '#e05aa8', mlp_down: '#7a1fa2' };
  const FAMLABEL = { q: 'Q', k: 'K', v: 'V', o: 'O', mlp_up: 'MLP up', mlp_gate: 'MLP gate', mlp_down: 'MLP down' };
  const FAMS = ['q', 'k', 'v', 'o', 'mlp_up', 'mlp_gate', 'mlp_down'];
  const CFG = { displayModeBar: false, responsive: true };
  const fmtE = (x) => { if (x === 0) return '0'; const e = Math.floor(Math.log10(x)); const m = x / Math.pow(10, e); return (Math.abs(m - 1) < 1e-9 ? '' : m.toFixed(1) + '·') + '10^' + e; };
  const fmtEh = (x) => fmtE(x).replace(/10\^(-?\d+)/, '10<sup>$1</sup>');
  const logTicks = (lo, hi) => { const v = [], t = []; for (let e = lo; e <= hi; e++) { v.push(Math.pow(10, e)); t.push(e === 0 ? '1' : '10<sup>' + e + '</sup>'); } return { tickvals: v, ticktext: t }; };
  const hex2rgba = (h, a) => `rgba(${parseInt(h.substr(1, 2), 16)},${parseInt(h.substr(3, 2), 16)},${parseInt(h.substr(5, 2), 16)},${a})`;
  const stepXY = (centers, vals, w) => { const x = [], y = []; centers.forEach((c, i) => { x.push(c * Math.pow(10, -w / 2)); y.push(vals[i]); x.push(c * Math.pow(10, w / 2)); y.push(vals[i]); }); return { x, y }; };

  function layout(o) {
    const base = {
      font: { family: "'IBM Plex Sans', -apple-system, Helvetica, Arial, sans-serif", size: 12.5, color: '#3b4750' },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 56, r: 18, t: 30, b: 46 },
      legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 11.5 }, bgcolor: 'rgba(0,0,0,0)' },
      hoverlabel: { bgcolor: '#1b1f24', font: { color: '#fff', size: 12 }, bordercolor: '#1b1f24' },
      xaxis: { gridcolor: '#eef0f2', zeroline: false, linecolor: '#d5dae0', ticks: 'outside', tickcolor: '#d5dae0', title: { standoff: 8 } },
      yaxis: { gridcolor: '#eef0f2', zeroline: false, linecolor: '#d5dae0', ticks: 'outside', tickcolor: '#d5dae0', title: { standoff: 8 } },
    };
    const out = Object.assign({}, base, o);
    for (const k of Object.keys(o)) if (k.startsWith('xaxis') || k.startsWith('yaxis')) out[k] = Object.assign({}, k.startsWith('x') ? base.xaxis : base.yaxis, o[k]);
    if (out.height && window.PLOT_HEIGHT_SCALE) out.height = Math.min(Math.round(out.height * window.PLOT_HEIGHT_SCALE), window.PLOT_HEIGHT_MAX || 1e9);
    return out;
  }
  const $ = (id) => document.getElementById(id);

  // ---------- small UI helpers ----------
  function pills(el, opts, init, onChange) {
    const box = document.createElement('div'); box.className = 'pills';
    let cur = init;
    opts.forEach(([val, lab]) => {
      const b = document.createElement('button'); b.innerHTML = lab; b.dataset.v = val; if (String(val) === String(init)) b.classList.add('on');
      b.onclick = () => { cur = val; [...box.children].forEach(c => c.classList.toggle('on', c.dataset.v === String(val))); onChange(val); };
      box.appendChild(b);
    });
    el.appendChild(box);
    return { get: () => cur, set: (v) => { cur = v; [...box.children].forEach(c => c.classList.toggle('on', c.dataset.v === String(v))); }, box };
  }
  function slider(el, values, init, fmt, onChange) {
    const wrap = document.createElement('div'); wrap.className = 'slider';
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = 0; inp.max = values.length - 1; inp.step = 1; inp.value = init;
    const val = document.createElement('span'); val.className = 'val'; val.textContent = fmt(values[init]);
    inp.oninput = () => { val.textContent = fmt(values[+inp.value]); onChange(values[+inp.value], +inp.value); };
    wrap.appendChild(inp); wrap.appendChild(val); el.appendChild(wrap);
    return { get: () => values[+inp.value], idx: () => +inp.value, set: (i) => { inp.value = i; val.textContent = fmt(values[i]); onChange(values[i], i); }, setMax: (m) => { inp.max = m; if (+inp.value > m) inp.value = m; val.textContent = fmt(values[+inp.value]); } };
  }
  function group(parent, label) {
    const g = document.createElement('div'); g.className = 'grp';
    if (label) { const l = document.createElement('span'); l.className = 'lbl'; l.textContent = label; g.appendChild(l); }
    parent.appendChild(g); return g;
  }
  function button(parent, label, onClick) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = onClick; parent.appendChild(b); return b; }
  function player(parent, stepFn, ms) { let timer = null; const b = button(parent, '▶ play', () => { if (timer) { clearInterval(timer); timer = null; b.textContent = '▶ play'; return; } b.textContent = '❚❚ pause'; timer = setInterval(() => { if (!stepFn()) { clearInterval(timer); timer = null; b.textContent = '▶ play'; } }, ms); }); }
  const famPills = (el, init, cb) => pills(el, FAMS.map(f => [f, FAMLABEL[f]]), init, cb);
  const ex = (fam) => D.examples.find(e => e.family === fam);
  const LOGY4 = (() => { const t = logTicks(-4, 0); return { tickvals: t.tickvals, ticktext: t.ticktext }; })();
  const LOGY5 = (() => { const t = logTicks(-5, 0); return { tickvals: t.tickvals, ticktext: t.ticktext }; })();

  // =====================================================================================
  // Figure 1: watch a real spectrum flatten, stage by stage
  // =====================================================================================
  function fig1() {
    const ctrl = $('f1-ctrl'), plot = $('f1-plot');
    let fam = 'q', routine = 'safe', j = 0;
    const ROUT = [['safe', 'measurement, K=10'], ['van5', 'fixed PE, K=5'], ['sel5', 'selected, K=5'], ['van8', 'fixed PE, K=8'], ['sel8', 'selected, K=8']];
    // Every routine starts from the same X_0, scaled with the Gram-power bound of Section 3, so the
    // fixed PE runs differ from the selected ones only in the coefficients.
    famPills(group(ctrl, 'matrix'), fam, v => { fam = v; draw(); });
    pills(group(ctrl, 'routine'), ROUT, routine, v => { routine = v; const K = ex(fam).traj[v].K; j = Math.min(j, K); sl.setMax(K); sl.set(j); });
    const sg = group(ctrl, 'iteration');
    const sl = slider(sg, [...Array(11).keys()], 0, v => 'j = ' + v, v => { j = v; draw(); });
    sl.setMax(ex(fam).traj[routine].K);
    player(sg, () => { const K = ex(fam).traj[routine].K; const nj = j >= K ? 0 : j + 1; sl.set(nj); return nj < K; }, 650);
    function draw() {
      const e = ex(fam), T = e.traj[routine], K = T.K; if (j > K) { j = K; }
      const idx = e.sub_idx; const clip = a => a.map(v => Math.max(v, 1e-7));
      const traces = [
        { x: idx, y: clip(T.stages[0]), mode: 'markers', marker: { size: 3.5, color: C.truth }, name: 'input X<sub>0</sub>', hovertemplate: 'i=%{x}<br>γ=%{y:.2e}<extra></extra>' },
        { x: idx, y: clip(T.stages[Math.min(j, K)]), mode: 'markers', marker: { size: 4, color: C.meas }, name: 'X<sub>j</sub>, after iteration j', hovertemplate: 'i=%{x}<br>z=%{y:.3f}<extra></extra>' },
      ];
      const lt = logTicks(-7, 0);
      Plotly.react(plot, traces, layout({
        height: 390, margin: { l: 60, r: 18, t: 36, b: 48 },
        title: { text: `${e.label}, layer 5, step 16k — ${ROUT.find(r => r[0] === routine)[1]} (ρ = ${fmtEh(T.rho)}), after iteration ${Math.min(j, K)} of ${K}`, font: { size: 13 }, x: 0, xanchor: 'left' },
        xaxis: { title: 'index i (sorted by input singular value)' },
        yaxis: { type: 'log', title: 'singular value', range: [-7.2, 0.35], tickvals: lt.tickvals, ticktext: lt.ticktext },
        shapes: [{ type: 'line', x0: 0, x1: 767, y0: 1, y1: 1, xref: 'x', yref: 'y', line: { color: C.gray, dash: 'dot', width: 1 } },
                 { type: 'line', x0: 0, x1: 767, y0: e.gmin, y1: e.gmin, xref: 'x', yref: 'y', line: { color: C.gray, dash: 'dot', width: 1 } }],
        annotations: [{ x: 8, y: Math.log10(e.gmin) + 0.12, text: 'scoring cutoff', showarrow: false, xanchor: 'left', font: { size: 11, color: C.gray } },
                      { x: 760, y: 0.1, text: 'target: all singular values = 1', showarrow: false, xanchor: 'right', font: { size: 11, color: C.gray } }],
        showlegend: true,
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 2: how Polar Express chooses its coefficients, stage by stage
  // =====================================================================================
  function fig2() {
    const ctrl = $('f2-ctrl'), plot = $('f2-plot'), mini = $('f2-mini');
    let ei = 0, j = 0;
    const ells = D.ells; const dec = [0, 3, 6, 9, 12];   // 1e-5, 1e-4, 1e-3, 1e-2, 1e-1
    const lab = (i) => 'ρ = ' + fmtE(ells[i]).replace('10^', 'e');
    const lp = pills(group(ctrl, 'design interval [ρ, 1]'), dec.map(i => [i, fmtEh(ells[i])]), ei, v => { ei = +v; j = Math.min(j, D.pe[String(ei)].length - 1); sl.setMax(D.pe[String(ei)].length - 1); sl.set(j); });
    const sg = group(ctrl, 'iteration');
    const sl = slider(sg, [...Array(14).keys()], 0, v => 'j = ' + v, v => { j = v; draw(); });
    sl.setMax(D.pe[String(ei)].length - 1);
    player(sg, () => { const n = D.pe[String(ei)].length - 1; const nj = j >= n ? 0 : j + 1; sl.set(nj); return nj < n; }, 900);
    const taus = [0.1, 0.01, 0.001];
    function stagesTo(seq, tau) { for (let k = 0; k < seq.length; k++) if (seq[k].E <= tau) return k + 1; return null; }
    function draw() {
      const seq = D.pe[String(ei)]; const st = seq[Math.min(j, seq.length - 1)];
      const traces = [
        { x: st.x, y: st.err, mode: 'lines', line: { color: C.meas, width: 2.4 }, name: '1 − p<sub>j</sub>(x) on the current interval', xaxis: 'x', yaxis: 'y', hovertemplate: 'x=%{x:.3e}<br>1 − p = %{y:.4f}<extra></extra>' },
        { x: st.alt, y: st.alt.map(xv => { const i = st.x.findIndex(v => v >= xv); return st.err[Math.max(0, Math.min(i, st.err.length - 1))]; }), mode: 'markers', marker: { color: C.truth, size: 9, symbol: 'diamond' }, name: `equioscillation: |1 − p<sub>j</sub>| = e<sub>j</sub> at ${st.alt.length} points`, xaxis: 'x', yaxis: 'y', hoverinfo: 'skip' },
      ];
      const palette = { 0: '#c9c2e8', 3: '#a898dd', 6: '#8a76d2', 9: '#6d4bd6', 12: '#4a2ea6' };
      for (const i of dec) {
        const sq = D.pe[String(i)]; const sel = i === ei;
        traces.push({ x: sq.map((_, k) => k), y: sq.map(q => Math.max(q.E, 1e-6)), mode: 'lines+markers', line: { color: sel ? C.meas : '#c8ccd2', width: sel ? 3 : 1.4 }, marker: { size: sel ? 7 : 4 }, name: lab(i), xaxis: 'x2', yaxis: 'y2', hovertemplate: `${lab(i)}<br>after iteration %{x}: e = %{y:.2e}<extra></extra>` });
      }
      traces.push({ x: [Math.min(j, seq.length - 1)], y: [Math.max(st.E, 1e-6)], mode: 'markers', marker: { color: C.meas, size: 15, symbol: 'circle-open', line: { width: 2.5 } }, showlegend: false, hoverinfo: 'skip', xaxis: 'x2', yaxis: 'y2' });
      const lt = logTicks(-5, 0); const ltx = [1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1, 2].filter(v => v >= st.l * 0.9 && v <= st.u * 1.1);
      Plotly.react(plot, traces, layout({
        height: 380, margin: { l: 60, r: 18, t: 44, b: 66 }, grid: { rows: 1, columns: 2, pattern: 'independent', xgap: 0.16 },
        xaxis: { type: 'log', title: `x in the current interval [ℓ<sub>j</sub>, u<sub>j</sub>] = [${fmtEh(st.l)}, ${st.u.toFixed(3)}]`, range: [Math.log10(st.l) - 0.05, Math.log10(st.u) + 0.05], tickvals: ltx, ticktext: ltx.map(v => v >= 0.1 ? String(v) : fmtEh(v)) },
        yaxis: { title: '1 − p<sub>j</sub>(x)', range: [-1.15, 1.15] },
        xaxis2: { title: 'iterations done', dtick: 1, range: [-0.5, 13.5] },
        yaxis2: { type: 'log', title: 'worst-case error', range: [-6.2, 0.3], tickvals: [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1], ticktext: ['10<sup>-6</sup>', '10<sup>-5</sup>', '10<sup>-4</sup>', '10<sup>-3</sup>', '10<sup>-2</sup>', '10<sup>-1</sup>', '1'] },
        shapes: [{ type: 'line', xref: 'x domain', yref: 'y', x0: 0, x1: 1, y0: st.E, y1: st.E, line: { color: C.gray, dash: 'dot', width: 1 } }, { type: 'line', xref: 'x domain', yref: 'y', x0: 0, x1: 1, y0: -st.E, y1: -st.E, line: { color: C.gray, dash: 'dot', width: 1 } }, { type: 'line', xref: 'x domain', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#d5dae0', width: 1 } }]
          .concat(taus.map(t => ({ type: 'line', xref: 'x2 domain', yref: 'y2', x0: 0, x1: 1, y0: Math.log10(t), y1: Math.log10(t), line: { color: C.gray, dash: 'dot', width: 1 } }))),
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.1, text: `<b>iteration ${Math.min(j, seq.length - 1)}</b> for ${lab(ei)}: the minimax odd quintic on [ℓ<sub>j</sub>, u<sub>j</sub>], e<sub>j</sub> = ${st.E.toExponential(2)}`, showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0.58, y: 1.1, text: '<b>error after each iteration</b>, for five design intervals', showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'x domain', yref: 'y', x: 0.99, y: st.E, text: '+e<sub>j</sub>', showarrow: false, xanchor: 'right', yshift: 9, font: { size: 11, color: C.gray } },
                      { xref: 'x domain', yref: 'y', x: 0.99, y: -st.E, text: '−e<sub>j</sub>', showarrow: false, xanchor: 'right', yshift: -9, font: { size: 11, color: C.gray } }]
          .concat(taus.map(t => ({ xref: 'x2 domain', yref: 'y2', x: 0.995, y: Math.log10(t), text: `τ = ${t}`, showarrow: false, xanchor: 'right', yshift: 8, font: { size: 10.5, color: C.gray } }))),
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.26, font: { size: 11.5 } },
      }), CFG);
      const K = seq.length; const k2 = stagesTo(seq, 0.01), k3 = stagesTo(seq, 0.001);
      mini.innerHTML = `<b>iteration ${Math.min(j, K - 1)}:</b> interval [${fmtEh(st.l)}, ${st.u.toFixed(3)}], ratio ℓ/u = ${fmtEh(st.l / st.u)} &nbsp;·&nbsp; a<sub>j</sub> = ${st.a.toFixed(3)}, b<sub>j</sub> = ${st.b.toFixed(3)}, c<sub>j</sub> = ${st.c.toFixed(3)} &nbsp;·&nbsp; e<sub>j</sub> = ${st.E.toExponential(2)} &nbsp;·&nbsp; next interval [1 − e<sub>j</sub>, 1 + e<sub>j</sub>] = [${st.nl.toFixed(4)}, ${st.nu.toFixed(4)}]<br><b>${lab(ei)}:</b> ${k2 ?? '—'} iterations reach e ≤ 10<sup>-2</sup>, ${k3 ?? '—'} reach 10<sup>-3</sup>; the ratio improves by about ×4 per iteration while it is small, then the error collapses.`;
    }
    draw();
  }

  // =====================================================================================
  // Figure 3: Polar Express response P(x) for [ell, 1] at depth K, over a real spectrum
  // =====================================================================================
  function spectrumStep(sig, lo = -6, w = 0.125) {
    const n = Math.round(-lo / w), cnt = new Array(n).fill(0);
    for (const s of sig) { const b = Math.floor((Math.log10(Math.max(s, Math.pow(10, lo) * 1.0000001)) - lo) / w); if (b >= 0 && b < n) cnt[b]++; }
    const x = [], y = [];
    for (let i = 0; i < n; i++) { const v = cnt[i] / sig.length / w; x.push(Math.pow(10, lo + i * w)); y.push(v); x.push(Math.pow(10, lo + (i + 1) * w)); y.push(v); }
    return { x, y };
  }
  function fig3() {
    const ctrl = $('f3-ctrl'), plot = $('f3-plot');
    let ell = 1e-5, K = 10, fam = 'q';
    slider(group(ctrl, 'design lower endpoint'), D.ells, 0, v => 'ρ = ' + fmtE(v).replace(/\^(-?\d+)/, (m, e) => [...e].map(c => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('')), v => { ell = v; draw(); });
    slider(group(ctrl, 'iterations K'), D.Ks, 6, v => 'K = ' + v, v => { K = v; draw(); });
    famPills(group(ctrl, 'spectrum'), fam, v => { fam = v; draw(); });
    function draw() {
      const P = D.response[`${D.ells.indexOf(ell)}|${K}`]; const e = ex(fam); const h = spectrumStep(e.sigma);
      const lt = logTicks(-6, 0);
      const traces = [
        { x: h.x, y: h.y, mode: 'lines', fill: 'tozeroy', fillcolor: hex2rgba(C.est, 0.28), line: { color: C.est, width: 1.2 }, yaxis: 'y2', name: `spectrum of ${e.label} (density in log<sub>10</sub>σ)`, hovertemplate: 'σ ≈ %{x:.1e}<br>density %{y:.2f}<extra></extra>' },
        { x: D.xgrid, y: P, mode: 'lines', line: { color: C.meas, width: 2.4 }, name: `P(x): PE[ρ, 1], K=${K}`, hovertemplate: 'x=%{x:.2e}<br>P(x)=%{y:.3f}<extra></extra>' },
      ];
      Plotly.react(plot, traces, layout({
        height: 390, margin: { l: 56, r: 56, t: 30, b: 48 },
        xaxis: { type: 'log', title: 'singular value x = σ/‖M‖<sub>F</sub>', range: [-6, 0.02], tickvals: lt.tickvals, ticktext: lt.ticktext },
        yaxis: { title: 'response P(x)', range: [-0.08, 1.55] },
        yaxis2: { overlaying: 'y', side: 'right', title: 'density of the spectrum', range: [0, 1.6], showgrid: false, zeroline: false, linecolor: '#d5dae0' },
        shapes: [{ type: 'rect', x0: -6, x1: Math.log10(ell), y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'rgba(0,0,0,0.05)', line: { width: 0 } },
                 { type: 'line', x0: -6, x1: 0, y0: 1, y1: 1, xref: 'x', yref: 'y', line: { color: C.gray, dash: 'dot', width: 1 } }],
        annotations: [{ x: Math.log10(ell) - 0.05, y: 1.42, xref: 'x', yref: 'y', text: 'below ρ: outside the design interval', showarrow: false, xanchor: 'right', font: { size: 11, color: C.gray } }],
        showlegend: true,
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 4: the loop as a sensor — the algorithm on the left, the numbers it gives away on the right
  // =====================================================================================
  function fig4() {
    const ctrl = $('f4-ctrl'), plot = $('f4-plot'), algo = $('f4-algo');
    let fam = 'q', j = 0; const K = 10;
    famPills(group(ctrl, 'matrix'), fam, v => { fam = v; draw(); });
    const sg = group(ctrl, 'iteration');
    const sl = slider(sg, [...Array(K + 1).keys()], 0, v => v < K ? 'j = ' + v : 'done', v => { j = v; draw(); });
    player(sg, () => { const nj = j >= K ? 0 : j + 1; sl.set(nj); return nj < K; }, 900);
    const g = (v) => v === null || v === undefined ? '' : (v >= 0.01 ? v.toFixed(4) : v.toExponential(2));
    function algoHTML(e) {
      const m = (p, s) => { const i = e.ynames.indexOf(`j${s}_m${p}`); return i >= 0 ? e.y[i] : null; };
      const cf = e.coeffs[Math.min(j, K - 1)]; const inLoop = j < K;
      const L = (cls, html, n) => `<div class="ln ${cls}"><span class="n">${n || ''}</span><span>${html}</span></div>`;
      return `<div class="t">Measurement pass — ${e.label}, layer 5, step 16k</div>` +
        L('', 'X<sub>0</sub> = M / (s‖M‖<sub>F</sub>)', 1) +
        L('', `<span class="k">for</span> j = 0 … ${K - 1}: <span class="dim">(now j = ${Math.min(j, K - 1)}${inLoop ? '' : ', finished'})</span>`, 2) +
        L(inLoop ? 'hl' : '', `<span class="i1">A<sub>j</sub> = X<sub>j</sub>X<sub>j</sub><sup>⊤</sup> <span class="dim">matmul</span></span>`, 3) +
        L(inLoop ? 'hl' : '', `<span class="i1">B<sub>j</sub> = A<sub>j</sub><sup>2</sup> <span class="dim">matmul</span></span>`, 4) +
        L(inLoop ? 'hl tap' : '', `<span class="i1"><span class="k">read</span> tr A<sub>j</sub> / r = <span class="v">${g(m(2, j))}</span> <span class="dim">(m<sub>2,j</sub>)</span></span>`, 5) +
        L(inLoop ? 'hl tap' : '', `<span class="i1"><span class="k">read</span> ‖A<sub>j</sub>‖<sub>F</sub><sup>2</sup> / r = <span class="v">${g(m(4, j))}</span> <span class="dim">(m<sub>4,j</sub>)</span></span>`, 6) +
        L(inLoop ? 'hl tap' : '', `<span class="i1"><span class="k">read</span> ⟨A<sub>j</sub>, B<sub>j</sub>⟩<sub>F</sub> / r = <span class="v">${g(m(6, j))}</span> <span class="dim">(m<sub>6,j</sub>)</span></span>`, 7) +
        L(inLoop ? 'hl tap' : '', `<span class="i1"><span class="k">read</span> ‖B<sub>j</sub>‖<sub>F</sub><sup>2</sup> / r = <span class="v">${g(m(8, j))}</span> <span class="dim">(m<sub>8,j</sub>)</span></span>`, 8) +
        L(inLoop ? 'hl' : '', `<span class="i1">X<sub>j+1</sub> = a<sub>j</sub>X<sub>j</sub> + b<sub>j</sub>A<sub>j</sub>X<sub>j</sub> + c<sub>j</sub>B<sub>j</sub>X<sub>j</sub> <span class="dim">matmul</span></span>`, 9) +
        L('', `<span class="i2 dim">a<sub>j</sub> = ${cf[0].toFixed(3)}, b<sub>j</sub> = ${cf[1].toFixed(3)}, c<sub>j</sub> = ${cf[2].toFixed(3)}</span>`, '') +
        L(inLoop ? '' : 'hl tap', `<span class="k">read</span> ‖X<sub>K</sub>‖<sub>F</sub><sup>2</sup> / r = <span class="v">${inLoop ? '' : g(m(2, K))}</span>`, 10) +
        `<div class="cnt">extra matrix products: <b>0</b></div>`;
    }
    function draw() {
      const e = ex(fam); algo.innerHTML = algoHTML(e);
      const hist = e.stage_hist[Math.min(j, K)]; const sh = stepXY(e.stage_hist_x, hist, 0.125);
      // zoom: drop the lowest 2% of the mass (the tail below the floor never moves) and follow the rest
      let cum = 0, lo = 0, hi = 0; for (let i = 0; i < hist.length; i++) { cum += hist[i] * 0.125; if (cum < 0.02) lo = i; if (hist[i] > 0) hi = i; }
      const xr = [Math.max(-6.1, Math.log10(e.stage_hist_x[lo]) - 0.25), Math.min(0.42, Math.log10(e.stage_hist_x[hi]) + 0.2)];
      const cand = (xr[1] - xr[0] > 2.2) ? [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1, 2] : [0.01, 0.03, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2]; const tv = cand.filter(v => Math.log10(v) >= xr[0] && Math.log10(v) <= xr[1]);
      const tt = tv.map(v => v >= 0.01 && v < 1 ? String(v) : (v >= 1 ? String(v) : '10<sup>' + Math.round(Math.log10(v)) + '</sup>'));
      const traces = [
        { x: sh.x, y: sh.y, mode: 'lines', fill: 'tozeroy', fillcolor: hex2rgba(C.meas, 0.25), line: { color: C.meas, width: 1.3 }, name: `singular values of X<sub>${Math.min(j, K)}</sub> (density in log<sub>10</sub>)`, xaxis: 'x', yaxis: 'y', hovertemplate: 'z ≈ %{x:.1e}<br>density %{y:.2f}<extra></extra>' },
      ];
      const kc = { 2: C.est, 4: C.orc, 6: C.meas, 8: C.van }; const nm = { 2: 'm<sub>2</sub> = tr A<sub>j</sub>/r', 4: 'm<sub>4</sub> = ‖A<sub>j</sub>‖²/r', 6: 'm<sub>6</sub> = ⟨A<sub>j</sub>,B<sub>j</sub>⟩/r', 8: 'm<sub>8</sub> = ‖B<sub>j</sub>‖²/r' };
      for (const p of [2, 4, 6, 8]) {
        const xs = [], ys = [], xf = [], yf = [];
        for (let s = 0; s <= K; s++) { const i = e.ynames.indexOf(`j${s}_m${p}`); if (i < 0) continue; const v = Math.max(e.y[i], 1e-5); if (s <= j) { xs.push(s); ys.push(v); } else { xf.push(s); yf.push(v); } }
        traces.push({ x: xs, y: ys, mode: 'lines+markers', line: { color: kc[p], width: 2 }, marker: { size: 6 }, name: nm[p], xaxis: 'x2', yaxis: 'y2', hovertemplate: `iteration %{x}<br>${nm[p]} = %{y:.3g}<extra></extra>` });
        traces.push({ x: xf, y: yf, mode: 'markers', marker: { size: 5, color: '#e4e7ea' }, showlegend: false, hoverinfo: 'skip', xaxis: 'x2', yaxis: 'y2' });
      }
      const lt = logTicks(-6, 0);
      Plotly.react(plot, traces, layout({
        height: 490, margin: { l: 56, r: 18, t: 34, b: 70 },
        xaxis: { type: 'log', title: 'singular value of the current iterate', tickvals: tv, ticktext: tt, range: xr, anchor: 'y' },
        yaxis: { title: 'density', rangemode: 'tozero', domain: [0.66, 1] },
        xaxis2: { title: 'iteration j', dtick: 1, range: [-0.4, 10.4], anchor: 'y2' },
        yaxis2: { type: 'log', title: 'measurement', range: [-5.1, 1.75], tickvals: LOGY5.tickvals.concat([10]), ticktext: LOGY5.ticktext.concat(['10']), domain: [0, 0.38] },
        shapes: [{ type: 'line', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0.66, y1: 1, line: { color: C.gray, dash: 'dot', width: 1 } },
                 { type: 'line', xref: 'x2', yref: 'y2', x0: Math.min(j, K) + 0.5, x1: Math.min(j, K) + 0.5, y0: -5.1, y1: 1.75, line: { color: C.meas, dash: 'dot', width: 1 } }],
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.05, text: `<b>the iterate</b> after iteration ${Math.min(j, K)}`, showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0, y: 0.415, text: '<b>the moments</b>, read as the iteration runs', showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'x', yref: 'paper', x: 0, y: 0.99, text: '1', showarrow: false, xanchor: 'left', xshift: 4, font: { size: 10.5, color: C.gray } }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 11 } },
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 5: the entropy tie-break — what the slack eta does to the fit
  // =====================================================================================
  function fig5() {
    const ctrl = $('f5-ctrl'), plot = $('f5-plot'), mini = $('f5-mini');
    let fam = 'q', si = 4;
    famPills(group(ctrl, 'matrix'), fam, v => { fam = v; draw(); });
    const labels = ex('q').eta_sweep.map(s => s.eta === null ? 'best fit only' : (s.eta === 0 ? 'κ = 0' : 'κ = ' + s.eta.toExponential(0).replace('e-', 'e-')));
    slider(group(ctrl, 'entropy tolerance'), labels, si, v => v, (v, i) => { si = i; draw(); });
    function draw() {
      const e = ex(fam); const S = e.eta_sweep; const cur = S[si]; const lt = logTicks(-5, 0);
      const traces = [
        { x: e.dens_x, y: e.dens_true, mode: 'lines', line: { color: C.truth, width: 2, shape: 'hvh' }, name: 'SVD (evaluation only)', xaxis: 'x', yaxis: 'y', hovertemplate: 'σ≈%{x:.1e}<br>%{y:.2f}<extra>SVD</extra>' },
        { x: e.dens_x, y: cur.dens, mode: 'lines', line: { color: C.est, width: 2, shape: 'hvh' }, name: `fit: ${labels[si]}`, xaxis: 'x', yaxis: 'y', hovertemplate: 'σ≈%{x:.1e}<br>%{y:.2f}<extra>fit</extra>' },
        { x: S.map(s => Math.max(s.mismatch, 1e-7)), y: S.map(s => s.entropy), mode: 'lines+markers', line: { color: C.gray, width: 1.2 }, marker: { size: 7, color: '#fff', line: { color: C.truth, width: 1.4 } }, text: labels, name: 'one fit per κ', xaxis: 'x2', yaxis: 'y2', hovertemplate: '%{text}<br>residual %{x:.2e}<br>entropy %{y:.3f}<extra></extra>' },
        { x: [Math.max(cur.mismatch, 1e-7)], y: [cur.entropy], mode: 'markers', marker: { size: 13, color: C.meas, line: { color: '#fff', width: 1.5 } }, name: 'current', xaxis: 'x2', yaxis: 'y2', hoverinfo: 'skip' },
      ];
      const dflt = S.findIndex(s => s.eta === 3e-4);
      Plotly.react(plot, traces, layout({
        height: 360, margin: { l: 56, r: 18, t: 44, b: 60 }, grid: { rows: 1, columns: 2, pattern: 'independent', xgap: 0.16 },
        xaxis: { type: 'log', title: 'σ/‖M‖<sub>F</sub>', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5, 0] },
        yaxis: { title: 'density in log<sub>10</sub>σ', rangemode: 'tozero' },
        xaxis2: { type: 'log', title: 'residual ‖D(Φw − ŷ)‖<sub>2</sub>', range: [-6.3, -1.3], tickvals: [1e-6, 1e-5, 1e-4, 1e-3, 1e-2], ticktext: ['10<sup>-6</sup>', '10<sup>-5</sup>', '10<sup>-4</sup>', '10<sup>-3</sup>', '10<sup>-2</sup>'] },
        yaxis2: { title: 'entropy of the fit' },
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.1, text: `<b>the fitted spectrum</b> — ${e.label}, layer 5, step 16k`, showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0.58, y: 1.1, text: '<b>residual against entropy</b>', showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'x2', yref: 'y2', x: Math.log10(S[dflt].mismatch), y: S[dflt].entropy, text: 'default κ', showarrow: true, arrowhead: 0, ax: 0, ay: 28, font: { size: 10.5, color: C.gray }, arrowcolor: C.gray }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.26, font: { size: 11.5 } },
      }), CFG);
      const bt = e.bands_true_sigma; const f = v => v.toFixed(3);
      mini.innerHTML = `${labels[si]} &nbsp;·&nbsp; residual <b>${cur.mismatch.toExponential(2)}</b>, entropy <b>${cur.entropy.toFixed(3)}</b> &nbsp;·&nbsp; band masses SVD / fit: [1e-5,1e-4) <b>${f(bt[0])}</b> / <b>${f(cur.bands[0])}</b>, [1e-4,1e-3) <b>${f(bt[1])}</b> / <b>${f(cur.bands[1])}</b>, [1e-3,1e-2) <b>${f(bt[2])}</b> / <b>${f(cur.bands[2])}</b> &nbsp;·&nbsp; mass below the cutoff <b>${f(cur.nuis)}</b>`;
    }
    draw();
  }

  // =====================================================================================
  // Figure 6: the estimate — density and conditional CDF with the guaranteed range (report layout)
  // =====================================================================================
  function fig6() {
    const ctrl = $('f6-ctrl'), plot = $('f6-plot'), mini = $('f6-mini');
    let fam = 'q', J = 10;
    famPills(group(ctrl, 'matrix'), fam, v => { fam = v; draw(); });
    // fit from only the first J iterations of the measurement pass: fewer moments, coarser fit
    const JS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    slider(group(ctrl, 'measured iterations'), JS, JS.length - 1, v => v + ' of 10', v => { J = v; draw(); });
    function draw() {
      const e = ex(fam); const lt = logTicks(-5, 0);
      const F = J === 10 ? { dens: e.dens_est, cdf_est_x: e.cdf_est_x, cdf_est_y: e.cdf_est_y, cdf_lo: e.cdf_lo, cdf_hi: e.cdf_hi, bands: e.bands.est, res: e.res_est } : e.by_stages[String(J)];
      const traces = [
        { x: e.dens_x, y: e.dens_true, mode: 'lines', line: { color: C.truth, width: 2, shape: 'hvh' }, name: 'SVD (evaluation only)', xaxis: 'x', yaxis: 'y', hovertemplate: 'σ≈%{x:.1e}<br>density %{y:.2f}<extra>SVD</extra>' },
        { x: e.dens_x, y: F.dens, mode: 'lines', line: { color: C.est, width: 2, shape: 'hvh' }, name: 'maximum-entropy moment fit', xaxis: 'x', yaxis: 'y', hovertemplate: 'σ≈%{x:.1e}<br>density %{y:.2f}<extra>fit</extra>' },
        { x: e.cdf_pts.concat([...e.cdf_pts].reverse()), y: F.cdf_hi.concat([...F.cdf_lo].reverse()), fill: 'toself', fillcolor: C.band, line: { width: 0 }, name: 'guaranteed range (all spectra consistent with the moments)', xaxis: 'x2', yaxis: 'y2', hoverinfo: 'skip' },
        { x: e.cdf_pts, y: e.cdf_true, mode: 'lines', line: { color: C.truth, width: 2 }, showlegend: false, xaxis: 'x2', yaxis: 'y2', hovertemplate: 't=%{x:.1e}<br>F=%{y:.3f}<extra>SVD</extra>' },
        { x: F.cdf_est_x, y: F.cdf_est_y, mode: 'lines', line: { color: C.est, width: 2, shape: 'hv' }, showlegend: false, xaxis: 'x2', yaxis: 'y2', hovertemplate: 't=%{x:.1e}<br>F=%{y:.3f}<extra>fit</extra>' },
      ];
      Plotly.react(plot, traces, layout({
        height: 380, margin: { l: 56, r: 18, t: 44, b: 66 }, grid: { rows: 1, columns: 2, pattern: 'independent', xgap: 0.16 },
        xaxis: { type: 'log', title: 'σ/‖M‖<sub>F</sub>', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5, 0] },
        yaxis: { title: 'density in log<sub>10</sub>σ', rangemode: 'tozero' },
        xaxis2: { type: 'log', title: 'σ/‖M‖<sub>F</sub>', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5, 0] },
        yaxis2: { title: 'CDF above 10<sup>-5</sup>', range: [-0.02, 1.02] },
        shapes: [1e-4, 1e-3].map(v => ({ type: 'line', xref: 'x2', yref: 'paper', x0: Math.log10(v), x1: Math.log10(v), y0: 0, y1: 1, line: { color: '#b9c2cc', dash: 'dot', width: 1 } })),
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.1, text: `<b>density</b> — ${e.label}, layer 5, step 16k`, showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0.58, y: 1.1, text: '<b>CDF</b> above the scoring cutoff', showarrow: false, xanchor: 'left', font: { size: 12.5 } }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.28, font: { size: 11.5 } },
      }), CFG);
      const b = e.bands; const f = v => v.toFixed(3);
      if (J === 10) mini.innerHTML = `band mass, SVD / fit / guaranteed range &nbsp;·&nbsp; [1e-5,1e-4): <b>${f(b.true[0])}</b> / <b>${f(b.est[0])}</b> / [${f(b.lo[0])}, ${f(b.hi[0])}] &nbsp;·&nbsp; [1e-4,1e-3): <b>${f(b.true[1])}</b> / <b>${f(b.est[1])}</b> / [${f(b.lo[1])}, ${f(b.hi[1])}] &nbsp;·&nbsp; [1e-3,1e-2): <b>${f(b.true[2])}</b> / <b>${f(b.est[2])}</b> / [${f(b.lo[2])}, ${f(b.hi[2])}] &nbsp;·&nbsp; above 1e-5: <b>${f(e.res_true)}</b> / <b>${f(e.res_est)}</b>`;
      else mini.innerHTML = `band mass, SVD / fit &nbsp;·&nbsp; [1e-5,1e-4): <b>${f(b.true[0])}</b> / <b>${f(F.bands[0])}</b> &nbsp;·&nbsp; [1e-4,1e-3): <b>${f(b.true[1])}</b> / <b>${f(F.bands[1])}</b> &nbsp;·&nbsp; [1e-3,1e-2): <b>${f(b.true[2])}</b> / <b>${f(F.bands[2])}</b> &nbsp;·&nbsp; above 1e-5: <b>${f(e.res_true)}</b> / <b>${f(F.res)}</b>`;
    }
    draw();
  }

  // =====================================================================================
  // Figure 7: the dictionary — predicted error of every candidate (ρ, K), and one depth in detail
  // =====================================================================================
  function fig7() {
    const ctrl = $('f7-ctrl'), plot = $('f7-plot');
    let fam = 'q', K = 8;
    famPills(group(ctrl, 'matrix'), fam, v => { fam = v; draw(); });
    slider(group(ctrl, 'iterations'), D.Ks, D.Ks.indexOf(8), v => 'K = ' + v, v => { K = v; draw(); });
    let tau = 0.01;
    pills(group(ctrl, 'target rule'), [[0.1, 'τ = 0.1'], [0.01, 'τ = 0.01'], [0.001, 'τ = 0.001']], tau, v => { tau = +v; draw(); });
    function draw() {
      const e = ex(fam); const rho = D.ratio_grid; const Ks = D.Ks;
      const z = Ks.map(k => { const s = e.scores[String(k)]; return s.pred.map((v, i) => s.valid[i] ? Math.log10(Math.max(v, 1e-4)) : null); });
      const estX = Ks.map(k => e.scores[String(k)].rho_est), orcX = Ks.map(k => e.scores[String(k)].rho_orc);
      const s = e.scores[String(K)]; const valid = (a) => a.map((v, i) => s.valid[i] ? Math.max(v, 1e-4) : null);
      const ie = rho.indexOf(s.rho_est), io = rho.indexOf(s.rho_orc);
      // target rule: the shallowest depth whose best predicted error meets tau
      let tgt = null;
      for (const k of Ks) { const sc = e.scores[String(k)]; let bi = -1, bv = Infinity; sc.pred.forEach((v, i) => { if (sc.valid[i] && v < bv) { bv = v; bi = i; } }); if (bi >= 0 && bv <= tau) { tgt = { K: k, rho: rho[bi] }; break; } }
      const traces = [
        { type: 'heatmap', x: rho, y: Ks, z, xaxis: 'x', yaxis: 'y', colorscale: [[0, '#1f4e8c'], [0.35, '#7fb3e0'], [0.65, '#f4e6c8'], [1, '#c8453d']], zmin: -4, zmax: 0, showscale: true, colorbar: { title: { text: 'predicted', side: 'top', font: { size: 11 } }, tickvals: [-4, -3, -2, -1, 0], ticktext: ['10⁻⁴', '10⁻³', '10⁻²', '10⁻¹', '1'], thickness: 9, len: 0.82, x: 0.455, xanchor: 'left', y: 0.5, tickfont: { size: 10.5 } }, hovertemplate: 'ρ=%{x:.2e}, K=%{y}<br>predicted error 10^%{z:.2f}<extra></extra>' },
        { x: orcX, y: Ks, mode: 'markers', marker: { color: C.orc, size: 15, symbol: 'star', line: { color: '#fff', width: 1 } }, name: 'RMS oracle, fixed depth', xaxis: 'x', yaxis: 'y', hoverinfo: 'skip' },
        { x: estX, y: Ks, mode: 'markers', marker: { color: C.meas, size: 7, line: { color: '#fff', width: 1.2 } }, name: 'ours, fixed-depth rule', xaxis: 'x', yaxis: 'y', hoverinfo: 'skip' },
        { x: rho, y: valid(s.true), mode: 'lines+markers', line: { color: C.truth, width: 2 }, marker: { size: 4 }, name: 'true RMS error (SVD)', xaxis: 'x2', yaxis: 'y2', hovertemplate: 'ρ=%{x:.2e}<br>E=%{y:.4f}<extra>true</extra>' },
        { x: rho, y: valid(s.pred), mode: 'lines+markers', line: { color: C.est, width: 2, dash: 'dash' }, marker: { size: 4 }, name: 'predicted from the fit', xaxis: 'x2', yaxis: 'y2', hovertemplate: 'ρ=%{x:.2e}<br>Ê=%{y:.4f}<extra>predicted</extra>' },
        { x: [s.rho_orc], y: [Math.max(s.true[io], 1e-4)], mode: 'markers', marker: { color: C.orc, size: 17, symbol: 'star', line: { color: '#fff', width: 1 } }, showlegend: false, xaxis: 'x2', yaxis: 'y2', hoverinfo: 'skip' },
        { x: [s.rho_est], y: [Math.max(s.true[ie], 1e-4)], mode: 'markers', marker: { color: C.meas, size: 8, line: { color: '#fff', width: 1.2 } }, showlegend: false, xaxis: 'x2', yaxis: 'y2', hoverinfo: 'skip' },
      ];
      if (tgt) traces.push({ x: [tgt.rho], y: [tgt.K], mode: 'markers', marker: { color: C.truth, size: 19, symbol: 'square-open', line: { width: 2 } }, name: `ours, target rule (τ = ${tau})`, xaxis: 'x', yaxis: 'y', hoverinfo: 'skip' });
      const lt = logTicks(-5, -1);
      Plotly.react(plot, traces, layout({
        height: 400, margin: { l: 56, r: 18, t: 44, b: 66 },
        xaxis: { type: 'log', title: 'design lower endpoint ρ', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5.05, -0.95], domain: [0, 0.43] },
        yaxis: { title: 'iterations K', dtick: 1, range: [3.5, 10.5] },
        xaxis2: { type: 'log', title: 'design lower endpoint ρ', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5.05, -0.95], domain: [0.6, 1] },
        yaxis2: { type: 'log', title: 'RMS error', range: [-4.05, 0.2], tickvals: LOGY4.tickvals, ticktext: LOGY4.ticktext, anchor: 'x2' },
        shapes: [{ type: 'rect', xref: 'x', yref: 'y', x0: -5.05, x1: -0.95, y0: K - 0.5, y1: K + 0.5, line: { color: C.meas, width: 2 }, fillcolor: 'rgba(0,0,0,0)' }],
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.1, text: `<b>every candidate</b> — ${e.label}, layer 5, step 16k`, showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0.6, y: 1.1, text: `<b>K = ${K}</b>, predicted vs true`, showarrow: false, xanchor: 'left', font: { size: 12.5 } }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.26, font: { size: 11.5 } },
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 8: one routine per operator type — the two selection rules on the 12 layers of a type
  // =====================================================================================
  function fig8() {
    const ctrl = $('f8-ctrl'), plot = $('f8-plot'), mini = $('f8-mini');
    let fam = 'mlp_up', K = 5, tau = 0.1, mode = 'fixed';
    famPills(group(ctrl, 'operator type'), fam, v => { fam = v; if (mode === 'target') applyTarget(); draw(); });
    const kp = pills(group(ctrl, 'rule 1: fixed depth'), [4, 5, 6, 7, 8, 9, 10].map(k => [k, 'K = ' + k]), K, v => { K = +v; mode = 'fixed'; tp.set('none'); draw(); });
    const tp = pills(group(ctrl, 'rule 2: target accuracy'), [[0.1, 'τ = 0.1'], [0.01, 'τ = 0.01'], [0.001, 'τ = 0.001']], 'none', v => { tau = +v; mode = 'target'; applyTarget(); draw(); });
    const meanSq = (rows) => rows[0].map((_, i) => { let s = 0, n = 0; for (const r of rows) { if (r[i] === null) return null; s += r[i]; n++; } return s / n; });
    const maxSq = (rows) => rows[0].map((_, i) => { let m = 0; for (const r of rows) { if (r[i] === null) return null; m = Math.max(m, r[i]); } return m; });
    const argmin = (a) => { let bi = -1, bv = Infinity; a.forEach((v, i) => { if (v !== null && v < bv) { bv = v; bi = i; } }); return bi; };
    function targetRule(useTrue) {
      for (const k of D.Ks) { const P = D.pertype[fam][String(k)][useTrue ? 'true' : 'pred']; const mx = maxSq(P); const i = argmin(mx); if (i >= 0 && mx[i] <= tau * tau) return { K: k, rho: D.ratio_grid[i], i, worst: Math.sqrt(mx[i]) }; }
      return null;
    }
    function applyTarget() { const r = targetRule(false); K = r ? r.K : 10; kp.set(K); }
    function draw() {
      const rho = D.ratio_grid; const P = D.pertype[fam][String(K)]; const sq = v => v === null ? null : Math.max(Math.sqrt(v), 1e-4);
      const traces = [];
      P.pred.forEach((row, l) => traces.push({ x: rho, y: row.map(sq), mode: 'lines', line: { color: hex2rgba(C.est, 0.28), width: 1 }, name: 'one layer, predicted', showlegend: l === 0, legendgroup: 'layers', hovertemplate: `layer ${l}<br>ρ=%{x:.2e}<br>Ê=%{y:.4f}<extra></extra>` }));
      const obj = meanSq(P.pred), objT = meanSq(P.true); const ie = argmin(obj), io = argmin(objT);
      traces.push({ x: rho, y: obj.map(sq), mode: 'lines', line: { color: C.est, width: 3 }, name: 'type score (rule 1 minimises this)', hovertemplate: 'ρ=%{x:.2e}<br>%{y:.4f}<extra>type score</extra>' });
      traces.push({ x: rho, y: objT.map(sq), mode: 'lines', line: { color: C.truth, width: 2, dash: 'dot' }, name: 'type score with the true errors', hovertemplate: 'ρ=%{x:.2e}<br>%{y:.4f}<extra>true</extra>' });
      const shapes = [], ann = [];
      let title = `${FAMLABEL[fam]}, all 12 layers at step 16k — rule 1, fixed depth K = ${K}`;
      if (mode === 'fixed') {
        traces.push({ x: [rho[ie]], y: [sq(obj[ie])], mode: 'markers', marker: { color: C.meas, size: 13, line: { color: '#fff', width: 1.5 } }, name: 'ρ*<sub>g</sub> chosen by rule 1', hoverinfo: 'skip' });
        traces.push({ x: [rho[io]], y: [sq(objT[io])], mode: 'markers', marker: { color: C.orc, size: 15, symbol: 'star', line: { color: '#fff', width: 1 } }, name: 'oracle\'s ρ for the type', hoverinfo: 'skip' });
      } else {
        const mx = maxSq(P.pred); const r = targetRule(false);
        traces.push({ x: rho, y: mx.map(sq), mode: 'lines', line: { color: C.meas, width: 2.4, dash: 'dash' }, name: 'worst layer, predicted (rule 2 bounds this by τ)', hovertemplate: 'ρ=%{x:.2e}<br>worst layer %{y:.4f}<extra></extra>' });
        shapes.push({ type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: Math.log10(tau), y1: Math.log10(tau), line: { color: C.meas, width: 1.2, dash: 'dot' } });
        ann.push({ xref: 'paper', yref: 'y', x: 0.01, y: Math.log10(tau), text: `target τ = ${tau}`, showarrow: false, xanchor: 'left', yshift: 9, font: { size: 11, color: C.meas } });
        if (r && r.K === K) traces.push({ x: [r.rho], y: [Math.max(r.worst, 1e-4)], mode: 'markers', marker: { color: C.meas, size: 13, line: { color: '#fff', width: 1.5 } }, name: `(ρ*<sub>g</sub>, K*<sub>g</sub>) chosen by rule 2`, hoverinfo: 'skip' });
        title = r ? `${FAMLABEL[fam]}, all 12 layers at step 16k — rule 2, τ = ${tau} → shallowest depth whose worst layer stays below τ: K*<sub>g</sub> = ${r.K}` : `${FAMLABEL[fam]} — rule 2, τ = ${tau}: no candidate reaches the target, fall back to the safe routine (K = 10)`;
      }
      const lt = logTicks(-5, -1);
      Plotly.react(plot, traces, layout({
        height: 400, margin: { l: 60, r: 18, t: 36, b: 66 },
        title: { text: title, font: { size: 13 }, x: 0, xanchor: 'left' },
        xaxis: { type: 'log', title: 'design lower endpoint ρ', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5.05, -0.95] },
        yaxis: { type: 'log', title: 'RMS error', range: [-4.05, 0.2], tickvals: LOGY4.tickvals, ticktext: LOGY4.ticktext },
        shapes, annotations: ann,
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.26, font: { size: 11.5 } },
      }), CFG);
      const r = targetRule(false), ro = targetRule(true);
      const f = (x) => x ? `K*<sub>g</sub> = ${x.K}, ρ*<sub>g</sub> = ${fmtEh(x.rho)} (worst predicted layer ${x.worst.toFixed(4)})` : 'no candidate reaches the target, safe routine';
      mini.innerHTML = `<b>rule 1 at K = ${K}:</b> ρ*<sub>g</sub> = ${fmtEh(rho[ie])} (oracle ${fmtEh(rho[io])}) &nbsp;·&nbsp; <b>rule 2 at τ = ${tau}:</b> ${f(r)}${ro ? `; with the true errors K = ${ro.K}, ρ = ${fmtEh(ro.rho)}` : ''}`;
    }
    draw();
  }

  // =====================================================================================
  // Figure 11: Algorithm 1 in action on the saved run
  // =====================================================================================
  function fig11() {
    const ctrl = $('f11-ctrl'), plot = $('f11-plot'), mini = $('f11-mini');
    const TL = D.timeline; const steps = TL.steps; const fams = TL.fams; const rho = D.ratio_grid;
    let mode = 'target', K = 6, tau = 0.1, T = 2000, si = 0;
    const kp = pills(group(ctrl, 'rule 1: fixed depth'), [5, 6, 7, 8, 9].map(k => [k, 'K = ' + k]), 'none', v => { K = +v; mode = 'fixed'; tp.set('none'); draw(); });
    const tp = pills(group(ctrl, 'rule 2: target accuracy'), [[0.1, 'τ = 0.1'], [0.01, 'τ = 0.01'], [0.001, 'τ = 0.001']], tau, v => { tau = +v; mode = 'target'; kp.set('none'); draw(); });
    pills(group(ctrl, 'measure every'), [[2000, '2k steps'], [4000, '4k steps'], [8000, '8k steps']], T, v => { T = +v; draw(); });
    const sg = group(ctrl, 'training step');
    const sl = slider(sg, steps, 0, v => `step ${v / 1000}k`, (v, i) => { si = i; draw(); });
    player(sg, () => { const n = si >= steps.length - 1 ? 0 : si + 1; sl.set(n); return n < steps.length - 1; }, 800);
    const argmin = (a) => { let bi = -1, bv = Infinity; a.forEach((v, i) => { if (v !== null && v < bv) { bv = v; bi = i; } }); return bi; };
    function select(step, fam) {
      const d = TL.data[String(step)][fam];
      if (mode === 'fixed') { const i = argmin(d[String(K)].pm); return { K, i, rho: rho[i], pred: d[String(K)].pm[i] }; }
      for (const k of D.Ks) { const px = d[String(k)].px; const i = argmin(px); if (i >= 0 && px[i] <= tau * tau) return { K: k, i, rho: rho[i], pred: d[String(k)].pm[i] }; }
      const i = argmin(d['10'].pm); return { K: 10, i, rho: rho[i], pred: d['10'].pm[i], fallback: true };
    }
    const GROUPS = { attention: ['q', 'k', 'v', 'o'], mlp: ['mlp_up', 'mlp_gate', 'mlp_down'] };
    function simulate() {
      const cSafe = {}; for (const g of Object.keys(GROUPS)) cSafe[g] = GROUPS[g].reduce((a, f) => a + 12 * TL.cost_unit[f] * 10, 0); cSafe.all = cSafe.attention + cSafe.mlp;
      const rows = []; let last = null; const cum = { attention: 0, mlp: 0, all: 0 };
      steps.forEach((st, ti) => {
        const meas = ((st - steps[0]) % T) === 0;
        if (meas) last = Object.fromEntries(fams.map(f => [f, select(st, f)]));
        const per = {}; const acc = { attention: { s: 0, o: 0, v: 0, c: 0, n: 0 }, mlp: { s: 0, o: 0, v: 0, c: 0, n: 0 } };
        for (const g of Object.keys(GROUPS)) for (const f of GROUPS[g]) {
          const sel = last[f]; const d = TL.data[String(st)][f][String(sel.K)]; const io = argmin(d.tm);
          per[f] = { K: sel.K, rho: sel.rho, es: d.tm[sel.i], eo: d.tm[io], ev: d.van, pred: sel.pred, fallback: !!sel.fallback };
          const a = acc[g]; a.s += 12 * d.tm[sel.i]; a.o += 12 * d.tm[io]; a.v += 12 * d.van; a.n += 12;
          a.c += 12 * TL.cost_unit[f] * (meas ? (10 + 1999 * sel.K) / 2000 : sel.K);
        }
        const r = { step: st, meas, per, err: {}, cost: {}, cum: {} };
        for (const g of Object.keys(GROUPS)) { const a = acc[g]; r.err[g] = { s: Math.sqrt(a.s / a.n), o: Math.sqrt(a.o / a.n), v: Math.sqrt(a.v / a.n) }; r.cost[g] = a.c / cSafe[g]; }
        r.err.all = { s: Math.sqrt((acc.attention.s + acc.mlp.s) / 84), o: Math.sqrt((acc.attention.o + acc.mlp.o) / 84), v: Math.sqrt((acc.attention.v + acc.mlp.v) / 84) };
        r.cost.all = (acc.attention.c + acc.mlp.c) / cSafe.all;
        for (const g of ['attention', 'mlp', 'all']) { cum[g] = (cum[g] * ti + r.cost[g]) / (ti + 1); r.cum[g] = cum[g]; }
        rows.push(r);
      });
      return rows;
    }
    function draw() {
      const rows = simulate(); const cur = rows[si]; const upto = rows.slice(0, si + 1); const xs = upto.map(r => r.step);
      // top panel: with rule 2 the depth varies, so show the depth; with rule 1 the depth is fixed, so show the realised polar error per type instead
      const fixed = mode === 'fixed';
      const z = fams.map(f => rows.map((r, ti) => ti <= si ? (fixed ? Math.log10(Math.max(Math.sqrt(r.per[f].es), 1e-4)) : r.per[f].K) : null));
      const cd = fams.map(f => rows.map((r, ti) => ti <= si ? [fmtE(r.per[f].rho).replace('10^', 'e'), Math.sqrt(r.per[f].pred).toFixed(4), Math.sqrt(r.per[f].es).toFixed(4), r.per[f].K] : ['', '', '', '']));
      const ylab = fams.map(f => FAMLABEL[f]);
      const GC = { attention: C.est, mlp: C.meas }; const GL = { attention: 'attention', mlp: 'MLP' };
      const heat = fixed
        ? { colorscale: [[0, '#1f4e8c'], [0.35, '#7fb3e0'], [0.65, '#f4e6c8'], [1, '#c8453d']], zmin: -4, zmax: 0, colorbar: { title: { text: 'polar error', side: 'right', font: { size: 11 } }, tickvals: [-4, -3, -2, -1, 0], ticktext: ['10⁻⁴', '10⁻³', '10⁻²', '10⁻¹', '1'], thickness: 8, len: 0.28, y: 0.85, x: 1.0, xanchor: 'left', tickfont: { size: 10.5 } }, hovertemplate: '%{y}, step %{x}<br>realised error %{customdata[2]} at depth K = %{customdata[3]}, ρ = %{customdata[0]}<br>predicted %{customdata[1]}<extra></extra>' }
        : { colorscale: [[0, '#e6eef8'], [1, '#1f4e8c']], zmin: 4, zmax: 10, colorbar: { title: { text: 'depth K', side: 'right', font: { size: 11 } }, tickvals: [4, 6, 8, 10], thickness: 8, len: 0.28, y: 0.85, x: 1.0, xanchor: 'left', tickfont: { size: 10.5 } }, hovertemplate: '%{y}, step %{x}<br>depth K = %{z}, ρ = %{customdata[0]}<br>predicted error %{customdata[1]}, realised %{customdata[2]}<extra></extra>' };
      const traces = [
        Object.assign({ type: 'heatmap', x: steps, y: ylab, z, customdata: cd, xaxis: 'x', yaxis: 'y', xgap: 2, ygap: 2, showscale: true, hoverongaps: false }, heat),
      ];
      for (const g of ['attention', 'mlp']) {
        traces.push({ x: xs, y: upto.map(r => Math.max(r.err[g].v, 1e-5)), mode: 'lines+markers', line: { color: GC[g], width: 1.8, dash: 'dash' }, marker: { size: 6, symbol: 'circle-open', line: { width: 1.5 } }, name: `${GL[g]}: vanilla endpoint at the same depths`, xaxis: 'x2', yaxis: 'y2', hovertemplate: `${GL[g]}, step %{x}<br>%{y:.4f}<extra>vanilla</extra>` });
        traces.push({ x: xs, y: upto.map(r => Math.max(r.err[g].s, 1e-5)), mode: 'lines+markers', line: { color: GC[g], width: 2.6 }, marker: { size: 6 }, name: `${GL[g]}: routines chosen by Algorithm 1`, xaxis: 'x2', yaxis: 'y2', hovertemplate: `${GL[g]}, step %{x}<br>%{y:.4f}<extra>selected</extra>` });
        traces.push({ x: xs, y: upto.map(r => Math.max(r.err[g].o, 1e-5)), mode: 'lines+markers', line: { color: GC[g], width: 1.4, dash: 'dot' }, marker: { size: 7, symbol: 'star' }, name: `${GL[g]}: oracle endpoint at the same depths`, visible: 'legendonly', xaxis: 'x2', yaxis: 'y2', hovertemplate: `${GL[g]}, step %{x}<br>%{y:.4f}<extra>oracle</extra>` });
        traces.push({ x: xs, y: upto.map(r => r.cum[g]), mode: 'lines+markers', line: { color: GC[g], width: 2.6 }, marker: { size: 6 }, name: `${GL[g]}: cumulative cost, relative to the safe routine on the same matrices`, xaxis: 'x3', yaxis: 'y3', hovertemplate: `${GL[g]}, step %{x}<br>%{y:.3f} of safe so far<extra></extra>` });
      }
      traces.push({ x: xs, y: upto.map(r => r.cum.all), mode: 'lines+markers', line: { color: C.truth, width: 1.6 }, marker: { size: 5 }, name: 'all 84 matrices: cumulative cost', xaxis: 'x3', yaxis: 'y3', hovertemplate: 'all, step %{x}<br>%{y:.3f} of safe so far<extra></extra>' });
      const measX = rows.filter((r, ti) => r.meas && ti <= si).map(r => r.step);
      const shapes = measX.map(x => ({ type: 'line', xref: 'x', yref: 'y domain', x0: x, x1: x, y0: -0.12, y1: 1.0, line: { color: C.meas, width: 1.2, dash: 'dot' } }))
        .concat([{ type: 'line', xref: 'x', yref: 'paper', x0: cur.step, x1: cur.step, y0: 0, y1: 1, line: { color: C.meas, width: 1.6 } },
                 { type: 'line', xref: 'x3', yref: 'y3', x0: 1000, x1: 31000, y0: 1, y1: 1, line: { color: C.gray, width: 1, dash: 'dot' } }]);
      const xa = (extra) => Object.assign({ range: [1000, 31000], tickvals: [2000, 6000, 10000, 14000, 18000, 22000, 26000, 30000], ticktext: ['2k', '6k', '10k', '14k', '18k', '22k', '26k', '30k'] }, extra);
      Plotly.react(plot, traces, layout({
        height: 720, margin: { l: 66, r: 60, t: 34, b: 60 },
        xaxis: xa({ anchor: 'y', showticklabels: false }), yaxis: { domain: [0.72, 1], title: '', autorange: 'reversed', tickfont: { size: 11.5 } },
        xaxis2: xa({ anchor: 'y2', showticklabels: false }), yaxis2: { domain: [0.37, 0.62], type: 'log', title: 'realised polar error', range: [-5.05, 0.05], tickvals: LOGY5.tickvals, ticktext: LOGY5.ticktext },
        xaxis3: xa({ anchor: 'y3', title: 'training step' }), yaxis3: { domain: [0, 0.26], title: 'cost of the loop', range: [0, 1.12], tickvals: [0, 0.25, 0.5, 0.75, 1], ticktext: ['0', '0.25', '0.5', '0.75', 'safe'] },
        shapes,
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.04, text: fixed ? `<b>realised polar error per operator type</b> at the fixed depth K = ${K} — violet ticks are measurement steps, measuring every ${T / 1000}k steps` : `<b>which depth runs</b>, per operator type — violet ticks are measurement steps, rule 2 at τ = ${tau}, measuring every ${T / 1000}k steps`, showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0, y: 0.645, text: '<b>realised polar error</b> of the routines in use, attention (48 matrices) and MLP (36) — solid: Algorithm 1, dashed: vanilla at the same depth', showarrow: false, xanchor: 'left', font: { size: 12.5 } },
                      { xref: 'paper', yref: 'paper', x: 0, y: 0.285, text: '<b>cost so far</b> relative to the safe routine, per group, measurement steps included', showarrow: false, xanchor: 'left', font: { size: 12.5 } }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.1, font: { size: 11 } },
      }), CFG);
      const list = fams.map(f => `${FAMLABEL[f]} (${fmtEh(cur.per[f].rho)}, K=${cur.per[f].K})${cur.per[f].fallback ? '*' : ''}`).join(' · ');
      const lastMeas = rows.slice(0, si + 1).filter(r => r.meas).slice(-1)[0];
      mini.innerHTML = cur.meas
        ? `<b>step ${cur.step / 1000}k, measurement step:</b> the safe routine ran on the 84 matrices and sent 41 numbers each to the CPU; the fit and ${mode === 'fixed' ? 'rule 1' : 'rule 2'} chose ${list}${fams.some(f => cur.per[f].fallback) ? ' (* no candidate met τ, safe routine)' : ''}. Realised error, attention <b>${cur.err.attention.s.toFixed(4)}</b> (vanilla ${cur.err.attention.v.toFixed(4)}), MLP <b>${cur.err.mlp.s.toFixed(4)}</b> (vanilla ${cur.err.mlp.v.toFixed(4)}); cost so far attention <b>${cur.cum.attention.toFixed(3)}</b>, MLP <b>${cur.cum.mlp.toFixed(3)}</b>, all <b>${cur.cum.all.toFixed(3)}</b> of safe.`
        : `<b>step ${cur.step / 1000}k, no measurement:</b> the routines chosen at step ${lastMeas.step / 1000}k keep running on the new matrices: ${list}. Realised error, attention <b>${cur.err.attention.s.toFixed(4)}</b> (vanilla ${cur.err.attention.v.toFixed(4)}), MLP <b>${cur.err.mlp.s.toFixed(4)}</b> (vanilla ${cur.err.mlp.v.toFixed(4)}); cost so far attention <b>${cur.cum.attention.toFixed(3)}</b>, MLP <b>${cur.cum.mlp.toFixed(3)}</b>, all <b>${cur.cum.all.toFixed(3)}</b> of safe.`;
    }
    draw();
  }

  // =====================================================================================
  // Figure 9: spectra along training — densities and distribution functions, one slider over the checkpoints
  // =====================================================================================
  function fig9() {
    const ctrl = $('f9-ctrl'), plot = $('f9-plot');
    const steps = D.drift_cdf.steps; let si = 0;
    const panels = ['q', 'k', 'o', 'mlp_up'];
    const sg = group(ctrl, 'training step');
    const sl = slider(sg, steps, 0, v => `step ${v / 1000}k`, (v, i) => { si = i; draw(); });
    player(sg, () => { const n = si >= steps.length - 1 ? 0 : si + 1; sl.set(n); return n < steps.length - 1; }, 500);
    function draw() {
      const dc = D.drift_cdf; const st = steps[si]; const traces = []; const lt = logTicks(-5, 0);
      panels.forEach((f, i) => {
        const at = i === 0 ? '' : String(i + 1), ab = String(i + 5);
        const p0 = stepXY(dc.pdf_x, dc.pdf[f][steps[0]], 0.125), p1 = stepXY(dc.pdf_x, dc.pdf[f][st], 0.125);
        traces.push({ x: p0.x, y: p0.y, mode: 'lines', line: { color: '#b9c2cc', width: 1.3, dash: 'dot' }, showlegend: false, legendgroup: 'ref', xaxis: 'x' + at, yaxis: 'y' + at, hoverinfo: 'skip' });
        traces.push({ x: p1.x, y: p1.y, mode: 'lines', fill: 'tozeroy', fillcolor: hex2rgba(FAM[f], 0.2), line: { color: FAM[f], width: 1.8 }, showlegend: false, legendgroup: 'cur', xaxis: 'x' + at, yaxis: 'y' + at, hovertemplate: `${FAMLABEL[f]}, step ${st / 1000}k<br>σ≈%{x:.1e}<br>density %{y:.2f}<extra></extra>` });
        traces.push({ x: dc.t, y: dc.cdf[f][steps[0]], mode: 'lines', line: { color: '#b9c2cc', width: 1.4, dash: 'dot' }, name: `step ${steps[0] / 1000}k (reference)`, showlegend: i === 0, legendgroup: 'ref', xaxis: 'x' + ab, yaxis: 'y' + ab, hoverinfo: 'skip' });
        traces.push({ x: dc.t, y: dc.cdf[f][st], mode: 'lines', line: { color: FAM[f], width: 2.4 }, name: `step ${st / 1000}k`, showlegend: i === 0, legendgroup: 'cur', xaxis: 'x' + ab, yaxis: 'y' + ab, hovertemplate: `${FAMLABEL[f]}, step ${st / 1000}k<br>x=%{x:.1e}<br>F=%{y:.3f}<extra></extra>` });
      });
      const axT = () => ({ type: 'log', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5.05, 0.05], showticklabels: false });
      const axB = (i) => ({ type: 'log', tickvals: lt.tickvals, ticktext: lt.ticktext, range: [-5.05, 0.05], title: i === 0 ? 'σ/‖M‖<sub>F</sub>' : '' });
      const ymaxPdf = Math.max(...panels.map(f => Math.max(...dc.pdf[f][st], ...dc.pdf[f][steps[0]]))) * 1.08;
      const L = {
        height: 520, margin: { l: 56, r: 18, t: 40, b: 64 }, grid: { rows: 2, columns: 4, pattern: 'independent', xgap: 0.07, ygap: 0.14 },
        xaxis: axT(), xaxis2: axT(), xaxis3: axT(), xaxis4: axT(), xaxis5: axB(0), xaxis6: axB(1), xaxis7: axB(2), xaxis8: axB(3),
        yaxis: { title: 'density in log<sub>10</sub>σ', range: [0, ymaxPdf] }, yaxis2: { range: [0, ymaxPdf], showticklabels: false }, yaxis3: { range: [0, ymaxPdf], showticklabels: false }, yaxis4: { range: [0, ymaxPdf], showticklabels: false },
        yaxis5: { title: 'CDF above 10<sup>-5</sup>', range: [-0.02, 1.02] }, yaxis6: { range: [-0.02, 1.02], showticklabels: false }, yaxis7: { range: [-0.02, 1.02], showticklabels: false }, yaxis8: { range: [-0.02, 1.02], showticklabels: false },
        annotations: panels.map((f, i) => ({ xref: 'paper', yref: 'paper', x: [0, 0.268, 0.535, 0.803][i], y: 1.05, text: `<b>${FAMLABEL[f]}</b>, layer 5`, showarrow: false, xanchor: 'left', font: { size: 12.5 } })),
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.14, font: { size: 11.5 } },
      };
      Plotly.react(plot, traces, layout(L), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 10: decade band masses along training, per operator type
  // =====================================================================================
  function fig10() {
    const ctrl = $('f10-ctrl'), plot = $('f10-plot');
    let range = true;
    const g = group(ctrl, ''); const lab = document.createElement('label'); lab.className = 'chk'; lab.innerHTML = '<input type="checkbox" checked> show 10–90% range across layers'; lab.querySelector('input').onchange = (ev) => { range = ev.target.checked; draw(); }; g.appendChild(lab);
    function draw() {
      const traces = []; const bands = ['F1', 'F2', 'F3']; const titles = ['mass in [10<sup>-5</sup>, 10<sup>-4</sup>)', 'mass in [10<sup>-4</sup>, 10<sup>-3</sup>)', 'mass in [10<sup>-3</sup>, 10<sup>-2</sup>)'];
      bands.forEach((b, bi) => {
        const ax = bi === 0 ? '' : String(bi + 1);
        for (const f of FAMS) {
          const d = D.bands_time[f][b]; const c = FAM[f];
          if (range) traces.push({ x: d.steps.concat([...d.steps].reverse()), y: d.p90.concat([...d.p10].reverse()), fill: 'toself', fillcolor: hex2rgba(c, 0.13), line: { width: 0 }, showlegend: false, legendgroup: f, hoverinfo: 'skip', xaxis: 'x' + ax, yaxis: 'y' + ax });
          traces.push({ x: d.steps, y: d.med, mode: 'lines', line: { color: c, width: 2 }, name: FAMLABEL[f], legendgroup: f, showlegend: bi === 0, xaxis: 'x' + ax, yaxis: 'y' + ax, hovertemplate: `${FAMLABEL[f]}<br>step %{x}<br>median %{y:.3f}<extra></extra>` });
        }
      });
      const xa = { title: 'training step', tickvals: [10000, 20000, 30000], ticktext: ['10k', '20k', '30k'] };
      Plotly.react(plot, traces, layout({
        height: 380, margin: { l: 56, r: 18, t: 44, b: 48 }, grid: { rows: 1, columns: 3, pattern: 'independent', xgap: 0.09 },
        xaxis: xa, xaxis2: xa, xaxis3: xa,
        yaxis: { title: 'fraction of singular values', range: [0, 0.45] }, yaxis2: { range: [0, 0.6] }, yaxis3: { range: [0, 0.6] },
        annotations: titles.map((t, i) => ({ xref: 'paper', yref: 'paper', x: [0.0, 0.365, 0.73][i], y: 1.1, text: `<b>${t}</b>`, showarrow: false, xanchor: 'left', font: { size: 12 } })),
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.3, font: { size: 11.5 } },
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 12: estimated vs true band mass on all 1260 matrices
  // =====================================================================================
  function fig12() {
    const ctrl = $('f12-ctrl'), plot = $('f12-plot');
    let mode = 'band';
    pills(group(ctrl, 'colour by'), [['band', 'decade band'], ['family', 'matrix type']], mode, v => { mode = v; draw(); });
    function draw() {
      const A = D.accuracy; const traces = [];
      const bands = [[0, '[10<sup>-5</sup>, 10<sup>-4</sup>)', C.est], [1, '[10<sup>-4</sup>, 10<sup>-3</sup>)', C.meas], [2, '[10<sup>-3</sup>, 10<sup>-2</sup>)', C.orc]];
      const txt = (a, i) => `${FAMLABEL[a.f]}, layer ${a.l}, step ${a.s / 1000}k<br>true ${a.t[i].toFixed(3)} · fit ${a.e[i].toFixed(3)}<br>range [${a.lo[i].toFixed(3)}, ${a.hi[i].toFixed(3)}]`;
      if (mode === 'band') {
        for (const [i, nm, c] of bands) traces.push({ x: A.map(a => a.t[i]), y: A.map(a => a.e[i]), mode: 'markers', marker: { color: c, size: 5, opacity: 0.55 }, name: nm, text: A.map(a => txt(a, i)), hovertemplate: '%{text}<extra></extra>' });
      } else {
        for (const f of FAMS) { const S = A.filter(a => a.f === f); const xs = [], ys = [], ts = []; for (const a of S) for (const i of [0, 1, 2]) { xs.push(a.t[i]); ys.push(a.e[i]); ts.push(txt(a, i)); } traces.push({ x: xs, y: ys, mode: 'markers', marker: { color: FAM[f], size: 5, opacity: 0.55 }, name: FAMLABEL[f], text: ts, hovertemplate: '%{text}<extra></extra>' }); }
      }
      traces.push({ x: [0, 0.72], y: [0, 0.72], mode: 'lines', line: { color: C.gray, width: 1, dash: 'dot' }, showlegend: false, hoverinfo: 'skip' });
      Plotly.react(plot, traces, layout({
        height: 440, margin: { l: 60, r: 18, t: 30, b: 48 },
        xaxis: { title: 'true band mass (SVD)', range: [-0.01, 0.72], dtick: 0.1 }, yaxis: { title: 'fitted band mass', range: [-0.01, 0.72], dtick: 0.1 },
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.16, font: { size: 11.5 } },
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 13: polar error against depth, attention vs MLP
  // =====================================================================================
  function fig13() {
    const ctrl = $('f13-ctrl'), plot = $('f13-plot');
    let stat = 'mean';
    pills(group(ctrl, 'statistic'), [['mean', 'mean'], ['med', 'median']], stat, v => { stat = v; draw(); });
    function draw() {
      const traces = []; const Ks = [4, 5, 6, 7, 8, 9, 10];
      [['attention', ''], ['mlp', '2']].forEach(([g, ax]) => {
        const F = D.fixedK[g]; const get = (p) => Ks.map(K => Math.max(F[K][p][stat], 1e-5));
        const sty = { vanilla: [C.van, 'fixed PE [10<sup>-5</sup>, 1]'], estimator: [C.est, 'ours'], oracle: [C.orc, 'RMS oracle'] };
        for (const p of ['vanilla', 'estimator', 'oracle']) traces.push({ x: Ks, y: get(p), mode: 'lines+markers', line: { color: sty[p][0], width: 2.2, dash: p === 'oracle' ? 'dot' : 'solid' }, marker: { size: 7, symbol: p === 'oracle' ? 'star' : 'circle' }, name: sty[p][1], showlegend: ax === '', legendgroup: p, xaxis: 'x' + ax, yaxis: 'y' + ax, hovertemplate: `K=%{x}<br>${stat} RMS error %{y:.4f}<extra>${sty[p][1]}</extra>` });
      });
      Plotly.react(plot, traces, layout({
        height: 360, margin: { l: 60, r: 18, t: 44, b: 62 }, grid: { rows: 1, columns: 2, pattern: 'independent', xgap: 0.14 },
        xaxis: { title: 'iterations K', dtick: 1 }, xaxis2: { title: 'iterations K', dtick: 1 },
        yaxis: { type: 'log', title: `${stat} RMS error`, range: [-5.1, 0.1], tickvals: LOGY5.tickvals, ticktext: LOGY5.ticktext }, yaxis2: { type: 'log', range: [-5.1, 0.1], tickvals: LOGY5.tickvals, ticktext: LOGY5.ticktext },
        annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.1, text: '<b>attention</b> (Q, K, V, O)', showarrow: false, xanchor: 'left', font: { size: 12 } },
                      { xref: 'paper', yref: 'paper', x: 0.57, y: 1.1, text: '<b>MLP</b> (up, gate, down)', showarrow: false, xanchor: 'left', font: { size: 12 } }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.3, font: { size: 11.5 } },
      }), CFG);
    }
    draw();
  }

  // =====================================================================================
  // Figure 14: cost at a target tolerance
  // =====================================================================================
  function fig14() {
    const plot = $('f14-plot'); const A = D.alloc; const taus = [0.1, 0.01, 0.001]; const groups = ['attention', 'MLP'];
    const xs = taus.map(t => 'τ = ' + t); const traces = [];
    groups.forEach((g, gi) => {
      const ax = gi === 0 ? '' : '2'; const rows = taus.map(t => A.find(a => a.tau === t && a.group === g));
      const add = (key, color, name, fmt) => traces.push({ x: xs, y: rows.map(r => r[key]), type: 'bar', marker: { color }, name, showlegend: gi === 0, legendgroup: key, xaxis: 'x' + ax, yaxis: 'y' + ax, text: rows.map(r => fmt(r[key])), textposition: 'outside', textfont: { size: 11 }, hovertemplate: `${g}, %{x}<br>${name}: K = %{y:.2f}<extra></extra>` });
      add('Ksafe', C.van, 'fixed PE (uniform depth)', v => String(v));
      add('depth', C.est, 'ours (mean depth)', v => v.toFixed(1));
      add('depth_orc', C.orc, 'RMS oracle (mean depth)', v => v.toFixed(1));
    });
    Plotly.react(plot, traces, layout({
      height: 320, margin: { l: 56, r: 18, t: 44, b: 40 }, grid: { rows: 1, columns: 2, pattern: 'independent', xgap: 0.1 }, barmode: 'group', bargap: 0.25,
      yaxis: { title: 'iterations K', range: [0, 11.8] }, yaxis2: { range: [0, 11.8] },
      annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1.12, text: '<b>attention</b> (Q, K, V, O)', showarrow: false, xanchor: 'left', font: { size: 12 } },
                    { xref: 'paper', yref: 'paper', x: 0.55, y: 1.12, text: '<b>MLP</b> (up, gate, down)', showarrow: false, xanchor: 'left', font: { size: 12 } }],
      showlegend: true, legend: { orientation: 'h', x: 0, y: -0.14, font: { size: 11.5 } },
    }), CFG);
  }

  // =====================================================================================
  // tables filled from data
  // =====================================================================================
  function tables() {
    const S = D.accuracy_summary; const f3 = v => v.toFixed(3), f4 = v => v.toFixed(4);
    const t1 = $('t1-body'); if (t1) {
      const rows = [['mass in [10<sup>-5</sup>, 10<sup>-4</sup>)', '[1e-5,1e-4)'], ['mass in [10<sup>-4</sup>, 10<sup>-3</sup>)', '[1e-4,1e-3)'], ['mass in [10<sup>-3</sup>, 10<sup>-2</sup>)', '[1e-3,1e-2)'], ['mass above 10<sup>-5</sup>', 'above 1e-5']];
      t1.innerHTML = rows.map(([lab, k]) => { const s = S[k]; return `<tr><td>${lab}</td><td>${f3(s.true_med)}</td><td><span class="hi">${f4(s.err_med)}</span> (${f3(s.err_p90)})</td><td>${f3(s.width_med)}</td><td>${Math.round(s.coverage * 1260)}/1260</td></tr>`; }).join('');
    }
    const t2 = $('t2-body'); if (t2) {
      const F = D.fixedK; const cell = (g, K, p) => { const o = F[g][K][p]; return `${o.med.toFixed(o.med < 0.01 ? 4 : 3)} <span style="color:#8a949e">(${o.mean.toFixed(o.mean < 0.01 ? 4 : 3)})</span>`; };
      t2.innerHTML = [5, 6, 7, 8, 9].map(K => `<tr><td>${K}</td><td>${cell('attention', K, 'vanilla')}</td><td class="hi">${cell('attention', K, 'estimator')}</td><td>${cell('attention', K, 'oracle')}</td><td>${cell('mlp', K, 'vanilla')}</td><td class="hi">${cell('mlp', K, 'estimator')}</td><td>${cell('mlp', K, 'oracle')}</td></tr>`).join('');
    }
    const t3 = $('t3-body'); if (t3) {
      const fe = v => v >= 1e-3 ? v.toFixed(4) : v > 0 ? fmtEh(v) : '&lt; 10<sup>-4</sup>';  // stored to 4 decimals
      t3.innerHTML = D.alloc.filter(a => a.group !== 'all').map((a) => `<tr><td>${a.group === 'attention' ? 'τ = ' + a.tau : ''}</td><td>${a.group}</td><td>${a.Ksafe}</td><td class="hi">${a.depth.toFixed(1)}</td><td>${a.depth_orc.toFixed(1)}</td><td>${fe(a.err_med)}</td></tr>`).join('');
    }
    const ds = $('drift-stats'); if (ds) ds.textContent = `${D.drift_stats.median.toFixed(3)}`;
    for (const [id, v] of [['cost-mlp', D.cost_share.mlp], ['cost-mlp2', D.cost_share.mlp], ['cost-att', D.cost_share.attention]]) { const el = $(id); if (el) el.textContent = Math.round(v * 100) + '%'; }
  }

  // =====================================================================================
  // TOC highlighting + reading progress
  // =====================================================================================
  function chrome() {
    const links = [...document.querySelectorAll('.toc a')]; const heads = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const onScroll = () => {
      const y = window.scrollY + 120; let cur = heads[0];
      for (const h of heads) if (h.offsetTop <= y) cur = h;
      links.forEach(a => a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id));
      const p = document.querySelector('.progress'); if (p) { const d = document.documentElement; p.style.width = (100 * window.scrollY / (d.scrollHeight - d.clientHeight)) + '%'; }
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  function init() {
    try { tables(); } catch (e) { console.error(e); }
    for (const f of [fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8, fig9, fig10, fig11, fig12, fig13, fig14]) { if (!$(f.name.replace('fig', 'f') + '-plot')) continue; try { f(); } catch (e) { console.error(f.name, e); } }
    chrome();
    if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
