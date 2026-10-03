/* Interactive figures for "When Small Updates Disappear". Plotly charts on the Muon note's layout, HTML widgets for the bit strip and program grid, KaTeX for the maths. */
(function () {
  const C = { ink: '#1b1f24', nr: '#c8453d', sr: '#6d4bd6', ghost: '#d4cbea', mute: '#8a949e', grid: '#eef0f2', soft: '#f5f6f7' };
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const fmt = (x, d = 5) => Number(x.toFixed(d)).toString();
  const pct = (x, d = 1) => (100 * x).toFixed(d) + '%';

  // ---------- numerics (ported one to one from lib/numerics.ts) ----------
  const buf = new ArrayBuffer(4), f32 = new Float32Array(buf), u32 = new Uint32Array(buf);
  const bitsOf = (x) => { f32[0] = x; return u32[0]; };
  const fromBits = (b) => { u32[0] = b; return f32[0]; };
  function hash32(counter) { let x = counter >>> 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
  function roundBF16(x, mode = 'nearest', counter = 0) {
    const b = bitsOf(x);
    if ((b & 0x7f800000) === 0x7f800000) return fromBits((b & 0xffff0000) | (b & 0x7fffff ? 0x400000 : 0));
    const noise = mode === 'nearest' ? 0x7fff + ((b >>> 16) & 1) : hash32(counter) & 0xffff;
    return fromBits((b + noise) & 0xffff0000);
  }
  function trajectory(incULP, steps = 96, seed = 31) {
    const start = 1.25, ulp = 2 ** -7, inc = Math.fround(incULP * ulp);
    const ideal = [start], nearest = [start], stochastic = [start];
    for (let i = 0; i < steps; i++) { ideal.push(start + (i + 1) * inc); nearest.push(roundBF16(Math.fround(nearest[i] + inc))); stochastic.push(roundBF16(Math.fround(stochastic[i] + inc), 'stochastic', seed + i)); }
    return { ideal, nearest, stochastic, inc };
  }
  function sampleInterval(fraction, count, seed) {
    const x = Math.fround(1 + fraction / 128);
    const values = Array.from({ length: count }, (_, i) => roundBF16(x, 'stochastic', seed + i));
    const upper = values.filter(v => v > 1).length;
    return { x, values, upper, mean: values.reduce((a, b) => a + b, 0) / count, probability: (x - 1) * 128 };
  }
  function erf(x) { if (x === 0) return 0; const t = 1 / (1 + 0.3275911 * Math.abs(x)); const p = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t; return Math.sign(x) * (1 - p * Math.exp(-x * x)); }
  const chiCDF = (x) => x <= 0 ? 0 : erf(Math.sqrt(x / 2));
  const tfm = (x) => x <= 0 ? 0 : chiCDF(x) - Math.sqrt((2 * x) / Math.PI) * Math.exp(-x / 2);
  function stallingModel(bits, beta) {
    const eps = 2 ** -bits, rho = (eps * Math.LN2) / (2 * (1 - beta));
    const nearest = chiCDF(1 + rho) - chiCDF(Math.max(0, 1 - rho));
    const a = Math.max(0, 1 - 2 * rho), b = 1 + 2 * rho;
    const left = (1 - 1 / (2 * rho)) * (chiCDF(1) - chiCDF(a)) + (tfm(1) - tfm(a)) / (2 * rho);
    const right = (1 + 1 / (2 * rho)) * (chiCDF(b) - chiCDF(1)) - (tfm(b) - tfm(1)) / (2 * rho);
    return { eps, rho, nearest, stochastic: Math.max(0, Math.min(1, left + right)) };
  }
  const condStall = (z, rho, mode) => mode === 'nearest' ? Number(Math.abs(z - 1) < rho) : Math.max(0, 1 - Math.abs(z - 1) / (2 * rho));
  function tradeoff(d) { const m = Math.abs(d), nr = m <= 0.5 ? 0 : Math.sign(d); return { nearest: nr, nrBias: nr - d, nrMSE: (nr - d) ** 2, srVar: m * (1 - m), srStall: 1 - m }; }
  const programLayout = (n, block) => Array.from({ length: Math.ceil(n / block) }, (_, p) => ({ program: p, offsets: Array.from({ length: block }, (_, l) => p * block + l), active: Math.max(0, Math.min(block, n - p * block)) }));

  // ---------- measurements (paper, Appendix A.4, Tables 8–9) ----------
  const MEAS = [
    { family: 'LLaMA', size: '60M', diag: false, bf16: [0.969, 0.812], fp8: [0.999, 0.986] },
    { family: 'LLaMA', size: '100M', diag: false, bf16: [0.967, 0.814], fp8: [0.998, 0.983] },
    { family: 'LLaMA', size: '1B', diag: true, bf16: [0.974, 0.825], fp8: [0.997, 0.986] },
    { family: 'LLaMA', size: '7B', diag: true, bf16: [0.97, 0.823], fp8: [0.998, 0.988] },
    { family: 'GPT-NeoX', size: '160M', diag: false, bf16: [0.971, 0.817], fp8: [0.999, 0.989] },
    { family: 'GPT-NeoX', size: '410M', diag: false, bf16: [0.971, 0.82], fp8: [0.999, 0.988] },
    { family: 'MoE', size: '520M', diag: false, bf16: [0.97, 0.822], fp8: [0.993, 0.982] },
  ];
  const PRED = { bf16: [0.946, 0.825], fp8: [1.0, 0.989] };

  // ---------- Plotly layout, copied from the Muon note so every chart shares one look ----------
  const CFG = { displayModeBar: false, responsive: true };
  const hex2rgba = (h, a) => `rgba(${parseInt(h.substr(1, 2), 16)},${parseInt(h.substr(3, 2), 16)},${parseInt(h.substr(5, 2), 16)},${a})`;
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
    return out;
  }
  const guide = (x0, x1, y0, y1, extra) => Object.assign({ type: 'line', x0, x1, y0, y1, line: { color: C.mute, dash: 'dot', width: 1 } }, extra || {});

  // ---------- small UI helpers, same idiom as the Muon note ----------
  function pills(el, opts, init, onChange) {
    const box = document.createElement('div'); box.className = 'pills'; let cur = init;
    opts.forEach(([val, lab, sub]) => {
      const b = document.createElement('button'); b.dataset.v = val;
      if (sub) { b.className = 'two'; b.innerHTML = `<span>${lab}</span><small>${sub}</small>`; } else b.innerHTML = lab;
      if (String(val) === String(init)) b.classList.add('on');
      b.onclick = () => { cur = val; [...box.children].forEach(c => c.classList.toggle('on', c.dataset.v === String(val))); onChange(val); };
      box.appendChild(b);
    });
    el.appendChild(box);
    return { get: () => cur, set: (v) => { cur = v; [...box.children].forEach(c => c.classList.toggle('on', c.dataset.v === String(v))); onChange(v); } };
  }
  function slider(el, min, max, step, init, fmtv, onChange) {
    const wrap = document.createElement('div'); wrap.className = 'slider';
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = init;
    const val = document.createElement('span'); val.className = 'val'; val.textContent = fmtv(+init);
    inp.oninput = () => { val.textContent = fmtv(+inp.value); onChange(+inp.value); };
    wrap.appendChild(inp); wrap.appendChild(val); el.appendChild(wrap);
    return { get: () => +inp.value, set: (v) => { inp.value = v; val.textContent = fmtv(+v); onChange(+v); } };
  }
  function group(parent, label) { const g = document.createElement('div'); g.className = 'grp'; if (label) { const l = document.createElement('span'); l.className = 'lbl'; l.textContent = label; g.appendChild(l); } parent.appendChild(g); return g; }
  function button(parent, label, onClick) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = onClick; parent.appendChild(b); return b; }

  // =====================================================================================
  // Figure 1 · repeated BF16 additions
  // =====================================================================================
  function fig1() {
    const plot = $('f1-plot'), ctrl = $('f1-ctrl'), mini = $('f1-mini'); if (!plot) return;
    let delta = 0.2, seed = 31, inspect = 96;
    const xs = [...Array(97).keys()];
    function draw() {
      const d = trajectory(delta, 96, seed), ghosts = Array.from({ length: 16 }, (_, i) => trajectory(delta, 96, seed + (i + 1) * 997).stochastic);
      const high = Math.max(...d.ideal, ...d.nearest, ...d.stochastic, ...ghosts.flat()) + 0.02, low = 1.235;
      const traces = ghosts.map((g, i) => ({ x: xs, y: g, mode: 'lines', line: { color: hex2rgba(C.sr, 0.2), width: 1, shape: 'hv' }, name: '16 other seeds', legendgroup: 'ghost', showlegend: i === 0, hoverinfo: 'skip' }));
      traces.push(
        { x: xs, y: d.ideal, mode: 'lines', line: { color: C.ink, width: 1.6, dash: 'dot' }, name: 'unquantized', hovertemplate: 'step %{x}<br>%{y:.5f}<extra>unquantized</extra>' },
        { x: xs, y: d.nearest, mode: 'lines', line: { color: C.nr, width: 2.2, shape: 'hv' }, name: 'nearest rounding', hovertemplate: 'step %{x}<br>%{y:.5f}<extra>nearest</extra>' },
        { x: xs, y: d.stochastic, mode: 'lines', line: { color: C.sr, width: 2.2, shape: 'hv' }, name: 'stochastic rounding', hovertemplate: 'step %{x}<br>%{y:.5f}<extra>stochastic</extra>' },
        { x: [inspect, inspect], y: [d.nearest[inspect], d.stochastic[inspect]], mode: 'markers', marker: { color: [C.nr, C.sr], size: 9, line: { color: '#fff', width: 1.5 } }, showlegend: false, hoverinfo: 'skip' });
      Plotly.react(plot, traces, layout({
        height: 360, margin: { l: 60, r: 18, t: 24, b: 66 },
        xaxis: { title: 'update', range: [0, 96], dtick: 24 },
        yaxis: { title: 'stored value (BF16)', range: [low, high] },
        shapes: [guide(inspect, inspect, 0, 1, { xref: 'x', yref: 'paper' })],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.28, font: { size: 11.5 } },
      }), CFG);
      mini.innerHTML = `step <b>${inspect}</b> · ideal <b>${fmt(d.ideal[inspect], 5)}</b> · <span class="nr-text">NR ${fmt(d.nearest[inspect], 5)}</span> · <span class="sr-text">SR ${fmt(d.stochastic[inspect], 5)}</span> · nearest rounding is <b>${d.nearest[96] === 1.25 ? 'stalled' : 'moving'}</b> · δ = ${fmt(d.inc, 7)}`;
    }
    const sd = slider(group(ctrl, 'update size'), 0.05, 0.95, 0.05, delta, v => v.toFixed(2) + ' ULP', v => { delta = v; draw(); });
    pills(group(ctrl, 'presets'), [[0.2, '0.2 ULP'], [0.5, '0.5 ULP'], [0.8, '0.8 ULP']], 0.2, v => sd.set(v));
    slider(group(ctrl, 'inspect'), 0, 96, 1, inspect, v => 'step ' + v, v => { inspect = v; draw(); });
    button(group(ctrl, ''), '↻ new seed', () => { seed += 1013; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 2 · Adam's second moment in low precision (simulation)
  // =====================================================================================
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Round a positive value to p fraction bits (no exponent limits), to nearest-even or stochastically.
  function quantP(x, p, stochastic, r) {
    if (x <= 0) return 0;
    const u = 2 ** (Math.floor(Math.log2(x)) - p), q = x / u, lo = Math.floor(q), fr = q - lo;
    const up = stochastic ? r < fr : (fr > 0.5 || (fr === 0.5 && lo % 2 === 1));
    return (lo + (up ? 1 : 0)) * u;
  }
  const EMA = { T: 6000, C: 64, drop: 2000 };
  const EMA_G2 = (() => { const rnd = mulberry32(7), out = new Float64Array(EMA.T * EMA.C); for (let t = 0; t < EMA.T; t++) { const sd = t < EMA.drop ? 1 : 0.5; for (let c = 0; c < EMA.C; c += 2) { const u1 = Math.max(rnd(), 1e-12), u2 = rnd(), rr = Math.sqrt(-2 * Math.log(u1)); out[t * EMA.C + c] = (sd * rr * Math.cos(2 * Math.PI * u2)) ** 2; out[t * EMA.C + c + 1] = (sd * rr * Math.sin(2 * Math.PI * u2)) ** 2; } } return out; })();
  // The stored state starts settled at the gradient variance (late in training); we plot its average over coordinates.
  function emaRun(p, mode, beta) {
    const { T, C } = EMA; const v = new Float64Array(C).fill(1); const y = new Array(T);
    for (let t = 0; t < T; t++) {
      let sum = 0;
      for (let c = 0; c < C; c++) {
        const prop = beta * v[c] + (1 - beta) * EMA_G2[t * C + c];
        v[c] = mode === 'fp32' ? prop : quantP(prop, p, mode === 'sr', hash32(911 + c * T + t) / 4294967296);
        sum += v[c];
      }
      y[t] = sum / C;
    }
    return y;
  }
  function fig2() {
    const plot = $('f2-plot'), ctrl = $('f2-ctrl'), mini = $('f2-mini'); if (!plot) return;
    let fmtName = 'bf16', beta = 0.999; const cache = {};
    const FMT = { bf16: { p: 7, label: 'BF16' }, fp8: { p: 3, label: 'FP8' } };
    const get = (key, f) => cache[key] || (cache[key] = f());
    function draw() {
      const F = FMT[fmtName], steps = Array.from({ length: EMA.T }, (_, t) => t + 1);
      const fp = get(`fp32|${beta}`, () => emaRun(0, 'fp32', beta));
      const nr = get(`${fmtName}|nr|${beta}`, () => emaRun(F.p, 'nr', beta));
      const sr = get(`${fmtName}|sr|${beta}`, () => emaRun(F.p, 'sr', beta));
      const truth = steps.map(t => t <= EMA.drop ? 1 : 0.25);
      const line = (y, name, color, width, dash) => ({ x: steps, y, mode: 'lines', name, line: { color, width, dash }, hovertemplate: `step %{x}<br>%{y:.3f}<extra>${name}</extra>` });
      Plotly.react(plot, [
        line(truth, 'true gradient variance', '#c9ced4', 2, 'solid'),
        line(fp, 'FP32 state', C.ink, 1.6, 'dot'),
        line(nr, `${F.label}, nearest rounding`, C.nr, 2.4),
        line(sr, `${F.label}, stochastic rounding`, C.sr, 2.4),
      ], layout({
        height: 380, margin: { l: 60, r: 18, t: 16, b: 84 },
        xaxis: { title: 'step', range: [0, EMA.T] }, yaxis: { title: 'stored second moment', range: [0, 2.2] },
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.3, font: { size: 11.5 } },
      }), CFG);
      const last = (a) => a[a.length - 1];
      mini.innerHTML = `β₂ = ${beta} · at step ${EMA.T}: true variance <b>0.25</b> · FP32 <b>${last(fp).toFixed(2)}</b> · <span class="nr-text">nearest ${last(nr).toFixed(2)}</span> · <span class="sr-text">stochastic ${last(sr).toFixed(2)}</span>`;
    }
    pills(group(ctrl, 'state format'), [['bf16', 'BF16'], ['fp8', 'FP8']], fmtName, v => { fmtName = v; draw(); });
    pills(group(ctrl, 'β₂'), [[0.95, '0.95'], [0.99, '0.99'], [0.999, '0.999'], [0.9999, '0.9999']], beta, v => { beta = +v; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 3 · the stalling predictor, plus the density panel
  // =====================================================================================
  const FORMATS = [[7, 'BF16', '7 fraction bits'], [3, 'FP8 · E4M3', '3 fraction bits'], [2, 'FP4 · E2M2', '2 fraction bits · unsigned']];
  function fig3() {
    const plot = $('f3-plot'), ctrl = $('f3-ctrl'), ctrl2 = $('f3-ctrl2'), mini = $('f3-mini'); if (!plot) return;
    let bits = 3, dec = 3, mode = 'nearest';
    const ks = Array.from({ length: 151 }, (_, i) => 1 + i / 50);
    const curve = (b, m) => ks.map(t => stallingModel(b, 1 - 10 ** -t)[m]);
    function draw() {
      const beta = 1 - 10 ** -dec, m = stallingModel(bits, beta), name = FORMATS.find(f => f[0] === bits)[1];
      const traces = FORMATS.filter(f => f[0] !== bits).map((f, i) => ({ x: ks, y: curve(f[0], 'nearest'), mode: 'lines', line: { color: '#c8ccd2', width: 1.2 }, name: 'other precisions, nearest', legendgroup: 'other', showlegend: i === 0, hovertemplate: `${f[1]} · nearest<br>β₂ = 1 − 10<sup>−%{x:.2f}</sup><br>%{y:.2%}<extra></extra>` }));
      traces.push(
        { x: ks, y: curve(bits, 'nearest'), mode: 'lines', line: { color: C.nr, width: 2.4 }, name: `${name} · nearest rounding`, hovertemplate: 'β₂ = 1 − 10<sup>−%{x:.2f}</sup><br>%{y:.2%}<extra>nearest</extra>' },
        { x: ks, y: curve(bits, 'stochastic'), mode: 'lines', line: { color: C.sr, width: 2.4 }, name: `${name} · stochastic rounding`, hovertemplate: 'β₂ = 1 − 10<sup>−%{x:.2f}</sup><br>%{y:.2%}<extra>stochastic</extra>' },
        { x: [dec, dec], y: [m.nearest, m.stochastic], mode: 'markers', marker: { color: [C.nr, C.sr], size: 9, line: { color: '#fff', width: 1.5 } }, showlegend: false, hoverinfo: 'skip' });
      Plotly.react(plot, traces, layout({
        height: 360, margin: { l: 60, r: 18, t: 24, b: 66 },
        xaxis: { title: 'EMA decay β₂', range: [1, 4], tickvals: [1, 2, 3, 4], ticktext: ['0.9', '0.99', '0.999', '0.9999'] },
        yaxis: { title: 'one-step stalling probability', range: [0, 1.02], tickformat: '.0%' },
        shapes: [guide(dec, dec, 0, 1, { xref: 'x', yref: 'paper' })],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.28, font: { size: 11.5 } },
      }), CFG);
      mini.innerHTML = `${name} at β₂ = <b>${beta.toFixed(5)}</b> · <span class="nr-text">nearest P(stall) = ${pct(m.nearest, 2)}</span> · <span class="sr-text">stochastic P(stall) = ${pct(m.stochastic, 2)}</span> · ρ̂ = <b>${fmt(m.rho, 2)}</b>`;
      density(m);
    }
    const dplot = $('f3d-plot'), dctrl = $('f3d-ctrl'), dmini = $('f3d-mini');
    function density(m) {
      if (!dplot) return;
      const pdf = (v) => Math.exp(-v * v / 2) / Math.sqrt(2 * Math.PI);
      const width = mode === 'nearest' ? m.rho : 2 * m.rho, bounds = [Math.sqrt(Math.max(0, 1 - width)), Math.sqrt(1 + width)];
      const nodes = Array.from({ length: 401 }, (_, i) => -4 + i / 50);
      for (const b of bounds) for (const sg of [-1, 1]) { const a = sg * b; if (Math.abs(a) < 4) nodes.push(a - 1e-7, a, a + 1e-7); }
      nodes.sort((a, b) => a - b);
      const col = mode === 'nearest' ? C.nr : C.sr, prob = mode === 'nearest' ? m.nearest : m.stochastic;
      Plotly.react(dplot, [
        { x: nodes, y: nodes.map(v => pdf(v) * condStall(v * v, m.rho, mode)), mode: 'lines', fill: 'tozeroy', fillcolor: hex2rgba(col, 0.25), line: { color: col, width: 1.2 }, name: `mass that stalls under ${mode} rounding`, hovertemplate: 'a = %{x:.2f}<br>%{y:.3f}<extra>stalling mass</extra>' },
        { x: nodes, y: nodes.map(pdf), mode: 'lines', line: { color: C.ink, width: 1.6 }, name: 'standard normal density of g/σ', hovertemplate: 'a = %{x:.2f}<br>φ = %{y:.3f}<extra></extra>' },
      ], layout({
        height: 280, margin: { l: 56, r: 18, t: 20, b: 66 },
        xaxis: { title: 'standardized gradient a = g / σ', range: [-4, 4], dtick: 1 },
        yaxis: { title: 'density', range: [0, 0.43] },
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.3, font: { size: 11.5 } },
      }), CFG);
      dmini.innerHTML = `shaded mass ≈ <b style="color:${col}">${pct(prob, 2)}</b>. The plot uses the normalized gradient a = g/σ, so z = a². ${mode === 'nearest' ? 'NR keeps the density wherever |a² − 1| < ρ̂.' : 'SR weights each point by max(0, 1 − |a² − 1| / (2ρ̂)).'} The drawing shows −4 ≤ a ≤ 4; the number integrates the whole distribution.`;
    }
    pills(group(ctrl, 'state precision'), FORMATS.map(f => [f[0], f[1], f[2]]), bits, v => { bits = +v; draw(); });
    const sd = slider(group(ctrl2, 'EMA decay · β₂ = 1 − 10⁻ᵏ'), 1, 4, 0.05, dec, v => 'β₂ = ' + (1 - 10 ** -v).toFixed(5), v => { dec = v; draw(); });
    pills(group(ctrl2, ''), [1, 2, 3, 4].map(d => [d, (1 - 10 ** -d).toFixed(d)]), 3, v => sd.set(+v));
    if (dctrl) pills(group(dctrl, 'rounding rule'), [['nearest', 'nearest gate'], ['stochastic', 'stochastic gate']], mode, v => { mode = v; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 4 · sample the rounding
  // =====================================================================================
  function fig4() {
    const body = $('f4-body'), ctrl = $('f4-ctrl'); if (!body) return;
    let fraction = 0.3, count = 256, seed = 17;
    function draw() {
      const r = sampleInterval(fraction, count, seed), lo = 1, hi = 1 + 1 / 128;
      body.innerHTML = `
        <div class="track"><span style="width:${(1 - r.probability) * 100}%"></span><span style="width:${r.probability * 100}%"></span></div>
        <div class="ends"><span>q₋ = 1 · <b>${((1 - r.probability) * 100).toFixed(0)}% chance</b></span><span>q₊ = 1.0078125 · <b>${(r.probability * 100).toFixed(0)}% chance</b></span></div>
        <div class="dots" role="img" aria-label="First ${Math.min(96, count)} rounding outcomes, purple means rounded up.">${r.values.slice(0, 96).map(v => `<span class="${v > 1 ? 'up' : ''}"></span>`).join('')}</div>
        <div class="dotcap">first ${Math.min(96, count)} draws · <span class="sr-text">purple rounds up</span></div>
        <div class="mini">sample mean <b>${r.mean.toFixed(7)}</b> · target x = <b>${r.x.toFixed(7)}</b> · <b>${r.upper}</b> of ${count} draws rounded up</div>
        <div class="meanscale"><i style="left:${((r.mean - lo) / (hi - lo)) * 100}%"></i><b style="left:${r.probability * 100}%"></b></div>
        <div class="dotcap">error = ${((r.mean - r.x) * 128).toFixed(4)} ULP · ideal RMS error = ${Math.sqrt((r.probability * (1 - r.probability)) / count).toFixed(4)} ULP</div>`;
    }
    const g1 = group(ctrl, 'position between neighbours'); slider(g1, 0, 1, 0.01, fraction, v => 'p = ' + v.toFixed(2), v => { fraction = v; draw(); });
    const g2 = group(ctrl, 'draws'); slider(g2, 32, 2048, 32, count, v => String(v), v => { count = v; draw(); });
    const g3 = group(ctrl, ''); button(g3, '↻ resample', () => { seed += 2017; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 5 · stalling, bias, error
  // =====================================================================================
  function fig5() {
    const plot = $('f5-plot'), ctrl = $('f5-ctrl'), mini = $('f5-mini'); if (!plot) return;
    let delta = 0.2;
    function draw() {
      const r = tradeoff(delta), same = r.nearest === 0;
      Plotly.react(plot, [
        { x: [-1, 1], y: [-1, 1], mode: 'lines', line: { color: C.sr, width: 2.2 }, name: 'stochastic rounding · expected update', hovertemplate: 'Δ/u = %{x:.2f}<br>E[update] = %{y:.2f} u<extra></extra>' },
        { x: [-1, -0.5, null, -0.5, 0.5, null, 0.5, 1], y: [-1, -1, null, 0, 0, null, 1, 1], mode: 'lines', line: { color: C.nr, width: 2.2 }, name: 'nearest rounding · delivered update', hovertemplate: 'Δ/u = %{x:.2f}<br>update = %{y:.0f} u<extra></extra>' },
        { x: [-0.5, 0.5], y: [-1, 1], mode: 'markers', marker: { color: '#fff', size: 8, line: { color: C.nr, width: 2 } }, showlegend: false, hoverinfo: 'skip' },
        { x: [-0.5, 0.5], y: [0, 0], mode: 'markers', marker: { color: C.nr, size: 8 }, showlegend: false, hoverinfo: 'skip' },
        { x: [delta, delta], y: [delta, r.nearest], mode: 'markers', marker: { color: [C.sr, C.nr], size: 10, line: { color: '#fff', width: 1.5 } }, showlegend: false, hoverinfo: 'skip' },
      ], layout({
        height: 340, margin: { l: 60, r: 18, t: 24, b: 66 },
        xaxis: { title: 'proposed update Δ / u', range: [-1, 1], dtick: 0.5 },
        yaxis: { title: 'delivered update / u', range: [-1.05, 1.05], dtick: 0.5 },
        shapes: [{ type: 'rect', x0: -0.5, x1: 0.5, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'rgba(0,0,0,0.05)', line: { width: 0 } }, guide(delta, delta, 0, 1, { xref: 'x', yref: 'paper' })],
        annotations: [{ x: 0, y: 0.97, xref: 'x', yref: 'paper', text: 'NR stalling cell', showarrow: false, font: { size: 11, color: C.mute } }],
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.28, font: { size: 11.5 } },
      }), CFG);
      mini.innerHTML = `Δ = <b>${(delta > 0 ? '+' : '') + delta.toFixed(2)} u</b> · <span class="nr-text">NR ${same ? '100%' : '0%'} stalled</span>, bias ${r.nrBias.toFixed(2)} u, MSE ${r.nrMSE.toFixed(3)} u² · <span class="sr-text">SR ${(r.srStall * 100).toFixed(0)}% stalled</span>, bias 0, MSE ${r.srVar.toFixed(3)} u²`;
    }
    slider(group(ctrl, 'signed proposal · Δ / u'), -0.95, 0.95, 0.05, delta, v => (v > 0 ? '+' : '') + v.toFixed(2) + ' ULP', v => { delta = v; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 6 · prediction versus measurement
  // =====================================================================================
  function fig6() {
    const body = $('f6-body'), ctrl = $('f6-ctrl'), sum = $('f6-summary'); if (!body) return;
    let format = 'bf16', view = 'plot', metric = 'stall', zoom = true, sel = 1, plotEl = null;
    const disp = (p) => metric === 'stall' ? p : 1 - p;
    const names = MEAS.map(m => `${m.family} ${m.size}${m.diag ? '*' : ''}`);
    function rows() { return MEAS.flatMap(m => [0, 1].map(i => ({ m, i, measured: m[format][i], predicted: PRED[format][i], err: 100 * (m[format][i] - PRED[format][i]) }))); }
    function draw() {
      const rs = rows(), maxErr = Math.max(...rs.map(r => Math.abs(r.err)));
      sum.innerHTML = `<b>${rs.length}</b> measurements · <b>${maxErr.toFixed(1)} pp</b> largest absolute error · β₂ = <b>0.999</b> · ${metric === 'stall' ? 'probability the stored state stays unchanged' : '100% minus the reported stalled fraction'}`;
      if (view === 'table') {
        plotEl = null;
        body.innerHTML = `<table class="tbl"><thead><tr><th>Model</th><th>Mode</th><th>Measured</th><th>Predicted</th><th>Δ (pp)</th></tr></thead><tbody>${rs.map(r => { const e = metric === 'stall' ? r.err : -r.err; return `<tr><td>${r.m.family} ${r.m.size}${r.m.diag ? '*' : ''}</td><td class="${r.i ? 'sr-text' : 'nr-text'}">${r.i ? 'SR' : 'NR'}</td><td>${pct(disp(r.measured))}</td><td>${pct(disp(r.predicted))}</td><td>${e > 0 ? '+' : ''}${e.toFixed(1)}</td></tr>`; }).join('')}</tbody></table><p class="tcap">${metric === 'stall' ? 'Reported stalled fractions from Tables 8 and 9.' : 'Moving fractions computed as 1 minus each reported stalled fraction.'} Differences are measured minus predicted, in percentage points.</p>`;
        return;
      }
      if (!plotEl) { body.innerHTML = '<div class="plot"></div><div class="mini" id="f6-insp"></div>'; plotEl = body.querySelector('.plot'); }
      const lo = zoom && metric === 'stall' ? (format === 'bf16' ? 0.75 : 0.98) : 0, hi = zoom && metric === 'move' ? (format === 'bf16' ? 0.25 : 0.02) : 1;
      const traces = [];
      [0, 1].forEach(i => {
        const col = i ? C.sr : C.nr, lab = i ? 'SR' : 'NR';
        traces.push({ x: MEAS.flatMap(m => [disp(PRED[format][i]), disp(m[format][i]), null]), y: MEAS.flatMap((_, r) => [r, r, null]), mode: 'lines', line: { color: hex2rgba(col, 0.35), width: 2 }, showlegend: false, hoverinfo: 'skip' });
        traces.push({ x: MEAS.map(m => disp(m[format][i])), y: MEAS.map((_, r) => r), mode: 'markers', marker: { color: col, size: MEAS.map((_, r) => r === sel ? 11 : 8), line: { color: '#fff', width: 1.5 } }, name: `${lab} · measured`, customdata: MEAS.map(m => [names[MEAS.indexOf(m)], disp(PRED[format][i])]), hovertemplate: `%{customdata[0]} · ${lab}<br>measured %{x:.1%}<br>predicted %{customdata[1]:.1%}<extra></extra>` });
      });
      traces.push({ x: [null], y: [null], mode: 'lines', line: { color: C.mute, dash: 'dash', width: 1.2 }, name: 'prediction (dashed)', hoverinfo: 'skip' });
      Plotly.react(plotEl, traces, layout({
        height: 400, margin: { l: 120, r: 18, t: 26, b: 66 },
        xaxis: { title: `${metric === 'stall' ? 'stalled' : 'moving'} fraction of state updates · ${format.toUpperCase()}, β₂ = 0.999`, range: [lo, hi], tickformat: format === 'fp8' && zoom ? '.1%' : '.0%' },
        yaxis: { tickvals: MEAS.map((_, r) => r), ticktext: names, range: [MEAS.length - 0.5, -0.5], showgrid: false },
        shapes: [{ type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: sel - 0.5, y1: sel + 0.5, fillcolor: '#f5f3f9', line: { width: 0 }, layer: 'below' }]
          .concat(PRED[format].map((p, i) => ({ type: 'line', xref: 'x', yref: 'paper', x0: disp(p), x1: disp(p), y0: 0, y1: 1, line: { color: i ? C.sr : C.nr, dash: 'dash', width: 1.2 } }))),
        showlegend: true, legend: { orientation: 'h', x: 0, y: -0.24, font: { size: 11.5 } },
      }), CFG);
      if (!plotEl._bound) { plotEl._bound = true; plotEl.on('plotly_click', e => { const pt = e.points && e.points[0]; if (pt && pt.y != null) { sel = Math.round(pt.y); draw(); } }); }
      const model = MEAS[sel];
      $('f6-insp').innerHTML = `click a model to inspect it · <b>${model.family} ${model.size} · ${format.toUpperCase()}</b> · ${metric === 'stall' ? 'stalled' : 'moving'}, measured / predicted: ` + model[format].map((p, i) => `<span class="${i ? 'sr-text' : 'nr-text'}">${i ? 'SR' : 'NR'}</span> <b>${pct(disp(p))} / ${pct(disp(PRED[format][i]))}</b> (${(Math.abs(p - PRED[format][i]) * 100).toFixed(1)} pp apart)`).join(' · ');
    }
    pills(group(ctrl, 'precision'), [['bf16', 'BF16'], ['fp8', 'FP8 · E4M3']], format, v => { format = v; draw(); });
    pills(group(ctrl, 'show'), [['stall', 'stalled updates'], ['move', 'moving updates']], metric, v => { metric = v; draw(); });
    pills(group(ctrl, 'view'), [['plot', 'plot'], ['table', 'data table']], view, v => { view = v; draw(); });
    const zb = button(group(ctrl, ''), 'full 0–100% axis', () => { zoom = !zoom; zb.textContent = zoom ? 'full 0–100% axis' : 'zoom to measurements'; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 7 · the bits
  // =====================================================================================
  function fig7() {
    const body = $('f7-body'), ctrl = $('f7-ctrl'), ctrl2 = $('f7-ctrl2'), mini = $('f7-mini'); if (!body) return;
    let fraction = 0.3, seed = 17, sign = 1;
    function draw() {
      const value = Math.fround(sign * (1.25 + fraction / 128)), bits = bitsOf(value), bin = bits.toString(2).padStart(32, '0'), low = bits & 0xffff, random = hash32(seed) & 0xffff, carry = low + random >= 65536;
      body.innerHTML = `<div class="bitwrap"><div class="bitlabels"><span>sign</span><span>8 exponent bits</span><span>7 retained</span><span>16 discarded fraction bits</span></div>
        <div class="bitstrip" role="img" aria-label="FP32 bit representation of ${value}: ${bin}">${bin.split('').map((b, i) => `<span class="${i === 0 ? 's' : i < 9 ? 'e' : i < 16 ? 'r' : 'd'}">${b}</span>`).join('')}</div></div>
        <div class="ends"><span>FP32 · 0x${bits.toString(16).padStart(8, '0')} · the 16 high bits become BF16</span><span>low / 65,536 = <b>${(low / 65536).toFixed(4)}</b></span></div>
        <div class="carry"><div><span class="k">discarded bits</span><span class="v">${low.toLocaleString('en-US')}</span></div><span>+</span><div><span class="k">random 16-bit word</span><span class="v">${random.toLocaleString('en-US')}</span></div><span>=</span><div><span class="k">${carry ? 'carry into retained bits' : 'no carry'}</span><span class="v ${carry ? 'sr-text' : 'nr-text'}">${(low + random).toLocaleString('en-US')}</span></div></div>`;
      mini.innerHTML = `input <b>${value.toFixed(7)}</b> · BF16 output under stochastic rounding <b>${fmt(roundBF16(value, 'stochastic', seed), 7)}</b> · ${carry ? 'rounded away from zero' : 'rounded toward zero'}`;
    }
    const g1 = group(ctrl, 'input sign'); pills(g1, [[1, 'positive'], [-1, 'negative']], sign, v => { sign = +v; draw(); });
    const g2 = group(ctrl2, 'magnitude · position above 1.25'); slider(g2, 0, 0.99, 0.01, fraction, v => (1.25 + v / 128).toFixed(7), v => { fraction = v; draw(); });
    const g3 = group(ctrl2, ''); button(g3, '↻ draw threshold', () => { seed += 1; draw(); });
    draw();
  }

  // =====================================================================================
  // Figure 8 · the program grid
  // =====================================================================================
  function fig8() {
    const body = $('f8-body'), ctrl = $('f8-ctrl'), budget = $('f8-budget'), eq = $('f8-eq'); if (!body) return;
    let n = 37, block = 16, sel = 2;
    function draw() {
      const groups = programLayout(n, block), cur = Math.max(0, Math.min(sel, groups.length - 1)), g = groups[cur];
      budget.innerHTML = `<span><b>${groups.length}</b> programs</span><span><b>${groups.length * block - n}</b> masked lanes</span><span><b>${n * 4}</b> bytes read, <b>${n * 2}</b> bytes written</span>`;
      body.innerHTML = n === 0 ? '<p class="mini">N = 0. Return the empty BF16 allocation and launch no programs.</p>' : `<div class="programs">${groups.map(p => `<button class="${cur === p.program ? 'on' : ''}" data-p="${p.program}" aria-pressed="${cur === p.program}"><span class="pt">program ${p.program}<span>${p.active}/${block} active</span></span><span class="lanes">${p.offsets.map(o => `<span class="${o < n ? '' : 'm'}">${o}</span>`).join('')}</span></button>`).join('')}</div>`;
      body.querySelectorAll('button[data-p]').forEach(b => b.onclick = () => { sel = +b.dataset.p; draw(); });
      eq.innerHTML = g ? `offsets = <b>${cur}</b> × <b>${block}</b> + arange(0, <b>${block}</b>) &nbsp;·&nbsp; mask = offsets &lt; ${n} <span class="sr-text">→ ${g.active} loads + stores</span>` : '';
    }
    const g1 = group(ctrl, 'elements'); slider(g1, 0, 64, 1, n, v => 'N = ' + v, v => { n = v; draw(); });
    const g2 = group(ctrl, 'block size'); pills(g2, [[8, 'B = 8'], [16, 'B = 16'], [32, 'B = 32']], block, v => { block = +v; draw(); });
    draw();
  }

  // =====================================================================================
  // code blocks and guided walkthroughs
  // =====================================================================================
  const CODE = {
    naive: 'import torch\n\n# Run the reference on CPU; use CUDA when available.\ndevice = "cuda" if torch.cuda.is_available() else "cpu"\nx = torch.linspace(1.0, 2.0, 100_003, dtype=torch.float32, device=device)\ny = x.to(torch.bfloat16)  # nearest, ties-to-even\n\nassert y.element_size() == 2',
    pytorch: 'import torch\n\n\ndef stochastic_cast(x, *, generator=None):\n    if x.dtype != torch.float32:\n        raise TypeError("expected an FP32 tensor")\n    if not x.is_contiguous():\n        raise ValueError("the teaching cast expects contiguous storage")\n    # Reinterpret the word, then use int64 for unsigned 32-bit arithmetic.\n    bits = x.view(torch.int32).to(torch.int64) & 0xFFFFFFFF\n    r = torch.randint(0, 65536, x.shape, device=x.device,\n                      dtype=torch.int64, generator=generator)\n    rounded = (bits + r) & 0xFFFF0000\n\n    # Preserve infinities; retain a quiet-NaN bit for every NaN.\n    special = (bits & 0x7F800000) == 0x7F800000\n    is_nan = special & ((bits & 0x007FFFFF) != 0)\n    preserved = torch.where(is_nan,\n        (bits & 0xFFFF0000) | 0x00400000, bits & 0xFFFF0000)\n    rounded = torch.where(special, preserved, rounded)\n    return rounded.to(torch.int32).view(torch.float32).to(torch.bfloat16)\n',
    kernel: "@triton.jit\ndef _sr_cast_bf16_kernel(\n    input_ptr,\n    output_ptr,\n    n_elements,\n    seed,\n    logical_offset,\n    BLOCK_SIZE: tl.constexpr,\n):\n    # The mask makes the final program safe when the tensor length is not a\n    # multiple of BLOCK_SIZE.\n    offsets = tl.program_id(0) * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)\n    mask = offsets < n_elements\n    value = tl.load(input_ptr + offsets, mask=mask, other=0.0).to(tl.float32)\n\n    # Logical indices preserve the random stream across launch shapes.\n    counter = (\n        offsets.to(tl.uint32)\n        + tl.cast(seed, tl.uint32)\n        + tl.cast(logical_offset, tl.uint32)\n    )\n    rounded = _stochastic_bf16_value(value, counter)\n    tl.store(output_ptr + offsets, rounded, mask=mask)\n",
    helpers: "@triton.jit\ndef _u32_hash(counter):\n    # A small integer avalanche hash gives each logical element its own\n    # deterministic pseudo-random word. This is stateless and deliberately\n    # mirrors the arithmetic used by the PyTorch reference implementation.\n    value = counter ^ (counter >> 16)\n    value *= 0x7FEB352D\n    value ^= value >> 15\n    value *= 0x846CA68B\n    return value ^ (value >> 16)\n\n@triton.jit\ndef _stochastic_bf16_bits(value, counter):\n    # An FP32 value lies between two adjacent BF16 values according to its\n    # low 16 bits. Adding a uniform 16-bit integer before truncation rounds\n    # upward with probability low_bits / 2**16 and downward otherwise.\n    bits = tl.cast(value, tl.uint32, bitcast=True)\n    random_low = _u32_hash(counter) & 0xFFFF\n    truncated = bits & 0xFFFF0000\n    rounded = (bits + random_low) & 0xFFFF0000\n\n    # Truncating a NaN whose payload only occupies discarded bits would\n    # otherwise turn it into infinity. Force a retained quiet-NaN bit.\n    special = (bits & 0x7F800000) == 0x7F800000\n    nan = special & ((bits & 0x007FFFFF) != 0)\n    preserved_special = tl.where(nan, truncated | 0x00400000, truncated)\n    rounded = tl.where(special, preserved_special, rounded)\n    return rounded\n\n@triton.jit\ndef _stochastic_bf16_value(value, counter):\n    return tl.cast(_stochastic_bf16_bits(value, counter), tl.float32, bitcast=True)\n",
    launch: "def sr_cast_bf16(x, *, seed, offset=0, block_size=256):\n    output = torch.empty_like(x, dtype=torch.bfloat16)  # BF16 output\n    grid = (triton.cdiv(x.numel(), block_size),)        # one program per block\n    _sr_cast_bf16_kernel[grid](\n        x, output, x.numel(),\n        seed=seed, logical_offset=offset,\n        BLOCK_SIZE=block_size,\n    )\n    return output\n",
    fused: "@triton.jit\ndef _fused_adamw_kernel(\n    parameter_ptr,\n    gradient_ptr,\n    exp_avg_ptr,\n    exp_avg_sq_ptr,\n    n_elements,\n    beta1,\n    beta2,\n    one_minus_beta1,\n    one_minus_beta2,\n    step_size,\n    correction2_sqrt,\n    decay,\n    eps,\n    seed,\n    logical_offset,\n    STOCHASTIC: tl.constexpr,\n    BLOCK_SIZE: tl.constexpr,\n):\n    indices = tl.program_id(0).to(tl.int64) * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)\n    mask = indices < n_elements\n    parameter = tl.load(parameter_ptr + indices, mask=mask, other=0.0).to(tl.float32)\n    gradient = tl.load(gradient_ptr + indices, mask=mask, other=0.0).to(tl.float32)\n    m = tl.load(exp_avg_ptr + indices, mask=mask, other=0.0).to(tl.float32)\n    v = tl.load(exp_avg_sq_ptr + indices, mask=mask, other=0.0).to(tl.float32)\n    updated_m = beta1 * m + one_minus_beta1 * gradient\n    updated_v = beta2 * v + one_minus_beta2 * (gradient * gradient)\n    denominator = tl.sqrt(updated_v) / correction2_sqrt + eps\n    updated_parameter = parameter * decay - step_size * (updated_m / denominator)\n\n    if STOCHASTIC:\n        counter = (\n            indices.to(tl.uint32)\n            + tl.cast(seed, tl.uint32)\n            + tl.cast(logical_offset, tl.uint32)\n        )\n        stored_m = _stochastic_bf16_value(updated_m, counter)\n        stored_v = _stochastic_bf16_value(updated_v, counter + tl.cast(n_elements, tl.uint32))\n    else:\n        stored_m, stored_v = updated_m, updated_v\n    tl.store(parameter_ptr + indices, updated_parameter, mask=mask)\n    tl.store(exp_avg_ptr + indices, stored_m, mask=mask)\n    tl.store(exp_avg_sq_ptr + indices, stored_v, mask=mask)\n",
  };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function hlLine(l) {
    return l.split(/(#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:def|return|if|else|for|in|with|import|from|as|assert|raise|not|and|or|True|False|None|lambda)\b|\b(?:0x[0-9A-Fa-f]+|\d[\d_]*(?:\.\d+)?)\b|@[\w.]+|\b(?:torch|triton|tl)\b)/g).map(t => {
      if (!t) return ''; const e = esc(t);
      if (t.startsWith('#')) return `<span class="cm">${e}</span>`; if (/^['"]/.test(t)) return `<span class="st">${e}</span>`;
      if (/^(0x|[0-9])/.test(t)) return `<span class="nu">${e}</span>`;
      if (/^(def|return|if|else|for|in|with|import|from|as|assert|raise|not|and|or|True|False|None|lambda)$/.test(t)) return `<span class="kw">${e}</span>`;
      if (/^(torch|triton|tl|@)/.test(t)) return `<span class="md">${e}</span>`; return e;
    }).join('');
  }
  function codeBlock(el, title, code, needle) {
    if (!el) return;
    const lines = code.trimEnd().split('\n');
    el.innerHTML = `<div class="bar"><span>${esc(title)}</span><button type="button">copy</button></div><pre tabindex="0">${lines.map((l, i) => `<div class="ln${needle && [].concat(needle).some(n => l.includes(n)) ? ' hl' : ''}"><span class="n">${i + 1}</span><span class="t">${hlLine(l || ' ')}</span></div>`).join('')}</pre>`;
    const btn = el.querySelector('button'); btn.onclick = async () => { try { await navigator.clipboard.writeText(code); btn.textContent = 'copied'; setTimeout(() => btn.textContent = 'copy', 1600); } catch (e) { btn.textContent = 'select to copy'; } };
    const hl = el.querySelector('.ln.hl'), pre = el.querySelector('pre'); if (hl && pre) pre.scrollTop = Math.max(0, hl.offsetTop - pre.clientHeight / 3);
  }
  function stepped(stepsEl, xEl, codeEl, title, code, steps) {
    if (!stepsEl) return; let cur = 0;
    function render() { stepsEl.innerHTML = steps.map((s, i) => `<button type="button" class="${i === cur ? 'on' : ''}" aria-pressed="${i === cur}">${s.name}</button>`).join(''); [...stepsEl.children].forEach((b, i) => b.onclick = () => { cur = i; render(); }); xEl.textContent = steps[cur].text; codeBlock(codeEl, title, code, steps[cur].needle); }
    render();
  }
  function code() {
    // PyTorch: three tabs
    const tabs = $('c1-tabs'); if (tabs) { let cur = 'nearest'; const opts = [['nearest', 'Nearest', 'pytorch / nearest rounding', CODE.naive], ['stochastic', 'Stochastic', 'pytorch / stochastic rounding', CODE.pytorch]]; function r() { tabs.innerHTML = opts.map(o => `<button type="button" class="${o[0] === cur ? 'on' : ''}">${o[1]}</button>`).join(''); [...tabs.children].forEach((b, i) => b.onclick = () => { cur = opts[i][0]; r(); }); const o = opts.find(o => o[0] === cur); codeBlock($('c1'), o[2], o[3]); } r(); }
    stepped($('c2-steps'), $('c2-x'), $('c2'), 'triton / the cast kernel', CODE.kernel, [
      { name: '01 · Which elements', needle: 'offsets = tl.program_id', text: 'program_id says which block this program owns, and arange lists the element indices inside it. The mask is false for indices past the end of the tensor.' },
      { name: '02 · Load', needle: 'value = tl.load', text: 'Load the whole block at once. The mask stops the last program from reading past the end of the tensor; masked lanes get 0.0 and are never written back.' },
      { name: '03 · Counter', needle: 'counter = (', text: 'Each element gets a counter from its index plus a seed and an offset. The random number is a hash of this counter, so it does not depend on how the tensor is split into blocks.' },
      { name: '04 · Round', needle: 'rounded = _stochastic', text: 'A helper function does the bit trick from Figure 7 for every element in the block. It is shown below.' },
      { name: '05 · Store', needle: 'tl.store', text: 'Write the rounded block into the BF16 output, again with the mask.' },
    ]);
    codeBlock($('c3'), 'python / allocate and launch', CODE.launch);
    stepped($('c4-steps'), $('c4-x'), $('c4'), 'triton / the rounding helpers', CODE.helpers, [
      { name: 'Counter hash', needle: 'value = counter ^', text: 'Turn the counter into a 32-bit number that looks random. Shifts, XORs and multiplications by large constants mix the bits, so neighbouring counters give unrelated numbers. The same counter always gives the same number.' },
      { name: 'Bitcast', needle: 'bits = tl.cast', text: 'Read the 32 bits of the FP32 number as an unsigned integer. bitcast=True keeps the bits as they are; a numeric cast would turn 1.25 into the integer 1.' },
      { name: 'Threshold', needle: 'random_low =', text: 'Keep the low 16 bits of the hash. This is the random number r from Section 6.1, between 0 and 65,535.' },
      { name: 'Carry', needle: 'rounded = (bits', text: 'Add r to the word and clear the low 16 bits. If the addition carries into the kept bits, the value rounds away from zero, with probability equal to the dropped bits over 2^16. Otherwise it rounds toward zero.' },
      { name: 'Special values', needle: 'preserved_special =', text: 'Infinities stay infinities and NaNs stay NaNs. Without this, a NaN whose nonzero bits are all in the dropped part would turn into infinity.' },
      { name: 'Return', needle: 'return rounded', text: "The result has its low 16 bits cleared, so it is exactly a BF16 value. _stochastic_bf16_value reads the word back as an FP32 number." },
    ]);
    stepped($('c13-steps'), $('c13-x'), $('c13'), 'triton / the fused AdamW kernel', CODE.fused, [
      { name: '01 · Load', needle: 'tl.load(', text: 'Each program loads its block of the parameter, the gradient and both moments, and converts them to FP32. The moments are stored in BF16, so this read is exact.' },
      { name: '02 · Update', needle: ['updated_m = beta', 'updated_v = beta', 'denominator =', 'updated_parameter ='], text: 'The AdamW update, in FP32: first both moments, then the parameter. The parameter uses the FP32 moments, before any rounding. Bias correction and weight decay arrive as precomputed numbers (step_size, correction2_sqrt, decay).' },
      { name: '03 · Round', needle: ['counter = (', '_stochastic_bf16_value('], text: 'Round the new moments to BF16 with the same helper as the cast. The second moment uses the next block of counters (counter + n_elements), so the two moments get different random numbers. With STOCHASTIC=False the store rounds to nearest instead.' },
      { name: '04 · Store', needle: 'tl.store', text: 'Write back the parameter and the two rounded moments. Every tensor is read once and written once per step.' },
    ]);
  }

  // =====================================================================================
  // TOC highlighting + reading progress (same as the Muon note)
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

  // =====================================================================================
  // Timings · H200, from the repository's recorded benchmarks
  // =====================================================================================
  const TIMES = {
    cast: { title: 'FP32 → BF16 cast, 16.8M elements', vsEager: 35.87, vsCompile: 1.94, overhead: 0.70, rows: [['PyTorch, eager', 2236.56, 'sr'], ['torch.compile', 120.94, 'sr'], ['Triton', 62.42, 'sr'], ['Triton, nearest', 61.97, 'nr'], ['PyTorch .to(bfloat16), nearest', 32.22, 'nr']] },
    adamw: { title: 'AdamW step, 16.8M parameters, BF16 states', vsCompile: 2.61, overhead: 0.27, rows: [['PyTorch, eager', 5033.19, 'sr'], ['torch.compile', 381.07, 'sr'], ['Triton, fused', 145.90, 'sr'], ['Triton, fused, nearest', 145.51, 'nr']] },
    sgdm: { title: 'SGD momentum step, 16.8M parameters, BF16 state', vsCompile: 1.20, overhead: 0.25, rows: [['PyTorch, eager', 2494.40, 'sr'], ['torch.compile', 147.20, 'sr'], ['Triton, fused', 122.94, 'sr'], ['Triton, fused, nearest', 122.31, 'nr']] },
  };
  function fig10() {
    const ctrl = $('f10-ctrl'), plot = $('f10-plot'), mini = $('f10-mini'); if (!plot) return;
    let w = 'cast';
    function draw() {
      const R = TIMES[w].rows; const tri = R.find(r => r[0].startsWith('Triton') && r[2] === 'sr')[1];
      const col = (r) => r[0].startsWith('Triton') && r[2] === 'sr' ? C.sr : (r[2] === 'nr' ? '#c9ced4' : '#8a949e');
      Plotly.react(plot, [{ type: 'bar', orientation: 'h', y: R.map(r => r[0]), x: R.map(r => r[1]), marker: { color: R.map(col) }, text: R.map(r => r[1] >= 1000 ? (r[1] / 1000).toFixed(2) + ' ms' : r[1].toFixed(0) + ' µs'), textposition: 'outside', cliponaxis: false, hovertemplate: '%{y}: %{x:.2f} µs<extra></extra>' }], layout({
        height: 60 + 46 * R.length, margin: { l: 210, r: 70, t: 10, b: 46 },
        xaxis: { type: 'log', title: 'time per call (log scale)', range: [1.3, 4.0], tickvals: [30, 100, 300, 1000, 3000], ticktext: ['30 µs', '100 µs', '300 µs', '1 ms', '3 ms'] },
        yaxis: { autorange: 'reversed', ticks: '' }, showlegend: false, bargap: 0.35,
      }), CFG);
      const W = TIMES[w], vsEager = W.vsEager || R[0][1] / tri;
      mini.innerHTML = `${W.title} · stochastic rounding in Triton is <b class="sr-text">${vsEager.toFixed(0)}× faster</b> than eager PyTorch, <b class="sr-text">${W.vsCompile.toFixed(1)}× faster</b> than torch.compile, and <b>${W.overhead.toFixed(2)}%</b> slower than the same Triton kernel with nearest rounding`;
    }
    pills(group(ctrl, 'workload'), [['cast', 'cast'], ['adamw', 'AdamW step'], ['sgdm', 'SGDM step']], w, v => { w = v; draw(); });
    draw();
  }

  function init() {
    for (const f of [fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8, fig10, code]) { try { f(); } catch (e) { console.error(f.name, e); } }
    chrome();
    if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }], throwOnError: false, ignoredClasses: ['code'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
