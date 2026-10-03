// Shared by every post: fills the paper's BibTeX from data/papers.js and adds the copy buttons.
// In the post:  <div class="bib" data-paper="emnlp26"><button class="cp">copy</button><pre></pre></div>
// A box without data-paper keeps the BibTeX written inside its <pre>.
(function () {
  var papers = (window.SITE && SITE.papers) || [];
  document.querySelectorAll('.bib[data-paper]').forEach(function (box) {
    var p = papers.find(function (q) { return q.id === box.getAttribute('data-paper'); });
    if (p && p.bibtex) box.querySelector('pre').textContent = p.bibtex;
  });

  function copyText(pre, btn) {
    function done() { btn.textContent = 'copied'; setTimeout(function () { btn.textContent = 'copy'; }, 1200); }
    function fallback() {  // the clipboard API is blocked on file:// pages; select the text and copy it instead
      var r = document.createRange(); r.selectNodeContents(pre);
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { document.execCommand('copy'); done(); } catch (err) {}
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(pre.textContent).then(done, fallback); else fallback();
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('.bib .cp');
    if (c) copyText(c.parentNode.querySelector('pre'), c);
  });
})();
