import { kangaTile, accentFor, drawHighlands, VoiceWave, orbStyle } from './visuals.js';
import { Matcher } from './matcher.js';
import { store, loadAnswers } from './store.js';

const $ = s => document.querySelector(s);
const LANGS = ['en', 'fr', 'de'];
const LANG_NAMES = { en: 'English', fr: 'Français', de: 'Deutsch' };
const SUGGESTED = ['price', 'tour', 'directions', 'buy', 'duration', 'booking'];

const UNSURE = {
  sw: 'Swali hili litajibiwa na binti yangu mwishoni mwa wiki.',
  en: "Noor doesn't have a recorded answer for this yet. Her daughter will reply at the weekend. Your question is saved.",
  fr: "Noor n'a pas encore de réponse enregistrée pour cela. Sa fille répondra ce week-end. Votre question est enregistrée.",
  de: 'Dafür hat Noor noch keine aufgenommene Antwort. Ihre Tochter antwortet am Wochenende. Ihre Frage ist gespeichert.'
};

let answers = [];
let matcher;
let lang = LANGS.includes((navigator.language || 'en').slice(0, 2)) ? navigator.language.slice(0, 2) : 'en';
let current = null; // { answer, wave }
let stopPlayback = () => {};

function detectLang(text) {
  const t = ` ${text.toLowerCase()} `;
  const fr = [' est ', ' le ', ' la ', ' les ', ' vous ', ' je ', ' combien ', ' où ', ' puis', ' faut', ' quelle '];
  const de = [' ist ', ' der ', ' die ', ' das ', ' ich ', ' wie ', ' was ', ' kann ', ' wann ', ' gibt ', ' darf '];
  const en = [' the ', ' is ', ' how ', ' what ', ' can ', ' do ', ' there ', ' you ', ' when ', ' where '];
  const hits = list => list.filter(w => t.includes(w)).length;
  const f = hits(fr), d = hits(de), e = hits(en);
  if (f > d && f > e) return 'fr';
  if (d > f && d > e) return 'de';
  if (e > 0) return 'en';
  return null;
}

// ---------- status ----------
function setConnection() {
  const online = navigator.onLine;
  $('#net').dataset.state = online ? 'online' : 'offline';
  $('#net-label').textContent = online ? 'Online' : 'Offline';
}
function setEngine(text, state) {
  $('#engine').textContent = text;
  $('#engine').dataset.state = state;
}

// ---------- suggestions ----------
const same = (x, y) => x.toLowerCase().replace(/[^a-z]/g, '') === y.toLowerCase().replace(/[^a-z]/g, '');
function renderSuggestions() {
  const wrap = $('#suggestions');
  wrap.innerHTML = '';
  // Bento layout: first card tall, fourth card wide.
  const shape = ['tall', '', '', 'wide', '', ''];
  SUGGESTED.map(id => answers.find(a => a.id === id)).filter(Boolean).forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `bento-card ${shape[i] || ''}`;
    b.style.setProperty('--accent', accentFor(a.id));
    b.innerHTML = `<span class="bento-tile">${kangaTile(a.id)}</span>
      <span class="bento-text"><span class="bento-q">${a.examples[0]}</span>${same(a.topic, a.examples[0]) ? '' : `<span class="bento-topic">${a.topic}</span>`}</span>`;
    b.addEventListener('click', () => { $('#q').value = a.examples[0]; ask(); });
    wrap.appendChild(b);
  });
}

// ---------- playback ----------
function playAnswer(answer, wave, button) {
  stopPlayback();
  const note = $('#play-note');
  let raf = 0, stopped = false;
  const finish = () => {
    stopped = true; cancelAnimationFrame(raf);
    button.dataset.state = 'idle'; button.setAttribute('aria-label', 'Play Noor\u2019s answer');
    wave.set(0);
  };
  stopPlayback = () => { if (!stopped) { audio.pause(); window.speechSynthesis?.cancel(); finish(); } };
  button.dataset.state = 'playing'; button.setAttribute('aria-label', 'Stop');

  const audio = new Audio(`audio/${answer.id}.mp3`);
  const simulate = () => {
    if (stopped) return;
    // No recording yet: show the waveform anyway so the flow can be demoed.
    note.textContent = answer.custom
      ? 'Written by Noor\u2019s daughter. Noor will record it next.'
      : 'Recording placeholder. Noor\u2019s own voice goes here.';
    const voice = window.speechSynthesis?.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('sw'));
    if (voice) {
      const u = new SpeechSynthesisUtterance(answer.sw);
      u.voice = voice; u.lang = voice.lang; speechSynthesis.speak(u);
    }
    const ms = Math.max(3500, answer.sw.length * 70);
    const t0 = performance.now();
    const tick = now => {
      const p = (now - t0) / ms;
      if (p >= 1 || stopped) return finish();
      wave.set(p); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  audio.addEventListener('error', simulate, { once: true });
  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('playing', () => {
    note.textContent = '';
    const tick = () => {
      if (stopped) return;
      if (audio.duration) wave.set(audio.currentTime / audio.duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }, { once: true });
  audio.play().catch(() => {});
}

// ---------- answer card ----------
function renderAnswer(result, question) {
  const out = $('#answer');
  const a = result.answer;
  stopPlayback();
  if (!a) return renderUnsure(result, question);

  const idx = answers.indexOf(a) + 1;
  out.innerHTML = `
    <article class="kanga" style="--accent:${accentFor(a.id)}">
      <div class="kanga-field">
        <header class="kanga-head">
          <div class="kanga-tile">${kangaTile(a.id)}</div>
          <div>
            <p class="kanga-topic">${a.topic}</p>
            <p class="kanga-count">Noor\u2019s answer ${idx} of ${answers.length}</p>
          </div>
        </header>
        <p class="sw" lang="sw">${a.sw}</p>
        <div class="player">
          <button type="button" class="play" data-state="idle" aria-label="Play Noor\u2019s answer"><span></span></button>
          <canvas class="wave" aria-hidden="true"></canvas>
        </div>
        <p class="play-note" id="play-note" aria-live="polite"></p>
        <p class="tr" id="tr" lang="${lang}">${a[lang] || a.en}</p>
        <div class="langs" role="group" aria-label="Subtitle language">
          ${LANGS.map(l => `<button type="button" data-lang="${l}" aria-pressed="${l === lang}">${LANG_NAMES[l]}</button>`).join('')}
        </div>
      </div>
      <p class="jina" lang="sw">${a.sw_title}</p>
    </article>
    ${matchNote(result)}`;

  out.hidden = false; // must be visible before the waveform measures itself
  const wave = new VoiceWave(out.querySelector('.wave'), a.id);
  current = { answer: a, wave };
  out.querySelector('.play').addEventListener('click', e => {
    const btn = e.currentTarget;
    if (btn.dataset.state === 'playing') stopPlayback();
    else playAnswer(a, wave, btn);
  });
  out.querySelectorAll('.langs button').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    out.querySelectorAll('.langs button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const tr = $('#tr'); tr.lang = lang; tr.textContent = a[lang] || a.en;
  }));
  out.hidden = false;
  out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function matchNote(result) {
  const how = result.mode === 'ai' ? 'AI on this phone' : 'keyword matching';
  return `
    <aside class="match">
      <div class="orb" style="--orb:${orbStyle(result.score)}" aria-hidden="true"><i></i><i></i></div>
      <p>Matched by ${how}, strength ${result.score.toFixed(2)}.
      These are Noor\u2019s own words. The AI only chose which answer to play.</p>
    </aside>`;
}

function renderUnsure(result, question) {
  const out = $('#answer');
  store.addToQueue(question, lang);
  out.innerHTML = `
    <article class="kanga kanga-unsure">
      <div class="kanga-field">
        <header class="kanga-head">
          <div class="kanga-tile">${kangaTile('unsure', { muted: true })}</div>
          <div>
            <p class="kanga-topic">Saved for Noor\u2019s daughter</p>
            <p class="kanga-count">\u201c${escapeHtml(question)}\u201d</p>
          </div>
        </header>
        <p class="sw" lang="sw">${UNSURE.sw}</p>
        <p class="tr" lang="${lang}">${UNSURE[lang]}</p>
      </div>
      <p class="jina" lang="sw">Nitakujibu</p>
    </article>
    <aside class="match">
      <div class="orb" style="--orb:${orbStyle(result.score)}" aria-hidden="true"><i></i><i></i></div>
      <p>${result.score < 0.05
        ? 'None of Noor\u2019s answers came close.'
        : `The closest answer was \u201c${result.candidate.topic}\u201d (strength ${result.score.toFixed(2)}), below the ${result.threshold.toFixed(2)} needed.`}
      Rather than guess, the question goes to a person.</p>
    </aside>`;
  out.hidden = false;
  out.scrollIntoView({ block: 'start' });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- ask ----------
async function ask(e) {
  e?.preventDefault();
  const question = $('#q').value.trim();
  if (!question) { $('#q').focus(); return; }
  const detected = detectLang(question);
  if (detected) lang = detected;
  $('#answer').hidden = true;
  $('#listening').hidden = false;
  const started = performance.now();
  const result = await matcher.match(question);
  const wait = Math.max(0, 700 - (performance.now() - started)); // let the listening moment register
  setTimeout(() => {
    $('#listening').hidden = true;
    renderAnswer(result, question);
  }, wait);
}

// ---------- boot ----------
async function boot() {
  drawHighlands($('#hero-canvas'));
  let resizeT;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { drawHighlands($('#hero-canvas')); current?.wave.draw(); }, 150);
  });

  setConnection();
  addEventListener('online', setConnection);
  addEventListener('offline', setConnection);

  answers = await loadAnswers();
  $('#count').textContent = answers.length;
  renderSuggestions();
  document.querySelectorAll('[data-tile]').forEach(el => { el.innerHTML = kangaTile(el.dataset.tile); });

  matcher = new Matcher(answers);
  $('#ask').addEventListener('submit', ask);
  setEngine('Getting Noor\u2019s answers ready on this phone\u2026', 'loading');
  const mode = await matcher.init(({ loaded, total }) => {
    setEngine(`Saving the AI model to this phone: ${(loaded / 1e6).toFixed(0)} of ${(total / 1e6).toFixed(0)} MB`, 'loading');
  });
  setEngine(mode === 'ai'
    ? 'AI runs on this phone. Works without signal.'
    : 'Simple matching mode. The AI model could not load.', mode);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
