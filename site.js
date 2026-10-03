// Renders the page from data/*.js, then mounts the figures. Content lives in data/, not here.
(function () {
  var P = SITE.profile;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function authors(list) { return list.map(function (a) { return /Topollai/.test(a) ? '<b>' + esc(a) + '</b>' : esc(a); }).join(', '); }
  function real(obj) { return Object.keys(obj || {}).filter(function (k) { return obj[k] && obj[k] !== '#'; }); }  // "#" = not yet available
  function links(obj, cls) { return real(obj).map(function (k) { return '<a class="' + (cls || '') + '" href="' + esc(obj[k]) + '">' + esc(k) + '</a>'; }).join(''); }
  var STATUS = { accepted: ['accepted', 'ok'], review: ['preprint', 'rv'], workshop: ['workshop', 'ws'], thesis: ['thesis', 'ws'] };
  function status(p) { var s = STATUS[p.status] || [p.status, 'ws']; return { label: s[0] + (p.note ? ' · ' + p.note : ''), cls: s[1] }; }
  function mainLink(p) { var l = p.links || {}; return ['paper', 'arxiv', 'preprint'].map(function (k) { return l[k]; }).find(function (u) { return u && u !== '#'; }) || null; }
  function postFor(p) { return SITE.posts.find(function (q) { return q.paper === p.id; }); }
  function blogBadge(p, cls) { var q = postFor(p); return q ? '<button class="' + cls + '" data-tab-btn="blog" data-post="' + esc(q.slug) + '">blog</button>' : ''; }
  function byId(id) { return SITE.papers.find(function (p) { return p.id === id; }); }
  function bibBtn(p) { return p.bibtex ? '<button class="bib-btn" data-bib="' + esc(p.id) + '">bibtex</button>' : ''; }

  /* header */
  document.getElementById('nav-email').href = 'mailto:' + P.email;
  document.getElementById('foot-left').textContent = P.email + ' · ' + P.location;
  document.getElementById('idblock').innerHTML =
    '<p class="nm">' + P.lines[0] + '<span class="c"></span></p>' +
    '<p>' + P.lines.slice(1).join('<br>') + '</p>' +
    '<p><span class="status">' + esc(P.status) + '</span>' + (P.note ? '<br><br>' + esc(P.note) : '') + '</p>' +
    '<p>' + real(P.links).map(function (k) { return '<a href="' + esc(P.links[k]) + '">' + esc(k) + '</a>'; }).join(' · ') + '</p>';

  /* selected and latest work: the same card, each with its figure */
  function cards(ids) { return (ids || []).map(function (id) {
    var p = byId(id); if (!p) { console.warn('selected id not found:', id); return ''; }
    var st = status(p), venue = p.status === 'review' ? 'preprint' : p.venue;
    return '<div class="work"><h3>' + esc(p.title) + '</h3>' +
      '<div class="wh"><p class="au">' + authors(p.authors) + '</p><span class="venue ' + st.cls + '">' + esc(venue) + '</span></div>' +
      (p.blurb ? '<p class="d">' + esc(p.blurb) + '</p>' : '') +
      (p.figure ? '<div class="fig" data-fig="' + esc(p.figure) + '"></div>' : '') +
      '<div class="lk">' + links(p.links) + blogBadge(p, '') + bibBtn(p) + '</div></div>';
  }).join(''); }
  document.getElementById('works').innerHTML = cards(P.selected);
  document.getElementById('latest').innerHTML = cards(P.latest);

  /* papers, newest first (stable within a year) */
  var papers = SITE.papers.slice().sort(function (a, b) { return b.year - a.year; });
  // the second column is the conference (or "preprint"); workshop, track and notes go under the title
  document.getElementById('papers').innerHTML = papers.map(function (p) {
    var ml = mainLink(p), review = p.status === 'review';
    var col = review ? 'preprint' : (p.conf || p.venue || ''), cls = review ? 'rv' : (p.status === 'thesis' ? 'ws' : 'cf');
    var detail = [p.detail, p.note].filter(Boolean).join(' · ');
    return '<li><span class="yr">' + p.year + '</span><span class="st ' + cls + '">' + esc(col) + '</span><div>' +
      '<p class="t">' + (ml ? '<a href="' + esc(ml) + '">' + esc(p.title) + '</a>' : esc(p.title)) + '</p>' +
      '<p class="au">' + authors(p.authors) + (detail ? ' · ' + esc(detail) : '') + ' ' + links(p.links) + blogBadge(p, 'blog') + bibBtn(p) + '</p></div></li>';
  }).join('');

  /* blog */
  document.getElementById('posts').innerHTML = SITE.posts.map(function (q) {
    return '<div class="post" id="post-' + esc(q.slug) + '"><div class="dt">' + esc(q.date) + '</div><div>' +
      '<h3><a href="' + esc(q.links.read || ('blog/' + q.slug + '/')) + '">' + esc(q.title) + '</a></h3>' +
      '<p>' + esc(q.summary) + '</p>' +
      '<p class="fm">' + links(q.links) + (q.tail ? '<span>' + esc(q.tail) + '</span>' : '') + '</p></div></div>';
  }).join('');


  /* bibtex: the button opens the entry under the paper, with a copy button */
  function copyText(text, pre, btn) {
    function done() { btn.textContent = 'copied'; setTimeout(function () { btn.textContent = 'copy'; }, 1200); }
    function fallback() {  // the clipboard API is blocked on file:// pages; select the text and copy it instead
      var r = document.createRange(); r.selectNodeContents(pre);
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { document.execCommand('copy'); done(); } catch (err) {}
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bib]');
    if (b) {
      var box = b.closest('.work, li > div'), open = box.querySelector('.bib');
      b.classList.toggle('on', !open);
      if (open) { open.remove(); return; }
      var p = byId(b.getAttribute('data-bib')), el = document.createElement('div');
      el.className = 'bib';
      el.innerHTML = '<button class="cp">copy</button><pre></pre>';
      el.querySelector('pre').textContent = p.bibtex;
      box.appendChild(el);
      return;
    }
    var c = e.target.closest('.bib .cp');
    if (c) { var pre = c.parentNode.querySelector('pre'); copyText(pre.textContent, pre, c); }
  });

  /* tabs, with #papers / #blog / #post-slug in the URL */
  function showTab(name, postSlug, push) {
    document.querySelectorAll('[data-tab-pane]').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-tab-pane') === name); });
    document.querySelectorAll('nav [data-tab-btn]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab-btn') === name); });
    if (push !== false) history.replaceState(null, '', postSlug ? '#post-' + postSlug : (name === 'home' ? location.pathname : '#' + name));
    if (name === 'home') typeIntro();
    var target = postSlug && document.getElementById('post-' + postSlug);
    if (target) target.scrollIntoView(); else window.scrollTo({ top: 0 });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab-btn]'); if (!b) return;
    showTab(b.getAttribute('data-tab-btn'), b.getAttribute('data-post'));
  });
  function fromHash() {
    var h = location.hash.slice(1);
    if (/^post-/.test(h)) return showTab('blog', h.slice(5), false);
    showTab(['papers', 'blog'].indexOf(h) >= 0 ? h : 'home', null, false);
  }
  window.addEventListener('hashchange', fromHash);

  /* typed intro */
  var typed = false;
  function typeIntro() {
    var el = document.getElementById('typed'); if (!el || typed) return; typed = true;
    var text = P.intro;
    if (Figs.REDUCE) { el.textContent = text; return; }
    var i = 0, cur = document.createElement('span'); cur.className = 'cur';
    var tn = document.createTextNode(''); el.textContent = ''; el.appendChild(tn); el.appendChild(cur);
    // two characters per tick, about 1.2 s for the whole sentence
    (function tick() { if (i <= text.length) { tn.nodeValue = text.slice(0, i); i += 2; setTimeout(tick, 8 + Math.random() * 8); } else { tn.nodeValue = text; setTimeout(function () { cur.remove(); }, 1400); } })();
  }

  Figs.mountAll();
  fromHash();
})();
