(() => {
'use strict';
const $ = id => document.getElementById(id);
const POINTS = [3, 2, 1, 0.5];
const COLORS = ['#7b5cff', '#ff6a88', '#2bb3ff', '#3ddc97', '#ffb84d', '#ff8a3d', '#c94dff', '#4dd6ff'];
const LS = 'gtl.v1', LS_TEXT = 'gtl.showText', LS_AUTH = 'gtl.auth';
const PASS_HASH = '2f0db592c667faa6617b9fff079d199d5b9e113a759b7beb6054a1fede8fe56c'; // SHA-256 of the password (soft gate for a static site)
let LANGS = [], byId = {}, TTS = false;
let S = load();
let R = null; // current round
let showText = localStorage.getItem(LS_TEXT) === '1'; // off by default

function load() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.players) return s; } catch (e) {}
  return { players: [{ id: 'p1', name: 'Kaysen', score: 0, color: COLORS[0] }], history: [], round: 1, deck: [], seq: 1 };
}
function save() { localStorage.setItem(LS, JSON.stringify(S)); }
const fmt = n => (Math.round(n * 10) / 10).toString().replace(/\.5$/, '½').replace(/^0½$/, '½');
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---- deck: every phrase once before repeats, no same language twice in a row ----
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function nextCard() {
  const valid = k => { const [id, i] = k.split('#'); return byId[id] && byId[id].phrases[+i]; };
  S.deck = (S.deck || []).filter(valid);
  if (!S.deck.length) S.deck = shuffle(LANGS.flatMap(l => l.phrases.map((_, i) => l.id + '#' + i)));
  let idx = 0; const last = R && R.lang.id;
  while (idx < S.deck.length - 1 && S.deck[idx].startsWith(last + '#')) idx++;
  const [id, i] = S.deck.splice(idx, 1)[0].split('#'); save();
  return { lang: byId[id], pi: +i };
}
function newRound(started) {
  const c = nextCard(); const lang = c.lang;
  const others = lang.phrases.map((_, i) => i).filter(i => i !== c.pi);
  R = { lang, pi: c.pi, hints: 0, revealed: false, awarded: false, started: !!started, alt: others[Math.floor(Math.random() * others.length)] };
  render();
}

// ---- audio (always started from a tap so iPhone Safari allows it) ----
let audioEl = null;
// Grok voice only (no phone speech synthesis). Started from a tap so iPhone Safari allows playback.
function speak(langId, text) {
  if (!audioEl) {
    audioEl = new Audio(); audioEl.preload = 'auto';
    audioEl.onplaying = () => $('replayBtn').classList.add('playing');
    audioEl.onended = audioEl.onpause = () => $('replayBtn').classList.remove('playing');
    audioEl.onerror = () => { $('replayBtn').classList.remove('playing'); toast('Grok audio did not load. Tap Replay to retry.'); };
  }
  const idx = byId[langId].phrases.findIndex(p => p[0] === text);
  audioEl.src = 'audio/' + langId + '-' + idx + '.mp3';
  const p = audioEl.play();
  if (p && p.catch) p.catch(err => { if (err && err.name === 'NotAllowedError') toast('Tap Replay to hear it'); });
}
const playMain = () => speak(R.lang.id, R.lang.phrases[R.pi][0]);
const playAlt = () => speak(R.lang.id, R.lang.phrases[R.alt][0]);

// ---- render ----
function render() {
  const L = R.lang, p = L.phrases[R.pi];
  const seeText = showText || R.revealed;
  $('roundNo').textContent = 'Round ' + S.round;
  $('phrase').textContent = p[0];
  $('roman').textContent = p[1] || '';
  $('phrase').classList.toggle('hidden', !seeText);
  $('roman').classList.toggle('hidden', !seeText || !p[1]);
  $('listen').classList.toggle('hidden', seeText);
  $('listen').querySelector('span').textContent = R.started ? 'Listen… who knows the language?' : 'Tap Start to hear the phrase';
  $('startBtn').classList.toggle('hidden', R.started);
  $('replayBtn').classList.toggle('hidden', !R.started);
  $('voiceLbl').textContent = 'Grok voice';
  $('showText').checked = showText;
  const worth = POINTS[R.hints];
  $('worth').textContent = R.awarded ? 'Round done' : 'Worth ' + fmt(worth) + (worth === 1 ? ' pt' : ' pts');
  $('hintCount').textContent = R.hints + '/3 hints';
  const hs = [];
  if (R.hints >= 1) hs.push(`<li><span class="k">Hint 1 · Continent</span>${esc(L.continent)}</li>`);
  if (R.hints >= 2) hs.push(`<li><span class="k">Hint 2 · History</span>${esc(L.history)}</li>`);
  if (R.hints >= 3) {
    const a = L.phrases[R.alt];
    const txt = seeText ? `<div class="hp">${esc(a[0])}</div>${a[1] ? `<div class="hr">${esc(a[1])}</div>` : ''}` : '<div>🎧 Another phrase in the same language</div>';
    hs.push(`<li id="hint3"><span class="k">Hint 3 · Another phrase</span>${txt}<button class="hbtn" data-alt="1">🔁 Replay hint phrase</button></li>`);
  }
  $('hints').innerHTML = hs.join('');
  const labels = ['💡 Hint 1 · Continent', '💡 Hint 2 · History', '💡 Hint 3 · Hear another phrase'];
  $('hintBtn').textContent = R.hints < 3 ? labels[R.hints] : 'No more hints';
  $('hintBtn').disabled = R.hints >= 3 || R.revealed || !R.started;
  $('revealBtn').classList.toggle('hidden', R.revealed);
  const rv = $('reveal');
  if (R.revealed) {
    const a = L.phrases[R.alt];
    rv.classList.remove('hidden');
    rv.innerHTML = `<div class="ans">${esc(L.name)}</div>
      <p>“${esc(p[0])}”${p[1] ? ` <i>(${esc(p[1])})</i>` : ''}<br>= <b>${esc(p[2])}</b></p>
      ${p[3] ? `<p class="m">Literally: ${esc(p[3])}</p>` : ''}
      ${R.hints >= 3 ? `<p class="m">Hint phrase: “${esc(a[0])}”${a[1] ? ` (${esc(a[1])})` : ''} = ${esc(a[2])}</p>` : ''}
      <p class="m">Family: ${esc(L.family)} · ${esc(L.continent)}</p>`;
  } else rv.classList.add('hidden');
  $('whoTitle').textContent = R.awarded ? 'Scored! Tap Next for a new phrase.' : (R.revealed ? 'Did someone get it before the reveal?' : 'Who guessed it first?');
  $('players').innerHTML = S.players.length ? S.players.map(pl =>
    `<button class="pbtn" style="background:${pl.color}33;border-color:${pl.color}" data-award="${pl.id}" ${R.awarded ? 'disabled' : ''}>${esc(pl.name)}<small>+${fmt(worth)} · total ${fmt(pl.score)}</small></button>`).join('')
    : '<button class="btn ghost" id="addFirst">➕ Add players</button>';
  $('nobodyBtn').disabled = R.awarded;
  $('nobodyBtn').textContent = R.revealed ? '🙅 Nobody got it' : '🙅 Nobody / Skip';
  $('undoBtn').disabled = !S.history.length;
  $('nextBtn').classList.toggle('hidden', !(R.awarded || R.revealed));
  $('guessMsg').textContent = ''; $('peek').classList.add('hidden');
  renderBoard();
}
function renderBoard() {
  const max = Math.max(0, ...S.players.map(p => p.score));
  $('board').innerHTML = [...S.players].sort((a, b) => b.score - a.score).map(p =>
    `<div class="sc ${p.score > 0 && p.score === max ? 'lead' : ''}">${p.score > 0 && p.score === max ? '👑 ' : ''}${esc(p.name)}<b>${fmt(p.score)}</b></div>`).join('');
}

// ---- actions ----
function award(pid) {
  if (R.awarded) return;
  const pl = S.players.find(p => p.id === pid); if (!pl) return;
  const pts = POINTS[R.hints];
  pl.score += pts; S.history.push({ pid, pts, name: pl.name });
  if (S.history.length > 200) S.history.shift();
  R.awarded = true; R.revealed = true; R.started = true; save();
  toast(`+${fmt(pts)} for ${pl.name}! 🎉`); render();
}
function nobody() { if (R.awarded) return; R.awarded = true; R.revealed = true; R.started = true; render(); }
function next() { S.round++; save(); newRound(true); playMain(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function undo() {
  const h = S.history.pop(); if (!h) return;
  const pl = S.players.find(p => p.id === h.pid); if (pl) pl.score = Math.round((pl.score - h.pts) * 10) / 10;
  save(); toast(`Undid +${fmt(h.pts)} for ${h.name}`); render();
}

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.alt) return playAlt();
  if (t.dataset.award) return award(t.dataset.award);
  if (t.dataset.del) { S.players = S.players.filter(p => p.id !== t.dataset.del); save(); listPlayers(); render(); return; }
  if (t.id === 'addFirst') return openPlayers();
});
$('startBtn').onclick = () => { R.started = true; render(); playMain(); };
$('replayBtn').onclick = playMain;
$('showText').onchange = e => { showText = e.target.checked; localStorage.setItem(LS_TEXT, showText ? '1' : '0'); render(); };
$('hintBtn').onclick = () => { if (R.hints < 3 && !R.revealed) { R.hints++; render(); if (R.hints === 3) playAlt(); } };
$('revealBtn').onclick = () => { R.revealed = true; R.started = true; render(); };
$('nobodyBtn').onclick = nobody;
$('nextBtn').onclick = next;
$('undoBtn').onclick = undo;
$('peekBtn').onclick = () => { const el = $('peek'); el.textContent = R.lang.name + ' — ' + R.lang.phrases[R.pi][2]; el.classList.toggle('hidden'); };
$('guessForm').onsubmit = e => {
  e.preventDefault(); const g = $('guessIn').value; if (!g.trim()) return;
  if (Match.isMatch(g, R.lang)) $('guessMsg').innerHTML = `✅ <b>Yes!</b> Tap the player who said it to award ${fmt(POINTS[R.hints])} pts.`;
  else { const c = Match.closest(g, LANGS); $('guessMsg').textContent = '❌ Not ' + (c ? c.name : '“' + g + '”') + '. Try again or take a hint.'; }
  $('guessIn').value = '';
};

// players dialog
function listPlayers() {
  $('playerList').innerHTML = S.players.map(p => `<li><span><span style="color:${p.color}">●</span> ${esc(p.name)} · ${fmt(p.score)}</span><button type="button" data-del="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button></li>`).join('') || '<li>No players yet</li>';
}
function openPlayers() { listPlayers(); $('playersDlg').showModal(); }
$('playersBtn').onclick = openPlayers;
function addPlayer() {
  const n = $('newPlayer').value.trim().slice(0, 20); if (!n) return;
  if (S.players.some(p => p.name.toLowerCase() === n.toLowerCase())) return toast('Already playing');
  const used = new Set(S.players.map(p => p.color));
  S.players.push({ id: 'p' + (++S.seq) + Date.now().toString(36), name: n, score: 0, color: COLORS.find(c => !used.has(c)) || COLORS[S.players.length % COLORS.length] });
  $('newPlayer').value = ''; save(); listPlayers(); render();
}
$('addPlayer').onclick = addPlayer;
$('newPlayer').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPlayer(); } });
$('resetScores').onclick = () => { if (!confirm('Reset all scores to 0?')) return; S.players.forEach(p => p.score = 0); S.history = []; S.round = 1; save(); listPlayers(); render(); };
$('playersDlg').addEventListener('close', render);

// boot (static site: data + audio are plain files next to this page)
async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function boot() {
  fetch('data/languages.json').then(r => r.json()).then(langs => {
    LANGS = langs; LANGS.forEach(l => byId[l.id] = l); TTS = true;
    $('langStat').textContent = LANGS.length + ' languages · ' + LANGS.reduce((a, l) => a + l.phrases.length, 0) + ' phrases';
    newRound(false);
  }).catch(() => { $('listen').querySelector('span').textContent = 'Could not load. Pull to refresh.'; });
}
$('gateForm').onsubmit = async e => {
  e.preventDefault();
  if (await sha256($('gatePw').value) === PASS_HASH) { localStorage.setItem(LS_AUTH, PASS_HASH); $('gate').classList.add('hidden'); boot(); }
  else { $('gateErr').classList.remove('hidden'); $('gatePw').value = ''; }
};
$('lockBtn').onclick = e => { e.preventDefault(); localStorage.removeItem(LS_AUTH); location.reload(); };
if (localStorage.getItem(LS_AUTH) === PASS_HASH) boot(); else $('gate').classList.remove('hidden');
})();
