(function (root) {
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/ʻ|'|’/g, '').replace(/\blanguage\b|\bthe\b/g, ' ').replace(/[^a-z0-9\u0080-\uffff]+/g, ' ').trim();
  }
  function lev(a, b) { // Damerau (OSA) distance: typos + swapped letters
    if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n;
    const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  }
  function names(lang) {
    const out = new Set([lang.name, ...(lang.aliases || [])]);
    const m = lang.name.match(/^(.*?)\s*\((.*)\)$/); if (m) { out.add(m[1]); out.add(m[2]); }
    return [...out].map(norm).filter(Boolean);
  }
  function tol(len) { return len <= 4 ? 0 : len <= 7 ? 1 : 2; }
  // returns true if guess matches lang
  function isMatch(guess, lang) {
    const g = norm(guess); if (!g) return false;
    return names(lang).some(n => lev(g, n) <= tol(n.length));
  }
  // best matching language (for "you guessed X" feedback)
  function closest(guess, langs) {
    const g = norm(guess); let best = null, bd = 1e9;
    for (const l of langs) for (const n of names(l)) { const d = lev(g, n); if (d < bd && d <= tol(n.length)) { bd = d; best = l; } }
    return best;
  }
  const api = { norm, lev, isMatch, closest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Match = api;
})(this);
