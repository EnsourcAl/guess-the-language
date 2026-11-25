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
const REGIONS = [['all', '🌍', 'All languages'], ['Europe', '🏰', 'Europe'], ['Asia', '🏯', 'Asia'], ['Africa', '🦁', 'Africa'], ['Americas', '🌎', 'Americas'], ['Oceania', '🌺', 'Oceania']];
const mode = () => S.mode || 'all';
const isCont = () => mode() !== 'all';
const pool = () => isCont() ? LANGS.filter(l => l.region === mode()) : LANGS;
function save() { localStorage.setItem(LS, JSON.stringify(S)); }
const fmt = n => (Math.round(n * 10) / 10).toString().replace(/\.5$/, '½').replace(/^0½$/, '½');
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---- deck: every phrase once before repeats, no same language twice in a row ----
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function nextCard() {
  const valid = k => { const [id, i] = k.split('#'); return byId[id] && byId[id].phrases[+i]; };
  // 'all' keeps the original S.deck; each continent game gets its own deck
  let deck = isCont() ? ((S.decks = S.decks || {})[mode()] || []) : (S.deck || []);
  const ok = new Set(pool().map(l => l.id));
  deck = deck.filter(k => valid(k) && ok.has(k.split('#')[0]));
  if (!deck.length) deck = shuffle(pool().flatMap(l => l.phrases.map((_, i) => l.id + '#' + i)));
  let idx = 0; const last = R && R.lang.id;
  while (idx < deck.length - 1 && deck[idx].startsWith(last + '#')) idx++;
  const [id, i] = deck.splice(idx, 1)[0].split('#');
  if (isCont()) S.decks[mode()] = deck; else S.deck = deck;
  save();
  return { lang: byId[id], pi: +i };
}
function newRound(started) {
  const c = nextCard(); const lang = c.lang;
  R = { lang, pi: c.pi, hints: 0, used: [], revealed: false, awarded: false, started: !!started, zoom: false, choices: makeChoices(lang), picked: null };
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
function makeChoices(lang) {
  // correct + 4 others from the same continent; top up with the nearest languages if the continent is small
  const dist = l => Math.hypot(l.lat - lang.lat, ((l.lon - lang.lon + 540) % 360) - 180);
  let pick = shuffle(LANGS.filter(l => l.id !== lang.id && l.region === lang.region)).slice(0, 4);
  if (pick.length < 4) pick = pick.concat(LANGS.filter(l => l.id !== lang.id && !pick.includes(l)).sort((a, b) => dist(a) - dist(b)).slice(0, 4 - pick.length));
  return shuffle([lang, ...pick]).map(l => l.id);
}
const HINTS = () => isCont() ? [['history', '📜', 'History'], ['map', '🗺️', 'Map'], ['choices', '🔢', '5 choices']] : [['continent', '🌍', 'Continent'], ['history', '📜', 'History'], ['map', '🗺️', 'Map']];
function mapSvg(L, zoom) {
  const x = (L.lon + 180) * 2, y = (84 - L.lat) * 2, W = 720, H = 284;
  let vw = W, vh = H, vx = 0, vy = 0;
  if (zoom) { vw = 220; vh = 150; vx = Math.max(0, Math.min(W - vw, x - vw / 2)); vy = Math.max(0, Math.min(H - vh, y - vh / 2)); }
  const s = zoom ? 2.4 : 7;
  return `<svg viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="Map with a pin where the language is spoken">
    <image href="map.svg" x="0" y="0" width="${W}" height="${H}"/>
    <circle cx="${x}" cy="${y}" r="${s * 2.2}" fill="none" stroke="#ff3355" stroke-width="${s * .35}"><animate attributeName="r" from="${s}" to="${s * 4}" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" from="1" to="0" dur="1.4s" repeatCount="indefinite"/></circle>
    <g id="pin" data-x="${x}" data-y="${y}" transform="translate(${x} ${y}) scale(${s / 5})"><path d="M0 0 C-3 -6 -8 -9 -8 -15 A8 8 0 1 1 8 -15 C8 -9 3 -6 0 0Z" fill="#ff3355" stroke="#fff" stroke-width="1.6"/><circle cx="0" cy="-15" r="3.2" fill="#fff"/></g>
  </svg><button class="zoom" data-zoom="1">${zoom ? '🌍 Whole world' : '🔍 Zoom in'}</button>`;
}

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
  const reg = REGIONS.find(r => r[0] === mode());
  $('modeBtn').textContent = reg[1] + ' ' + (isCont() ? reg[2] : 'All');
  $('modeLbl').textContent = isCont() ? reg[2] + ' game' : '';
  const hs = [];
  if (isCont()) hs.push(`<li class="known"><span class="k">Continent (known)</span>${esc(reg[2])}</li>`);
  for (const h of R.used) {
    if (h === 'continent') hs.push(`<li><span class="k">Continent</span>${esc(L.continent)}</li>`);
    if (h === 'history') hs.push(`<li><span class="k">History</span>${esc(L.history)}</li>`);
    if (h === 'map') hs.push(`<li id="hintMap"><span class="k">Map · where it's spoken</span><div class="mapbox">${mapSvg(L, R.zoom)}</div></li>`);
  }
  $('hints').innerHTML = hs.join('');
  const off = R.revealed || !R.started;
  $('hintBtns').innerHTML = HINTS().map(([id, e, t]) => {
    const used = R.used.includes(id);
    const locked = id === 'choices' && !(R.used.includes('history') && R.used.includes('map'));
    return `<button class="btn hint ${used ? 'used' : ''}" data-hint="${id}" ${used || off || locked ? 'disabled' : ''}><span class="e">${e}</span>${t}${locked ? '<small>after 2 hints</small>' : ''}</button>`;
  }).join('');
  const ch = $('choices');
  if (R.used.includes('choices')) {
    ch.classList.remove('hidden');
    const done = R.picked || R.revealed;
    ch.innerHTML = '<div class="k">Which language is it?</div>' + R.choices.map(id => {
      const cls = done ? (id === L.id ? 'right' : (id === R.picked ? 'wrong' : '')) : '';
      return `<button class="cbtn ${cls}" data-choice="${id}" ${done ? 'disabled' : ''}>${esc(byId[id].name)}</button>`;
    }).join('');
  } else ch.classList.add('hidden');
  $('revealBtn').classList.toggle('hidden', R.revealed);
  const rv = $('reveal');
  if (R.revealed) {
    rv.classList.remove('hidden');
    rv.innerHTML = `<div class="ans">${esc(L.name)}</div>
      <p>“${esc(p[0])}”${p[1] ? ` <i>(${esc(p[1])})</i>` : ''}<br>= <b>${esc(p[2])}</b></p>
      ${p[3] ? `<p class="m">Literally: ${esc(p[3])}</p>` : ''}
      <p class="m">Family: ${esc(L.family)} · ${esc(L.continent)} · pin: ${esc(L.place || '')}</p>`;
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
  if (t.dataset.hint) return useHint(t.dataset.hint);
  if (t.dataset.zoom) { R.zoom = !R.zoom; return render(); }
  if (t.dataset.choice) { if (!R.picked && !R.revealed) { R.picked = t.dataset.choice; toast(R.picked === R.lang.id ? '✅ Correct! Tap who got it' : '❌ Nope, it was ' + R.lang.name); render(); } return; }
  if (t.dataset.mode) return setMode(t.dataset.mode);
  if (t.dataset.award) return award(t.dataset.award);
  if (t.dataset.del) { S.players = S.players.filter(p => p.id !== t.dataset.del); save(); listPlayers(); render(); return; }
  if (t.id === 'addFirst') return openPlayers();
});
$('startBtn').onclick = () => { R.started = true; render(); playMain(); };
$('replayBtn').onclick = playMain;
$('showText').onchange = e => { showText = e.target.checked; localStorage.setItem(LS_TEXT, showText ? '1' : '0'); render(); };
function useHint(id) {
  if (R.revealed || !R.started || R.used.includes(id) || R.used.length >= 3) return;
  if (id === 'choices' && !(R.used.includes('history') && R.used.includes('map'))) return;
  R.used.push(id); R.hints = R.used.length; render();
  if (id === 'map') setTimeout(() => { const m = $('hintMap'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
}
function setMode(m) {
  $('modeDlg').close();
  if (m === mode()) return;
  S.mode = m; save(); newRound(false);
  toast(m === 'all' ? '🌍 All languages' : '🗺️ ' + m + ' game · ' + pool().length + ' languages');
}
$('modeBtn').onclick = () => {
  $('modeList').innerHTML = REGIONS.map(([id, e, t]) => `<button type="button" data-mode="${id}" class="${id === mode() ? 'on' : ''}"><span>${e} ${t}</span><small>${id === 'all' ? LANGS.length : LANGS.filter(l => l.region === id).length} languages</small></button>`).join('');
  $('modeDlg').showModal();
};
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
