// www/vora-highlight.js — Vora syntax highlighter + error marker
// ============================================================================

const VoraHighlight = (() => {

  /* ── Token patterns (ordered: first match wins) ──────────────────── */
  const TOKENS = [
    // Block comments
    { type: 'comment', regex: /\/\*[\s\S]*?\*\//g },
    // Line comments
    { type: 'comment', regex: /\/\/.*$/gm },
    // Strings (double-quoted)
    { type: 'string',  regex: /"(?:[^"\\]|\\.)*"/g },
    // Strings (single-quoted)
    { type: 'string',  regex: /'(?:[^'\\]|\\.)*'/g },
    // Numbers (hex, octal, binary, float, int)
    { type: 'number',  regex: /\b0[xX][0-9a-fA-F_]+\b|\b0[oO][0-7_]+\b|\b0[bB][01_]+\b|\b\d+\.\d+(?:[eE][+-]?\d+)?\b|\b\d+\b/g },
    // Keywords
    { type: 'keyword', regex: /\b(?:let|const|func|return|if|else|while|for|in|break|continue|do|try|catch|finally|throw|defer|match|yield|import|export|from|as|Obj|this|super|null|true|false|switch|case|default|new|typeof)\b/g },
    // Builtins
    { type: 'builtin', regex: /\b(?:print|type|len|assert|int|float|range|input|bin|oct|hex|toString|clock|iter|next|Set|Map|Error)\b/g },
    // Operators
    { type: 'operator', regex: /(?:=>|\.\.\.|\.\.=?|==|!=|>=|<=|&&|\|\||\+=|-=|\*=|\/=|%=|\*\*=|\?\?=|\+\+|--|[+\-*/%<>=!&\|^~?:]|->)/g },
    // Interpolation in strings (within template-like strings, but Vora uses regular strings)
    // Property access / method call dot
    { type: 'plain', regex: /[a-zA-Z_$][\w$]*/g },
  ];

  const CSS_CLASS = {
    keyword:  'hl-kw',
    string:   'hl-str',
    comment:  'hl-cmt',
    number:   'hl-num',
    builtin:  'hl-bn',
    operator: 'hl-op',
    plain:    '',
  };

  /* ── highlight(source) → HTML string ───────────────────────────── */
  function highlight(source) {
    // Build an array of [start, end, type] spans
    const spans = [];
    TOKENS.forEach(({ type, regex }) => {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(source)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, type });
      }
    });

    // Sort by position, longer spans first at same position
    spans.sort((a, b) => a.start - b.start || b.end - a.end);

    // Merge spans, keeping only the first (highest priority) at each position
    const merged = [];
    const covered = new Set();
    for (const s of spans) {
      let blocked = false;
      for (let i = s.start; i < s.end; i++) {
        if (covered.has(i)) { blocked = true; break; }
      }
      if (!blocked) {
        merged.push(s);
        for (let i = s.start; i < s.end; i++) covered.add(i);
      }
    }
    merged.sort((a, b) => a.start - b.start);

    // Build HTML
    let html = '';
    let pos = 0;
    for (const s of merged) {
      // Escape text before this span
      if (pos < s.start) {
        html += escapeHTML(source.slice(pos, s.start));
      }
      const cls = CSS_CLASS[s.type] || '';
      html += cls
        ? `<span class="${cls}">${escapeHTML(source.slice(s.start, s.end))}</span>`
        : escapeHTML(source.slice(s.start, s.end));
      pos = s.end;
    }
    if (pos < source.length) {
      html += escapeHTML(source.slice(pos));
    }
    return html;
  }

  function escapeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── Error parsing ──────────────────────────────────────────────── */
  // Parses Vora error output format:
  //   --> 9:47
  //      |
  //    9 |     this.greet = func() { return "Hi, I'm " + this.name }
  //      |                                               ^
  //      = Error: Undefined variable 'this'
  function parseErrors(errorText) {
    const lines = [];
    const re = /^\s*-->\s*(\d+):(\d+)/gm;
    let m;
    while ((m = re.exec(errorText)) !== null) {
      lines.push(parseInt(m[1], 10));
    }
    // Deduplicate
    return [...new Set(lines)];
  }

  /* ── Editor integration ─────────────────────────────────────────── */
  let _textarea = null;
  let _highlightLayer = null;
  let _gutter = null;

  function bind(textarea, highlightLayer, gutter) {
    _textarea = textarea;
    _highlightLayer = highlightLayer;
    _gutter = gutter;
    syncScroll();

    _textarea.addEventListener('scroll', () => {
      syncScroll();
      syncGutterScroll();
    });
    _textarea.addEventListener('input', () => {
      applyHighlight();
      updateGutter();
      clearErrors();
    });
  }

  function syncScroll() {
    if (_highlightLayer && _textarea) {
      _highlightLayer.scrollTop = _textarea.scrollTop;
      _highlightLayer.scrollLeft = _textarea.scrollLeft;
    }
  }

  function applyHighlight() {
    if (!_highlightLayer || !_textarea) return;
    const src = _textarea.value;
    _highlightLayer.innerHTML = highlight(src) + '\n';
  }

  /* ── Gutter ─────────────────────────────────────────────────────── */
  function updateGutter() {
    if (!_gutter || !_textarea) return;
    const lines = _textarea.value.split('\n');
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      html += `<span class="gl" data-line="${i+1}">${i+1}</span>\n`;
    }
    _gutter.innerHTML = html;
    syncGutterScroll();
  }

  function syncGutterScroll() {
    if (_gutter && _textarea) {
      _gutter.scrollTop = _textarea.scrollTop;
    }
  }

  /* ── Error marking ──────────────────────────────────────────────── */
  function markErrors(errorText) {
    clearErrors();
    const errorLines = parseErrors(errorText);
    errorLines.forEach(line => {
      if (_gutter) {
        const el = _gutter.querySelector(`[data-line="${line}"]`);
        if (el) el.classList.add('error-line');
      }
      if (_highlightLayer) {
        const spans = _highlightLayer.querySelectorAll(`.hl-line-${line}`);
        spans.forEach(s => s.classList.add('error-line'));
      }
    });
    // Scroll to first error
    if (errorLines.length > 0 && _textarea) {
      const lineH = 1.55 * 0.88 * 16; // line-height * font-size (approx)
      _textarea.scrollTop = Math.max(0, (errorLines[0] - 1) * lineH - 100);
      syncScroll();
    }
  }

  function clearErrors() {
    if (_gutter) {
      _gutter.querySelectorAll('.error-line').forEach(el => el.classList.remove('error-line'));
    }
    if (_highlightLayer) {
      _highlightLayer.querySelectorAll('.error-line').forEach(el => el.classList.remove('error-line'));
    }
  }

  return { highlight, bind, applyHighlight, updateGutter, markErrors, clearErrors, syncScroll };
})();

// ESM + global
if (typeof window !== 'undefined') window.VoraHighlight = VoraHighlight;
if (typeof module !== 'undefined' && module.exports) module.exports = VoraHighlight;
